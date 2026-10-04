/**
 * Qualitative case tables for the bake-off report.
 * Reads frozen judgements only. Does not retune expectations.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseJudgement, ContenderId, ContenderRun, FrozenManifest } from "./types";

const here = dirname(fileURLToPath(import.meta.url));

function load<T>(p: string): T {
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

type Row = {
  caseId: string;
  historical: boolean;
  category: string;
  scores: Record<ContenderId, {
    silent: number;
    falseWrite: number;
    wrongId: number;
    recalled: number;
    facts: number;
    unsafe: number;
    unnecessary: number;
    justified: number;
    extra: number;
    ok: boolean;
    model: string | null;
    latency: number | null;
  }>;
};

function factScore(j: CaseJudgement) {
  return {
    silent: j.facts.filter((f) => f.silentOmission).length,
    falseWrite: j.facts.filter((f) => f.falseUnsafeWrite).length,
    wrongId: j.facts.filter((f) => f.wrongIdentity).length,
    recalled: j.facts.filter((f) => f.recalled).length,
    facts: j.facts.length,
    unsafe: j.facts.filter((f) => f.falseUnsafeWrite || f.wrongIdentity).length + j.extraWrites.length,
    unnecessary: j.facts.filter((f) => f.unnecessaryIntervention).length,
    justified: j.facts.filter((f) => f.justifiedIntervention).length,
    extra: j.extraWrites.length,
  };
}

function main() {
  const manifest = load<FrozenManifest>(join(here, "FROZEN_CORPUS.json"));
  const s1j = load<CaseJudgement[]>(join(here, "results/stage1/judgements.json"));
  const s1r = load<ContenderRun[]>(join(here, "results/stage1/runs.json"));
  const s2j = load<CaseJudgement[]>(join(here, "results/stage2/judgements.json"));
  const s3j = load<CaseJudgement[]>(join(here, "results/stage3/judgements.json"));
  const s3r = load<ContenderRun[]>(join(here, "results/stage3/runs.json"));

  const runBy = new Map<string, ContenderRun>();
  for (const r of s1r) runBy.set(`${r.contender}:${r.caseId}:${r.repeatIndex}`, r);

  const rows: Row[] = [];
  for (const frozen of manifest.cases) {
    const scores = {} as Row["scores"];
    for (const c of ["current", "simplification", "ai-first"] as ContenderId[]) {
      const j = s1j.find((x) => x.caseId === frozen.id && x.contender === c && x.repeatIndex === 1);
      const r = runBy.get(`${c}:${frozen.id}:1`);
      scores[c] = {
        ...(j ? factScore(j) : {
          silent: 0, falseWrite: 0, wrongId: 0, recalled: 0, facts: 0,
          unsafe: 0, unnecessary: 0, justified: 0, extra: 0,
        }),
        ok: Boolean(r?.ok),
        model: r?.responseModel ?? null,
        latency: r?.latencyMs ?? null,
      };
    }
    rows.push({
      caseId: frozen.id,
      historical: frozen.historical,
      category: frozen.category,
      scores,
    });
  }

  function harm(s: Row["scores"][ContenderId]) {
    return s.falseWrite * 100 + s.wrongId * 80 + s.silent * 40 + s.extra * 10 - s.recalled;
  }

  const currentWins: string[] = [];
  const simplWins: string[] = [];
  const aiWins: string[] = [];
  const allFail: string[] = [];
  const ties: string[] = [];

  for (const row of rows) {
    const c = harm(row.scores.current);
    const s = harm(row.scores.simplification);
    const a = harm(row.scores["ai-first"]);
    const fail = (x: Row["scores"][ContenderId]) =>
      x.falseWrite > 0 || x.wrongId > 0 || x.silent > 0;
    if (fail(row.scores.current) && fail(row.scores.simplification) && fail(row.scores["ai-first"])) {
      allFail.push(row.caseId);
    }
    const best = Math.min(c, s, a);
    const winners = [
      c === best ? "current" : null,
      s === best ? "simplification" : null,
      a === best ? "ai-first" : null,
    ].filter(Boolean);
    if (winners.length === 1) {
      if (winners[0] === "current" && (c < s - 5 || c < a - 5)) currentWins.push(row.caseId);
      if (winners[0] === "simplification" && (s < c - 5 || s < a - 5)) simplWins.push(row.caseId);
      if (winners[0] === "ai-first" && (a < c - 5 || a < s - 5)) aiWins.push(row.caseId);
    } else ties.push(row.caseId);
  }

  // stage 2 stability: unique disposition signatures per case/contender
  const stage2Var: Record<string, Record<ContenderId, { unique: number; runs: number }>> = {};
  for (const j of s2j) {
    stage2Var[j.caseId] ??= {
      current: { unique: 0, runs: 0 },
      simplification: { unique: 0, runs: 0 },
      "ai-first": { unique: 0, runs: 0 },
    };
  }
  const sigs = new Map<string, Set<string>>();
  for (const j of s2j) {
    const key = `${j.contender}:${j.caseId}`;
    if (!sigs.has(key)) sigs.set(key, new Set());
    const sig = j.facts.map((f) => `${f.factId}:${f.note}`).join("|") + ` extra=${j.extraWrites.join(",")}`;
    sigs.get(key)!.add(sig);
    stage2Var[j.caseId][j.contender].runs += 1;
  }
  for (const [key, set] of sigs) {
    const [contender, caseId] = key.split(":") as [ContenderId, string];
    stage2Var[caseId][contender].unique = set.size;
  }

  const applyDiffs = s3r.map((r) => ({
    caseId: r.caseId,
    contender: r.contender,
    apply: r.apply,
    writes: r.normalized.filter((n) => n.writeProposed).map((n) => `${n.disposition}:${n.domain}:${n.referencedCanonicalId}:${n.subject}`),
  }));

  writeFileSync(
    join(here, "results/analysis.json"),
    `${JSON.stringify(
      {
        currentWins,
        simplWins,
        aiWins,
        allFail,
        tiesCount: ties.length,
        rows,
        stage2Var,
        applyDiffs,
      },
      null,
      2,
    )}\n`,
  );
  console.log(JSON.stringify({
    currentWins,
    simplWins,
    aiWins,
    allFail,
    ties: ties.length,
    cases: rows.length,
  }, null, 2));
}

main();
