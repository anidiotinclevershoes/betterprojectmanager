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
  destinationFor,
  isDestructiveOp,
  type PendingSuggestion,
  type SuggestionKind,
  type SuggestionOp,
} from "@/lib/capture/suggestions";
import { unsupportedApplyReason } from "@/lib/capture/apply/executability";
import {
  assessApplyReadiness,
  attachReviewExpectedTarget,
  type ReviewPreflightContext,
} from "@/lib/capture/apply/readiness";
import {
  deriveReviewReason,
  friendlierNeedsYouCopy,
  missingDateCopy,
  reviewReasonCopy,
  type ReviewReason,
} from "./reviewReason";

export type ReviewReadiness = "ready" | "needs_review" | "unmatched";
export type { ReviewReason };

export type ChangeDiffLayout = "from_to" | "create" | "remove" | "suggested_only";

export type ChangeDiff = {
  label: string;
  from: string;
  to: string;
  /** How the card should render the change. */
  layout?: ChangeDiffLayout;
  /** Optional secondary line (e.g. due date on create). */
  meta?: string;
};

/** User corrections applied without another AI call. */
export type ReviewCorrectionOverride = {
  readiness?: ReviewReadiness;
  reviewReason?: ReviewReason | null;
  kind?: SuggestionKind;
  op?: SuggestionOp;
  content?: string;
  targetTodoId?: string;
  recordName?: string;
  projectId?: string | null;
  projectName?: string | null;
  /** Accept proposed target — Ready only if the shared preflight can write. */
  accepted?: boolean;
  date?: string;
  targetEntityId?: string;
  /** Apply-time demotion copy. Must not be overwritten by a stale client world. */
  blockedReason?: string;
};

export type { ReviewPreflightContext };

export type ReviewChangeViewModel = {
  id: string;
  suggestion: PendingSuggestion;
  entityKind: SuggestionKind;
  entityLabel: string;
  recordName: string;
  operation: SuggestionOp;
  operationLabel: string;
  readiness: ReviewReadiness;
  /**
   * False when Apply has no legal, representable mutation for this
   * domain × operation. Ready + Approve require this to be true.
   * Omitted on older fixtures; consumers re-derive when absent.
   */
  executableApply?: boolean;
  /**
   * True when the shared planner preflight constructed a faithful write
   * against the Review world snapshot. Ready requires this. Omitted on
   * older fixtures — `undefined` does not block selector tests.
   */
  canApprove?: boolean;
  needsReviewReason?: string;
  reviewReason?: ReviewReason;
  diff?: ChangeDiff;
  evidence: string[];
  interpretation: string;
  confidence: number | null;
  finding?: CaptureFinding;
  operationSource?: ProposedOperation;
  /** Complex correction UI — may span both columns. */
  spansColumns?: boolean;
  projectId?: string | null;
  projectName?: string | null;
  projectCode?: string | null;
  showProjectLabel?: boolean;
  /** Structured missing field already failed-closed by apply. */
  missingRequiredField?: "date";
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
    if (!prevOwner) {
      return {
        label: "Owner",
        from: "",
        to: ownerVal,
        layout: "suggested_only",
      };
    }
    return {
      label: "Owner",
      from: prevOwner,
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
    if (!prevDate) {
      return {
        label: item.kind === "milestone" ? "Release Date" : "Date",
        from: "",
        to: formatShortDate(String(dateVal)),
        layout: "suggested_only",
      };
    }
    return {
      label: item.kind === "milestone" ? "Release Date" : "Date",
      from: formatShortDate(prevDate),
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
    if (!prevText) {
      return {
        label: KIND_LABEL[item.kind],
        from: "",
        to: textVal ? formatShortDate(textVal) : item.content,
        layout: "suggested_only",
      };
    }
    return {
      label: KIND_LABEL[item.kind],
      from: formatShortDate(prevText),
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
    from: "",
    to: item.content,
    layout: "suggested_only",
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

function namedTargetTitle(
  finding?: CaptureFinding,
  suggestion?: PendingSuggestion,
): string | undefined {
  if (finding?.target?.entityId && finding.target.title) return finding.target.title;
  if (suggestion?.targetEntityId || suggestion?.targetTodoId) {
    return suggestion.content;
  }
  return undefined;
}

function coverageForFinding(
  result: CaptureResult,
  findingId: string | undefined,
): FindingCoverageItem | undefined {
  if (!findingId) return undefined;
  return result.findingCoverage?.items.find((i) => i.findingId === findingId);
}

function proposedString(
  values: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const raw = values?.[key];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function milestoneUpdateMissingDate(
  item: PendingSuggestion,
  op: ProposedOperation | undefined,
): boolean {
  const isMilestone =
    item.kind === "milestone" || op?.entityType === "milestone";
  const isUpdate = item.op === "update" || op?.operation === "UPDATE";
  if (!isMilestone || !isUpdate) return false;
  const values = op?.proposedValues ?? item.proposedValues;
  if (
    item.date?.trim() ||
    proposedString(values, "date") ||
    proposedString(values, "startAt") ||
    proposedString(values, "label")
  ) {
    return false;
  }
  return true;
}

type AssessedReadiness = {
  readiness: ReviewReadiness;
  reason?: string;
  missingRequiredField?: "date";
  executableApply: boolean;
  canApprove: boolean;
};

function assessReadiness(
  item: PendingSuggestion,
  finding: CaptureFinding | undefined,
  op: ProposedOperation | undefined,
  coverage: FindingCoverageItem | undefined,
  capturePipeline: "legacy" | "v2" | undefined,
  captureText: string,
  preflight?: ReviewPreflightContext | null,
  options?: {
    userAccepted?: boolean;
    demoted?: ReviewReadiness;
    blockedReason?: string;
  },
): AssessedReadiness {
  const apply = assessApplyReadiness({
    item,
    text: captureText,
    preflight,
  });

  if (options?.demoted === "unmatched" || options?.demoted === "needs_review") {
    return {
      readiness: options.demoted,
      reason: options.blockedReason || apply.reason,
      missingRequiredField: apply.missingRequiredField,
      executableApply: apply.executableApply,
      canApprove: false,
    };
  }

  if (!apply.executableApply) {
    return {
      readiness: "needs_review",
      reason: apply.reason || unsupportedApplyReason(item, item.content),
      executableApply: false,
      canApprove: false,
    };
  }

  const skipHumanGates = Boolean(options?.userAccepted);

  if (
    item.projectUncertain ||
    (finding?.projectCandidates &&
      finding.projectCandidates.length > 1 &&
      !item.projectId &&
      !finding.projectId)
  ) {
    return {
      readiness: "needs_review",
      reason: "Which project does this refer to?",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }
  if (item.legalDomain === "unsupported") {
    return {
      readiness: "needs_review",
      reason: "Lume cannot safely apply this finding to a maintained record.",
      executableApply: false,
      canApprove: false,
    };
  }
  if (item.ownershipSemantics === "ambiguous") {
    return {
      readiness: "needs_review",
      reason: "Should this share or replace the current owner?",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }
  if (
    (item.op === "create" || op?.operation === "CREATE") &&
    !item.projectId &&
    !op?.projectId &&
    !finding?.projectId
  ) {
    return {
      readiness: "needs_review",
      reason: "Which project does this refer to?",
      executableApply: true,
      canApprove: false,
    };
  }
  if (!skipHumanGates && coverage?.disposition === "unmatched") {
    return {
      readiness: "unmatched",
      reason:
        coverage.reason ||
        "Lume couldn't confidently identify the existing item this should update.",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }
  if (!skipHumanGates && coverage?.disposition === "needs_review") {
    return {
      readiness: "needs_review",
      reason:
        coverage.reason ||
        finding?.clarificationQuestion ||
        "Lume needs clarification before this change is applied.",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }
  if (
    !skipHumanGates &&
    (finding?.requiresClarification || op?.requiresClarification)
  ) {
    return {
      readiness: "needs_review",
      reason:
        finding?.clarificationQuestion ||
        "Lume needs clarification before this change is applied.",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }
  if (!skipHumanGates && finding?.invalidTarget) {
    return {
      readiness: "unmatched",
      reason:
        finding.validationWarning ||
        "Lume couldn't confidently identify the existing item this should update.",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }
  if (!skipHumanGates && finding?.findingType === "AMBIGUOUS") {
    return {
      readiness: "needs_review",
      reason: "The Capture contained ambiguous evidence for this change.",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }
  if (!skipHumanGates && opsDisagree(item, op)) {
    return {
      readiness: "needs_review",
      reason: "Finding and proposed operation are inconsistent.",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }
  if (!skipHumanGates && (isDestructiveOp(item.op) || op?.destructive)) {
    return {
      readiness: "needs_review",
      reason: "Destructive action — confirm before applying.",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }
  if (milestoneUpdateMissingDate(item, op) && !apply.canApprove) {
    return {
      readiness: "needs_review",
      reason: missingDateCopy(
        op?.targetTitle || item.content || finding?.target?.title,
      ),
      missingRequiredField: "date",
      executableApply: true,
      canApprove: false,
    };
  }
  if (!skipHumanGates && capturePipeline !== "v2") {
    const confidence =
      op?.confidence ?? finding?.confidence ?? item.recommendation?.confidence;
    if (typeof confidence === "number" && confidence < 70) {
      return {
        readiness: "needs_review",
        reason: "Confidence is below the ready threshold.",
        executableApply: true,
        canApprove: apply.canApprove,
      };
    }
  }
  if (!skipHumanGates && !op && finding?.findingType === "NEW_INFORMATION") {
    return {
      readiness: "needs_review",
      reason: "Cannot safely produce a single operation from this finding.",
      executableApply: true,
      canApprove: apply.canApprove,
    };
  }

  if (!apply.canApprove) {
    return {
      readiness: "needs_review",
      reason: apply.reason,
      missingRequiredField: apply.missingRequiredField,
      executableApply: true,
      canApprove: false,
    };
  }

  return {
    readiness: "ready",
    executableApply: true,
    canApprove: true,
  };
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
  preflight?: ReviewPreflightContext | null,
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
    const projectUncertain =
      Boolean(finding.projectCandidates?.length) && !finding.projectId;
    const matchingOp = (result.proposedOperations ?? []).find(
      (op) => op.sourceFindingId === item.findingId,
    );
    const ownershipRaw = matchingOp?.proposedValues?.ownershipSemantics;
    const ownershipSemantics =
      ownershipRaw === "share" ||
      ownershipRaw === "replace" ||
      ownershipRaw === "continue" ||
      ownershipRaw === "ambiguous"
        ? ownershipRaw
        : undefined;
    const personName =
      typeof matchingOp?.proposedValues?.personName === "string"
        ? String(matchingOp.proposedValues.personName)
        : typeof matchingOp?.proposedValues?.name === "string"
          ? String(matchingOp.proposedValues.name)
          : undefined;
    const responsibilityScope =
      typeof matchingOp?.proposedValues?.scope === "string"
        ? String(matchingOp.proposedValues.scope)
        : undefined;
    const suggestion: PendingSuggestion = attachReviewExpectedTarget(
      {
        id: `coverage-${item.findingId}`,
        kind,
        op,
        content: finding.fact,
        destination: destinationFor(kind),
        projectId: projectUncertain
          ? null
          : (finding.projectId ??
            result.knowledgeProjectId ??
            result.memory.projectId),
        projectName: projectUncertain ? null : (finding.projectName ?? null),
        projectUncertain,
        projectCandidates: finding.projectCandidates,
        legalDomain: ownershipSemantics || responsibilityScope
          ? "responsibility"
          : undefined,
        personName,
        ownershipSemantics,
        responsibilityScope,
        proposedValues: matchingOp?.proposedValues,
      },
      preflight?.world,
    );

    const assessed = assessReadiness(
      suggestion,
      finding,
      matchingOp,
      item,
      result.capturePipeline,
      captureText,
      preflight,
    );
    const readiness =
      assessed.readiness === "ready" ? item.disposition : assessed.readiness;
    const reviewReason = deriveReviewReason({
      readiness,
      finding,
      coverage: item,
      suggestion,
      needsReviewReason: assessed.reason || item.reason,
      capturePipeline: result.capturePipeline,
    });
    const recordName = finding.target?.title || finding.fact.slice(0, 80);
    const rawReason = assessed.reason || item.reason;
    const executableApply = assessed.executableApply;
    const friendly = friendlierNeedsYouCopy(
      rawReason || finding.clarificationQuestion,
    );
    const reasonText = !executableApply
      ? unsupportedApplyReason(suggestion, recordName)
      : friendly ??
        (reviewReason
          ? reviewReasonCopy(reviewReason, {
              recordName:
                reviewReason === "TARGET_UNCERTAIN"
                  ? finding.target?.title
                  : recordName,
              entityLabel: KIND_LABEL[kind],
              projectCandidates: finding.projectCandidates,
              incomingPersonName: suggestion.personName,
              scope: suggestion.responsibilityScope,
            })
          : item.disposition === "unmatched"
            ? `Lume understood: ${finding.fact}\n\nLume couldn't confidently identify the existing item this should update.`
            : rawReason);
    gaps.push({
      id: suggestion.id,
      suggestion,
      entityKind: kind,
      entityLabel: KIND_LABEL[kind],
      recordName,
      operation: op,
      operationLabel: OP_LABEL[op],
      readiness: executableApply ? readiness : "needs_review",
      executableApply,
      canApprove: false,
      reviewReason: executableApply ? reviewReason : "OPERATION_UNCERTAIN",
      needsReviewReason: reasonText,
      diff: {
        label: item.disposition === "unmatched" ? "Unmatched" : "Needs you",
        from: "",
        to: finding.fact,
        layout: "suggested_only",
      },
      evidence: evidenceExcerpts(finding, captureText),
      interpretation:
        finding.reasoningSummary ||
        (item.disposition === "unmatched"
          ? "Lume understood a project change but could not match it to an existing record."
          : "Lume needs a human decision before applying a change."),
      confidence: finding.confidence ?? null,
      finding,
      spansColumns: true,
      projectId: suggestion.projectId,
      projectName: suggestion.projectName,
    });
  }

  return gaps;
}

function applyOverride(
  model: ReviewChangeViewModel,
  override: ReviewCorrectionOverride | undefined,
  captureText: string,
  preflight?: ReviewPreflightContext | null,
  capturePipeline?: "legacy" | "v2",
): ReviewChangeViewModel {
  if (!override) return model;
  const kind = override.kind ?? model.entityKind;
  const op = override.op ?? model.operation;
  const content = override.content ?? model.suggestion.content;
  const recordName = override.recordName ?? model.recordName;
  const suggestion: PendingSuggestion = attachReviewExpectedTarget(
    {
      ...model.suggestion,
      kind,
      op,
      content,
      date: override.date ?? model.suggestion.date,
      targetTodoId: override.targetTodoId ?? model.suggestion.targetTodoId,
      targetEntityId:
        override.targetEntityId ?? model.suggestion.targetEntityId,
      projectId:
        override.projectId !== undefined
          ? override.projectId
          : model.suggestion.projectId,
      projectName:
        override.projectName !== undefined
          ? override.projectName
          : model.suggestion.projectName,
      projectUncertain: override.accepted
        ? false
        : model.suggestion.projectUncertain,
    },
    preflight?.world,
  );
  const demoted =
    override.readiness === "needs_review" || override.readiness === "unmatched"
      ? override.readiness
      : undefined;
  const assessed = assessReadiness(
    suggestion,
    model.finding,
    model.operationSource,
    undefined,
    capturePipeline,
    captureText,
    preflight,
    {
      userAccepted: Boolean(override.accepted) && !demoted,
      demoted,
      blockedReason: override.blockedReason,
    },
  );
  const readiness = assessed.readiness;
  const reviewReason = deriveReviewReason({
    readiness,
    finding: model.finding,
    operation: model.operationSource,
    suggestion,
    needsReviewReason: assessed.reason || override.blockedReason,
    capturePipeline,
  });
  const entityLabel = KIND_LABEL[kind];
  const unsupportedCopy = assessed.executableApply
    ? undefined
    : unsupportedApplyReason(suggestion, recordName);
  const reasonText =
    override.blockedReason ||
    unsupportedCopy ||
    (reviewReason
      ? friendlierNeedsYouCopy(assessed.reason) ??
        reviewReasonCopy(reviewReason, {
          recordName:
            reviewReason === "TARGET_UNCERTAIN"
              ? namedTargetTitle(model.finding, suggestion)
              : recordName,
          entityLabel,
          projectCandidates: suggestion.projectCandidates,
          incomingPersonName: suggestion.personName,
          scope: suggestion.responsibilityScope,
        })
      : assessed.reason);
  return {
    ...model,
    suggestion,
    entityKind: kind,
    entityLabel,
    recordName,
    operation: op,
    operationLabel:
      suggestion.isKnowledgeRemember && op === "create"
        ? "Remember"
        : kind === "risk" && op === "complete"
          ? "Resolve"
          : OP_LABEL[op],
    readiness,
    executableApply: assessed.executableApply,
    canApprove: assessed.canApprove,
    reviewReason: readiness === "ready" ? undefined : reviewReason,
    needsReviewReason: readiness === "ready" ? undefined : reasonText,
    diff:
      op === "create"
        ? {
            label: suggestion.isKnowledgeRemember
              ? "Remember · Knowledge"
              : `New ${entityLabel}`,
            from: "",
            to: content,
            layout: "create",
          }
        : model.diff,
    spansColumns: readiness !== "ready",
    projectId: suggestion.projectId,
    projectName: suggestion.projectName,
    projectCode: suggestion.projectCode ?? model.projectCode,
    missingRequiredField:
      readiness === "ready" ? undefined : assessed.missingRequiredField,
  };
}

export function buildReviewChangeViewModels(
  suggestions: PendingSuggestion[],
  result: CaptureResult,
  captureText: string,
  overrides: Record<string, ReviewCorrectionOverride> = {},
  preflight?: ReviewPreflightContext | null,
): ReviewChangeViewModel[] {
  const fromSuggestions = suggestions.map((rawItem) => {
    const item = attachReviewExpectedTarget(rawItem, preflight?.world);
    const operationSource = findOperation(item, result);
    const finding =
      findFinding(operationSource, result) ??
      (item.recommendation?.sourceFindingId
        ? result.findings?.find(
            (f) => f.id === item.recommendation?.sourceFindingId,
          )
        : undefined);
    const coverage = coverageForFinding(result, finding?.id);
    const override = overrides[item.id];
    const {
      readiness,
      reason,
      missingRequiredField,
      executableApply: assessedExecutable,
      canApprove,
    } = assessReadiness(
      item,
      finding,
      operationSource,
      coverage,
      result.capturePipeline,
      captureText,
      preflight,
    );
    const recordName =
      operationSource?.targetTitle ||
      item.recommendation?.targetTitle ||
      item.content;
    const projectId =
      item.projectId ??
      operationSource?.projectId ??
      finding?.projectId ??
      null;
    const projectName =
      item.projectName ??
      operationSource?.projectName ??
      finding?.projectName ??
      null;
    const reviewReason = deriveReviewReason({
      readiness,
      finding,
      operation: operationSource,
      coverage,
      suggestion: item,
      needsReviewReason: reason,
      capturePipeline: result.capturePipeline,
    });
    const executableApply = assessedExecutable;
    const friendly = friendlierNeedsYouCopy(
      reason || finding?.clarificationQuestion,
    );
    const useCorrectionCopy =
      reviewReason === "TARGET_UNCERTAIN" ||
      reviewReason === "PROJECT_UNCERTAIN" ||
      reviewReason === "OWNERSHIP_UNCERTAIN";
    let reasonText = !executableApply
      ? unsupportedApplyReason(item, recordName)
      : friendly ??
        (useCorrectionCopy && reviewReason
          ? reviewReasonCopy(reviewReason, {
              recordName:
                reviewReason === "TARGET_UNCERTAIN"
                  ? namedTargetTitle(finding, item)
                  : recordName,
              entityLabel: KIND_LABEL[item.kind],
              projectCandidates:
                item.projectCandidates ?? finding?.projectCandidates,
              incomingPersonName: item.personName,
              scope: item.responsibilityScope,
            })
          : reason) ??
        (reviewReason
          ? reviewReasonCopy(reviewReason, {
              recordName: recordName,
              entityLabel: KIND_LABEL[item.kind],
              projectCandidates:
                item.projectCandidates ?? finding?.projectCandidates,
              incomingPersonName: item.personName,
              scope: item.responsibilityScope,
            })
          : undefined);
    if (executableApply && missingRequiredField === "date") {
      reasonText = missingDateCopy(recordName);
    }

    const model: ReviewChangeViewModel = {
      id: item.id,
      suggestion: item,
      entityKind: item.kind,
      entityLabel: KIND_LABEL[item.kind],
      recordName,
      operation: item.op,
      operationLabel:
        item.kind === "risk" && item.op === "complete"
          ? "Resolve"
          : item.isKnowledgeRemember
            ? "Remember"
            : OP_LABEL[item.op],
      readiness,
      executableApply,
      canApprove,
      reviewReason,
      needsReviewReason: reasonText,
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
      spansColumns: readiness !== "ready",
      projectId,
      projectName,
      projectCode: item.projectCode,
      missingRequiredField,
    };
    return applyOverride(
      model,
      override,
      captureText,
      preflight,
      result.capturePipeline,
    );
  });

  const projectIds = new Set<string>();
  for (const m of fromSuggestions) {
    if (m.projectId) projectIds.add(m.projectId);
    for (const c of m.suggestion.projectCandidates ?? []) {
      projectIds.add(c.id);
    }
  }
  const multiProject = projectIds.size > 1;
  const withLabels = fromSuggestions.map((m) => ({
    ...m,
    showProjectLabel: multiProject && Boolean(m.projectId || m.projectName),
  }));

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
    preflight,
  ).map((m) =>
    applyOverride(
      m,
      overrides[m.id],
      captureText,
      preflight,
      result.capturePipeline,
    ),
  );
  return [...withLabels, ...gaps];
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
