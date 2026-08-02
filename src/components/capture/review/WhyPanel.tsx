"use client";

export function WhyPanel({
  open,
  onToggle,
  evidence,
  interpretation,
  confidence,
  controlId,
}: {
  open: boolean;
  onToggle: () => void;
  evidence: string[];
  interpretation: string;
  confidence: number | null;
  controlId: string;
}) {
  return (
    <div className="why-panel">
      <button
        type="button"
        className="why-panel-toggle"
        aria-expanded={open}
        aria-controls={controlId}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span aria-hidden>{open ? "▲" : "▼"}</span> Why?
      </button>
      {open ? (
        <div id={controlId} className="why-panel-body" role="region" aria-label="Why this change">
          {evidence.length > 0 ? (
            <div className="why-panel-block">
              <p className="why-panel-label">Evidence</p>
              {evidence.map((ex) => (
                <blockquote key={ex} className="why-panel-evidence">
                  “{ex}”
                </blockquote>
              ))}
            </div>
          ) : null}
          <div className="why-panel-block">
            <p className="why-panel-label">Interpretation</p>
            <p className="why-panel-copy">{interpretation}</p>
          </div>
          {confidence != null ? (
            <div className="why-panel-block">
              <p className="why-panel-label">Confidence</p>
              <p className="why-panel-confidence">{Math.round(confidence)}%</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
