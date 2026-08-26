/**
 * Opt-in live Capture V2 evaluation.
 * Usage:
 *   npm run eval:capture-v2
 *   npm run eval:capture-v2 -- --provider openai --runs 3
 *   npm run eval:capture-v2 -- --provider all --model gpt-4o-mini-2024-07-18
 *
 * Never fakes success. Missing keys skip/fail explicitly.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  runCaptureV2Eval,
  summariseHarness,
} from "../src/lib/eval-capture-v2/harness";
import { FROZEN_V2_BASELINE } from "../src/lib/eval-capture-v2/baseline";
import type { EvalProviderId } from "../src/lib/eval-capture-v2/types";

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1];
  return fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const providerArg = (arg("provider", "openai") ?? "openai").toLowerCase();
  const providers: EvalProviderId[] =
    providerArg === "all"
      ? ["openai", "anthropic", "gemini"]
      : providerArg === "openai" ||
          providerArg === "anthropic" ||
          providerArg === "gemini"
        ? [providerArg]
        : [];
  if (!providers.length) {
    console.error(
      `Unknown --provider ${providerArg}. Use openai | anthropic | gemini | all.`,
    );
    process.exit(2);
  }

  const runs = Math.max(1, Number(arg("runs", "3")) || 3);
  const model = arg("model");
  const caseIds = arg("cases")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log("Capture V2 live evaluation (opt-in)");
  console.log(`baseline: ${FROZEN_V2_BASELINE.version}`);
  console.log(`providers: ${providers.join(", ")}  runs: ${runs}`);
  console.log("This is a measuring instrument. Do not tune prompts against it.\n");

  const report = await runCaptureV2Eval({
    providers,
    runs,
    caseIds,
    includeFixtureOnly: flag("include-fixture-only"),
    modelByProvider: model
      ? Object.fromEntries(providers.map((p) => [p, model]))
      : undefined,
  });

  console.log(summariseHarness(report));

  const out = arg("out");
  if (out) {
    const path = join(process.cwd(), out);
    writeFileSync(path, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${path}`);
  }

  if (report.liveCallsAttempted === 0 && report.skipped.length === providers.length) {
    console.error(
      "\nNo live provider keys were available. Eval skipped truthfully — success was not faked.",
    );
    process.exit(2);
  }

  const callErrors = report.results.filter((r) => r.call?.error && !r.usedFrozenFixture);
  const lumeFailures = report.results.reduce(
    (n, r) => n + r.lumeSafety.totals.lumeFailures,
    0,
  );
  if (callErrors.length) {
    console.error(`\n${callErrors.length} live call(s) returned errors.`);
    process.exit(1);
  }
  if (lumeFailures > 0) {
    console.error(
      `\n${lumeFailures} Lume failure(s) observed (incorrect legal writes). Recorded — production AI was not retuned.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
