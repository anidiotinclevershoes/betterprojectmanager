/**
 * Deterministic Needs Review reason — drives correction controls.
 * Presentation-only; no AI calls.
 */

import type {
  CaptureFinding,
  FindingCoverageItem,
  ProposedOperation,
} from "@/lib/capture/findings";
import type { PendingSuggestion } from "@/lib/capture/suggestions";

export type ReviewReason =
  | "TARGET_UNCERTAIN"
  | "ENTITY_TYPE_UNCERTAIN"
  | "STATE_UNCERTAIN"
  | "OPERATION_UNCERTAIN"
  | "VALUE_UNCERTAIN";

export function deriveReviewReason(args: {
  readiness: "ready" | "needs_review" | "unmatched";
  finding?: CaptureFinding;
  operation?: ProposedOperation;
  coverage?: FindingCoverageItem;
  suggestion?: PendingSuggestion;
  needsReviewReason?: string;
}): ReviewReason | undefined {
  const { readiness, finding, operation, coverage, suggestion, needsReviewReason } =
    args;
  if (readiness === "ready") return undefined;

  if (readiness === "unmatched") return "TARGET_UNCERTAIN";

  const blob = [
    coverage?.reason,
    finding?.clarificationQuestion,
    finding?.validationWarning,
    needsReviewReason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    finding?.invalidTarget ||
    /which existing|couldn'?t confidently identify|could not (identify|match)|unmatched|which record|target/i.test(
      blob,
    )
  ) {
    return "TARGET_UNCERTAIN";
  }

  if (
    /entity type|interpreted this as|what kind|todo or risk|type of (item|record)/i.test(
      blob,
    ) ||
    (finding?.findingType === "NEW_INFORMATION" &&
      !finding.target?.entityType &&
      !finding.changes?.entityType)
  ) {
    return "ENTITY_TYPE_UNCERTAIN";
  }

  const isStateOp =
    suggestion?.op === "complete" ||
    operation?.operation === "COMPLETE" ||
    finding?.findingType === "ENTITY_COMPLETED" ||
    finding?.findingType === "ENTITY_REOPENED" ||
    finding?.findingType === "ENTITY_BLOCKED";

  if (
    isStateOp &&
    (/resolved|complete|open|blocked|status|state|keep open/i.test(blob) ||
      finding?.requiresClarification)
  ) {
    return "STATE_UNCERTAIN";
  }

  if (
    /operation|inconsistent|destructive|archive|delete|safe single operation/i.test(
      blob,
    ) ||
    operation?.destructive
  ) {
    return "OPERATION_UNCERTAIN";
  }

  if (
    /confidence|value|date|owner|due|proposed|which value/i.test(blob) ||
    (typeof (operation?.confidence ?? finding?.confidence) === "number" &&
      (operation?.confidence ?? finding?.confidence)! < 70)
  ) {
    return "VALUE_UNCERTAIN";
  }

  if (finding?.findingType === "AMBIGUOUS") {
    return finding.target?.entityId ? "OPERATION_UNCERTAIN" : "TARGET_UNCERTAIN";
  }

  // Default for needs_review: prefer target when no confident id, else operation.
  if (!finding?.target?.entityId && suggestion?.op !== "create") {
    return "TARGET_UNCERTAIN";
  }
  return "OPERATION_UNCERTAIN";
}

export function reviewReasonCopy(
  reason: ReviewReason,
  opts?: {
    recordName?: string;
    entityLabel?: string;
  },
): string {
  switch (reason) {
    case "TARGET_UNCERTAIN":
      return opts?.recordName
        ? `Lume thinks this refers to:\n${opts.recordName}`
        : "Lume couldn't confidently identify which existing record this refers to.";
    case "ENTITY_TYPE_UNCERTAIN":
      return opts?.entityLabel
        ? `Lume interpreted this as:\n${opts.entityLabel}`
        : "Lume isn't sure which type of item this should be.";
    case "STATE_UNCERTAIN":
      return opts?.entityLabel === "Risk"
        ? "Lume isn't sure whether this Risk is resolved."
        : "Lume isn't sure about the resulting state for this item.";
    case "OPERATION_UNCERTAIN":
      return "Lume needs confirmation before applying this change.";
    case "VALUE_UNCERTAIN":
      return "Lume isn't sure about the proposed value.";
  }
}
