/**
 * Slice 2C: Knowledge item detail & evidence — focused behaviour checks.
 * Deterministic. No OpenAI. No browser.
 *
 * Run: npm run verify:ocean-item-detail
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  buildCorrectedSectionBullets,
  formatProvenanceLine,
  formatProvenanceLines,
  knowledgeDetailEquals,
  personIdFromPeopleCardId,
  refForPerson,
  refForRisk,
  refForSectionLine,
  refForStructuredItem,
  refForTodo,
  refForUnconfirmedOwner,
  resolveKnowledgeItemDetail,
} from "../src/lib/knowledge-centre/knowledge-item-detail";
import type { MissionState, Project } from "../src/lib/types";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const ITEM_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ITEM_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ITEM_PREV = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RISK_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TODO_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PERSON_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const PERSON_B = "99999999-9999-4999-8999-999999999999";
const RESP_A = "12121212-1212-4121-8121-121212121212";
const RESP_B = "34343434-3434-4343-8343-343434343434";
const RESP_HIST = "56565656-5656-4565-8565-565656565656";
const UNCONF = "78787878-7878-4787-8787-787878787878";

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

function structured(
  partial: Partial<CanonicalTruthItem> &
    Pick<CanonicalTruthItem, "id" | "projectId" | "body" | "kind">,
): CanonicalTruthItem {
  return {
    epistemic: "confirmed",
    lifecycle: "current",
    ...partial,
  };
}

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("verify-ocean-item-detail\n");

check("1. Selecting a Knowledge item resolves the correct detail body", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "Alpha", code: "A" }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.sections.now = ["Launch window is 25 Aug"];
  k.sectionItemIds = { now: [ITEM_A] };
  k.structured = [
    structured({
      id: ITEM_A,
      projectId: PROJECT_A,
      section: "now",
      body: "Launch window is 25 Aug",
      kind: "fact",
      provenance: [{ type: "capture", at: "2026-08-18T10:00:00.000Z", note: "standup" }],
    }),
  ];
  state.knowledge = [k];

  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForStructuredItem(ITEM_A),
  );
  assert.ok(detail);
  assert.equal(detail!.body, "Launch window is 25 Aug");
  assert.equal(detail!.ref.kind, "structured");
});

check("2. Stable ID — not array position — controls identity after reorder", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "Alpha", code: "A" }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.sections.now = ["Second line", "First line"];
  k.sectionItemIds = { now: [ITEM_B, ITEM_A] };
  k.structured = [
    structured({
      id: ITEM_A,
      projectId: PROJECT_A,
      section: "now",
      body: "First line",
      kind: "fact",
    }),
    structured({
      id: ITEM_B,
      projectId: PROJECT_A,
      section: "now",
      body: "Second line",
      kind: "fact",
    }),
  ];
  state.knowledge = [k];

  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForStructuredItem(ITEM_A),
  );
  assert.equal(detail!.body, "First line");

  // Correction targets ITEM_A even though it is index 1
  const next = buildCorrectedSectionBullets(k, "now", {
    itemId: ITEM_A,
    oldBody: "First line",
    newBody: "First line corrected",
  });
  assert.deepEqual(next, ["Second line", "First line corrected"]);
});

check("3. Closing detail is modeled as clearing selection (same KC)", () => {
  const frames = readSrc(
    "src/components/knowledge-centre/OceanKnowledgeFrames.tsx",
  );
  assert.match(frames, /KnowledgeItemDetailDrawer/);
  assert.match(frames, /onClose=\{\(\) => setSelected\(null\)\}/);
  assert.match(frames, /data-testid="ocean-knowledge-frames"/);
  const drawer = readSrc(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /ocean-item-detail-drawer/);
  assert.match(drawer, /Escape/);
});

check("4. Editing a supported Knowledge item builds durable section rewrite", () => {
  const k = emptyKnowledge(PROJECT_A);
  k.sections.decisions = ["Use blue theme", "Keep navy"];
  k.sectionItemIds = { decisions: [ITEM_A, ITEM_B] };
  const next = buildCorrectedSectionBullets(k, "decisions", {
    itemId: ITEM_A,
    oldBody: "Use blue theme",
    newBody: "Use Ocean navy",
  });
  assert.deepEqual(next, ["Use Ocean navy", "Keep navy"]);
});

check("5. Unrelated item is not mutated by correction helper", () => {
  const k = emptyKnowledge(PROJECT_A);
  k.sections.now = ["Alpha fact", "Beta fact"];
  k.sectionItemIds = { now: [ITEM_A, ITEM_B] };
  const next = buildCorrectedSectionBullets(k, "now", {
    itemId: ITEM_A,
    oldBody: "Alpha fact",
    newBody: "Alpha fact v2",
  });
  assert.equal(next![1], "Beta fact");
  assert.equal(next![0], "Alpha fact v2");
});

check("6. Provenance renders only from stored provenance", () => {
  const lines = formatProvenanceLines([
    {
      type: "capture",
      at: "2026-08-18T12:00:00.000Z",
      note: "meeting notes",
    },
    { type: "user_confirmation", at: "2026-08-19T09:00:00.000Z" },
  ]);
  assert.equal(lines.length, 2);
  assert.match(lines[0]!, /Learned from Capture/);
  assert.match(lines[0]!, /meeting notes/);
  assert.match(lines[1]!, /Confirmed by you/);
  assert.equal(formatProvenanceLines(undefined).length, 0);
  assert.equal(formatProvenanceLines([]).length, 0);

  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "Alpha", code: "A" }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.structured = [
    structured({
      id: ITEM_A,
      projectId: PROJECT_A,
      section: "now",
      body: "No evidence item",
      kind: "fact",
      provenance: null,
    }),
  ];
  k.sections.now = ["No evidence item"];
  k.sectionItemIds = { now: [ITEM_A] };
  state.knowledge = [k];
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForStructuredItem(ITEM_A),
  );
  assert.deepEqual(detail!.provenanceLines, []);
  assert.ok(
    detail!.honestyNotes.some((n) => /No stored provenance/i.test(n)),
  );
});

check("7. Current vs superseded values are distinguishable", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "Alpha", code: "A" }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.structured = [
    structured({
      id: ITEM_PREV,
      projectId: PROJECT_A,
      section: "now",
      body: "Launch 21 Aug",
      kind: "date",
      lifecycle: "superseded",
      epistemic: "confirmed",
    }),
    structured({
      id: ITEM_A,
      projectId: PROJECT_A,
      section: "now",
      body: "Launch 25 Aug",
      kind: "date",
      supersedesId: ITEM_PREV,
      provenance: [{ type: "manual_edit", at: "2026-08-20T10:00:00.000Z" }],
    }),
  ];
  k.sections.now = ["Launch 25 Aug"];
  k.sectionItemIds = { now: [ITEM_A] };
  state.knowledge = [k];
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForStructuredItem(ITEM_A),
  );
  assert.equal(detail!.body, "Launch 25 Aug");
  assert.equal(detail!.previousValue, "Launch 21 Aug");
  assert.equal(detail!.previousLabel, "Previously");
});

check("8. Confirmed Knowledge does not gain permanent confidence badges", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "Alpha", code: "A" }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.structured = [
    structured({
      id: ITEM_A,
      projectId: PROJECT_A,
      section: "now",
      body: "Confirmed fact",
      kind: "fact",
      epistemic: "confirmed",
    }),
  ];
  k.sections.now = ["Confirmed fact"];
  k.sectionItemIds = { now: [ITEM_A] };
  state.knowledge = [k];
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForStructuredItem(ITEM_A),
  );
  assert.equal(detail!.epistemicLabel, null);
  const src = readSrc(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.doesNotMatch(src, /High confidence|Medium confidence|Low confidence/);
});

check("9. Risk detail respects risks.status", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "Alpha", code: "A" }),
  ];
  state.risks = [
    {
      id: RISK_A,
      projectId: PROJECT_A,
      title: "Vendor delay",
      status: "open",
    },
  ];
  const open = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForRisk(RISK_A),
  );
  assert.equal(open!.riskStatus, "open");
  assert.equal(open!.canResolveRisk, true);
  assert.equal(open!.domain, "risk");

  state.risks[0]!.status = "resolved";
  const closed = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForRisk(RISK_A),
  );
  assert.equal(closed!.riskStatus, "resolved");
  assert.equal(closed!.canResolveRisk, false);
});

check("10. Person detail retrieves stable stakeholder + current responsibilities", () => {
  const state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "Alpha",
      code: "A",
      stakeholders: [
        { id: PERSON_A, name: "Ava Chen", role: "UX" },
        { id: PERSON_B, name: "Priya Shah", role: "PM" },
      ],
    }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.structured = [
    structured({
      id: RESP_A,
      projectId: PROJECT_A,
      section: "people",
      body: "Ava Chen — UX design sign-off",
      kind: "responsibility",
      meta: {
        responsibility: {
          personId: PERSON_A,
          personName: "Ava Chen",
          scope: "UX design sign-off",
          ownerConfirmed: true,
        },
      },
      provenance: [{ type: "user_confirmation", note: "confirmed" }],
    }),
  ];
  state.knowledge = [k];
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForPerson(PERSON_A),
  );
  assert.ok(detail!.personBundle);
  assert.equal(detail!.personBundle!.person.id, PERSON_A);
  assert.equal(detail!.personBundle!.currentResponsibilities.length, 1);
  assert.equal(
    detail!.personBundle!.currentResponsibilities[0]!.scope,
    "UX design sign-off",
  );
});

check("11. Shared responsibilities are not collapsed to one owner", () => {
  const state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "Alpha",
      code: "A",
      stakeholders: [
        { id: PERSON_A, name: "Ava Chen", role: "UX" },
        { id: PERSON_B, name: "Priya Shah", role: "PM" },
      ],
    }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.structured = [
    structured({
      id: RESP_A,
      projectId: PROJECT_A,
      section: "people",
      body: "Ava — Security sign-off",
      kind: "responsibility",
      meta: {
        responsibility: {
          personId: PERSON_A,
          personName: "Ava Chen",
          scope: "Security sign-off",
          ownerConfirmed: true,
        },
      },
    }),
    structured({
      id: RESP_B,
      projectId: PROJECT_A,
      section: "people",
      body: "Priya — Security sign-off",
      kind: "responsibility",
      meta: {
        responsibility: {
          personId: PERSON_B,
          personName: "Priya Shah",
          scope: "Security sign-off",
          ownerConfirmed: true,
        },
      },
    }),
  ];
  state.knowledge = [k];
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForPerson(PERSON_A),
  );
  assert.ok(detail!.personBundle!.sharedScopes.length >= 1);
  assert.ok(
    detail!.personBundle!.sharedScopes.some(
      (s) =>
        s.scope === "Security sign-off" &&
        s.coOwnerNames.includes("Priya Shah"),
    ),
  );
  assert.ok(
    detail!.assumptions.some((a) => /Shared/i.test(a) && /Priya/i.test(a)),
  );
});

check("12. Historical responsibility remains distinguishable from current", () => {
  const state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "Alpha",
      code: "A",
      stakeholders: [{ id: PERSON_A, name: "Ava Chen", role: "UX" }],
    }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.structured = [
    structured({
      id: RESP_HIST,
      projectId: PROJECT_A,
      section: "people",
      body: "Ava — CAB pack",
      kind: "responsibility",
      lifecycle: "historical",
      meta: {
        responsibility: {
          personId: PERSON_A,
          personName: "Ava Chen",
          scope: "CAB pack",
          ownerConfirmed: true,
        },
      },
    }),
    structured({
      id: RESP_A,
      projectId: PROJECT_A,
      section: "people",
      body: "Ava — UX design sign-off",
      kind: "responsibility",
      lifecycle: "current",
      meta: {
        responsibility: {
          personId: PERSON_A,
          personName: "Ava Chen",
          scope: "UX design sign-off",
          ownerConfirmed: true,
        },
      },
    }),
  ];
  state.knowledge = [k];
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForPerson(PERSON_A),
  );
  assert.equal(detail!.personBundle!.currentResponsibilities.length, 1);
  assert.equal(detail!.personBundle!.historicalResponsibilities.length, 1);
  assert.match(detail!.previousValue ?? "", /CAB pack/);
  assert.match(detail!.previousLabel ?? "", /Previous/);
});

check("13. Project A item cannot inspect Project B", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "Alpha", code: "A" }),
    baseProject({ id: PROJECT_B, name: "Beta", code: "B" }),
  ];
  const ka = emptyKnowledge(PROJECT_A);
  ka.structured = [
    structured({
      id: ITEM_A,
      projectId: PROJECT_A,
      section: "now",
      body: "Alpha only",
      kind: "fact",
    }),
  ];
  ka.sections.now = ["Alpha only"];
  ka.sectionItemIds = { now: [ITEM_A] };
  const kb = emptyKnowledge(PROJECT_B);
  kb.structured = [
    structured({
      id: ITEM_B,
      projectId: PROJECT_B,
      section: "now",
      body: "Beta only",
      kind: "fact",
    }),
  ];
  state.knowledge = [ka, kb];
  state.risks = [
    {
      id: RISK_A,
      projectId: PROJECT_B,
      title: "Beta risk",
      status: "open",
    },
  ];

  assert.equal(
    resolveKnowledgeItemDetail(state, PROJECT_B, refForStructuredItem(ITEM_A)),
    null,
  );
  assert.equal(
    resolveKnowledgeItemDetail(state, PROJECT_A, refForRisk(RISK_A)),
    null,
  );
  assert.ok(
    resolveKnowledgeItemDetail(state, PROJECT_A, refForStructuredItem(ITEM_A)),
  );
});

check("14. Search/Ask Ocean bar wiring remains intact", () => {
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.match(workspace, /KnowledgeSearchAskBar/);
  assert.match(workspace, /OceanKnowledgeFrames/);
  assert.doesNotMatch(workspace, /portfolio|cross-project ask/i);
});

check("15. Capture Ocean mode remains intact", () => {
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.match(workspace, /mode === "capture"/);
  assert.match(workspace, /variant="ocean"/);
  assert.match(workspace, /CaptureWorkspace/);
});

check("16. No portfolio / cross-project behaviour introduced", () => {
  const detailLib = readSrc(
    "src/lib/knowledge-centre/knowledge-item-detail.ts",
  );
  const drawer = readSrc(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.doesNotMatch(detailLib, /portfolio|crossProject|allProjects/i);
  assert.doesNotMatch(drawer, /portfolio|crossProject|allProjects/i);
  // Resolver always takes projectId
  assert.match(detailLib, /function resolveKnowledgeItemDetail/);
});

check("UI: To Do click opens detail (no longer only toggle)", () => {
  const frames = readSrc(
    "src/components/knowledge-centre/OceanKnowledgeFrames.tsx",
  );
  assert.doesNotMatch(frames, /onSelect=\{\(\) => toggleTodo/);
  assert.match(frames, /refForTodo/);
  assert.match(
    readSrc("src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx"),
    /toggleTodo/,
  );
});

check("UI: save error surface present for corrections (D-005 partial)", () => {
  const drawer = readSrc(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /saveStatus === "error"/);
  assert.match(drawer, /ocean-item-detail-save-error/);
  const shell = readSrc("src/components/AppShell.tsx");
  assert.match(shell, /ocean-save-error/);
});

check("Unconfirmed owner detail exposes confirm path without inventing evidence", () => {
  const state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "Alpha",
      code: "A",
      stakeholders: [{ id: PERSON_A, name: "Ava Chen", role: "UX" }],
    }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.structured = [
    structured({
      id: UNCONF,
      projectId: PROJECT_A,
      section: "people",
      body: "Security sign-off · Owner not confirmed",
      kind: "responsibility",
      epistemic: "unknown",
      meta: {
        responsibility: {
          scope: "Security sign-off",
          ownerConfirmed: false,
        },
      },
    }),
  ];
  state.knowledge = [k];
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForUnconfirmedOwner(UNCONF),
  );
  assert.equal(detail!.canConfirmOwner, true);
  assert.equal(detail!.confirmOwnerScope, "Security sign-off");
  assert.equal(detail!.epistemicLabel, "Needs you");
});

check("knowledgeDetailEquals / personId helpers", () => {
  assert.ok(
    knowledgeDetailEquals(
      refForStructuredItem(ITEM_A),
      refForStructuredItem(ITEM_A),
    ),
  );
  assert.ok(
    !knowledgeDetailEquals(
      refForStructuredItem(ITEM_A),
      refForStructuredItem(ITEM_B),
    ),
  );
  assert.equal(
    personIdFromPeopleCardId(`${PERSON_A}-UX design`, [PERSON_A, PERSON_B]),
    PERSON_A,
  );
  assert.equal(
    formatProvenanceLine({ type: "manual_edit", at: "2026-08-20T00:00:00Z" }),
    "Manually edited · 20 Aug",
  );
  assert.ok(refForSectionLine("now", "x", ITEM_A));
  assert.ok(refForTodo(TODO_A));
});

check("Correction helper refuses index-only mutation when id/body missing", () => {
  const k = emptyKnowledge(PROJECT_A);
  k.sections.now = ["Keep me", "Also keep"];
  k.sectionItemIds = { now: [ITEM_A, ITEM_B] };
  const miss = buildCorrectedSectionBullets(k, "now", {
    itemId: "00000000-0000-4000-8000-000000000000",
    oldBody: "Not present",
    newBody: "Hijack",
  });
  assert.equal(miss, null);
});

console.log(`\n${passed} checks passed`);
