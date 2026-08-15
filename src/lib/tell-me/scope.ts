/**
 * Resolve Tell Me question scope: selected project vs explicit other vs cross-project.
 */
import { detectMentionedProjects } from "@/lib/capture/projectResolve";
import type { MissionState } from "@/lib/types";
import type { TellMeScopeMode } from "@/lib/tell-me/types";

const CROSS_PROJECT_RE =
  /\b(across (my |all )?projects|which (of my )?projects|all projects|every project|portfolio)\b/i;

export function resolveTellMeScope(args: {
  question: string;
  selectedProjectId?: string | null;
  state: MissionState;
}): {
  mode: TellMeScopeMode;
  projectId: string | null;
  projectIdsForDeepContext: string[];
  projectCode: string | null;
  projectName: string | null;
} {
  const mentioned = detectMentionedProjects(
    args.question,
    args.state.projects,
  );
  const selected = args.selectedProjectId
    ? args.state.projects.find((p) => p.id === args.selectedProjectId)
    : null;

  if (CROSS_PROJECT_RE.test(args.question) || (!selected && mentioned.length === 0)) {
    if (CROSS_PROJECT_RE.test(args.question) || !args.selectedProjectId) {
      return {
        mode: "cross_project",
        projectId: null,
        projectIdsForDeepContext: args.state.projects.map((p) => p.id).slice(0, 8),
        projectCode: null,
        projectName: null,
      };
    }
  }

  if (mentioned.length) {
    const primary = mentioned[0]!;
    const project = args.state.projects.find((p) => p.id === primary.id);
    const isOther =
      args.selectedProjectId && primary.id !== args.selectedProjectId;
    return {
      mode: isOther ? "explicit_project" : "project",
      projectId: primary.id,
      projectIdsForDeepContext: mentioned.map((m) => m.id),
      projectCode: project?.code ?? null,
      projectName: project?.name ?? null,
    };
  }

  if (selected) {
    return {
      mode: "project",
      projectId: selected.id,
      projectIdsForDeepContext: [selected.id],
      projectCode: selected.code,
      projectName: selected.name,
    };
  }

  return {
    mode: "cross_project",
    projectId: null,
    projectIdsForDeepContext: args.state.projects.map((p) => p.id).slice(0, 8),
    projectCode: null,
    projectName: null,
  };
}

export function questionLooksAdvisory(question: string): boolean {
  return /\b(what should i do|how should i|advise|recommend|coach me|next step)\b/i.test(
    question,
  );
}
