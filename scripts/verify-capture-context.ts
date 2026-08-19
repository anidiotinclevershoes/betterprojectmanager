/**
 * Phase 1 — Capture context assembly verification.
 * Run: npx tsx scripts/verify-capture-context.ts
 */
import assert from "node:assert/strict";
import {
  buildCaptureContext,
  DEFAULT_CAPTURE_CONTEXT_LIMITS,
  serializeCaptureContextForPrompt,
} from "../src/lib/capture/context";
import { createSeedState } from "../src/lib/seed";
import type { MissionState, TodoItem } from "../src/lib/types";

function cloneState(state: MissionState): MissionState {
  return JSON.parse(JSON.stringify(state)) as MissionState;
}

const seed = createSeedState();
const atlasId = seed.projects.find((p) => p.code === "ATLAS")?.id ?? "proj-atlas";

// --- only selected project's records ---
{
  const ctx = buildCaptureContext({
    projectId: atlasId,
    captureText: "CAB approval and Elena payments risk",
    state: seed,
  });
  assert.equal(ctx.project?.id, atlasId);
  assert.ok(ctx.diagnostics.projectScoped);
  for (const todo of ctx.todos) {
    const source = seed.todos.find((t) => t.id === todo.id);
    assert.ok(source, `todo ${todo.id} must exist`);
    assert.equal(source!.projectId, atlasId);
  }
  for (const meeting of ctx.meetings) {
    const source = seed.meetings.find((m) => m.id === meeting.id);
    assert.ok(source);
    assert.equal(source!.projectId, atlasId);
  }
  for (const milestone of ctx.milestones) {
    const source = seed.timeline.find((t) => t.id === milestone.id);
    assert.ok(source);
    assert.equal(source!.projectId, atlasId);
  }
}

// --- context limits respected ---
{
  const limits = {
    ...DEFAULT_CAPTURE_CONTEXT_LIMITS,
    openTodos: 2,
    meetings: 1,
    stakeholders: 2,
    knowledgeItems: 3,
    historyEvents: 1,
  };
  const ctx = buildCaptureContext({
    projectId: atlasId,
    captureText: "release",
    state: seed,
    limits,
  });
  assert.ok(ctx.todos.length <= limits.openTodos);
  assert.ok(ctx.meetings.length <= limits.meetings);
  assert.ok(ctx.stakeholders.length <= limits.stakeholders);
  assert.ok(ctx.knowledge.length <= limits.knowledgeItems);
  assert.ok(ctx.history.length <= limits.historyEvents);
}

// --- dismissed recommendations excluded from nudge/risk active set ---
{
  const withDismissed = cloneState(seed);
  withDismissed.recommendations = withDismissed.recommendations.map((r) =>
    r.projectId === atlasId ? { ...r, status: "dismissed" as const } : r,
  );
  const ctx = buildCaptureContext({
    projectId: atlasId,
    captureText: "follow up stakeholder",
    state: withDismissed,
  });
  assert.ok(
    ctx.nudges.every((nudge) => !nudge.id.startsWith("rec-")),
    "dismissed recommendation nudges must not appear",
  );
}

// --- sensitive / implementation fields not included ---
{
  const ctx = buildCaptureContext({
    projectId: atlasId,
    captureText: "project overview",
    state: seed,
  });
  const serialized = serializeCaptureContextForPrompt(ctx);
  assert.equal(serialized.includes("isTemplate"), false);
  assert.equal(serialized.includes("clonedFromId"), false);
  assert.equal(serialized.includes("OPENAI"), false);
  assert.equal(serialized.includes("diagnostics"), false);
  assert.ok(ctx.project);
  assert.equal("isTemplate" in (ctx.project as object), false);
}

// --- empty / unknown project ---
{
  const empty = buildCaptureContext({
    projectId: "does-not-exist",
    captureText: "hello",
    state: seed,
  });
  assert.equal(empty.project, null);
  assert.equal(empty.todos.length, 0);
  assert.equal(empty.diagnostics.recordCount, 0);
}

// --- no project selected ---
{
  const none = buildCaptureContext({
    projectId: null,
    captureText: "generic note about timesheets",
    state: seed,
  });
  assert.equal(none.project, null);
  assert.equal(none.diagnostics.projectScoped, false);
  assert.equal(none.todos.length, 0);
  assert.equal(none.meetings.length, 0);
}

// --- does not mutate source records ---
{
  const before = cloneState(seed);
  const todoSnapshot = JSON.stringify(seed.todos);
  const projectSnapshot = JSON.stringify(seed.projects);
  buildCaptureContext({
    projectId: atlasId,
    captureText: "mutate check CAB Elena",
    state: seed,
  });
  assert.equal(JSON.stringify(seed.todos), todoSnapshot);
  assert.equal(JSON.stringify(seed.projects), projectSnapshot);
  assert.deepEqual(seed.todos.length, before.todos.length);
}

// --- completed todos capped separately from open ---
{
  const withDone: MissionState = cloneState(seed);
  const extra: TodoItem = {
    id: "todo-phase1-done",
    projectId: atlasId,
    title: "Finished CAB pack",
    done: true,
    createdAt: new Date().toISOString(),
  };
  withDone.todos = [extra, ...(withDone.todos ?? [])];
  const ctx = buildCaptureContext({
    projectId: atlasId,
    captureText: "CAB pack finished",
    state: withDone,
    limits: { recentCompletedTodos: 5, openTodos: 5 },
  });
  assert.ok(ctx.completedTodos.some((t) => t.id === "todo-phase1-done"));
  assert.ok(ctx.completedTodos.every((t) => t.status === "done"));
  assert.ok(ctx.todos.every((t) => t.status === "open"));
}

console.log("verify-capture-context: all checks passed");
console.log(`  atlas project: ${atlasId}`);
console.log(
  `  sample records: ${
    buildCaptureContext({
      projectId: atlasId,
      captureText: "CAB Elena release",
      state: seed,
    }).diagnostics.recordCount
  }`,
);
