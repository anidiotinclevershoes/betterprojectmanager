/**
 * Phase 3F — keep explicit ownership mapping; drop inferred defaults.
 *
 * "Sarah owns UAT" may rematerialise into the existing responsibility
 * operation. Unstated mode must not become `share`. Role-only lines stay
 * Person. Planner Needs You already covers share-vs-replace.
 *
 * Run: npx tsx scripts/verify-capture-simplify-3f-ownership.ts
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

  check("3. Explicit first assignment rematerialises without inventing share", () => {
    const run = runFrom("Sarah Kim owns float safety.", [
      {
        id: "obs-sarah",
        statement: "Sarah Kim owns float safety",
        evidence: "Sarah Kim owns float safety.",
        domain: "person",
        disposition: "create_new",
        truthIntent: "current",
        candidateTargetTitle: "Sarah Kim",
        proposedValues: { name: "Sarah Kim" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
    if (run.resolved[0]?.decision.kind === "write") {
      assert.equal(run.resolved[0].decision.operation.type, "confirm_responsibility");
    }
    assert.equal(run.resolved[0]?.suggestion?.ownershipSemantics, undefined);
    assert.notEqual(run.resolved[0]?.suggestion?.ownershipSemantics, "share");
  });

  check("4. Explicit share still writes as share", () => {
    const run = runFrom("Sarah Kim owns float safety.", [
      {
        id: "obs-share",
        statement: "Sarah Kim owns float safety",
        evidence: "Sarah Kim owns float safety.",
        domain: "person",
        disposition: "create_new",
        truthIntent: "current",
        candidateTargetTitle: "Sarah Kim",
        proposedValues: {
          name: "Sarah Kim",
          ownershipSemantics: "share",
        },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "write");
    assert.equal(run.resolved[0]?.suggestion?.ownershipSemantics, "share");
  });

  check("5. Unstated mode plus a current owner is Needs You, not inferred share", () => {
    const run = runFrom("Fizz Caramel owns UAT lead.", [
      {
        id: "obs-fizz",
        statement: "Fizz Caramel owns UAT lead",
        evidence: "Fizz Caramel owns UAT lead.",
        domain: "person",
        disposition: "create_new",
        truthIntent: "current",
        candidateTargetTitle: "Fizz Caramel",
        proposedValues: { name: "Fizz Caramel" },
      },
    ]);
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    if (run.resolved[0]?.decision.kind === "needs_you") {
      assert.match(run.resolved[0].decision.reason, /share or replace/i);
    }
    assert.equal(writes(run).length, 0);
    assert.notEqual(run.resolved[0]?.suggestion?.ownershipSemantics, "share");
  });

  check("6. Role-only Person stays Person, not a manufactured responsibility", () => {
    const run = runFrom("Fizz Caramel is the designer.", [
      {
        id: "obs-role",
        statement: "Fizz Caramel is the designer",
        evidence: "Fizz Caramel is the designer.",
        domain: "person",
        disposition: "create_new",
        truthIntent: "current",
        candidateTargetTitle: "Fizz Caramel",
        proposedValues: { name: "Fizz Caramel", role: "Designer" },
      },
    ]);
    assert.equal(run.resolved[0]?.observation.domain, "person");
    if (run.resolved[0]?.decision.kind === "write") {
      assert.notEqual(run.resolved[0].decision.operation.type, "confirm_responsibility");
    }
  });

  check("7. Ownership rematerialise remains; inferred share default is gone", () => {
    const resolve = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/resolve.ts"),
      "utf8",
    );
    assert.match(resolve, /function rematerializeOwnershipAsResponsibility/);
    assert.doesNotMatch(
      resolve,
      /ownership === "ambiguous"\s*\? ownership\s*: "share"/,
    );
    assert.doesNotMatch(
      resolve,
      /disposition === "no_change"\s*\?\s*"create_new"/,
    );
  });

  check("8. Ready still means planner-executable; Apply still plans", () => {
    const item: PendingSuggestion = {
      id: "sug-3f",
      kind: "stakeholder",
      op: "create",
      content: "Sarah Kim owns float safety",
      destination: "project",
      projectId: CANDYLAND_ID,
      legalDomain: "responsibility",
      personName: "Sarah Kim",
      responsibilityScope: "float safety",
    };
    const ready = assessApplyReadiness({
      item,
      text: "Sarah Kim owns float safety",
      preflight: { world: world(), captureEntryProjectId: CANDYLAND_ID },
    });
    assert.equal(ready.canApprove, true);
    const planned = planCaptureApply({
      item,
      text: "Sarah Kim owns float safety",
      world: world(),
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(planned.kind, "write");
  });

  console.log(`\n${passed} Phase 3F ownership checks passed.`);
}

main();
