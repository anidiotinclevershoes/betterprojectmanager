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
};

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
