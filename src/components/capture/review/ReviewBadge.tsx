"use client";

import type { SuggestionOp } from "@/lib/capture/suggestions";
import { OP_LABEL } from "@/lib/capture/suggestions";

const OP_ICON: Record<SuggestionOp, string> = {
  create: "+",
  update: "↻",
  complete: "✓",
  archive: "▣",
  delete: "×",
  remove: "×",
};

export function ReviewBadge({
  operation,
  tone = "default",
}: {
  operation: SuggestionOp;
  tone?: "default" | "ready" | "review" | "muted";
}) {
  return (
    <span className={`review-badge review-badge-${tone} review-badge-op-${operation}`}>
      <span className="review-badge-ico" aria-hidden>
        {OP_ICON[operation]}
      </span>
      <span>{OP_LABEL[operation]}</span>
    </span>
  );
}

export function ReadinessBadge({
  readiness,
}: {
  readiness: "ready" | "needs_review" | "unmatched";
}) {
  if (readiness === "unmatched") {
    return (
      <span className="review-badge review-badge-unmatched">
        <span className="review-badge-ico" aria-hidden>
          ?
        </span>
        <span>Unmatched</span>
      </span>
    );
  }
  if (readiness === "needs_review") {
    return (
      <span className="review-badge review-badge-review">
        <span className="review-badge-ico" aria-hidden>
          ⚠
        </span>
        <span>Needs you</span>
      </span>
    );
  }
  return (
    <span className="review-badge review-badge-ready">
      <span className="review-badge-ico" aria-hidden>
        ✓
      </span>
      <span>Ready</span>
    </span>
  );
}
