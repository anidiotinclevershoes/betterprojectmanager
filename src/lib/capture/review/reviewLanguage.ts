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

/** Extra Needs You detail that is not just the headline or record restated. */
export function needsYouSupporting(
  headline: string,
  reasonCopy: string | undefined,
  recordName?: string,
): string | null {
  if (!reasonCopy?.trim()) return null;
  const lines = reasonCopy
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const noise = [
    headline,
    recordName,
    /^lume thinks this refers to:?$/i,
    /^lume isn'?t sure/i,
    /^destructive action/i,
  ];

  const kept = lines.filter((line) => {
    const lower = line.toLowerCase();
    for (const rule of noise) {
      if (typeof rule === "string") {
        if (rule && lower === rule.toLowerCase()) return false;
      } else if (rule.test(line)) {
        return false;
      }
    }
    return true;
  });

  if (kept.length === 0) return null;
  const compact = kept.join("\n");
  if (compact.toLowerCase() === headline.toLowerCase()) return null;
  return compact;
}
