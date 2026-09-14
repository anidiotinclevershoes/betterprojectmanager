/**
 * Phase 3C — stop rescuing invalid/foreign identity into Create.
 *
 * Foreign IDs stay rejected. Explicit Create without a fake canonical ID
 * still writes. Unique-title bind is not this checkpoint.
 * Do not manufacture Create merely because an invalid target had a title.
 *
 * Run: npx tsx scripts/verify-capture-simplify-3c-foreign-id.ts
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

  check("3. Scoped foreign ID + title on Update is rejected, not a Create", () => {
    const run = runFrom(
      "Collect the void keys from the depot on 16 October 2026.",
      [
        {
          id: "obs-keys",
          statement: "Collect the void keys from the depot on 16 October 2026",
          evidence: "Collect the void keys from the depot on 16 October 2026.",
          domain: "todo",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "todo-from-another-universe",
          candidateTargetTitle: "Collect void keys from the depot",
          proposedValues: {
            title: "Collect void keys from the depot",
            date: "2026-10-16",
          },
        },
      ],
    );
    assert.ok(run.validation.issues.some((issue) => issue.code === "foreign_id"));
    assert.equal(run.validation.observations.length, 0);
    assert.equal(run.validation.rejected.length, 1);
    assert.equal(writes(run).length, 0);
    assert.equal(run.result.findingsValidation?.invalidTargetCount, 1);
    assert.equal(run.result.findings?.[0]?.requiresClarification, true);
    assert.equal(run.result.findings?.[0]?.invalidTarget, true);
  });

  check("4. Scoped foreign ID + title on Create is rejected, not rescued", () => {
    const run = runFrom("Order extra sprinkles for the float.", [
      {
        id: "obs-create-foreign",
        statement: "Order extra sprinkles for the float",
        evidence: "Order extra sprinkles for the float.",
        domain: "todo",
        disposition: "create_new",
        truthIntent: "current",
        candidateTargetId: "todo-invented-canonical",
        candidateTargetTitle: "Order extra sprinkles",
        proposedValues: { title: "Order extra sprinkles" },
      },
    ]);
    assert.ok(run.validation.issues.some((issue) => issue.code === "foreign_id"));
    assert.equal(run.validation.observations.length, 0);
    assert.equal(writes(run).length, 0);
    assert.equal(run.result.findings?.[0]?.requiresClarification, true);
  });

  check("5. Unscoped New Project create_new still strips invented ids", () => {
    const run = runFrom(
      "bob is the ba",
      [
        {
          id: "obs-bob",
          statement: "bob is the ba",
          evidence: "bob is the ba",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          candidateTargetId: "person-bob",
          proposedValues: { name: "bob" },
        },
      ],
      null,
    );
    assert.ok(run.validation.issues.some((issue) => issue.code === "foreign_id"));
    assert.equal(run.validation.observations.length, 1);
    assert.equal(run.validation.observations[0]?.disposition, "create_new");
    assert.equal(run.validation.observations[0]?.candidateTargetId, null);
    assert.equal(run.validation.rejected.length, 0);
  });

  check("6. Wrong in-project UUID + incompatible title is Needs You, not a write", () => {
    const run = runFrom(
      "Create a Cafe snag list. Do not reuse the jelly pack chase.",
      [
        {
          id: "obs-wrong-id",
          statement: "Create a Cafe snag list",
          evidence: "Create a Cafe snag list. Do not reuse the jelly pack chase.",
          domain: "todo",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "todo-pack",
          candidateTargetTitle: "Cafe snag list",
          proposedValues: { title: "Cafe snag list" },
        },
      ],
    );
    assert.equal(run.validation.observations.length, 1);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.equal(run.resolved[0]?.suggestion, null);
    assert.equal(writes(run).length, 0);
  });

  check("7. Update without identity and no unique title is Needs You", () => {
    const run = runFrom("Raise a hall timber floor services risk.", [
      {
        id: "obs-no-id",
        statement: "Hall timber floor services risk",
        evidence: "Raise a hall timber floor services risk.",
        domain: "risk",
        disposition: "update_existing",
        truthIntent: "current",
        proposedValues: { title: "Hall timber floor services risk" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.equal(writes(run).length, 0);
  });

  check("8. Unique title plus a wrong-type ID is Needs You, not a bind", () => {
    const run = runFrom("Parade day moved to 22 October 2026.", [
      {
        id: "obs-title-bind",
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
  });

  check("9. Rescue helpers are gone; no replacement interpreter", () => {
    const validate = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/validate.ts"),
      "utf8",
    );
    const resolve = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/resolve.ts"),
      "utf8",
    );
    assert.doesNotMatch(validate, /function canAcceptForeignTargetAsCreate/);
    assert.doesNotMatch(validate, /function createPayloadPresent/);
    assert.doesNotMatch(
      resolve,
      /A model UUID is not identity\. Wrong-type \/ missing \/ title-incompatible/,
    );
    assert.doesNotMatch(
      resolve,
      /disposition: "create_new",\s*truthIntent: "current",\s*candidateTargetId: null,\s*candidateTargetTitle: title,/,
    );
    assert.doesNotMatch(resolve, /function rematerializeIndependentDatedCreate/);
    assert.doesNotMatch(resolve, /function uniqueTitledRecord/);
  });

  check("10. Ready still means planner-executable; Apply still plans", () => {
    const item: PendingSuggestion = {
      id: "sug-3c",
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

  console.log(`\n${passed} Phase 3C foreign-ID checks passed.`);
}

main();
