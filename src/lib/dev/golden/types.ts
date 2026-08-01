/** Shared types for Golden Capture Test scenarios (development only). */

export type GoldenEntity =
  | "todo"
  | "risk"
  | "knowledge"
  | "stakeholder"
  | "milestone"
  | "meeting"
  | "nudge"
  | "memory";

export type GoldenOperation =
  | "create"
  | "update"
  | "complete"
  | "archive"
  | "delete"
  | "remove";

export type GoldenExpectedOutcome = {
  id: string;
  /** Preferred / exact operation for this expectation. */
  operation: GoldenOperation;
  /**
   * Narrow set of operations that yield the same canonical app state.
   * When omitted, only `operation` (+ legacy `allowedOperations`) is accepted.
   */
  acceptedOperations?: GoldenOperation[];
  /** @deprecated Prefer acceptedOperations — kept for standard scenario compat. */
  allowedOperations?: GoldenOperation[];
  entity: GoldenEntity;
  /** Existing record title / knowledge bullet to match. */
  targetTitle: string;
  /** Preferred stable fixture ID when available. */
  targetId?: string;
  /**
   * Required resulting field changes (narrow equality / inclusion check).
   * Example: `{ status: ["COMPLETED", "RESOLVED"] }` or `{ date: "19 August" }`.
   */
  expectedChanges?: Record<string, unknown>;
  /** Optional human hint for the Reasoning card. */
  reasoningHint?: {
    foundLabel: string;
    foundTitle: string;
    captureStates: string;
    recommend: string;
  };
  /** Minimum confidence (0–100). Compared when a confidence signal exists. */
  minConfidence?: number;
};

/** Operations that must not appear — used especially by hard scenarios. */
export type GoldenProhibitedOutcome = {
  id: string;
  label: string;
  operation?: GoldenOperation | GoldenOperation[];
  entity?: GoldenEntity;
  /** Loose title / detail match — any token matches (OR). */
  titleIncludes?: string[];
  /** All of these must appear in title/detail (AND). */
  titleIncludesAll?: string[];
};

export type GoldenScoringMode = "standard" | "hard";

export type GoldenScenarioFixture = {
  id: string;
  name: string;
  description: string;
  /** Coming soon scenarios stay listed but disabled. */
  available: boolean;
  /** standard = regression pass/fail; hard = Strong/Mixed/Failed + separate reliability. */
  scoringMode?: GoldenScoringMode;
  defaultCapture: string;
  project: {
    id: string;
    name: string;
    code: string;
    summary: string;
    status: "healthy" | "watch" | "at_risk";
    currentFocus: string;
  };
  todos: Array<{
    id: string;
    title: string;
    detail?: string;
    done: boolean;
    statusLabel: string;
  }>;
  risks: string[];
  stakeholders: Array<{ id: string; name: string; role: string }>;
  knowledge: string[];
  expected: GoldenExpectedOutcome[];
  prohibited?: GoldenProhibitedOutcome[];
};

export type MatchStatus =
  | "correct"
  | "valid_alternative"
  | "needs_review"
  | "missing"
  | "unexpected";

export type ScoredOutcome = {
  status: MatchStatus;
  expectedId?: string;
  expected?: GoldenExpectedOutcome;
  operation?: GoldenOperation;
  entity?: GoldenEntity;
  targetTitle?: string;
  confidence?: number | null;
  confidenceEstimated?: boolean;
  label: string;
  detail?: string;
  /** Friendly status chip label. */
  statusLabel?: string;
  resultingStatus?: string;
};

/** Regression bands for hard scenarios (independent of reliability). */
export type HardRegressionBand = "strong" | "mixed" | "failed";

export type GoldenReliabilityVerdict = {
  state: "normal" | "review_recommended" | "limited";
  label: string;
  ambiguousFindings: number;
  clarificationCount: number;
  invalidTargetCount: number;
  validationErrors: number;
  lowConfidenceCount: number;
  missingOperationMappings: number;
  truncated: boolean;
};

export type GoldenScore = {
  grade: "excellent" | "good" | "needs_work" | "poor";
  gradeLabel: string;
  gradeEmoji: string;
  matched: number;
  total: number;
  outcomes: ScoredOutcome[];
  /** Hard regression band — never driven by op-label mismatch alone. */
  hardBand?: HardRegressionBand;
  hardBandLabel?: string;
  hardExplanation?: string;
  prohibitedTriggered?: number;
  ambiguousFindings?: number;
  scoringMode?: GoldenScoringMode;
  /** Independent of expected-operation matching. */
  reliability?: GoldenReliabilityVerdict;
};

export type GoldenProposedOp = {
  id: string;
  operation: GoldenOperation;
  entity: GoldenEntity;
  entityLabel: string;
  title: string;
  detail?: string;
  confidence: number | null;
  confidenceEstimated: boolean;
  sourceFindingId?: string;
  targetId?: string;
  proposedValues?: Record<string, unknown>;
  resultingStatus?: string;
};

export type GoldenReasoningStep = {
  id: string;
  foundLabel: string;
  foundTitle: string;
  captureStates: string;
  recommend: string;
  sourceFindingId?: string;
};

export type GoldenPresentation = {
  summary: string;
  facts: string[];
  reasoning: GoldenReasoningStep[];
  proposed: GoldenProposedOp[];
  findingCards?: Array<{
    id: string;
    fact: string;
    matchedLabel?: string;
    matchedTitle?: string;
    meaning: string;
    confidence: number;
    requiresClarification: boolean;
    clarificationQuestion?: string;
    invalidTarget?: boolean;
    validationWarning?: string;
  }>;
};
