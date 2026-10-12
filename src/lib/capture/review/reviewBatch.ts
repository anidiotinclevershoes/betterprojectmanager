/**
 * Review-wide Apply and Discard policy.
 * Ready items still come from pendingReadyModels. This module only
 * decides whether that existing queue may run, and how a discarded
 * review is labelled. It does not write canonical project data.
 */
import type { PendingSuggestion } from "@/lib/capture/suggestions";
import { pendingReadyModels } from "./counts";
import { reviewOpFamily } from "./reviewLanguage";
import type { ReviewChangeViewModel } from "./viewModel";

const EDITABLE_PROPOSED_KEYS = [
  "title",
  "name",
  "label",
  "text",
  "owner",
  "assignee",
  "status",
  "notes",
  "detail",
] as const;

export function reviewFamily(model: ReviewChangeViewModel) {
  const attention =
    model.readiness === "needs_review" ||
    model.readiness === "unmatched" ||
    model.readiness === "left_untouched"
      ? model.readiness
      : undefined;
  return reviewOpFamily(model.operation, attention, model.reviewReason);
}

/** Included Needs You items. Excluded and already applied items do not count. */
export function unresolvedIncludedNeedsYou(
  models: ReviewChangeViewModel[],
  added: Record<string, boolean>,
  dismissed: Record<string, boolean>,
): ReviewChangeViewModel[] {
  return models.filter((model) => {
    if (added[model.id] || dismissed[model.id]) return false;
    return reviewFamily(model) === "needs_you";
  });
}

export function reviewApplyGate(
  models: ReviewChangeViewModel[],
  added: Record<string, boolean>,
  dismissed: Record<string, boolean>,
) {
  const unresolved = unresolvedIncludedNeedsYou(models, added, dismissed);
  return {
    blocked: unresolved.length > 0,
    unresolvedNeedsYou: unresolved.length,
    ready: pendingReadyModels(models, added, dismissed),
  };
}

export function countQueueFilters(pending: ReviewChangeViewModel[]) {
  const families = pending.map(reviewFamily);
  return {
    all: pending.length,
    needs_you: families.filter((family) => family === "needs_you").length,
    create: families.filter((family) => family === "create").length,
    update: families.filter((family) => family === "update").length,
    remove: families.filter((family) => family === "remove").length,
  };
}

/**
 * Batch announcement. A partial save must not be described as a clean
 * Apply of the whole review. Successful writes are not rolled back.
 */
export function reviewApplyAnnouncement(input: {
  requested: number;
  succeeded: number;
  failed: number;
  reconcileFailed: boolean;
}): string {
  if (input.reconcileFailed && input.succeeded > 0) {
    return "Applied — refreshing saved project information…";
  }
  if (
    input.succeeded > 0 &&
    (input.failed > 0 || input.succeeded < input.requested)
  ) {
    return `Saved ${input.succeeded} of ${input.requested}. The rest were not applied.`;
  }
  if (
    input.failed === 0 &&
    input.succeeded === input.requested &&
    input.requested > 0
  ) {
    return "Applied";
  }
  return "Could not apply these changes.";
}

/** Edit is offered only when the staged text is a field Apply already reads. */
export function proposalEditTarget(
  item: PendingSuggestion,
  displayedTo?: string,
): "content" | "proposed" | null {
  if (
    item.op === "remove" ||
    item.op === "archive" ||
    item.op === "delete" ||
    item.op === "complete"
  ) {
    return null;
  }
  if (item.op === "create") return "content";
  const values = item.proposedValues ?? {};
  const displayed = displayedTo?.trim();
  if (displayed && Object.values(values).some((value) => value === displayed)) {
    return "proposed";
  }
  if (
    Object.values(values).some(
      (value) => typeof value === "string" && value === item.content,
    )
  ) {
    return "proposed";
  }
  if (
    EDITABLE_PROPOSED_KEYS.some(
      (key) => typeof values[key] === "string" && String(values[key]).trim(),
    )
  ) {
    return "proposed";
  }
  return null;
}

/**
 * Stage a reviewed proposal. Remove stays a removal proposal — editing
 * it does not restore a record. Apply still revalidates the result.
 */
export function stageProposalText(
  item: PendingSuggestion,
  nextText: string,
  displayedTo?: string,
): PendingSuggestion {
  const trimmed = nextText.trim();
  if (!trimmed || proposalEditTarget(item, displayedTo) == null) return item;
  const values = { ...(item.proposedValues ?? {}) };
  if (item.op === "create") {
    let wrote = false;
    for (const key of ["title", "name", "label", "text"] as const) {
      if (typeof values[key] === "string" && values[key]) {
        values[key] = trimmed;
        wrote = true;
      }
    }
    return {
      ...item,
      content: trimmed,
      proposedValues: wrote ? values : item.proposedValues,
    };
  }
  const displayed = displayedTo?.trim();
  const matchDisplayed = displayed
    ? Object.keys(values).find((key) => values[key] === displayed)
    : undefined;
  const matchContent = Object.keys(values).find(
    (key) => typeof values[key] === "string" && values[key] === item.content,
  );
  const fallback = EDITABLE_PROPOSED_KEYS.find(
    (key) => typeof values[key] === "string" && String(values[key]).trim(),
  );
  const key = matchDisplayed ?? matchContent ?? fallback;
  if (key) values[key] = trimmed;
  return {
    ...item,
    content: trimmed,
    proposedValues: key ? values : item.proposedValues,
  };
}
