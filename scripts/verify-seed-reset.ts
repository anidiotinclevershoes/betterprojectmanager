/**
 * Phase A — Safe demo data reset.
 * Run: npx tsx scripts/verify-seed-reset.ts
 */
import assert from "node:assert/strict";
import { createSeedState } from "../src/lib/seed";
import {
  SEED_MANIFEST,
  buildSeedManifest,
  isSeededRecord,
  seedIdSet,
} from "../src/lib/seed-manifest";
import { resetSeedData } from "../src/lib/seed-reset";
import { projectAttentionCount } from "../src/lib/workspace/attention";
import type { MissionState, Project, TodoItem } from "../src/lib/types";

function cloneState(state: MissionState): MissionState {
  return JSON.parse(JSON.stringify(state)) as MissionState;
}

const seed = createSeedState();
const manifest = buildSeedManifest(seed);
const seedIds = seedIdSet(manifest);

assert.equal(manifest.version, "1");
assert.ok(manifest.projectIds.includes("proj-atlas"));
assert.ok(manifest.projectIds.includes("proj-horizon"));
assert.ok(manifest.projectIds.includes("proj-relops"));
assert.ok(SEED_MANIFEST.projectIds.length === 3);
assert.ok(isSeededRecord({ id: "todo-cab-pack" }, seedIds));
assert.equal(isSeededRecord({ id: "todo-user-abc" }, seedIds), false);
assert.ok(isSeededRecord({ id: "todo-user-abc", isSeeded: true }, seedIds));

// --- Mutate seeded data, add user data ---
const mutated = cloneState(seed);

const cab = mutated.todos.find((t) => t.id === "todo-cab-pack");
assert.ok(cab);
cab.done = true;
cab.title = "Obtain CAB approval (edited)";

mutated.todos = mutated.todos.filter((t) => t.id !== "todo-billing-signoff");
mutated.projects = mutated.projects.map((p) =>
  p.id === "proj-atlas"
    ? { ...p, summary: "Mutated summary", status: "at_risk" as const }
    : p,
);

const userProject: Project = {
  id: "proj-user99",
  name: "User Created Project",
  code: "USER99",
  summary: "Should survive reset",
  status: "healthy",
  currentFocus: "Keep me",
  stakeholders: [],
};

const userTodo: TodoItem = {
  id: "todo-user-keep",
  projectId: "proj-user99",
  title: "User todo",
  done: false,
  createdAt: new Date().toISOString(),
};

const seededExtraTodo: TodoItem = {
  id: "todo-seeded-extra",
  projectId: "proj-atlas",
  title: "Temp seeded test todo",
  done: false,
  createdAt: new Date().toISOString(),
  isSeeded: true,
};

const userTodoOnAtlas: TodoItem = {
  id: "todo-user-on-atlas",
  projectId: "proj-atlas",
  title: "User addition on Atlas",
  done: false,
  createdAt: new Date().toISOString(),
};

mutated.projects.push(userProject);
mutated.todos.push(userTodo, seededExtraTodo, userTodoOnAtlas);
mutated.knowledge.push({
  projectId: "proj-user99",
  updatedAt: new Date().toISOString(),
  sections: {
    now: ["User knowledge"],
    decisions: [],
    risks: [],
    people: [],
    openLoops: [],
  },
});
mutated.history = [
  ...(mutated.history ?? []),
  {
    id: "hist-user-1",
    type: "project_created",
    title: "Project created",
    detail: "User Created Project",
    projectId: "proj-user99",
    createdAt: new Date().toISOString(),
    source: "user",
  },
];

const baselineAttention = projectAttentionCount(seed, "proj-atlas");

const first = resetSeedData(mutated);
assert.equal(first.ok, true, "reset should succeed");
if (!first.ok) throw new Error("unreachable");

const restored = first.state;

// Seeded edits reverted
const cabRestored = restored.todos.find((t) => t.id === "todo-cab-pack");
assert.ok(cabRestored);
assert.equal(cabRestored.done, false, "completed seeded todo restored");
assert.equal(cabRestored.title, "Finalise Release 9 CAB pack artefacts");

const atlas = restored.projects.find((p) => p.id === "proj-atlas");
assert.ok(atlas);
assert.notEqual(atlas.summary, "Mutated summary");
assert.equal(atlas.status, seed.projects.find((p) => p.id === "proj-atlas")!.status);

// Deleted seeded record recreated
assert.ok(
  restored.todos.some((t) => t.id === "todo-billing-signoff"),
  "deleted seeded todo recreated",
);

// Explicitly seeded extra removed
assert.equal(
  restored.todos.some((t) => t.id === "todo-seeded-extra"),
  false,
  "isSeeded test record removed",
);

// Non-seeded survive
assert.ok(restored.projects.some((p) => p.id === "proj-user99"));
assert.ok(restored.todos.some((t) => t.id === "todo-user-keep"));
assert.ok(
  restored.todos.some((t) => t.id === "todo-user-on-atlas"),
  "non-seeded todo on seed project survives",
);
assert.ok(restored.knowledge.some((k) => k.projectId === "proj-user99"));
assert.ok((restored.history ?? []).some((h) => h.id === "hist-user-1"));

// Attention returns to baseline (no proactive extras)
assert.equal(
  projectAttentionCount(restored, "proj-atlas"),
  baselineAttention,
  "attention counts return to baseline",
);

// Repeatable without duplicates
const second = resetSeedData(restored);
assert.equal(second.ok, true);
if (!second.ok) throw new Error("unreachable");
const third = resetSeedData(second.state);
assert.equal(third.ok, true);
if (!third.ok) throw new Error("unreachable");

for (const id of manifest.projectIds) {
  assert.equal(
    third.state.projects.filter((p) => p.id === id).length,
    1,
    `no duplicate project ${id}`,
  );
}
for (const id of manifest.recordIdsByType.todos) {
  assert.equal(
    third.state.todos.filter((t) => t.id === id).length,
    1,
    `no duplicate todo ${id}`,
  );
}
assert.equal(
  third.state.projects.filter((p) => p.id === "proj-user99").length,
  1,
);

// Failed reset does not silently report success
const failed = resetSeedData(mutated, {
  createSeed: () =>
    ({
      projects: [],
      memories: [],
      recommendations: [],
      meetings: [],
      releases: [],
      todos: [],
      knowledge: [],
      timeline: [],
      history: [],
    }) as MissionState,
});
assert.equal(failed.ok, false);
assert.ok(failed.error);

const failedThrow = resetSeedData(mutated, {
  createSeed: () => {
    throw new Error("boom");
  },
});
assert.equal(failedThrow.ok, false);
assert.ok(failedThrow.error);

console.log("verify-seed-reset: all assertions passed");
