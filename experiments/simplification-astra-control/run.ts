/**
 * Simplification + Astra control runner.
 * Reuses the frozen bake-off corpus and production runner without modifying them.
 * Only experimental change: OPENAI_MODEL=gpt-6-astra in the spawn environment.
 */
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import type { FrozenCase, FrozenManifest, ContenderRun, CaseJudgement } from "../capture-three-way-bakeoff/types";
import { scoreCase } from "../capture-three-way-bakeoff/score";

const here = dirname(fileURLToPath(import.meta.url));
const BAKEOFF = join(here, "../capture-three-way-bakeoff");
const EXPECTED_CORPUS_SHA =
  "925b3395268d56482b1ce8e0f6fde82a1c4a87f473432fcb73919f809a66cd14";
const PINNED_SIMPLIFICATION = "bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0";
const REQUESTED_MODEL = "gpt-6-astra";
const WORKTREE = "/tmp/lume-bakeoff/simplification-astra";
const RUNNER_SRC = join(here, "runners/simplification-astra-runner.ts");
const RUNNER_DEST = join(WORKTREE, ".astra-control-runner.ts");

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadManifest(): FrozenManifest {
  const path = join(BAKEOFF, "FROZEN_CORPUS.json");
  const actual = sha256File(path);
  if (actual !== EXPECTED_CORPUS_SHA) {
    throw new Error(
      `Frozen corpus SHA mismatch. expected=${EXPECTED_CORPUS_SHA} actual=${actual}. STOP.`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as FrozenManifest;
}

function runOnce(args: {
  cwd: string;
  runnerDest: string;
  inputPath: string;
  outputPath: string;
}): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["--yes", "tsx", args.runnerDest, args.inputPath, args.outputPath],
      {
        cwd: args.cwd,
        env: {
          ...process.env,
          OPENAI_MODEL: REQUESTED_MODEL,
          // Prevent eval override from winning if someone set it.
          OPENAI_EVAL_MODEL: "",
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

export async function runCase(args: {
  frozen: FrozenCase;
  repeatIndex: number;
  apply: boolean;
  outDir: string;
}): Promise<ContenderRun> {
  if (!existsSync(WORKTREE)) {
    throw new Error(`Missing Simplification worktree at ${WORKTREE}`);
  }
  copyFileSync(RUNNER_SRC, RUNNER_DEST);
  const caseDir = join(args.outDir, "simplification-astra", args.frozen.id, `r${args.repeatIndex}`);
  mkdirSync(caseDir, { recursive: true });
  const inputPath = join(caseDir, "input.json");
  const outputPath = join(caseDir, "output.json");
  writeFileSync(
    inputPath,
    `${JSON.stringify(
      {
        caseId: args.frozen.id,
        captureText: args.frozen.captureText,
        projectId: args.frozen.projectId,
        world: args.frozen.world,
        apply: args.apply,
      },
      null,
      2,
    )}\n`,
  );
  const started = Date.now();
  const spawned = await runOnce({
    cwd: WORKTREE,
    runnerDest: RUNNER_DEST,
    inputPath,
    outputPath,
  });
  if (!existsSync(outputPath)) {
    return {
      caseId: args.frozen.id,
      contender: "simplification",
      repeatIndex: args.repeatIndex,
      ok: false,
      error: spawned.stderr || `runner exited ${spawned.code}`,
      requestedModel: REQUESTED_MODEL,
      responseModel: null,
      latencyMs: Date.now() - started,
      usage: null,
      raw: null,
      normalized: [],
      apply: null,
    };
  }
  const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as Omit<
    ContenderRun,
    "contender" | "repeatIndex"
  >;
  return {
    ...parsed,
    caseId: args.frozen.id,
    contender: "simplification",
    repeatIndex: args.repeatIndex,
    requestedModel: parsed.requestedModel ?? REQUESTED_MODEL,
    error: parsed.error || (spawned.code === 0 ? parsed.error : spawned.stderr || parsed.error),
  };
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
  return { stage, only, repeats, concurrency };
}

async function main() {
  const args = parseArgs();
  const manifest = loadManifest();
  if (manifest.pins.simplification !== PINNED_SIMPLIFICATION) {
    throw new Error(
      `Corpus pin drifted from Simplification SHA ${PINNED_SIMPLIFICATION}. STOP.`,
    );
  }
  let cases = manifest.cases;
  if (args.stage === 2) cases = cases.filter((row) => manifest.stage2Ids.includes(row.id) || row.stage2);
  if (args.stage === 3) cases = cases.filter((row) => manifest.stage3Ids.includes(row.id) || row.stage3);
  if (args.only) {
    const ids = new Set(args.only.split(","));
    cases = cases.filter((row) => ids.has(row.id));
  }
  const repeats = args.stage === 2 ? Math.max(3, args.repeats) : args.repeats;
  const outDir = join(here, "results", `stage${args.stage}`);
  mkdirSync(outDir, { recursive: true });

  type Job = { frozen: FrozenCase; repeatIndex: number };
  const jobs: Job[] = [];
  for (const frozen of cases) {
    for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
      jobs.push({ frozen, repeatIndex });
    }
  }
  console.log(
    `simplification-astra stage=${args.stage} cases=${cases.length} repeats=${repeats} jobs=${jobs.length} model=${REQUESTED_MODEL} pin=${PINNED_SIMPLIFICATION}`,
  );

  const runs = await pool(jobs, args.concurrency, async (job) => {
    console.log(`→ simplification-astra ${job.frozen.id} r${job.repeatIndex}`);
    const run = await runCase({
      frozen: job.frozen,
      repeatIndex: job.repeatIndex,
      apply: args.stage === 3,
      outDir,
    });
    const judgement: CaseJudgement = scoreCase({
      frozen: job.frozen,
      contender: "simplification",
      repeatIndex: job.repeatIndex,
      normalized: run.normalized,
      malformed: !run.ok,
    });
    writeFileSync(
      join(outDir, "simplification-astra", job.frozen.id, `r${job.repeatIndex}`, "judgement.json"),
      `${JSON.stringify(judgement, null, 2)}\n`,
    );
    console.log(
      `← simplification-astra ${job.frozen.id} r${job.repeatIndex} ok=${run.ok} requested=${run.requestedModel} response=${run.responseModel} ${run.latencyMs}ms`,
    );
    if (run.requestedModel !== REQUESTED_MODEL || run.responseModel !== REQUESTED_MODEL) {
      console.warn(
        `MODEL MISMATCH ${job.frozen.id}: requested=${run.requestedModel} response=${run.responseModel}`,
      );
    }
    return { run, judgement };
  });

  writeFileSync(join(outDir, "runs.json"), `${JSON.stringify(runs.map((r) => r.run), null, 2)}\n`);
  writeFileSync(
    join(outDir, "judgements.json"),
    `${JSON.stringify(runs.map((r) => r.judgement), null, 2)}\n`,
  );
  console.log(`wrote ${runs.length} results to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
