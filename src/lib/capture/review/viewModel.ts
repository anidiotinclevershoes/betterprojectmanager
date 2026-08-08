/**
 * Presentation view-models for Capture suggested-change cards.
 * Joins existing suggestions with findings/operations for display only.
 */

import type { CaptureResult } from "@/lib/types";
import type {
  CaptureFinding,
  FindingCoverageItem,
  ProposedOperation,
} from "@/lib/capture/findings";
import {
  KIND_LABEL,
  OP_LABEL,
  isDestructiveOp,
  type PendingSuggestion,
  type SuggestionKind,
  type SuggestionOp,
} from "@/lib/capture/suggestions";

export type ReviewReadiness = "ready" | "needs_review" | "unmatched";

export type ChangeDiffLayout = "from_to" | "create" | "remove";

export type ChangeDiff = {
  label: string;
  from: string;
  to: string;
  /** How the card should render the change. */
  layout?: ChangeDiffLayout;
  /** Optional secondary line (e.g. due date on create). */
  meta?: string;
};

export type ReviewChangeViewModel = {
  id: string;
  suggestion: PendingSuggestion;
  entityKind: SuggestionKind;
  entityLabel: string;
  recordName: string;
  operation: SuggestionOp;
  operationLabel: string;
  readiness: ReviewReadiness;
  needsReviewReason?: string;
  diff?: ChangeDiff;
  evidence: string[];
  interpretation: string;
  confidence: number | null;
  finding?: CaptureFinding;
  operationSource?: ProposedOperation;
};

function formatShortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // Already human text
    return value.replace(/^Release planned for /i, "").trim();
  }
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function extractOpId(suggestionId: string): string | null {
  const m = suggestionId.match(/^op-(.+)-\d+$/);
  return m?.[1] ?? null;
}

function findOperation(
  item: PendingSuggestion,
  result: CaptureResult,
): ProposedOperation | undefined {
  const ops = result.proposedOperations ?? [];
  const opId = extractOpId(item.id);
  if (opId) {
    const byId = ops.find((o) => o.id === opId);
    if (byId) return byId;
  }
  if (item.recommendation?.proposedOperationId) {
    const byRec = ops.find(
      (o) => o.id === item.recommendation?.proposedOperationId,
    );
    if (byRec) return byRec;
  }
  if (item.recommendation?.sourceFindingId) {
    return ops.find(
      (o) => o.sourceFindingId === item.recommendation?.sourceFindingId,
    );
  }
  return ops.find(
    (o) =>
      o.targetTitle &&
      item.content &&
      o.targetTitle.toLowerCase() === item.content.toLowerCase(),
  );
}

function findFinding(
  op: ProposedOperation | undefined,
  result: CaptureResult,
): CaptureFinding | undefined {
  if (!op?.sourceFindingId) return undefined;
  return result.findings?.find((f) => f.id === op.sourceFindingId);
}

function humanizeStatus(value: string): string {
  const v = value.trim();
  if (/^OPEN$/i.test(v) || /^open$/i.test(v)) return "Open";
  if (/^COMPLETED$/i.test(v) || /^done$/i.test(v)) return "Complete";
  if (/^RESOLVED$/i.test(v)) return "Resolved";
  if (/^BLOCKED$/i.test(v)) return "Blocked";
  if (/^ARCHIVED$/i.test(v)) return "Archived";
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function buildDiff(
  item: PendingSuggestion,
  op: ProposedOperation | undefined,
  finding: CaptureFinding | undefined,
): ChangeDiff | undefined {
  if (item.op === "create") {
    const values = op?.proposedValues ?? {};
    const due =
      (typeof values.date === "string" && values.date) ||
      (typeof values.dueDate === "string" && values.dueDate) ||
      item.date;
    return {
      label: `New ${KIND_LABEL[item.kind]}`,
      from: "",
      to: item.content,
      layout: "create",
      meta: due ? `Due ${formatShortDate(String(due))}` : undefined,
    };
  }

  if (item.op === "remove" || item.op === "archive" || item.op === "delete") {
    return {
      label: KIND_LABEL[item.kind],
      from: item.kind === "stakeholder" ? "Active stakeholder" : "Active",
      to:
        item.op === "archive"
          ? "Archive from project"
          : "Remove from project",
      layout: "remove",
    };
  }

  if (item.op === "complete") {
    const prev =
      typeof finding?.changes?.status?.previous === "string"
        ? String(finding.changes.status.previous)
        : "Open";
    return {
      label: "Status",
      from: humanizeStatus(prev),
      to: item.kind === "risk" ? "Resolved" : "Complete",
      layout: "from_to",
    };
  }

  const values = op?.proposedValues ?? {};

  const ownerVal =
    (typeof values.owner === "string" && values.owner) ||
    (typeof values.assignee === "string" && values.assignee) ||
    (typeof values.businessOwner === "string" && values.businessOwner) ||
    (typeof finding?.changes?.owner?.proposed === "string" &&
      String(finding.changes.owner.proposed)) ||
    undefined;
  const prevOwner =
    typeof finding?.changes?.owner?.previous === "string"
      ? String(finding.changes.owner.previous)
      : typeof finding?.changes?.assignee?.previous === "string"
        ? String(finding.changes.assignee.previous)
        : undefined;
  if (item.op === "update" && ownerVal) {
    return {
      label: "Owner",
      from: prevOwner || "—",
      to: ownerVal,
      layout: "from_to",
    };
  }

  const dateVal =
    (typeof values.date === "string" && values.date) ||
    (typeof values.startAt === "string" && values.startAt) ||
    item.date;
  const prevDate =
    typeof finding?.changes?.date?.previous === "string"
      ? String(finding.changes.date.previous)
      : typeof finding?.changes?.startAt?.previous === "string"
        ? String(finding.changes.startAt.previous)
        : undefined;

  if (dateVal && (item.op === "update" || item.kind === "milestone")) {
    return {
      label: item.kind === "milestone" ? "Release Date" : "Date",
      from: prevDate ? formatShortDate(prevDate) : "—",
      to: formatShortDate(String(dateVal)),
      layout: "from_to",
    };
  }

  const textVal =
    typeof values.text === "string"
      ? String(values.text)
      : typeof finding?.changes?.text?.proposed === "string"
        ? String(finding.changes.text.proposed)
        : undefined;
  const prevText =
    typeof finding?.changes?.text?.previous === "string"
      ? String(finding.changes.text.previous)
      : undefined;

  if (item.op === "update" && (textVal || prevText)) {
    return {
      label: KIND_LABEL[item.kind],
      from: prevText ? formatShortDate(prevText) : "—",
      to: textVal ? formatShortDate(textVal) : item.content,
      layout: "from_to",
    };
  }

  if (typeof values.status === "string") {
    const prev =
      typeof finding?.changes?.status?.previous === "string"
        ? String(finding.changes.status.previous)
        : "Open";
    return {
      label: "Status",
      from: humanizeStatus(prev),
      to:
        values.status === "COMPLETED" || values.status === "RESOLVED"
          ? item.kind === "risk"
            ? "Resolved"
            : "Complete"
          : humanizeStatus(String(values.status)),
      layout: "from_to",
    };
  }

  // Plain-text fallback when structured old/new values are unavailable.
  return {
    label: OP_LABEL[item.op],
    from: "—",
    to: item.content,
    layout: "from_to",
  };
}

function buildInterpretation(
  item: PendingSuggestion,
  finding: CaptureFinding | undefined,
): string {
  if (finding?.reasoningSummary?.trim()) {
    return finding.reasoningSummary.trim();
  }
  if (item.recommendation?.why?.trim()) {
    return item.recommendation.why.trim();
  }
  const entity = KIND_LABEL[item.kind];
  const op = OP_LABEL[item.op].toLowerCase();
  return `Lume suggests to ${op} this ${entity.toLowerCase()} based on the Capture.`;
}

function evidenceExcerpts(
  finding: CaptureFinding | undefined,
  captureText: string,
): string[] {
  const excerpts: string[] = [];
  if (finding?.evidence?.trim()) {
    const cleaned = finding.evidence.trim().replace(/\s+/g, " ");
    // Prefer a short sentence-like slice
    const sentence =
      cleaned.match(/[^.!?]*?(?:approved|resolved|moved|received|nineteenth|19)[^.!?]*(?:[.!?]|$)/i)?.[0] ??
      cleaned.slice(0, 140);
    excerpts.push(sentence.trim().replace(/^["']|["']$/g, ""));
  }
  if (excerpts.length === 0 && captureText.trim()) {
    const line = captureText
      .split(/\n+/)
      .map((l) => l.trim())
      .find((l) => l.length > 20 && l.length < 160);
    if (line) excerpts.push(line);
  }
  return excerpts.slice(0, 2);
}

function opsDisagree(
  item: PendingSuggestion,
  op: ProposedOperation | undefined,
): boolean {
  if (!op) return false;
  const mapped = op.operation.toLowerCase();
  if (mapped === "complete" && item.op !== "complete") return true;
  if (mapped === "update" && item.op !== "update" && item.op !== "complete") {
    return true;
  }
  if (mapped === "create" && item.op !== "create") return true;
  if (
    (mapped === "archive" || mapped === "delete") &&
    item.op !== "archive" &&
    item.op !== "delete" &&
    item.op !== "remove"
  ) {
    return true;
  }
  return false;
}

function coverageForFinding(
  result: CaptureResult,
  findingId: string | undefined,
): FindingCoverageItem | undefined {
  if (!findingId) return undefined;
  return result.findingCoverage?.items.find((i) => i.findingId === findingId);
}

function assessReadiness(
  item: PendingSuggestion,
  finding: CaptureFinding | undefined,
  op: ProposedOperation | undefined,
  coverage?: FindingCoverageItem,
): { readiness: ReviewReadiness; reason?: string } {
  if (coverage?.disposition === "unmatched") {
    return {
      readiness: "unmatched",
      reason:
        coverage.reason ||
        "Lume couldn't confidently identify the existing item this should update.",
    };
  }
  if (coverage?.disposition === "needs_review") {
    return {
      readiness: "needs_review",
      reason:
        coverage.reason ||
        finding?.clarificationQuestion ||
        "Lume needs clarification before this change is applied.",
    };
  }
  if (finding?.requiresClarification || op?.requiresClarification) {
    return {
      readiness: "needs_review",
      reason:
        finding?.clarificationQuestion ||
        "Lume needs clarification before this change is applied.",
    };
  }
  if (finding?.invalidTarget) {
    return {
      readiness: "unmatched",
      reason:
        finding.validationWarning ||
        "Lume couldn't confidently identify the existing item this should update.",
    };
  }
  if (finding?.findingType === "AMBIGUOUS") {
    return {
      readiness: "needs_review",
      reason: "The Capture contained ambiguous evidence for this change.",
    };
  }
  if (opsDisagree(item, op)) {
    return {
      readiness: "needs_review",
      reason: "Finding and proposed operation are inconsistent.",
    };
  }
  if (isDestructiveOp(item.op) || op?.destructive) {
    return {
      readiness: "needs_review",
      reason: "Destructive action — confirm before applying.",
    };
  }
  const confidence = op?.confidence ?? finding?.confidence ?? item.recommendation?.confidence;
  if (typeof confidence === "number" && confidence < 70) {
    return {
      readiness: "needs_review",
      reason: "Confidence is below the ready threshold.",
    };
  }
  if (!op && finding?.findingType === "NEW_INFORMATION") {
    return {
      readiness: "needs_review",
      reason: "Cannot safely produce a single operation from this finding.",
    };
  }
  return { readiness: "ready" };
}

function kindFromFinding(finding: CaptureFinding): SuggestionKind {
  const t = finding.target?.entityType;
  if (t === "todo") return "action";
  if (t === "risk") return "risk";
  if (t === "milestone") return "milestone";
  if (t === "meeting") return "meeting";
  if (t === "stakeholder") return "stakeholder";
  if (t === "knowledge") return "knowledge";
  if (t === "nudge") return "nudge";
  const proposed = finding.changes?.entityType?.proposed;
  if (proposed === "todo" || proposed === "action") return "action";
  if (proposed === "risk") return "risk";
  if (/\brisk\b/i.test(finding.fact)) return "risk";
  return "action";
}

function opFromFinding(finding: CaptureFinding): SuggestionOp {
  if (finding.findingType === "ENTITY_COMPLETED") return "complete";
  if (finding.findingType === "NEW_INFORMATION") return "create";
  if (finding.findingType === "ENTITY_UPDATED") return "update";
  return "update";
}

/** Surface coverage gaps that never became proposed operations. */
function buildCoverageGapViewModels(
  result: CaptureResult,
  captureText: string,
  coveredFindingIds: Set<string>,
): ReviewChangeViewModel[] {
  const coverage = result.findingCoverage?.items ?? [];
  const findingsById = new Map((result.findings ?? []).map((f) => [f.id, f]));
  const gaps: ReviewChangeViewModel[] = [];

  for (const item of coverage) {
    if (
      item.disposition !== "needs_review" &&
      item.disposition !== "unmatched"
    ) {
      continue;
    }
    if (coveredFindingIds.has(item.findingId)) continue;
    const finding = findingsById.get(item.findingId);
    if (!finding) continue;

    const kind = kindFromFinding(finding);
    const op = opFromFinding(finding);
    const suggestion: PendingSuggestion = {
      id: `coverage-${item.findingId}`,
      kind,
      op,
      content: finding.fact,
      destination: "project",
      projectId: result.knowledgeProjectId ?? result.memory.projectId,
    };

    gaps.push({
      id: suggestion.id,
      suggestion,
      entityKind: kind,
      entityLabel: KIND_LABEL[kind],
      recordName: finding.target?.title || finding.fact.slice(0, 80),
      operation: op,
      operationLabel: OP_LABEL[op],
      readiness: item.disposition,
      needsReviewReason:
        item.disposition === "unmatched"
          ? `Lume understood: ${finding.fact}\n\nLume couldn't confidently identify the existing item this should update.`
          : item.reason,
      diff: {
        label: item.disposition === "unmatched" ? "Unmatched" : "Needs Review",
        from: "—",
        to: finding.fact,
        layout: "from_to",
      },
      evidence: evidenceExcerpts(finding, captureText),
      interpretation:
        finding.reasoningSummary ||
        (item.disposition === "unmatched"
          ? "Lume understood a project change but could not match it to an existing record."
          : "Lume needs a human decision before applying a change."),
      confidence: finding.confidence ?? null,
      finding,
    });
  }

  return gaps;
}

export function buildReviewChangeViewModels(
  suggestions: PendingSuggestion[],
  result: CaptureResult,
  captureText: string,
): ReviewChangeViewModel[] {
  const fromSuggestions = suggestions.map((item) => {
    const operationSource = findOperation(item, result);
    const finding =
      findFinding(operationSource, result) ??
      (item.recommendation?.sourceFindingId
        ? result.findings?.find(
            (f) => f.id === item.recommendation?.sourceFindingId,
          )
        : undefined);
    const coverage = coverageForFinding(result, finding?.id);
    const { readiness, reason } = assessReadiness(
      item,
      finding,
      operationSource,
      coverage,
    );
    const recordName =
      operationSource?.targetTitle ||
      item.recommendation?.targetTitle ||
      item.content;

    return {
      id: item.id,
      suggestion: item,
      entityKind: item.kind,
      entityLabel: KIND_LABEL[item.kind],
      recordName,
      operation: item.op,
      operationLabel: OP_LABEL[item.op],
      readiness,
      needsReviewReason: reason,
      diff: buildDiff(item, operationSource, finding),
      evidence: evidenceExcerpts(finding, captureText),
      interpretation: buildInterpretation(item, finding),
      confidence:
        operationSource?.confidence ??
        finding?.confidence ??
        item.recommendation?.confidence ??
        null,
      finding,
      operationSource,
    };
  });

  const coveredFindingIds = new Set(
    fromSuggestions
      .map((m) => m.finding?.id)
      .filter((id): id is string => Boolean(id)),
  );
  // Also treat ops' source findings as covered even if finding join failed.
  for (const op of result.proposedOperations ?? []) {
    coveredFindingIds.add(op.sourceFindingId);
  }

  const gaps = buildCoverageGapViewModels(
    result,
    captureText,
    coveredFindingIds,
  );
  return [...fromSuggestions, ...gaps];
}

/**
 * @deprecated Prefer computeReviewCounts from ./counts for shared summary logic.
 * Kept for callers that only have pending models.
 */
export function reviewCounts(models: ReviewChangeViewModel[]) {
  const ready = models.filter((m) => m.readiness === "ready").length;
  const needsReview = models.filter((m) => m.readiness === "needs_review").length;
  return { ready, needsReview, total: models.length };
}

export {
  computeReviewCounts,
  countProjectChangesDetected,
  pendingReadyModels,
  uniqueProjectChangeFindings,
  findingRepresentsProjectChange,
} from "./counts";
export type { ReviewCountSummary } from "./counts";
