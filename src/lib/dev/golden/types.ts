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
  operation: GoldenOperation;
  /** Alternate ops that still count as Correct (e.g. complete vs update). */
  allowedOperations?: GoldenOperation[];
  entity: GoldenEntity;
  /** Existing record title / knowledge bullet to match (fuzzy). */
  targetTitle: string;
  /** Preferred stable fixture ID when available. */
  targetId?: string;
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
  /** standard = regression pass/fail; hard = exploratory Strong/Mixed/Unreliable. */
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

export type MatchStatus = "correct" | "needs_review" | "missing" | "unexpected";

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
};

/** Neutral hard-scenario bands — not pass/fail of the application. */
export type HardScenarioBand = "strong" | "mixed" | "unreliable";

export type GoldenScore = {
  grade: "excellent" | "good" | "needs_work" | "poor";
  gradeLabel: string;
  gradeEmoji: string;
  matched: number;
  total: number;
  outcomes: ScoredOutcome[];
  /** Present when scoringMode is hard. */
  hardBand?: HardScenarioBand;
  hardBandLabel?: string;
  hardExplanation?: string;
  prohibitedTriggered?: number;
  ambiguousFindings?: number;
  scoringMode?: GoldenScoringMode;
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
