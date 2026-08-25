import type {
  CaptureResult,
  KnowledgeSectionId,
  Recommendation,
  TimelineItemInput,
} from "@/lib/types";
import type { CaptureContextManifest } from "@/lib/capture/context";
import type { CaptureReliabilityAssessment } from "@/lib/capture/reliability";

export type SuggestionKind =
  | "action"
  | "milestone"
  | "decision"
  | "risk"
  | "stakeholder"
  | "availability"
  | "knowledge"
  | "nudge"
  | "meeting"
  | "memory";

export type SuggestionOp =
  | "create"
  | "update"
  | "complete"
  | "archive"
  | "delete"
  | "remove";

export type PendingSuggestion = {
  id: string;
  kind: SuggestionKind;
  op: SuggestionOp;
  content: string;
  projectId?: string | null;
  projectName?: string | null;
  projectCode?: string | null;
  /** True when project destination must be chosen by the user. */
  projectUncertain?: boolean;
  projectCandidates?: Array<{ id: string; name: string; code?: string }>;
  date?: string;
  destination: string;
  targetTodoId?: string;
  recommendation?: Recommendation;
  timelineItem?: TimelineItemInput;
  knowledgeSection?: KnowledgeSectionId;
  knowledgeBullet?: string;
  /** To Do follow-up semantics (Waiting / Chase). */
  todoKind?: import("@/lib/types").TodoKind;
  waitingOn?: string;
  /** Compact Knowledge remember proposal. */
  isKnowledgeRemember?: boolean;
  /** Phase 3B — legal mutation domain. Unsupported findings must not write. */
  legalDomain?: import("./apply/types").CaptureLegalDomain;
  /** Durable identity for the authoritative object (Risk/Person/milestone/todo). */
  targetEntityId?: string;
  personId?: string;
  personName?: string;
  ownershipSemantics?: import("./apply/types").OwnershipSemantics;
  responsibilityScope?: string;
  replacePersonId?: string;
  proposedValues?: Record<string, unknown>;
};

export const KIND_LABEL: Record<SuggestionKind, string> = {
  action: "To Do",
  milestone: "Milestone",
  decision: "Decision",
  risk: "Risk",
  stakeholder: "Stakeholder",
  availability: "Availability",
  knowledge: "Knowledge",
  nudge: "To Do",
  meeting: "Meeting",
  memory: "Knowledge",
};

export const OP_LABEL: Record<SuggestionOp, string> = {
  create: "Create",
  update: "Update",
  complete: "Complete",
  archive: "Archive",
  delete: "Delete",
  remove: "Remove",
};

const OPS = new Set<string>(Object.keys(OP_LABEL));
const KINDS = new Set<string>(Object.keys(KIND_LABEL));

const DESTRUCTIVE_OPS = new Set<SuggestionOp>([
  "remove",
  "archive",
  "delete",
]);

export function isDestructiveOp(op: SuggestionOp) {
  return DESTRUCTIVE_OPS.has(op);
}

/** Parse AI operation; unknown values fall back safely and log in development. */
export function parseSuggestionOp(
  raw: unknown,
  context = "suggestion",
): SuggestionOp {
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const aliases: Record<string, SuggestionOp> = {
      create: "create",
      add: "create",
      update: "update",
      change: "update",
      change_due: "update",
      rename: "update",
      complete: "complete",
      done: "complete",
      finish: "complete",
      archive: "archive",
      delete: "delete",
      remove: "remove",
    };
    const mapped = aliases[normalized];
    if (mapped && OPS.has(mapped)) return mapped;
    if (OPS.has(normalized)) return normalized as SuggestionOp;
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[capture] schema mismatch: unknown operation for ${context}:`,
      raw,
      "— falling back to create",
    );
  }
  return "create";
}

export function parseSuggestionKind(
  raw: unknown,
  fallback: SuggestionKind,
  context = "suggestion",
): SuggestionKind {
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const aliases: Record<string, SuggestionKind> = {
      action: "action",
      todo: "action",
      to_do: "action",
      milestone: "milestone",
      decision: "decision",
      risk: "risk",
      stakeholder: "stakeholder",
      availability: "availability",
      away: "availability",
      knowledge: "knowledge",
      nudge: "nudge",
      meeting: "meeting",
      memory: "memory",
    };
    const mapped = aliases[normalized];
    if (mapped && KINDS.has(mapped)) return mapped;
    if (KINDS.has(normalized)) return normalized as SuggestionKind;
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[capture] schema mismatch: unknown itemType for ${context}:`,
      raw,
      `— falling back to ${fallback}`,
    );
  }
  return fallback;
}

export function destinationFor(kind: SuggestionKind): string {
  switch (kind) {
    case "action":
    case "nudge":
      return "To Do";
    case "meeting":
      return "Meeting Prep";
    case "milestone":
      return "Timeline";
    case "risk":
      return "Risks";
    case "memory":
    case "knowledge":
    case "decision":
      return "Knowledge";
    case "stakeholder":
      return "Stakeholders";
    case "availability":
      return "People";
    default:
      return "Workspace";
  }
}

function kindFromRecommendation(rec: Recommendation): SuggestionKind {
  if (rec.itemType) {
    return parseSuggestionKind(rec.itemType, "action", rec.title);
  }
  if (rec.kind === "risk") return "risk";
  if (rec.kind === "decision") return "decision";
  if (rec.kind === "meeting" || rec.kind === "meeting_prep") return "meeting";
  if (rec.kind === "stakeholder_update") return "nudge";
  return "action";
}

function inferOpFromText(title: string, action: string): SuggestionOp | null {
  const text = `${title} ${action}`;
  if (/\b(complete|completed|finished|done|closed|resolved)\b/i.test(text)) {
    return "complete";
  }
  if (/\b(delete|deleted|cancel|cancelled|canceled)\b/i.test(text)) {
    return "delete";
  }
  if (/\b(remove|removed|drop|dropped)\b/i.test(text)) {
    return "remove";
  }
  if (/\b(archive|archived)\b/i.test(text)) {
    return "archive";
  }
  if (
    /\b(update|updated|change|changed|rename|renamed|due|deadline)\b/i.test(
      text,
    )
  ) {
    return "update";
  }
  return null;
}

function matchTodo(
  openTodos: { id: string; title: string }[],
  targetTitle?: string,
  content?: string,
) {
  if (targetTitle) {
    const needle = targetTitle.toLowerCase();
    const exact = openTodos.find((t) => t.title.toLowerCase() === needle);
    if (exact) return exact;
    const partial = openTodos.find(
      (t) =>
        t.title.toLowerCase().includes(needle.slice(0, 24)) ||
        needle.includes(t.title.toLowerCase().slice(0, 24)),
    );
    if (partial) return partial;
  }
  if (content) {
    const blob = content.toLowerCase();
    return openTodos.find((t) => blob.includes(t.title.toLowerCase().slice(0, 24)));
  }
  return undefined;
}

export function buildSuggestions(
  result: CaptureResult,
  openTodos: {
    id: string;
    title: string;
    projectId?: string | null;
    dueAt?: string;
  }[] = [],
): PendingSuggestion[] {
  // Prefer deterministic proposed operations when the findings pipeline ran
  // (including empty arrays — do not fall back to legacy memory dumping).
  if (result.proposedOperations) {
    return buildSuggestionsFromProposedOps(result, openTodos);
  }

  const items: PendingSuggestion[] = [];
  const projectId = result.knowledgeProjectId || result.memory.projectId;

  items.push({
    id: `memory-${result.memory.id}`,
    kind: "memory",
    op: "create",
    content: result.memory.title,
    projectId: result.memory.projectId,
    destination: destinationFor("memory"),
  });

  for (const rec of result.recommendations) {
    const kind = kindFromRecommendation(rec);
    const matched = matchTodo(
      openTodos,
      rec.targetTitle,
      `${rec.title} ${rec.action}`,
    );
    const fromSchema = rec.operation
      ? parseSuggestionOp(rec.operation, rec.title)
      : null;
    const inferred = inferOpFromText(rec.title, rec.action);
    let op: SuggestionOp = fromSchema ?? inferred ?? "create";

    if (
      (op === "complete" ||
        op === "update" ||
        op === "delete" ||
        op === "remove" ||
        op === "archive") &&
      !matched &&
      !fromSchema
    ) {
      if (!fromSchema) op = "create";
    }

    items.push({
      id: `rec-${rec.id}`,
      kind,
      op,
      content: rec.title,
      projectId: rec.projectId ?? projectId,
      destination: destinationFor(kind),
      targetTodoId: matched?.id,
      recommendation: rec,
    });
  }

  for (const [index, item] of (result.timelinePatch ?? []).entries()) {
    items.push({
      id: `tl-${index}-${item.label}`,
      kind: "milestone",
      op: "create",
      content: item.label,
      projectId,
      date: item.startAt?.slice(0, 10),
      destination: destinationFor("milestone"),
      timelineItem: item,
    });
  }

  if (result.knowledgePatch) {
    for (const [section, bullets] of Object.entries(result.knowledgePatch) as [
      KnowledgeSectionId,
      string[] | undefined,
    ][]) {
      for (const [index, bullet] of (bullets ?? []).entries()) {
        const kind: SuggestionKind =
          section === "risks"
            ? "risk"
            : section === "decisions"
              ? "decision"
              : section === "people"
                ? "stakeholder"
                : "knowledge";
        items.push({
          id: `know-${section}-${index}`,
          kind,
          op: "create",
          content: bullet,
          projectId,
          destination: destinationFor(kind),
          knowledgeSection: section,
          knowledgeBullet: bullet,
        });
      }
    }
  }

  return items
    .map((item, i) => ({ ...item, id: `${item.id}-${i}` }))
    .filter((item) => item.content.trim());
}

function buildSuggestionsFromProposedOps(
  result: CaptureResult,
  openTodos: {
    id: string;
    title: string;
    projectId?: string | null;
    dueAt?: string;
  }[],
): PendingSuggestion[] {
  const projectId = result.knowledgeProjectId || result.memory.projectId;
  const items: PendingSuggestion[] = [];

  for (const op of result.proposedOperations ?? []) {
    if (op.operation === "NO_CHANGE") continue;
    const availabilityHint =
      op.proposedValues?.kind === "availability" ||
      typeof op.proposedValues?.awayFromIso === "string";
    const knownEntity =
      op.entityType === "todo" ||
      op.entityType === "risk" ||
      op.entityType === "knowledge" ||
      op.entityType === "stakeholder" ||
      op.entityType === "meeting" ||
      op.entityType === "milestone" ||
      op.entityType === "nudge";
    const kind: SuggestionKind = availabilityHint
      ? "availability"
      : op.entityType === "todo"
        ? "action"
        : op.entityType === "risk"
          ? "risk"
          : op.entityType === "knowledge"
            ? "knowledge"
            : op.entityType === "stakeholder"
              ? "stakeholder"
              : op.entityType === "meeting"
                ? "meeting"
                : op.entityType === "milestone"
                  ? "milestone"
                  : op.entityType === "nudge"
                    ? "action"
                    : "knowledge";
    const suggestionOp = op.operation.toLowerCase() as SuggestionOp;
    const matched =
      op.entityType === "todo" || op.entityType === "nudge"
        ? openTodos.find((t) => t.id === op.targetId) ??
          matchTodo(openTodos, op.targetTitle)
        : undefined;
    const rec = result.recommendations.find(
      (r) =>
        r.proposedOperationId === op.id ||
        r.sourceFindingId === op.sourceFindingId,
    );
    const proposedText =
      typeof op.proposedValues?.text === "string"
        ? String(op.proposedValues.text)
        : op.targetTitle ?? op.reason;

    const finding = result.findings?.find((f) => f.id === op.sourceFindingId);
    const pid =
      op.projectId ??
      finding?.projectId ??
      rec?.projectId ??
      projectId ??
      null;
    const projectName =
      op.projectName ??
      finding?.projectName ??
      null;
    const projectCode =
      op.projectCode ??
      finding?.projectCode ??
      finding?.projectCandidates?.find((c) => c.id === pid)?.code ??
      null;
    const projectUncertain =
      Boolean(finding?.projectCandidates?.length) && !pid;
    const isRemember = kind === "knowledge" && suggestionOp === "create";

    const todoKindRaw = op.proposedValues?.todoKind;
    const todoKind =
      todoKindRaw === "CHASE" ||
      todoKindRaw === "WAITING" ||
      todoKindRaw === "REMINDER" ||
      todoKindRaw === "ACTION"
        ? todoKindRaw
        : undefined;
    const waitingOn =
      typeof op.proposedValues?.waitingOn === "string"
        ? String(op.proposedValues.waitingOn)
        : undefined;
    const ownershipRaw = op.proposedValues?.ownershipSemantics;
    const ownershipSemantics =
      ownershipRaw === "share" ||
      ownershipRaw === "replace" ||
      ownershipRaw === "continue" ||
      ownershipRaw === "ambiguous"
        ? ownershipRaw
        : undefined;
    const personName =
      typeof op.proposedValues?.personName === "string"
        ? String(op.proposedValues.personName)
        : undefined;
    const personId =
      typeof op.proposedValues?.personId === "string"
        ? String(op.proposedValues.personId)
        : op.entityType === "stakeholder"
          ? op.targetId
          : undefined;
    const responsibilityScope =
      typeof op.proposedValues?.scope === "string"
        ? String(op.proposedValues.scope)
        : undefined;
    const replacePersonId =
      typeof op.proposedValues?.replacePersonId === "string"
        ? String(op.proposedValues.replacePersonId)
        : undefined;
    const legalDomain = !knownEntity
      ? ("unsupported" as const)
      : availabilityHint
        ? ("availability" as const)
        : ownershipSemantics || responsibilityScope
          ? ("responsibility" as const)
          : undefined;
    const durableId = op.targetId;
    const targetTodoId =
      matched?.id ??
      (op.entityType === "todo" || op.entityType === "nudge"
        ? op.targetId
        : undefined);

    items.push({
      id: `op-${op.id}`,
      kind,
      op: suggestionOp,
      content: proposedText,
      projectId: pid,
      projectName,
      projectCode,
      projectUncertain,
      projectCandidates: finding?.projectCandidates,
      date:
        typeof op.proposedValues?.dueDate === "string"
          ? String(op.proposedValues.dueDate)
          : typeof op.proposedValues?.date === "string"
            ? String(op.proposedValues.date)
            : typeof op.proposedValues?.awayFromIso === "string"
              ? String(op.proposedValues.awayFromIso)
              : undefined,
      destination: destinationFor(kind),
      targetTodoId,
      targetEntityId: durableId,
      recommendation: rec,
      knowledgeSection: isRemember
        ? "now"
        : kind === "risk"
          ? "risks"
          : undefined,
      knowledgeBullet:
        isRemember || kind === "risk" ? proposedText : undefined,
      isKnowledgeRemember: isRemember && suggestionOp === "create",
      todoKind,
      waitingOn,
      legalDomain,
      personId,
      personName,
      ownershipSemantics,
      responsibilityScope,
      replacePersonId,
      proposedValues: op.proposedValues,
    });
  }

  return items
    .map((item, i) => ({ ...item, id: `${item.id}-${i}` }))
    .filter((item) => item.content.trim());
}

export type CaptureReviewOverride = {
  readiness?: "ready" | "needs_review" | "unmatched";
  reviewReason?:
    | "TARGET_UNCERTAIN"
    | "ENTITY_TYPE_UNCERTAIN"
    | "STATE_UNCERTAIN"
    | "OPERATION_UNCERTAIN"
    | "VALUE_UNCERTAIN"
    | "PROJECT_UNCERTAIN"
    | null;
  kind?: SuggestionKind;
  op?: SuggestionOp;
  content?: string;
  targetTodoId?: string;
  recordName?: string;
  projectId?: string | null;
  projectName?: string | null;
  accepted?: boolean;
};

export type CapturePersistSlice = {
  content: string;
  projectId: string;
  fileNames: string[];
  result: CaptureResult | null;
  suggestions: PendingSuggestion[];
  dismissed: Record<string, boolean>;
  added: Record<string, boolean>;
  editing: Record<string, string>;
  collapsed: boolean;
  /** Capture chrome maximized (expand). */
  maximized?: boolean;
  /** Deterministic user corrections — no AI re-run. */
  reviewOverrides?: Record<string, CaptureReviewOverride>;
  error: string | null;
  source: "typed" | "recorded" | "uploaded";
  historyId: string | null;
  analysedAt: string | null;
  contextManifest?: CaptureContextManifest | null;
  reliability?: CaptureReliabilityAssessment | null;
  /** User dismissed the pre-analysis long-capture notice for this draft. */
  preWarnDismissed?: boolean;
};

export const CAPTURE_SESSION_KEY = "lume-capture-session-v1";

/**
 * Deferred: improve suggested-operation inference using existing-record
 * matching and explicit operation evidence.
 * Do not expand prompt/schema complexity until that backlog item is scheduled.
 */
