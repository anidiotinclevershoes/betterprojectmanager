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
  /** Needs you + Unmatched. */
  needsAttentionCount: number;
  onSelectObservation?: (observation: CaptureObservation) => void;
}) {
  return (
    <section className="capture-summary-panel lume-extracted-rail" aria-labelledby="capture-understood-title">
      <h3 id="capture-understood-title" className="lume-rail-title">
        Lume extracted
      </h3>

      {observations.length === 0 ? (
        <p className="meta" data-testid="capture-empty-review">
          Lume could not turn this Capture into a safe change. Nothing was
          written. This is Needs You, not a silent skip.
        </p>
      ) : (
        <ul className="capture-observation-list">
          {observations.map((obs) => {
            const clickable = Boolean(obs.reviewCardId && onSelectObservation);
            const statusClass = `is-status-${obs.actionStatus}`;
            const content = (
              <>
                <span className="capture-observation-main">
                  <span
                    className={`capture-observation-check ${statusClass}`}
                    aria-hidden
                  >
                    {obs.actionStatus === "needs_review" ||
                    obs.actionStatus === "unmatched"
                      ? "⚠"
                      : "✓"}
                  </span>
                  <span className="capture-observation-text">{obs.text}</span>
                </span>
                {obs.actionStatus === "no_change" ? null : (
                <span
                  className={`capture-observation-action ${statusClass}${
                    obs.actionLabel.startsWith("Remember")
                      ? " is-remember"
                      : ""
                  }${
                    obs.actionLabel.includes("Which project")
                      ? " is-project-uncertain"
                      : ""
                  }`}
                  title={obs.actionLabel}
                >
                  {obs.actionLabel}
                </span>
                )}
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
          {changesDetected} change{changesDetected === 1 ? "" : "s"}
        </span>
        <span aria-hidden>·</span>
        <span>{readyCount} ready</span>
        <span aria-hidden>·</span>
        <span>
          {needsAttentionCount} need{needsAttentionCount === 1 ? "s" : ""} you
        </span>
      </p>
    </section>
  );
}
