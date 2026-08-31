"use client";

import {
  isGenericInterpretation,
  whyDisclosureLabel,
  whyHasUsefulContent,
} from "@/lib/capture/review/reviewLanguage";

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
  if (!whyHasUsefulContent(evidence, interpretation)) return null;

  const label = whyDisclosureLabel(evidence, interpretation);
  const excerpts = evidence.filter((e) => e.trim());

  return (
    <div className="why-panel">
      <button
        type="button"
        className="lume-review-why-toggle"
        aria-expanded={open}
        aria-controls={controlId}
        onClick={onToggle}
      >
        <span
          className={`lume-review-why-chevron${open ? " is-open" : ""}`}
          aria-hidden
        />
        {label}
      </button>
      {open ? (
        <div
          id={controlId}
          className="why-panel-body"
          role="region"
          aria-label={label}
        >
          {excerpts.length > 0 ? (
            <div className="why-panel-block">
              {label !== "Evidence" ? (
                <p className="why-panel-label">Evidence</p>
              ) : null}
              {excerpts.map((ex) => (
                <blockquote key={ex} className="why-panel-evidence">
                  “{ex}”
                </blockquote>
              ))}
            </div>
          ) : null}
          {interpretation && !isGenericInterpretation(interpretation) ? (
            <div className="why-panel-block">
              <p className="why-panel-copy">{interpretation}</p>
            </div>
          ) : null}
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
