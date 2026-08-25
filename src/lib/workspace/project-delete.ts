import type { MissionState } from "@/lib/types";

/**
 * Local/dev MissionState filter after a confirmed project delete.
 * Production supabase path never uses this — it applies the server hydrate.
 */
export function removeProjectFromMissionState(
  state: MissionState,
  projectId: string,
): MissionState {
  const scoped = (item: { projectId?: string | null }) =>
    item.projectId !== projectId;

  return {
    ...state,
    projects: state.projects.filter((project) => project.id !== projectId),
    knowledge: (state.knowledge ?? []).filter((row) => row.projectId !== projectId),
    todos: (state.todos ?? []).filter(scoped),
    risks: (state.risks ?? []).filter((row) => row.projectId !== projectId),
    timeline: (state.timeline ?? []).filter((row) => row.projectId !== projectId),
    memories: (state.memories ?? []).filter(scoped),
    recommendations: (state.recommendations ?? []).filter(scoped),
    meetings: (state.meetings ?? []).filter((row) => row.projectId !== projectId),
    releases: (state.releases ?? []).filter((row) => row.projectId !== projectId),
    history: (state.history ?? []).filter(scoped),
  };
}

/**
 * After deleting the currently selected project, reuse Home's rule:
 * open the first remaining project, or New Project onboarding at `/`.
 * Do not invent a portfolio Overview.
 */
export function nextHrefAfterProjectDelete(remainingProjectIds: string[]): string {
  const nextId = remainingProjectIds[0];
  return nextId ? `/projects/${nextId}` : "/";
}

export type ProjectDeleteResult = {
  deletedProjectId: string;
  remainingProjectIds: string[];
  nextHref: string;
};

export function projectDeleteResult(
  deletedProjectId: string,
  remainingProjectIds: string[],
): ProjectDeleteResult {
  return {
    deletedProjectId,
    remainingProjectIds,
    nextHref: nextHrefAfterProjectDelete(remainingProjectIds),
  };
}
