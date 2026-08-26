/**
 * Tell Me Slice 1B — load durable project truth on the server.
 *
 * Reuses the shared durable workspace loader, then serializeCanonicalTruth.
 * Never accepts client MissionState as current truth.
 * Client MissionState is never an input to this path.
 */
import { serializeCanonicalTruth } from "@/lib/canonical-truth/serialize";
import type { CanonicalTruthBundle } from "@/lib/canonical-truth/types";
import type { LoadedWorkspace } from "@/lib/data/supabase/load-mission-state";
import {
  DurableWorkspaceError,
  clientPostedTruthFields,
  filterMissionStateToProject,
  loadAuthenticatedWorkspace,
  loadProjectScopedWorkspace,
} from "@/lib/data/durable-workspace";
import type { MissionState } from "@/lib/types";

export class TellMeServerTruthError extends DurableWorkspaceError {
  constructor(message: string, status: number, code: string) {
    super(message, status, code);
    this.name = "TellMeServerTruthError";
  }
}

export type ServerCurrentTruth = {
  workspaceId: string;
  userId: string;
  projectId: string;
  state: MissionState;
  canonical: CanonicalTruthBundle;
};

function asTellMeError(err: unknown): TellMeServerTruthError {
  if (err instanceof TellMeServerTruthError) return err;
  if (err instanceof DurableWorkspaceError) {
    return new TellMeServerTruthError(err.message, err.status, err.code);
  }
  return new TellMeServerTruthError(
    "Tell Me could not load durable project truth.",
    500,
    "load_failed",
  );
}

export { filterMissionStateToProject, clientPostedTruthFields };

export async function loadAuthenticatedWorkspaceForTellMe(): Promise<LoadedWorkspace> {
  try {
    return await loadAuthenticatedWorkspace();
  } catch (err) {
    throw asTellMeError(err);
  }
}

export async function loadServerCurrentTruthForTellMe(args: {
  projectId: string;
  question: string;
  loadWorkspace?: () => Promise<LoadedWorkspace>;
}): Promise<ServerCurrentTruth> {
  let loaded: Awaited<ReturnType<typeof loadProjectScopedWorkspace>>;
  try {
    loaded = await loadProjectScopedWorkspace({
      projectId: args.projectId,
      loadWorkspace: args.loadWorkspace,
      failureNoun: "Tell Me",
    });
  } catch (err) {
    throw asTellMeError(err);
  }

  let canonical: CanonicalTruthBundle;
  try {
    canonical = serializeCanonicalTruth({
      state: loaded.state,
      projectId: loaded.projectId,
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
    projectId: loaded.projectId,
    state: loaded.state,
    canonical,
  };
}
