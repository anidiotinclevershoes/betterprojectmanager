"use client";

import { DomainMark } from "./DomainMark";
import type { SuggestionKind, SuggestionOp } from "@/lib/capture/suggestions";
import {
  reviewOpFamily,
  reviewOpGlyph,
  reviewOpWord,
  type ReviewOpFamily,
} from "@/lib/capture/review/reviewLanguage";

export function OperationKicker({
  family,
  operation,
  entityKind,
  entityLabel,
}: {
  family: ReviewOpFamily;
  operation: SuggestionOp;
  entityKind: SuggestionKind;
  entityLabel: string;
}) {
  const word = family === "needs_you" ? "Needs You" : reviewOpWord(operation);
  const glyph = reviewOpGlyph(family, operation);
  return (
    <p className="lume-review-kicker">
      <DomainMark kind={entityKind} title={entityLabel} />
      <span className="lume-review-kicker-op">
        {glyph ? (
          <span className="lume-review-kicker-glyph" aria-hidden>
            {glyph}
          </span>
        ) : null}
        {word}
      </span>
      <span className="lume-review-kicker-sep" aria-hidden>
        ·
      </span>
      <span className="lume-review-kicker-domain">{entityLabel}</span>
    </p>
  );
}

/** @deprecated Prefer OperationKicker — kept so existing review exports stay stable. */
export function ReviewBadge({
  operation,
}: {
  operation: SuggestionOp;
  tone?: "default" | "ready" | "review" | "muted";
}) {
  return (
    <OperationKicker
      family={reviewOpFamily(operation)}
      operation={operation}
      entityKind="action"
      entityLabel="To Do"
    />
  );
}

/** @deprecated Needs You now lives in the kicker. */
export function ReadinessBadge({
  readiness,
}: {
  readiness: "ready" | "needs_review" | "unmatched";
}) {
  if (readiness === "ready") return null;
  return (
    <OperationKicker
      family="needs_you"
      operation="update"
      entityKind="action"
      entityLabel="To Do"
    />
  );
}
