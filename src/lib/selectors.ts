import type {
  Meeting,
  MemoryEntry,
  MissionState,
  Project,
  Recommendation,
  Release,
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
