import { captureApplyWorldFromState } from "@/lib/capture/apply";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type { CaptureResult, MissionState } from "@/lib/types";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
} from "./context";
import { resolveObservations, type ResolvedObservation } from "./resolve";
import { captureResultFromResolved } from "./toResult";
import type {
  CaptureObservationV2,
  ObservationValidationResult,
} from "./types";
import { parseObservationEnvelope, validateObservations } from "./validate";

export type CaptureV2Run = {
  result: CaptureResult;
  resolved: ResolvedObservation[];
  validation: ObservationValidationResult;
  projectBlock: string;
};

export function worldFromCaptureState(
  state: Pick<
    MissionState,
    "projects" | "risks" | "todos" | "timeline" | "knowledge"
  >,
): CaptureApplyWorld {
  return captureApplyWorldFromState(state as MissionState);
}

export function runCaptureV2FromModelJson(args: {
  transcript: string;
  rawModelJson: unknown;
  world: CaptureApplyWorld;
  projectId?: string | null;
}): CaptureV2Run {
  const project = args.projectId
    ? args.world.projects.find((p) => p.id === args.projectId)
    : undefined;
  const records = contextRecordsFromWorld(args.world, args.projectId);
  const projectBlock = project
    ? formatAuthoritativeStateForPrompt(records, project)
    : "Current project: (unscoped)\nAuthoritative current records:\n(none)";

  const parsed = parseObservationEnvelope(args.rawModelJson);
  const validation = validateObservations(
    parsed.observations,
    records,
    args.projectId,
  );
  const resolved = resolveObservations({
    observations: validation.observations,
    world: args.world,
    transcript: args.transcript,
    captureEntryProjectId: args.projectId,
  });
  const result = captureResultFromResolved({
    transcript: args.transcript,
    projectId: args.projectId,
    projectName: project?.name,
    resolved,
    rejected: validation.rejected,
  });

  return { result, resolved, validation, projectBlock };
}

export function emptyV2Result(transcript: string, projectId?: string | null): CaptureResult {
  return captureResultFromResolved({
    transcript,
    projectId,
    resolved: [],
    rejected: [],
  });
}
