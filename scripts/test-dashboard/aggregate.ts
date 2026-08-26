/**
 * Presentation aggregates of existing harness fields.
 * Means skip nulls. Does not invent a competing correctness score.
 */

import { FROZEN_CORPUS_COMPOSITION } from "../../src/lib/eval-capture-v2/baseline";
import { CAPTURE_V2_EVAL_CORPUS } from "../../src/lib/eval-capture-v2/corpus";
import { CAPTURE_V2_EVAL_SCORER_V1 } from "../../src/lib/eval-capture-v2/lume-safety";
import type { FailureClass, WorldId, WorldSuite } from "./schema";
import { WORLD_IDS } from "./schema";
import { redactSecrets } from "./secrets";

export type LooseCaseResult = {
  caseId?: string;
  provider?: string;
  model?: string;
  runIndex?: number;
  usedFrozenFixture?: boolean;
  modelMetrics?: {
    materialRecall?: number | null;
    unsupportedCount?: number | null;
    domainCorrectness?: number | null;
    existingVsNewCorrectness?: number | null;
    stableTargetCorrectness?: number | null;
    ambiguityPreserved?: boolean | null;
    noChangeHandled?: boolean | null;
    commentaryHandled?: boolean | null;
  };
  lumeSafety?: {
    totals?: {
      modelFailures?: number;
      lumeCatches?: number;
      lumeFailures?: number;
    };
    rows?: Array<{
      observationId?: string;
      statement?: string;
      classification?: string;
      decisionKind?: string;
      reason?: string;
    }>;
  };
  call?: {
    usage?: {
      inputTokens?: number | null;
      outputTokens?: number | null;
      totalTokens?: number | null;
    };
    latencyMs?: number | null;
    approximateCostUsd?: number | null;
    error?: string | null;
    requestedModel?: string | null;
    responseModel?: string | null;
    provider?: string;
  } | null;
};

export type LooseHarnessReport = {
  baselineVersion?: string;
  corpusVersion?: string;
  scorerVersion?: string;
  startedAt?: string;
  finishedAt?: string;
  results?: LooseCaseResult[];
  skipped?: Array<{ provider?: string; reason?: string }>;
  liveCallsAttempted?: number;
  liveCallsSucceeded?: number;
};

function mean(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function shareTrue(values: Array<boolean | null | undefined>): number | null {
  const known = values.filter((v): v is boolean => typeof v === "boolean");
  if (!known.length) return null;
  return known.filter(Boolean).length / known.length;
}

function worldForCase(caseId: string | undefined): WorldId | null {
  if (!caseId) return null;
  const hit = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === caseId);
  return hit ? hit.world : null;
}

export function groupKey(row: LooseCaseResult): string {
  const provider = row.provider ?? row.call?.provider ?? "unknown";
  const model =
    row.model ?? row.call?.responseModel ?? row.call?.requestedModel ?? "unknown";
  return `${provider}::${model}`;
}

export function aggregateModelGroup(rows: LooseCaseResult[]): {
  provider: string;
  model: string;
  caseCount: number;
  recall: number | null;
  falsePositives: number | null;
  domainAccuracy: number | null;
  existingVsNewAccuracy: number | null;
  targetIdAccuracy: number | null;
  ambiguityHandling: number | null;
  noChangeHandling: number | null;
  commentaryHandling: number | null;
  stability: null;
  modelFailures: number | null;
  lumeCatches: number | null;
  lumeFailures: number | null;
  tokens: { input: number | null; output: number | null; total: number | null };
  latencyMs: number | null;
  costUsd: number | null;
  callErrors: number;
  worlds: Partial<Record<WorldId, WorldSuite>>;
} {
  const first = rows[0];
  const provider = first?.provider ?? first?.call?.provider ?? "unknown";
  const model =
    first?.model ??
    first?.call?.responseModel ??
    first?.call?.requestedModel ??
    "unknown";
  const uniqueCases = new Set(rows.map((r) => r.caseId).filter(Boolean));
  const callErrors = rows.filter((r) => r.call?.error).length;
  const lumeFailures = sum(rows.map((r) => r.lumeSafety?.totals?.lumeFailures)) ?? 0;
  const lumeCatches = sum(rows.map((r) => r.lumeSafety?.totals?.lumeCatches)) ?? 0;
  const modelFailures = sum(rows.map((r) => r.lumeSafety?.totals?.modelFailures)) ?? 0;

  const worlds: ReturnType<typeof aggregateModelGroup>["worlds"] = {};
  for (const world of WORLD_IDS) {
    const subset = rows.filter((r) => worldForCase(r.caseId) === world);
    if (!subset.length) continue;
    const lf = sum(subset.map((r) => r.lumeSafety?.totals?.lumeFailures)) ?? 0;
    const lc = sum(subset.map((r) => r.lumeSafety?.totals?.lumeCatches)) ?? 0;
    const mf = sum(subset.map((r) => r.lumeSafety?.totals?.modelFailures)) ?? 0;
    worlds[world] = {
      result: lf > 0 ? "fail" : lc > 0 ? "warn" : "pass",
      lumeFailures: lf,
      lumeCatches: lc,
      modelFailures: mf,
      caseCount: new Set(subset.map((r) => r.caseId).filter(Boolean)).size || subset.length,
      recall: mean(subset.map((r) => r.modelMetrics?.materialRecall)),
    };
  }

  return {
    provider,
    model,
    caseCount: uniqueCases.size || rows.length,
    recall: mean(rows.map((r) => r.modelMetrics?.materialRecall)),
    falsePositives: sum(rows.map((r) => r.modelMetrics?.unsupportedCount)),
    domainAccuracy: mean(rows.map((r) => r.modelMetrics?.domainCorrectness)),
    existingVsNewAccuracy: mean(rows.map((r) => r.modelMetrics?.existingVsNewCorrectness)),
    targetIdAccuracy: mean(rows.map((r) => r.modelMetrics?.stableTargetCorrectness)),
    ambiguityHandling: shareTrue(rows.map((r) => r.modelMetrics?.ambiguityPreserved)),
    noChangeHandling: shareTrue(rows.map((r) => r.modelMetrics?.noChangeHandled)),
    commentaryHandling: shareTrue(rows.map((r) => r.modelMetrics?.commentaryHandled)),
    stability: null,
    modelFailures,
    lumeCatches,
    lumeFailures,
    tokens: {
      input: sum(rows.map((r) => r.call?.usage?.inputTokens)),
      output: sum(rows.map((r) => r.call?.usage?.outputTokens)),
      total: sum(rows.map((r) => r.call?.usage?.totalTokens)),
    },
    latencyMs: sum(rows.map((r) => r.call?.latencyMs)),
    costUsd: sum(rows.map((r) => r.call?.approximateCostUsd)),
    callErrors,
    worlds,
  };
}

export function expectedOutcomeForCase(caseId: string | undefined): string | null {
  if (!caseId) return null;
  const hit = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === caseId);
  if (!hit) return null;
  const bits: string[] = [];
  if (hit.expectedNeedsYou) bits.push("Needs you");
  if (hit.expectedNoChange) bits.push("No change");
  if (hit.expectedCommentary) bits.push("Commentary");
  if (bits.length) return bits.join(", ");
  return hit.title || null;
}

function classificationLabel(value: string | undefined): FailureClass | null {
  if (value === "model_failure") return "MODEL FAILURE";
  if (value === "lume_catch") return "LUME CATCH";
  if (value === "lume_failure") return "LUME FAILURE";
  return null;
}

export function extractFailures(
  rows: LooseCaseResult[],
  meta: { runId: string; sha: string; workflowUrl?: string | null },
): Array<{
  caseId: string;
  world: string | null;
  expected: string | null;
  actual: string | null;
  classification: FailureClass;
  runId: string;
  sha: string;
  model: string | null;
  workflowUrl: string | null;
}> {
  const out: ReturnType<typeof extractFailures> = [];
  for (const row of rows) {
    const model = row.model ?? row.call?.requestedModel ?? null;
    for (const safety of row.lumeSafety?.rows ?? []) {
      const label = classificationLabel(safety.classification);
      if (!label) continue;
      const actual =
        [safety.decisionKind, safety.reason].filter(Boolean).join(" — ") || null;
      out.push({
        caseId: row.caseId ?? safety.observationId ?? "unknown",
        world: worldForCase(row.caseId),
        expected: expectedOutcomeForCase(row.caseId),
        actual: actual ? redactSecrets(actual).slice(0, 180) : null,
        classification: label,
        runId: meta.runId,
        sha: meta.sha,
        model,
        workflowUrl: meta.workflowUrl ?? null,
      });
    }
  }
  return out;
}

/**
 * Corpus version is independent of prompt baseline and scorer versions.
 * Historical v1 harness files stuffed the corpus id into `baselineVersion`;
 * do not keep treating baseline as corpus. Missing corpusVersion → frozen corpus.
 */
export function corpusVersionFromReport(report: LooseHarnessReport): string {
  if (typeof report.corpusVersion === "string" && report.corpusVersion.trim()) {
    return report.corpusVersion;
  }
  return FROZEN_CORPUS_COMPOSITION.version;
}

/** Historical live reports without scorerVersion used the pre-v2 classifier. */
export function scorerVersionFromReport(report: LooseHarnessReport): string {
  if (typeof report.scorerVersion === "string" && report.scorerVersion.trim()) {
    return report.scorerVersion;
  }
  return CAPTURE_V2_EVAL_SCORER_V1;
}

export { worldForCase };
