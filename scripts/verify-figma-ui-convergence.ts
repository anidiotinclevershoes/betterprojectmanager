/**
 * Figma UI Convergence Part 2 — deterministic behaviour checks.
 * Run: npm run verify:figma-ui-convergence
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import { composeHomeProjection } from "../src/lib/knowledge-centre/home-projection";
import { historyEventsForItem } from "../src/lib/knowledge-centre/item-history";
import { composeProjectScan } from "../src/lib/knowledge-centre/project-scan";
import {
  planItemTagSave,
  shouldDeleteCreatedTag,
} from "../src/lib/tags/save";
import type { MissionState, Project } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const ISSUE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TODO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function baseProject(): Project {
  return {
    id: PROJECT,
    name: "Atlas",
    code: "ATL",
    summary: "CAB",
    status: "healthy",
    currentFocus: "CAB prep",
    stakeholders: [{ id: "p1", name: "Ava Chen", role: "UX" }],
  };
}

function emptyState(): MissionState {
  return {
    projects: [baseProject()],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [],
    knowledge: [emptyKnowledge(PROJECT)],
    risks: [],
    timeline: [],
    history: [
      {
        id: "h1",
        type: "task_added",
        title: "You added a To Do",
        detail: "Pack CAB",
        projectId: PROJECT,
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ],
  };
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

check("workspace tabs are Home / Capture / KC / Scan", () => {
  const mode = readSrc("src/components/knowledge-centre/ProjectModeSelector.tsx");
  assert.match(mode, /ocean-mode-home/);
  assert.match(mode, /ocean-mode-capture/);
  assert.match(mode, /ocean-mode-knowledge/);
  assert.match(mode, /ocean-mode-scan/);
  assert.doesNotMatch(mode, /ocean-mode-catch-me-up|ocean-mode-advise/);
});

check("sidebar has no PROJECTS heading", () => {
  const sidebar = readSrc("src/components/app-shell/Sidebar.tsx");
  assert.doesNotMatch(sidebar, />PROJECTS</);
  assert.match(sidebar, /New [Pp]roject/);
});

check("Home queue keeps a date-linked Issue as an Issue", () => {
  const state = emptyState();
  state.risks = [
    { id: ISSUE, projectId: PROJECT, title: "Vendor slip", status: "open" },
  ];
  state.todos = [
    {
      id: TODO,
      projectId: PROJECT,
      title: "Pack CAB",
      done: false,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  ];
  state.timeline = [
    {
      id: ISSUE,
      projectId: PROJECT,
      type: "milestone",
      label: "Vendor date",
      startAt: new Date().toISOString(),
    },
  ];
  state.recommendations = [
    {
      id: REC,
      kind: "risk",
      urgency: "today",
      title: "Chase vendor",
      action: "Ask for a date",
      why: "CAB",
      leadershipImpact: "",
      projectId: PROJECT,
      createdAt: "2026-09-01T00:00:00.000Z",
      status: "active",
    },
  ];
  const home = composeHomeProjection(state, PROJECT);
  const issue = home.queue.find((item) => item.kind === "issue");
  assert.ok(issue);
  assert.equal(issue?.staysIssue, true);
  assert.equal(issue?.title, "Vendor slip");
  assert.ok(home.queue.some((item) => item.kind === "todo"));
  assert.ok(home.queue.some((item) => item.kind === "suggestion"));
});

check("item History does not title-match existing events", () => {
  const state = emptyState();
  const read = historyEventsForItem(state, PROJECT, {
    kind: "todo",
    todoId: TODO,
  });
  assert.equal(read.events.length, 0);
  assert.equal(read.attributable, false);
  assert.equal(read.limitation, "D-004");
  assert.match(read.notice, /D-004/);
});

check("tag Save reuses equivalent slug and never deletes unproven leftovers", () => {
  const planned = planItemTagSave({
    projectId: PROJECT,
    names: ["Governance", "governance", "  New Tag  "],
    projectTags: [
      {
        id: "tag-1",
        projectId: PROJECT,
        name: "Governance",
        slug: "governance",
        origin: "custom",
      },
    ],
    newTagId: () => "tag-new",
  });
  assert.equal(planned[0]?.kind, "reuse");
  assert.equal(planned[1]?.kind, "create");
  assert.equal(shouldDeleteCreatedTag({
    createdThisSave: true,
    unusedProven: true,
    proveFailed: false,
  }), true);
  assert.equal(shouldDeleteCreatedTag({
    createdThisSave: true,
    unusedProven: false,
    proveFailed: true,
  }), false);
  assert.equal(shouldDeleteCreatedTag({
    createdThisSave: false,
    unusedProven: true,
    proveFailed: false,
  }), false);
});

check("Project Scan is a projection and does not import persist writers", () => {
  const scanSrc = readSrc("src/lib/knowledge-centre/project-scan.ts");
  assert.doesNotMatch(scanSrc, /persist|supabase|addTodo|addManualItem/);
  const view = readSrc("src/components/knowledge-centre/ProjectScanView.tsx");
  assert.match(view, /analysis only/);
  assert.match(view, /ocean-scan-again/);
  const state = emptyState();
  state.risks = [
    { id: ISSUE, projectId: PROJECT, title: "Vendor slip", status: "open" },
  ];
  const scan = composeProjectScan(state, PROJECT);
  assert.equal(scan.groups.risks.length, 1);
  assert.equal(scan.groups.contradictions.length, 0);
});

check("KC keeps full-set render and adds grid/list + Open Details", () => {
  const frames = readSrc(
    "src/components/knowledge-centre/OceanKnowledgeFrames.tsx",
  );
  assert.match(frames, /items\.map/);
  assert.doesNotMatch(frames, /IntersectionObserver|loadMore|pager/);
  assert.match(frames, /kc-layout-toggle/);
  assert.match(frames, /Open Details/);
});

check("mounted chrome avoids user-facing project truth", () => {
  const shell = readSrc("src/components/AppShell.tsx");
  const header = readSrc(
    "src/components/knowledge-centre/ProjectWorkspaceHeader.tsx",
  );
  assert.doesNotMatch(shell, /project truth/);
  assert.doesNotMatch(header, /project truth/);
});

console.log("verify-figma-ui-convergence: all checks passed");
