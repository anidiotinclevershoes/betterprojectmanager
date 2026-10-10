/**
 * Home is a projection over existing selectors.
 * Does not persist, reshape, or coerce Issues into To Dos.
 */
import { composeKnowledgeCentreItems, type KcComposedItem } from "@/lib/knowledge-centre/four-bucket";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import type { MissionState, Recommendation } from "@/lib/types";

const DATE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type HomeQueueKind = "todo" | "issue" | "date" | "suggestion";

export type HomeQueueItem = {
  id: string;
  kind: HomeQueueKind;
  title: string;
  supporting?: string | null;
  needsYou?: string | null;
  /** Present for canonical / date items. Suggestions have no item ref. */
  ref: KnowledgeItemRef | null;
  recommendationId?: string;
  /** Issues that land in the queue stay Issues — never Close as a To Do. */
  staysIssue: boolean;
  /**
   * Structured instant already stored on the To Do, timeline row, or date item.
   * Null when that record has no instant. Never parsed from title or supporting text.
   */
  occursAt?: string | null;
  /** Canonical To Do id when this row is a To Do. Close reuses toggleTodo. */
  todoId?: string;
};

export type HomeQueueBand = "today" | "next" | "ungrouped";

export type HomeProjection = {
  queue: HomeQueueItem[];
  people: KcComposedItem[];
  issues: KcComposedItem[];
  knowledge: KcComposedItem[];
  suggestions: Recommendation[];
};

function isDateRelevant(iso: string | undefined, now: number): boolean {
  if (!iso) return false;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return false;
  return then <= now + DATE_WINDOW_MS;
}

function structuredInstant(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

/** UTC calendar day, matching the existing due-label formatter. */
function utcDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Today = on or before the end of the UTC day of `now` (includes overdue).
 * Next = a structured instant after that day.
 * Anything else stays ungrouped — including suggestions and prose that only looks dated.
 */
export function homeQueueBand(
  occursAt: string | null | undefined,
  now: number,
): HomeQueueBand {
  const iso = structuredInstant(occursAt);
  if (!iso) return "ungrouped";
  const then = Date.parse(iso);
  const nextDay = utcDayStart(now) + 24 * 60 * 60 * 1000;
  return then < nextDay ? "today" : "next";
}

/**
 * Classified rows keep their existing relative order inside Today and Next.
 * Rows with no structured instant stay in their existing relative order and are
 * not forced into a Page 09 group.
 */
export function partitionHomeQueue(
  queue: HomeQueueItem[],
  now = Date.now(),
): { today: HomeQueueItem[]; next: HomeQueueItem[]; ungrouped: HomeQueueItem[] } {
  const today: HomeQueueItem[] = [];
  const next: HomeQueueItem[] = [];
  const ungrouped: HomeQueueItem[] = [];
  for (const item of queue) {
    const band = homeQueueBand(item.occursAt, now);
    if (band === "today") today.push(item);
    else if (band === "next") next.push(item);
    else ungrouped.push(item);
  }
  return { today, next, ungrouped };
}

function occursAtForComposed(
  state: MissionState,
  projectId: string,
  item: KcComposedItem,
  kind: "todo" | "issue" | "date",
): string | null {
  if (kind === "todo") {
    const todo = (state.todos ?? []).find(
      (row) => row.projectId === projectId && row.id === item.tagTargetId,
    );
    return structuredInstant(todo?.dueAt);
  }
  const timeline = (state.timeline ?? []).find(
    (row) => row.projectId === projectId && row.id === item.tagTargetId,
  );
  const startAt = structuredInstant(timeline?.startAt);
  if (startAt) return startAt;
  if (kind !== "date") return null;
  const knowledge = state.knowledge.find((row) => row.projectId === projectId);
  const structured = (knowledge?.structured ?? []).find(
    (row) => row.id === item.tagTargetId && row.kind === "date",
  );
  return structuredInstant(structured?.meta?.date?.dateIso);
}

export function composeHomeProjection(
  state: MissionState,
  projectId: string,
  now = Date.now(),
): HomeProjection {
  const composed = composeKnowledgeCentreItems(state, projectId);
  const people = composed.filter((item) => item.bucket === "people");
  const issues = composed.filter((item) => item.bucket === "issues");
  const knowledge = composed.filter((item) => item.bucket === "knowledge");
  const todos = composed.filter((item) => item.bucket === "todo");

  const suggestions = (state.recommendations ?? []).filter(
    (rec) => rec.projectId === projectId && rec.status === "active",
  );

  const queue: HomeQueueItem[] = [];
  const seen = new Set<string>();

  for (const item of todos) {
    seen.add(item.id);
    queue.push({
      id: item.id,
      kind: "todo",
      title: item.title,
      supporting: item.supporting,
      needsYou: item.needsYou,
      ref: item.ref,
      staysIssue: false,
      occursAt: occursAtForComposed(state, projectId, item, "todo"),
      todoId: item.tagTargetId,
    });
  }

  // Date-relevant timeline / date knowledge stays its own kind — not a To Do.
  for (const item of knowledge) {
    if (item.knowledgeSubtype !== "dates") continue;
    const timeline = (state.timeline ?? []).find(
      (row) => row.projectId === projectId && row.id === item.tagTargetId,
    );
    if (!isDateRelevant(timeline?.startAt, now)) continue;
    seen.add(item.id);
    queue.push({
      id: item.id,
      kind: "date",
      title: item.title,
      supporting: item.supporting ?? "Date-relevant",
      ref: item.ref,
      staysIssue: false,
      occursAt: occursAtForComposed(state, projectId, item, "date"),
    });
  }

  // Guard: if an Issue is ever date-relevant via a deterministic id link, keep it an Issue.
  for (const item of issues) {
    const linked = (state.timeline ?? []).some(
      (row) => row.projectId === projectId && row.id === item.tagTargetId,
    );
    if (!linked) continue;
    const timeline = (state.timeline ?? []).find((row) => row.id === item.tagTargetId);
    if (!isDateRelevant(timeline?.startAt, now)) continue;
    seen.add(item.id);
    queue.push({
      id: item.id,
      kind: "issue",
      title: item.title,
      supporting: item.supporting,
      needsYou: item.needsYou,
      ref: item.ref,
      staysIssue: true,
      occursAt: occursAtForComposed(state, projectId, item, "issue"),
    });
  }

  for (const rec of suggestions) {
    queue.push({
      id: `suggestion:${rec.id}`,
      kind: "suggestion",
      title: rec.title,
      supporting: rec.action || "Suggested — not a To Do yet",
      ref: null,
      recommendationId: rec.id,
      staysIssue: false,
      occursAt: null,
    });
  }

  return {
    queue,
    people,
    issues: issues.filter((item) => !seen.has(item.id)),
    knowledge: knowledge.filter(
      (item) => item.knowledgeSubtype !== "dates" || !seen.has(item.id),
    ),
    suggestions,
  };
}
