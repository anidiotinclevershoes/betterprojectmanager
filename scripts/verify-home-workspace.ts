/**
 * Home workspace projection and interaction boundaries.
 * Does not persist. Does not call a model.
 *
 * Run: npx tsx scripts/verify-home-workspace.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  composeHomeProjection,
} from "../src/lib/knowledge-centre/home-projection";
import { composeProjectScan } from "../src/lib/knowledge-centre/project-scan";
import type { MissionState, Project, Recommendation } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const TODO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_TODO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RISK = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DATE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NOW = Date.parse("2026-09-16T12:00:00.000Z");

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok  ${name}`);
}

function project(id: string, name: string): Project {
  return {
    id,
    name,
    code: name.slice(0, 3).toUpperCase(),
    summary: "",
    status: "healthy",
    currentFocus: "",
    stakeholders: [],
  };
}

function suggestion(id: string, projectId: string): Recommendation {
  return {
    id,
    kind: "dependency",
    urgency: "today",
    title: `Suggestion ${id}`,
    action: "Confirm the dependency",
    why: "It blocks the window",
    leadershipImpact: "Keeps the plan honest",
    projectId,
    createdAt: "2026-09-01T09:00:00.000Z",
    status: "active",
  };
}

function fixture(): MissionState {
  const knowledge = emptyKnowledge(PROJECT);
  knowledge.structured = [
    {
      id: DATE,
      projectId: PROJECT,
      body: "UAT window",
      kind: "date",
      epistemic: "confirmed",
      lifecycle: "current",
      meta: { date: { label: "UAT window", dateIso: "2026-09-18T09:00:00.000Z" } },
    },
    {
      id: "conflict-1",
      projectId: PROJECT,
      body: "Two stored launch dates",
      kind: "fact",
      epistemic: "conflicting",
      lifecycle: "current",
    },
  ];
  return {
    projects: [project(PROJECT, "Atlas"), project(OTHER, "Horizon")],
    memories: [],
    recommendations: [
      suggestion("rec-atlas", PROJECT),
      suggestion("rec-horizon", OTHER),
      { ...suggestion("rec-done", PROJECT), status: "done" },
    ],
    meetings: [],
    releases: [],
    todos: [
      {
        id: TODO,
        projectId: PROJECT,
        title: "Confirm the refresh window",
        done: false,
        createdAt: "2026-09-01T09:00:00.000Z",
        dueAt: "2026-09-16T10:30:00.000Z",
      },
      {
        id: "done-todo",
        projectId: PROJECT,
        title: "Already closed",
        done: true,
        createdAt: "2026-09-01T09:00:00.000Z",
      },
      {
        id: OTHER_TODO,
        projectId: OTHER,
        title: "Horizon only",
        done: false,
        createdAt: "2026-09-01T09:00:00.000Z",
      },
    ],
    knowledge: [knowledge, emptyKnowledge(OTHER)],
    risks: [
      {
        id: RISK,
        projectId: PROJECT,
        title: "Capacity risk",
        status: "open",
      },
    ],
    timeline: [
      {
        id: DATE,
        projectId: PROJECT,
        label: "UAT window",
        type: "milestone",
        startAt: "2026-09-18T09:00:00.000Z",
      },
    ],
  };
}

check("home stays inside the open project", () => {
  const state = fixture();
  const home = composeHomeProjection(state, PROJECT, NOW);
  assert.ok(home.queue.some((item) => item.todoId === TODO));
  assert.equal(
    home.queue.some((item) => item.todoId === OTHER_TODO),
    false,
  );
  assert.equal(home.suggestions.length, 1);
  assert.equal(home.suggestions[0]?.id, "rec-atlas");
  const before = JSON.stringify(state.todos);
  composeHomeProjection(state, PROJECT, NOW);
  assert.equal(JSON.stringify(state.todos), before);
});

check("a completed To Do leaves the queue and the record stays", () => {
  const home = composeHomeProjection(fixture(), PROJECT, NOW);
  assert.equal(
    home.queue.some((item) => item.title === "Already closed"),
    false,
  );
  assert.equal(
    fixture().todos.some((todo) => todo.id === "done-todo" && todo.done),
    true,
  );
});

check("suggestions are not canonical To Dos", () => {
  const state = fixture();
  const home = composeHomeProjection(state, PROJECT, NOW);
  assert.equal(
    home.queue.some(
      (item) => item.kind === "suggestion" && item.recommendationId === "rec-atlas",
    ),
    true,
  );
  assert.equal(
    state.todos.some((todo) => todo.title.startsWith("Suggestion")),
    false,
  );
  assert.equal(
    home.queue.find((item) => item.kind === "suggestion")?.todoId,
    undefined,
  );
});

check("an issue linked only by id stays an issue", () => {
  const state = fixture();
  state.timeline.push({
    id: RISK,
    projectId: PROJECT,
    label: "Capacity risk",
    type: "deadline",
    startAt: "2026-09-16T09:00:00.000Z",
  });
  const home = composeHomeProjection(state, PROJECT, NOW);
  const queued = home.queue.find((item) => item.title === "Capacity risk");
  assert.equal(queued?.kind, "issue");
  assert.equal(queued?.staysIssue, true);
  assert.equal(queued?.todoId, undefined);
});

check("scan reads stored findings and writes nothing", () => {
  const state = fixture();
  const snapshot = JSON.stringify(state);
  const scan = composeProjectScan(state, PROJECT, NOW);
  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(scan.groups.risks.length, 1);
  assert.equal(scan.groups.contradictions.length, 1);
  assert.equal(
    composeProjectScan(state, OTHER, NOW).groups.risks.length,
    0,
  );
});

check("home controls use completion and withhold deletion", () => {
  const workspace = readFileSync(
    join(ROOT, "src/components/home/HomeWorkspace.tsx"),
    "utf8",
  );
  const scan = readFileSync(
    join(ROOT, "src/components/home/ProjectScanPanel.tsx"),
    "utf8",
  );
  assert.match(workspace, /onClose=\{toggleTodo\}/);
  assert.match(workspace, /Nothing is created until you save this To Do/);
  assert.match(workspace, /addTodo\(/);
  assert.match(workspace, /dismissSuggestion\(/);
  assert.doesNotMatch(workspace, /removeTodo/);
  assert.doesNotMatch(workspace, /acceptSuggestion/);
  assert.doesNotMatch(scan, /addTodo|toggleTodo|removeTodo|setRiskStatus/);
  const modes = readFileSync(
    join(ROOT, "src/components/knowledge-centre/ProjectModeSelector.tsx"),
    "utf8",
  );
  assert.match(modes, /Home/);
  assert.match(modes, /Capture/);
  assert.match(modes, /Knowledge Centre/);
  assert.match(modes, /Project Scan/);
});

console.log(`home workspace ok (${passed})`);
