/**
 * Presentation-only labels for genuine Issue detail.
 * Does not mutate Risk truth or infer missing dates, evidence, or owners.
 */
import type { HistoryEvent } from "@/lib/types";
import type { RiskStatus } from "@/types/database";
import { formatShortDayMonth } from "@/lib/knowledge-centre/format-date-label";

export function issueStatusLabel(status: RiskStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "watch":
      return "Watch";
    case "resolved":
      return "Resolved";
    case "accepted":
      return "Accepted";
  }
}

/** Resolve for current Issues. Reopen only for resolved. Accepted has no action here. */
export function issueLifecycleAction(
  status: RiskStatus,
): "resolve" | "reopen" | null {
  if (status === "open" || status === "watch") return "resolve";
  if (status === "resolved") return "reopen";
  return null;
}

export function formatIssueStamp(
  iso: string | null | undefined,
  withTime: boolean,
): string | null {
  if (!iso) return null;
  const day = formatShortDayMonth(iso);
  if (!day) return null;
  if (!withTime) return day;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return day;
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} · ${hh}:${mm}`;
}

export function issueHistoryLine(event: HistoryEvent): {
  when: string | null;
  title: string;
  detail: string | null;
} {
  return {
    when: formatIssueStamp(event.createdAt, true),
    title: event.title,
    detail: event.detail?.trim() ? event.detail : null,
  };
}
