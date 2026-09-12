/**
 * Family E — existing-row Apply updates are idempotent by identity.
 *
 * Receipts protect create/mint operations (new row identity). Replaying an
 * update of an existing canonical row must not mint a duplicate. It does not
 * require a receipt merely because creates have one.
 *
 * Run: npx tsx scripts/verify-update-idempotency.ts
 */
import assert from "node:assert/strict";
import { applyCaptureOperationInMemory } from "../src/lib/capture/apply/memory-execute";
import type { MissionState } from "../src/lib/types";

const PROJECT = "proj-riverside";
const RISK = "risk-dda";
const TODO = "todo-ffe";
const MS = "ms-pc";

function seed(): MissionState {
  return {
    projects: [
      {
        id: PROJECT,
        name: "Riverside",
        code: "RCH",
        summary: "",
        kind: "delivery",
        currentFocus: "",
        stakeholders: [],
      },
    ],
    risks: [
      {
        id: RISK,
        projectId: PROJECT,
        title: "Outstanding DDA access ramp detail",
        status: "open",
        source: "import",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    todos: [
      {
        id: TODO,
        projectId: PROJECT,
        title: "Book FF&E sample review",
        done: false,
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    timeline: [
      {
        id: MS,
        projectId: PROJECT,
        label: "Practical completion",
        type: "milestone",
        startAt: "2026-12-12",
      },
    ],
    knowledge: [],
    history: [],
    recommendations: [],
    memories: [],
    meetings: [],
  } as unknown as MissionState;
}

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

check("replaying risk resolve does not mint a second risk", () => {
  const op = {
    type: "update_risk_status" as const,
    projectId: PROJECT,
    riskId: RISK,
    status: "resolved" as const,
  };
  const once = applyCaptureOperationInMemory(seed(), op);
  const twice = applyCaptureOperationInMemory(once, op);
  assert.equal((twice.risks ?? []).length, 1);
  assert.equal(twice.risks?.[0]?.id, RISK);
  assert.equal(twice.risks?.[0]?.status, "resolved");
});

check("replaying todo complete does not mint a second todo", () => {
  const op = {
    type: "complete_todo" as const,
    projectId: PROJECT,
    todoId: TODO,
  };
  const once = applyCaptureOperationInMemory(seed(), op);
  const twice = applyCaptureOperationInMemory(once, op);
  assert.equal(twice.todos.length, 1);
  assert.equal(twice.todos[0]?.id, TODO);
  assert.equal(twice.todos[0]?.done, true);
});

check("replaying milestone date update keeps the stable id", () => {
  const op = {
    type: "update_milestone" as const,
    projectId: PROJECT,
    milestoneId: MS,
    startAt: "2026-12-18",
    label: "Practical completion",
  };
  const once = applyCaptureOperationInMemory(seed(), op);
  const twice = applyCaptureOperationInMemory(once, op);
  assert.equal(twice.timeline.length, 1);
  assert.equal(twice.timeline[0]?.id, MS);
  assert.equal(twice.timeline[0]?.startAt, "2026-12-18");
});

console.log(`\n${passed} checks passed`);
