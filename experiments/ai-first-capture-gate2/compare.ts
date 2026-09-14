/**
 * Compare Gate 2 against frozen bake-off columns. Read-only bake-off results.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseJudgement, ContenderId, ContenderRun, FrozenManifest } from "./types";
import { GATE2_SPECIAL_CASE_COUNT, GATE2_SPECIAL_CASES } from "./materialise";

const here = dirname(fileURLToPath(import.meta.url));
const BAKEOFF = "/tmp/lume-bakeoff/bakeoff/experiments/capture-three-way-bakeoff";

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
  needsYou: number;
  leftUntouched: number;
  noChange: number;
};

function emptyAgg(): Agg {
  return {
    facts: 0, recalled: 0, falseFacts: 0, falseWrites: 0, wrongIdentity: 0,
    silentOmissions: 0, evidenceKnown: 0, evidenceGrounded: 0, ambiguityKnown: 0,
    ambiguitySafe: 0, clearKnown: 0, clearOk: 0, justified: 0, unnecessary: 0,
    extraWrites: 0, malformed: 0, latencies: [], promptTokens: 0, completionTokens: 0,
    cases: 0, needsYou: 0, leftUntouched: 0, noChange: 0,
  };
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function summarize(stageDir: string) {
  const judgements = existsSync(join(stageDir, "judgements.json"))
    ? loadJson<CaseJudgement[]>(join(stageDir, "judgements.json"))
    : [];
  const runs = existsSync(join(stageDir, "runs.json"))
    ? loadJson<ContenderRun[]>(join(stageDir, "runs.json"))
    : [];
  const by = new Map<ContenderId, Agg>();
  for (const id of ["current", "simplification", "ai-first"] as ContenderId[]) by.set(id, emptyAgg());
  for (const row of judgements) {
    const agg = by.get(row.contender);
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
    const agg = by.get(run.contender);
    if (!agg) continue;
    if (typeof run.latencyMs === "number") agg.latencies.push(run.latencyMs);
    agg.promptTokens += run.usage?.prompt_tokens ?? 0;
    agg.completionTokens += run.usage?.completion_tokens ?? 0;
    for (const item of run.normalized) {
      if (item.disposition === "needs_you") agg.needsYou += 1;
      if (item.disposition === "left_untouched") agg.leftUntouched += 1;
      if (item.disposition === "no_change") agg.noChange += 1;
    }
  }
  return { judgements, runs, by };
}

function pct(n: number, d: number): string {
  if (!d) return "n/a";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function cell(a: Agg | undefined, k: string): string {
  if (!a) return "n/a";
  switch (k) {
    case "recall": return `${a.recalled}/${a.facts} (${pct(a.recalled, a.facts)})`;
    case "falseFacts": return `${a.falseFacts}/${a.facts} (${pct(a.falseFacts, a.facts)})`;
    case "falseWrites": return `${a.falseWrites}/${a.facts} (${pct(a.falseWrites, a.facts)})`;
    case "wrongId": return `${a.wrongIdentity}/${a.facts} (${pct(a.wrongIdentity, a.facts)})`;
    case "silent": return `${a.silentOmissions}/${a.facts} (${pct(a.silentOmissions, a.facts)})`;
    case "evidence": return `${a.evidenceGrounded}/${a.evidenceKnown} (${pct(a.evidenceGrounded, a.evidenceKnown)})`;
    case "ambiguity": return `${a.ambiguitySafe}/${a.ambiguityKnown} (${pct(a.ambiguitySafe, a.ambiguityKnown)})`;
    case "clear": return `${a.clearOk}/${a.clearKnown} (${pct(a.clearOk, a.clearKnown)})`;
    case "justified": return String(a.justified);
    case "unnecessary": return String(a.unnecessary);
    case "needsYou": return String(a.needsYou);
    case "left": return String(a.leftUntouched);
    case "noChange": return String(a.noChange);
    case "extra": return String(a.extraWrites);
    case "malformed": return String(a.malformed);
    case "latency": return String(median(a.latencies) ?? "n/a");
    case "prompt": return String(a.promptTokens);
    case "completion": return String(a.completionTokens);
    default: return "";
  }
}

function main() {
  const bake1 = summarize(join(BAKEOFF, "results/stage1"));
  const bake2 = summarize(join(BAKEOFF, "results/stage2"));
  const live1 = existsSync(join(here, "results/stage1/judgements.json"))
    ? summarize(join(here, "results/stage1"))
    : null;
  const live2 = existsSync(join(here, "results/stage2/judgements.json"))
    ? summarize(join(here, "results/stage2"))
    : null;
  const replay1 = existsSync(join(here, "results/replay-stage1/judgements.json"))
    ? summarize(join(here, "results/replay-stage1"))
    : null;
  const live3 = existsSync(join(here, "results/stage3/judgements.json"))
    ? summarize(join(here, "results/stage3"))
    : null;

  const rows: Array<[string, string]> = [
    ["material fact recall", "recall"],
    ["false material facts", "falseFacts"],
    ["false / unsafe writes", "falseWrites"],
    ["wrong identity", "wrongId"],
    ["silent omissions", "silent"],
    ["evidence grounding", "evidence"],
    ["ambiguity safety", "ambiguity"],
    ["clear-input automation", "clear"],
    ["justified intervention", "justified"],
    ["unnecessary intervention", "unnecessary"],
    ["Needs You items", "needsYou"],
    ["Left untouched items", "left"],
    ["No change items", "noChange"],
    ["extra unmatched writes", "extra"],
    ["malformed cases", "malformed"],
    ["median latency ms", "latency"],
    ["prompt tokens", "prompt"],
    ["completion tokens", "completion"],
  ];

  function table(title: string, bake: ReturnType<typeof summarize>, gate2: Agg | undefined) {
    const lines = [
      `## ${title}`,
      "",
      `| Metric | Simplification | AI-first Gate 2 | Current+4o-mini | AI-first Gate 1 |`,
      `| --- | --- | --- | --- | --- |`,
    ];
    for (const [label, key] of rows) {
      lines.push(
        `| ${label} | ${cell(bake.by.get("simplification"), key)} | ${cell(gate2, key)} | ${cell(bake.by.get("current"), key)} | ${cell(bake.by.get("ai-first"), key)} |`,
      );
    }
    return lines.join("\n");
  }

  function factFlags(row: CaseJudgement | undefined) {
    if (!row) {
      return { recalled: 0, falseWrites: 0, wrongId: 0, silent: 0, unnecessary: 0 };
    }
    return {
      recalled: row.facts.filter((f) => f.recalled).length,
      falseWrites: row.facts.filter((f) => f.falseUnsafeWrite).length,
      wrongId: row.facts.filter((f) => f.wrongIdentity).length,
      silent: row.facts.filter((f) => f.silentOmission).length,
      unnecessary: row.facts.filter((f) => f.unnecessaryIntervention).length,
    };
  }

  function byCase(rows: CaseJudgement[]): Map<string, CaseJudgement> {
    const map = new Map<string, CaseJudgement>();
    for (const row of rows) {
      if (row.repeatIndex === 1 || !map.has(row.caseId)) map.set(row.caseId, row);
    }
    return map;
  }

  const md = [
    "# Gate 2 vs Simplification",
    "",
    `Special-case rules: ${GATE2_SPECIAL_CASE_COUNT}`,
    GATE2_SPECIAL_CASES.map((s) => `- ${s}`).join("\n"),
    "",
    replay1 ? table("Replay of frozen Gate 1 envelopes through Gate 2 (paired)", bake1, replay1.by.get("ai-first")) : "_Replay not present._",
    "",
    live1 ? table("Live Astra + Gate 2 Stage 1", bake1, live1.by.get("ai-first")) : "_Live Stage 1 not present._",
    "",
    live2 ? table("Live Stage 2", bake2, live2.by.get("ai-first")) : "_Live Stage 2 not present._",
    "",
    live3 ? table("Stage 3 in-memory Apply", summarize(join(BAKEOFF, "results/stage3")), live3.by.get("ai-first")) : "_Stage 3 not present._",
    "",
  ].join("\n");

  mkdirSync(join(here, "results"), { recursive: true });
  writeFileSync(join(here, "results/comparison.md"), md);

  const gate2Source = replay1 ?? live1;
  if (gate2Source) {
    const simp = byCase(bake1.judgements.filter((j) => j.contender === "simplification"));
    const gate1 = byCase(bake1.judgements.filter((j) => j.contender === "ai-first"));
    const gate2 = byCase(gate2Source.judgements.filter((j) => j.contender === "ai-first"));
    const ids = [...new Set([...simp.keys(), ...gate1.keys(), ...gate2.keys()])].sort();
    const lines = [
      "# Per-case Stage 1 (r1)",
      "",
      "| Case | Simp false writes | Gate1 false writes | Gate2 false writes | Simp wrong id | Gate1 wrong id | Gate2 wrong id | Simp silent | Gate2 silent | Gate1 unnec | Gate2 unnec |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ];
    for (const id of ids) {
      const s = factFlags(simp.get(id));
      const g1 = factFlags(gate1.get(id));
      const g2 = factFlags(gate2.get(id));
      lines.push(
        `| ${id} | ${s.falseWrites} | ${g1.falseWrites} | ${g2.falseWrites} | ${s.wrongId} | ${g1.wrongId} | ${g2.wrongId} | ${s.silent} | ${g2.silent} | ${g1.unnecessary} | ${g2.unnecessary} |`,
      );
    }
    writeFileSync(join(here, "results/paired-cases.md"), `${lines.join("\n")}\n`);
  }

  console.log("wrote results/comparison.md");
}

main();
