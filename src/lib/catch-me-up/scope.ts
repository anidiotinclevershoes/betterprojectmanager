/**
 * Project isolation for Catch Me Up.
 * Defence in depth: even though serializeCanonicalTruth filters by projectId,
 * the briefing prompt must never receive another project's records.
 */
import type { MissionState } from "@/lib/types";

export function scopeMissionStateToProject(
  state: MissionState,
  projectId: string,
): MissionState {
  const project = state.projects.find((p) => p.id === projectId);
  return {
    ...state,
    projects: project ? [{ ...project }] : [],
    todos: (state.todos ?? []).filter((t) => t.projectId === projectId),
    knowledge: (state.knowledge ?? []).filter((k) => k.projectId === projectId),
    risks: (state.risks ?? []).filter((r) => r.projectId === projectId),
    timeline: (state.timeline ?? []).filter((t) => t.projectId === projectId),
    memories: (state.memories ?? []).filter((m) => m.projectId === projectId),
    recommendations: (state.recommendations ?? []).filter(
      (r) => r.projectId === projectId,
    ),
    meetings: (state.meetings ?? []).filter((m) => m.projectId === projectId),
    releases: (state.releases ?? []).filter((r) => r.projectId === projectId),
    history: (state.history ?? []).filter(
      (h) => !h.projectId || h.projectId === projectId,
    ),
  };
}

export function projectExistsInWorkspace(
  state: MissionState,
  projectId: string,
): boolean {
  return state.projects.some((p) => p.id === projectId);
}
