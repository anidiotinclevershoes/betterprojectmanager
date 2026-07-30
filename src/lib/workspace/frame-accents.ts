/**
 * Semantic frame / source accents — mapped to CSS custom properties.
 * Status colours (success/warning/danger) stay separate.
 */
export type FrameAccentKey =
  | "todo"
  | "meeting"
  | "nudge"
  | "knowledge"
  | "history"
  | "timeline"
  | "capture"
  | "coach"
  | "release";

export const FRAME_ACCENT_VAR: Record<FrameAccentKey, string> = {
  todo: "--accent-todo",
  meeting: "--accent-meeting",
  nudge: "--accent-nudge",
  knowledge: "--accent-knowledge",
  history: "--accent-history",
  timeline: "--accent-timeline",
  capture: "--accent-capture",
  coach: "--accent-coach",
  release: "--accent-release",
};

export function historyAccentForType(type: string): FrameAccentKey {
  switch (type) {
    case "task_added":
    case "task_completed":
    case "task_updated":
      return "todo";
    case "meeting_created":
      return "meeting";
    case "nudge_resolved":
    case "nudge_chased":
      return "nudge";
    case "knowledge_updated":
    case "risk_added":
      return "knowledge";
    case "capture_analysed":
      return "capture";
    case "coach_accepted":
      return "coach";
    case "milestone_changed":
      return "timeline";
    case "suggestion_accepted":
    case "suggestion_dismissed":
      return "todo";
    default:
      return "history";
  }
}
