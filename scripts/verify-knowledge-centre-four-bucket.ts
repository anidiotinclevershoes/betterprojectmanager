/**
 * Knowledge Centre four-bucket presentation/retrieval.
 * Does not persist. Does not invent truth types.
 *
 * Run: npx tsx scripts/verify-knowledge-centre-four-bucket.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  composeKnowledgeCentreItems,
  filterKnowledgeCentreItems,
} from "../src/lib/knowledge-centre/four-bucket";
import { confirmResponsibilityOwner } from "../src/lib/people/identity";
import type { MissionState, Project } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const AVA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RISK = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TODO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const WAIT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DATE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const DEC = "12121212-1212-4121-8121-121212121212";
const FACT = "13131313-1313-4131-8131-131313131313";
const DEP = "14141414-1414-4141-8141-141414141414";
const TAG_UAT = "15151515-1515-4151-8151-151515151515";
const TAG_REL = "16161616-1616-4161-8161-161616161616";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function baseProject(): Project {
  return {
    id: PROJECT,
    name: "Member Claims Upload",
    code: "MCU",
    summary: "",
    status: "healthy",
    currentFocus: "",
    stakeholders: [{ id: AVA, name: "Sarah Murphy", role: "" }],
  };
}

function fixture(): MissionState {
  const knowledge = emptyKnowledge(PROJECT);
  knowledge.sections.decisions = ["UAT scope agreed"];
  knowledge.sectionItemIds = { decisions: [DEC] };
  knowledge.sections.now = ["Initial delivery is web only"];
  knowledge.structured = [
    {
      id: FACT,
      projectId: PROJECT,
      section: "now",
      body: "Initial delivery is web only",
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "current",
    },
    {
      id: DEC,
      projectId: PROJECT,
      section: "decisions",
      body: "UAT scope agreed",
      kind: "decision",
      epistemic: "confirmed",
      lifecycle: "current",
    },
    {
      id: DEP,
      projectId: PROJECT,
      section: "now",
      body: "Needs the vendor file spec",
      kind: "dependency",
      epistemic: "confirmed",
      lifecycle: "current",
    },
    {
      id: DATE,
      projectId: PROJECT,
      section: "now",
      body: "UAT milestone",
      kind: "date",
      epistemic: "unknown",
      lifecycle: "current",
      meta: { date: { label: "UAT milestone" } },
    },
  ];
  return {
    projects: [baseProject()],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [
      {
        id: TODO,
        projectId: PROJECT,
        title: "Confirm UAT test accounts",
        done: false,
        createdAt: new Date().toISOString(),
        kind: "ACTION",
      },
      {
        id: WAIT,
        projectId: PROJECT,
        title: "Chase vendor for sample file",
        done: false,
        createdAt: new Date().toISOString(),
        kind: "CHASE",
        waitingOn: "Vendor",
      },
    ],
    knowledge: [knowledge],
    risks: [
      {
        id: RISK,
        projectId: PROJECT,
        title: "UAT environment capacity risk",
        status: "open",
      },
    ],
    timeline: [],
    projectTags: [
      {
        id: TAG_UAT,
        projectId: PROJECT,
        name: "UAT",
        slug: "uat",
        origin: "predefined",
      },
      {
        id: TAG_REL,
        projectId: PROJECT,
        name: "Release",
        slug: "release",
        origin: "predefined",
      },
    ],
    itemTags: [
      {
        id: "it-1",
        projectId: PROJECT,
        tagId: TAG_UAT,
        targetKind: "risk",
        targetId: RISK,
      },
      {
        id: "it-2",
        projectId: PROJECT,
        tagId: TAG_UAT,
        targetKind: "todo",
        targetId: TODO,
      },
      {
        id: "it-3",
        projectId: PROJECT,
        tagId: TAG_REL,
        targetKind: "risk",
        targetId: RISK,
      },
    ],
  };
}

function withSarah(state: MissionState): MissionState {
  return confirmResponsibilityOwner({
    state,
    projectId: PROJECT,
    scope: "UAT lead",
    personName: "Sarah Murphy",
    personId: AVA,
  }).state;
}

check("All view contains items from multiple buckets", () => {
  const state = withSarah(fixture());
  const items = composeKnowledgeCentreItems(state, PROJECT);
  const buckets = new Set(items.map((i) => i.bucket));
  assert.ok(buckets.has("issues"));
  assert.ok(buckets.has("people"));
  assert.ok(buckets.has("todo"));
  assert.ok(buckets.has("knowledge"));
  const view = filterKnowledgeCentreItems(
    items,
    { query: "", bucket: "all", tagIds: [], knowledgeSubtype: "all" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  assert.ok(view.counts.issues >= 1);
  assert.ok(view.counts.people >= 1);
  assert.ok(view.counts.todo >= 1);
  assert.ok(view.counts.knowledge >= 1);
  assert.equal(view.counts.all, view.globalCount);
});

check("bucket view filters correctly", () => {
  const state = withSarah(fixture());
  const items = composeKnowledgeCentreItems(state, PROJECT);
  const issues = filterKnowledgeCentreItems(
    items,
    { query: "", bucket: "issues", tagIds: [], knowledgeSubtype: "all" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  assert.ok(issues.items.length >= 1);
  assert.ok(issues.items.every((i) => i.bucket === "issues"));
  assert.ok(issues.items.some((i) => /capacity risk/i.test(i.title)));
  assert.ok(!issues.items.some((i) => i.bucket === "todo"));
});

check("search from All returns cross-bucket results", () => {
  const state = withSarah(fixture());
  const items = composeKnowledgeCentreItems(state, PROJECT);
  const view = filterKnowledgeCentreItems(
    items,
    { query: "UAT", bucket: "all", tagIds: [], knowledgeSubtype: "all" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  assert.ok(view.counts.issues >= 1);
  assert.ok(view.counts.people >= 1);
  assert.ok(view.counts.todo >= 1);
  assert.ok(view.counts.knowledge >= 1);
  assert.ok(view.globalCount >= 4);
});

check("narrowing search by bucket works", () => {
  const state = withSarah(fixture());
  const items = composeKnowledgeCentreItems(state, PROJECT);
  const all = filterKnowledgeCentreItems(
    items,
    { query: "UAT", bucket: "all", tagIds: [], knowledgeSubtype: "all" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  const issues = filterKnowledgeCentreItems(
    items,
    { query: "UAT", bucket: "issues", tagIds: [], knowledgeSubtype: "all" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  assert.ok(issues.bucketCount < all.globalCount);
  assert.ok(issues.items.every((i) => i.bucket === "issues"));
  assert.equal(issues.globalCount, all.globalCount);
});

check("tag + All works across buckets", () => {
  const state = withSarah(fixture());
  const items = composeKnowledgeCentreItems(state, PROJECT);
  const view = filterKnowledgeCentreItems(
    items,
    { query: "", bucket: "all", tagIds: [TAG_UAT], knowledgeSubtype: "all" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  const buckets = new Set(view.items.map((i) => i.bucket));
  assert.ok(buckets.has("issues"));
  assert.ok(buckets.has("todo"));
  assert.ok(!view.items.some((i) => i.bucket === "people"));
});

check("tag + specific bucket works", () => {
  const state = withSarah(fixture());
  const items = composeKnowledgeCentreItems(state, PROJECT);
  const view = filterKnowledgeCentreItems(
    items,
    {
      query: "",
      bucket: "issues",
      tagIds: [TAG_REL],
      knowledgeSubtype: "all",
    },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  assert.ok(view.items.every((i) => i.bucket === "issues"));
  assert.ok(view.items.some((i) => /capacity risk/i.test(i.title)));
  const todos = filterKnowledgeCentreItems(
    items,
    {
      query: "",
      bucket: "todo",
      tagIds: [TAG_REL],
      knowledgeSubtype: "all",
    },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  assert.equal(todos.items.length, 0);
});

check("subtype filters do not change truth", () => {
  const state = withSarah(fixture());
  const items = composeKnowledgeCentreItems(state, PROJECT);
  const allK = filterKnowledgeCentreItems(
    items,
    { query: "", bucket: "knowledge", tagIds: [], knowledgeSubtype: "all" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  const dates = filterKnowledgeCentreItems(
    items,
    { query: "", bucket: "knowledge", tagIds: [], knowledgeSubtype: "dates" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  const decisions = filterKnowledgeCentreItems(
    items,
    {
      query: "",
      bucket: "knowledge",
      tagIds: [],
      knowledgeSubtype: "decisions",
    },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  assert.ok(dates.items.every((i) => i.knowledgeSubtype === "dates"));
  assert.ok(decisions.items.every((i) => i.knowledgeSubtype === "decisions"));
  assert.ok(allK.items.length >= dates.items.length + decisions.items.length);
  assert.ok(items.some((i) => i.typeLabel === "Dependency"));
  assert.ok(items.some((i) => i.typeLabel === "Decision"));
  assert.ok(items.some((i) => i.typeLabel === "Risk"));
});

check("empty buckets do not remove real data", () => {
  const state = fixture();
  state.todos = [];
  const items = composeKnowledgeCentreItems(state, PROJECT);
  const view = filterKnowledgeCentreItems(
    items,
    { query: "", bucket: "all", tagIds: [], knowledgeSubtype: "all" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  assert.equal(view.grouped.todo.length, 0);
  assert.ok(view.grouped.issues.length >= 1);
  assert.ok(view.grouped.knowledge.length >= 1);
});

check("search/filtering produces no persistence mutations", () => {
  const state = withSarah(fixture());
  const before = JSON.stringify(state);
  const items = composeKnowledgeCentreItems(state, PROJECT);
  filterKnowledgeCentreItems(
    items,
    { query: "UAT", bucket: "todo", tagIds: [TAG_UAT], knowledgeSubtype: "all" },
    { itemTags: state.itemTags, projectId: PROJECT },
  );
  assert.equal(JSON.stringify(state), before);
});

check("tags remain non-authoritative", () => {
  const state = withSarah(fixture());
  const withTags = composeKnowledgeCentreItems(state, PROJECT);
  const stripped: MissionState = {
    ...state,
    projectTags: [],
    itemTags: [],
  };
  const without = composeKnowledgeCentreItems(stripped, PROJECT);
  const titles = (rows: typeof withTags, bucket: "issues" | "todo" | "knowledge") =>
    rows
      .filter((i) => i.bucket === bucket)
      .map((i) => i.title)
      .sort()
      .join("|");
  assert.equal(titles(withTags, "issues"), titles(without, "issues"));
  assert.equal(titles(withTags, "todo"), titles(without, "todo"));
  assert.equal(titles(withTags, "knowledge"), titles(without, "knowledge"));
});

check("existing Knowledge data remains discoverable after the redesign", () => {
  const state = withSarah(fixture());
  const items = composeKnowledgeCentreItems(state, PROJECT);
  assert.ok(items.some((i) => i.title === "UAT environment capacity risk"));
  assert.ok(items.some((i) => i.title === "Sarah Murphy"));
  assert.ok(items.some((i) => /UAT lead/.test(i.supporting ?? "")));
  assert.ok(items.some((i) => i.title === "Confirm UAT test accounts"));
  assert.ok(items.some((i) => i.title === "Chase vendor for sample file"));
  assert.ok(items.some((i) => i.title === "UAT scope agreed" && i.typeLabel === "Decision"));
  assert.ok(items.some((i) => /UAT milestone/.test(i.title)));
  assert.ok(items.some((i) => i.title === "Initial delivery is web only"));
  assert.ok(items.some((i) => i.typeLabel === "Dependency"));
});

check("people stay one person with many responsibilities", () => {
  let state = withSarah(fixture());
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT,
    scope: "CAB representative",
    personName: "Sarah Murphy",
    personId: AVA,
  }).state;
  const items = composeKnowledgeCentreItems(state, PROJECT).filter(
    (i) => i.bucket === "people" && i.title === "Sarah Murphy",
  );
  assert.equal(items.length, 1);
  assert.match(items[0]!.supporting ?? "", /UAT lead/);
  assert.match(items[0]!.supporting ?? "", /CAB representative/);
});

check("waiting todos remain To Do truth, not a fake Waiting type", () => {
  const state = fixture();
  const waiting = composeKnowledgeCentreItems(state, PROJECT).find(
    (i) => i.title === "Chase vendor for sample file",
  );
  assert.equal(waiting?.bucket, "todo");
  assert.equal(waiting?.typeLabel, "To Do");
  assert.match(waiting?.supporting ?? "", /Waiting on Vendor/);
});

check("UI is four-bucket chrome, not the old taxonomy grid", () => {
  const ui = readFileSync(
    join(ROOT, "src/components/knowledge-centre/OceanKnowledgeFrames.tsx"),
    "utf8",
  );
  assert.match(ui, /kc-bucket-\$\{id\}/);
  assert.match(ui, /searchQuery/);
  assert.match(ui, /Show all \{view\.globalCount\}/);
  assert.doesNotMatch(ui, /No items with this tag/);
  assert.doesNotMatch(ui, /accent-risks|accent-people|accent-todo/);
  assert.doesNotMatch(ui, /searchProjectKnowledge/);
  const bar = readFileSync(
    join(ROOT, "src/components/knowledge-centre/KnowledgeSearchAskBar.tsx"),
    "utf8",
  );
  assert.match(bar, /searchAuthoritativeProject/);
  assert.match(bar, /onSearchChange/);
  assert.doesNotMatch(bar, /searchProjectKnowledge/);
  const workspace = readFileSync(
    join(ROOT, "src/components/knowledge-centre/OceanProjectWorkspace.tsx"),
    "utf8",
  );
  assert.match(workspace, /ProjectIntelligenceStrip/);
  assert.match(workspace, /CatchMeUpPanel/);
});

console.log(`\n${passed} Knowledge Centre four-bucket checks passed.`);
