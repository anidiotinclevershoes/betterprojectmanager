/**
 * AI-first Gate 2 runner.
 * Live path: Gate 1 interpreter (one Astra call) → inspect → thin materialise → optional in-memory Apply.
 * Replay path: frozen bake-off Gate 1 envelopes → inspect → materialise (no new Astra).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import type { FrozenCase, FrozenManifest, ContenderRun, CaseJudgement } from "./types";
import { scoreCase } from "./score";

const here = dirname(fileURLToPath(import.meta.url));
const EXPECTED_CORPUS_SHA =
  "925b3395268d56482b1ce8e0f6fde82a1c4a87f473432fcb73919f809a66cd14";
const BAKEOFF = "/tmp/lume-bakeoff/bakeoff/experiments/capture-three-way-bakeoff";
const PINNED_GATE1 = "707b704bbf820fcc4492c86155889d6afe5d5bae";
const REQUESTED_MODEL = "gpt-6-astra";

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadManifest(): FrozenManifest {
  const path = join(BAKEOFF, "FROZEN_CORPUS.json");
  const actual = sha256File(path);
  if (actual !== EXPECTED_CORPUS_SHA) {
    throw new Error(`Frozen corpus SHA mismatch. expected=${EXPECTED_CORPUS_SHA} actual=${actual}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as FrozenManifest;
}

function runOnce(args: {
  inputPath: string;
  outputPath: string;
}): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["--yes", "tsx", join(here, "worktree-runner.ts"), args.inputPath, args.outputPath],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GATE1_V2_MODEL: REQUESTED_MODEL,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      out[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const stage = argv.includes("--stage2") ? 2 : argv.includes("--stage3") ? 3 : 1;
  const only = argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  const repeats = Number(argv.find((a) => a.startsWith("--repeats="))?.slice("--repeats=".length) || "1");
  const concurrency = Number(
    argv.find((a) => a.startsWith("--concurrency="))?.slice("--concurrency=".length) || "2",
  );
  const replay = argv.includes("--replay");
  return { stage, only, repeats, concurrency, replay };
}

async function main() {
  const args = parseArgs();
  const manifest = loadManifest();
  if (manifest.pins.aiFirst !== PINNED_GATE1) {
    throw new Error(`Corpus AI-first pin drifted from ${PINNED_GATE1}`);
  }
  let cases = manifest.cases;
  if (args.stage === 2) cases = cases.filter((row) => manifest.stage2Ids.includes(row.id) || row.stage2);
  if (args.stage === 3) cases = cases.filter((row) => manifest.stage3Ids.includes(row.id) || row.stage3);
  if (args.only) {
    const ids = new Set(args.only.split(","));
    cases = cases.filter((row) => ids.has(row.id));
  }
  const repeats = args.stage === 2 && !args.replay ? Math.max(3, args.repeats) : args.repeats;
  const outDir = join(here, "results", args.replay ? `replay-stage${args.stage}` : `stage${args.stage}`);
  mkdirSync(outDir, { recursive: true });

  type Job = { frozen: FrozenCase; repeatIndex: number };
  const jobs: Job[] = [];
  for (const frozen of cases) {
    for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
      jobs.push({ frozen, repeatIndex });
    }
  }
  console.log(
    `gate2 stage=${args.stage} replay=${args.replay} cases=${cases.length} repeats=${repeats} jobs=${jobs.length} model=${REQUESTED_MODEL}`,
  );

  const runs = await pool(jobs, args.concurrency, async (job) => {
    const caseDir = join(outDir, "ai-first-gate2", job.frozen.id, `r${job.repeatIndex}`);
    mkdirSync(caseDir, { recursive: true });
    const inputPath = join(caseDir, "input.json");
    const outputPath = join(caseDir, "output.json");
    const replaySource =
      args.replay
        ? join(
            BAKEOFF,
            "results",
            `stage${args.stage === 3 ? 1 : args.stage}`,
            "ai-first",
            job.frozen.id,
            `r${job.repeatIndex}`,
            "output.json",
          )
        : null;
    writeFileSync(
      inputPath,
      `${JSON.stringify(
        {
          caseId: job.frozen.id,
          captureText: job.frozen.captureText,
          projectId: job.frozen.projectId,
          world: job.frozen.world,
          apply: args.stage === 3,
          replayPath: replaySource,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`→ gate2 ${job.frozen.id} r${job.repeatIndex}`);
    const spawned = await runOnce({ inputPath, outputPath });
    const run = existsSync(outputPath)
      ? ({
          ...(JSON.parse(readFileSync(outputPath, "utf8")) as Omit<ContenderRun, "contender" | "repeatIndex">),
          contender: "ai-first" as const,
          repeatIndex: job.repeatIndex,
          caseId: job.frozen.id,
        } as ContenderRun)
      : ({
          caseId: job.frozen.id,
          contender: "ai-first",
          repeatIndex: job.repeatIndex,
          ok: false,
          error: spawned.stderr || `runner exited ${spawned.code}`,
          requestedModel: REQUESTED_MODEL,
          responseModel: null,
          latencyMs: null,
          usage: null,
          raw: null,
          normalized: [],
          apply: null,
        } satisfies ContenderRun);
    const judgement: CaseJudgement = scoreCase({
      frozen: job.frozen,
      contender: "ai-first",
      repeatIndex: job.repeatIndex,
      normalized: run.normalized,
      malformed: !run.ok,
    });
    writeFileSync(join(caseDir, "judgement.json"), `${JSON.stringify(judgement, null, 2)}\n`);
    console.log(
      `← gate2 ${job.frozen.id} r${job.repeatIndex} ok=${run.ok} requested=${run.requestedModel} response=${run.responseModel} ${run.latencyMs}ms`,
    );
    if (!args.replay && (run.requestedModel !== REQUESTED_MODEL || run.responseModel !== REQUESTED_MODEL)) {
      console.warn(`MODEL MISMATCH ${job.frozen.id}: ${run.requestedModel} / ${run.responseModel}`);
    }
    return { run, judgement };
  });

  writeFileSync(join(outDir, "runs.json"), `${JSON.stringify(runs.map((r) => r.run), null, 2)}\n`);
  writeFileSync(join(outDir, "judgements.json"), `${JSON.stringify(runs.map((r) => r.judgement), null, 2)}\n`);
  console.log(`wrote ${runs.length} results to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
