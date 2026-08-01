import type { CaptureResult } from "@/lib/types";
import type { CaptureFinding, ProposedOperation } from "@/lib/capture/findings";
import { findingMeaningLabel } from "@/lib/capture/findings";
import type { GoldenScenarioFixture } from "./types";
import type {
  GoldenEntity,
  GoldenOperation,
  GoldenPresentation,
  GoldenProposedOp,
  GoldenReasoningStep,
  GoldenScore,
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
      };
    });
}

function opsMatch(
  expected: GoldenScenarioFixture["expected"][number],
  op: GoldenOperation,
): boolean {
  const allowed = new Set<GoldenOperation>([
    expected.operation,
    ...(expected.allowedOperations ?? []),
  ]);
  return allowed.has(op);
}

function entityCompatible(
  expected: GoldenEntity,
  actual: GoldenEntity,
): boolean {
  return expected === actual;
}

export type GoldenScoreExtras = {
  invalidTargetCount: number;
  contradictions: number;
  unexpectedCount: number;
  passed: boolean;
  prohibitedTriggered: number;
  ambiguousFindings: number;
  scoringMode: "standard" | "hard";
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
 * Deterministic friendly copy for hard scenarios — not another AI judgment.
 */
export function hardScenarioExplanation(input: {
  matched: number;
  total: number;
  prohibitedTriggered: number;
  unexpectedCount: number;
  ambiguousFindings: number;
  invalidTargetCount: number;
}): string {
  const {
    matched,
    total,
    prohibitedTriggered,
    unexpectedCount,
    ambiguousFindings,
    invalidTargetCount,
  } = input;
  const reviewables =
    unexpectedCount + ambiguousFindings + invalidTargetCount + prohibitedTriggered;

  if (
    matched === total &&
    total > 0 &&
    prohibitedTriggered === 0 &&
    reviewables <= 2
  ) {
    if (reviewables > 0) {
      return `Lume understood the main project changes but produced ${reviewables} low-confidence suggestions that should be reviewed carefully.`;
    }
    return "Lume understood the main project changes. Review each suggestion before accepting.";
  }

  if (matched >= Math.ceil(total / 2) && prohibitedTriggered === 0) {
    return `Lume understood the main project changes but produced ${Math.max(reviewables, 1)} low-confidence suggestions that should be reviewed carefully.`;
  }

  return "The Capture was too ambiguous for reliable automated suggestions. The extracted facts are available, but no changes should be accepted without review.";
}

export function hardScenarioBand(input: {
  matched: number;
  total: number;
  prohibitedTriggered: number;
  unexpectedCount: number;
  invalidTargetCount: number;
}): { band: "strong" | "mixed" | "unreliable"; label: string } {
  const {
    matched,
    total,
    prohibitedTriggered,
    unexpectedCount,
    invalidTargetCount,
  } = input;

  if (prohibitedTriggered > 0 || matched === 0) {
    return { band: "unreliable", label: "Unreliable" };
  }
  if (
    matched === total &&
    unexpectedCount === 0 &&
    invalidTargetCount === 0
  ) {
    return { band: "strong", label: "Strong" };
  }
  if (matched >= Math.ceil(total / 2)) {
    return { band: "mixed", label: "Mixed" };
  }
  return { band: "unreliable", label: "Unreliable" };
}

export function scoreGoldenResult(
  scenario: GoldenScenarioFixture,
  result: CaptureResult,
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

    let best =
      candidates.find(
        (p) =>
          opsMatch(expected, p.operation) &&
          entityCompatible(expected.entity, p.entity),
      ) ??
      candidates.find((p) => opsMatch(expected, p.operation)) ??
      candidates[0];

    if (!best) {
      outcomes.push({
        status: "missing",
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
      // Reasoning-operation contradiction: finding target vs operation target
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

    const opOk = opsMatch(expected, best.operation);
    const entityOk = entityCompatible(expected.entity, best.entity);
    const idOk = expected.targetId
      ? best.targetId === expected.targetId
      : true;
    const titleOk =
      titlesLooselyMatch(best.title, expected.targetTitle) ||
      Boolean(
        best.detail && titlesLooselyMatch(best.detail, expected.targetTitle),
      );

    let confOk = true;
    if (typeof expected.minConfidence === "number" && best.confidence != null) {
      confOk = best.confidence >= expected.minConfidence - 10;
    }

    let status: MatchStatus = "correct";
    if (!opOk || !entityOk || !titleOk || !idOk) status = "needs_review";
    else if (!confOk) status = "needs_review";
    else if (!finding || !best.sourceFindingId) status = "needs_review";

    outcomes.push({
      status,
      expectedId: expected.id,
      expected,
      operation: best.operation,
      entity: best.entity,
      targetTitle: best.title,
      confidence: best.confidence,
      confidenceEstimated: best.confidenceEstimated,
      label: `${best.operation.toUpperCase()} · ${best.entityLabel} · ${best.title}`,
      detail: !best.sourceFindingId
        ? "Operation has no source finding"
        : !opOk
          ? `Operation ${best.operation} vs expected ${expected.operation}`
          : !entityOk
            ? `Entity ${best.entity} vs expected ${expected.entity}`
            : !idOk
              ? `Target id ${best.targetId} vs expected ${expected.targetId}`
              : !confOk
                ? `Confidence ${best.confidence}% below target ${expected.minConfidence}%`
                : undefined,
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
  const matched = relevant.filter((o) => o.status === "correct").length;
  const total = scenario.expected.length;
  const unexpectedCount = outcomes.filter((o) => o.status === "unexpected")
    .length;
  const prohibitedTriggered = prohibitedHits.size;
  const ratio = total === 0 ? 0 : matched / total;

  // Standard regression criteria — unchanged for non-hard scenarios.
  const passed =
    scoringMode === "standard" &&
    matched === total &&
    total > 0 &&
    unexpectedCount === 0 &&
    invalidTargetCount === 0 &&
    contradictions === 0 &&
    prohibitedTriggered === 0;

  let grade: GoldenScore["grade"] = "poor";
  let gradeLabel = "Poor";
  let gradeEmoji = "●";
  let hardBand: GoldenScore["hardBand"];
  let hardBandLabel: string | undefined;
  let hardExplanation: string | undefined;

  if (scoringMode === "hard") {
    const band = hardScenarioBand({
      matched,
      total,
      prohibitedTriggered,
      unexpectedCount,
      invalidTargetCount,
    });
    hardBand = band.band;
    hardBandLabel = band.label;
    hardExplanation = hardScenarioExplanation({
      matched,
      total,
      prohibitedTriggered,
      unexpectedCount,
      ambiguousFindings,
      invalidTargetCount,
    });
    grade =
      band.band === "strong"
        ? "excellent"
        : band.band === "mixed"
          ? "good"
          : "poor";
    gradeLabel = band.label;
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
    gradeEmoji = "🔴";
  }

  return {
    grade,
    gradeLabel,
    gradeEmoji,
    matched,
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

  const facts: string[] = [];
  for (const line of captureText.split(/\n+/)) {
    const trimmed = line.trim();
    if (trimmed) facts.push(trimmed.replace(/\.$/, ""));
  }
  for (const insight of result.insights ?? []) {
    if (/tidied from raw/i.test(insight)) continue;
    if (!facts.some((f) => titlesLooselyMatch(f, insight))) {
      facts.push(insight);
    }
  }

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
    facts: facts.slice(0, 8),
    reasoning,
    proposed,
    findingCards,
  };
}

export { proposalFromResult, entityLabel };
export type { CaptureFinding, ProposedOperation };
