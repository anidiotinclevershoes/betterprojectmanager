/**
 * Lume 100-capture long-haul CLI.
 *
 *   npm run stress:project-longhaul -- --captures=100
 *   npm run stress:project-longhaul -- --captures=100 --mode=live
 *
 * Deterministic mode uses oracle envelopes + real Apply/persist.
 * Live mode uses extractObservationsWithOpenAI. Missing keys:
 *   LIVE RUN BLOCKED — CREDENTIALS REQUIRED
 */
import { runLonghaul } from "./longhaul/runner";
import { isOpenAIConfigured } from "../src/lib/openai";

function numArg(name: string, fallback: number): number {
  const prefixed = `--${name}`;
  const idx = process.argv.indexOf(prefixed);
  if (idx >= 0) return Math.max(1, Number(process.argv[idx + 1]) || fallback);
  const eq = process.argv.find((a) => a.startsWith(`${prefixed}=`));
  if (eq) return Math.max(1, Number(eq.split("=")[1]) || fallback);
  return fallback;
}

function arg(name: string, fallback?: string): string | undefined {
  const prefixed = `--${name}`;
  const idx = process.argv.indexOf(prefixed);
  if (idx >= 0) return process.argv[idx + 1];
  const eq = process.argv.find((a) => a.startsWith(`${prefixed}=`));
  if (eq) return eq.slice(prefixed.length + 1);
  return fallback;
}

async function main() {
  const captures = numArg("captures", 100);
  const mode = arg("mode", "deterministic") === "live" ? "live" : "deterministic";
  const outDir = arg("out", "longhaul-100") ?? "longhaul-100";

  if (mode === "live" && !isOpenAIConfigured()) {
    console.error("LIVE RUN BLOCKED — CREDENTIALS REQUIRED");
  }

  const result = await runLonghaul({ captures, mode, outDir });
  console.log("\n── longhaul ──");
  console.log(`mode: ${result.summary.mode}`);
  console.log(`captures: ${result.summary.capturesCompleted}/${result.summary.capturesAttempted}`);
  console.log(`divergences: ${result.summary.divergenceCount}`);
  console.log(`firstDivergence: ${JSON.stringify(result.summary.firstDivergence)}`);
  console.log(`stoppedAt: ${result.summary.stoppedAt}`);
  console.log(`earlyVsLate request chars: ${JSON.stringify(result.summary.earlyVsLateRequestChars)}`);
  console.log(`out: ${result.outDir}`);
  if (result.liveBlocked) {
    console.error("LIVE RUN BLOCKED — CREDENTIALS REQUIRED");
    console.error("Deterministic artefacts are not live proof.");
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
