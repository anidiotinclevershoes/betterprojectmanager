/**
 * Phase 6 — isolation smoke for experimental worlds.
 * Candyland mutations must not touch Toyworld / GamingStudio5000 records.
 *
 * Run: npx tsx scripts/verify-phase6-worlds.ts
 */
import assert from "node:assert/strict";
import { planCaptureApply } from "../src/lib/capture/apply";
import {
  contextRecordsFromWorld,
  resolveObservations,
  validateObservations,
} from "../src/lib/capture-v2";
import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
  experimentalApplyWorld,
} from "../src/lib/experiments/worlds";

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function snapshot(world: ReturnType<typeof experimentalApplyWorld>) {
  return JSON.stringify({
    toyRisks: world.risks.filter((r) => r.projectId === TOYWORLD_ID),
    gameRisks: world.risks.filter((r) => r.projectId === GAMING_ID),
    toyPeople: world.projects.find((p) => p.id === TOYWORLD_ID)?.stakeholders,
    gamePeople: world.projects.find((p) => p.id === GAMING_ID)?.stakeholders,
    toyTodos: world.todos.filter((t) => t.projectId === TOYWORLD_ID),
    gameTodos: world.todos.filter((t) => t.projectId === GAMING_ID),
    toyDates: world.timeline.filter((t) => t.projectId === TOYWORLD_ID),
    gameDates: world.timeline.filter((t) => t.projectId === GAMING_ID),
  });
}

function main() {
  const world = experimentalApplyWorld();
  const before = snapshot(world);
  const records = contextRecordsFromWorld(world, CANDYLAND_ID);
  const validated = validateObservations(
    [
      {
        id: "obs-risk",
        statement: "Gumdrop Bridge icing is resolved",
        evidence: "Gumdrop Bridge icing is resolved.",
        domain: "risk",
        disposition: "update_existing",
        truthIntent: "current",
        candidateTargetId: "risk-bridge",
        proposedValues: { status: "resolved" },
      },
      {
        id: "obs-todo",
        statement: "Order extra sprinkles",
        evidence: "Create a to-do to order extra sprinkles.",
        domain: "todo",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { title: "Order extra sprinkles" },
      },
    ],
    records,
    CANDYLAND_ID,
  );
  const resolved = resolveObservations({
    observations: validated.observations,
    world,
    transcript:
      "Gumdrop Bridge icing is resolved. Create a to-do to order extra sprinkles.",
    captureEntryProjectId: CANDYLAND_ID,
  });

  const writes = resolved.filter((row) => row.decision.kind === "write");
  assert.equal(writes.length, 2);

  for (const row of writes) {
    const decision = planCaptureApply({
      item: row.suggestion!,
      text: row.observation.statement,
      world,
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(decision.kind, "write");
    if (decision.kind === "write") {
      assert.equal(decision.operation.projectId, CANDYLAND_ID);
    }
  }

  check("Toyworld and GamingStudio5000 snapshots unchanged by Candyland plans", () => {
    assert.equal(snapshot(world), before);
  });

  check("cross-project IDs still fail closed", () => {
    const bad = validateObservations(
      [
        {
          id: "x",
          statement: "update console cert",
          evidence: "update console cert",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "risk-console",
        },
      ],
      records,
      CANDYLAND_ID,
    );
    assert.ok(
      bad.issues.some((i) => i.code === "cross_project_id" || i.code === "foreign_id"),
    );
  });

  console.log("verify-phase6-worlds: OK");
}

main();
