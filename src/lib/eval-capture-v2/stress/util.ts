/**
 * Shared frozen-envelope helpers for Harbourline stress stories.
 * Not a second Capture framework — thin wrappers over stacked steps.
 */

import type { CaptureObservationV2, ObservationDomain, ObservationDisposition } from "@/lib/capture-v2/types";
import type { StackedReview, StackedStep } from "../stacked-stories";
import { HARBOURLINE_ID } from "./harbourline";

export type StressDifficulty = "easy" | "moderate" | "hard";

export type StressStep = StackedStep & {
  difficulty: StressDifficulty;
  checkpoint?: boolean;
};

export function hcaObs(
  partial: Partial<CaptureObservationV2> &
    Pick<CaptureObservationV2, "id" | "statement" | "domain" | "disposition">,
): CaptureObservationV2 {
  return {
    evidence: partial.evidence ?? partial.statement,
    projectId: HARBOURLINE_ID,
    candidateTargetId: partial.candidateTargetId ?? null,
    candidateTargetTitle: partial.candidateTargetTitle ?? null,
    mergeWithObservationId: null,
    proposedValues: partial.proposedValues ?? null,
    commentary: partial.commentary ?? null,
    modelConfidence: null,
    ...partial,
  };
}

export function hcaStep(args: {
  id: string;
  title: string;
  transcript: string;
  observations: CaptureObservationV2[];
  expectedReview: StackedReview;
  difficulty: StressDifficulty;
  bindTarget?: StackedStep["bindTarget"];
  checkpoint?: boolean;
}): StressStep {
  return {
    id: args.id,
    title: args.title,
    transcript: args.transcript,
    rawModelJson: { observations: args.observations },
    expectedReview: args.expectedReview,
    bindTarget: args.bindTarget,
    difficulty: args.difficulty,
    checkpoint: args.checkpoint,
  };
}

export function domain(value: ObservationDomain): ObservationDomain {
  return value;
}

export function disposition(value: ObservationDisposition): ObservationDisposition {
  return value;
}
