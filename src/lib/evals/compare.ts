import type {
  CaseComparison,
  CaseComparisonClass,
  EvalCaseResult,
  EvalDimension,
  EvalRunRecord,
  EvalRunSummary,
  RunComparison,
  ScoreBand,
} from "@/lib/evals/types";
import { EVAL_DIMENSIONS } from "@/lib/evals/types";
import { bandRank, effectiveCaseBand } from "@/lib/evals/scoring";

export function summariseCaseResults(cases: EvalCaseResult[]): EvalRunSummary {
  const dimensionSums: Record<string, { sum: number; n: number }> = {};
  let lumePass = 0;
  let lumePartial = 0;
  let lumeFail = 0;
  let baselinePass = 0;
  let baselinePartial = 0;
  let baselineFail = 0;
  let lumeWins = 0;
  let gptWins = 0;
  let ties = 0;
  let trustFailures = 0;
  let criticalIntelligenceFailures = 0;
  let errorCases = 0;
  let lumeTokens = 0;
  let baselineTokens = 0;
  let lumeTokenN = 0;
  let baselineTokenN = 0;

  for (const c of cases) {
    if (c.lume.error) errorCases += 1;
    const lumeBand = effectiveCaseBand(c);
    const baseBand = c.baseline.error
      ? ("fail" as ScoreBand)
      : c.automatedBand; // baseline uses automated only for fair compare helper below
    // Re-score baseline band lightly from its own automated path stored on case:
    // We store one automatedBand for Lume; compute baseline compare via dimension avg.
    const lumeAvg = avgScore(c, "lume");
    const baseAvg = avgScore(c, "baseline");

    if (lumeBand === "pass") lumePass += 1;
    else if (lumeBand === "partial") lumePartial += 1;
    else if (lumeBand === "fail") lumeFail += 1;

    // Baseline band from its answer quality vs same fixture is stored in dimensionScores
    // which were computed against Lume. For baseline we keep a simple win/tie using text heuristics
    // already run separately — see runner which sets baselinePass via parallel scoring.
    void baseBand;

    if ((lumeAvg ?? -1) > (baseAvg ?? -1) + 0.05) lumeWins += 1;
    else if ((baseAvg ?? -1) > (lumeAvg ?? -1) + 0.05) gptWins += 1;
    else ties += 1;

    if (c.hardFailures.includes("trust_failure")) trustFailures += 1;
    if (c.hardFailures.includes("critical_intelligence_failure")) {
      criticalIntelligenceFailures += 1;
    }
    if (c.manual?.verdict === "trust_failure") trustFailures += 1;
    if (c.manual?.verdict === "critical_intelligence_failure") {
      criticalIntelligenceFailures += 1;
    }

    for (const d of c.dimensionScores) {
      if (d.score == null) continue;
      const slot = dimensionSums[d.dimension] ?? { sum: 0, n: 0 };
      slot.sum += d.score;
      slot.n += 1;
      dimensionSums[d.dimension] = slot;
    }

    if (c.lume.usage?.total_tokens != null) {
      lumeTokens += c.lume.usage.total_tokens;
      lumeTokenN += 1;
    }
    if (c.baseline.usage?.total_tokens != null) {
      baselineTokens += c.baseline.usage.total_tokens;
      baselineTokenN += 1;
    }
  }

  const dimensionAverages: Partial<Record<EvalDimension, number | null>> = {};
  for (const dim of EVAL_DIMENSIONS) {
    const slot = dimensionSums[dim];
    dimensionAverages[dim] = slot && slot.n ? slot.sum / slot.n : null;
  }

  return {
    totalCases: cases.length,
    completedCases: cases.filter((c) => !c.lume.error).length,
    errorCases,
    skippedCases: 0,
    lumePass,
    lumePartial,
    lumeFail,
    baselinePass,
    baselinePartial,
    baselineFail,
    lumeWins,
    gptWins,
    ties,
    trustFailures,
    criticalIntelligenceFailures,
    dimensionAverages,
    lumeTotalTokens: lumeTokenN ? lumeTokens : null,
    baselineTotalTokens: baselineTokenN ? baselineTokens : null,
  };
}

function avgScore(
  c: EvalCaseResult,
  who: "lume" | "baseline",
): number | null {
  // Dimension scores are computed against the Lume answer in the runner.
  // For baseline comparison we also attach `baselineDimensionAvg` via automatedNotes? 
  // Simpler: runner stores baseline band in automatedNotes prefix — instead parse from a field.
  // We'll use case.baseline + re-read from a dedicated optional field by packing into raw.
  const packed = (c.baseline.raw as { evalBand?: ScoreBand; evalAvg?: number } | undefined);
  if (who === "baseline") {
    return packed?.evalAvg ?? null;
  }
  const scored = c.dimensionScores.filter((d) => d.score != null);
  if (!scored.length) return null;
  return scored.reduce((a, d) => a + (d.score ?? 0), 0) / scored.length;
}

export function attachBaselineScoreMeta(
  result: EvalCaseResult,
  baselineBand: ScoreBand,
  baselineAvg: number | null,
): EvalCaseResult {
  return {
    ...result,
    baseline: {
      ...result.baseline,
      raw: {
        ...(typeof result.baseline.raw === "object" && result.baseline.raw
          ? (result.baseline.raw as object)
          : {}),
        evalBand: baselineBand,
        evalAvg: baselineAvg,
      },
    },
  };
}

export function finaliseSummaryWithBaseline(
  cases: EvalCaseResult[],
): EvalRunSummary {
  const base = summariseCaseResults(cases);
  let baselinePass = 0;
  let baselinePartial = 0;
  let baselineFail = 0;
  for (const c of cases) {
    const packed = c.baseline.raw as { evalBand?: ScoreBand } | undefined;
    const band = packed?.evalBand ?? "unscored";
    if (band === "pass") baselinePass += 1;
    else if (band === "partial") baselinePartial += 1;
    else if (band === "fail") baselineFail += 1;
  }
  return { ...base, baselinePass, baselinePartial, baselineFail };
}

export function classifyCaseChange(
  a: EvalCaseResult | null,
  b: EvalCaseResult | null,
): CaseComparisonClass[] {
  if (!a || !b) return ["no_meaningful_change"];
  const classes: CaseComparisonClass[] = [];
  const bandA = effectiveCaseBand(a);
  const bandB = effectiveCaseBand(b);
  const rankA = bandRank(bandA);
  const rankB = bandRank(bandB);

  const trustA = a.hardFailures.includes("trust_failure") || a.manual?.verdict === "trust_failure";
  const trustB = b.hardFailures.includes("trust_failure") || b.manual?.verdict === "trust_failure";
  const critA =
    a.hardFailures.includes("critical_intelligence_failure") ||
    a.manual?.verdict === "critical_intelligence_failure";
  const critB =
    b.hardFailures.includes("critical_intelligence_failure") ||
    b.manual?.verdict === "critical_intelligence_failure";

  if (!trustA && trustB) classes.push("trust_failure_introduced");
  if (trustA && !trustB) classes.push("trust_failure_resolved");
  if (!critA && critB) classes.push("critical_failure_introduced");
  if (critA && !critB) classes.push("critical_failure_resolved");

  if (rankA < 2 && rankB === 2) classes.push("failed_to_passed");
  if (rankA === 2 && rankB < 2) classes.push("passed_to_failed");

  if (rankB > rankA) classes.push("improved");
  else if (rankB < rankA) classes.push("regressed");
  else if (
    !classes.some((c) =>
      c.includes("trust") || c.includes("critical") || c.includes("passed") || c.includes("failed"),
    )
  ) {
    classes.push("no_meaningful_change");
  }

  return [...new Set(classes)];
}

export function compareRuns(
  runA: EvalRunRecord,
  runB: EvalRunRecord,
): RunComparison {
  const mapA = new Map(runA.cases.map((c) => [c.caseId, c]));
  const mapB = new Map(runB.cases.map((c) => [c.caseId, c]));
  const ids = new Set([...mapA.keys(), ...mapB.keys()]);

  const cases: CaseComparison[] = [];
  for (const id of ids) {
    const a = mapA.get(id) ?? null;
    const b = mapB.get(id) ?? null;
    cases.push({
      caseId: id,
      question: b?.question ?? a?.question ?? id,
      worldId: b?.worldId ?? a?.worldId ?? "",
      classification: classifyCaseChange(a, b),
      runA: a,
      runB: b,
    });
  }

  const regressions = cases.filter((c) =>
    c.classification.some((x) =>
      [
        "regressed",
        "passed_to_failed",
        "trust_failure_introduced",
        "critical_failure_introduced",
      ].includes(x),
    ),
  );
  const improvements = cases.filter((c) =>
    c.classification.some((x) =>
      [
        "improved",
        "failed_to_passed",
        "trust_failure_resolved",
        "critical_failure_resolved",
      ].includes(x),
    ),
  );

  const dimensionDeltas: Partial<Record<EvalDimension, number | null>> = {};
  for (const dim of EVAL_DIMENSIONS) {
    const a = runA.summary.dimensionAverages[dim];
    const b = runB.summary.dimensionAverages[dim];
    dimensionDeltas[dim] =
      a == null || b == null ? null : Math.round((b - a) * 1000) / 1000;
  }

  return {
    runA,
    runB,
    summaryDeltas: {
      lumePassDelta: runB.summary.lumePass - runA.summary.lumePass,
      trustFailuresDelta:
        runB.summary.trustFailures - runA.summary.trustFailures,
      criticalFailuresDelta:
        runB.summary.criticalIntelligenceFailures -
        runA.summary.criticalIntelligenceFailures,
      lumeWinsDelta: runB.summary.lumeWins - runA.summary.lumeWins,
      dimensionDeltas,
    },
    cases,
    regressions,
    improvements,
  };
}
