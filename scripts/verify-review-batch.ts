/**
 * Review-wide Apply gate, Discard session status, filters, and
 * partial-save honesty. Local session status only — no schema change.
 *
 * Run: npx tsx scripts/verify-review-batch.ts
 */
import assert from "node:assert/strict";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import {
  countQueueFilters,
  proposalEditTarget,
  reviewApplyAnnouncement,
  reviewApplyGate,
  stageProposalText,
  unresolvedIncludedNeedsYou,
} from "../src/lib/capture/review/reviewBatch";
import type { ReviewChangeViewModel } from "../src/lib/capture/review/viewModel";
import {
  computeCaptureStatus,
  statusForDiscardedReview,
  statusLabel,
} from "../src/lib/sessions/history";

function card(
  partial: Pick<ReviewChangeViewModel, "id" | "readiness"> &
    Partial<ReviewChangeViewModel>,
): ReviewChangeViewModel {
  return {
    operation: "update",
    executableApply: partial.readiness === "ready",
    canApprove: partial.readiness === "ready",
    reviewReason: null,
    ...partial,
  } as ReviewChangeViewModel;
}

function suggestion(
  partial: Pick<PendingSuggestion, "id" | "op" | "content"> &
    Partial<PendingSuggestion>,
): PendingSuggestion {
  return {
    kind: "action",
    destination: "todo",
    ...partial,
  };
}

function testUnresolvedNeedsYouBlocksTheWholeReview() {
  const ready = card({ id: "ready", readiness: "ready", operation: "create" });
  const needs = card({ id: "needs", readiness: "needs_review", operation: "update" });
  const gate = reviewApplyGate([ready, needs], {}, {});
  assert.equal(gate.blocked, true);
  assert.equal(gate.unresolvedNeedsYou, 1);
  assert.deepEqual(gate.ready.map((item) => item.id), ["ready"]);
  assert.deepEqual(
    unresolvedIncludedNeedsYou([ready, needs], {}, {}).map((item) => item.id),
    ["needs"],
  );
}

function testExcludedNeedsYouDoesNotBlock() {
  const ready = card({ id: "ready", readiness: "ready", operation: "update" });
  const needs = card({ id: "needs", readiness: "needs_review", operation: "update" });
  const gate = reviewApplyGate([ready, needs], {}, { needs: true });
  assert.equal(gate.blocked, false);
  assert.deepEqual(gate.ready.map((item) => item.id), ["ready"]);
}

function testLeftUntouchedDoesNotBlock() {
  const ready = card({ id: "ready", readiness: "ready", operation: "create" });
  const leftover = card({
    id: "left",
    readiness: "left_untouched",
    operation: "update",
    executableApply: false,
    canApprove: false,
  });
  const gate = reviewApplyGate([ready, leftover], {}, {});
  assert.equal(gate.blocked, false);
  assert.deepEqual(gate.ready.map((item) => item.id), ["ready"]);
}

function testDestructiveRemoveConfirmDoesNotCountAsNeedsYou() {
  const remove = card({
    id: "remove",
    readiness: "needs_review",
    operation: "remove",
    reviewReason: "OPERATION_UNCERTAIN",
    executableApply: false,
    canApprove: false,
  });
  const ready = card({ id: "ready", readiness: "ready", operation: "update" });
  const gate = reviewApplyGate([ready, remove], {}, {});
  assert.equal(gate.blocked, false);
  assert.equal(gate.unresolvedNeedsYou, 0);
}

function testResolvingRecalculatesTheExistingReadySet() {
  const resolved = card({
    id: "needs",
    readiness: "ready",
    operation: "update",
  });
  const gate = reviewApplyGate([resolved], {}, {});
  assert.equal(gate.blocked, false);
  assert.deepEqual(gate.ready.map((item) => item.id), ["needs"]);
}

function testDiscardPreservesAppliedHistory() {
  const suggestions = [{ id: "saved" }, { id: "open" }, { id: "excluded" }];
  const added = { saved: true };
  const dismissed = { excluded: true };
  assert.equal(statusForDiscardedReview(suggestions, added), "partially_accepted");
  assert.equal(statusForDiscardedReview([{ id: "open" }], {}), "abandoned");
  assert.equal(dismissed.excluded, true);
  assert.equal(added.saved, true);
  assert.equal(
    computeCaptureStatus(
      suggestions.map((item) => suggestion({ ...item, op: "create", content: item.id })),
      {},
      {},
    ),
    "in_review",
  );
  assert.notEqual(statusForDiscardedReview(suggestions, {}), "dismissed");
  assert.notEqual(statusForDiscardedReview(suggestions, {}), "in_review");
  assert.equal(statusLabel("abandoned"), "Abandoned");
  assert.equal(statusLabel("in_review"), "In review");
  assert.equal(statusLabel("partially_accepted"), "Partially accepted");
}

function testFilterCounts() {
  const pending = [
    card({ id: "a", readiness: "needs_review", operation: "update" }),
    card({ id: "b", readiness: "ready", operation: "create" }),
    card({ id: "c", readiness: "ready", operation: "update" }),
    card({ id: "d", readiness: "ready", operation: "remove" }),
  ];
  assert.deepEqual(countQueueFilters(pending), {
    all: 4,
    needs_you: 1,
    create: 1,
    update: 1,
    remove: 1,
  });
  const resolved = pending.map((item) =>
    item.id === "a" ? card({ id: "a", readiness: "ready", operation: "update" }) : item,
  );
  assert.equal(countQueueFilters(resolved).needs_you, 0);
  assert.equal(countQueueFilters(resolved).update, 2);
}

function testPersistenceFailureIsNotFullSuccess() {
  assert.equal(
    reviewApplyAnnouncement({
      requested: 2,
      succeeded: 2,
      failed: 0,
      reconcileFailed: false,
    }),
    "Applied",
  );
  assert.equal(
    reviewApplyAnnouncement({
      requested: 2,
      succeeded: 1,
      failed: 1,
      reconcileFailed: false,
    }),
    "Saved 1 of 2. The rest were not applied.",
  );
  assert.notEqual(
    reviewApplyAnnouncement({
      requested: 2,
      succeeded: 1,
      failed: 1,
      reconcileFailed: false,
    }),
    "Applied",
  );
  assert.equal(
    reviewApplyAnnouncement({
      requested: 1,
      succeeded: 1,
      failed: 0,
      reconcileFailed: true,
    }),
    "Applied — refreshing saved project information…",
  );
  assert.equal(
    reviewApplyAnnouncement({
      requested: 1,
      succeeded: 0,
      failed: 1,
      reconcileFailed: false,
    }),
    "Could not apply these changes.",
  );
}

function testEditStagesTextAndUndoRemovalIsNotARestore() {
  const created = suggestion({
    id: "c",
    op: "create",
    content: "Print the map",
    proposedValues: { title: "Print the map" },
  });
  const edited = stageProposalText(created, "Print the track map");
  assert.equal(edited.content, "Print the track map");
  assert.equal(edited.proposedValues?.title, "Print the track map");
  assert.equal(proposalEditTarget(created), "content");

  const updated = suggestion({
    id: "u",
    op: "update",
    content: "Owner change",
    proposedValues: { owner: "Pippa" },
  });
  const next = stageProposalText(updated, "Fizz", "Pippa");
  assert.equal(next.proposedValues?.owner, "Fizz");
  assert.equal(next.content, "Fizz");

  const removal = suggestion({
    id: "r",
    op: "remove",
    content: "Old risk",
    proposedValues: { title: "Old risk" },
  });
  const unchanged = stageProposalText(removal, "Restored risk");
  assert.equal(unchanged, removal);
  assert.equal(proposalEditTarget(removal), null);
}

function main() {
  testUnresolvedNeedsYouBlocksTheWholeReview();
  console.log("✓ unresolved Needs You blocks review-wide Apply");
  testExcludedNeedsYouDoesNotBlock();
  console.log("✓ excluded Needs You does not block");
  testLeftUntouchedDoesNotBlock();
  console.log("✓ Left untouched does not block");
  testDestructiveRemoveConfirmDoesNotCountAsNeedsYou();
  console.log("✓ destructive remove confirm stays a Remove");
  testResolvingRecalculatesTheExistingReadySet();
  console.log("✓ resolving recalculates the ready set");
  testDiscardPreservesAppliedHistory();
  console.log("✓ discard status preserves applied history");
  testFilterCounts();
  console.log("✓ filter counts follow the review family");
  testPersistenceFailureIsNotFullSuccess();
  console.log("✓ partial persistence is not announced as Applied");
  testEditStagesTextAndUndoRemovalIsNotARestore();
  console.log("✓ edit stages proposal text and removal is not restored");
  console.log("verify-review-batch: OK");
}

main();
