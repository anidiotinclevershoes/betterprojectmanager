import type {
  Meeting,
  MemoryEntry,
  MissionState,
  Project,
  Recommendation,
  Release,
  SuggestedMeeting,
  TodoItem,
} from "./types";

const URGENCY_ORDER = { now: 0, today: 1, this_week: 2, watch: 3 } as const;

export function activeRecommendations(
  state: MissionState,
  projectId?: string,
): Recommendation[] {
  return state.recommendations
    .filter((r) => r.status === "active")
    .filter((r) => (projectId ? r.projectId === projectId : true))
    .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
}

/** Suggestions that are not meeting proposals — for the Suggested to-do widget. */
export function suggestedTodos(
  state: MissionState,
  projectId: string,
): Recommendation[] {
  return activeRecommendations(state, projectId).filter(
    (r) => r.kind !== "meeting" && r.kind !== "meeting_prep",
  );
}

/** Unified Suggestions list: action + meeting proposals for a project. */
export function projectSuggestions(
  state: MissionState,
  projectId: string,
): Recommendation[] {
  return activeRecommendations(state, projectId);
}

export function projectTodos(
  state: MissionState,
  projectId: string,
): TodoItem[] {
  return (state.todos ?? [])
    .filter((t) => t.projectId === projectId)
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        compareDue(a.dueAt, b.dueAt) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

/** Personal / generic todos not tied to a project. */
export function genericTodos(state: MissionState): TodoItem[] {
  return (state.todos ?? [])
    .filter((t) => !t.projectId)
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        compareDue(a.dueAt, b.dueAt) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

function compareDue(a?: string, b?: string) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

/**
 * Suggested meetings from AI recommendations + project knowledge signals.
 */
export function suggestedMeetings(
  state: MissionState,
  projectId: string,
): SuggestedMeeting[] {
  const fromRecs = activeRecommendations(state, projectId)
    .filter((r) => r.kind === "meeting" || r.kind === "meeting_prep")
    .map((r) => ({
      id: `sugmeet-${r.id}`,
      projectId,
      title: r.title,
      why: r.why,
      withWhom: extractPeople(r),
      urgency: r.urgency,
      recommendationId: r.id,
    }));

  const project = state.projects.find((p) => p.id === projectId);
  const extras: SuggestedMeeting[] = [];

  if (project) {
    const silent = project.stakeholders.filter((s) => {
      if (!s.lastContactAt) return true;
      return (Date.now() - new Date(s.lastContactAt).getTime()) / 86400000 >= 14;
    });
    for (const person of silent.slice(0, 1)) {
      const already = fromRecs.some((m) =>
        m.withWhom.some((n) => n.includes(person.name.split(" ")[0] ?? "")),
      );
      if (!already) {
        extras.push({
          id: `sugmeet-silent-${person.id}`,
          projectId,
          title: `Stakeholder sync with ${person.name}`,
          why: `No contact in 14+ days while ${project.currentFocus.toLowerCase()}. A short sync keeps you ahead of surprise concerns.`,
          withWhom: [person.name],
          urgency: "this_week",
        });
      }
    }
  }

  return [...fromRecs, ...extras].sort(
    (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency],
  );
}

export function meetingOpeningScripts(
  state: MissionState,
  projectId: string,
): Array<{ meeting: Meeting; openingScript: string }> {
  return upcomingMeetings(state, projectId).map((meeting) => ({
    meeting,
    openingScript: meeting.prep.openingScript,
  }));
}

export function upcomingMeetings(
  state: MissionState,
  projectId?: string,
): Meeting[] {
  return [...state.meetings]
    .filter((m) => m.phase === "upcoming")
    .filter((m) => (projectId ? m.projectId === projectId : true))
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
}

export function projectReleases(
  state: MissionState,
  projectId?: string,
): Release[] {
  return state.releases.filter((r) =>
    projectId ? r.projectId === projectId : true,
  );
}

export function projectMemories(
  state: MissionState,
  projectId?: string,
): MemoryEntry[] {
  return [...state.memories]
    .filter((m) => (projectId ? m.projectId === projectId : true))
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
}

export function silentStakeholders(project: Project, days = 14) {
  const now = Date.now();
  return project.stakeholders.filter((s) => {
    if (!s.lastContactAt) return true;
    return (now - new Date(s.lastContactAt).getTime()) / 86400000 >= days;
  });
}

export function releaseRiskCount(release: Release) {
  return (
    release.risks.length +
    release.stages.filter(
      (s) => s.status === "at_risk" || s.status === "blocked",
    ).length
  );
}

export function daysUntil(iso?: string) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Deterministic datetime label (no locale APIs).
 * Avoids SSR/client hydration mismatches from toLocaleString().
 */
export function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Deterministic date-only label for timeline / memory rows. */
export function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short day+month label, e.g. "27 Jul". */
export function formatDayMonth(isoOrMs: string | number) {
  const d = new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return String(isoOrMs);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDue(iso?: string) {
  if (!iso) return null;
  const d = daysUntil(iso);
  if (d === null) return null;
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  return `due in ${d}d`;
}

export function toDateInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Portfolio overview: nearest-deadline / highest-urgency items only. */
export function portfolioPertinent(state: MissionState) {
  const projectById = new Map(state.projects.map((p) => [p.id, p]));

  const dueSoon = (state.todos ?? [])
    .filter((t) => !t.done && t.dueAt)
    .filter((t) => {
      const d = daysUntil(t.dueAt);
      return d !== null && d <= 7;
    })
    .sort((a, b) => compareDue(a.dueAt, b.dueAt))
    .slice(0, 10)
    .map((todo) => ({
      todo,
      project: todo.projectId ? projectById.get(todo.projectId) : undefined,
    }));

  const urgentSuggestions = activeRecommendations(state)
    .filter((r) => r.urgency === "now" || r.urgency === "today")
    .slice(0, 8);

  const meetingsSoon = upcomingMeetings(state)
    .filter((m) => {
      const d = daysUntil(m.startsAt);
      return d !== null && d <= 5;
    })
    .slice(0, 6);

  const milestones = state.projects
    .filter((p) => p.nextMilestoneAt)
    .map((p) => ({
      project: p,
      days: daysUntil(p.nextMilestoneAt),
      label: p.nextMilestone ?? "Next milestone",
    }))
    .filter((m) => m.days !== null && m.days! <= 10)
    .sort((a, b) => (a.days ?? 99) - (b.days ?? 99))
    .slice(0, 6);

  return { dueSoon, urgentSuggestions, meetingsSoon, milestones };
}

function extractPeople(rec: Recommendation): string[] {
  const fromAction = (rec.action.match(
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g,
  ) ?? []) as string[];
  const known = ["Priya Shah", "Marcus Webb", "Elena Rostova", "Jordan Lee"];
  const hits = known.filter(
    (name) =>
      rec.title.includes(name.split(" ")[0]!) ||
      rec.action.includes(name) ||
      rec.why.includes(name),
  );
  return hits.length ? hits : fromAction.slice(0, 2);
}
