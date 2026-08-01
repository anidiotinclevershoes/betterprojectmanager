"use client";

import { CaptureReliabilityNotice } from "@/components/capture/CaptureReliabilityNotice";
import type { CaptureReliabilityAssessment } from "@/lib/capture/reliability";

const PRE: CaptureReliabilityAssessment = {
  state: "review_recommended",
  title: "Long capture",
  body: "This input is larger than usual (6,240 measured tokens). Lume can analyse it, but important details may be easier to review if you split it into sections.",
  triggers: [
    {
      id: "length",
      label: "Capture length",
      detail: "6,240 measured tokens",
    },
  ],
  signals: {
    stage: "pre",
    inputTokens: 6240,
    inputTokensMeasured: true,
    inputCharacters: 24960,
    transcriptionIncomplete: false,
    willTruncate: false,
  },
  triggeredRules: ["warning_token_count"],
};

const POST: CaptureReliabilityAssessment = {
  state: "review_recommended",
  title: "Review recommended",
  body: "This Capture included conflicting or ambiguous statements. The extracted facts may still be useful, but review each suggested change carefully.",
  triggers: [
    {
      id: "clarification",
      label: "Findings requiring clarification",
      detail: "3 of 7 findings require clarification",
    },
    {
      id: "invalid_targets",
      label: "Unmatched targets",
      detail: "1 target record could not be matched",
    },
  ],
  signals: {
    stage: "post",
    inputTokens: 1820,
    inputTokensMeasured: true,
    inputCharacters: 7280,
    truncated: false,
    excludedByLimitCount: 0,
    limitsReachedCount: 0,
    findingsCount: 7,
    ambiguousFindings: 3,
    clarificationCount: 3,
    invalidTargetCount: 1,
    validationErrors: 0,
    validationOk: true,
    operationsCount: 2,
    transcriptionIncomplete: false,
  },
  triggeredRules: ["clarification_ratio", "invalid_targets"],
};

export function ReliabilityPreviewClient() {
  return (
    <div className="golden-page" style={{ maxWidth: 720 }}>
      <header className="golden-hero">
        <div className="golden-hero-copy">
          <p className="eyebrow">Development only</p>
          <h1>Reliability notice preview</h1>
          <p className="meta">
            Calm Capture reliability states for visual review. Not a live Capture
            run.
          </p>
        </div>
      </header>

      <section className="golden-panel">
        <h2>Before analysis</h2>
        <CaptureReliabilityNotice
          assessment={PRE}
          stage="pre"
          onAnalyseAnyway={() => undefined}
          showDevDetails
        />
      </section>

      <section className="golden-panel">
        <h2>After analysis</h2>
        <CaptureReliabilityNotice
          assessment={POST}
          stage="post"
          onEditCapture={() => undefined}
          onAnalyseAgain={() => undefined}
          showDevDetails
        />
      </section>
    </div>
  );
}
