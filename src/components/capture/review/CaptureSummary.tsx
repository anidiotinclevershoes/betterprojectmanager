"use client";

import type { CaptureObservation } from "@/lib/capture/review/observations";

export function CaptureSummary({
  observations,
  changesDetected,
  readyCount,
  needsAttentionCount,
  onSelectObservation,
}: {
  observations: CaptureObservation[];
  /** Unique validated project-state changes. */
  changesDetected: number;
  readyCount: number;
  /** Needs Review + Unmatched. */
  needsAttentionCount: number;
  onSelectObservation?: (observation: CaptureObservation) => void;
}) {
  return (
    <section className="capture-summary-panel" aria-labelledby="capture-understood-title">
      <h3 id="capture-understood-title" className="capture-review-section-title">
        What Lume Understood
      </h3>

      {observations.length === 0 ? (
        <p className="meta">No clear project observations extracted.</p>
      ) : (
        <ul className="capture-observation-list">
          {observations.map((obs) => {
            const clickable = Boolean(obs.reviewCardId && onSelectObservation);
            const statusClass = `is-status-${obs.actionStatus}`;
            const content = (
              <>
                <span className="capture-observation-main">
                  <span className="capture-observation-check" aria-hidden>
                    ✓
                  </span>
                  <span className="capture-observation-text">{obs.text}</span>
                </span>
                <span
                  className={`capture-observation-action ${statusClass}`}
                  title={obs.actionLabel}
                >
                  {obs.actionLabel}
                </span>
              </>
            );
            return (
              <li key={obs.id} className="capture-observation-item">
                {clickable ? (
                  <button
                    type="button"
                    className="capture-observation-row is-clickable"
                    onClick={() => onSelectObservation?.(obs)}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="capture-observation-row">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="capture-summary-line" role="status">
        <span>
          {changesDetected} project change{changesDetected === 1 ? "" : "s"}{" "}
          detected
        </span>
        <span aria-hidden>·</span>
        <span>{readyCount} ready</span>
        <span aria-hidden>·</span>
        <span>
          {needsAttentionCount} need{needsAttentionCount === 1 ? "s" : ""}{" "}
          attention
        </span>
      </p>
    </section>
  );
}
