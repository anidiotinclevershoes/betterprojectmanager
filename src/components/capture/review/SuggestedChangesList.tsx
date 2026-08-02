"use client";

import type { ReviewChangeViewModel } from "@/lib/capture/review/viewModel";
import { SuggestedChangeCard } from "./SuggestedChangeCard";

export function SuggestedChangesList({
  models,
  added,
  dismissed,
  readyCount,
  needsReviewCount,
  reviewedCount,
  totalCount,
  onApprove,
  onDismiss,
  onApproveReady,
}: {
  models: ReviewChangeViewModel[];
  added: Record<string, boolean>;
  dismissed: Record<string, boolean>;
  readyCount: number;
  needsReviewCount: number;
  reviewedCount: number;
  totalCount: number;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
  onApproveReady: () => void;
}) {
  const pending = models.filter((m) => !added[m.id] && !dismissed[m.id]);
  const reviewed = models.filter((m) => added[m.id] || dismissed[m.id]);
  // Needs-review first (attention), then ready, then muted reviewed items.
  const ordered = [
    ...pending.filter((m) => m.readiness === "needs_review"),
    ...pending.filter((m) => m.readiness === "ready"),
    ...reviewed,
  ];

  return (
    <section
      className="capture-changes-panel"
      aria-labelledby="capture-changes-title"
    >
      <div className="capture-changes-head">
        <div>
          <h3 id="capture-changes-title" className="capture-review-section-title">
            Suggested Changes
          </h3>
          <p className="capture-review-progress" role="status">
            Reviewed {reviewedCount} of {totalCount}
          </p>
        </div>
        <div className="capture-changes-counts" aria-label="Review counts">
          <span className="capture-count-chip is-ready">
            <span className="capture-count-label">Ready</span>
            <strong>{readyCount}</strong>
          </span>
          <span className="capture-count-chip is-review">
            <span className="capture-count-label">Needs Review</span>
            <strong>{needsReviewCount}</strong>
          </span>
        </div>
      </div>

      {readyCount > 0 ? (
        <div className="capture-bulk-bar">
          <button
            type="button"
            className="primary-btn"
            onClick={onApproveReady}
          >
            Approve Ready
          </button>
          <span className="meta">
            Approves {readyCount} ready item{readyCount === 1 ? "" : "s"}. Needs
            Review stays.
          </span>
        </div>
      ) : null}

      {totalCount === 0 ? (
        <p className="empty-copy">No suggested changes.</p>
      ) : (
        <ul className="suggested-change-list">
          {ordered.map((model) => (
            <SuggestedChangeCard
              key={model.id}
              model={model}
              state={
                added[model.id]
                  ? "approved"
                  : dismissed[model.id]
                    ? "dismissed"
                    : "pending"
              }
              onApprove={() => onApprove(model.id)}
              onDismiss={() => onDismiss(model.id)}
              onKeepOpen={
                model.readiness === "needs_review"
                  ? () => onDismiss(model.id)
                  : undefined
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
