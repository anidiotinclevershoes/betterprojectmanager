/**
 * Build the final bake-off report from frozen judgements. Does not retune cases.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseJudgement, ContenderId, ContenderRun, FrozenManifest } from "./types";
import { COMPLEXITY } from "./complexity";

const here = dirname(fileURLToPath(import.meta.url));

type Agg = {
  facts: number;
  recalled: number;
  falseFacts: number;
  falseWrites: number;
  wrongIdentity: number;
  silentOmissions: number;
  evidenceKnown: number;
  evidenceGrounded: number;
  ambiguityKnown: number;
  ambiguitySafe: number;
  clearKnown: number;
  clearOk: number;
  justified: number;
  unnecessary: number;
  extraWrites: number;
  malformed: number;
  latencies: number[];
  promptTokens: number;
  completionTokens: number;
  cases: number;
};

function emptyAgg(): Agg {
  return {
    facts: 0,
    recalled: 0,
    falseFacts: 0,
    falseWrites: 0,
    wrongIdentity: 0,
    silentOmissions: 0,
    evidenceKnown: 0,
    evidenceGrounded: 0,
    ambiguityKnown: 0,
    ambiguitySafe: 0,
    clearKnown: 0,
    clearOk: 0,
    justified: 0,
    unnecessary: 0,
    extraWrites: 0,
    malformed: 0,
    latencies: [],
    promptTokens: 0,
    completionTokens: 0,
    cases: 0,
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(n: number, d: number): string {
  if (!d) return "n/a";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function summarizeStage(stageDir: string) {
  const judgements = loadJson<CaseJudgement[]>(join(stageDir, "judgements.json")) ?? [];
  const runs = loadJson<ContenderRun[]>(join(stageDir, "runs.json")) ?? [];
  const byContender = new Map<ContenderId, Agg>();
  for (const id of ["current", "simplification", "ai-first"] as ContenderId[]) {
    byContender.set(id, emptyAgg());
  }
  for (const row of judgements) {
    const agg = byContender.get(row.contender);
    if (!agg) continue;
    agg.cases += 1;
    agg.malformed += row.malformed ? 1 : 0;
    agg.extraWrites += row.extraWrites.length;
    for (const fact of row.facts) {
      agg.facts += 1;
      if (fact.recalled) agg.recalled += 1;
      if (fact.falseMaterialFact) agg.falseFacts += 1;
      if (fact.falseUnsafeWrite) agg.falseWrites += 1;
      if (fact.wrongIdentity) agg.wrongIdentity += 1;
      if (fact.silentOmission) agg.silentOmissions += 1;
      if (fact.evidenceGrounded != null) {
        agg.evidenceKnown += 1;
        if (fact.evidenceGrounded) agg.evidenceGrounded += 1;
      }
      if (fact.ambiguitySafe != null) {
        agg.ambiguityKnown += 1;
        if (fact.ambiguitySafe) agg.ambiguitySafe += 1;
      }
      if (fact.clearAutomationOk != null) {
        agg.clearKnown += 1;
        if (fact.clearAutomationOk) agg.clearOk += 1;
      }
      if (fact.justifiedIntervention) agg.justified += 1;
      if (fact.unnecessaryIntervention) agg.unnecessary += 1;
    }
  }
  for (const run of runs) {
    const agg = byContender.get(run.contender);
    if (!agg) continue;
    if (typeof run.latencyMs === "number") agg.latencies.push(run.latencyMs);
    agg.promptTokens += run.usage?.prompt_tokens ?? 0;
    agg.completionTokens += run.usage?.completion_tokens ?? 0;
  }
  return { judgements, runs, byContender };
}

function table(byContender: Map<ContenderId, Agg>): string[] {
  const headers = [
    "metric",
    "current",
    "simplification",
    "ai-first",
  ];
  const lines = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  const rows: Array<[string, (a: Agg) => string]> = [
    ["facts scored", (a) => String(a.facts)],
    ["material fact recall", (a) => `${a.recalled}/${a.facts} (${pct(a.recalled, a.facts)})`],
    ["false material facts", (a) => `${a.falseFacts}/${a.facts} (${pct(a.falseFacts, a.facts)})`],
    ["false / unsafe writes", (a) => `${a.falseWrites}/${a.facts} (${pct(a.falseWrites, a.facts)})`],
    ["wrong identity", (a) => `${a.wrongIdentity}/${a.facts} (${pct(a.wrongIdentity, a.facts)})`],
    ["silent omissions", (a) => `${a.silentOmissions}/${a.facts} (${pct(a.silentOmissions, a.facts)})`],
    ["evidence grounding", (a) => `${a.evidenceGrounded}/${a.evidenceKnown} (${pct(a.evidenceGrounded, a.evidenceKnown)})`],
    ["ambiguity safety", (a) => `${a.ambiguitySafe}/${a.ambiguityKnown} (${pct(a.ambiguitySafe, a.ambiguityKnown)})`],
    ["clear-input automation", (a) => `${a.clearOk}/${a.clearKnown} (${pct(a.clearOk, a.clearKnown)})`],
    ["justified intervention", (a) => String(a.justified)],
    ["unnecessary intervention", (a) => String(a.unnecessary)],
    ["extra unmatched writes", (a) => String(a.extraWrites)],
    ["malformed cases", (a) => String(a.malformed)],
    ["median latency ms", (a) => String(median(a.latencies) ?? "n/a")],
    ["latency range ms", (a) => (a.latencies.length ? `${Math.min(...a.latencies)}–${Math.max(...a.latencies)}` : "n/a")],
    ["prompt tokens", (a) => String(a.promptTokens)],
    ["completion tokens", (a) => String(a.completionTokens)],
  ];
  for (const [label, fn] of rows) {
    lines.push(
      `| ${label} | ${fn(byContender.get("current")!)} | ${fn(byContender.get("simplification")!)} | ${fn(byContender.get("ai-first")!)} |`,
    );
  }
  return lines;
}

function main() {
  const manifest = JSON.parse(
    readFileSync(join(here, "FROZEN_CORPUS.json"), "utf8"),
  ) as FrozenManifest;
  const stage1 = summarizeStage(join(here, "results/stage1"));
  const stage2 = summarizeStage(join(here, "results/stage2"));
  const stage3 = summarizeStage(join(here, "results/stage3"));

  const md = [
    "# Capture three-way bake-off report",
    "",
    "Non-mergeable experiment. Contenders were not modified. Expected outcomes were frozen before live runs.",
    "",
    "## A. Experiment branch",
    "",
    "- branch: `experiment/capture-three-way-bakeoff`",
    `- frozen corpus cases: ${manifest.cases.length}`,
    "",
    "## B. Pinned contender SHAs",
    "",
    `- Current: \`${manifest.pins.current}\``,
    `- Simplification: \`${manifest.pins.simplification}\``,
    `- AI-first Gate 1 v2: \`${manifest.pins.aiFirst}\``,
    "",
    "## C. Models",
    "",
    `- Current: \`${COMPLEXITY.current.extractModel}\` / ${COMPLEXITY.current.prompt}`,
    `- Simplification: \`${COMPLEXITY.simplification.extractModel}\` / ${COMPLEXITY.simplification.prompt}`,
    `- AI-first: \`${COMPLEXITY.aiFirst.extractModel}\` / ${COMPLEXITY.aiFirst.prompt}`,
    "",
    "## D. Frozen corpus",
    "",
    "See `FROZEN_CORPUS.md`.",
    "",
    "## E. Stage 1 semantic comparison",
    "",
    ...(stage1.judgements.length ? table(stage1.byContender) : ["_Stage 1 results not present._"]),
    "",
    "## F. Stage 2 repeated-live comparison",
    "",
    ...(stage2.judgements.length ? table(stage2.byContender) : ["_Stage 2 results not present._"]),
    "",
    "## G. Stage 3 Current vs Simplification Apply (in-memory production path)",
    "",
    "AI-first is **not** included: Gate 1 does not define a production write materialiser. Hosted Vercel preview was **not** used because it is a different git SHA than the pinned Current/Simplification checkouts.",
    "",
    ...(stage3.judgements.length ? table(stage3.byContender) : ["_Stage 3 results not present._"]),
    "",
    "## I. Architectural complexity",
    "",
    "```json",
    JSON.stringify(COMPLEXITY, null, 2),
    "```",
    "",
  ].join("\n");

  mkdirSync(join(here, "results"), { recursive: true });
  writeFileSync(join(here, "REPORT.md"), md);
  writeFileSync(
    join(here, "results/summary.json"),
    `${JSON.stringify(
      {
        stage1: Object.fromEntries(stage1.byContender),
        stage2: Object.fromEntries(stage2.byContender),
        stage3: Object.fromEntries(stage3.byContender),
      },
      null,
      2,
    )}\n`,
  );
  console.log("wrote REPORT.md");
}

main();
