"use client";

export function CaptureSummary({
  observations,
  changesDetected,
  readyCount,
  needsAttentionCount,
}: {
  observations: string[];
  /** Unique validated project-state changes. */
  changesDetected: number;
  readyCount: number;
  /** Needs Review + Unmatched. */
  needsAttentionCount: number;
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
          {observations.map((obs) => (
            <li key={obs}>
              <span className="capture-observation-check" aria-hidden>
                ✓
              </span>
              <span>{obs}</span>
            </li>
          ))}
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
