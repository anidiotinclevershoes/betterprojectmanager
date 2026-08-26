/**
 * Capture V2 model-evaluation types.
 * Meaning-based ground truth — never exact prose equality.
 *
 * This module is a measuring instrument. Do not use it to retune prompts.
 */

import type {
  CaptureObservationV2,
  ObservationDisposition,
  ObservationDomain,
} from "@/lib/capture-v2/types";
import type { CaptureApplyDecision } from "@/lib/capture/apply";

export const EVAL_WORLDS = ["candyland", "toyworld", "gamingstudio5000"] as const;
export type EvalWorldId = (typeof EVAL_WORLDS)[number];

export const EVAL_PROVIDERS = ["openai", "anthropic", "gemini"] as const;
export type EvalProviderId = (typeof EVAL_PROVIDERS)[number];

export type ExistingVsNew = "existing" | "new" | "ambiguous" | "none";

export type ExpectedLumeOutcome =
  | "write"
  | "needs_you"
  | "no_change"
  | "rejected"
  | "commentary";

/** One material fact the model must notice. Matching is semantic, not string-equal. */
export type MaterialExpectation = {
  id: string;
  /** Human meaning of the fact. */
  meaning: string;
  /** Tokens that indicate the fact was noticed (case-insensitive substring). */
  meaningTokens: string[];
  allowedDomains: ObservationDomain[];
  existingTargetId?: string | null;
  existingVsNew?: ExistingVsNew;
  expectedDisposition?: ObservationDisposition | ObservationDisposition[];
  expectedNeedsYou?: boolean;
  expectedNoChange?: boolean;
  commentary?: boolean;
};

export type ProhibitedWrite = {
  reason: string;
  /** If set, a write targeting this id is prohibited. */
  targetId?: string;
  /** If set, a write of this legal operation type is prohibited. */
  operationType?: string;
  domain?: string;
  /** Creating a new Person/Risk/etc. with this name/title is prohibited. */
  createTitleIncludes?: string;
};

export type BenchmarkCase = {
  id: string;
  title: string;
  category: string;
  world: EvalWorldId;
  /** Capture entry project — always one of the fictional worlds. */
  projectId: string;
  transcript: string;
  /** live = send transcript to providers; fixture-only = injected envelope. */
  evaluationMode: "live" | "fixture-only";
  material: MaterialExpectation[];
  allowedDomains: ObservationDomain[];
  expectedNeedsYou?: boolean;
  expectedNoChange?: boolean;
  expectedCommentary?: boolean;
  prohibitedInterpretations: string[];
  prohibitedWrites: ProhibitedWrite[];
  notes?: string;
};

export type ModelObservationMatch = {
  expectationId: string;
  matchedObservationIds: string[];
  recalled: boolean;
};

export type ModelDimensionScores = {
  /** A. Material observation recall (0–1). Null if no material facts. */
  materialRecall: number | null;
  missedMaterial: string[];
  /** B. Unsupported observations / false positives. */
  unsupportedCount: number;
  unsupportedObservationIds: string[];
  /** C. Domain correctness among matched material facts (0–1). */
  domainCorrectness: number | null;
  domainMismatches: string[];
  /** D. Existing-vs-new correctness (0–1). */
  existingVsNewCorrectness: number | null;
  existingVsNewMismatches: string[];
  /** E. Stable-target correctness where an unambiguous ID is expected (0–1). */
  stableTargetCorrectness: number | null;
  stableTargetMismatches: string[];
  /** F. Ambiguity handling (preserved vs asserted). Null if N/A. */
  ambiguityPreserved: boolean | null;
  /** G. No-change handling. Null if N/A. */
  noChangeHandled: boolean | null;
  /** H. Commentary handling. Null if N/A. */
  commentaryHandled: boolean | null;
};

export type LumeSafetyClassification =
  | "correct_write"
  | "correct_needs_you"
  | "correct_no_change"
  | "correct_rejected"
  | "correct_commentary"
  | "model_failure"
  | "lume_catch"
  | "lume_failure";

export type LumeSafetyRow = {
  observationId: string;
  statement: string;
  classification: LumeSafetyClassification;
  decisionKind: CaptureApplyDecision["kind"] | "rejected";
  domain: string;
  operationType?: string;
  targetId?: string | null;
  reason: string;
};

export type LumeSafetyTotals = {
  applyReady: number;
  needsYou: number;
  noChange: number;
  rejected: number;
  illegalOperationsBlocked: number;
  foreignProjectTargetsBlocked: number;
  duplicatePersonCreationsBlocked: number;
  unresolvedTargetConvertedToCreate: number;
  wrongDomainLegalWrite: number;
  projectIsolationViolation: number;
  modelFailures: number;
  lumeCatches: number;
  lumeFailures: number;
};

export type TokenUsageRecord = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  /** Provider payload as returned. Never filled in when absent. */
  raw: unknown;
};

export type ProviderCallRecord = {
  provider: EvalProviderId;
  requestedModel: string;
  /** Model id returned by the provider, if any. Not guessed. */
  responseModel: string | null;
  responseText: string;
  rawJson: unknown;
  observations: CaptureObservationV2[];
  usage: TokenUsageRecord;
  latencyMs: number;
  retries: number;
  error: string | null;
  approximateCostUsd: number | null;
  pricingNote: string;
};

export type CaseEvalResult = {
  caseId: string;
  runIndex: number;
  provider: EvalProviderId;
  model: string;
  modelMetrics: ModelDimensionScores;
  lumeSafety: {
    rows: LumeSafetyRow[];
    totals: LumeSafetyTotals;
  };
  call: ProviderCallRecord | null;
  usedFrozenFixture: boolean;
};
