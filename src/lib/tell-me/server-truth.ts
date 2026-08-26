/**
 * Tell Me Slice 1B — load durable project truth on the server.
 *
 * Narrow helper, not a generic AI context framework:
 * authenticate (caller) → load workspace via existing RLS client →
 * verify the requested project → filter to that project →
 * serializeCanonicalTruth.
 *
 * Client MissionState is never an input to this path.
 */
import { loadMissionStateFromSupabase } from "@/lib/data/supabase/load-mission-state";
import type { LoadedWorkspace } from "@/lib/data/supabase/load-mission-state";
import { getPersistenceMode } from "@/lib/persistence-mode";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { serializeCanonicalTruth } from "@/lib/canonical-truth/serialize";
import type { CanonicalTruthBundle } from "@/lib/canonical-truth/types";
import type { MissionState } from "@/lib/types";

export class TellMeServerTruthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "TellMeServerTruthError";
    this.status = status;
    this.code = code;
  }
}

export type ServerCurrentTruth = {
  workspaceId: string;
  userId: string;
  projectId: string;
  /** Project-scoped MissionState shape built from durable rows (cache shape, not client authority). */
  state: MissionState;
  canonical: CanonicalTruthBundle;
};

function matchesProject(
  rowProjectId: string | null | undefined,
  projectId: string,
): boolean {
  return rowProjectId === projectId;
}

/**
 * Belt-and-suspenders isolation: drop every other project's durable rows
 * before canonical assembly. serializeCanonicalTruth already filters by
 * projectId; this makes cross-project leakage impossible even if a caller
 * later forgets that filter.
 */
export function filterMissionStateToProject(
  state: MissionState,
  projectId: string,
): MissionState {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) {
    throw new TellMeServerTruthError(
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

export async function loadAuthenticatedWorkspaceForTellMe(): Promise<LoadedWorkspace> {
  if (getPersistenceMode() !== "supabase" || !isSupabaseConfigured()) {
    throw new TellMeServerTruthError(
      "Tell Me could not load durable project truth. Server persistence is not available.",
      503,
      "persistence_unavailable",
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    return await loadMissionStateFromSupabase(supabase);
  } catch (err) {
    if (err instanceof TellMeServerTruthError) throw err;
    const message = err instanceof Error ? err.message : "";
    if (/not authenticated/i.test(message)) {
      throw new TellMeServerTruthError("Sign in required.", 401, "unauthenticated");
    }
    throw new TellMeServerTruthError(
      "Tell Me could not load durable project truth.",
      500,
      "load_failed",
    );
  }
}

/**
 * Authenticated, project-scoped current truth for Tell Me.
 * Inject `loadWorkspace` in tests. Never accepts client MissionState.
 */
export async function loadServerCurrentTruthForTellMe(args: {
  projectId: string;
  question: string;
  loadWorkspace?: () => Promise<LoadedWorkspace>;
}): Promise<ServerCurrentTruth> {
  const projectId = args.projectId.trim();
  if (!projectId) {
    throw new TellMeServerTruthError(
      "Select a project first.",
      400,
      "project_required",
    );
  }

  const loader = args.loadWorkspace ?? loadAuthenticatedWorkspaceForTellMe;
  let loaded: LoadedWorkspace;
  try {
    loaded = await loader();
  } catch (err) {
    if (err instanceof TellMeServerTruthError) throw err;
    throw new TellMeServerTruthError(
      "Tell Me could not load durable project truth.",
      500,
      "load_failed",
    );
  }

  const belongs = loaded.state.projects.some((p) => p.id === projectId);
  if (!belongs) {
    throw new TellMeServerTruthError(
      "Project not found or you do not have access to it.",
      404,
      "project_not_found",
    );
  }

  const state = filterMissionStateToProject(loaded.state, projectId);

  let canonical: CanonicalTruthBundle;
  try {
    canonical = serializeCanonicalTruth({
      state,
      projectId,
      question: args.question,
    });
  } catch {
    throw new TellMeServerTruthError(
      "Tell Me could not assemble current project truth.",
      500,
      "canonical_assembly_failed",
    );
  }

  return {
    workspaceId: loaded.workspaceId,
    userId: loaded.userId,
    projectId,
    state,
    canonical,
  };
}

/** True when leftover clients still posted truth fields. Those fields must not be used. */
export function clientPostedTruthFields(body: {
  state?: unknown;
  snapshot?: unknown;
}): boolean {
  return body.state != null || body.snapshot != null;
}
