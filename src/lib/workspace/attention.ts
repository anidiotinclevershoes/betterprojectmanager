import { buildMeetingPrepItems, buildNudgeItems } from "@/lib/workspace/frames-data";
import { daysUntil } from "@/lib/selectors";
import type { MissionState } from "@/lib/types";

/** Outstanding operational items that deserve attention for a project. */
export function projectAttentionCount(
  state: MissionState,
  projectId: string,
): number {
  let count = 0;

  for (const todo of state.todos ?? []) {
    if (todo.done || todo.projectId !== projectId) continue;
    const due = daysUntil(todo.dueAt);
    if (due !== null && due <= 1) count += 1;
  }

  for (const rec of state.recommendations) {
    if (rec.status !== "active" || rec.projectId !== projectId) continue;
    if (rec.urgency === "now" || rec.urgency === "today") count += 1;
    if (rec.kind === "risk" || rec.kind === "decision") count += 1;
  }

  for (const item of buildMeetingPrepItems(state, projectId)) {
    if (item.confidence !== "ready") count += 1;
  }

  for (const nudge of buildNudgeItems(state, projectId)) {
    if (nudge.urgency === "now" || nudge.daysWaiting >= 7) count += 1;
  }

  const knowledge = (state.knowledge ?? []).find((k) => k.projectId === projectId);
  count += knowledge?.sections.risks?.length ? 0 : 0;
  // Count open knowledge risks as soft attention if many
  if ((knowledge?.sections.risks?.length ?? 0) >= 3) count += 1;

  return count;
}

export function attentionLabel(count: number): string {
  if (count <= 0) return "Clear";
  if (count === 1) return "1 requiring attention";
  return `${count} requiring attention`;
}
