/**
 * Deterministic scoring + hard-failure detection for eval cases.
 * Manual overrides live on the case result; they do not mutate model output.
 *
 * Calibration notes (Phase 2B):
 * - Forbidden claims are negation-aware (a negated forbidden phrase is not a hit).
 * - Expected facts allow light synonym / flexible matching.
 * - expectUncertainty does not punish firm grounded negatives when evidence is explicit.
 * - criticalInsight failures require missing/contradicted material constraint, not
 *   lexical absence of the insight sentence when the answer already matches required facts.
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

const NEGATION_CUES =
  /\b(not|no|never|n't|cannot|can't|without|unconfirmed|unsigned|unknown|none|neither)\b/i;

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length > 0);
}

/** Window around a match used to detect local negation. */
function windowAround(haystack: string, index: number, length: number): string {
  const start = Math.max(0, index - 48);
  const end = Math.min(haystack.length, index + length + 24);
  return haystack.slice(start, end);
}

/**
 * True if `needle` occurs in `haystack` as a positive claim (not locally negated).
 * Handles "has not officially moved" vs forbidden "officially moved".
 */
export function claimPresentPositively(
  haystackRaw: string,
  needleRaw: string,
): boolean {
  const haystack = norm(haystackRaw);
  const needle = norm(needleRaw);
  if (!needle) return false;

  // Exact / contiguous substring with negation window check
  let from = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) break;
    const ctx = windowAround(haystack, idx, needle.length);
    const before = haystack.slice(Math.max(0, idx - 28), idx);
    // Negation immediately before the claim (e.g. "has not ", "never ", "no ")
    if (
      /\b(not|never|no|without|n't)\s*$/i.test(before) ||
      /\b(has|have|is|was|were|been)\s+not\s+$/i.test(before) ||
      /\bnot\s+(been|yet|officially|formally|actually|been\s+)?$/i.test(before)
    ) {
      from = idx + needle.length;
      continue;
    }
    // Broader: "not ... <needle>" within a short window before the match
    if (NEGATION_CUES.test(before) && before.length <= 28) {
      from = idx + needle.length;
      continue;
    }
    // "No, ..." answering style then later repeating the claim positively —
    // only skip if the needle itself starts with a polarity word already handled.
    void ctx;
    return true;
  }

  // Flexible token match: all significant needle tokens appear in order with small gaps
  const needleToks = tokens(needle).filter((t) => t.length > 2 || /^\d/.test(t));
  if (needleToks.length >= 2) {
    const hayToks = tokens(haystack);
    let hi = 0;
    let first = -1;
    let last = -1;
    for (const nt of needleToks) {
      let found = -1;
      for (let i = hi; i < hayToks.length; i += 1) {
        if (hayToks[i] === nt || (nt.length > 4 && hayToks[i]!.startsWith(nt))) {
          found = i;
          break;
        }
      }
      if (found < 0) {
        first = -1;
        break;
      }
      if (first < 0) first = found;
      last = found;
      hi = found + 1;
    }
    if (first >= 0 && last >= first) {
      // Span too wide → likely not the same claim
      if (last - first > needleToks.length + 6) return false;
      // Only inspect tokens from first match through last (not leading "No, …")
      const inner = hayToks.slice(first, last + 1).join(" ");
      const prefix = hayToks.slice(Math.max(0, first - 2), first).join(" ");
      if (/\b(not|never|n't|without)\b/.test(inner)) return false;
      if (/\b(not|never|no|n't)\b/.test(prefix)) return false;
      return true;
    }
  }

  return false;
}

const FACT_SYNONYMS: Array<[RegExp, RegExp]> = [
  [/not selected|has not been selected|not been selected|is not a selected/i, /not selected|has not been selected|not been selected|is not (a )?selected|wasn't selected|was not selected/i],
  [/no security approval|not approved|has not approved|security has not/i, /no security approval|not approved|has not approved|security has not|never approved|not been approved|no approval/i],
  [/not confirmed|unconfirmed|not officially|has not officially/i, /not confirmed|unconfirmed|not officially|has not officially|no formal|not a formal/i],
  [/not received|still not received|have not received/i, /not received|still not|haven't received|have not received|no .+ credentials/i],
  [/not authorised|not authorized|not authorized|unsigned/i, /not authorised|not authorized|unsigned|no authorisation|no authorization/i],
  [/not recorded|not named|no .+ recorded|unknown/i, /not recorded|not named|no .+ recorded|unknown|not (yet )?known|isn't recorded|is not recorded/i],
];

/**
 * Soft expected-fact match: substring, synonym pairs, or ordered tokens with small gaps.
 */
export function factMatched(haystackRaw: string, factRaw: string): boolean {
  const haystack = norm(haystackRaw);
  const fact = norm(factRaw);
  if (!fact) return false;
  if (haystack.includes(fact)) return true;

  // Synonym groups
  for (const [a, b] of FACT_SYNONYMS) {
    if (a.test(fact) && b.test(haystackRaw)) return true;
    if (b.test(fact) && a.test(haystackRaw)) return true;
  }

  // "not selected" ↔ "not been selected" / "has not been selected"
  const factToks = tokens(fact).filter((t) => t.length > 1);
  if (factToks.length === 0) return false;
  const hayToks = tokens(haystack);
  let hi = 0;
  for (const ft of factToks) {
    let found = -1;
    for (let i = hi; i < Math.min(hayToks.length, hi + 5); i += 1) {
      if (
        hayToks[i] === ft ||
        (ft.length > 3 && (hayToks[i]!.includes(ft) || ft.includes(hayToks[i]!)))
      ) {
        found = i;
        break;
      }
    }
    // Allow a short skip (e.g. "been" between "not" and "selected")
    if (found < 0) {
      for (let i = hi; i < Math.min(hayToks.length, hi + 8); i += 1) {
        if (hayToks[i] === ft) {
          found = i;
          break;
        }
      }
    }
    if (found < 0) return false;
    hi = found + 1;
  }
  return true;
}

function includesFacts(haystack: string, facts: string[]): string[] {
  return facts.filter((f) => factMatched(haystack, f));
}

function findForbiddenPositively(
  haystack: string,
  forbidden: string[],
): string[] {
  return forbidden.filter((f) => claimPresentPositively(haystack, f));
}

function bandFromRatio(hit: number, total: number): ScoreBand {
  if (total <= 0) return "unscored";
  const r = hit / total;
  if (r >= 0.75) return "pass";
  if (r >= 0.4) return "partial";
  return "fail";
}

function scoreValue(band: ScoreBand): number | null {
  if (band === "pass") return 1;
  if (band === "partial") return 0.5;
  if (band === "fail") return 0;
  return null;
}

function isFirmGroundedNegative(answer: string): boolean {
  const t = norm(answer);
  return (
    /^(no|not|never)\b/.test(t) ||
    /\b(has not|have not|is not|are not|was not|were not|not been|no evidence|not recorded|not confirmed|not selected|not approved|not authorised|not authorized|unsigned|unknown|insufficient)\b/.test(
      t,
    )
  );
}

function expressesUncertainty(answer: string, confidence?: string | null): boolean {
  const text = `${answer} ${confidence ?? ""}`;
  return (
    /not (enough|clear|sure)|no evidence|unknown|unclear|cannot confirm|can't confirm|i don't (know|have)|insufficient|conflict|contradict|two (different|conflicting)|unconfirmed|speculation|hope,? not|rumour|rumor/i.test(
      text,
    ) ||
    confidence === "not_found" ||
    confidence === "related_context"
  );
}

function contradictsCriticalInsight(
  answer: string,
  fixture: EvalCaseFixture,
): boolean {
  const forbidden = findForbiddenPositively(
    answer,
    fixture.forbiddenClaims ?? [],
  );
  if (forbidden.length) {
    // Positive forbidden claim that green-lights a blocked action / invents approval
    if (
      forbidden.some((f) =>
        /approved|can start|is ready|has been selected|officially moved|is now|definitely|committed/i.test(
          f,
        ),
      )
    ) {
      return true;
    }
  }
  if (/^\s*yes\b/i.test(answer.trim())) {
    const denies = includesFacts(answer, [
      "no",
      "cannot",
      "can't",
      "must not",
      "blocked",
      "not",
      "away",
      "outstanding",
      "unsigned",
    ]);
    // Blind yes with no mitigation language
    if (denies.length === 0) return true;
  }
  return false;
}

function coversCriticalInsight(
  answer: string,
  fixture: EvalCaseFixture,
): boolean {
  const required = fixture.expectedFacts ?? [];
  const supporting = fixture.supportingFacts ?? [];
  const foundRequired = includesFacts(answer, required);
  if (required.length && foundRequired.length >= Math.ceil(required.length * 0.6)) {
    return true;
  }
  if (fixture.criticalInsight && factMatched(answer, fixture.criticalInsight)) {
    return true;
  }
  // Insight tokens (skip very short)
  if (fixture.criticalInsight) {
    const bits = fixture.criticalInsight
      .split(/[,;]| and /i)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    if (bits.some((b) => factMatched(answer, b))) return true;
  }
  // Supporting-only match is not enough alone
  void supporting;
  return false;
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

  const required = fixture.expectedFacts ?? [];
  const supporting = fixture.supportingFacts ?? [];
  const forbidden = fixture.forbiddenClaims ?? [];

  const foundExpected = includesFacts(text, required);
  const foundSupporting = includesFacts(text, supporting);
  const foundForbidden = findForbiddenPositively(text, forbidden);

  if (foundForbidden.length) {
    notes.push(`Forbidden claim(s) present: ${foundForbidden.join("; ")}`);
    if (
      foundForbidden.some((f) =>
        /approved|can start|go-live is still 19|has been selected|officially moved|is ready|committed to november|msa is signed/i.test(
          f,
        ),
      )
    ) {
      hardFailures.push("trust_failure");
      notes.push(
        "TRUST FAILURE: unsupported or forbidden project-specific claim (positive polarity).",
      );
    }
  }

  if (fixture.criticalInsight) {
    const missed =
      !coversCriticalInsight(answer.answer, fixture) ||
      contradictsCriticalInsight(answer.answer, fixture);
    // Only critical if the answer is misleading or misses the material constraint
    if (contradictsCriticalInsight(answer.answer, fixture)) {
      hardFailures.push("critical_intelligence_failure");
      notes.push(
        "CRITICAL INTELLIGENCE FAILURE: answer affirms a forbidden / blocked path.",
      );
    } else if (!coversCriticalInsight(answer.answer, fixture) && foundExpected.length === 0) {
      hardFailures.push("critical_intelligence_failure");
      notes.push(
        "CRITICAL INTELLIGENCE FAILURE: material dependency/constraint not reflected.",
      );
    } else if (missed && foundExpected.length === 0) {
      hardFailures.push("critical_intelligence_failure");
      notes.push(
        "CRITICAL INTELLIGENCE FAILURE: material constraint missed.",
      );
    }
  }

  const dims: DimensionScore[] = [];
  const relevant = new Set<EvalDimension>(fixture.categories);
  const firmNegative = isFirmGroundedNegative(answer.answer);

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

    if (
      dimension === "recall" ||
      dimension === "accuracy" ||
      dimension === "grounding"
    ) {
      const hit = foundExpected.length;
      const total = Math.max(required.length, 1);
      band = foundForbidden.length ? "fail" : bandFromRatio(hit, total);
      // Concise correct answers: if all required facts hit, supporting misses do not demote
      if (
        !foundForbidden.length &&
        required.length > 0 &&
        hit >= required.length &&
        foundSupporting.length < supporting.length
      ) {
        band = "pass";
        rationale = `Required facts ${hit}/${required.length}; supporting optional ${foundSupporting.length}/${supporting.length}`;
      } else {
        rationale = `Required facts matched ${hit}/${required.length}; forbidden ${foundForbidden.length}`;
      }
    } else if (dimension === "trust") {
      band = hardFailures.includes("trust_failure")
        ? "fail"
        : foundForbidden.length
          ? "fail"
          : required.length
            ? bandFromRatio(foundExpected.length, required.length)
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
          ? bandFromRatio(foundExpected.length, Math.max(required.length, 1))
          : "partial";
      rationale = hardFailures.includes("critical_intelligence_failure")
        ? "Critical dependency missed"
        : "Dependency signals checked against required facts";
    } else if (dimension === "temporal") {
      band = foundForbidden.some((f) => /19 august|still 19/i.test(f))
        ? "fail"
        : foundExpected.length
          ? bandFromRatio(foundExpected.length, Math.max(required.length, 1))
          : "partial";
      rationale = "Temporal / supersession checks via expected vs forbidden dates";
    } else if (dimension === "uncertainty") {
      const uncertain = expressesUncertainty(answer.answer, answer.confidence);
      if (fixture.expectUncertainty) {
        // Contract §13: do not demand caveats when evidence supports a firm answer.
        // Firm grounded negatives that hit required facts (or avoid forbidden) pass.
        if (
          firmNegative &&
          !foundForbidden.length &&
          (foundExpected.length > 0 || required.length === 0)
        ) {
          band = "pass";
          rationale =
            "Firm grounded negative from explicit evidence — uncertainty caveat not required (Contract §13)";
        } else if (uncertain && !foundForbidden.length) {
          band = "pass";
          rationale = "Uncertainty / lack of evidence surfaced";
        } else {
          band = "fail";
          rationale = "Expected uncertainty not surfaced where evidence is incomplete/ambiguous";
        }
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
      rationale = waffle
        ? "Answer may be overly broad"
        : "Length/restraint heuristic";
    } else if (dimension === "people") {
      band = required.length
        ? bandFromRatio(foundExpected.length, required.length)
        : "unscored";
      rationale = "People / ownership cues";
    } else if (dimension === "contradiction") {
      if (fixture.expectContradiction) {
        const contrad =
          /conflict|contradict|inconsistent|two (different|conflicting)|disagree|not (been )?decided|unclear which/i.test(
            text,
          );
        band = contrad || uncertainish(answer.answer) ? "pass" : "fail";
        rationale = "Contradiction handling heuristic";
      } else {
        band = required.length
          ? bandFromRatio(foundExpected.length, required.length)
          : "unscored";
        rationale = "Contradiction not required";
      }
    } else {
      // inference, prioritisation, actionability — light heuristics
      if (required.length) {
        band = bandFromRatio(foundExpected.length, required.length);
        rationale = "Heuristic from required-fact coverage";
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

function uncertainish(answer: string): boolean {
  return expressesUncertainty(answer, null);
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
