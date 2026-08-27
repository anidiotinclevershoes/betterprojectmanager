"use client";

export function WhyPanel({
  open,
  onToggle,
  evidence,
  interpretation,
  controlId,
}: {
  open: boolean;
  onToggle: () => void;
  evidence: string[];
  interpretation: string;
  /** Informational only — not shown. Kept so callers need not change. */
  confidence?: number | null;
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
      >
        <span aria-hidden>{open ? "▲" : "▼"}</span> Why?
      </button>
      {open ? (
        <div id={controlId} className="why-panel-body" role="region" aria-label="Why this change">
          {evidence.length > 0 ? (
            <div className="why-panel-block">
              <p className="why-panel-label">From your notes</p>
              {evidence.map((ex) => (
                <blockquote key={ex} className="why-panel-evidence">
                  “{ex}”
                </blockquote>
              ))}
            </div>
          ) : null}
          {interpretation ? (
            <div className="why-panel-block">
              <p className="why-panel-copy">{interpretation}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
