/**
 * Slice 2A: Ocean Knowledge Centre UI baseline — focused behaviour checks.
 * Deterministic. No OpenAI. No browser.
 *
 * Run: npm run verify:ocean-knowledge-centre
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  formatDueLabel,
  formatMilestoneLabel,
  formatAwayRange,
} from "../src/lib/knowledge-centre/format-date-label";
import {
  formatRelativeUpdated,
  oceanIntelligenceCounts,
} from "../src/lib/knowledge-centre/ocean-counts";
import {
  OCEAN_PRIMARY_FRAMES,
  OCEAN_SECONDARY_FRAMES,
  OCEAN_SIDEBAR_FORBIDDEN,
  buildCurrentPositionRows,
  buildOpenRiskRows,
  buildPeopleRows,
  buildTodoRows,
} from "../src/lib/knowledge-centre/ocean-frames";
import { confirmResponsibilityOwner } from "../src/lib/people/identity";
import { searchProjectKnowledge } from "../src/lib/tell-me/knowledge-search";
import type { MissionState, Project } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const AVA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RISK_OPEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RISK_DONE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function baseProject(
  partial: Partial<Project> & Pick<Project, "id" | "name" | "code">,
): Project {
  return {
    summary: "",
    status: "healthy",
    currentFocus: "CAB prep",
    stakeholders: [],
    ...partial,
  };
}

function emptyState(): MissionState {
  return {
    projects: [],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [],
    knowledge: [],
    risks: [],
    timeline: [],
    history: [],
  };
}

function testSidebarContract() {
  const sidebar = readSrc("src/components/app-shell/Sidebar.tsx");
  for (const forbidden of OCEAN_SIDEBAR_FORBIDDEN) {
    if (forbidden === "Capture" || forbidden === "Advise" || forbidden === "Knowledge Centre") {
      // Modes must not appear as sidebar destinations
      assert.doesNotMatch(
        sidebar,
        new RegExp(`>${forbidden}<`),
        `sidebar must not nav to ${forbidden}`,
      );
    }
  }
  assert.doesNotMatch(sidebar, /Lume Overview/);
  assert.doesNotMatch(sidebar, /href="\/coaching"/);
  assert.doesNotMatch(sidebar, /href="\/memory"/);
  assert.doesNotMatch(sidebar, /data-project-status/);
  assert.match(sidebar, /Master To Do/);
  assert.match(sidebar, /History/);
  assert.match(sidebar, /Captures/);
  assert.match(sidebar, /New Project/);
  assert.match(sidebar, /ocean-wordmark/);
}

function testModeSelectorContract() {
  const mode = readSrc(
    "src/components/knowledge-centre/ProjectModeSelector.tsx",
  );
  assert.match(mode, /ocean-mode-capture/);
  assert.match(mode, /ocean-mode-knowledge/);
  assert.match(mode, /ocean-mode-catch-me-up/);
  assert.match(mode, /ocean-mode-advise/);
  assert.match(mode, /Coming soon/);
  assert.match(mode, /ocean-ai-glyph/);
  assert.match(mode, /disabled/);
  assert.match(mode, /id: "capture"[\s\S]*ai: true|ai: true[\s\S]*Capture/);
  assert.match(mode, /ocean-ai-glyph/);
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.match(workspace, /ocean-catch-me-up-mode/);
  assert.match(workspace, /CatchMeUpPanel/);
  assert.doesNotMatch(workspace, /CoachDrawer|CoachResultsCard/);
}

function testSearchAskContract() {
  const bar = readSrc(
    "src/components/knowledge-centre/KnowledgeSearchAskBar.tsx",
  );
  assert.match(bar, /data-ai="false"/);
  assert.match(bar, /data-ai="true"/);
  assert.match(bar, /searchAuthoritativeProject/);
  assert.doesNotMatch(bar, /searchProjectKnowledge/);
  assert.match(bar, /ocean-ai-glyph/);
  assert.match(bar, /ocean-suggestion-link/);
  assert.doesNotMatch(bar, /primary-btn/);
}

function testFramesLayoutContract() {
  const frames = readSrc(
    "src/components/knowledge-centre/OceanKnowledgeFrames.tsx",
  );
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.match(workspace, /knowledge/);
  assert.match(workspace, /OceanKnowledgeFrames/);
  assert.match(workspace, /ProjectIntelligenceStrip/);
  assert.doesNotMatch(frames, />More project knowledge</i);
  assert.doesNotMatch(workspace, />More project knowledge</i);
  assert.doesNotMatch(frames, /more-project-knowledge/i);
  assert.match(frames, /kc-bucket-nav/);
  assert.match(frames, /kc-bucket-\$\{id\}/);
  assert.match(frames, /bucketLabel/);
  const buckets = readSrc("src/lib/knowledge-centre/four-bucket.ts");
  for (const title of ["All", "Issues", "People", "To Do", "Knowledge"]) {
    assert.match(buckets, new RegExp(title));
  }
  assert.match(frames, /TimelineFrame/);
  assert.match(frames, /MeetingPrepFrame/);
  assert.match(frames, /ocean-frame-timeline/);
  assert.match(frames, /ocean-frame-meeting-prep/);
  assert.match(frames, /ocean-frame-people/);
  assert.match(frames, /ocean-frame-todo/);
  assert.match(frames, /ocean-frame-risks/);
  assert.match(frames, /ocean-frame-dates/);
  assert.doesNotMatch(frames, /ocean-frames-primary/);
  assert.doesNotMatch(frames, /searchProjectKnowledge/);
  void OCEAN_PRIMARY_FRAMES;
  void OCEAN_SECONDARY_FRAMES;
}

function testNoProgressKpi() {
  const strip = readSrc(
    "src/components/knowledge-centre/ProjectIntelligenceStrip.tsx",
  );
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.doesNotMatch(strip, />Progress</);
  assert.doesNotMatch(workspace, />Progress</);
  assert.doesNotMatch(strip, /progressPercent|projectProgress/);
  assert.match(strip, /actions left/);
  assert.match(strip, /ocean-refresh/);
  assert.match(strip, /I know/);
  assert.match(strip, /I see/);
}

function testResolvedRisksExcluded() {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.risks = ["[Resolved] Old cab risk", "Ghost open string"];
  state.knowledge = [knowledge];
  state.risks = [
    {
      id: RISK_OPEN,
      projectId: PROJECT_A,
      title: "Auth0 delay",
      status: "open",
    },
    {
      id: RISK_DONE,
      projectId: PROJECT_A,
      title: "Old cab risk",
      status: "resolved",
    },
  ];
  const rows = buildOpenRiskRows(state, PROJECT_A);
  assert.ok(rows.some((r) => r.title === "Auth0 delay"));
  assert.ok(!rows.some((r) => /Old cab risk/i.test(r.title)));
  assert.ok(!rows.some((r) => /\[Resolved\]/.test(r.title)));
  assert.ok(!rows.some((r) => /Ghost open string/i.test(r.title)));
}

function testD030LeftoverRiskProseHiddenWhenDomainExists() {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.risks = ["Gumdrop Bridge icing remains open."];
  state.knowledge = [knowledge];
  state.risks = [
    {
      id: RISK_DONE,
      projectId: PROJECT_A,
      title: "Gumdrop Bridge icing",
      status: "resolved",
    },
  ];
  const rows = buildOpenRiskRows(state, PROJECT_A);
  assert.equal(rows.length, 0);
  assert.ok(!rows.some((r) => /remains open/i.test(r.title)));
}

function testKnowledgeOnlyRisksRemainWithoutDomainRows() {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.risks = ["Legacy prose risk only"];
  state.knowledge = [knowledge];
  state.risks = [];
  const rows = buildOpenRiskRows(state, PROJECT_A);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.title, "Legacy prose risk only");
}

function testCurrentPositionExcludesDomainOwnedDates() {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  const knowledge = emptyKnowledge(PROJECT_A);
  const dateId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  knowledge.structured = [
    {
      id: dateId,
      projectId: PROJECT_A,
      section: "now",
      body: "Parade day is 15 October",
      kind: "date",
      epistemic: "confirmed",
      lifecycle: "current",
      supersedesId: null,
      meta: null,
      provenance: null,
    },
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      projectId: PROJECT_A,
      section: "now",
      body: "CAB pack is in review",
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "current",
      supersedesId: null,
      meta: null,
      provenance: null,
    },
  ];
  knowledge.sections.now = [
    "Parade day is 15 October",
    "CAB pack is in review",
  ];
  knowledge.sectionItemIds = { now: [dateId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"] };
  state.knowledge = [knowledge];
  state.timeline = [
    {
      id: dateId,
      projectId: PROJECT_A,
      label: "Parade day",
      startAt: "2026-10-22T00:00:00.000Z",
      type: "milestone",
    },
  ];
  const rows = buildCurrentPositionRows(state, PROJECT_A);
  assert.ok(rows.some((r) => r.title === "CAB pack is in review"));
  assert.ok(!rows.some((r) => /Parade day/i.test(r.title)));
}

function testCurrentPositionFallbackSkipsTimelineLinkedNow() {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  const knowledge = emptyKnowledge(PROJECT_A);
  const dateId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  knowledge.sections.now = ["Parade day is 15 October", "Still true fact"];
  knowledge.sectionItemIds = { now: [dateId, null] };
  state.knowledge = [knowledge];
  state.timeline = [
    {
      id: dateId,
      projectId: PROJECT_A,
      label: "Parade day",
      startAt: "2026-10-22T00:00:00.000Z",
      type: "milestone",
    },
  ];
  const rows = buildCurrentPositionRows(state, PROJECT_A);
  assert.ok(rows.some((r) => r.title === "Still true fact"));
  assert.ok(!rows.some((r) => /Parade day/i.test(r.title)));
}

function testPeopleFromStakeholders() {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX sign-off",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  const rows = buildPeopleRows(state, PROJECT_A);
  assert.ok(rows.some((r) => /@Ava Chen · UX sign-off/.test(r.title)));
}

function testProjectScopedTodosAndSearch() {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "A", code: "A" }),
    baseProject({ id: PROJECT_B, name: "B", code: "B" }),
  ];
  state.todos = [
    {
      id: "t1",
      projectId: PROJECT_A,
      title: "Only A todo",
      done: false,
      createdAt: new Date().toISOString(),
      kind: "ACTION",
    },
    {
      id: "t2",
      projectId: PROJECT_B,
      title: "Only B todo",
      done: false,
      createdAt: new Date().toISOString(),
      kind: "ACTION",
    },
  ];
  const aTodos = buildTodoRows(state, PROJECT_A);
  assert.equal(aTodos.length, 1);
  assert.equal(aTodos[0]!.title, "Only A todo");

  const ka = emptyKnowledge(PROJECT_A);
  ka.sections.now = ["Alpha secret fact"];
  const hits = searchProjectKnowledge(ka, "secret");
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.bullet, "Alpha secret fact");
}

function testDateLabelsAndCounts() {
  assert.equal(formatDueLabel("2026-08-24T12:00:00.000Z"), "Due 24 Aug");
  assert.equal(
    formatMilestoneLabel("CAB", "2026-10-15T12:00:00.000Z"),
    "CAB · 15 Oct",
  );
  assert.equal(
    formatAwayRange("2026-09-01T00:00:00.000Z", "2026-09-12T00:00:00.000Z"),
    "Away 1–12 Sep",
  );

  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.now = ["One", "Two"];
  knowledge.updatedAt = new Date(Date.now() - 12 * 60_000).toISOString();
  state.knowledge = [knowledge];
  state.risks = [
    {
      id: RISK_OPEN,
      projectId: PROJECT_A,
      title: "R1",
      status: "open",
    },
  ];
  const counts = oceanIntelligenceCounts(state, PROJECT_A);
  assert.equal(counts.thingsKnown, 2);
  assert.equal(counts.openRisks, 1);
  assert.equal(counts.dependencies, 0);
  assert.match(formatRelativeUpdated(knowledge.updatedAt), /min ago|just now/);
}

function testDefaultModeKnowledge() {
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.match(workspace, /useState<OceanProjectMode>\("knowledge"\)/);
  assert.match(workspace, /ocean-knowledge-centre/);
}

function testOceanSaveFailureVisible() {
  const shell = readSrc("src/components/AppShell.tsx");
  assert.match(shell, /data-testid="ocean-save-error"/);
  assert.match(shell, /saveStatus === "error"/);
}

function testCoachHiddenFromShell() {
  const shell = readSrc("src/components/AppShell.tsx");
  assert.doesNotMatch(shell, /<CoachDrawer/);
  assert.doesNotMatch(shell, /<CoachResultsCard/);
  assert.doesNotMatch(shell, /coach-open/);
  const sidebar = readSrc("src/components/app-shell/Sidebar.tsx");
  assert.doesNotMatch(sidebar, /href="\/coaching"/);
  const mode = readSrc(
    "src/components/knowledge-centre/ProjectModeSelector.tsx",
  );
  assert.doesNotMatch(mode, /ocean-mode-coach|>Coach</);
}

function testCatchMeUpSeamHasNoAiRoute() {
  const panel = readSrc("src/components/catch-me-up/CatchMeUpPanel.tsx");
  assert.match(panel, /data-testid="catch-me-up-panel"/);
  assert.match(panel, /data-catch-me-up-slot="panel"/);
  assert.doesNotMatch(panel, /\/api\/catch-me-up|\/api\/tell-me|fetch\(/);
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.match(workspace, /mode === "catch-me-up"/);
}

function testInspectorOverlayContract() {
  const drawer = readSrc(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /data-overlay="true"/);
  assert.match(drawer, /ocean-item-detail-close/);
  assert.match(drawer, /ocean-item-detail-backdrop/);
  assert.match(drawer, /Escape/);
  assert.match(drawer, /Right now/);
  assert.match(drawer, /Connected to/);
  const frames = readSrc(
    "src/components/knowledge-centre/OceanKnowledgeFrames.tsx",
  );
  assert.match(frames, /setSelected\(null\)/);
  assert.match(frames, /\[projectId\]/);
  const page = readSrc("src/app/projects/[id]/page.tsx");
  assert.match(page, /key=\{project\.id\}/);
}

function testResponsiveShellCss() {
  const css = readSrc("src/app/globals.css");
  assert.match(css, /ocean-knowledge-frames-primary/);
  assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /min-height: 26rem/);
  assert.match(css, /width: 26rem/);
  assert.match(css, /@media \(max-width: 720px\)/);
}

async function main() {
  testSidebarContract();
  console.log("✓ sidebar omits removed V1 items; keeps Projects/utility");
  testModeSelectorContract();
  console.log("✓ mode selector Capture/KC/Catch Me Up + Advise Coming soon");
  testSearchAskContract();
  console.log("✓ Search non-AI; Ask AI; quiet suggestions");
  testFramesLayoutContract();
  console.log("✓ four-bucket All / Issues / People / To Do / Knowledge");
  testNoProgressKpi();
  console.log("✓ no Progress KPI; Refresh + actions left present");
  testResolvedRisksExcluded();
  console.log("✓ resolved Risks excluded from active rows");
  testD030LeftoverRiskProseHiddenWhenDomainExists();
  console.log("✓ D-030 leftover differently worded risk prose not peer truth");
  testKnowledgeOnlyRisksRemainWithoutDomainRows();
  console.log("✓ knowledge-only risks remain when no domain rows exist");
  testCurrentPositionExcludesDomainOwnedDates();
  console.log("✓ current position excludes kind=date / domain-owned dates");
  testCurrentPositionFallbackSkipsTimelineLinkedNow();
  console.log("✓ current position fallback skips timeline-linked now lines");
  testPeopleFromStakeholders();
  console.log("✓ People rows from stakeholders + responsibilities");
  testProjectScopedTodosAndSearch();
  console.log("✓ project-scoped todos + deterministic search");
  testDateLabelsAndCounts();
  console.log("✓ semantic dates + truthful strip counts");
  testDefaultModeKnowledge();
  console.log("✓ Knowledge Centre default selected mode");
  testOceanSaveFailureVisible();
  console.log("✓ Ocean chrome surfaces persistence failure");
  testCoachHiddenFromShell();
  console.log("✓ Coach drawer/results hidden from product shell");
  testCatchMeUpSeamHasNoAiRoute();
  console.log("✓ Catch Me Up mode seam present without AI route");
  testInspectorOverlayContract();
  console.log("✓ inspector overlay open/close + project isolation");
  testResponsiveShellCss();
  console.log("✓ operational 2-col + 26rem overlay + mobile breakpoints");
  console.log("verify-ocean-knowledge-centre: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
