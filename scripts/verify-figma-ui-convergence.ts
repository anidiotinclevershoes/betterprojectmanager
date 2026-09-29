/**
 * Figma UI Convergence Part 2 — deterministic behaviour checks.
 * Run: npm run verify:figma-ui-convergence
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  composeHomeProjection,
  homeQueueBand,
  partitionHomeQueue,
} from "../src/lib/knowledge-centre/home-projection";
import { historyEventsForItem } from "../src/lib/knowledge-centre/item-history";
import {
  composeProjectScan,
  formatScanSummary,
} from "../src/lib/knowledge-centre/project-scan";
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

check("shared AI mark is the approved lightbulb, not underlined me", () => {
  const mark = readSrc("src/components/brand/MeMark.tsx");
  const css = readSrc("src/app/globals.css");
  const svg = readSrc("public/brand/lume-ai-lightbulb.svg");
  assert.match(mark, /export type MeMarkSize = "standard" \| "button" \| "micro"/);
  assert.match(mark, /data-testid="lume-me-mark"/);
  assert.match(mark, /data-me-size=\{size\}/);
  assert.match(mark, /aria-hidden/);
  assert.match(mark, /\/brand\/lume-ai-lightbulb\.svg/);
  assert.doesNotMatch(mark, />\s*me\s*</);
  assert.match(css, /\.lume-me-mark\.is-standard/);
  assert.match(css, /\.lume-me-mark\.is-button/);
  assert.match(css, /\.lume-me-mark\.is-micro/);
  assert.doesNotMatch(
    css,
    /\.lume-me-mark\s*\{[^}]*text-decoration:\s*underline/,
  );
  assert.match(svg, /width="18"/);
  assert.match(svg, /height="18"/);
  assert.match(svg, /viewBox="0 0 18 18"/);
  assert.match(svg, /#A996FF/);
});

check("Page 09 domain identity is one semantic map", () => {
  const grammar = readSrc("src/lib/domain/lume-domain.ts");
  const icon = readSrc("src/components/domain/DomainIcon.tsx");
  const css = readSrc("src/components/domain/domain-identity.css");
  const frames = readSrc("src/components/knowledge-centre/OceanKnowledgeFrames.tsx");
  const buckets = readSrc("src/lib/knowledge-centre/four-bucket.ts");
  const home = readSrc("src/components/knowledge-centre/OceanHomeProjection.tsx");
  const review = readSrc("src/components/capture/review/DomainMark.tsx");
  for (const domain of ["issue", "people", "todo", "knowledge"]) {
    assert.match(grammar, new RegExp(`${domain}: "/brand/domain-${domain}.svg"`));
    const svg = readSrc(`public/brand/domain-${domain}.svg`);
    assert.match(svg, /width="15"/);
    assert.match(svg, /height="15"/);
    assert.match(svg, /viewBox="0 0 15 15"/);
  }
  assert.match(grammar, /dates: "knowledge"/);
  assert.doesNotMatch(grammar, /orange|coral|blue|green|purple/);
  assert.match(icon, /data-domain=\{domain\}/);
  assert.doesNotMatch(frames, /KC_BUCKET_ICON|[⚠◎☑☰◆◇]/u);
  assert.doesNotMatch(buckets, /[⚠◎☑☰◆◇]/u);
  assert.match(frames, /DomainIcon/);
  assert.match(home, /data-domain="todo"/);
  assert.match(home, /data-domain="issue"/);
  assert.match(home, /\{home\.issues\.length \?/);
  assert.match(home, /\{home\.knowledge\.length \?/);
  assert.match(css, /rgba\(219, 99, 56, 0\.34\)/);
  assert.match(css, /rgba\(232, 137, 92, 0\.05\)/);
  assert.match(css, /#f08a6a/);
  assert.match(review, /lume-review-domain-mark/);
  assert.doesNotMatch(review, /lume-domain-section/);
});

check("workspace tabs are Home / Capture / KC / Scan", () => {
  const mode = readSrc("src/components/knowledge-centre/ProjectModeSelector.tsx");
  const css = readSrc("src/app/globals.css");
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  const domains = readSrc("src/lib/domain/lume-domain.ts");
  assert.match(mode, /ocean-mode-home/);
  assert.match(mode, /ocean-mode-capture/);
  assert.match(mode, /ocean-mode-knowledge/);
  assert.match(mode, /ocean-mode-scan/);
  assert.doesNotMatch(mode, /ocean-mode-catch-me-up|ocean-mode-advise/);
  assert.match(mode, /aria-label=\{item\.label\}/);
  assert.match(mode, /label: "Home"/);
  assert.match(mode, /label: "Capture"/);
  assert.match(mode, /label: "Knowledge Centre"/);
  assert.match(mode, /narrowLabel: "Knowledge"/);
  assert.match(mode, /label: "Project Scan"/);
  assert.match(mode, /narrowLabel: "Scan"/);
  assert.match(mode, /MeMark size="button"/);
  assert.match(mode, /\/brand\/nav-home\.svg/);
  assert.doesNotMatch(mode, /useRouter|href=|next\/link|next\/navigation/);
  assert.match(workspace, /useState<OceanProjectMode>\("home"\)/);
  assert.doesNotMatch(domains, /nav-home/);
  assert.match(css, /\.ocean-mode-selector[\s\S]*height:\s*54px/);
  assert.match(css, /height:\s*3px/);
  assert.match(css, /flex:\s*42 1 42px/);
  assert.match(css, /flex:\s*92 1 92px/);
  assert.match(css, /flex:\s*136 1 136px/);
  assert.match(css, /flex:\s*120 1 120px/);
  assert.match(css, /flex-wrap:\s*nowrap/);
  const homeIcon = readSrc("public/brand/nav-home.svg");
  assert.match(homeIcon, /width="16"/);
  assert.match(homeIcon, /height="16"/);
  assert.match(homeIcon, /viewBox="0 0 16 16"/);
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
  assert.equal(issue?.occursAt, state.timeline[0]?.startAt);
  const suggestion = home.queue.find((item) => item.kind === "suggestion");
  assert.equal(suggestion?.occursAt, null);
});

check("Home Today/Next uses structured instants only", () => {
  const now = Date.parse("2026-09-16T15:00:00.000Z");
  const later = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const prose = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const state = emptyState();
  state.todos = [
    {
      id: TODO,
      projectId: PROJECT,
      title: "Pack CAB someday",
      done: false,
      createdAt: "2026-09-01T00:00:00.000Z",
      dueAt: "2026-09-16T09:00:00.000Z",
    },
    {
      id: prose,
      projectId: PROJECT,
      title: "Due today in the title only",
      done: false,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
    {
      id: later,
      projectId: PROJECT,
      title: "Later pack",
      done: false,
      createdAt: "2026-09-01T00:00:00.000Z",
      dueAt: "2026-09-20T09:00:00.000Z",
    },
  ];
  state.recommendations = [
    {
      id: REC,
      kind: "risk",
      urgency: "today",
      title: "Chase today",
      action: "Ask for a date",
      why: "CAB",
      leadershipImpact: "",
      projectId: PROJECT,
      createdAt: "2026-09-01T00:00:00.000Z",
      status: "active",
    },
  ];
  const home = composeHomeProjection(state, PROJECT, now);
  const bands = partitionHomeQueue(home.queue, now);
  assert.deepEqual(
    bands.today.map((item) => item.title),
    ["Pack CAB someday"],
  );
  assert.deepEqual(
    bands.next.map((item) => item.title),
    ["Later pack"],
  );
  assert.deepEqual(
    bands.ungrouped.map((item) => item.title),
    ["Due today in the title only", "Chase today"],
  );
  assert.equal(homeQueueBand(undefined, now), "ungrouped");
  assert.equal(homeQueueBand("not-a-date", now), "ungrouped");
  assert.equal(home.queue.find((item) => item.todoId === TODO)?.kind, "todo");
  const projection = readSrc("src/lib/knowledge-centre/home-projection.ts");
  assert.match(projection, /export function composeHomeProjection/);
  assert.doesNotMatch(projection, /composeHomeModel|waitingOn/);
  const bandFn = projection.slice(
    projection.indexOf("export function homeQueueBand"),
    projection.indexOf("export function partitionHomeQueue"),
  );
  assert.doesNotMatch(bandFn, /title|supporting/);
});

check("Home suggestions and collapse stay presentation-only", () => {
  const home = readSrc(
    "src/components/knowledge-centre/OceanHomeProjection.tsx",
  );
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.match(home, /useState\(false\)/);
  assert.match(home, /setShowSuggestions\(\(on\) => !on\)/);
  assert.match(home, /dismissSuggestionDurable/);
  assert.doesNotMatch(home, /dismissSuggestion(?!Durable)/);
  assert.match(home, /onAddSuggestion/);
  assert.match(home, /toggleTodo/);
  assert.doesNotMatch(home, /removeTodo|updateTodoDueDate|Compact|Comfortable/);
  assert.match(home, /composeHomeProjection/);
  assert.match(home, />\s*Discard\s*</);
  assert.match(home, />\s*Add\s*</);
  assert.match(workspace, /onAddTodo=\{\(\) => setAddOpen\(true\)\}/);
  assert.doesNotMatch(home, /Open scan|Open Scan/);
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

check("Page 09 workspace heading is one shared primitive", () => {
  const heading = readSrc(
    "src/components/knowledge-centre/WorkspacePageHeading.tsx",
  );
  const css = readSrc(
    "src/components/knowledge-centre/workspace-page-heading.css",
  );
  const home = readSrc(
    "src/components/knowledge-centre/OceanHomeProjection.tsx",
  );
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  const scan = readSrc("src/components/knowledge-centre/ProjectScanView.tsx");
  const capture = readSrc("src/components/capture/CaptureWorkspace.tsx");
  assert.match(heading, /export function WorkspacePageHeading/);
  assert.match(heading, /title: "Home"/);
  assert.match(heading, /What needs your attention next\./);
  assert.match(heading, /What needs your attention now\./);
  assert.match(heading, /title: "Knowledge Centre"/);
  assert.match(heading, /Search and work with the project information Lume has saved\./);
  assert.match(heading, /Search, ask and work with saved project information\./);
  assert.match(heading, /title: "Project Scan"/);
  assert.match(heading, /Nothing changes until you act\./);
  assert.match(heading, /Things in the project that may need your attention\./);
  assert.doesNotMatch(heading, /fontSize|color:|margin/);
  assert.match(css, /height:\s*58px/);
  assert.match(css, /font-size:\s*15\.5px/);
  assert.match(css, /font-size:\s*24px/);
  assert.match(css, /#f1f4f8/);
  assert.match(css, /#8e98a6/);
  assert.match(home, /WORKSPACE_PAGE_HEADINGS\.home/);
  assert.match(workspace, /WORKSPACE_PAGE_HEADINGS\.knowledge/);
  assert.match(scan, /WORKSPACE_PAGE_HEADINGS\.scan/);
  assert.doesNotMatch(heading, /MeMark/);
  assert.match(scan, /<MeMark size="micro" \/>/);
  assert.doesNotMatch(capture, /WorkspacePageHeading|lume-page-heading/);
  assert.doesNotMatch(capture, /P09\/Common\/PageHeading/);
});

check("Project Scan is a projection and does not import persist writers", () => {
  const scanSrc = readSrc("src/lib/knowledge-centre/project-scan.ts");
  assert.doesNotMatch(scanSrc, /persist|supabase|addTodo|addManualItem/);
  const view = readSrc("src/components/knowledge-centre/ProjectScanView.tsx");
  assert.match(view, /WORKSPACE_PAGE_HEADINGS\.scan/);
  assert.match(view, /<MeMark size="micro" \/>/);
  assert.match(view, /ocean-scan-again/);
  assert.match(view, /setTick\(\(n\) => n \+ 1\)/);
  assert.match(view, /Open ›/);
  assert.match(view, /formatScanSummary/);
  assert.match(
    view,
    /Scan findings do not change project information unless you act\./,
  );
  assert.match(
    view,
    /Suggestions only appear on Home when Suggestions is turned on\./,
  );
  assert.doesNotMatch(
    view,
    /Discard|SuggestionAddModal|dismissSuggestion|onAddSuggestion|recommendationId/,
  );
  const state = emptyState();
  state.risks = [
    { id: ISSUE, projectId: PROJECT, title: "Vendor slip", status: "open" },
  ];
  const scan = composeProjectScan(state, PROJECT);
  assert.equal(scan.groups.risks.length, 1);
  assert.equal(scan.groups.risks[0]?.detail, "Status: open");
  assert.equal(scan.groups.risks[0]?.ref?.kind, "risk");
  assert.equal(scan.groups.contradictions.length, 0);
  assert.equal(
    formatScanSummary(scan.groups),
    "1 finding · 1 risk · 0 dependencies · 0 missing details · 0 contradictions",
  );
  const total =
    scan.groups.risks.length +
    scan.groups.dependencies.length +
    scan.groups.missing.length +
    scan.groups.contradictions.length;
  assert.equal(total, 1);
  assert.equal(
    formatScanSummary({
      risks: [{}],
      dependencies: [{}],
      missing: [{}],
      contradictions: [{}],
    }),
    "4 findings · 1 risk · 1 dependency · 1 missing detail · 1 contradiction",
  );
});

check("Page 09 Knowledge Centre browse keeps Ask and Search distinct", () => {
  const bar = readSrc(
    "src/components/knowledge-centre/KnowledgeSearchAskBar.tsx",
  );
  const frames = readSrc(
    "src/components/knowledge-centre/OceanKnowledgeFrames.tsx",
  );
  assert.match(bar, /searchAuthoritativeProject/);
  assert.match(bar, /data-ai="false"/);
  assert.match(bar, /data-ai="true"/);
  assert.match(bar, /MeMark/);
  assert.match(bar, /Ask a project question/);
  assert.match(bar, /Search Knowledge/);
  assert.match(bar, /Search knowledge/);
  assert.doesNotMatch(bar, /ocean-search-or/);
  assert.match(frames, /DOMAIN/);
  assert.match(frames, /kc-browse-card/);
  assert.match(frames, /kc-layout-grid/);
  assert.match(frames, /kc-layout-list/);
  assert.match(frames, /ocean-add-item/);
  assert.doesNotMatch(frames, /Recently updated|Add tag/);
  assert.match(frames, /\["all", \.\.\.BUCKET_IDS\]/);
  assert.match(frames, /kc-bucket-\$\{id\}/);
  assert.doesNotMatch(frames, /kc-bucket-dates|Dates fifth/);
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
