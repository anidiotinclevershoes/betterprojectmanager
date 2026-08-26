/**
 * Capture V2 Slice 1C — authenticated server-loaded current truth.
 *
 * Reuses the Tell Me durable loader. Capture's assembler remains
 * captureApplyWorldFromState / worldFromCaptureState (Phase 3B ID catalogue),
 * not a second current-truth format.
 *
 * Never accepts client MissionState as current truth. There is no
 * fallback to browser-posted state.
 */
import type { LoadedWorkspace } from "@/lib/data/supabase/load-mission-state";
import {
  DurableWorkspaceError,
  clientPostedTruthFields,
  loadProjectScopedWorkspace,
} from "@/lib/data/durable-workspace";
import type { CaptureApplyWorld } from "@/lib/capture/apply/types";
import { captureApplyWorldFromState } from "@/lib/capture/apply/world";
import type { MissionState } from "@/lib/types";

export class CaptureServerTruthError extends DurableWorkspaceError {
  constructor(message: string, status: number, code: string) {
    super(message, status, code);
    this.name = "CaptureServerTruthError";
  }
}

export type ServerCaptureWorld = {
  workspaceId: string;
  userId: string;
  projectId: string;
  /** Project-isolated durable snapshot for the model / Phase 3B world. */
  state: MissionState;
  /** Full workspace snapshot so Apply cannot wipe sibling projects. */
  workspaceState: MissionState;
  world: CaptureApplyWorld;
};

function asCaptureError(err: unknown): CaptureServerTruthError {
  if (err instanceof CaptureServerTruthError) return err;
  if (err instanceof DurableWorkspaceError) {
    return new CaptureServerTruthError(err.message, err.status, err.code);
  }
  return new CaptureServerTruthError(
    "Capture could not load durable project truth.",
    500,
    "load_failed",
  );
}

export { clientPostedTruthFields };

export async function loadServerCaptureWorld(args: {
  projectId: string;
  loadWorkspace?: () => Promise<LoadedWorkspace>;
}): Promise<ServerCaptureWorld> {
  let loaded: Awaited<ReturnType<typeof loadProjectScopedWorkspace>>;
  try {
    loaded = await loadProjectScopedWorkspace({
      projectId: args.projectId,
      loadWorkspace: args.loadWorkspace,
      failureNoun: "Capture",
    });
  } catch (err) {
    throw asCaptureError(err);
  }

  return {
    workspaceId: loaded.workspaceId,
    userId: loaded.userId,
    projectId: loaded.projectId,
    state: loaded.state,
    workspaceState: loaded.workspaceState,
    world: captureApplyWorldFromState(loaded.state),
  };
}
