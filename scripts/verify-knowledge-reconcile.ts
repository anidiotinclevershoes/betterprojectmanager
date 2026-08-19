/**
 * Slice 1A: unit verification for knowledge reconcile planning.
 * Proves correction → rehydrate shape without requiring live Supabase.
 *
 * Run: npx --yes tsx scripts/verify-knowledge-reconcile.ts
 */
import assert from "node:assert/strict";
import { emptyKnowledge } from "../src/lib/knowledge";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import {
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

  assert.equal(plan.updates[0]?.id, ID_NOW);
  assert.ok(!plan.deleteIds.includes(ID_OTHER));
  assert.ok(!plan.updates.some((u) => u.id === ID_OTHER));
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

  // Same length with different second body → positional in-place update
  // (preserves row identity; documented limitation vs semantic "different fact").
  const replaced = emptyKnowledge(PROJECT_A);
  replaced.sections.now = ["Keep me", "Brand new fact"];
  const replacePlan = planKnowledgeReconcile({
    projectId: PROJECT_A,
    workspaceId: WS,
    desired: replaced,
    existingRows: existing,
    sections: ["now"],
  });
  assert.equal(replacePlan.deleteIds.length, 0);
  assert.equal(replacePlan.inserts.length, 0);
  assert.equal(replacePlan.updates.length, 1);
  assert.equal(replacePlan.updates[0]!.id, ID_DEC);
  assert.equal(replacePlan.updates[0]!.body, "Brand new fact");
}

function testRemapStructuredPreservesIdentity() {
  const structured: CanonicalTruthItem[] = [
    {
      id: ID_NOW,
      projectId: PROJECT_A,
      section: "now",
      body: "Old wording",
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "current",
      meta: { keep: true },
      provenance: [{ type: "user_confirmation", at: "2026-01-01" }],
    },
  ];
  const previous = emptyKnowledge(PROJECT_A);
  previous.sections.now = ["Old wording"];
  previous.structured = structured;

  const remapped = remapStructuredForSections(previous, {
    ...previous.sections,
    now: ["New wording"],
  });

  assert.ok(remapped);
  assert.equal(remapped!.length, 1);
  assert.equal(remapped![0]!.id, ID_NOW);
  assert.equal(remapped![0]!.body, "New wording");
  assert.equal(remapped![0]!.epistemic, "confirmed");
  assert.equal((remapped![0]!.meta as { keep: boolean }).keep, true);
}

function testUnaffectedSectionUntouchedInPartialReconcile() {
  const existing = [
    row({ id: ID_NOW, section: "now", body: "A", position: 0 }),
    row({ id: ID_DEC, section: "decisions", body: "Decision stays", position: 0 }),
  ];
  const desired = emptyKnowledge(PROJECT_A);
  desired.sections.now = ["A corrected"];
  desired.sections.decisions = ["Decision stays"];

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
testRemapStructuredPreservesIdentity();
testUnaffectedSectionUntouchedInPartialReconcile();

console.log("verify-knowledge-reconcile: OK");
