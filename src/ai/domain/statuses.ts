/** Map legacy / UI statuses into canonical AI statuses. */

import { CONFIDENCE_BANDS } from "./types";

export { CONFIDENCE_BANDS };

export const AI_RECORD_STATUSES = {
  todo: ["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED", "ARCHIVED"] as const,
  project: ["HEALTHY", "WATCH", "AT_RISK"] as const,
  meeting: ["UPCOMING", "IN_PROGRESS", "COMPLETED"] as const,
  recommendation: ["ACTIVE", "DONE", "DISMISSED"] as const,
  releaseStage: ["UPCOMING", "CURRENT", "COMPLETE", "BLOCKED", "AT_RISK"] as const,
};

/** Legacy todo UI status → canonical AI status. */
export const TODO_STATUS_TO_AI: Record<string, string> = {
  todo: "OPEN",
  open: "OPEN",
  doing: "IN_PROGRESS",
  in_progress: "IN_PROGRESS",
  blocked: "BLOCKED",
  done: "COMPLETED",
  completed: "COMPLETED",
  archived: "ARCHIVED",
};

export function mapTodoStatus(done: boolean, hint?: string): string {
  if (done) return "COMPLETED";
  const h = (hint ?? "").toLowerCase();
  if (h.includes("block")) return "BLOCKED";
  if (h.includes("progress") || h.includes("doing")) return "IN_PROGRESS";
  if (h.includes("archive")) return "ARCHIVED";
  return "OPEN";
}

export function mapProjectStatus(
  status: "healthy" | "watch" | "at_risk" | string,
): string {
  switch (status) {
    case "healthy":
      return "HEALTHY";
    case "watch":
      return "WATCH";
    case "at_risk":
      return "AT_RISK";
    default:
      return status.toUpperCase();
  }
}

export function mapMeetingStatus(
  phase: "upcoming" | "in_progress" | "completed" | string,
): string {
  switch (phase) {
    case "upcoming":
      return "UPCOMING";
    case "in_progress":
      return "IN_PROGRESS";
    case "completed":
      return "COMPLETED";
    default:
      return phase.toUpperCase();
  }
}

export function formatStatusesForPrompt(): string {
  return [
    "Canonical statuses (prefer these; do not invent synonyms):",
    `- To Do: ${AI_RECORD_STATUSES.todo.join(", ")}`,
    `- Project: ${AI_RECORD_STATUSES.project.join(", ")}`,
    `- Meeting: ${AI_RECORD_STATUSES.meeting.join(", ")}`,
  ].join("\n");
}

export function formatConfidenceGuidanceForPrompt(): string {
  return CONFIDENCE_BANDS.map((b) =>
    b.min === 0
      ? `- Below ${b.max + 1}: ${b.label}`
      : `- ${b.min}–${b.max}: ${b.label}`,
  ).join("\n");
}
