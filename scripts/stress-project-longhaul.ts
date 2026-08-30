/**
 * Lume 100-capture long-haul CLI.
 *
 *   npm run stress:project-longhaul -- --captures=100
 *   npm run stress:project-longhaul -- --captures=100 --mode=live --out=longhaul-100-live
 *
 * Live mode requires OPENAI_API_KEY and a disposable Supabase URL/keys.
 * It does not fall back to oracle envelopes or FakeWorkspaceClient.
 */
import { runLiveLonghaul } from "./longhaul/live-run";
import { runLonghaul } from "./longhaul/runner";

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
  const outDir =
    arg("out") ?? (mode === "live" ? "longhaul-100-live" : "longhaul-100");

  const result =
    mode === "live"
      ? await runLiveLonghaul({ captures, mode, outDir })
      : await runLonghaul({ captures, mode, outDir });
  const summary = result.summary as {
    mode?: string;
    capturesCompleted?: number;
    capturesAttempted?: number;
    divergenceCount?: number;
    firstDivergence?: unknown;
    stoppedAt?: unknown;
    earlyVsLateRequestChars?: unknown;
    taxonomy?: unknown;
    liveBlocked?: unknown;
  };
  console.log("\n── longhaul ──");
  console.log(`mode: ${summary.mode}`);
  console.log(
    `captures: ${summary.capturesCompleted}/${summary.capturesAttempted}`,
  );
  console.log(`divergences: ${summary.divergenceCount}`);
  console.log(`firstDivergence: ${JSON.stringify(summary.firstDivergence)}`);
  console.log(`stoppedAt: ${JSON.stringify(summary.stoppedAt)}`);
  console.log(
    `earlyVsLate request chars: ${JSON.stringify(summary.earlyVsLateRequestChars)}`,
  );
  if (summary.taxonomy) console.log(`taxonomy: ${JSON.stringify(summary.taxonomy)}`);
  console.log(`out: ${result.outDir}`);
  if (result.liveBlocked) {
    console.error(String(result.liveBlocked === true ? summary.liveBlocked : result.liveBlocked));
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
