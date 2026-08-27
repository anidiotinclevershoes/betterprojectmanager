/**
 * Load workspace truth for Catch Me Up.
 * Always uses the caller-supplied server loader. Never accepts posted MissionState.
 */
import type { LoadedWorkspace } from "@/lib/data/supabase/load-mission-state";
import type { MissionState } from "@/lib/types";
import { CatchMeUpRequestError } from "./request";
import { projectExistsInWorkspace, scopeMissionStateToProject } from "./scope";

export type AuthoritativeTruthLoader = () => Promise<LoadedWorkspace>;

export async function loadAuthoritativeProjectTruth(args: {
  projectId: string;
  loadWorkspace: AuthoritativeTruthLoader;
}): Promise<{
  workspaceId: string;
  userId: string;
  state: MissionState;
}> {
  const loaded = await args.loadWorkspace();
  if (!projectExistsInWorkspace(loaded.state, args.projectId)) {
    throw new CatchMeUpRequestError(
      404,
      "project_not_found",
      "That project is not in this workspace.",
    );
  }
  return {
    workspaceId: loaded.workspaceId,
    userId: loaded.userId,
    state: scopeMissionStateToProject(loaded.state, args.projectId),
  };
}
