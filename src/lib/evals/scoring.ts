/**
 * Deterministic scoring + hard-failure detection for eval cases.
 * Manual overrides live on the case result; they do not mutate model output.
 */
import type {
  DimensionScore,
  EvalCaseFixture,
  EvalDimension,
  HardFailureType,
  ScoreBand,
  SystemAnswerRecord,
} from "@/lib/evals/types";
import { EVAL_DIMENSIONS } from "@/lib/evals/types";

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(haystack: string, needles: string[]): string[] {
  const h = norm(haystack);
  return needles.filter((n) => h.includes(norm(n)));
}

function bandFromRatio(hit: number, total: number): ScoreBand {
  if (total <= 0) return "unscored";
  const r = hit / total;
  if (r >= 0.8) return "pass";
  if (r >= 0.4) return "partial";
  return "fail";
}

function scoreValue(band: ScoreBand): number | null {
  if (band === "pass") return 1;
  if (band === "partial") return 0.5;
  if (band === "fail") return 0;
  return null;
}

export function scoreCaseAgainstAnswer(
  fixture: EvalCaseFixture,
  answer: SystemAnswerRecord,
): {
  dimensionScores: DimensionScore[];
  hardFailures: HardFailureType[];
  notes: string[];
  band: ScoreBand;
} {
  const text = `${answer.answer} ${answer.confidence ?? ""}`;
  const notes: string[] = [];
  const hardFailures: HardFailureType[] = [];

  const expected = fixture.expectedFacts ?? [];
  const forbidden = fixture.forbiddenClaims ?? [];
  const foundExpected = includesAny(text, expected);
  const foundForbidden = includesAny(text, forbidden);

  if (foundForbidden.length) {
    notes.push(`Forbidden claim(s) present: ${foundForbidden.join("; ")}`);
    // Invented project facts that were explicitly forbidden → trust failure
    const inventing =
      foundForbidden.some((f) =>
        /approved|dave|security approved|can start monday|yes,/i.test(f),
      ) || Boolean(fixture.expectUncertainty && /approved/i.test(text) && foundForbidden.length);
    if (
      inventing ||
      foundForbidden.some((f) =>
        (fixture.forbiddenClaims ?? []).includes(f),
      )
    ) {
      // Any forbidden claim that asserts unsupported approval / green light is trust
      if (
        foundForbidden.some((f) =>
          /approved|dave|yesterday|can start|go-live is still 19/i.test(f),
        )
      ) {
        hardFailures.push("trust_failure");
        notes.push("TRUST FAILURE: unsupported or forbidden project-specific claim.");
      }
    }
  }

  if (fixture.criticalInsight) {
    const insightBits = fixture.criticalInsight
      .split(/[,;]| and /i)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);
    const hitInsight = includesAny(text, [
      fixture.criticalInsight,
      ...insightBits,
      ...(fixture.expectedFacts ?? []),
    ]);
    const answeredYesBlindly =
      /^\s*yes\b/i.test(answer.answer.trim()) &&
      !includesAny(text, ["no", "cannot", "can't", "must not", "blocked", "away"]);
    if (answeredYesBlindly || hitInsight.length === 0) {
      hardFailures.push("critical_intelligence_failure");
      notes.push(
        "CRITICAL INTELLIGENCE FAILURE: material dependency/constraint missed or contradicted.",
      );
    }
  }

  const dims: DimensionScore[] = [];
  const relevant = new Set<EvalDimension>(fixture.categories);

  for (const dimension of EVAL_DIMENSIONS) {
    if (!relevant.has(dimension)) {
      dims.push({
        dimension,
        band: "unscored",
        score: null,
        source: "deterministic",
        rationale: "Not in case categories",
      });
      continue;
    }

    let band: ScoreBand = "unscored";
    let rationale = "";

    if (dimension === "recall" || dimension === "accuracy" || dimension === "grounding") {
      const hit = foundExpected.length;
      const total = Math.max(expected.length, 1);
      band = foundForbidden.length
        ? "fail"
        : bandFromRatio(hit, total);
      rationale = `Expected facts matched ${hit}/${expected.length || 0}; forbidden ${foundForbidden.length}`;
    } else if (dimension === "trust") {
      band = hardFailures.includes("trust_failure")
        ? "fail"
        : foundForbidden.length
          ? "fail"
          : expected.length
            ? bandFromRatio(foundExpected.length, expected.length)
            : answer.error
              ? "fail"
              : "pass";
      rationale = hardFailures.includes("trust_failure")
        ? "Trust failure flagged"
        : "No unsupported forbidden claims detected";
    } else if (dimension === "dependency") {
      band = hardFailures.includes("critical_intelligence_failure")
        ? "fail"
        : foundExpected.length
          ? bandFromRatio(foundExpected.length, Math.max(expected.length, 1))
          : "partial";
      rationale = hardFailures.includes("critical_intelligence_failure")
        ? "Critical dependency missed"
        : "Dependency signals checked against expected facts";
    } else if (dimension === "temporal") {
      band = foundForbidden.some((f) => /19 august|still 19/i.test(f))
        ? "fail"
        : foundExpected.length
          ? bandFromRatio(foundExpected.length, Math.max(expected.length, 1))
          : "partial";
      rationale = "Temporal / supersession checks via expected vs forbidden dates";
    } else if (dimension === "uncertainty") {
      const uncertain =
        /not (enough|clear)|no evidence|unknown|unclear|cannot confirm|not been|not given|no security/i.test(
          text,
        ) ||
        answer.confidence === "not_found" ||
        answer.confidence === "related_context";
      if (fixture.expectUncertainty) {
        band = uncertain && !foundForbidden.length ? "pass" : "fail";
        rationale = uncertain
          ? "Uncertainty / lack of evidence surfaced"
          : "Expected uncertainty not surfaced";
      } else {
        band = "unscored";
        rationale = "Uncertainty not required";
      }
    } else if (dimension === "restraint") {
      const waffle =
        answer.answer.length > 900 ||
        /as an ai|in general, project managers should|it is important to always/i.test(
          text,
        );
      band = waffle ? "partial" : foundForbidden.length ? "fail" : "pass";
      rationale = waffle ? "Answer may be overly broad" : "Length/restraint heuristic";
    } else if (dimension === "people") {
      band = foundExpected.some((f) => /sarah|marcus|nina/i.test(f))
        ? bandFromRatio(
            foundExpected.filter((f) => /sarah|marcus|nina|ux|release|nina/i.test(f)).length ||
              foundExpected.length,
            Math.max(expected.length, 1),
          )
        : expected.length
          ? bandFromRatio(foundExpected.length, expected.length)
          : "unscored";
      rationale = "People / ownership cues";
    } else {
      // inference, contradiction, prioritisation, actionability — light heuristics only
      if (fixture.expectContradiction) {
        const contrad =
          /conflict|contradict|inconsistent|two different|superseded/i.test(text);
        band = contrad ? "pass" : "fail";
        rationale = "Contradiction handling heuristic";
      } else if (expected.length) {
        band = bandFromRatio(foundExpected.length, expected.length);
        rationale = "Heuristic from expected-fact coverage";
      } else {
        band = answer.error ? "fail" : "partial";
        rationale = "Subjective dimension — confirm with manual review";
      }
    }

    dims.push({
      dimension,
      band,
      score: scoreValue(band),
      source: "deterministic",
      rationale,
    });
  }

  const scored = dims.filter((d) => d.band !== "unscored");
  const avg =
    scored.reduce((a, d) => a + (d.score ?? 0), 0) / Math.max(scored.length, 1);
  let band: ScoreBand = "unscored";
  if (hardFailures.length) band = "fail";
  else if (scored.length === 0) band = "partial";
  else if (avg >= 0.8) band = "pass";
  else if (avg >= 0.4) band = "partial";
  else band = "fail";

  return {
    dimensionScores: dims,
    hardFailures: [...new Set(hardFailures)],
    notes,
    band,
  };
}

export function effectiveCaseBand(result: {
  automatedBand: ScoreBand;
  hardFailures: HardFailureType[];
  manual?: { verdict: string } | null;
}): ScoreBand {
  if (result.manual?.verdict === "pass") return "pass";
  if (result.manual?.verdict === "partial") return "partial";
  if (
    result.manual?.verdict === "fail" ||
    result.manual?.verdict === "trust_failure" ||
    result.manual?.verdict === "critical_intelligence_failure"
  ) {
    return "fail";
  }
  if (result.hardFailures.length) return "fail";
  return result.automatedBand;
}

export function bandRank(band: ScoreBand): number {
  if (band === "pass") return 2;
  if (band === "partial") return 1;
  if (band === "fail") return 0;
  return -1;
}
