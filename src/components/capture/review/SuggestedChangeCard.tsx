"use client";

import { useId, useState } from "react";
import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import { CompactChangeCard } from "./CompactChangeCard";
import { WhyPanel } from "./WhyPanel";

export function SuggestedChangeCard({
  model,
  state = "pending",
  onApprove,
  onDismiss,
  onKeepOpen,
  initialWhyOpen = false,
}: {
  model: ReviewChangeViewModel;
  state?: "pending" | "approved" | "dismissed";
  onApprove: () => void;
  onDismiss: () => void;
  /** Needs-review / unmatched: dismiss without applying. */
  onKeepOpen?: () => void;
  /** Optional initial Why panel state (e.g. preview/demo). */
  initialWhyOpen?: boolean;
}) {
  const [whyOpen, setWhyOpen] = useState(initialWhyOpen);
  const whyId = useId();
  const needsReview = model.readiness === "needs_review";
  const unmatched = model.readiness === "unmatched";
  const attentionReadiness =
    state === "pending" && (needsReview || unmatched)
      ? (model.readiness as "needs_review" | "unmatched")
      : undefined;

  return (
    <li className="suggested-change-item">
      <CompactChangeCard
        entityKind={model.entityKind}
        entityLabel={model.entityLabel}
        recordName={model.recordName}
        operation={model.operation}
        diff={model.diff}
        readiness={attentionReadiness}
        state={state}
        why={
          <WhyPanel
            open={whyOpen}
            onToggle={() => setWhyOpen((v) => !v)}
            evidence={model.evidence}
            interpretation={model.interpretation}
            confidence={model.confidence}
            controlId={whyId}
          />
        }
        actions={
          state === "pending" ? (
            <>
              {attentionReadiness && model.needsReviewReason ? (
                <p className="compact-change-review-copy">
                  {model.needsReviewReason}
                </p>
              ) : null}
              <div className="compact-change-action-row">
                {unmatched ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={onDismiss}
                  >
                    Dismiss
                  </button>
                ) : (
                  <>
                    {needsReview && onKeepOpen ? (
                      <button
                        type="button"
                        className="muted-btn"
                        onClick={onKeepOpen}
                      >
                        Keep Open
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={onApprove}
                    >
                      {needsReview &&
                      model.entityKind === "risk" &&
                      (model.operation === "complete" ||
                        model.operation === "update")
                        ? "Resolve Risk"
                        : "Approve"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={onDismiss}
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="meta compact-change-status-label" aria-live="polite">
              {state === "approved" ? "Approved" : "Dismissed"}
            </p>
          )
        }
      />
    </li>
  );
}
