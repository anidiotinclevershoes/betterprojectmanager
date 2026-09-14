/**
 * Phase 3D — stop linguistic hydration of missing model semantics.
 *
 * The extraction call is the language interpreter. Missing required
 * values become Needs You or Left untouched. Do not recover dates,
 * statuses, names, or titles from surrounding English.
 *
 * Run: npx tsx scripts/verify-capture-simplify-3d-hydrate.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runCaptureV2FromModelJson } from "../src/lib/capture-v2";
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

function writes(run: ReturnType<typeof runFrom>) {
  return (run.resolved ?? []).filter((row) => row.decision.kind === "write");
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
    const run = runFrom("Parade day moved to 22 October 2026.", [
      {
        id: "obs-ms",
        statement: "Parade day moved to 22 October 2026",
        evidence: "Parade day moved to 22 October 2026.",
        domain: "milestone",
        disposition: "update_existing",
        truthIntent: "current",
        candidateTargetId: "ms-parade",
        candidateTargetTitle: "Parade day",
        proposedValues: { date: "2026-10-22" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
  });

  check("3. True No change still holds with explicit already-current values", () => {
    const run = runFrom("Parade day is still 15 October 2026.", [
      {
        id: "obs-same",
        statement: "Parade day is still 15 October 2026",
        evidence: "Parade day is still 15 October 2026.",
        domain: "milestone",
        disposition: "no_change",
        truthIntent: "current",
        candidateTargetId: "ms-parade",
        candidateTargetTitle: "Parade day",
        proposedValues: { date: "2026-10-15", title: "Parade day" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "no_change");
    assert.equal(writes(run).length, 0);
  });

  check("4. Missing date that hydrate used to recover is Needs You, not a write", () => {
    const run = runFrom("Parade day is still 15 October 2026.", [
      {
        id: "obs-missing-date",
        statement: "Parade day is still 15 October 2026",
        evidence: "Parade day is still 15 October 2026.",
        domain: "milestone",
        disposition: "no_change",
        truthIntent: "current",
        candidateTargetId: "ms-parade",
        candidateTargetTitle: "Parade day",
        proposedValues: { title: "Parade day" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.equal(run.resolved[0]?.suggestion, null);
    assert.equal(writes(run).length, 0);
  });

  check("5. Missing status is not reconstructed from English", () => {
    const run = runFrom("Gumdrop Bridge icing is resolved.", [
      {
        id: "obs-missing-status",
        statement: "Gumdrop Bridge icing is resolved",
        evidence: "Gumdrop Bridge icing is resolved.",
        domain: "risk",
        disposition: "no_change",
        truthIntent: "current",
        candidateTargetId: "risk-bridge",
        candidateTargetTitle: "Gumdrop Bridge icing",
        proposedValues: { title: "Gumdrop Bridge icing" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.equal(writes(run).length, 0);
  });

  check("6. Empty extraction still surfaces — no silent loss", () => {
    const transcript =
      "Hall lighting scene plate is now the agreed fixture for the stage wash.";
    const run = runFrom(transcript, []);
    assert.ok((run.result.observationAccount?.leftUntouched ?? 0) >= 1);
    assert.equal(run.result.observationAccount?.proposedChanges, 0);
  });

  check("7. Linguistic hydrate helpers are gone; no replacement parser", () => {
    const resolve = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/resolve.ts"),
      "utf8",
    );
    assert.doesNotMatch(resolve, /function hydrateFromLocalEvidence/);
    assert.doesNotMatch(resolve, /function isoDateFromLocalText/);
    assert.doesNotMatch(resolve, /function statusTokenFromLocalText/);
    assert.doesNotMatch(resolve, /function twoTokenNameFromLocalText/);
    assert.doesNotMatch(resolve, /function looksLikeRestatement/);
    assert.doesNotMatch(resolve, /function looksLikeNewAssignment/);
    assert.doesNotMatch(resolve, /NAME_EXTRACT_STOP/);
    assert.doesNotMatch(resolve, /MONTH_TO_ISO/);
    assert.equal(
      execFileSync("git", ["diff", "origin/main", "--", "src/lib/capture-v2/prompt.ts"], {
        encoding: "utf8",
      }),
      "",
    );
  });

  check("8. Ready still means planner-executable; Apply still plans", () => {
    const item: PendingSuggestion = {
      id: "sug-3d",
      kind: "action",
      op: "create",
      content: "Order extra sprinkles",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "todo",
    };
    const ready = assessApplyReadiness({
      item,
      text: "Order extra sprinkles",
      preflight: { world: world(), captureEntryProjectId: CANDYLAND_ID },
    });
    assert.equal(ready.canApprove, true);
    const planned = planCaptureApply({
      item,
      text: "Order extra sprinkles",
      world: world(),
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(planned.kind, "write");
  });

  console.log(`\n${passed} Phase 3D hydration-removal checks passed.`);
}

main();
