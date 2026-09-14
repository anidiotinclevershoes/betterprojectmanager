/**
 * Phase 3E — stop unique-title automatic bind.
 *
 * A coincidentally unique title is not authoritative identity.
 * Explicit valid IDs and observation-local evidence still stand.
 * Title-only Update becomes Needs You. Genuine Create still writes.
 *
 * Run: npx tsx scripts/verify-capture-simplify-3e-unique-title.ts
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

function runFrom(
  transcript: string,
  observations: unknown[],
  projectId: string | null = CANDYLAND_ID,
) {
  return runCaptureV2FromModelJson({
    transcript,
    rawModelJson: { observations },
    world: world(),
    projectId,
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
    if (run.resolved[0]?.decision.kind === "write") {
      assert.equal(run.resolved[0].decision.operation.type, "create_todo");
    }
  });

  check("2. Ordinary current Update with a valid ID still writes", () => {
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
        proposedValues: { title: "Parade day", date: "2026-10-22" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
    if (run.resolved[0]?.decision.kind === "write") {
      assert.equal(run.resolved[0].decision.operation.type, "update_milestone");
    }
  });

  check("3. Title-only Update of a unique existing target is Needs You", () => {
    const run = runFrom("Parade day moved to 22 October 2026.", [
      {
        id: "obs-title-only",
        statement: "Parade day moved to 22 October 2026",
        evidence: "Parade day moved to 22 October 2026.",
        domain: "milestone",
        disposition: "update_existing",
        truthIntent: "current",
        candidateTargetTitle: "Parade day",
        proposedValues: { title: "Parade day", date: "2026-10-22" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.match(
      String(
        run.resolved[0]?.decision.kind === "needs_you"
          ? run.resolved[0].decision.reason
          : "",
      ),
      /valid existing identity/i,
    );
    assert.equal(run.resolved[0]?.suggestion, null);
    assert.equal(writes(run).length, 0);
  });

  check("4. Wrong-type ID plus a unique title is Needs You, not a bind", () => {
    const run = runFrom("Parade day moved to 22 October 2026.", [
      {
        id: "obs-wrong-type",
        statement: "Parade day moved to 22 October 2026",
        evidence: "Parade day moved to 22 October 2026.",
        domain: "milestone",
        disposition: "update_existing",
        truthIntent: "current",
        candidateTargetId: "todo-pack",
        candidateTargetTitle: "Parade day",
        proposedValues: { title: "Parade day", date: "2026-10-22" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.equal(writes(run).length, 0);
    if (run.resolved[0]?.decision.kind === "needs_you") {
      assert.match(run.resolved[0].decision.reason, /could not be identified|valid existing identity/i);
    }
  });

  check("5. Explicit create_new of a genuine new title still writes", () => {
    const run = runFrom("Create a milestone for the float rehearsal on 8 October 2026.", [
      {
        id: "obs-create-ms",
        statement: "Create a milestone for the float rehearsal on 8 October 2026",
        evidence: "Create a milestone for the float rehearsal on 8 October 2026.",
        domain: "milestone",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { title: "Float rehearsal", date: "2026-10-08" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
    if (run.resolved[0]?.decision.kind === "write") {
      assert.equal(run.resolved[0].decision.operation.type, "create_milestone");
    }
  });

  check("6. Mixed Capture: valid Update writes; title-only sibling is Needs You", () => {
    const run = runFrom(
      "Gumdrop Bridge icing is resolved. Parade day moved to 22 October 2026.",
      [
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
        {
          id: "obs-title-only",
          statement: "Parade day moved to 22 October 2026",
          evidence: "Parade day moved to 22 October 2026.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetTitle: "Parade day",
          proposedValues: { title: "Parade day", date: "2026-10-22" },
        },
      ],
    );
    assert.equal(run.resolved[0]?.decision.kind, "write");
    assert.equal(run.resolved[1]?.decision.kind, "needs_you");
    assert.equal(writes(run).length, 1);
  });

  check("7. Title-only existing target is not a silent No change or Left untouched", () => {
    const run = runFrom("Parade day moved to 22 October 2026.", [
      {
        id: "obs-no-silent",
        statement: "Parade day moved to 22 October 2026",
        evidence: "Parade day moved to 22 October 2026.",
        domain: "milestone",
        disposition: "update_existing",
        truthIntent: "current",
        candidateTargetTitle: "Parade day",
        proposedValues: { title: "Parade day", date: "2026-10-22" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.notEqual(run.resolved[0]?.observation.disposition, "left_untouched");
    assert.notEqual(run.resolved[0]?.decision.kind, "no_change");
    assert.notEqual(run.resolved[0]?.decision.kind, "write");
  });

  check("8. Unique-title bind helpers are gone; observation-local evidence remains", () => {
    const resolve = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/resolve.ts"),
      "utf8",
    );
    assert.doesNotMatch(resolve, /function rematerializeIndependentDatedCreate/);
    assert.doesNotMatch(resolve, /function uniqueTitledRecord/);
    assert.doesNotMatch(resolve, /function rematerializeTitle/);
    assert.doesNotMatch(resolve, /fuzzy/);
    assert.match(resolve, /function uniquelyEvidencedRecords/);
    assert.match(resolve, /function scopedEntityIdentityGate/);
  });

  check("9. Ready still means planner-executable; Apply still plans", () => {
    const item: PendingSuggestion = {
      id: "sug-3e",
      kind: "milestone",
      op: "update",
      content: "Parade day",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "milestone",
      targetEntityId: "ms-parade",
      date: "2026-10-22",
    };
    const ready = assessApplyReadiness({
      item,
      text: "Parade day moved to 22 October 2026",
      preflight: { world: world(), captureEntryProjectId: CANDYLAND_ID },
    });
    assert.equal(ready.canApprove, true);
    const planned = planCaptureApply({
      item,
      text: "Parade day moved to 22 October 2026",
      world: world(),
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(planned.kind, "write");
  });

  console.log(`\n${passed} Phase 3E unique-title checks passed.`);
}

main();
