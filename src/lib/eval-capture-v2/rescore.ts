/**
 * Offline rescore of archived first-live Capture V2 envelopes through the
 * current scorer. No provider calls. Does not mutate original harness artifacts
 * or the historical scorer-v2 JSON.
 */

import { FROZEN_CORPUS_COMPOSITION, FROZEN_V2_BASELINE } from "./baseline";
import { CAPTURE_V2_EVAL_CORPUS } from "./corpus";
import {
  CAPTURE_V2_EVAL_SCORER_V1,
  CAPTURE_V2_EVAL_SCORER_VERSION,
} from "./lume-safety";
import { evaluateAgainstCase } from "./pipeline";
import type {
  CaseEvalResult,
  EvalProviderId,
  LumeSafetyRow,
  LumeSafetyTotals,
  TokenUsageRecord,
} from "./types";

export const FIRST_LIVE_WORKFLOW_RUN_ID = "32979257452";
export const FIRST_LIVE_ARTIFACT_NAME = "capture-v2-eval-evidence";
export const FIRST_LIVE_ENVELOPE_ARCHIVE_ID =
  "capture-v2-eval-first-live-envelopes-v1";

export type ArchivedEnvelope = {
  caseId: string;
  runIndex: number;
  provider: EvalProviderId;
  model: string;
  responseModel: string | null;
  error: string | null;
  rawJson: unknown;
  usage: TokenUsageRecord | null;
  latencyMs: number | null;
  approximateCostUsd: number | null;
  originalLume: LumeSafetyTotals | null;
  originalRows: Array<Pick<LumeSafetyRow, "classification" | "reason" | "operationType" | "domain">>;
};

export type FirstLiveEnvelopeArchive = {
  archiveId: typeof FIRST_LIVE_ENVELOPE_ARCHIVE_ID;
  corpusVersion: string;
  originalScorerVersion: string;
  originalWorkflowRunId: string;
  originalArtifactName: string;
  note: string;
  envelopes: ArchivedEnvelope[];
};

export type ModelSafetyTotals = {
  provider: string;
  model: string;
  runs: number;
  callErrors: number;
  successfulRuns: number;
  lumeFailures: number;
  lumeCatches: number;
  modelFailures: number;
};

export type RescoredCase = {
  caseId: string;
  runIndex: number;
  provider: EvalProviderId;
  model: string;
  usedFrozenFixture: false;
  original: {
    lumeFailures: number;
    lumeCatches: number;
    modelFailures: number;
    error: string | null;
    rows: ArchivedEnvelope["originalRows"];
  };
  v2: {
    lumeFailures: number;
    lumeCatches: number;
    modelFailures: number;
    unresolvedTargetConvertedToCreate: number;
    rows: Array<Pick<LumeSafetyRow, "classification" | "reason" | "operationType" | "domain">>;
  };
};

export type RescoreReport = {
  baselineVersion: string;
  corpusVersion: string;
  scorerVersion: string;
  originalScorerVersion: string;
  originalWorkflowRunId: string;
  originalArtifactName: string;
  note: string;
  models: Array<{
    provider: string;
    model: string;
    original: ModelSafetyTotals;
    v2: ModelSafetyTotals;
  }>;
  cases: RescoredCase[];
};

function emptyTotals(): LumeSafetyTotals {
  return {
    applyReady: 0,
    needsYou: 0,
    noChange: 0,
    rejected: 0,
    illegalOperationsBlocked: 0,
    foreignProjectTargetsBlocked: 0,
    duplicatePersonCreationsBlocked: 0,
    unresolvedTargetConvertedToCreate: 0,
    wrongDomainLegalWrite: 0,
    projectIsolationViolation: 0,
    modelFailures: 0,
    lumeCatches: 0,
    lumeFailures: 0,
  };
}

function asProvider(value: string | undefined): EvalProviderId {
  if (value === "openai" || value === "anthropic" || value === "gemini") {
    return value;
  }
  return "openai";
}

export type LooseHarness = {
  results?: Array<{
    caseId?: string;
    runIndex?: number;
    provider?: string;
    model?: string;
    lumeSafety?: {
      totals?: Partial<LumeSafetyTotals>;
      rows?: LumeSafetyRow[];
    };
    call?: {
      provider?: string;
      requestedModel?: string | null;
      responseModel?: string | null;
      rawJson?: unknown;
      error?: string | null;
      usage?: TokenUsageRecord | null;
      latencyMs?: number | null;
      approximateCostUsd?: number | null;
    } | null;
  }>;
};

export function envelopesFromHarnessReport(report: LooseHarness): ArchivedEnvelope[] {
  const out: ArchivedEnvelope[] = [];
  for (const row of report.results ?? []) {
    const call = row.call ?? null;
    out.push({
      caseId: row.caseId ?? "unknown",
      runIndex: row.runIndex ?? 0,
      provider: asProvider(row.provider ?? call?.provider),
      model: row.model ?? call?.requestedModel ?? "unknown",
      responseModel: call?.responseModel ?? null,
      error: call?.error ?? null,
      rawJson: call?.rawJson ?? null,
      usage: call?.usage ?? null,
      latencyMs: call?.latencyMs ?? null,
      approximateCostUsd: call?.approximateCostUsd ?? null,
      originalLume: {
        ...emptyTotals(),
        ...(row.lumeSafety?.totals ?? {}),
      },
      originalRows: (row.lumeSafety?.rows ?? []).map((safety) => ({
        classification: safety.classification,
        reason: safety.reason,
        operationType: safety.operationType,
        domain: safety.domain,
      })),
    });
  }
  return out;
}

export function buildFirstLiveEnvelopeArchive(
  reports: LooseHarness[],
): FirstLiveEnvelopeArchive {
  return {
    archiveId: FIRST_LIVE_ENVELOPE_ARCHIVE_ID,
    corpusVersion: FROZEN_CORPUS_COMPOSITION.version,
    originalScorerVersion: CAPTURE_V2_EVAL_SCORER_V1,
    originalWorkflowRunId: FIRST_LIVE_WORKFLOW_RUN_ID,
    originalArtifactName: FIRST_LIVE_ARTIFACT_NAME,
    note: "Compact copy of first-live raw envelopes for offline scorer v2 rescore. Not a second corpus. Original GitHub artifact is immutable.",
    envelopes: reports.flatMap(envelopesFromHarnessReport),
  };
}

function summarise(
  provider: string,
  model: string,
  rows: Array<{
    error: string | null;
    lumeFailures: number;
    lumeCatches: number;
    modelFailures: number;
  }>,
): ModelSafetyTotals {
  return {
    provider,
    model,
    runs: rows.length,
    callErrors: rows.filter((r) => r.error).length,
    successfulRuns: rows.filter((r) => !r.error).length,
    lumeFailures: rows.reduce((n, r) => n + r.lumeFailures, 0),
    lumeCatches: rows.reduce((n, r) => n + r.lumeCatches, 0),
    modelFailures: rows.reduce((n, r) => n + r.modelFailures, 0),
  };
}

export function rescoreArchivedEnvelopes(
  archive: FirstLiveEnvelopeArchive,
): RescoreReport {
  const cases: RescoredCase[] = [];

  for (const envelope of archive.envelopes) {
    const original = {
      lumeFailures: envelope.originalLume?.lumeFailures ?? 0,
      lumeCatches: envelope.originalLume?.lumeCatches ?? 0,
      modelFailures: envelope.originalLume?.modelFailures ?? 0,
      error: envelope.error,
      rows: envelope.originalRows,
    };

    if (envelope.error) {
      cases.push({
        caseId: envelope.caseId,
        runIndex: envelope.runIndex,
        provider: envelope.provider,
        model: envelope.model,
        usedFrozenFixture: false,
        original,
        v2: {
          lumeFailures: 0,
          lumeCatches: 0,
          modelFailures: 0,
          unresolvedTargetConvertedToCreate: 0,
          rows: [],
        },
      });
      continue;
    }

    const testCase = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === envelope.caseId);
    if (!testCase) {
      throw new Error(`Archived envelope refers to unknown case ${envelope.caseId}`);
    }

    const evaluated = evaluateAgainstCase({
      testCase,
      rawModelJson: envelope.rawJson,
    });
    cases.push({
      caseId: envelope.caseId,
      runIndex: envelope.runIndex,
      provider: envelope.provider,
      model: envelope.model,
      usedFrozenFixture: false,
      original,
      v2: {
        lumeFailures: evaluated.lumeSafety.totals.lumeFailures,
        lumeCatches: evaluated.lumeSafety.totals.lumeCatches,
        modelFailures: evaluated.lumeSafety.totals.modelFailures,
        unresolvedTargetConvertedToCreate:
          evaluated.lumeSafety.totals.unresolvedTargetConvertedToCreate,
        rows: evaluated.lumeSafety.rows.map((row) => ({
          classification: row.classification,
          reason: row.reason,
          operationType: row.operationType,
          domain: row.domain,
        })),
      },
    });
  }

  const keys = [...new Set(cases.map((c) => `${c.provider}::${c.model}`))];
  const models = keys.map((key) => {
    const subset = cases.filter((c) => `${c.provider}::${c.model}` === key);
    const first = subset[0]!;
    return {
      provider: first.provider,
      model: first.model,
      original: summarise(
        first.provider,
        first.model,
        subset.map((c) => ({
          error: c.original.error,
          lumeFailures: c.original.lumeFailures,
          lumeCatches: c.original.lumeCatches,
          modelFailures: c.original.modelFailures,
        })),
      ),
      v2: summarise(
        first.provider,
        first.model,
        subset.map((c) => ({
          error: c.original.error,
          lumeFailures: c.v2.lumeFailures,
          lumeCatches: c.v2.lumeCatches,
          modelFailures: c.v2.modelFailures,
        })),
      ),
    };
  });

  return {
    baselineVersion: FROZEN_V2_BASELINE.version,
    corpusVersion: FROZEN_CORPUS_COMPOSITION.version,
    scorerVersion: CAPTURE_V2_EVAL_SCORER_VERSION,
    originalScorerVersion: archive.originalScorerVersion,
    originalWorkflowRunId: archive.originalWorkflowRunId,
    originalArtifactName: archive.originalArtifactName,
    note: "Current-scorer rescore of archived first-live envelopes. Original artifact was not mutated. No provider calls.",
    models,
    cases,
  };
}

export function rescoreReportToHarnessShape(report: RescoreReport): {
  baselineVersion: string;
  corpusVersion: string;
  scorerVersion: string;
  results: CaseEvalResult[];
} {
  return {
    baselineVersion: report.baselineVersion,
    corpusVersion: report.corpusVersion,
    scorerVersion: report.scorerVersion,
    results: report.cases.map((row) => ({
      caseId: row.caseId,
      runIndex: row.runIndex,
      provider: row.provider,
      model: row.model,
      modelMetrics: {
        materialRecall: null,
        missedMaterial: [],
        unsupportedCount: 0,
        unsupportedObservationIds: [],
        domainCorrectness: null,
        domainMismatches: [],
        existingVsNewCorrectness: null,
        existingVsNewMismatches: [],
        stableTargetCorrectness: null,
        stableTargetMismatches: [],
        ambiguityPreserved: null,
        noChangeHandled: null,
        commentaryHandled: null,
      },
      lumeSafety: {
        rows: row.v2.rows.map((safety, index) => ({
          observationId: `${row.caseId}:${row.runIndex}:${index}`,
          statement: "",
          classification: safety.classification,
          decisionKind: "write",
          domain: safety.domain ?? "",
          operationType: safety.operationType,
          targetId: null,
          reason: safety.reason,
        })),
        totals: {
          ...emptyTotals(),
          lumeFailures: row.v2.lumeFailures,
          lumeCatches: row.v2.lumeCatches,
          modelFailures: row.v2.modelFailures,
          unresolvedTargetConvertedToCreate: row.v2.unresolvedTargetConvertedToCreate,
        },
      },
      call: row.original.error
        ? {
            provider: row.provider,
            requestedModel: row.model,
            responseModel: null,
            responseText: "",
            rawJson: null,
            observations: [],
            usage: {
              inputTokens: null,
              outputTokens: null,
              totalTokens: null,
              reasoningTokens: null,
              cacheReadTokens: null,
              cacheWriteTokens: null,
              raw: null,
            },
            latencyMs: 0,
            retries: 0,
            error: row.original.error,
            approximateCostUsd: null,
            pricingNote: "Archived technical failure; not rescored.",
          }
        : null,
      usedFrozenFixture: false,
    })),
  };
}

/** Current-production replay of archived envelopes through the current scorer. */
export const SCORER_V3_REPLAY_ID = "capture-v2-eval-scorer-v3-replay";

export type ReplayOutcomeKind =
  | "technical_failure"
  | "still_genuine_lume_failure"
  | "scorer_defect"
  | "safe_now"
  | "lume_catch"
  | "model_failure"
  | "current_ok";

export type CurrentProductionReplayCase = RescoredCase & {
  applyReady: number;
  needsYou: number;
  rejected: number;
  noChange: number;
  writeOperations: string[];
  decisionKinds: string[];
  failureStatements: string[];
  outcome: ReplayOutcomeKind;
};

export type CurrentProductionReplayReport = {
  replayId: typeof SCORER_V3_REPLAY_ID;
  kind: "archived-output-current-production-replay";
  baselineVersion: string;
  corpusVersion: string;
  scorerVersion: string;
  productionSha: string;
  originalWorkflowRunId: string;
  originalArtifactName: string;
  envelopeArchiveId: string;
  note: string;
  models: Array<{
    provider: string;
    model: string;
    successfulEnvelopes: number;
    callErrors: number;
    lumeFailures: number;
    lumeCatches: number;
    modelFailures: number;
    applyReady: number;
  }>;
  cases: CurrentProductionReplayCase[];
};

function replayOutcome(row: {
  error: string | null;
  applyReady: number;
  lumeFailures: number;
  lumeCatches: number;
  modelFailures: number;
  originalLumeFailures: number;
}): ReplayOutcomeKind {
  if (row.error) return "technical_failure";
  if (row.lumeFailures > 0 && row.applyReady > 0) return "still_genuine_lume_failure";
  if (row.lumeFailures > 0 && row.applyReady === 0) return "scorer_defect";
  if (row.originalLumeFailures > 0 && row.lumeFailures === 0) {
    if (row.lumeCatches > 0) return "lume_catch";
    return "safe_now";
  }
  if (row.lumeCatches > 0) return "lume_catch";
  if (row.modelFailures > 0) return "model_failure";
  return "current_ok";
}

export function replayArchivedThroughCurrentProduction(args: {
  archive: FirstLiveEnvelopeArchive;
  productionSha: string;
}): CurrentProductionReplayReport {
  const historical = rescoreArchivedEnvelopes(args.archive);
  const cases: CurrentProductionReplayCase[] = [];

  for (let i = 0; i < args.archive.envelopes.length; i += 1) {
    const envelope = args.archive.envelopes[i]!;
    const scored = historical.cases[i]!;
    if (envelope.error) {
      cases.push({
        ...scored,
        applyReady: 0,
        needsYou: 0,
        rejected: 0,
        noChange: 0,
        writeOperations: [],
        decisionKinds: [],
        failureStatements: [],
        outcome: "technical_failure",
      });
      continue;
    }
    const testCase = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === envelope.caseId);
    if (!testCase) {
      throw new Error(`Archived envelope refers to unknown case ${envelope.caseId}`);
    }
    const evaluated = evaluateAgainstCase({
      testCase,
      rawModelJson: envelope.rawJson,
    });
    const applyReady = evaluated.lumeSafety.totals.applyReady;
    const failureRows = evaluated.lumeSafety.rows.filter(
      (row) => row.classification === "lume_failure",
    );
    cases.push({
      ...scored,
      applyReady,
      needsYou: evaluated.lumeSafety.totals.needsYou,
      rejected: evaluated.lumeSafety.totals.rejected,
      noChange: evaluated.lumeSafety.totals.noChange,
      writeOperations: evaluated.pipeline.resolved
        .filter((row) => row.decision.kind === "write")
        .map((row) =>
          row.decision.kind === "write" ? row.decision.operation.type : "",
        ),
      decisionKinds: [
        ...evaluated.pipeline.validation.rejected.map(() => "rejected"),
        ...evaluated.pipeline.resolved.map((row) => row.decision.kind),
      ],
      failureStatements: failureRows.map((row) => row.statement),
      outcome: replayOutcome({
        error: null,
        applyReady,
        lumeFailures: scored.v2.lumeFailures,
        lumeCatches: scored.v2.lumeCatches,
        modelFailures: scored.v2.modelFailures,
        originalLumeFailures: scored.original.lumeFailures,
      }),
    });
  }

  const keys = [...new Set(cases.map((c) => `${c.provider}::${c.model}`))];
  const models = keys.map((key) => {
    const subset = cases.filter((c) => `${c.provider}::${c.model}` === key);
    const first = subset[0]!;
    const ok = subset.filter((c) => !c.original.error);
    return {
      provider: first.provider,
      model: first.model,
      successfulEnvelopes: ok.length,
      callErrors: subset.length - ok.length,
      lumeFailures: ok.reduce((n, r) => n + r.v2.lumeFailures, 0),
      lumeCatches: ok.reduce((n, r) => n + r.v2.lumeCatches, 0),
      modelFailures: ok.reduce((n, r) => n + r.v2.modelFailures, 0),
      applyReady: ok.reduce((n, r) => n + r.applyReady, 0),
    };
  });

  return {
    replayId: SCORER_V3_REPLAY_ID,
    kind: "archived-output-current-production-replay",
    baselineVersion: FROZEN_V2_BASELINE.version,
    corpusVersion: FROZEN_CORPUS_COMPOSITION.version,
    scorerVersion: CAPTURE_V2_EVAL_SCORER_VERSION,
    productionSha: args.productionSha,
    originalWorkflowRunId: args.archive.originalWorkflowRunId,
    originalArtifactName: args.archive.originalArtifactName,
    envelopeArchiveId: args.archive.archiveId,
    note: "Replay of archived first-live raw envelopes through current production Capture V2 + scorer v3. Not a live benchmark. Historical v1/v2 artifacts were not mutated. No provider calls.",
    models,
    cases,
  };
}
