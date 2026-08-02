"use client";

import { useId, useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import { CompactChangeCard } from "./CompactChangeCard";
import { ReadinessBadge } from "./ReviewBadge";
import { WhyPanel } from "./WhyPanel";

export function SuggestedChangeCard({
  model,
  state = "pending",
  onApprove,
  onDismiss,
  onKeepOpen,
}: {
  model: ReviewChangeViewModel;
  state?: "pending" | "approved" | "dismissed";
  onApprove: () => void;
  onDismiss: () => void;
  /** Needs-review only: explicitly keep without applying. */
  onKeepOpen?: () => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const whyId = useId();
  const needsReview = model.readiness === "needs_review";
  const disabled = state !== "pending";

  return (
    <li className="suggested-change-item">
      <CompactChangeCard
        entityKind={model.entityKind}
        entityLabel={model.entityLabel}
        recordName={model.recordName}
        operation={model.operation}
        diff={model.diff}
        emphasized={needsReview && state === "pending"}
        state={state}
        actions={
          <>
            {needsReview && state === "pending" ? (
              <div className="compact-change-review-note">
                <ReadinessBadge readiness="needs_review" />
                {model.needsReviewReason ? (
                  <p className="compact-change-review-copy">
                    {model.needsReviewReason}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="compact-change-action-row">
              {needsReview && onKeepOpen ? (
                <button
                  type="button"
                  className="muted-btn"
                  disabled={disabled}
                  onClick={onKeepOpen}
                >
                  Keep Open
                </button>
              ) : null}
              <button
                type="button"
                className="primary-btn"
                disabled={disabled}
                onClick={onApprove}
              >
                {needsReview &&
                model.entityKind === "risk" &&
                (model.operation === "complete" || model.operation === "update")
                  ? "Resolve Risk"
                  : "Approve"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={disabled}
                onClick={onDismiss}
              >
                Dismiss
              </button>
            </div>
          </>
        }
        footer={
          <WhyPanel
            open={whyOpen}
            onToggle={() => setWhyOpen((v) => !v)}
            evidence={model.evidence}
            interpretation={model.interpretation}
            confidence={model.confidence}
            controlId={whyId}
          />
        }
      />
    </li>
  );
}
