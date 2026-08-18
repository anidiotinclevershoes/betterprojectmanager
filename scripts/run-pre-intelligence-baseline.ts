/**
 * Run the official V1 suite against unchanged Lume + fair GPT baseline.
 * Usage: LUME_EVAL_FORCE_FILESTORE=1 npx tsx scripts/run-pre-intelligence-baseline.ts
 */
import { runBenchmark } from "../src/lib/evals/runner";
import {
  getOfficialBenchmark,
  summarizeBenchmark,
} from "../src/lib/evals/fixtures";
import { OFFICIAL_BENCHMARK_DEFAULT_LABEL, FINAL_BASELINE_LABEL } from "../src/lib/evals/fixtures/v1-benchmark";
import { isOpenAIConfigured } from "../src/lib/openai";

async function main() {
  process.env.LUME_EVAL_FORCE_FILESTORE = "1";

  const label =
    process.env.LUME_EVAL_RUN_LABEL?.trim() ||
    (process.argv.includes("--final-baseline")
      ? FINAL_BASELINE_LABEL
      : OFFICIAL_BENCHMARK_DEFAULT_LABEL);

  const summary = summarizeBenchmark(getOfficialBenchmark());
  console.log(
    JSON.stringify(
      {
        suite: summary,
        openaiConfigured: isOpenAIConfigured(),
        label,
      },
      null,
      2,
    ),
  );

  if (!isOpenAIConfigured()) {
    console.error(
      `OPENAI_API_KEY is not configured — cannot execute ${label} in this environment.`,
    );
    process.exit(2);
  }

  const run = await runBenchmark({
    label,
    createdByEmail: "baseline-runner@local",
    benchmarkVersion: "lume-intelligence-benchmark-v1",
    notes: process.argv.includes("--final-baseline")
      ? "Frozen pre-Phase-2C baseline after final evaluator calibration. Lume intelligence unchanged."
      : "Official untouched-Lume baseline for Phase 2B. Do not treat as intelligence improvement.",
    onProgress: ({ done, total, caseId }) => {
      console.log(`[${done}/${total}] ${caseId}`);
    },
  });

  console.log(
    JSON.stringify(
      {
        id: run.id,
        label: run.label,
        status: run.status,
        fixtureVersion: run.fixtureVersion,
        summary: run.summary,
        lumeModel: run.lumeModel,
        baselineModel: run.baselineModel,
        baselinePromptVersion: run.baselinePromptVersion,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
