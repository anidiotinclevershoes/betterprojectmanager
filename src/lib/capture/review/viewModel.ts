/**
 * Presentation view-models for Capture suggested-change cards.
 * Joins existing suggestions with findings/operations for display only.
 */

import type { CaptureResult } from "@/lib/types";
import type { CaptureFinding, ProposedOperation } from "@/lib/capture/findings";
import {
  KIND_LABEL,
  OP_LABEL,
  isDestructiveOp,
  type PendingSuggestion,
  type SuggestionKind,
  type SuggestionOp,
} from "@/lib/capture/suggestions";

export type ReviewReadiness = "ready" | "needs_review";

export type ChangeDiff = {
  label: string;
  from: string;
  to: string;
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

function buildDiff(
  item: PendingSuggestion,
  op: ProposedOperation | undefined,
  finding: CaptureFinding | undefined,
): ChangeDiff | undefined {
  if (item.op === "complete") {
    const prev =
      typeof finding?.changes?.status?.previous === "string"
        ? String(finding.changes.status.previous)
        : "Open";
    return {
      label: "Status",
      from: prev === "OPEN" || prev === "open" ? "Open" : prev,
      to: "Complete",
    };
  }

  const values = op?.proposedValues ?? {};
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
    };
  }

  if (item.op === "create") {
    return {
      label: "New",
      from: "—",
      to: item.content,
    };
  }

  if (typeof values.status === "string") {
    const prev =
      typeof finding?.changes?.status?.previous === "string"
        ? String(finding.changes.status.previous)
        : "Open";
    return {
      label: "Status",
      from: prev === "OPEN" || prev === "open" ? "Open" : prev,
      to:
        values.status === "COMPLETED" || values.status === "RESOLVED"
          ? "Resolved"
          : String(values.status),
    };
  }

  return undefined;
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

function assessReadiness(
  item: PendingSuggestion,
  finding: CaptureFinding | undefined,
  op: ProposedOperation | undefined,
): { readiness: ReviewReadiness; reason?: string } {
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
      readiness: "needs_review",
      reason: finding.validationWarning || "Target record could not be matched confidently.",
    };
  }
  if (isDestructiveOp(item.op)) {
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
  if (finding?.findingType === "AMBIGUOUS") {
    return {
      readiness: "needs_review",
      reason: "The Capture contained ambiguous evidence for this change.",
    };
  }
  return { readiness: "ready" };
}

export function buildReviewChangeViewModels(
  suggestions: PendingSuggestion[],
  result: CaptureResult,
  captureText: string,
): ReviewChangeViewModel[] {
  return suggestions.map((item) => {
    const operationSource = findOperation(item, result);
    const finding = findFinding(operationSource, result);
    const { readiness, reason } = assessReadiness(item, finding, operationSource);
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
}

export function reviewCounts(models: ReviewChangeViewModel[]) {
  const ready = models.filter((m) => m.readiness === "ready").length;
  const needsReview = models.filter((m) => m.readiness === "needs_review").length;
  return { ready, needsReview, total: models.length };
}
