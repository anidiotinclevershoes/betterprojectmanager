/**
 * Compare Simplification+Astra against frozen bake-off columns.
 * Reads bake-off results read-only. Does not retune expectations.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CaseJudgement,
  ContenderId,
  ContenderRun,
  FrozenManifest,
  NormalizedItem,
} from "../capture-three-way-bakeoff/types";

const here = dirname(fileURLToPath(import.meta.url));
const BAKEOFF = join(here, "../capture-three-way-bakeoff");

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

function summarizeStage(stageDir: string) {
  const judgements = existsSync(join(stageDir, "judgements.json"))
    ? loadJson<CaseJudgement[]>(join(stageDir, "judgements.json"))
    : [];
  const runs = existsSync(join(stageDir, "runs.json"))
    ? loadJson<ContenderRun[]>(join(stageDir, "runs.json"))
    : [];
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

const WATCH = [
  "c5-timber-floor",
  "mixed-domains",
  "mixed-clear-and-unclear",
  "similar-name-exact",
  "similar-name-spelling",
  "responsibility-continues",
  "explicit-ownership-first",
  "contradict-packaging",
  "correction-of-wording",
  "title-only-existing-target",
];

function pct(n: number, d: number): string {
  if (!d) return "n/a";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function extractSignals(run: ContenderRun) {
  const raw = run.raw as {
    modelJson?: { observations?: Array<Record<string, unknown>> };
    resolved?: Array<Record<string, unknown>>;
  } | null;
  const observations = raw?.modelJson?.observations ?? [];
  const dispositions: Record<string, number> = {};
  for (const item of run.normalized) {
    dispositions[item.disposition] = (dispositions[item.disposition] ?? 0) + 1;
  }
  let uncertain = 0;
  let omitIds = 0;
  for (const obs of observations) {
    if (obs.truthIntent === "uncertain") uncertain += 1;
    const id = obs.candidateTargetId;
    if (typeof id === "string" && ["omit", "omitted", "none"].includes(id.trim().toLowerCase())) {
      omitIds += 1;
    }
  }
  return {
    observationCount: observations.length,
    uncertainTruthIntent: uncertain,
    omitLikeTargetIds: omitIds,
    dispositions,
    writeProposed: run.normalized.filter((n: NormalizedItem) => n.writeProposed).length,
  };
}

function cell(agg: Agg | undefined, kind: string): string {
  if (!agg) return "n/a";
  switch (kind) {
    case "recall":
      return `${agg.recalled}/${agg.facts} (${pct(agg.recalled, agg.facts)})`;
    case "falseFacts":
      return `${agg.falseFacts}/${agg.facts} (${pct(agg.falseFacts, agg.facts)})`;
    case "falseWrites":
      return `${agg.falseWrites}/${agg.facts} (${pct(agg.falseWrites, agg.facts)})`;
    case "wrongId":
      return `${agg.wrongIdentity}/${agg.facts} (${pct(agg.wrongIdentity, agg.facts)})`;
    case "silent":
      return `${agg.silentOmissions}/${agg.facts} (${pct(agg.silentOmissions, agg.facts)})`;
    case "evidence":
      return `${agg.evidenceGrounded}/${agg.evidenceKnown} (${pct(agg.evidenceGrounded, agg.evidenceKnown)})`;
    case "ambiguity":
      return `${agg.ambiguitySafe}/${agg.ambiguityKnown} (${pct(agg.ambiguitySafe, agg.ambiguityKnown)})`;
    case "clear":
      return `${agg.clearOk}/${agg.clearKnown} (${pct(agg.clearOk, agg.clearKnown)})`;
    case "justified":
      return String(agg.justified);
    case "unnecessary":
      return String(agg.unnecessary);
    case "extra":
      return String(agg.extraWrites);
    case "malformed":
      return String(agg.malformed);
    case "latency":
      return String(median(agg.latencies) ?? "n/a");
    case "range":
      return agg.latencies.length ? `${Math.min(...agg.latencies)}–${Math.max(...agg.latencies)}` : "n/a";
    case "prompt":
      return String(agg.promptTokens);
    case "completion":
      return String(agg.completionTokens);
    default:
      return "";
  }
}

function main() {
  const manifest = loadJson<FrozenManifest>(join(BAKEOFF, "FROZEN_CORPUS.json"));
  const bake1 = summarizeStage(join(BAKEOFF, "results/stage1"));
  const bake2 = summarizeStage(join(BAKEOFF, "results/stage2"));
  const bake3 = summarizeStage(join(BAKEOFF, "results/stage3"));
  const astra1 = existsSync(join(here, "results/stage1/judgements.json"))
    ? summarizeStage(join(here, "results/stage1"))
    : null;
  const astra2 = existsSync(join(here, "results/stage2/judgements.json"))
    ? summarizeStage(join(here, "results/stage2"))
    : null;
  const astra3 = existsSync(join(here, "results/stage3/judgements.json"))
    ? summarizeStage(join(here, "results/stage3"))
    : null;

  const astraAgg1 = astra1?.byContender.get("simplification");
  const astraAgg2 = astra2?.byContender.get("simplification");
  const astraAgg3 = astra3?.byContender.get("simplification");

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
    ["extra unmatched writes", "extra"],
    ["malformed cases", "malformed"],
    ["median latency ms", "latency"],
    ["latency range ms", "range"],
    ["prompt tokens", "prompt"],
    ["completion tokens", "completion"],
  ];

  function fourCol(stage: "1" | "2" | "3", bake: ReturnType<typeof summarizeStage>, astra: Agg | undefined) {
    const lines = [
      `| Metric | Current+4o-mini | Simplification+4o-mini | Simplification+Astra | AI-first+Astra |`,
      `| --- | --- | --- | --- | --- |`,
    ];
    for (const [label, key] of rows) {
      lines.push(
        `| ${label} | ${cell(bake.byContender.get("current"), key)} | ${cell(bake.byContender.get("simplification"), key)} | ${cell(astra, key)} | ${cell(bake.byContender.get("ai-first"), key)} |`,
      );
    }
    return lines;
  }

  const astraRuns1 = astra1?.runs ?? [];
  const modelMismatch = astraRuns1.filter(
    (r) => r.requestedModel !== "gpt-6-astra" || r.responseModel !== "gpt-6-astra",
  );
  const signals = astraRuns1.map((r) => ({ caseId: r.caseId, ...extractSignals(r) }));
  const bakeRuns1 = bake1.runs.filter((r) => r.contender === "simplification" && r.repeatIndex === 1);
  const bakeSignals = bakeRuns1.map((r) => ({ caseId: r.caseId, ...extractSignals(r) }));

  function watchRow(caseId: string) {
    const frozen = manifest.cases.find((c) => c.id === caseId);
    const astraJ = astra1?.judgements.find((j) => j.caseId === caseId);
    const astraR = astraRuns1.find((r) => r.caseId === caseId);
    const cols: Record<string, { note: string; writes: string[] }> = {};
    for (const id of ["current", "simplification", "ai-first"] as const) {
      const j = bake1.judgements.find((x) => x.caseId === caseId && x.contender === id);
      const r = bake1.runs.find((x) => x.caseId === caseId && x.contender === id && x.repeatIndex === 1);
      cols[id] = {
        note: j?.facts.map((f) => f.note).join(" | ") ?? "missing",
        writes: (r?.normalized ?? []).filter((n) => n.writeProposed).map((n) => `${n.disposition}:${n.domain}:${n.referencedCanonicalId}`),
      };
    }
    cols["simplification-astra"] = {
      note: astraJ?.facts.map((f) => f.note).join(" | ") ?? "missing",
      writes: (astraR?.normalized ?? []).filter((n) => n.writeProposed).map((n) => `${n.disposition}:${n.domain}:${n.referencedCanonicalId}`),
    };
    return { caseId, title: frozen?.title ?? caseId, cols };
  }

  const stage2Var: Record<string, number> = {};
  if (astra2) {
    const sigs = new Map<string, Set<string>>();
    for (const j of astra2.judgements) {
      if (!sigs.has(j.caseId)) sigs.set(j.caseId, new Set());
      sigs.get(j.caseId)!.add(j.facts.map((f) => `${f.factId}:${f.note}`).join("|") + ` extra=${j.extraWrites.join(",")}`);
    }
    for (const [id, set] of sigs) stage2Var[id] = set.size;
  }

  const md = [
    "# Simplification + Astra control comparison",
    "",
    "Bake-off results are read-only. Expected outcomes were not retuned.",
    "",
    `Model mismatches (requested/response ≠ gpt-6-astra): ${modelMismatch.length}`,
    "",
    "## Stage 1 — full frozen corpus",
    "",
    ...fourCol("1", bake1, astraAgg1),
    "",
    "## Stage 2 — repeated live",
    "",
    ...(astra2 ? fourCol("2", bake2, astraAgg2) : ["_Stage 2 not present._"]),
    "",
    "## Stage 3 — in-memory Apply (Current / Simplification / Simplification+Astra only)",
    "",
    "AI-first is Gate 1 semantic interpretation only and is not Apply-capable.",
    "",
    ...(astra3 ? fourCol("3", bake3, astraAgg3) : ["_Stage 3 not present._"]),
    "",
    "## Watch cases (Stage 1 notes)",
    "",
    ...WATCH.flatMap((id) => {
      const row = watchRow(id);
      return [
        `### ${row.caseId}`,
        "",
        `- Current: ${row.cols.current.note} writes=${JSON.stringify(row.cols.current.writes)}`,
        `- Simplification+4o-mini: ${row.cols.simplification.note} writes=${JSON.stringify(row.cols.simplification.writes)}`,
        `- Simplification+Astra: ${row.cols["simplification-astra"].note} writes=${JSON.stringify(row.cols["simplification-astra"].writes)}`,
        `- AI-first+Astra: ${row.cols["ai-first"].note} writes=${JSON.stringify(row.cols["ai-first"].writes)}`,
        "",
      ];
    }),
    "",
    "## Stage 2 uniqueness (Simplification+Astra)",
    "",
    Object.entries(stage2Var)
      .filter(([, n]) => n > 1)
      .map(([id, n]) => `- ${id}: ${n} distinct judgement signatures`)
      .join("\n") || "_No unstable cases._",
    "",
  ].join("\n");

  mkdirSync(join(here, "results"), { recursive: true });
  writeFileSync(join(here, "results/comparison.md"), md);
  writeFileSync(
    join(here, "results/comparison.json"),
    `${JSON.stringify(
      {
        modelMismatch: modelMismatch.map((r) => ({
          caseId: r.caseId,
          requested: r.requestedModel,
          response: r.responseModel,
        })),
        stage1: astraAgg1 ?? null,
        stage2: astraAgg2 ?? null,
        stage3: astraAgg3 ?? null,
        signals,
        bakeSignalsSimplification: bakeSignals,
        stage2Var,
        watch: WATCH.map(watchRow),
      },
      null,
      2,
    )}\n`,
  );
  console.log("wrote results/comparison.md");
}

main();
