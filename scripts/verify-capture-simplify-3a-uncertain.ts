/**
 * Phase 3A — stop rematerialising uncertain observations into writes.
 *
 * truthIntent=uncertain no longer becomes current Create/Update solely
 * because rematerializeIndependentDatedCreate can complete a dated shape.
 *
 * Does not change no_change rematerialisation, hydrate, Prompt A, or Apply.
 *
 * Run: npx tsx scripts/verify-capture-simplify-3a-uncertain.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEFT_UNTOUCHED_GENERIC_REASON,
  runCaptureV2FromModelJson,
} from "../src/lib/capture-v2";
import {
  assessApplyReadiness,
  planCaptureApply,
} from "../src/lib/capture/apply";
import { CANDYLAND_ID, experimentalApplyWorld } from "../src/lib/experiments/worlds";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

const ROOT = process.cwd();

function world() {
  return experimentalApplyWorld();
}

function runFrom(transcript: string, observations: unknown[]) {
  return runCaptureV2FromModelJson({
    transcript,
    rawModelJson: { observations },
    world: world(),
    projectId: CANDYLAND_ID,
  });
}

function gitDiffAgainstMain(rel: string): string {
  return execFileSync("git", ["diff", "origin/main", "--", rel], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function main() {
  check("1. Ordinary current Create still writes", () => {
    const run = runFrom("Create a to-do to order extra sprinkles.", [
      {
        id: "obs-todo",
        statement: "Create a to-do to order extra sprinkles",
        evidence: "Create a to-do to order extra sprinkles.",
        domain: "todo",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { title: "Order extra sprinkles" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
  });

  check("2. Ordinary current Update still writes", () => {
    const run = runFrom("Gumdrop Bridge icing is resolved.", [
      {
        id: "obs-risk",
        statement: "Gumdrop Bridge icing is resolved",
        evidence: "Gumdrop Bridge icing is resolved.",
        domain: "risk",
        disposition: "update_existing",
        truthIntent: "current",
        candidateTargetId: "risk-bridge",
        candidateTargetTitle: "Gumdrop Bridge icing",
        proposedValues: { status: "resolved" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
  });

  check("3. True bounded ambiguity remains Needs You", () => {
    const run = runFrom("She will own UAT.", [
      {
        id: "obs-amb",
        statement: "She will own UAT",
        evidence: "She will own UAT.",
        domain: "responsibility",
        disposition: "ambiguous",
        truthIntent: "current",
        proposedValues: {
          personName: "She",
          scope: "UAT",
          ownershipSemantics: "ambiguous",
        },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.notEqual(run.resolved[0]?.observation.disposition, "left_untouched");
  });

  check("4. Uncertain complete dated Create is Needs You, not a rematerialised write", () => {
    const run = runFrom("Collect the void keys from the depot on 16 October 2026.", [
      {
        id: "obs-keys",
        statement: "Collect the void keys from the depot on 16 October 2026.",
        evidence: "collect the void keys from the depot on 16 October 2026.",
        domain: "todo",
        disposition: "create_new",
        truthIntent: "uncertain",
        proposedValues: {
          title: "Collect void keys from the depot",
          date: "2026-10-16",
        },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.equal(run.resolved[0]?.suggestion, null);
    assert.equal(run.resolved[0]?.observation.truthIntent, "uncertain");
    assert.equal(run.resolved[0]?.observation.disposition, "create_new");
  });

  check("5. Uncertain update-without-id does not rematerialise into Create", () => {
    const run = runFrom("Void keys still need collecting from the depot on 16 Oct 2026.", [
      {
        id: "obs-keys-update",
        statement: "Void keys need collecting from the depot on 16 Oct 2026.",
        evidence: "Void keys still need collecting from the depot on 16 Oct 2026.",
        domain: "todo",
        disposition: "update_existing",
        truthIntent: "uncertain",
        proposedValues: {
          title: "Collect void keys from the depot",
          date: "2026-10-16",
        },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.equal(run.resolved[0]?.suggestion, null);
  });

  check("6. Non-bounded uncertain no_change becomes Left untouched", () => {
    const run = runFrom("Security seem worried about it.", [
      {
        id: "obs-nc",
        statement: "Security seem worried about it.",
        evidence: "Security seem worried about it.",
        domain: "knowledge",
        disposition: "no_change",
        truthIntent: "uncertain",
        commentary: "Not clear what should change.",
      },
    ]);
    assert.equal(run.resolved[0]?.observation.disposition, "left_untouched");
    assert.notEqual(run.resolved[0]?.decision.kind, "write");
    assert.notEqual(run.resolved[0]?.decision.kind, "needs_you");
    assert.equal(run.resolved[0]?.suggestion, null);
  });

  check("7. Uncertain leftover / unknown stays Left untouched and visible", () => {
    const run = runFrom("I think Security might be worried.", [
      {
        id: "obs-left",
        statement: "I think Security might be worried.",
        evidence: "I think Security might be worried.",
        domain: "unknown",
        disposition: "left_untouched",
        truthIntent: "uncertain",
        commentary: LEFT_UNTOUCHED_GENERIC_REASON,
      },
    ]);
    assert.equal(run.resolved[0]?.observation.disposition, "left_untouched");
    assert.notEqual(run.resolved[0]?.decision.kind, "write");
    assert.ok((run.result.observationAccount?.leftUntouched ?? 0) >= 1);
  });

  check("8. Empty extraction still surfaces — no silent loss", () => {
    const transcript =
      "Hall lighting scene plate is now the agreed fixture for the stage wash.";
    const run = runFrom(transcript, []);
    assert.ok((run.result.observationAccount?.leftUntouched ?? 0) >= 1);
    assert.equal(run.result.observationAccount?.proposedChanges, 0);
    assert.ok(
      (run.result.findings ?? []).some((finding) => finding.leftUntouched),
    );
  });

  check("9. Ready still means planCaptureApply can construct the write", () => {
    const item: PendingSuggestion = {
      id: "ready-todo",
      kind: "action",
      op: "create",
      content: "Book the war room",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "todo",
    };
    const ready = assessApplyReadiness({
      item,
      text: "Book the war room",
      preflight: { world: world(), captureEntryProjectId: CANDYLAND_ID },
    });
    assert.equal(ready.canApprove, true);
    const planned = planCaptureApply({
      item,
      text: "Book the war room",
      world: world(),
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(planned.kind, "write");
  });

  check("10. Current update-without-id rematerialise is unchanged", () => {
    const run = runFrom("Void keys still need collecting from the depot on 16 Oct 2026.", [
      {
        id: "obs-keys-current",
        statement: "Void keys need collecting from the depot on 16 Oct 2026.",
        evidence: "Void keys still need collecting from the depot on 16 Oct 2026.",
        domain: "todo",
        disposition: "update_existing",
        truthIntent: "current",
        proposedValues: {
          title: "Collect void keys from the depot",
          date: "2026-10-16",
        },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
  });

  check("11. hydrate / dated rematerialise / Prompt A stay in place", () => {
    assert.equal(gitDiffAgainstMain("src/lib/capture-v2/prompt.ts"), "");
    assert.equal(gitDiffAgainstMain("src/lib/capture-v2/source-coverage.ts"), "");
    const resolve = readFileSync(join(ROOT, "src/lib/capture-v2/resolve.ts"), "utf8");
    assert.match(resolve, /function hydrateFromLocalEvidence/);
    assert.match(resolve, /function rematerializeIndependentDatedCreate/);
    assert.doesNotMatch(
      resolve,
      /truthIntent === "uncertain"[\s\S]{0,180}rematerializeIndependentDatedCreate/,
    );
  });

  console.log(`\n${passed} Phase 3A uncertain-rematerialisation checks passed`);
}

main();
