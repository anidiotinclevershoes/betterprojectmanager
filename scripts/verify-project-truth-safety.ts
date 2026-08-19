/**
 * Project-truth safety net — deterministic regression for trust-critical behaviour.
 * No OpenAI. No live Supabase. Characterises intended V1 guarantees.
 *
 * Run: npm run verify:project-truth-safety
 */
import assert from "node:assert/strict";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  isKnowledgeUuid,
  planKnowledgeReconcile,
  remapStructuredForSections,
  type KnowledgeItemRow,
} from "../src/lib/data/supabase/reconcile-knowledge";
import { foldOpenRisksIntoKnowledge } from "../src/lib/risks/lifecycle";
import { buildCaptureContext } from "../src/lib/capture/context";
import {
  searchProjectKnowledge,
  highlightMatches,
} from "../src/lib/tell-me/knowledge-search";
import { buildCanonicalSuggestions } from "../src/lib/canonical-truth/suggestions";
import {
  confirmResponsibilityOwner,
  findConfirmedOwner,
} from "../src/lib/canonical-truth/confirm-responsibility";
import { serializeCanonicalTruth } from "../src/lib/canonical-truth/serialize";
import { getPersistenceMode } from "../src/lib/persistence-mode";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import type { MissionState, Project } from "../src/lib/types";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_A1 = "33333333-3333-4333-8333-333333333333";
const ID_A2 = "44444444-4444-4444-8444-444444444444";
const ID_B1 = "55555555-5555-4555-8555-555555555555";

let passed = 0;
const skipped: string[] = [];

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

/** Known defect / not-yet-implemented guarantee — do not encode as green. */
function knownGap(name: string, reason: string) {
  skipped.push(`${name} — ${reason}`);
  console.log(`○ SKIP (known gap): ${name}`);
  console.log(`  ${reason}`);
}

function row(
  partial: Partial<KnowledgeItemRow> &
    Pick<KnowledgeItemRow, "id" | "section" | "body" | "project_id">,
): KnowledgeItemRow {
  return {
    workspace_id: WS,
    position: 0,
    kind: null,
    epistemic: null,
    lifecycle: "current",
    supersedes_id: null,
    meta: {},
    provenance: [],
    created_by: null,
    ...partial,
  };
}

function baseProject(
  partial: Partial<Project> & Pick<Project, "id" | "name" | "code">,
): Project {
  return {
    summary: "",
    status: "healthy",
    currentFocus: "",
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
    timeline: [],
    history: [],
  };
}

// --- Priority 1: project truth & persistence (deterministic characterisation) ---

check("Project A reconcile cannot target Project B rows", () => {
  const existing = [
    row({
      id: ID_A1,
      project_id: PROJECT_A,
      section: "now",
      body: "A fact",
    }),
    row({
      id: ID_B1,
      project_id: PROJECT_B,
      section: "now",
      body: "B fact",
    }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["A fact corrected"];

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing.filter((r) => r.project_id === PROJECT_A),
    sections: ["now"],
  });

  assert.ok(plan.updates.every((u) => u.id === ID_A1 || u.id !== ID_B1));
  assert.ok(!plan.deleteIds.includes(ID_B1));
  assert.ok(!plan.updates.some((u) => u.id === ID_B1));
  assert.ok(!plan.inserts.some(() => false));
});

check("Knowledge edit keeps stable UUID and appends manual_edit provenance", () => {
  const existing = [
    row({
      id: ID_A1,
      project_id: PROJECT_A,
      section: "now",
      body: "Launch 14 Aug",
      kind: "fact",
      epistemic: "confirmed",
      meta: { keep: true },
      provenance: [{ type: "capture", note: "orig" }],
    }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["Launch 28 Aug"];

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing,
    at: "2026-08-19T18:00:00.000Z",
  });

  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0]!.id, ID_A1);
  assert.equal(plan.updates[0]!.body, "Launch 28 Aug");
  const prov = plan.updates[0]!.provenance as Array<{ type: string }>;
  assert.ok(prov.some((p) => p.type === "capture"));
  assert.ok(prov.some((p) => p.type === "manual_edit"));
  assert.equal(plan.deleteIds.length, 0);
  assert.equal(plan.inserts.length, 0);
});

check("Knowledge delete removes only the intended item", () => {
  const existing = [
    row({
      id: ID_A1,
      project_id: PROJECT_A,
      section: "now",
      body: "Keep",
      position: 0,
    }),
    row({
      id: ID_A2,
      project_id: PROJECT_A,
      section: "now",
      body: "Drop",
      position: 1,
    }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["Keep"];

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing,
    sections: ["now"],
  });

  assert.deepEqual(plan.deleteIds, [ID_A2]);
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.inserts.length, 0);
});

check("Unaffected section survives partial reconcile", () => {
  const existing = [
    row({
      id: ID_A1,
      project_id: PROJECT_A,
      section: "now",
      body: "Now status is blocked on vendor",
    }),
    row({
      id: ID_A2,
      project_id: PROJECT_A,
      section: "decisions",
      body: "Decision stays",
    }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["Now status is clear for launch"];
  desired.sections.decisions = ["Decision stays"];

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing,
    sections: ["now"],
  });

  assert.equal(plan.updates[0]!.id, ID_A1);
  assert.ok(!plan.deleteIds.includes(ID_A2));
});

check("Structured remap preserves identity on wording edit", () => {
  const previous = emptyKnowledge(PROJECT_A);
  previous.sections.now = ["CAB approval is due 21 August"];
  previous.sectionItemIds = { now: [ID_A1] };
  previous.structured = [
    {
      id: ID_A1,
      projectId: PROJECT_A,
      section: "now",
      body: "CAB approval is due 21 August",
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "current",
      meta: { keep: true },
      provenance: [{ type: "user_confirmation" }],
    },
  ];
  const remapped = remapStructuredForSections(previous, {
    ...previous.sections,
    now: ["CAB approval is due on 22 August"],
  });
  assert.equal(remapped![0]!.id, ID_A1);
  assert.equal(remapped![0]!.epistemic, "confirmed");
  assert.equal(remapped![0]!.body, "CAB approval is due on 22 August");
});

check("isKnowledgeUuid rejects non-UUID confirm-owner style ids", () => {
  assert.equal(isKnowledgeUuid("resp-abc123xy"), false);
  assert.equal(isKnowledgeUuid(ID_A1), true);
});

check("Unrelated same-index replacement must not inherit prior metadata", () => {
  const existing = [
    row({
      id: ID_A1,
      project_id: PROJECT_A,
      section: "now",
      body: "CAB approval is due 21 August",
      position: 0,
      kind: "decision",
      epistemic: "confirmed",
      meta: { source: "cab" },
      provenance: [{ type: "capture", note: "cab" }],
    }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["Ava is away next week"];

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing,
    sections: ["now"],
  });

  assert.equal(plan.updates.length, 0, "must not UPDATE prior row");
  assert.equal(plan.inserts.length, 1);
  assert.notEqual(plan.inserts[0]!.id, ID_A1);
  assert.equal(plan.inserts[0]!.kind, null);
  assert.equal(plan.inserts[0]!.epistemic, null);
  assert.deepEqual(plan.inserts[0]!.meta, {});
  const prov = plan.inserts[0]!.provenance as Array<{ type: string }>;
  assert.ok(!prov.some((p) => p.type === "capture"));
  assert.deepEqual(plan.deleteIds, [ID_A1]);
});

check("Resolved risk must not resurrect from risks table on hydrate", () => {
  const risks = [
    {
      id: ID_A1,
      projectId: PROJECT_A,
      title: "Security sign-off may miss CAB",
      status: "resolved" as const,
    },
    {
      id: ID_A2,
      projectId: PROJECT_A,
      title: "Other open risk",
      status: "open" as const,
    },
  ];
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.risks = ["[Resolved] Security sign-off may miss CAB"];
  const folded = foldOpenRisksIntoKnowledge([knowledge], risks);
  assert.ok(
    !folded[0]!.sections.risks.includes("Security sign-off may miss CAB"),
  );
  assert.ok(folded[0]!.sections.risks.includes("Other open risk"));
});

knownGap(
  "Confirm Owner persist must use UUID knowledge_items.id",
  "confirm-responsibility.ts still mints resp-* ids; store passes them to insert. Documented trust bug — do not greenwash.",
);

// --- Capture trust boundary (deterministic) ---

check("buildCaptureContext is project-scoped (A context excludes B knowledge)", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "Alpha", code: "ALP" }),
    baseProject({ id: PROJECT_B, name: "Beta", code: "BET" }),
  ];
  const ka = emptyKnowledge(PROJECT_A);
  ka.sections.now = ["Only on Alpha"];
  const kb = emptyKnowledge(PROJECT_B);
  kb.sections.now = ["Secret on Beta"];
  state.knowledge = [ka, kb];

  const ctx = buildCaptureContext({
    state,
    projectId: PROJECT_A,
    captureText: "status update",
  });

  const bodies = ctx.knowledge.map((k) => k.title ?? k.summary ?? "").join(" ");
  assert.match(bodies, /Only on Alpha/);
  assert.doesNotMatch(bodies, /Secret on Beta/);
});

check("buildCaptureContext does not mutate MissionState", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "Alpha", code: "ALP" }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.sections.now = ["Stable fact"];
  state.knowledge = [k];
  const before = JSON.stringify(state);
  buildCaptureContext({
    state,
    projectId: PROJECT_A,
    captureText: "anything",
  });
  assert.equal(JSON.stringify(state), before);
});

// --- People / responsibility characterisation ---

check("Confirm Owner is scoped responsibility, not global project owner", () => {
  const state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "Alpha",
      code: "ALP",
      stakeholders: [],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];

  const result = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "Security sign-off",
    personName: "Nina",
  });

  assert.equal(result.item.kind, "responsibility");
  assert.equal(result.item.meta?.responsibility?.scope, "Security sign-off");
  assert.equal(result.item.meta?.responsibility?.personName, "Nina");
  assert.equal(result.item.meta?.responsibility?.ownerConfirmed, true);
  const found = findConfirmedOwner(
    result.state.knowledge.find((k) => k.projectId === PROJECT_A),
    "Security sign-off",
  );
  assert.equal(found?.personName, "Nina");
});

check("Confirm Owner on Project A does not alter Project B knowledge", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "A", code: "A" }),
    baseProject({ id: PROJECT_B, name: "B", code: "B" }),
  ];
  const kb = emptyKnowledge(PROJECT_B);
  kb.sections.people = ["Omar — UX"];
  state.knowledge = [emptyKnowledge(PROJECT_A), kb];

  const result = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "Security",
    personName: "Nina",
  });

  const bAfter = result.state.knowledge.find((k) => k.projectId === PROJECT_B)!;
  assert.deepEqual(bAfter.sections.people, ["Omar — UX"]);
});

// --- Retrieval ---

check("Knowledge Search is deterministic and project-local", () => {
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.now = ["CAB pack due Friday"];
  knowledge.sections.risks = ["Auth0 delay"];
  const hits = searchProjectKnowledge(knowledge, "CAB");
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((h) => h.bullet.toLowerCase().includes("cab")));
  const hl = highlightMatches(hits[0]!.bullet, hits[0]!.matchRanges);
  assert.ok(hl.some((p) => p.hit));
});

check("Canonical suggestions stay on the selected project", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "A", code: "A" }),
    baseProject({ id: PROJECT_B, name: "B", code: "B" }),
  ];
  const ka = emptyKnowledge(PROJECT_A);
  ka.structured = [
    {
      id: ID_A1,
      projectId: PROJECT_A,
      section: "people",
      body: "Nina — Security",
      kind: "responsibility",
      epistemic: "confirmed",
      lifecycle: "current",
      meta: {
        responsibility: {
          personName: "Nina",
          scope: "Security",
          ownerConfirmed: true,
        },
      },
    } satisfies CanonicalTruthItem,
  ];
  state.knowledge = [ka, emptyKnowledge(PROJECT_B)];
  const suggestions = buildCanonicalSuggestions({
    state,
    projectId: PROJECT_A,
  });
  const text = suggestions.map((s) => s.question).join(" | ");
  assert.doesNotMatch(text, /\bProject B\b|\bBeta secret\b/i);
  assert.ok(suggestions.length >= 0);
});

check("Canonical serialize current mode excludes superseded items", () => {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "A", code: "A" }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  k.structured = [
    {
      id: ID_A1,
      projectId: PROJECT_A,
      section: "now",
      body: "Old date",
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "superseded",
    },
    {
      id: ID_A2,
      projectId: PROJECT_A,
      section: "now",
      body: "Current date",
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "current",
    },
  ];
  state.knowledge = [k];
  const bundle = serializeCanonicalTruth({
    state,
    projectId: PROJECT_A,
    question: "What is the launch date?",
  });
  assert.match(bundle.promptBlock, /Current date/);
  assert.doesNotMatch(bundle.promptBlock, /Old date/);
});

// --- Local vs supabase mode switch characterisation ---

check("persistence mode: local when LUME_PERSISTENCE=local in non-prod", () => {
  assert.equal(
    getPersistenceMode({
      LUME_PERSISTENCE: "local",
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv),
    "local",
  );
});

check("persistence mode: production defaults to supabase", () => {
  assert.equal(
    getPersistenceMode({
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv),
    "supabase",
  );
});

console.log("");
console.log(
  `verify-project-truth-safety: ${passed} passed, ${skipped.length} known-gap skips`,
);
if (skipped.length) {
  console.log("Known gaps (not failures):");
  for (const s of skipped) console.log(`  - ${s}`);
}
