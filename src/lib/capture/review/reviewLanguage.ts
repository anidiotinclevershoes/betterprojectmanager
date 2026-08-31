/**
 * Presentation language for Capture review cards.
 * Does not change extraction, readiness, or apply semantics.
 */

import type { SuggestionOp } from "@/lib/capture/suggestions";
import { OP_LABEL } from "@/lib/capture/suggestions";
import type { ReviewReason } from "./reviewReason";

export type ReviewOpFamily = "create" | "update" | "remove" | "needs_you";

export function reviewOpFamily(
  operation: SuggestionOp,
  readiness?: "ready" | "needs_review" | "unmatched" | null,
  reviewReason?: ReviewReason | null,
): ReviewOpFamily {
  const isRemove =
    operation === "remove" ||
    operation === "archive" ||
    operation === "delete";

  if (readiness === "unmatched") return "needs_you";

  if (readiness === "needs_review") {
    // Destructive confirm is still a Remove, not a missing-information ask.
    if (
      isRemove &&
      (reviewReason === "OPERATION_UNCERTAIN" || reviewReason == null)
    ) {
      return "remove";
    }
    return "needs_you";
  }

  if (operation === "create") return "create";
  if (isRemove) return "remove";
  return "update";
}

export function reviewOpWord(operation: SuggestionOp): string {
  return OP_LABEL[operation];
}

/** Decorative glyph. Empty when the word itself is the recogniser. */
export function reviewOpGlyph(
  family: ReviewOpFamily,
  operation: SuggestionOp,
): string {
  if (family === "needs_you") return "";
  if (family === "create") return "+";
  if (family === "remove") return "×";
  if (operation === "complete") return "✓";
  return "";
}

export function needsYouHeadline(
  reason: ReviewReason | undefined,
  entityLabel: string,
): string {
  switch (reason) {
    case "PROJECT_UNCERTAIN":
      return "Which project is this for?";
    case "TARGET_UNCERTAIN":
      return "Which record does this refer to?";
    case "ENTITY_TYPE_UNCERTAIN":
      return "What kind of item is this?";
    case "STATE_UNCERTAIN":
      return entityLabel === "Risk"
        ? "Is this Risk resolved?"
        : "What should happen to this item?";
    case "VALUE_UNCERTAIN":
      return "Is this proposed value right?";
    case "OPERATION_UNCERTAIN":
      return "Should Lume apply this change?";
    default:
      return "Lume needs a decision from you.";
  }
}

export function isGenericInterpretation(text: string): boolean {
  return /^Lume suggests to /i.test(text.trim());
}

export function whyHasUsefulContent(
  evidence: string[],
  interpretation: string,
): boolean {
  if (evidence.some((e) => e.trim())) return true;
  if (interpretation.trim() && !isGenericInterpretation(interpretation)) {
    return true;
  }
  return false;
}

export function whyDisclosureLabel(
  evidence: string[],
  interpretation: string,
): string {
  const hasEvidence = evidence.some((e) => e.trim());
  const hasWhy =
    Boolean(interpretation.trim()) && !isGenericInterpretation(interpretation);
  if (hasEvidence && !hasWhy) return "Evidence";
  return "Why this";
}

/** Extra Needs You detail that is not just the headline restated. */
export function needsYouSupporting(
  headline: string,
  reasonCopy: string | undefined,
): string | null {
  if (!reasonCopy?.trim()) return null;
  const compact = reasonCopy.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  if (compact.toLowerCase() === headline.toLowerCase()) return null;
  if (compact.toLowerCase().includes(headline.toLowerCase())) {
    const remainder = compact
      .replace(new RegExp(headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "")
      .replace(/^[\s:.\-—]+/, "")
      .trim();
    return remainder || null;
  }
  return reasonCopy.trim();
}
