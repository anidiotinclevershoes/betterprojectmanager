import type { MissionState } from "@/lib/types";

export const ACCOUNT_EXPORT_FORMAT = "lume-account-export-v1";

/** User-facing export. Product truth only — no tokens or service metadata. */
export function buildAccountExport(input: {
  exportedAt?: string;
  userId: string;
  email?: string | null;
  workspaceId: string;
  state: MissionState;
}) {
  const state = input.state;
  return {
    format: ACCOUNT_EXPORT_FORMAT,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    account: {
      userId: input.userId,
      email: input.email ?? null,
    },
    workspaceId: input.workspaceId,
    projects: state.projects,
    todos: state.todos,
    knowledge: state.knowledge,
    risks: state.risks,
    timeline: state.timeline,
    people: state.projects.flatMap((p) => p.stakeholders ?? []),
    memories: state.memories,
    meetings: state.meetings,
    recommendations: state.recommendations,
    history: state.history,
    projectTags: state.projectTags,
    itemTags: state.itemTags,
  };
}
