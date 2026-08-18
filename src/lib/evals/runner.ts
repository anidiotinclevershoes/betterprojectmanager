/**
 * Execute a benchmark run: Lume Tell Me path + fair GPT baseline + scoring.
 * Does not modify Lume intelligence behaviour.
 */
import { randomUUID } from "node:crypto";
import { answerTellMeQuestion } from "@/lib/tell-me/answer";
import { getActiveBenchmark, listAllCases, getWorld } from "@/lib/evals/fixtures";
import { buildMissionStateForStage } from "@/lib/evals/build-state";
import { runGptBaseline, BASELINE_PROMPT_VERSION } from "@/lib/evals/baseline";
import { scoreCaseAgainstAnswer } from "@/lib/evals/scoring";
import {
  attachBaselineScoreMeta,
  finaliseSummaryWithBaseline,
} from "@/lib/evals/compare";
import { insertEvalRun, updateEvalRun } from "@/lib/evals/store";
import type {
  EvalCaseResult,
  EvalDimension,
  EvalRunRecord,
  SystemAnswerRecord,
} from "@/lib/evals/types";

export type RunBenchmarkOptions = {
  label?: string;
  createdByEmail: string;
  worldIds?: string[];
  categories?: EvalDimension[];
  notes?: string;
  onProgress?: (info: {
    done: number;
    total: number;
    caseId: string;
  }) => void;
};

function resolveGitCommit(): string | null {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GIT_COMMIT?.trim() ||
    null
  );
}

function resolveLumeVersion(): string | null {
  return (
    process.env.LUME_EVAL_VERSION?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    "local"
  );
}

async function runLumeAnswer(args: {
  question: string;
  state: import("@/lib/types").MissionState;
  projectId: string;
}): Promise<SystemAnswerRecord> {
  const started = Date.now();
  try {
    const result = await answerTellMeQuestion({
      question: args.question,
      state: args.state,
      selectedProjectId: args.projectId,
      snapshot: null,
      conversation: [],
      userDisplayName: "Evaluator",
    });
    return {
      system: "lume",
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources.map((s) => ({
        id: s.id,
        kind: s.kind,
        label: s.label,
        detail: s.detail ?? null,
      })),
      model: result.model ?? null,
      provider: result.provider,
      usage: result.usage
        ? {
            prompt_tokens: result.usage.prompt_tokens ?? null,
            completion_tokens: result.usage.completion_tokens ?? null,
            total_tokens: result.usage.total_tokens ?? null,
          }
        : null,
      durationMs: Date.now() - started,
      raw: {
        freshness: result.freshness,
        contextStats: result.contextStats,
        refreshRecommended: result.refreshRecommended,
      },
      error: null,
    };
  } catch (err) {
    return {
      system: "lume",
      answer: "",
      confidence: null,
      sources: [],
      model: null,
      provider: null,
      usage: null,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : "lume_failed",
    };
  }
}

export async function runBenchmark(
  options: RunBenchmarkOptions,
): Promise<EvalRunRecord> {
  const benchmark = getActiveBenchmark();
  const cases = listAllCases({
    worldIds: options.worldIds,
    categories: options.categories,
  });

  const runId = randomUUID();
  const createdAt = new Date().toISOString();
  let run: EvalRunRecord = {
    id: runId,
    createdAt,
    label:
      options.label?.trim() ||
      `Run ${createdAt.slice(0, 16).replace("T", " ")}`,
    status: "running",
    gitCommit: resolveGitCommit(),
    lumeVersion: resolveLumeVersion(),
    fixtureVersion: benchmark.version,
    fixtureLabel: benchmark.label,
    lumeModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    baselineModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    baselinePromptVersion: BASELINE_PROMPT_VERSION,
    createdByEmail: options.createdByEmail,
    notes: options.notes ?? null,
    worldFilter: options.worldIds ?? null,
    categoryFilter: options.categories ?? null,
    summary: {
      totalCases: cases.length,
      completedCases: 0,
      errorCases: 0,
      skippedCases: 0,
      lumePass: 0,
      lumePartial: 0,
      lumeFail: 0,
      baselinePass: 0,
      baselinePartial: 0,
      baselineFail: 0,
      lumeWins: 0,
      gptWins: 0,
      ties: 0,
      trustFailures: 0,
      criticalIntelligenceFailures: 0,
      dimensionAverages: {},
      lumeTotalTokens: null,
      baselineTotalTokens: null,
    },
    cases: [],
  };

  await insertEvalRun(run);

  const results: EvalCaseResult[] = [];
  let done = 0;

  for (const fixture of cases) {
    const world = getWorld(fixture.worldId);
    if (!world) {
      done += 1;
      continue;
    }

    const built = buildMissionStateForStage(world, fixture.stageId);
    const [lume, baseline] = await Promise.all([
      runLumeAnswer({
        question: fixture.question,
        state: built.state,
        projectId: built.projectId,
      }),
      runGptBaseline({
        question: fixture.question,
        contextDocument: built.contextDocument,
      }),
    ]);

    const lumeScore = scoreCaseAgainstAnswer(fixture, lume);
    const baselineScore = scoreCaseAgainstAnswer(fixture, baseline);
    const baselineAvg =
      baselineScore.dimensionScores
        .filter((d) => d.score != null)
        .reduce((a, d) => a + (d.score ?? 0), 0) /
        Math.max(
          baselineScore.dimensionScores.filter((d) => d.score != null).length,
          1,
        ) || null;

    let caseResult: EvalCaseResult = {
      caseId: fixture.id,
      worldId: fixture.worldId,
      stageId: fixture.stageId,
      question: fixture.question,
      categories: fixture.categories,
      lume,
      baseline,
      dimensionScores: lumeScore.dimensionScores,
      hardFailures: lumeScore.hardFailures,
      automatedNotes: lumeScore.notes,
      automatedBand: lumeScore.band,
      manual: null,
    };
    caseResult = attachBaselineScoreMeta(
      caseResult,
      baselineScore.band,
      Number.isFinite(baselineAvg) ? baselineAvg : null,
    );

    results.push(caseResult);
    done += 1;
    options.onProgress?.({ done, total: cases.length, caseId: fixture.id });

    // Checkpoint after each case so partial progress is visible / recoverable.
    run = {
      ...run,
      cases: [...results],
      summary: finaliseSummaryWithBaseline(results),
      lumeModel: lume.model || run.lumeModel,
      baselineModel: baseline.model || run.baselineModel,
    };
    await updateEvalRun(run);
  }

  run = {
    ...run,
    status: "complete",
    cases: results,
    summary: finaliseSummaryWithBaseline(results),
  };
  await updateEvalRun(run);
  return run;
}
