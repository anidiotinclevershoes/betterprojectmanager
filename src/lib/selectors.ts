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

export function projectTodos(
  state: MissionState,
  projectId: string,
): TodoItem[] {
  return (state.todos ?? [])
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt));
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

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
