/**
 * Search / Knowledge truth convergence — Search consumes KC frame builders.
 * Deterministic. No OpenAI. No network. No embeddings.
 *
 * Run: npm run verify:search-authority
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  buildDateRows,
  buildOpenRiskRows,
  buildPeopleRows,
  buildTodoRows,
} from "../src/lib/knowledge-centre/ocean-frames";
import { searchAuthoritativeProject } from "../src/lib/knowledge-centre/search-authority";
import { confirmResponsibilityOwner } from "../src/lib/people/identity";
import { searchProjectKnowledge } from "../src/lib/tell-me/knowledge-search";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import type { MissionState, Project } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const AVA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BRICK = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RISK_OPEN_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RISK_DONE_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RISK_OPEN_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const DATE_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const DATE_B = "99999999-9999-4999-8999-999999999999";
const FACT_A = "12121212-1212-4121-8121-121212121212";
const SUPERSEDED = "34343434-3434-4343-8343-343434343434";

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

function fact(
  partial: Pick<CanonicalTruthItem, "id" | "projectId" | "body" | "kind"> &
    Partial<CanonicalTruthItem>,
): CanonicalTruthItem {
  return {
    section: "now",
    epistemic: "confirmed",
    lifecycle: "current",
    supersedesId: null,
    meta: null,
    provenance: null,
    ...partial,
  };
}

function fixtureState(): MissionState {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "Candyland",
      code: "CANDY",
      stakeholders: [{ id: AVA, name: "Pippa Gumdrop", role: "UAT lead" }],
    }),
    baseProject({
      id: PROJECT_B,
      name: "Toyworld",
      code: "TOY",
      stakeholders: [{ id: BRICK, name: "Brick Oakley", role: "Sponsor" }],
    }),
  ];

  const ka = emptyKnowledge(PROJECT_A);
  ka.sections.now = ["The parade route is locked"];
  ka.sections.risks = ["Gumdrop Bridge icing remains open."];
  ka.sections.decisions = ["Sprinkle budget is approved"];
  ka.structured = [
    fact({
      id: FACT_A,
      projectId: PROJECT_A,
      body: "Float design freeze is this Friday",
      kind: "fact",
      section: "now",
    }),
    fact({
      id: SUPERSEDED,
      projectId: PROJECT_A,
      body: "Old float colours are still current",
      kind: "fact",
      lifecycle: "superseded",
    }),
  ];

  const kb = emptyKnowledge(PROJECT_B);
  kb.sections.now = ["Toyworld secret waypoint"];
  kb.sections.risks = ["Packaging leftover prose that should not leak"];

  state.knowledge = [ka, kb];
  state.todos = [
    {
      id: "todo-a-open",
      projectId: PROJECT_A,
      title: "Order extra sprinkles for the float",
      done: false,
      createdAt: new Date().toISOString(),
      kind: "ACTION",
    },
    {
      id: "todo-a-done",
      projectId: PROJECT_A,
      title: "Archive the jelly ledger",
      done: true,
      createdAt: new Date().toISOString(),
      kind: "ACTION",
    },
    {
      id: "todo-b-open",
      projectId: PROJECT_B,
      title: "Print the track map",
      done: false,
      createdAt: new Date().toISOString(),
      kind: "ACTION",
    },
  ];
  state.risks = [
    {
      id: RISK_OPEN_A,
      projectId: PROJECT_A,
      title: "Gumdrop Bridge icing",
      status: "open",
    },
    {
      id: RISK_DONE_A,
      projectId: PROJECT_A,
      title: "Stale frosting inventory",
      status: "resolved",
    },
    {
      id: RISK_OPEN_B,
      projectId: PROJECT_B,
      title: "Packaging delay",
      status: "open",
    },
  ];
  state.timeline = [
    {
      id: DATE_A,
      projectId: PROJECT_A,
      label: "Parade day",
      startAt: "2026-10-22T00:00:00.000Z",
      type: "milestone",
    },
    {
      id: DATE_B,
      projectId: PROJECT_B,
      label: "Button inventory audit",
      startAt: "2026-11-01T00:00:00.000Z",
      type: "milestone",
    },
  ];

  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UAT sign-off",
    personName: "Pippa Gumdrop",
    personId: AVA,
  }).state;

  return state;
}

function hitsFor(state: MissionState, projectId: string, query: string) {
  return searchAuthoritativeProject(state, projectId, query);
}

function testNoAiNoIndexInSearchModule() {
  const src = readSrc("src/lib/knowledge-centre/search-authority.ts");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /fetch\(|\/api\/|embedd|vector|openai/i);
  assert.match(src, /buildTodoRows/);
  assert.match(src, /buildOpenRiskRows/);
  assert.match(src, /buildPeopleRows/);
  assert.match(src, /buildDateRows/);
  assert.match(src, /buildCurrentPositionRows/);
  assert.match(src, /matchRangesFor/);
}

function testAskBarWiresAuthoritativeSearch() {
  const bar = readSrc(
    "src/components/knowledge-centre/KnowledgeSearchAskBar.tsx",
  );
  assert.match(bar, /searchAuthoritativeProject/);
  assert.doesNotMatch(bar, /searchProjectKnowledge/);
  assert.match(bar, /data-ai="false"/);
  assert.match(bar, /hits\.slice\(0, 12\)/);
}

function testTodoVisibleInKcIsSearchable() {
  const state = fixtureState();
  const kc = buildTodoRows(state, PROJECT_A);
  assert.ok(kc.some((r) => /sprinkles/i.test(r.title)));
  const hits = hitsFor(state, PROJECT_A, "sprinkles");
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.sectionLabel, "To Do");
  assert.match(hits[0]!.bullet, /sprinkles/i);
}

function testOpenRiskVisibleInKcIsSearchable() {
  const state = fixtureState();
  const kc = buildOpenRiskRows(state, PROJECT_A);
  assert.ok(kc.some((r) => r.title === "Gumdrop Bridge icing"));
  const hits = hitsFor(state, PROJECT_A, "Gumdrop Bridge icing");
  assert.ok(hits.some((h) => h.sectionLabel === "Risks & blockers"));
  assert.ok(
    hits.some(
      (h) =>
        h.sectionLabel === "Risks & blockers" &&
        h.bullet === "Gumdrop Bridge icing",
    ),
  );
}

function testDateVisibleInKcIsSearchable() {
  const state = fixtureState();
  const kc = buildDateRows(state, PROJECT_A);
  assert.ok(kc.some((r) => /Parade day/.test(r.title)));
  const hits = hitsFor(state, PROJECT_A, "Parade day");
  assert.ok(hits.some((h) => h.sectionLabel === "Important dates"));
}

function testPersonVisibleInKcIsSearchable() {
  const state = fixtureState();
  const kc = buildPeopleRows(state, PROJECT_A);
  assert.ok(kc.some((r) => /Pippa Gumdrop/.test(r.title)));
  const hits = hitsFor(state, PROJECT_A, "Pippa Gumdrop");
  assert.ok(hits.some((h) => h.sectionLabel === "People & context"));
}

function testKnowledgeFactStillSearchable() {
  const state = fixtureState();
  const hits = hitsFor(state, PROJECT_A, "Float design freeze");
  assert.ok(
    hits.some(
      (h) =>
        h.sectionLabel === "Current position" &&
        /Float design freeze/.test(h.bullet),
    ),
  );
  const decisionHits = hitsFor(state, PROJECT_A, "Sprinkle budget");
  assert.ok(
    decisionHits.some(
      (h) =>
        h.sectionLabel === "Decisions" && /Sprinkle budget/.test(h.bullet),
    ),
  );
}

function testProjectIsolation() {
  const state = fixtureState();
  const a = hitsFor(state, PROJECT_A, "track map");
  assert.equal(a.length, 0);
  const b = hitsFor(state, PROJECT_B, "track map");
  assert.equal(b.length, 1);
  assert.equal(b[0]!.sectionLabel, "To Do");

  const aPackaging = hitsFor(state, PROJECT_A, "Packaging delay");
  assert.equal(aPackaging.length, 0);
  const bPackaging = hitsFor(state, PROJECT_B, "Packaging delay");
  assert.ok(bPackaging.some((h) => h.sectionLabel === "Risks & blockers"));

  const aBrick = hitsFor(state, PROJECT_A, "Brick Oakley");
  assert.equal(aBrick.length, 0);
  const bBrick = hitsFor(state, PROJECT_B, "Brick Oakley");
  assert.ok(bBrick.some((h) => h.sectionLabel === "People & context"));

  const aWaypoint = hitsFor(state, PROJECT_A, "secret waypoint");
  assert.equal(aWaypoint.length, 0);
  const bWaypoint = hitsFor(state, PROJECT_B, "secret waypoint");
  assert.ok(bWaypoint.some((h) => h.sectionLabel === "Current position"));

  const aAudit = hitsFor(state, PROJECT_A, "Button inventory");
  assert.equal(aAudit.length, 0);
  const bAudit = hitsFor(state, PROJECT_B, "Button inventory");
  assert.ok(bAudit.some((h) => h.sectionLabel === "Important dates"));
}

function testD030LeftoverRiskProseNotSearchable() {
  const state = fixtureState();
  const kc = buildOpenRiskRows(state, PROJECT_A);
  assert.ok(!kc.some((r) => /remains open/i.test(r.title)));
  const hits = hitsFor(state, PROJECT_A, "remains open");
  assert.equal(hits.length, 0);
}

function testDoneTodoAndClosedRiskNotSearchable() {
  const state = fixtureState();
  assert.equal(hitsFor(state, PROJECT_A, "jelly ledger").length, 0);
  assert.equal(hitsFor(state, PROJECT_A, "Stale frosting").length, 0);
}

function testSupersededFactNotSearchable() {
  const state = fixtureState();
  const hits = hitsFor(state, PROJECT_A, "Old float colours");
  assert.equal(hits.length, 0);
}

function testKnowledgeOnlyRisksRemainSearchableWithoutDomain() {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.risks = ["Legacy prose risk only"];
  state.knowledge = [knowledge];
  state.risks = [];
  const hits = hitsFor(state, PROJECT_A, "Legacy prose");
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.sectionLabel, "Risks & blockers");
}

function testSectionLabelMatchIncludesRows() {
  const state = fixtureState();
  const hits = hitsFor(state, PROJECT_A, "Important dates");
  assert.ok(hits.some((h) => h.sectionLabel === "Important dates"));
  assert.ok(hits.every((h) => h.sectionLabel === "Important dates"));
}

function testLegacySectionSearchStillWorks() {
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.now = ["CAB pack due Friday"];
  const hits = searchProjectKnowledge(knowledge, "CAB");
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.bullet, "CAB pack due Friday");
}

function testEmptyQueryReturnsNothing() {
  const state = fixtureState();
  assert.equal(hitsFor(state, PROJECT_A, "   ").length, 0);
}

async function main() {
  testNoAiNoIndexInSearchModule();
  console.log("✓ Search module reuses KC builders; no fetch/embeddings/API");
  testAskBarWiresAuthoritativeSearch();
  console.log("✓ Ocean Search bar calls searchAuthoritativeProject");
  testTodoVisibleInKcIsSearchable();
  console.log("✓ Todo visible in KC is searchable");
  testOpenRiskVisibleInKcIsSearchable();
  console.log("✓ Open risk visible in KC is searchable");
  testDateVisibleInKcIsSearchable();
  console.log("✓ Date/milestone visible in KC is searchable");
  testPersonVisibleInKcIsSearchable();
  console.log("✓ Stakeholder/person visible in KC is searchable");
  testKnowledgeFactStillSearchable();
  console.log("✓ Existing knowledge fact still searchable");
  testProjectIsolation();
  console.log("✓ Project A search never exposes Project B truth");
  testD030LeftoverRiskProseNotSearchable();
  console.log("✓ D-030 leftover risk prose is not a Search hit");
  testDoneTodoAndClosedRiskNotSearchable();
  console.log("✓ Done todo and resolved risk are not searchable");
  testSupersededFactNotSearchable();
  console.log("✓ Superseded structured fact is not searchable");
  testKnowledgeOnlyRisksRemainSearchableWithoutDomain();
  console.log("✓ Knowledge-only risks remain searchable without domain rows");
  testSectionLabelMatchIncludesRows();
  console.log("✓ Section-label match still includes those rows");
  testLegacySectionSearchStillWorks();
  console.log("✓ searchProjectKnowledge still works for section-only callers");
  testEmptyQueryReturnsNothing();
  console.log("✓ empty query returns no hits");
  console.log("verify-search-authority: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
