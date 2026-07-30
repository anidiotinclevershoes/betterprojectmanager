import type {
  CaptureResult,
  KnowledgeSectionId,
  Recommendation,
  TimelineItemInput,
} from "@/lib/types";
import type { CaptureContextManifest } from "@/lib/capture/context";

export type SuggestionKind =
  | "action"
  | "milestone"
  | "decision"
  | "risk"
  | "stakeholder"
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
  date?: string;
  destination: string;
  targetTodoId?: string;
  recommendation?: Recommendation;
  timelineItem?: TimelineItemInput;
  knowledgeSection?: KnowledgeSectionId;
  knowledgeBullet?: string;
};

export const KIND_LABEL: Record<SuggestionKind, string> = {
  action: "To Do",
  milestone: "Milestone",
  decision: "Decision",
  risk: "Risk",
  stakeholder: "Stakeholder",
  knowledge: "Knowledge",
  nudge: "Nudge",
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
      return "To Do";
    case "nudge":
      return "Nudge";
    case "meeting":
      return "Meeting";
    case "milestone":
      return "Milestone";
    case "memory":
    case "knowledge":
    case "decision":
    case "risk":
    case "stakeholder":
      return "Knowledge";
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

    // Completing/updating/removing needs a target when possible
    if (
      (op === "complete" ||
        op === "update" ||
        op === "delete" ||
        op === "remove" ||
        op === "archive") &&
      !matched &&
      !fromSchema
    ) {
      // Keep inferred op if AI said so via schema; otherwise create
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
  error: string | null;
  source: "typed" | "recorded" | "uploaded";
  historyId: string | null;
  analysedAt: string | null;
  contextManifest?: CaptureContextManifest | null;
};

export const CAPTURE_SESSION_KEY = "lume-capture-session-v1";

/**
 * Deferred: improve suggested-operation inference using existing-record
 * matching and explicit operation evidence.
 * Do not expand prompt/schema complexity until that backlog item is scheduled.
 */
