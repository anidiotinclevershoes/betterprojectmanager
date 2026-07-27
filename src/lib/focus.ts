import {
  activeRecommendations,
  daysUntil,
  silentStakeholders,
  upcomingMeetings,
} from "./selectors";
import type { MissionState, Recommendation, TodoItem, Meeting } from "./types";

export type FocusLens =
  | "everything"
  | "today"
  | "meetings"
  | "todo"
  | "stakeholders"
  | "risks"
  | "release";

export const FOCUS_LENSES: Array<{ id: FocusLens; label: string }> = [
  { id: "everything", label: "Everything" },
  { id: "today", label: "Today's work" },
  { id: "meetings", label: "Meetings" },
  { id: "todo", label: "To do" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "risks", label: "Risks" },
  { id: "release", label: "Release" },
];

export type NudgeAccent = "critical" | "warning" | "teal" | "muted";

export type AttentionNudge = {
  id: string;
  text: string;
  accent: NudgeAccent;
  lens: FocusLens;
  href?: string;
  projectCode?: string;
};

export type TodayStrip = {
  greeting: string;
  attentionCount: number;
  meetingCount: number;
  riskCount: number;
  summaryLine: string;
  nudges: AttentionNudge[];
};

function hourGreeting(name = "Tom") {
  // Deterministic enough for UI; slight SSR skew is fine for greeting
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part} ${name}`;
}

/** Build the loudest attention items across the portfolio. */
export function buildAttentionNudges(state: MissionState): AttentionNudge[] {
  const nudges: AttentionNudge[] = [];
  const projectById = new Map(state.projects.map((p) => [p.id, p]));

  for (const project of state.projects) {
    for (const person of silentStakeholders(project, 10).slice(0, 1)) {
      const days = person.lastContactAt
        ? Math.floor(
            (Date.now() - new Date(person.lastContactAt).getTime()) / 86400000,
          )
        : 14;
      nudges.push({
        id: `silent-${person.id}`,
        text: `${person.name} hasn't been contacted (${days}d)`,
        accent: days >= 14 ? "critical" : "warning",
        lens: "stakeholders",
        href: `/projects/${project.id}`,
        projectCode: project.code,
      });
    }
  }

  for (const meeting of upcomingMeetings(state).slice(0, 4)) {
    const d = daysUntil(meeting.startsAt);
    if (d === null || d > 2) continue;
    const project = projectById.get(meeting.projectId);
    nudges.push({
      id: `mtg-${meeting.id}`,
      text:
        d <= 0
          ? `${meeting.title} is today`
          : d === 1
            ? `${meeting.title} tomorrow`
            : `${meeting.title} in ${d}d`,
      accent: d <= 1 ? "critical" : "warning",
      lens: "meetings",
      href: `/meetings/${meeting.id}`,
      projectCode: project?.code,
    });
  }

  for (const rec of activeRecommendations(state)
    .filter((r) => r.urgency === "now" || r.kind === "risk")
    .slice(0, 5)) {
    const project = rec.projectId ? projectById.get(rec.projectId) : undefined;
    nudges.push({
      id: `rec-${rec.id}`,
      text: rec.title,
      accent:
        rec.urgency === "now"
          ? "critical"
          : rec.kind === "risk"
            ? "warning"
            : "teal",
      lens: rec.kind === "risk" ? "risks" : "today",
      href: project ? `/projects/${project.id}` : undefined,
      projectCode: project?.code,
    });
  }

  for (const todo of (state.todos ?? []).filter((t) => !t.done && t.dueAt)) {
    const d = daysUntil(todo.dueAt);
    if (d === null || d > 1) continue;
    const project = todo.projectId ? projectById.get(todo.projectId) : undefined;
    nudges.push({
      id: `todo-${todo.id}`,
      text:
        d < 0
          ? `${todo.title} (${Math.abs(d)}d overdue)`
          : `${todo.title} due ${d === 0 ? "today" : "tomorrow"}`,
      accent: d < 0 ? "critical" : "warning",
      lens: "todo",
      href: project ? `/projects/${project.id}` : "/",
      projectCode: project?.code ?? "Personal",
    });
  }

  // Deduplicate by text, keep first (loudest order roughly)
  const seen = new Set<string>();
  const unique: AttentionNudge[] = [];
  for (const n of nudges) {
    const key = n.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(n);
    if (unique.length >= 6) break;
  }
  return unique;
}

export function buildTodayStrip(
  state: MissionState,
  displayName = "Tom",
): TodayStrip {
  const nudges = buildAttentionNudges(state);
  const meetingsToday = upcomingMeetings(state).filter((m) => {
    const d = daysUntil(m.startsAt);
    return d !== null && d <= 1;
  });
  const risks = activeRecommendations(state).filter(
    (r) => r.kind === "risk" && (r.urgency === "now" || r.urgency === "today"),
  );

  const parts: string[] = [];
  if (nudges.length) parts.push(`${nudges.length} nudge${nudges.length === 1 ? "" : "s"}`);
  if (meetingsToday.length)
    parts.push(
      `${meetingsToday.length} meeting${meetingsToday.length === 1 ? "" : "s"}`,
    );
  if (risks.length)
    parts.push(`${risks.length} risk${risks.length === 1 ? "" : "s"} live`);

  return {
    greeting: hourGreeting(displayName),
    attentionCount: nudges.length,
    meetingCount: meetingsToday.length,
    riskCount: risks.length,
    summaryLine: parts.length
      ? parts.join(" · ")
      : "Nothing loud right now — stay ahead.",
    nudges,
  };
}

export function sectionMatchesLens(
  section: FocusLens | "memory" | "timeline" | "suggestions" | "personal",
  lens: FocusLens,
): boolean {
  if (lens === "everything") return true;
  if (lens === "today") {
    return (
      section === "today" ||
      section === "todo" ||
      section === "meetings" ||
      section === "risks"
    );
  }
  return section === lens;
}

export type ProjectTodayBrief = {
  nudges: AttentionNudge[];
  openTodos: TodoItem[];
  meetings: Meeting[];
  risks: Recommendation[];
};
