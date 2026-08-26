/**
 * Authenticated workspace load + project isolation.
 * Shared by Tell Me (Slice 1B) and Capture V2 (Slice 1C).
 * Not a generic AI context framework — load, verify, filter only.
 */
import { loadMissionStateFromSupabase } from "@/lib/data/supabase/load-mission-state";
import type { LoadedWorkspace } from "@/lib/data/supabase/load-mission-state";
import { getPersistenceMode } from "@/lib/persistence-mode";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MissionState } from "@/lib/types";

export class DurableWorkspaceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "DurableWorkspaceError";
    this.status = status;
    this.code = code;
  }
}

function matchesProject(
  rowProjectId: string | null | undefined,
  projectId: string,
): boolean {
  return rowProjectId === projectId;
}

export function filterMissionStateToProject(
  state: MissionState,
  projectId: string,
): MissionState {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) {
    throw new DurableWorkspaceError(
      "Project not found or you do not have access to it.",
      404,
      "project_not_found",
    );
  }

  return {
    ...state,
    projects: [project],
    todos: state.todos.filter((t) => matchesProject(t.projectId, projectId)),
    knowledge: state.knowledge.filter((k) =>
      matchesProject(k.projectId, projectId),
    ),
    risks: (state.risks ?? []).filter((r) =>
      matchesProject(r.projectId, projectId),
    ),
    timeline: state.timeline.filter((t) =>
      matchesProject(t.projectId, projectId),
    ),
    history: (state.history ?? []).filter((h) =>
      matchesProject(h.projectId, projectId),
    ),
    recommendations: state.recommendations.filter((r) =>
      matchesProject(r.projectId, projectId),
    ),
    meetings: state.meetings.filter((m) =>
      matchesProject(m.projectId, projectId),
    ),
    releases: state.releases.filter((r) =>
      matchesProject(r.projectId, projectId),
    ),
    memories: state.memories.filter((m) =>
      matchesProject(m.projectId, projectId),
    ),
  };
}

export async function loadAuthenticatedWorkspace(): Promise<LoadedWorkspace> {
  if (getPersistenceMode() !== "supabase" || !isSupabaseConfigured()) {
    throw new DurableWorkspaceError(
      "Durable project truth could not be loaded. Server persistence is not available.",
      503,
      "persistence_unavailable",
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    return await loadMissionStateFromSupabase(supabase);
  } catch (err) {
    if (err instanceof DurableWorkspaceError) throw err;
    const message = err instanceof Error ? err.message : "";
    if (/not authenticated/i.test(message)) {
      throw new DurableWorkspaceError("Sign in required.", 401, "unauthenticated");
    }
    throw new DurableWorkspaceError(
      "Durable project truth could not be loaded.",
      500,
      "load_failed",
    );
  }
}

export async function loadProjectScopedWorkspace(args: {
  projectId: string;
  loadWorkspace?: () => Promise<LoadedWorkspace>;
  failureNoun?: string;
}): Promise<{
  workspaceId: string;
  userId: string;
  projectId: string;
  /** Isolated to the requested project — model / planner input. */
  state: MissionState;
  /** Full authenticated workspace — Apply execute + client hydrate. */
  workspaceState: MissionState;
}> {
  const projectId = args.projectId.trim();
  const noun = args.failureNoun ?? "the request";
  if (!projectId) {
    throw new DurableWorkspaceError(
      "Select a project first.",
      400,
      "project_required",
    );
  }

  const loader = args.loadWorkspace ?? loadAuthenticatedWorkspace;
  let loaded: LoadedWorkspace;
  try {
    loaded = await loader();
  } catch (err) {
    if (err instanceof DurableWorkspaceError) throw err;
    throw new DurableWorkspaceError(
      `Could not load durable project truth for ${noun}.`,
      500,
      "load_failed",
    );
  }

  if (!loaded.state.projects.some((p) => p.id === projectId)) {
    throw new DurableWorkspaceError(
      "Project not found or you do not have access to it.",
      404,
      "project_not_found",
    );
  }

  return {
    workspaceId: loaded.workspaceId,
    userId: loaded.userId,
    projectId,
    state: filterMissionStateToProject(loaded.state, projectId),
    workspaceState: loaded.state,
  };
}

export function clientPostedTruthFields(body: {
  state?: unknown;
  snapshot?: unknown;
}): boolean {
  return body.state != null || body.snapshot != null;
}
