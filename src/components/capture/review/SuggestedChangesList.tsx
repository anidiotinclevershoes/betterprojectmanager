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
  whyOpenIds,
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
  /** Optional: open Why panels for these ids on first render. */
  whyOpenIds?: string[];
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
        <div className="capture-changes-head-main">
          <h3 id="capture-changes-title" className="capture-review-section-title">
            Review Changes
          </h3>
          <p className="capture-review-progress" role="status">
            Reviewed {reviewedCount} of {totalCount}
          </p>
        </div>
        <div className="capture-changes-counts" aria-label="Review counts">
          <span className="capture-count-inline">
            Ready <strong>{readyCount}</strong>
          </span>
          <span className="capture-count-sep" aria-hidden>
            ·
          </span>
          <span className="capture-count-inline">
            Needs Review <strong>{needsReviewCount}</strong>
          </span>
          {readyCount > 0 ? (
            <button
              type="button"
              className="ghost-btn capture-apply-ready-btn"
              onClick={onApproveReady}
              aria-label={`Apply Ready (${readyCount})`}
            >
              Apply Ready ({readyCount})
            </button>
          ) : null}
        </div>
      </div>

      {totalCount === 0 ? (
        <p className="empty-copy">No changes to review.</p>
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
              initialWhyOpen={whyOpenIds?.includes(model.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
