/**
 * Run observations through the REAL V2 validation / resolver / 3B planner.
 * Test-safe: no network, no database, experimental worlds only.
 */

import {
  contextRecordsFromWorld,
  runCaptureV2FromModelJson,
} from "@/lib/capture-v2";
import type { CaptureV2Run } from "@/lib/capture-v2/run";
import { experimentalApplyWorld } from "@/lib/experiments/worlds";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type { BenchmarkCase } from "./types";
import { classifyLumeSafety } from "./lume-safety";
import { scoreModelObservations } from "./scoring";
import { frozenEnvelopeFor } from "./frozen-model-outputs";
import type { CaptureObservationV2 } from "@/lib/capture-v2/types";

export function runV2Pipeline(args: {
  transcript: string;
  rawModelJson: unknown;
  projectId: string;
  world?: CaptureApplyWorld;
}): CaptureV2Run {
  return runCaptureV2FromModelJson({
    transcript: args.transcript,
    rawModelJson: args.rawModelJson,
    world: args.world ?? experimentalApplyWorld(),
    projectId: args.projectId,
  });
}

export function evaluateAgainstCase(args: {
  testCase: BenchmarkCase;
  rawModelJson: unknown;
  world?: CaptureApplyWorld;
}) {
  const world = args.world ?? experimentalApplyWorld();
  const pipeline = runV2Pipeline({
    transcript: args.testCase.transcript,
    rawModelJson: args.rawModelJson,
    projectId: args.testCase.projectId,
    world,
  });
  const observations: CaptureObservationV2[] = [
    ...pipeline.validation.observations,
    ...pipeline.validation.rejected,
  ];
  const modelMetrics = scoreModelObservations(args.testCase, observations);
  const lumeSafety = classifyLumeSafety({
    testCase: args.testCase,
    observations,
    validation: pipeline.validation,
    resolved: pipeline.resolved,
  });
  return { pipeline, modelMetrics, lumeSafety };
}

export function evaluateFrozenCase(
  testCase: BenchmarkCase,
  world?: CaptureApplyWorld,
) {
  return evaluateAgainstCase({
    testCase,
    rawModelJson: frozenEnvelopeFor(testCase.id),
    world,
  });
}

export function recordsForCase(testCase: BenchmarkCase, world?: CaptureApplyWorld) {
  return contextRecordsFromWorld(world ?? experimentalApplyWorld(), testCase.projectId);
}
