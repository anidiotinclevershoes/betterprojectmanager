"use client";

import { useState } from "react";
import type { CaptureReliabilityAssessment } from "@/lib/capture/reliability";

/**
 * Calm, neutral reliability notice — not an error banner.
 */
export function CaptureReliabilityNotice({
  assessment,
  stage,
  onAnalyseAnyway,
  onEditCapture,
  onAnalyseAgain,
  showDevDetails,
}: {
  assessment: CaptureReliabilityAssessment | null | undefined;
  stage: "pre" | "post";
  onAnalyseAnyway?: () => void;
  onEditCapture?: () => void;
  onAnalyseAgain?: () => void;
  showDevDetails?: boolean;
}) {
  const [openWhy, setOpenWhy] = useState(false);
  if (!assessment || assessment.state === "normal") return null;

  const isLimited = assessment.state === "limited";
  const isPreLong =
    stage === "pre" && assessment.title === "Long capture";

  return (
    <aside
      className={`capture-reliability-notice is-${assessment.state}`}
      role="status"
    >
      <div className="capture-reliability-head">
        <p className="capture-reliability-title">{assessment.title}</p>
        <p className="capture-reliability-body">{assessment.body}</p>
      </div>

      <div className="capture-reliability-actions">
        {isPreLong && onAnalyseAnyway ? (
          <button
            type="button"
            className="primary-btn"
            onClick={onAnalyseAnyway}
          >
            Analyse anyway
          </button>
        ) : null}
        {stage === "post" && isLimited ? (
          <>
            {onEditCapture ? (
              <button
                type="button"
                className="muted-btn"
                onClick={onEditCapture}
              >
                Edit Capture
              </button>
            ) : null}
            {onAnalyseAgain ? (
              <button
                type="button"
                className="muted-btn"
                onClick={onAnalyseAgain}
              >
                Analyse again
              </button>
            ) : null}
          </>
        ) : null}
        {assessment.triggers.length > 0 ? (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setOpenWhy((v) => !v)}
            aria-expanded={openWhy}
          >
            {openWhy ? "Hide details" : "Why am I seeing this?"}
          </button>
        ) : null}
      </div>

      {openWhy ? (
        <ul className="capture-reliability-triggers">
          {assessment.triggers.map((t) => (
            <li key={t.id}>
              <span>{t.label}:</span> {t.detail}
            </li>
          ))}
        </ul>
      ) : null}

      {showDevDetails ? (
        <details className="capture-reliability-dev">
          <summary>Reliability inputs (development)</summary>
          <pre>{JSON.stringify(assessment, null, 2)}</pre>
        </details>
      ) : null}
    </aside>
  );
}
