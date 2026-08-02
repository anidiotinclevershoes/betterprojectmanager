"use client";

export function CaptureSummary({
  observations,
  projectChanges,
  readyCount,
  needsReviewCount,
}: {
  observations: string[];
  projectChanges: number;
  readyCount: number;
  needsReviewCount: number;
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
          {projectChanges} project change{projectChanges === 1 ? "" : "s"}{" "}
          detected
        </span>
        <span aria-hidden>·</span>
        <span>
          {readyCount} ready to apply
        </span>
        <span aria-hidden>·</span>
        <span>
          {needsReviewCount} need{needsReviewCount === 1 ? "s" : ""} review
        </span>
      </p>
    </section>
  );
}
