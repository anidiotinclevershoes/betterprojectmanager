/**
 * Lume Intelligence Evaluation — shared types.
 * Fixtures live in-repo; runs are immutable persisted records.
 */

export const EVAL_DIMENSIONS = [
  "recall",
  "accuracy",
  "grounding",
  "temporal",
  "people",
  "dependency",
  "inference",
  "uncertainty",
  "contradiction",
  "prioritisation",
  "actionability",
  "restraint",
  "trust",
] as const;

export type EvalDimension = (typeof EVAL_DIMENSIONS)[number];

export const EVAL_DIMENSION_LABELS: Record<EvalDimension, string> = {
  recall: "Recall",
  accuracy: "Accuracy",
  grounding: "Grounding",
  temporal: "Temporal reasoning",
  people: "People reasoning",
  dependency: "Dependency reasoning",
  inference: "Inference",
  uncertainty: "Uncertainty",
  contradiction: "Contradiction handling",
  prioritisation: "Prioritisation",
  actionability: "Actionability",
  restraint: "Restraint",
  trust: "Trust",
};

export type HardFailureType = "trust_failure" | "critical_intelligence_failure";

export type ManualVerdict =
  | "pass"
  | "partial"
  | "fail"
  | "trust_failure"
  | "critical_intelligence_failure";

export type ScoreBand = "pass" | "partial" | "fail" | "unscored";

export type DimensionScore = {
  dimension: EvalDimension;
  band: ScoreBand;
  /** 0–1 when scored; null if unscored */
  score: number | null;
  rationale?: string | null;
  source: "deterministic" | "manual" | "model_judge";
};

export type TokenUsage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
};

export type EvalCaptureEvent = {
  id: string;
  at: string;
  title: string;
  content: string;
  /** Facts that become true after this capture (human-readable). */
  knownTruth?: string[];
};

export type EvalStage = {
  id: string;
  label: string;
  /** Capture ids applied up to and including this stage (order matters). */
  captureIds: string[];
  summary: string;
  knownTruth: string[];
};

export type EvalCaseFixture = {
  /** Stable across runs — never change once published. */
  id: string;
  worldId: string;
  stageId: string;
  question: string;
  categories: EvalDimension[];
  expectedAnswer?: string | null;
  /** Required facts for a correct narrow answer (Contract §1). */
  expectedFacts?: string[];
  /** Optional supporting context — missing these alone must not demote a correct answer. */
  supportingFacts?: string[];
  expectedImplications?: string[];
  forbiddenClaims?: string[];
  criticalInsight?: string | null;
  /**
   * When true, reward uncertainty/clarification if evidence is incomplete/ambiguous.
   * Do NOT require hedge language when the fixture supports a firm grounded answer
   * (see Contract §13). Prefer omitting this flag for explicit negatives.
   */
  expectUncertainty?: boolean;
  expectContradiction?: boolean;
  presentationNotes?: string | null;
  evaluatorNotes?: string | null;
};

export type EvalWorldFixture = {
  id: string;
  name: string;
  code: string;
  description: string;
  purpose: string;
  categories: EvalDimension[];
  captures: EvalCaptureEvent[];
  stages: EvalStage[];
  cases: EvalCaseFixture[];
};

export type EvalBenchmarkKind = "sample" | "official";

export type EvalBenchmarkManifest = {
  /** Stable version id, e.g. lume-intelligence-benchmark-v1 */
  version: string;
  label: string;
  /** sample = harness regression only; official = scored intelligence suite */
  kind: EvalBenchmarkKind;
  worlds: EvalWorldFixture[];
};

export type SystemAnswerRecord = {
  system: "lume" | "gpt_baseline";
  answer: string;
  confidence?: string | null;
  sources?: Array<{ id: string; kind: string; label: string; detail?: string | null }>;
  /** API-reported model id when available. */
  model: string | null;
  /** Model id requested (pinned snapshot after model tidy). */
  modelRequested?: string | null;
  provider: string | null;
  usage: TokenUsage | null;
  durationMs: number | null;
  raw?: unknown;
  error?: string | null;
};

export type EvalCaseResult = {
  caseId: string;
  worldId: string;
  stageId: string;
  question: string;
  categories: EvalDimension[];
  lume: SystemAnswerRecord;
  baseline: SystemAnswerRecord;
  dimensionScores: DimensionScore[];
  hardFailures: HardFailureType[];
  automatedNotes: string[];
  /** Overall case band from automated scoring (before manual override). */
  automatedBand: ScoreBand;
  manual?: {
    verdict: ManualVerdict;
    notes: string;
    reviewedBy: string;
    reviewedAt: string;
  } | null;
};

export type EvalRunSummary = {
  totalCases: number;
  completedCases: number;
  errorCases: number;
  skippedCases: number;
  lumePass: number;
  lumePartial: number;
  lumeFail: number;
  baselinePass: number;
  baselinePartial: number;
  baselineFail: number;
  lumeWins: number;
  gptWins: number;
  ties: number;
  trustFailures: number;
  criticalIntelligenceFailures: number;
  dimensionAverages: Partial<Record<EvalDimension, number | null>>;
  lumeTotalTokens: number | null;
  baselineTotalTokens: number | null;
  /** Estimated Lume prompt-component totals (tiktoken); null if not instrumented. */
  lumeTokenBreakdown?: Record<string, number | null> | null;
  /** Estimated baseline prompt-component totals; null if not instrumented. */
  baselineTokenBreakdown?: Record<string, number | null> | null;
  /** True when Lume and GPT used the same resolved/requested model family. */
  sameModelControl?: boolean | null;
};

export type EvalRunRecord = {
  id: string;
  createdAt: string;
  label: string;
  status: "running" | "complete" | "failed";
  gitCommit: string | null;
  lumeVersion: string | null;
  fixtureVersion: string;
  fixtureLabel: string;
  lumeModel: string | null;
  baselineModel: string | null;
  baselinePromptVersion: string;
  createdByEmail: string;
  notes: string | null;
  worldFilter: string[] | null;
  categoryFilter: EvalDimension[] | null;
  summary: EvalRunSummary;
  cases: EvalCaseResult[];
};

export type CaseComparisonClass =
  | "improved"
  | "regressed"
  | "no_meaningful_change"
  | "failed_to_passed"
  | "passed_to_failed"
  | "trust_failure_introduced"
  | "trust_failure_resolved"
  | "critical_failure_introduced"
  | "critical_failure_resolved";

export type CaseComparison = {
  caseId: string;
  question: string;
  worldId: string;
  classification: CaseComparisonClass[];
  runA: EvalCaseResult | null;
  runB: EvalCaseResult | null;
};

export type RunComparison = {
  runA: EvalRunRecord;
  runB: EvalRunRecord;
  summaryDeltas: {
    lumePassDelta: number;
    trustFailuresDelta: number;
    criticalFailuresDelta: number;
    lumeWinsDelta: number;
    dimensionDeltas: Partial<Record<EvalDimension, number | null>>;
  };
  cases: CaseComparison[];
  regressions: CaseComparison[];
  improvements: CaseComparison[];
};
