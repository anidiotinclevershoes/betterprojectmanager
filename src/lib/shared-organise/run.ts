/**
 * Shared Organise run.
 * Luna proposes a form. This module validates it and returns the existing Review shape.
 * It does not call Apply.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply/types";
import type { CaptureResult } from "@/lib/types";
import { buildSharedOrganiseContext } from "./context";
import { captureResultFromOrganisedChanges } from "./to-review";
import { parseProjectChangeForm, reviewProjectChangeForm, type ReviewedChange } from "./validate";

export type SharedOrganiseRun = {
  result: CaptureResult;
  reviewed: ReviewedChange[];
  projectBlock: string;
  referenceDate: string;
};

export function runSharedOrganiseFromModelJson(args: {
  transcript: string;
  rawModelJson: unknown;
  world: CaptureApplyWorld;
  projectId: string;
  referenceDate?: string;
}): SharedOrganiseRun {
  const context = buildSharedOrganiseContext({
    world: args.world,
    projectId: args.projectId,
    referenceDate: args.referenceDate,
  });
  const form = parseProjectChangeForm(args.rawModelJson);
  const reviewed = reviewProjectChangeForm({
    form,
    context,
    source: args.transcript,
  });
  const project = args.world.projects.find((row) => row.id === args.projectId);
  const result = captureResultFromOrganisedChanges({
    transcript: args.transcript,
    projectId: args.projectId,
    projectName: project?.name,
    reviewed,
  });
  return {
    result,
    reviewed,
    projectBlock: context.prompt,
    referenceDate: context.referenceDate,
  };
}
