/**
 * Slice 1A / 1A.1: unit verification for knowledge reconcile + stable identity.
 * Proves correction → rehydrate shape without requiring live Supabase.
 *
 * Run: npx --yes tsx scripts/verify-knowledge-reconcile.ts
 */
import assert from "node:assert/strict";
import { emptyKnowledge } from "../src/lib/knowledge";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import {
  alignSectionLines,
  planKnowledgeReconcile,
  remapStructuredForSections,
  type KnowledgeItemRow,
} from "../src/lib/data/supabase/reconcile-knowledge";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_NOW = "33333333-3333-4333-8333-333333333333";
const ID_DEC = "44444444-4444-4444-8444-444444444444";
const ID_OTHER = "55555555-5555-4555-8555-555555555555";
const ID_SEC = "66666666-6666-4666-8666-666666666666";
const ID_UX = "77777777-7777-4777-8777-777777777777";

function row(
  partial: Partial<KnowledgeItemRow> &
    Pick<KnowledgeItemRow, "id" | "section" | "body">,
): KnowledgeItemRow {
  return {
    workspace_id: WS,
    project_id: PROJECT_A,
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

function testEditPreservesIdAndMetadata() {
  const existing = [
    row({
      id: ID_NOW,
      section: "now",
      body: "Beta launch targeted for 14 Aug",
      position: 0,
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "current",
      meta: { note: "keep-me" },
      provenance: [{ type: "capture", note: "from meeting" }],
    }),
    row({
      id: ID_DEC,
      section: "decisions",
      body: "CAB required before go-live",
      position: 0,
      kind: "decision",
      epistemic: "confirmed",
    }),
  ];

  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["Beta launch slipped to 28 Aug"];
  desired.sections.decisions = ["CAB required before go-live"];

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing,
    at: "2026-08-19T12:00:00.000Z",
  });

  assert.equal(plan.updates.length, 1, "exactly one body update");
  assert.equal(plan.updates[0]!.id, ID_NOW, "same row id updated");
  assert.equal(
    plan.updates[0]!.body,
    "Beta launch slipped to 28 Aug",
    "corrected body",
  );
  assert.equal(plan.inserts.length, 0, "no inserts for in-place edit");
  assert.equal(plan.deleteIds.length, 0, "unaffected rows not deleted");
  const prov = plan.updates[0]!.provenance as Array<{ type: string }>;
  assert.ok(
    prov.some((p) => p.type === "manual_edit"),
    "manual_edit provenance appended",
  );
  assert.ok(
    prov.some((p) => p.type === "capture"),
    "prior provenance retained",
  );
}

function testSectionReplacementDoesNotTouchOtherProjectRows() {
  const existing = [
    row({
      id: ID_NOW,
      section: "now",
      body: "Old position",
      position: 0,
    }),
    row({
      id: ID_OTHER,
      section: "now",
      body: "Project B fact",
      project_id: PROJECT_B,
      position: 0,
    }),
  ];

  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["New position"];

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    // Caller filters by project; simulate that.
    existingRows: existing.filter((r) => r.project_id === PROJECT_A),
    sections: ["now"],
  });

  // Unrelated replacement (no wording overlap) → insert + delete, not UPDATE.
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0]!.body, "New position");
  assert.deepEqual(plan.deleteIds, [ID_NOW]);
  assert.ok(!plan.deleteIds.includes(ID_OTHER));
  assert.ok(!plan.updates.some((u) => u.id === ID_OTHER));
  assert.ok(!plan.inserts.some((i) => i.id === ID_OTHER));
}

function testRemoveAndAdd() {
  const existing = [
    row({ id: ID_NOW, section: "now", body: "Keep me", position: 0 }),
    row({ id: ID_DEC, section: "now", body: "Remove me", position: 1 }),
  ];

  // Fewer bullets → true delete of the unmatched row.
  const shrunk = emptyKnowledge(PROJECT_A);
  shrunk.sections.now = ["Keep me"];
  const shrinkPlan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired: shrunk,
    existingRows: existing,
    sections: ["now"],
  });
  assert.deepEqual(shrinkPlan.deleteIds, [ID_DEC]);
  assert.equal(shrinkPlan.inserts.length, 0);
  assert.equal(shrinkPlan.updates.length, 0);

  // Same length with unrelated second body → INSERT new + DELETE old (Case B).
  // Must NOT UPDATE ID_DEC (that would inherit metadata).
  const replaced = emptyKnowledge(PROJECT_A);
  replaced.sections.now = ["Keep me", "Brand new fact"];
  const replacePlan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired: replaced,
    existingRows: existing,
    sections: ["now"],
  });
  assert.deepEqual(replacePlan.deleteIds, [ID_DEC]);
  assert.equal(replacePlan.inserts.length, 1);
  assert.equal(replacePlan.inserts[0]!.body, "Brand new fact");
  assert.notEqual(replacePlan.inserts[0]!.id, ID_DEC);
  assert.equal(replacePlan.inserts[0]!.kind, null);
  assert.equal(replacePlan.inserts[0]!.epistemic, null);
  assert.deepEqual(replacePlan.inserts[0]!.meta, {});
  assert.equal(replacePlan.updates.length, 0);
}

/** Case A — wording edit preserves identity */
function testCaseAWordingEditPreservesIdentity() {
  const existing = [
    row({
      id: ID_DEC,
      section: "decisions",
      body: "CAB approval is due 21 August",
      position: 0,
      kind: "decision",
      epistemic: "confirmed",
      provenance: [{ type: "capture", note: "cab" }],
      meta: { source: "cab-note" },
    }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.decisions = ["CAB approval is due on 22 August"];
  desired.sectionItemIds = { decisions: [ID_DEC] };

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing,
    sections: ["decisions"],
  });

  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0]!.id, ID_DEC);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.deleteIds.length, 0);
  const prov = plan.updates[0]!.provenance as Array<{ type: string }>;
  assert.ok(prov.some((p) => p.type === "capture"));
}

/** Case B — unrelated same-position replacement gets new identity */
function testCaseBUnrelatedReplacementNewIdentity() {
  const existing = [
    row({
      id: ID_DEC,
      section: "now",
      body: "CAB approval is due 21 August",
      position: 0,
      kind: "decision",
      epistemic: "confirmed",
      provenance: [{ type: "capture", note: "cab" }],
      meta: { source: "cab-note" },
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

  assert.equal(plan.updates.length, 0, "must not UPDATE old row");
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0]!.body, "Ava is away next week");
  assert.notEqual(plan.inserts[0]!.id, ID_DEC);
  assert.equal(plan.inserts[0]!.kind, null);
  assert.equal(plan.inserts[0]!.epistemic, null);
  assert.deepEqual(plan.inserts[0]!.meta, {});
  const insProv = plan.inserts[0]!.provenance as Array<{ type: string }>;
  assert.ok(!insProv.some((p) => p.type === "capture"));
  assert.deepEqual(plan.deleteIds, [ID_DEC]);
}

/** Case C — deletion must not transfer identity to the next item */
function testCaseCDeletionDoesNotShiftIdentity() {
  const existing = [
    row({ id: ID_DEC, section: "now", body: "CAB date", position: 0 }),
    row({ id: ID_SEC, section: "now", body: "Security sign-off", position: 1 }),
    row({ id: ID_UX, section: "now", body: "UX freeze", position: 2 }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["Security sign-off", "UX freeze"];

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing,
    sections: ["now"],
  });

  assert.deepEqual(plan.deleteIds, [ID_DEC]);
  assert.equal(plan.inserts.length, 0);
  // Positions may update for remaining rows
  const byId = new Map(plan.updates.map((u) => [u.id, u]));
  assert.equal(byId.get(ID_SEC)?.body, "Security sign-off");
  assert.equal(byId.get(ID_SEC)?.position, 0);
  assert.equal(byId.get(ID_UX)?.body, "UX freeze");
  assert.equal(byId.get(ID_UX)?.position, 1);
  assert.ok(!plan.updates.some((u) => u.id === ID_DEC));
}

/** Case D — reorder preserves identities without metadata transfer */
function testCaseDReorderPreservesIdentities() {
  const existing = [
    row({ id: ID_DEC, section: "now", body: "CAB date", position: 0 }),
    row({ id: ID_SEC, section: "now", body: "Security sign-off", position: 1 }),
    row({ id: ID_UX, section: "now", body: "UX freeze", position: 2 }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["UX freeze", "CAB date", "Security sign-off"];

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing,
    sections: ["now"],
  });

  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.deleteIds.length, 0);
  assert.equal(plan.updates.length, 3);
  const byId = new Map(plan.updates.map((u) => [u.id, u]));
  assert.equal(byId.get(ID_UX)?.position, 0);
  assert.equal(byId.get(ID_DEC)?.position, 1);
  assert.equal(byId.get(ID_SEC)?.position, 2);
  assert.equal(byId.get(ID_UX)?.body, "UX freeze");
  assert.equal(byId.get(ID_DEC)?.body, "CAB date");
  assert.equal(byId.get(ID_SEC)?.body, "Security sign-off");
}

function testAlignSectionLinesNeverUsesIndexAlone() {
  const aligned = alignSectionLines(
    ["CAB approval is due 21 August"],
    [ID_DEC],
    ["Ava is away next week"],
  );
  assert.equal(aligned.length, 1);
  assert.equal(aligned[0]!.body, "Ava is away next week");
  assert.equal(aligned[0]!.id, null, "unrelated text must not keep old id");
}

function testRemapStructuredPreservesIdentity() {
  const structured: CanonicalTruthItem[] = [
    {
      id: ID_NOW,
      projectId: PROJECT_A,
      section: "now",
      body: "CAB approval is due 21 August",
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "current",
      meta: { keep: true },
      provenance: [{ type: "user_confirmation", at: "2026-01-01" }],
    },
  ];
  const previous = emptyKnowledge(PROJECT_A);
  previous.sections.now = ["CAB approval is due 21 August"];
  previous.sectionItemIds = { now: [ID_NOW] };
  previous.structured = structured;

  const remapped = remapStructuredForSections(previous, {
    ...previous.sections,
    now: ["CAB approval is due on 22 August"],
  });

  assert.ok(remapped);
  assert.equal(remapped!.length, 1);
  assert.equal(remapped![0]!.id, ID_NOW);
  assert.equal(remapped![0]!.body, "CAB approval is due on 22 August");
  assert.equal(remapped![0]!.epistemic, "confirmed");
  assert.equal((remapped![0]!.meta as { keep: boolean }).keep, true);
}

function testRemapUnrelatedDoesNotInheritMetadata() {
  const previous = emptyKnowledge(PROJECT_A);
  previous.sections.now = ["CAB approval is due 21 August"];
  previous.sectionItemIds = { now: [ID_NOW] };
  previous.structured = [
    {
      id: ID_NOW,
      projectId: PROJECT_A,
      section: "now",
      body: "CAB approval is due 21 August",
      kind: "decision",
      epistemic: "confirmed",
      lifecycle: "current",
      meta: { source: "cab" },
      provenance: [{ type: "capture" }],
    },
  ];

  const remapped = remapStructuredForSections(previous, {
    ...previous.sections,
    now: ["Ava is away next week"],
  });

  assert.ok(remapped);
  assert.equal(remapped!.length, 0, "unrelated replacement drops overlay");
}

function testUnaffectedSectionUntouchedInPartialReconcile() {
  const existing = [
    row({ id: ID_NOW, section: "now", body: "A", position: 0 }),
    row({
      id: ID_DEC,
      section: "decisions",
      body: "Decision stays",
      position: 0,
    }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["A corrected"];
  desired.sections.decisions = ["Decision stays"];
  desired.sectionItemIds = { now: [ID_NOW] };

  const plan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired,
    existingRows: existing,
    sections: ["now"],
  });

  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0]!.id, ID_NOW);
  assert.ok(!plan.deleteIds.includes(ID_DEC));
  assert.ok(!plan.updates.some((u) => u.id === ID_DEC));
}

testEditPreservesIdAndMetadata();
testSectionReplacementDoesNotTouchOtherProjectRows();
testRemoveAndAdd();
testCaseAWordingEditPreservesIdentity();
testCaseBUnrelatedReplacementNewIdentity();
testCaseCDeletionDoesNotShiftIdentity();
testCaseDReorderPreservesIdentities();
testAlignSectionLinesNeverUsesIndexAlone();
testRemapStructuredPreservesIdentity();
testRemapUnrelatedDoesNotInheritMetadata();
testUnaffectedSectionUntouchedInPartialReconcile();

console.log("verify-knowledge-reconcile: OK");
