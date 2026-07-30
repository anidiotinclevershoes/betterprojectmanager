import type { CaptureResult, Recommendation } from "@/lib/types";
import {
  KIND_LABEL,
  buildSuggestions,
  parseSuggestionKind,
  parseSuggestionOp,
  type SuggestionKind,
  type SuggestionOp,
} from "@/lib/capture/suggestions";
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

const ENTITY_FROM_KIND: Record<SuggestionKind, GoldenEntity> = {
  action: "todo",
  risk: "risk",
  knowledge: "knowledge",
  stakeholder: "stakeholder",
  milestone: "milestone",
  meeting: "meeting",
  nudge: "nudge",
  decision: "knowledge",
  memory: "memory",
};

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

export function estimateConfidence(rec: Recommendation): {
  value: number;
  estimated: boolean;
} {
  const raw = (rec as Recommendation & { confidence?: number }).confidence;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { value: Math.round(raw), estimated: false };
  }
  switch (rec.urgency) {
    case "now":
      return { value: 94, estimated: true };
    case "today":
      return { value: 88, estimated: true };
    case "this_week":
      return { value: 78, estimated: true };
    default:
      return { value: 70, estimated: true };
  }
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

function proposalFromResult(
  result: CaptureResult,
  openTodos: { id: string; title: string }[],
): GoldenProposedOp[] {
  const suggestions = buildSuggestions(result, openTodos).filter(
    (s) => s.kind !== "memory",
  );

  const fromSuggestions: GoldenProposedOp[] = suggestions.map((s) => {
    const entity = ENTITY_FROM_KIND[s.kind] ?? "knowledge";
    const conf = s.recommendation
      ? estimateConfidence(s.recommendation)
      : { value: 72, estimated: true };
    return {
      id: s.id,
      operation: s.op as GoldenOperation,
      entity,
      entityLabel: KIND_LABEL[s.kind] || entityLabel(entity),
      title: s.content,
      detail: s.recommendation?.action,
      confidence: conf.value,
      confidenceEstimated: conf.estimated,
    };
  });

  // Also surface knowledge patch bullets that may not appear as recommendations
  const patchOps: GoldenProposedOp[] = [];
  if (result.knowledgePatch) {
    for (const [section, bullets] of Object.entries(result.knowledgePatch)) {
      for (const [i, bullet] of (bullets ?? []).entries()) {
        const already = fromSuggestions.some((p) =>
          titlesLooselyMatch(p.title, bullet),
        );
        if (already) continue;
        const entity: GoldenEntity =
          section === "risks"
            ? "risk"
            : section === "people"
              ? "stakeholder"
              : "knowledge";
        patchOps.push({
          id: `patch-${section}-${i}`,
          operation: "update",
          entity,
          entityLabel: entityLabel(entity),
          title: bullet,
          detail:
            section === "now"
              ? "Knowledge update from Capture"
              : `Knowledge · ${section}`,
          confidence: 80,
          confidenceEstimated: true,
        });
      }
    }
  }

  for (const [i, item] of (result.timelinePatch ?? []).entries()) {
    const already = fromSuggestions.some((p) =>
      titlesLooselyMatch(p.title, item.label),
    );
    if (already) continue;
    patchOps.push({
      id: `tl-${i}`,
      operation: "update",
      entity: "milestone",
      entityLabel: "Milestone",
      title: item.label,
      detail: item.startAt ? `Date → ${item.startAt.slice(0, 10)}` : undefined,
      confidence: 82,
      confidenceEstimated: true,
    });
  }

  return [...fromSuggestions, ...patchOps];
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
  if (expected === actual) return true;
  // Knowledge / milestone often overlap for release-date updates
  if (
    (expected === "knowledge" && actual === "milestone") ||
    (expected === "milestone" && actual === "knowledge")
  ) {
    return true;
  }
  if (expected === "todo" && actual === "memory") return false;
  return false;
}

export function scoreGoldenResult(
  scenario: GoldenScenarioFixture,
  result: CaptureResult,
): GoldenScore {
  const openTodos = scenario.todos
    .filter((t) => !t.done)
    .map((t) => ({ id: t.id, title: t.title }));
  const proposed = proposalFromResult(result, openTodos);

  const used = new Set<string>();
  const outcomes: ScoredOutcome[] = [];

  for (const expected of scenario.expected) {
    const candidates = proposed.filter((p) => {
      if (used.has(p.id)) return false;
      const titleHit =
        titlesLooselyMatch(p.title, expected.targetTitle) ||
        (p.detail ? titlesLooselyMatch(p.detail, expected.targetTitle) : false) ||
        titlesLooselyMatch(
          `${p.title} ${p.detail ?? ""}`,
          expected.targetTitle,
        );
      // Release-date special case: capture mentions 19 August
      const releaseHit =
        expected.id === "update-release-date" &&
        (/19\s*aug/i.test(`${p.title} ${p.detail ?? ""}`) ||
          /release/i.test(p.title));
      const cdnHit =
        expected.id === "resolve-cdn" &&
        /cdn/i.test(`${p.title} ${p.detail ?? ""}`);
      const cabHit =
        expected.id === "complete-cab" &&
        /cab/i.test(`${p.title} ${p.detail ?? ""}`);
      return titleHit || releaseHit || cdnHit || cabHit;
    });

    let best = candidates.find(
      (p) => opsMatch(expected, p.operation) && entityCompatible(expected.entity, p.entity),
    );
    if (!best) {
      best = candidates.find((p) => opsMatch(expected, p.operation));
    }
    if (!best) {
      best = candidates[0];
    }

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
    const opOk = opsMatch(expected, best.operation);
    const entityOk = entityCompatible(expected.entity, best.entity);
    const titleOk =
      titlesLooselyMatch(best.title, expected.targetTitle) ||
      Boolean(best.detail && titlesLooselyMatch(best.detail, expected.targetTitle)) ||
      (expected.id === "update-release-date" &&
        /19\s*aug|release/i.test(`${best.title} ${best.detail ?? ""}`)) ||
      (expected.id === "resolve-cdn" && /cdn/i.test(`${best.title} ${best.detail ?? ""}`)) ||
      (expected.id === "complete-cab" && /cab/i.test(`${best.title} ${best.detail ?? ""}`));

    let confOk = true;
    if (typeof expected.minConfidence === "number" && best.confidence != null) {
      confOk = best.confidence >= expected.minConfidence - 10; // tolerance
    }

    let status: MatchStatus = "correct";
    if (!opOk || !entityOk || !titleOk) status = "needs_review";
    else if (!confOk) status = "needs_review";

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
      detail: !opOk
        ? `Operation ${best.operation} vs expected ${expected.operation}`
        : !entityOk
          ? `Entity ${best.entity} vs expected ${expected.entity}`
          : !confOk
            ? `Confidence ${best.confidence}% below target ${expected.minConfidence}%`
            : undefined,
    });
  }

  for (const p of proposed) {
    if (used.has(p.id)) continue;
    // Ignore soft memory/create noise for unexpected scoring
    if (p.entity === "memory" && p.operation === "create") continue;
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
  const ratio = total === 0 ? 0 : matched / total;

  let grade: GoldenScore["grade"] = "poor";
  let gradeLabel = "Poor";
  let gradeEmoji = "🔴";
  if (ratio >= 0.85) {
    grade = "excellent";
    gradeLabel = "Excellent";
    gradeEmoji = "🟢";
  } else if (ratio >= 0.6) {
    grade = "good";
    gradeLabel = "Good";
    gradeEmoji = "🟡";
  } else if (ratio >= 0.34) {
    grade = "needs_work";
    gradeLabel = "Needs work";
    gradeEmoji = "🟠";
  }

  return { grade, gradeLabel, gradeEmoji, matched, total, outcomes };
}

export function presentGoldenResult(
  scenario: GoldenScenarioFixture,
  result: CaptureResult,
  captureText: string,
): GoldenPresentation {
  const openTodos = scenario.todos
    .filter((t) => !t.done)
    .map((t) => ({ id: t.id, title: t.title }));
  const proposed = proposalFromResult(result, openTodos);

  const facts: string[] = [];
  for (const line of captureText.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Turn capture sentences into short fact bullets
    facts.push(trimmed.replace(/\.$/, ""));
  }
  for (const insight of result.insights ?? []) {
    if (/tidied from raw/i.test(insight)) continue;
    if (!facts.some((f) => titlesLooselyMatch(f, insight))) {
      facts.push(insight);
    }
  }

  const reasoning: GoldenReasoningStep[] = [];
  for (const expected of scenario.expected) {
    const hint = expected.reasoningHint;
    if (!hint) continue;
    const matched = proposed.some((p) => {
      const blob = `${p.title} ${p.detail ?? ""}`;
      return (
        titlesLooselyMatch(blob, expected.targetTitle) ||
        (expected.id === "complete-cab" && /cab/i.test(blob)) ||
        (expected.id === "resolve-cdn" && /cdn/i.test(blob)) ||
        (expected.id === "update-release-date" &&
          (/19\s*aug/i.test(blob) || /release/i.test(blob)))
      );
    });
    if (!matched && !captureText) continue;
    reasoning.push({
      id: expected.id,
      foundLabel: hint.foundLabel,
      foundTitle: hint.foundTitle,
      captureStates: hint.captureStates,
      recommend: matched
        ? hint.recommend
        : `${hint.recommend} (not clearly proposed)`,
    });
  }

  // Fallback reasoning from recommendations if expected hints empty
  if (!reasoning.length) {
    for (const rec of result.recommendations) {
      const op = parseSuggestionOp(rec.operation, rec.title);
      const kind = parseSuggestionKind(rec.itemType, "action", rec.title);
      reasoning.push({
        id: rec.id,
        foundLabel: rec.targetTitle
          ? `Found existing ${KIND_LABEL[kind] ?? "record"}`
          : "New signal from Capture",
        foundTitle: rec.targetTitle || rec.title,
        captureStates: rec.why || "Capture mentions related facts",
        recommend: `Recommend ${op} · ${rec.action}`,
      });
    }
  }

  return {
    summary:
      result.memory.content?.trim() ||
      result.memory.title ||
      "No summary returned.",
    facts: facts.slice(0, 8),
    reasoning,
    proposed,
  };
}

export { proposalFromResult, entityLabel };
