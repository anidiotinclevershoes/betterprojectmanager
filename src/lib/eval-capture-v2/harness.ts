/**
 * Opt-in live Capture V2 evaluation harness.
 * Never invoked from npm test. Requires provider keys. Never fakes success.
 */

import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
} from "@/lib/capture-v2";
import { experimentalApplyWorld } from "@/lib/experiments/worlds";
import {
  FROZEN_CORPUS_COMPOSITION,
  FROZEN_SYSTEM_MESSAGE,
  FROZEN_TEMPERATURE,
  FROZEN_V2_BASELINE,
  livePromptSnapshot,
} from "./baseline";
import { CAPTURE_V2_EVAL_SCORER_VERSION } from "./lume-safety";
import { LIVE_EVAL_CASES, CAPTURE_V2_EVAL_CORPUS } from "./corpus";
import { adapterHasKey, getEvalAdapter } from "./adapters";
import { approximateCostUsd } from "./pricing";
import { evaluateAgainstCase } from "./pipeline";
import { frozenEnvelopeFor } from "./frozen-model-outputs";
import type {
  CaseEvalResult,
  EvalProviderId,
  ProviderCallRecord,
} from "./types";

export type HarnessOptions = {
  providers: EvalProviderId[];
  modelByProvider?: Partial<Record<EvalProviderId, string>>;
  runs: number;
  caseIds?: string[];
  includeFixtureOnly?: boolean;
};

export type HarnessReport = {
  baselineVersion: string;
  corpusVersion: string;
  scorerVersion: string;
  startedAt: string;
  finishedAt: string;
  skipped: Array<{ provider: EvalProviderId; reason: string }>;
  results: CaseEvalResult[];
  liveCallsAttempted: number;
  liveCallsSucceeded: number;
};

function keyStatus(provider: EvalProviderId): { ok: boolean; reason: string } {
  if (adapterHasKey(provider)) return { ok: true, reason: "" };
  const name =
    provider === "openai"
      ? "OPENAI_API_KEY"
      : provider === "anthropic"
        ? "ANTHROPIC_API_KEY"
        : "GEMINI_API_KEY";
  return {
    ok: false,
    reason: `Live Capture V2 eval skipped for ${provider}: ${name} is not configured. No results were invented.`,
  };
}

export async function runCaptureV2Eval(
  options: HarnessOptions,
): Promise<HarnessReport> {
  const startedAt = new Date().toISOString();
  const world = experimentalApplyWorld();
  const skipped: HarnessReport["skipped"] = [];
  const results: CaseEvalResult[] = [];
  let liveCallsAttempted = 0;
  let liveCallsSucceeded = 0;

  const cases = CAPTURE_V2_EVAL_CORPUS.filter((c) => {
    if (options.caseIds?.length) return options.caseIds.includes(c.id);
    if (!options.includeFixtureOnly && c.evaluationMode === "fixture-only") {
      return false;
    }
    return true;
  });

  for (const provider of options.providers) {
    const status = keyStatus(provider);
    if (!status.ok) {
      skipped.push({ provider, reason: status.reason });
      continue;
    }
    const adapter = getEvalAdapter(provider);
    const model = options.modelByProvider?.[provider] ?? adapter.defaultModel;

    for (const testCase of cases) {
      for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
        if (testCase.evaluationMode === "fixture-only") {
          const evaluated = evaluateAgainstCase({
            testCase,
            rawModelJson: frozenEnvelopeFor(testCase.id),
            world,
          });
          results.push({
            caseId: testCase.id,
            runIndex,
            provider,
            model,
            modelMetrics: evaluated.modelMetrics,
            lumeSafety: evaluated.lumeSafety,
            call: null,
            usedFrozenFixture: true,
          });
          continue;
        }

        const project = world.projects.find((p) => p.id === testCase.projectId);
        if (!project) throw new Error(`Missing project ${testCase.projectId}`);
        const records = contextRecordsFromWorld(world, testCase.projectId);
        const projectBlock = formatAuthoritativeStateForPrompt(records, {
          id: project.id,
          name: project.name,
          code: project.code,
        });
        const userPrompt = livePromptSnapshot({
          transcript: testCase.transcript,
          projectBlock,
        });

        liveCallsAttempted += 1;
        const callStarted = Date.now();
        let call: ProviderCallRecord;
        try {
          const completed = await adapter.complete({
            systemMessage: FROZEN_SYSTEM_MESSAGE,
            userPrompt,
            model,
            temperature: FROZEN_TEMPERATURE,
          });
          const cost = approximateCostUsd({
            model: completed.responseModel ?? model,
            inputTokens: completed.usage.inputTokens,
            outputTokens: completed.usage.outputTokens,
            cacheReadTokens: completed.usage.cacheReadTokens,
          });
          call = {
            provider,
            requestedModel: model,
            responseModel: completed.responseModel,
            responseText: completed.responseText,
            rawJson: completed.rawJson,
            observations: [],
            usage: completed.usage,
            latencyMs: completed.latencyMs || Date.now() - callStarted,
            retries: completed.retries,
            error: completed.error,
            approximateCostUsd: cost.usd,
            pricingNote: cost.note,
          };
        } catch (err) {
          call = {
            provider,
            requestedModel: model,
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
            latencyMs: Date.now() - callStarted,
            retries: 0,
            error: err instanceof Error ? err.message : String(err),
            approximateCostUsd: null,
            pricingNote: "Call failed; cost not estimated.",
          };
        }

        if (call.error) {
          results.push({
            caseId: testCase.id,
            runIndex,
            provider,
            model,
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
              rows: [],
              totals: {
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
              },
            },
            call,
            usedFrozenFixture: false,
          });
          continue;
        }

        liveCallsSucceeded += 1;
        const evaluated = evaluateAgainstCase({
          testCase,
          rawModelJson: call.rawJson,
          world,
        });
        call.observations = evaluated.pipeline.validation.observations;
        results.push({
          caseId: testCase.id,
          runIndex,
          provider,
          model,
          modelMetrics: evaluated.modelMetrics,
          lumeSafety: evaluated.lumeSafety,
          call,
          usedFrozenFixture: false,
        });
      }
    }
  }

  return {
    baselineVersion: FROZEN_V2_BASELINE.version,
    corpusVersion: FROZEN_CORPUS_COMPOSITION.version,
    scorerVersion: CAPTURE_V2_EVAL_SCORER_VERSION,
    startedAt,
    finishedAt: new Date().toISOString(),
    skipped,
    results,
    liveCallsAttempted,
    liveCallsSucceeded,
  };
}

export function summariseHarness(report: HarnessReport): string {
  const lines: string[] = [
    `Capture V2 eval  baseline=${report.baselineVersion} corpus=${report.corpusVersion} scorer=${report.scorerVersion}`,
    `live calls ${report.liveCallsSucceeded}/${report.liveCallsAttempted} succeeded`,
  ];
  for (const skip of report.skipped) {
    lines.push(`SKIP ${skip.provider}: ${skip.reason}`);
  }
  const byCase = new Map<string, CaseEvalResult[]>();
  for (const row of report.results) {
    const list = byCase.get(row.caseId) ?? [];
    list.push(row);
    byCase.set(row.caseId, list);
  }
  for (const [caseId, rows] of byCase) {
    const lumeFail = rows.reduce((n, r) => n + r.lumeSafety.totals.lumeFailures, 0);
    const catches = rows.reduce((n, r) => n + r.lumeSafety.totals.lumeCatches, 0);
    const modelFail = rows.reduce((n, r) => n + r.lumeSafety.totals.modelFailures, 0);
    const errors = rows.filter((r) => r.call?.error);
    lines.push(
      `${caseId}: modelFailure=${modelFail} lumeCatch=${catches} lumeFailure=${lumeFail} errors=${errors.length} runs=${rows.length}`,
    );
  }
  return lines.join("\n");
}

export { LIVE_EVAL_CASES };
