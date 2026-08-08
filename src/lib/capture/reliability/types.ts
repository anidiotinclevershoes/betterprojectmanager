export type CaptureReliabilityState =
  | "normal"
  | "review_recommended"
  | "limited";

export type ReliabilityTrigger = {
  id: string;
  label: string;
  /** Factual measured value for “Why am I seeing this?” */
  detail: string;
};

export type PreAnalysisReliabilitySignals = {
  stage: "pre";
  /** Measured when tokenizer available; else character-proxy estimate. */
  inputTokens: number;
  inputTokensMeasured: boolean;
  inputCharacters: number;
  /** True when an existing provider flagged the transcript incomplete. */
  transcriptionIncomplete: boolean;
  /** Context budget will truncate (known from prior context build, optional). */
  willTruncate: boolean;
};

export type PostAnalysisReliabilitySignals = {
  stage: "post";
  inputTokens: number;
  inputTokensMeasured: boolean;
  inputCharacters: number;
  truncated: boolean;
  excludedByLimitCount: number;
  limitsReachedCount: number;
  findingsCount: number;
  ambiguousFindings: number;
  clarificationCount: number;
  invalidTargetCount: number;
  /** Coverage: actionable findings needing review or unmatched. */
  coverageNeedsAttention: number;
  coverageUnmatched: number;
  validationErrors: number;
  validationOk: boolean;
  operationsCount: number;
  transcriptionIncomplete: boolean;
};

export type CaptureReliabilityAssessment = {
  state: CaptureReliabilityState;
  title: string;
  body: string;
  triggers: ReliabilityTrigger[];
  signals: PreAnalysisReliabilitySignals | PostAnalysisReliabilitySignals;
  /** Rules that fired (dev / Cockpit). */
  triggeredRules: string[];
};

export type CaptureReliabilityAssessmentJson = CaptureReliabilityAssessment;
