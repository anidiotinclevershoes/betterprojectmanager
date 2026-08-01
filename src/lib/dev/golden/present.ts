import type { CaptureContextManifest } from "@/lib/capture/context";
import type { CaptureResult } from "@/lib/types";
import type { CaptureFinding, ProposedOperation } from "@/lib/capture/findings";
import { findingMeaningLabel } from "@/lib/capture/findings";
import {
  collectPostAnalysisSignals,
  evaluatePostAnalysisReliability,
} from "@/lib/capture/reliability";
import { extractAtomicFacts } from "./facts";
import type { GoldenScenarioFixture } from "./types";
import type {
  GoldenEntity,
  GoldenExpectedOutcome,
  GoldenOperation,
  GoldenPresentation,
  GoldenProposedOp,
  GoldenReasoningStep,
  GoldenReliabilityVerdict,
  GoldenScore,
  HardRegressionBand,
  MatchStatus,
  ScoredOutcome,
} from "./types";

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titlesLooselyMatch(a: string, b: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const leftTokens = left.split(" ").filter((t) => t.length > 3);
  const rightTokens = right.split(" ").filter((t) => t.length > 3);
  if (!leftTokens.length || !rightTokens.length) return false;
  const overlap = leftTokens.filter((t) => rightTokens.includes(t)).length;
  return overlap >= Math.min(2, leftTokens.length, rightTokens.length);
}

function entityLabel(entity: GoldenEntity): string {
  switch (entity) {
    case "todo":
      return "To Do";
    case "risk":
      return "Risk";
    case "knowledge":
      return "Knowledge";
    case "stakeholder":
      return "Stakeholder";
    case "milestone":
      return "Milestone";
    case "meeting":
      return "Meeting";
    case "nudge":
      return "Nudge";
    case "memory":
      return "Memory";
  }
}

function toGoldenEntity(entityType: string): GoldenEntity {
  if (entityType === "todo") return "todo";
  if (entityType === "risk") return "risk";
  if (entityType === "knowledge") return "knowledge";
  if (entityType === "stakeholder") return "stakeholder";
  if (entityType === "milestone") return "milestone";
  if (entityType === "meeting") return "meeting";
  if (entityType === "nudge") return "nudge";
  return "knowledge";
}

function toGoldenOp(op: string): GoldenOperation {
  return op.toLowerCase() as GoldenOperation;
}

function resultingStatusFromValues(
  values?: Record<string, unknown>,
): string | undefined {
  if (!values) return undefined;
  const status = values.status;
  if (typeof status === "string") return status;
  return undefined;
}

function proposalFromResult(result: CaptureResult): GoldenProposedOp[] {
  const ops = result.proposedOperations ?? [];
  return ops
    .filter((op) => op.operation !== "NO_CHANGE")
    .map((op) => {
      const entity = toGoldenEntity(op.entityType);
      const proposedText =
        typeof op.proposedValues?.text === "string"
          ? String(op.proposedValues.text)
          : undefined;
      const resultingStatus = resultingStatusFromValues(op.proposedValues);
      return {
        id: op.id,
        operation: toGoldenOp(op.operation),
        entity,
        entityLabel: entityLabel(entity),
        title: op.targetTitle ?? proposedText ?? op.reason.slice(0, 80),
        detail: proposedText
          ? `${op.targetTitle ?? ""} → ${proposedText}`.replace(/^ → /, "")
          : op.reason,
        confidence: op.confidence,
        confidenceEstimated: false,
        sourceFindingId: op.sourceFindingId,
        targetId: op.targetId,
        proposedValues: op.proposedValues,
        resultingStatus,
      };
    });
}

function acceptedOps(expected: GoldenExpectedOutcome): Set<GoldenOperation> {
  if (expected.acceptedOperations?.length) {
    return new Set(expected.acceptedOperations);
  }
  return new Set<GoldenOperation>([
    expected.operation,
    ...(expected.allowedOperations ?? []),
  ]);
}

function opsAccepted(
  expected: GoldenExpectedOutcome,
  op: GoldenOperation,
): boolean {
  return acceptedOps(expected).has(op);
}

function entityCompatible(
  expected: GoldenEntity,
  actual: GoldenEntity,
): boolean {
  return expected === actual;
}

function valueMatchesWant(got: unknown, want: unknown): boolean {
  const wantList = Array.isArray(want) ? want : [want];
  const gotNorm = normalize(String(got ?? ""));
  return wantList.some((w) => {
    const wn = normalize(String(w));
    return Boolean(wn) && (gotNorm === wn || gotNorm.includes(wn) || wn.includes(gotNorm));
  });
}

/** Narrow expectedChanges check — no wildcards. */
export function expectedChangesMatch(
  expected?: Record<string, unknown>,
  actual?: Record<string, unknown>,
): boolean {
  if (!expected || Object.keys(expected).length === 0) return true;
  if (!actual) return false;
  const blob = normalize(JSON.stringify(actual));
  for (const [key, want] of Object.entries(expected)) {
    if (key in actual) {
      if (!valueMatchesWant(actual[key], want)) return false;
      continue;
    }
    // Allow date-like expectations to match any string field content.
    const wantList = Array.isArray(want) ? want : [want];
    const inBlob = wantList.some((w) => blob.includes(normalize(String(w))));
    if (!inBlob) return false;
  }
  return true;
}

export type GoldenScoreExtras = {
  invalidTargetCount: number;
  contradictions: number;
  unexpectedCount: number;
  passed: boolean;
  prohibitedTriggered: number;
  ambiguousFindings: number;
  scoringMode: "standard" | "hard";
  exactMatched: number;
  alternativeMatched: number;
};

function matchesProhibited(
  op: GoldenProposedOp,
  rule: NonNullable<GoldenScenarioFixture["prohibited"]>[number],
): boolean {
  if (rule.operation) {
    const ops = Array.isArray(rule.operation)
      ? rule.operation
      : [rule.operation];
    if (!ops.includes(op.operation)) return false;
  }
  if (rule.entity && op.entity !== rule.entity) return false;
  const hay = normalize(`${op.title} ${op.detail ?? ""}`);
  if (rule.titleIncludesAll?.length) {
    const allHit = rule.titleIncludesAll.every((token) =>
      hay.includes(normalize(token)),
    );
    if (!allHit) return false;
  }
  if (rule.titleIncludes?.length) {
    const hit = rule.titleIncludes.some((token) =>
      hay.includes(normalize(token)),
    );
    if (!hit) return false;
  }
  return Boolean(
    rule.operation ||
      rule.entity ||
      (rule.titleIncludes?.length ?? 0) > 0 ||
      (rule.titleIncludesAll?.length ?? 0) > 0,
  );
}

/**
 * Reliability from analysis signals only — never from fixture op-label mismatch.
 */
export function assessGoldenReliability(
  result: CaptureResult,
  captureText = "",
  contextManifest?: CaptureContextManifest | null,
): GoldenReliabilityVerdict {
  const findings = result.findings ?? [];
  const lowConfidenceCount = findings.filter(
    (f) => typeof f.confidence === "number" && f.confidence < 60,
  ).length;
  const mappedFindingIds = new Set(
    (result.proposedOperations ?? []).map((o) => o.sourceFindingId),
  );
  const missingOperationMappings = findings.filter(
    (f) =>
      !f.requiresClarification &&
      !f.invalidTarget &&
      f.findingType !== "NO_CHANGE" &&
      f.findingType !== "AMBIGUOUS" &&
      !mappedFindingIds.has(f.id),
  ).length;

  const signals = collectPostAnalysisSignals({
    captureText,
    result,
    contextManifest,
    measuredInputTokens: null,
  });
  const assessment = evaluatePostAnalysisReliability(signals);

  // Elevate when many low-confidence findings exist (signal-based, not fixture).
  let state = assessment.state;
  if (
    state === "normal" &&
    findings.length > 0 &&
    lowConfidenceCount / findings.length >= 0.5
  ) {
    state = "review_recommended";
  }
  if (
    state === "normal" &&
    missingOperationMappings >= 2 &&
    findings.length >= 2
  ) {
    state = "review_recommended";
  }

  const label =
    state === "normal"
      ? "Normal"
      : state === "review_recommended"
        ? "Review recommended"
        : "Limited";

  return {
    state,
    label,
    ambiguousFindings: findings.filter(
      (f) => f.findingType === "AMBIGUOUS" || f.requiresClarification,
    ).length,
    clarificationCount: findings.filter((f) => f.requiresClarification).length,
    invalidTargetCount:
      result.findingsValidation?.invalidTargetCount ??
      findings.filter((f) => f.invalidTarget).length,
    validationErrors: result.findingsValidation?.errors?.length ?? 0,
    lowConfidenceCount,
    missingOperationMappings,
    truncated: signals.truncated,
  };
}

export function hardRegressionExplanation(input: {
  matched: number;
  total: number;
  prohibitedTriggered: number;
  unexpectedCount: number;
  alternativeMatched: number;
}): string {
  const {
    matched,
    total,
    prohibitedTriggered,
    unexpectedCount,
    alternativeMatched,
  } = input;

  if (matched === total && total > 0 && prohibitedTriggered === 0 && unexpectedCount === 0) {
    if (alternativeMatched > 0) {
      return `All ${total} expected project changes were recognised (${alternativeMatched} via valid alternative operations).`;
    }
    return `All ${total} expected project changes were recognised.`;
  }

  if (matched >= Math.ceil(total / 2) && prohibitedTriggered === 0) {
    return `Lume recognised ${matched} of ${total} expected project changes. Review unmatched or unexpected items before accepting.`;
  }

  return "The Capture did not match enough expected project changes for a strong regression result.";
}

export function hardRegressionBand(input: {
  matched: number;
  total: number;
  prohibitedTriggered: number;
  unexpectedCount: number;
}): { band: HardRegressionBand; label: string } {
  const { matched, total, prohibitedTriggered, unexpectedCount } = input;

  if (prohibitedTriggered > 0 || matched === 0) {
    return { band: "failed", label: "Failed" };
  }
  if (matched === total && unexpectedCount === 0) {
    return { band: "strong", label: "Strong" };
  }
  if (matched >= Math.ceil(total / 2)) {
    return { band: "mixed", label: "Mixed" };
  }
  return { band: "failed", label: "Failed" };
}

/** @deprecated Use hardRegressionBand — kept for older verify imports. */
export function hardScenarioBand(input: {
  matched: number;
  total: number;
  prohibitedTriggered: number;
  unexpectedCount: number;
  invalidTargetCount: number;
}) {
  return hardRegressionBand(input);
}

/** @deprecated Use hardRegressionExplanation. */
export function hardScenarioExplanation(input: {
  matched: number;
  total: number;
  prohibitedTriggered: number;
  unexpectedCount: number;
  ambiguousFindings: number;
  invalidTargetCount: number;
}) {
  return hardRegressionExplanation({
    matched: input.matched,
    total: input.total,
    prohibitedTriggered: input.prohibitedTriggered,
    unexpectedCount: input.unexpectedCount,
    alternativeMatched: 0,
  });
}

function statusChip(status: MatchStatus): string {
  switch (status) {
    case "correct":
      return "Correct";
    case "valid_alternative":
      return "Valid alternative";
    case "needs_review":
      return "Needs review";
    case "missing":
      return "Missing";
    case "unexpected":
      return "Unexpected";
  }
}

export function scoreGoldenResult(
  scenario: GoldenScenarioFixture,
  result: CaptureResult,
  options?: {
    captureText?: string;
    contextManifest?: CaptureContextManifest | null;
  },
): GoldenScore & GoldenScoreExtras {
  const scoringMode = scenario.scoringMode ?? "standard";
  const proposed = proposalFromResult(result);
  const findings = result.findings ?? [];
  const findingById = new Map(findings.map((f) => [f.id, f]));
  const used = new Set<string>();
  const outcomes: ScoredOutcome[] = [];
  let contradictions = 0;

  const invalidTargetCount =
    result.findingsValidation?.invalidTargetCount ??
    findings.filter((f) => f.invalidTarget).length;
  const ambiguousFindings = findings.filter(
    (f) => f.requiresClarification || f.invalidTarget,
  ).length;

  const reliability = assessGoldenReliability(
    result,
    options?.captureText ?? result.rawContent ?? "",
    options?.contextManifest,
  );

  for (const expected of scenario.expected) {
    const candidates = proposed.filter((p) => {
      if (used.has(p.id)) return false;
      if (expected.targetId && p.targetId === expected.targetId) return true;
      return (
        titlesLooselyMatch(p.title, expected.targetTitle) ||
        (p.detail
          ? titlesLooselyMatch(p.detail, expected.targetTitle)
          : false)
      );
    });

    const best =
      candidates.find(
        (p) =>
          opsAccepted(expected, p.operation) &&
          entityCompatible(expected.entity, p.entity) &&
          expectedChangesMatch(expected.expectedChanges, p.proposedValues),
      ) ??
      candidates.find(
        (p) =>
          opsAccepted(expected, p.operation) &&
          entityCompatible(expected.entity, p.entity),
      ) ??
      candidates[0];

    if (!best) {
      outcomes.push({
        status: "missing",
        statusLabel: "Missing",
        expectedId: expected.id,
        expected,
        label: `${expected.operation.toUpperCase()} · ${entityLabel(expected.entity)} · ${expected.targetTitle}`,
        detail: "Expected outcome was not proposed",
      });
      continue;
    }

    used.add(best.id);

    const finding = best.sourceFindingId
      ? findingById.get(best.sourceFindingId)
      : undefined;
    if (!best.sourceFindingId || !finding) {
      contradictions += 1;
    } else {
      if (
        finding.target?.entityId &&
        best.targetId &&
        finding.target.entityId !== best.targetId
      ) {
        contradictions += 1;
      }
      if (
        finding.target?.title &&
        best.title &&
        !titlesLooselyMatch(finding.target.title, best.title) &&
        !titlesLooselyMatch(finding.target.title, expected.targetTitle)
      ) {
        contradictions += 1;
      }
    }

    const opOk = opsAccepted(expected, best.operation);
    const exactOp = best.operation === expected.operation;
    const entityOk = entityCompatible(expected.entity, best.entity);
    const idOk = expected.targetId
      ? best.targetId === expected.targetId
      : true;
    const titleOk =
      titlesLooselyMatch(best.title, expected.targetTitle) ||
      Boolean(
        best.detail && titlesLooselyMatch(best.detail, expected.targetTitle),
      );
    const changesOk = expectedChangesMatch(
      expected.expectedChanges,
      best.proposedValues,
    );

    let confOk = true;
    if (typeof expected.minConfidence === "number" && best.confidence != null) {
      confOk = best.confidence >= expected.minConfidence - 10;
    }

    let status: MatchStatus = "correct";
    if (!opOk || !entityOk || !titleOk || !idOk || !changesOk) {
      status = "needs_review";
    } else if (!exactOp) {
      status = "valid_alternative";
    } else if (!confOk) {
      status = "needs_review";
    } else if (!finding || !best.sourceFindingId) {
      status = "needs_review";
    }

    const resultingStatus =
      best.resultingStatus ??
      (typeof best.proposedValues?.status === "string"
        ? String(best.proposedValues.status)
        : undefined);

    let detail: string | undefined;
    if (status === "valid_alternative") {
      detail = resultingStatus
        ? `Resulting status: ${resultingStatus}`
        : `Accepted alternative to ${expected.operation.toUpperCase()}`;
    } else if (!best.sourceFindingId) {
      detail = "Operation has no source finding";
    } else if (!opOk) {
      detail = `Operation ${best.operation} vs expected ${expected.operation}`;
    } else if (!entityOk) {
      detail = `Entity ${best.entity} vs expected ${expected.entity}`;
    } else if (!idOk) {
      detail = `Target id ${best.targetId} vs expected ${expected.targetId}`;
    } else if (!changesOk) {
      detail = "Target matched, but the proposed field change was missing.";
    } else if (!confOk) {
      detail = `Confidence ${best.confidence}% below target ${expected.minConfidence}%`;
    }

    outcomes.push({
      status,
      statusLabel: statusChip(status),
      expectedId: expected.id,
      expected,
      operation: best.operation,
      entity: best.entity,
      targetTitle: best.title,
      confidence: best.confidence,
      confidenceEstimated: best.confidenceEstimated,
      label: `${best.operation.toUpperCase()} · ${best.entityLabel} · ${best.title}`,
      detail,
      resultingStatus,
    });
  }

  const prohibitedRules = scenario.prohibited ?? [];
  const prohibitedHits = new Set<string>();
  for (const p of proposed) {
    for (const rule of prohibitedRules) {
      if (matchesProhibited(p, rule)) {
        prohibitedHits.add(rule.id);
        if (!used.has(p.id)) {
          used.add(p.id);
          outcomes.push({
            status: "unexpected",
            statusLabel: "Unexpected",
            operation: p.operation,
            entity: p.entity,
            targetTitle: p.title,
            confidence: p.confidence,
            confidenceEstimated: p.confidenceEstimated,
            label: `${p.operation.toUpperCase()} · ${p.entityLabel} · ${p.title}`,
            detail: `Prohibited: ${rule.label}`,
          });
        }
      }
    }
  }

  for (const p of proposed) {
    if (used.has(p.id)) continue;
    outcomes.push({
      status: "unexpected",
      statusLabel: "Unexpected",
      operation: p.operation,
      entity: p.entity,
      targetTitle: p.title,
      confidence: p.confidence,
      confidenceEstimated: p.confidenceEstimated,
      label: `${p.operation.toUpperCase()} · ${p.entityLabel} · ${p.title}`,
      detail: "Not in the expected outcome list",
    });
  }

  const relevant = outcomes.filter((o) => o.status !== "unexpected");
  const exactMatched = relevant.filter((o) => o.status === "correct").length;
  const alternativeMatched = relevant.filter(
    (o) => o.status === "valid_alternative",
  ).length;
  const matched = exactMatched + alternativeMatched;
  const total = scenario.expected.length;
  const unexpectedCount = outcomes.filter((o) => o.status === "unexpected")
    .length;
  const prohibitedTriggered = prohibitedHits.size;
  const ratio = total === 0 ? 0 : matched / total;

  // Standard remains strict: exact matches only (no valid_alternative credit).
  const standardMatched = exactMatched;
  const passed =
    scoringMode === "standard" &&
    standardMatched === total &&
    total > 0 &&
    unexpectedCount === 0 &&
    invalidTargetCount === 0 &&
    contradictions === 0 &&
    prohibitedTriggered === 0 &&
    alternativeMatched === 0;

  let grade: GoldenScore["grade"] = "poor";
  let gradeLabel = "Failed";
  let gradeEmoji = "●";
  let hardBand: GoldenScore["hardBand"];
  let hardBandLabel: string | undefined;
  let hardExplanation: string | undefined;

  if (scoringMode === "hard") {
    const band = hardRegressionBand({
      matched,
      total,
      prohibitedTriggered,
      unexpectedCount,
    });
    hardBand = band.band;
    hardBandLabel = band.label;
    hardExplanation = hardRegressionExplanation({
      matched,
      total,
      prohibitedTriggered,
      unexpectedCount,
      alternativeMatched,
    });
    // Overall grade uses regression band — Unreliable only via reliability.state.
    if (reliability.state === "limited") {
      gradeLabel = "Unreliable";
      grade = "poor";
    } else {
      gradeLabel = band.label;
      grade =
        band.band === "strong"
          ? "excellent"
          : band.band === "mixed"
            ? "good"
            : "poor";
    }
    gradeEmoji = "○";
  } else if (passed) {
    grade = "excellent";
    gradeLabel = "Passed";
    gradeEmoji = "🟢";
  } else if (ratio >= 0.85 && unexpectedCount === 0) {
    grade = "good";
    gradeLabel = "Good";
    gradeEmoji = "🟡";
  } else if (ratio >= 0.6) {
    grade = "needs_work";
    gradeLabel = "Needs work";
    gradeEmoji = "🟠";
  } else {
    gradeLabel = "Failed";
    gradeEmoji = "🔴";
  }

  return {
    grade,
    gradeLabel,
    gradeEmoji,
    matched: scoringMode === "standard" ? standardMatched : matched,
    total,
    outcomes,
    invalidTargetCount,
    contradictions,
    unexpectedCount,
    passed,
    prohibitedTriggered,
    ambiguousFindings,
    scoringMode,
    hardBand,
    hardBandLabel,
    hardExplanation,
    reliability,
    exactMatched,
    alternativeMatched,
  };
}

export type GoldenFindingCard = {
  id: string;
  fact: string;
  matchedLabel?: string;
  matchedTitle?: string;
  meaning: string;
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestion?: string;
  invalidTarget?: boolean;
  validationWarning?: string;
};

export function presentGoldenResult(
  scenario: GoldenScenarioFixture,
  result: CaptureResult,
  captureText: string,
): GoldenPresentation & { findingCards: GoldenFindingCard[] } {
  const proposed = proposalFromResult(result);
  const findings = result.findings ?? [];
  const findingById = new Map(findings.map((f) => [f.id, f]));

  const facts = extractAtomicFacts(result, captureText);

  const reasoning: GoldenReasoningStep[] = [];
  for (const op of result.proposedOperations ?? []) {
    const finding = findingById.get(op.sourceFindingId);
    if (!finding) continue;
    const entity = toGoldenEntity(op.entityType);
    reasoning.push({
      id: op.id,
      foundLabel: `Existing ${entityLabel(entity)}`,
      foundTitle: op.targetTitle ?? finding.target?.title ?? finding.fact,
      captureStates: finding.evidence,
      recommend: `${op.operation} existing ${entityLabel(entity)}`,
      sourceFindingId: op.sourceFindingId,
    });
  }

  const findingCards: GoldenFindingCard[] = findings.map((f) => ({
    id: f.id,
    fact: f.fact,
    matchedLabel: f.target
      ? entityLabel(toGoldenEntity(f.target.entityType))
      : undefined,
    matchedTitle: f.target?.title,
    meaning: findingMeaningLabel(f),
    confidence: f.confidence,
    requiresClarification: f.requiresClarification,
    clarificationQuestion: f.clarificationQuestion,
    invalidTarget: f.invalidTarget,
    validationWarning: f.validationWarning,
  }));

  return {
    summary:
      result.memory.content?.trim() ||
      result.memory.title ||
      "No summary returned.",
    facts,
    reasoning,
    proposed,
    findingCards,
  };
}

export { proposalFromResult, entityLabel };
export type { CaptureFinding, ProposedOperation };
