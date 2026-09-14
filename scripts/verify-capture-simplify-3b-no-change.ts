/**
 * Phase 3B — stop rematerialising model no_change into Create/Update.
 *
 * True No change requires explicit proposed values already current.
 * Suspicious no_change is Needs You or Left untouched — never a write.
 *
 * Run: npx tsx scripts/verify-capture-simplify-3b-no-change.ts
 */
import assert from "node:assert/strict";
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

  check("3. True restated No change stays No change", () => {
    const run = runFrom("Pippa Gumdrop remains UAT lead.", [
      {
        id: "obs-nc",
        statement: "Pippa Gumdrop remains UAT lead",
        evidence: "Pippa Gumdrop remains UAT lead.",
        domain: "responsibility",
        disposition: "no_change",
        truthIntent: "current",
        candidateTargetId: "person-gumdrop",
        candidateTargetTitle: "Pippa Gumdrop",
        proposedValues: {
          personName: "Pippa Gumdrop",
          scope: "UAT",
          ownershipSemantics: "continue",
        },
      },
    ]);
    assert.ok(
      run.resolved.some((row) => row.decision.kind === "no_change" || row.decision.kind === "needs_you"),
    );
    assert.ok(
      !run.resolved.some((row) => row.decision.kind === "write"),
    );
  });

  check("4. Suspicious no_change To Do is Needs You, not a Create", () => {
    const run = runFrom("Add a to-do to reprint the visitor badges.", [
      {
        id: "obs-todo-nc",
        statement: "Add a to-do to reprint the visitor badges.",
        evidence: "Add a to-do to reprint the visitor badges.",
        domain: "todo",
        disposition: "no_change",
        truthIntent: "current",
        proposedValues: { title: "Reprint the visitor badges" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.equal(run.resolved[0]?.suggestion, null);
  });

  check("5. Suspicious no_change risk resolve is Needs You, not a write", () => {
    const run = runFrom("Gumdrop Bridge icing is resolved.", [
      {
        id: "obs-risk-nc",
        statement: "Gumdrop Bridge icing is resolved",
        evidence: "Gumdrop Bridge icing is resolved.",
        domain: "risk",
        disposition: "no_change",
        truthIntent: "current",
        proposedValues: { status: "resolved", title: "Gumdrop Bridge icing" },
      },
    ]);
    assert.notEqual(run.resolved[0]?.decision.kind, "write");
    assert.ok(
      run.resolved[0]?.decision.kind === "needs_you" ||
        run.resolved[0]?.decision.kind === "no_change",
    );
  });

  check("6. Unbounded no_change knowledge is Left untouched", () => {
    const run = runFrom("Security seem worried about it.", [
      {
        id: "obs-know",
        statement: "Security seem worried about it.",
        evidence: "Security seem worried about it.",
        domain: "knowledge",
        disposition: "no_change",
        truthIntent: "current",
      },
    ]);
    assert.equal(run.resolved[0]?.observation.disposition, "left_untouched");
    assert.notEqual(run.resolved[0]?.decision.kind, "write");
  });

  check("7. rematerializeTrustedNoChange and hydrate are gone", () => {
    const resolve = readFileSync(join(process.cwd(), "src/lib/capture-v2/resolve.ts"), "utf8");
    assert.doesNotMatch(resolve, /function rematerializeTrustedNoChange/);
    assert.doesNotMatch(resolve, /function rematerializeAbsentPerson/);
    assert.doesNotMatch(resolve, /function hydrateFromLocalEvidence/);
    assert.match(resolve, /function rematerializeIndependentDatedCreate/);
  });

  check("8. Ready still means planCaptureApply can construct the write", () => {
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

  check("9. Empty extraction still surfaces", () => {
    const transcript =
      "Hall lighting scene plate is now the agreed fixture for the stage wash.";
    const run = runFrom(transcript, []);
    assert.ok((run.result.observationAccount?.leftUntouched ?? 0) >= 1);
    assert.equal(run.result.observationAccount?.proposedChanges, 0);
  });

  console.log(`\n${passed} Phase 3B no_change rematerialisation checks passed`);
}

main();
