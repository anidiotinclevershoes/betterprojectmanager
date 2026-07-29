import type {
  CaptureResult,
  KnowledgeSectionId,
  Recommendation,
  TimelineItemInput,
} from "@/lib/types";

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
  | "remove"
  | "rename"
  | "change_due";

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
  rename: "Rename",
  change_due: "Change due date",
};

export const SUGGESTION_KINDS = Object.keys(KIND_LABEL) as SuggestionKind[];
export const SUGGESTION_OPS = Object.keys(OP_LABEL) as SuggestionOp[];

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

export function buildSuggestions(
  result: CaptureResult,
  openTodos: { id: string; title: string; projectId?: string | null; dueAt?: string }[] = [],
): PendingSuggestion[] {
  const items: PendingSuggestion[] = [];
  const projectId = result.knowledgeProjectId || result.memory.projectId;
  const blob = `${result.memory.content} ${result.insights.join(" ")}`.toLowerCase();

  items.push({
    id: `memory-${result.memory.id}`,
    kind: "memory",
    op: "create",
    content: result.memory.title,
    projectId: result.memory.projectId,
    destination: "Knowledge",
  });

  for (const rec of result.recommendations) {
    const kind: SuggestionKind =
      rec.kind === "risk"
        ? "risk"
        : rec.kind === "decision"
          ? "decision"
          : rec.kind === "meeting" || rec.kind === "meeting_prep"
            ? "meeting"
            : rec.kind === "stakeholder_update"
              ? "nudge"
              : "action";
    const matched = openTodos.find((t) =>
      blob.includes(t.title.toLowerCase().slice(0, 24)),
    );
    const completeIntent =
      /\b(complete|done|finished|closed|resolved)\b/i.test(rec.title) ||
      /\b(complete|done|finished|closed|resolved)\b/i.test(rec.action);
    items.push({
      id: `rec-${rec.id}`,
      kind,
      op: matched && completeIntent ? "complete" : matched ? "update" : "create",
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
      destination: "Milestone",
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

  // Surface destructive / update opportunities for open todos referenced in the capture
  for (const todo of openTodos.slice(0, 8)) {
    if (!blob.includes(todo.title.toLowerCase().slice(0, 18))) continue;
    if (items.some((i) => i.targetTodoId === todo.id)) continue;
    if (/\b(delete|remove|drop|cancel)\b/i.test(blob)) {
      items.push({
        id: `todo-del-${todo.id}`,
        kind: "action",
        op: "delete",
        content: todo.title,
        projectId: todo.projectId,
        destination: "To Do",
        targetTodoId: todo.id,
      });
    } else if (/\b(complete|done|finished|closed)\b/i.test(blob)) {
      items.push({
        id: `todo-done-${todo.id}`,
        kind: "action",
        op: "complete",
        content: todo.title,
        projectId: todo.projectId,
        destination: "To Do",
        targetTodoId: todo.id,
      });
    } else if (/\b(rename|retitle|now called)\b/i.test(blob)) {
      items.push({
        id: `todo-rename-${todo.id}`,
        kind: "action",
        op: "rename",
        content: todo.title,
        projectId: todo.projectId,
        destination: "To Do",
        targetTodoId: todo.id,
      });
    } else if (/\b(due|deadline|by )\b/i.test(blob)) {
      items.push({
        id: `todo-due-${todo.id}`,
        kind: "action",
        op: "change_due",
        content: todo.title,
        projectId: todo.projectId,
        date: todo.dueAt?.slice(0, 10),
        destination: "To Do",
        targetTodoId: todo.id,
      });
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
};

export const CAPTURE_SESSION_KEY = "lume-capture-session-v1";
