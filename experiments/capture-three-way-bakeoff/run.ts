/**
 * Invoke pinned worktrees. Experiment-only. Does not modify committed contender files.
 */
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import type { ContenderId, FrozenCase, FrozenManifest, ContenderRun } from "./types";
import { scoreCase } from "./score";

const here = dirname(fileURLToPath(import.meta.url));

export const WORKTREES: Record<ContenderId, string> = {
  current: "/tmp/lume-bakeoff/current",
  simplification: "/tmp/lume-bakeoff/simplification",
  "ai-first": "/tmp/lume-bakeoff/ai-first",
};

const RUNNERS: Record<ContenderId, string> = {
  current: join(here, "runners/production-runner.ts"),
  simplification: join(here, "runners/production-runner.ts"),
  "ai-first": join(here, "runners/ai-first-runner.ts"),
};

function loadManifest(): FrozenManifest {
  const path = join(here, "FROZEN_CORPUS.json");
  if (!existsSync(path)) {
    throw new Error("FROZEN_CORPUS.json missing — run freeze.ts first");
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
        env: process.env,
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
  contender: ContenderId;
  repeatIndex: number;
  apply: boolean;
  outDir: string;
}): Promise<ContenderRun> {
  const worktree = WORKTREES[args.contender];
  const runnerSrc = RUNNERS[args.contender];
  const runnerDest = join(worktree, ".bakeoff-runner.ts");
  copyFileSync(runnerSrc, runnerDest);
  const caseDir = join(
    args.outDir,
    args.contender,
    args.frozen.id,
    `r${args.repeatIndex}`,
  );
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
    cwd: worktree,
    runnerDest,
    inputPath,
    outputPath,
  });
  if (!existsSync(outputPath)) {
    return {
      caseId: args.frozen.id,
      contender: args.contender,
      repeatIndex: args.repeatIndex,
      ok: false,
      error: spawned.stderr || `runner exited ${spawned.code}`,
      requestedModel: null,
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
    contender: args.contender,
    repeatIndex: args.repeatIndex,
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
  const contender = argv.find((a) => a.startsWith("--contender="))?.slice("--contender=".length) as
    | ContenderId
    | undefined;
  const repeats = Number(argv.find((a) => a.startsWith("--repeats="))?.slice("--repeats=".length) || "1");
  const concurrency = Number(
    argv.find((a) => a.startsWith("--concurrency="))?.slice("--concurrency=".length) || "2",
  );
  return { stage, only, contender, repeats, concurrency };
}

async function main() {
  const args = parseArgs();
  const manifest = loadManifest();
  let cases = manifest.cases;
  if (args.stage === 2) cases = cases.filter((row) => manifest.stage2Ids.includes(row.id) || row.stage2);
  if (args.stage === 3) cases = cases.filter((row) => manifest.stage3Ids.includes(row.id) || row.stage3);
  if (args.only) {
    const ids = new Set(args.only.split(","));
    cases = cases.filter((row) => ids.has(row.id));
  }
  const contenders: ContenderId[] = args.contender
    ? [args.contender]
    : args.stage === 3
      ? ["current", "simplification"]
      : ["current", "simplification", "ai-first"];
  const repeats = args.stage === 2 ? Math.max(3, args.repeats) : args.repeats;
  const outDir = join(here, "results", `stage${args.stage}`);
  mkdirSync(outDir, { recursive: true });

  type Job = { frozen: FrozenCase; contender: ContenderId; repeatIndex: number };
  const jobs: Job[] = [];
  for (const frozen of cases) {
    for (const contender of contenders) {
      for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
        jobs.push({ frozen, contender, repeatIndex });
      }
    }
  }
  console.log(
    `stage=${args.stage} cases=${cases.length} contenders=${contenders.join(",")} repeats=${repeats} jobs=${jobs.length}`,
  );

  const runs = await pool(jobs, args.concurrency, async (job) => {
    console.log(`→ ${job.contender} ${job.frozen.id} r${job.repeatIndex}`);
    const run = await runCase({
      frozen: job.frozen,
      contender: job.contender,
      repeatIndex: job.repeatIndex,
      apply: args.stage === 3,
      outDir,
    });
    const judgement = scoreCase({
      frozen: job.frozen,
      contender: job.contender,
      repeatIndex: job.repeatIndex,
      normalized: run.normalized,
      malformed: !run.ok,
    });
    writeFileSync(
      join(outDir, job.contender, job.frozen.id, `r${job.repeatIndex}`, "judgement.json"),
      `${JSON.stringify(judgement, null, 2)}\n`,
    );
    console.log(
      `← ${job.contender} ${job.frozen.id} r${job.repeatIndex} ok=${run.ok} model=${run.responseModel} ${run.latencyMs}ms`,
    );
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
