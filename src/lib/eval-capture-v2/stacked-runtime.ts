/**
 * Sequential stacked Capture runtime.
 * Frozen model JSON + real V2 validate/resolve/3B plan, then optional apply
 * against evolving MissionState. Test-only. Does not change production Capture.
 */

import { applyApprovedCaptureSuggestion } from "@/lib/capture/apply/apply-approved";
import { worldFromCaptureState, runCaptureV2FromModelJson } from "@/lib/capture-v2";
import type { CaptureV2Run } from "@/lib/capture-v2/run";
import type { MissionState } from "@/lib/types";
import { experimentalMissionState } from "./mission-state";
import { classifyLumeSafety } from "./lume-safety";
import type { StackedBindTarget, StackedStep, StackedStory } from "./stacked-stories";

export type ProjectTruthSnapshot = {
  projectId: string;
  people: Array<{ id: string; name: string; role?: string }>;
  peopleCount: number;
  peopleNames: string[];
  risks: Array<{ id: string; title: string; status: string }>;
  todos: Array<{ id: string; title: string; done: boolean }>;
  dates: Array<{ id: string; label: string; startAt?: string }>;
  availability: Array<{ personId: string | null; body: string }>;
};

export type StackedStepResult = {
  stepId: string;
  review: "no_change" | "apply" | "needs_you" | "mixed";
  writeCount: number;
  needsYouCount: number;
  noChangeCount: number;
  lumeFailures: number;
  pipeline: CaptureV2Run;
  state: MissionState;
};

function cloneState(state: MissionState): MissionState {
  return structuredClone(state);
}

export function snapshotProject(
  state: MissionState,
  projectId: string,
): ProjectTruthSnapshot {
  const project = state.projects.find((p) => p.id === projectId);
  const knowledge = state.knowledge.find((k) => k.projectId === projectId);
  const availability = (knowledge?.structured ?? [])
    .filter((row) => row.kind === "availability" && row.lifecycle === "current")
    .map((row) => ({
      personId:
        typeof row.meta?.availability?.personId === "string"
          ? row.meta.availability.personId
          : typeof row.meta?.personId === "string"
            ? row.meta.personId
            : null,
      body: row.body,
    }));
  return {
    projectId,
    people: (project?.stakeholders ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
    })),
    peopleCount: project?.stakeholders.length ?? 0,
    peopleNames: (project?.stakeholders ?? []).map((s) => s.name),
    risks: (state.risks ?? [])
      .filter((r) => r.projectId === projectId)
      .map((r) => ({ id: r.id, title: r.title, status: r.status })),
    todos: (state.todos ?? [])
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ id: t.id, title: t.title, done: Boolean(t.done) })),
    dates: (state.timeline ?? [])
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ id: t.id, label: t.label, startAt: t.startAt })),
    availability,
  };
}

export function bindEnvelopeToWorld(
  raw: unknown,
  state: MissionState,
  bind?: StackedBindTarget,
): unknown {
  if (!bind) return raw;
  const envelope = structuredClone(raw) as {
    observations?: Array<Record<string, unknown>>;
  };
  const id = findBoundId(state, bind);
  if (!id) {
    throw new Error(
      `Stacked bind failed: no ${bind.domain} matching "${bind.titleIncludes}"`,
    );
  }
  for (const obs of envelope.observations ?? []) {
    if (obs.domain === bind.domain) {
      obs.candidateTargetId = id;
    }
  }
  return envelope;
}

function findBoundId(state: MissionState, bind: StackedBindTarget): string | null {
  const needle = bind.titleIncludes.toLowerCase();
  if (bind.domain === "todo") {
    return (
      (state.todos ?? []).find((t) => t.title.toLowerCase().includes(needle))?.id ??
      null
    );
  }
  if (bind.domain === "risk") {
    return (
      (state.risks ?? []).find((r) => r.title.toLowerCase().includes(needle))?.id ??
      null
    );
  }
  if (bind.domain === "milestone") {
    return (
      (state.timeline ?? []).find((t) => t.label.toLowerCase().includes(needle))
        ?.id ?? null
    );
  }
  for (const project of state.projects) {
    const hit = project.stakeholders.find((s) =>
      s.name.toLowerCase().includes(needle),
    );
    if (hit) return hit.id;
  }
  return null;
}

export function captureResultFromStackedStep(args: {
  step: StackedStep;
  projectId: string;
  state: MissionState;
}): CaptureV2Run {
  const rawModelJson = bindEnvelopeToWorld(
    args.step.rawModelJson,
    args.state,
    args.step.bindTarget,
  );
  return runCaptureV2FromModelJson({
    transcript: args.step.transcript,
    rawModelJson,
    world: worldFromCaptureState(args.state),
    projectId: args.projectId,
  });
}

function summariseReview(pipeline: CaptureV2Run): StackedStepResult["review"] {
  const writes = pipeline.resolved.filter((r) => r.decision.kind === "write").length;
  const needs = pipeline.resolved.filter((r) => r.decision.kind === "needs_you").length;
  if (writes > 0 && needs > 0) return "mixed";
  if (writes > 0) return "apply";
  if (needs > 0) return "needs_you";
  return "no_change";
}

export async function runStackedStep(args: {
  step: StackedStep;
  projectId: string;
  state: MissionState;
  /**
   * When true, persist every Apply Ready write regardless of expectedReview.
   * Stress journeys use this to observe actual durable mutations (including
   * mixed siblings and unexpected writes). Existing stacked regression keeps
   * the default: only apply when the step expected an apply.
   */
  applyReadyWrites?: boolean;
}): Promise<StackedStepResult> {
  let state = cloneState(args.state);
  const pipeline = captureResultFromStackedStep({
    step: args.step,
    projectId: args.projectId,
    state,
  });
  const lume = classifyLumeSafety({
    testCase: {
      id: args.step.id,
      title: args.step.title,
      category: "stacked",
      world: "candyland" as const,
      projectId: args.projectId,
      transcript: args.step.transcript,
      evaluationMode: "fixture-only",
      material: [],
      allowedDomains: [
        "person",
        "responsibility",
        "risk",
        "milestone",
        "todo",
        "availability",
        "commentary",
        "unknown",
      ],
      prohibitedInterpretations: [],
      prohibitedWrites: [],
    },
    observations: [
      ...pipeline.validation.observations,
      ...pipeline.validation.rejected,
    ],
    validation: pipeline.validation,
    resolved: pipeline.resolved,
  });

  const review = summariseReview(pipeline);
  const shouldApply = args.applyReadyWrites
    ? pipeline.resolved.some((row) => row.decision.kind === "write")
    : args.step.expectedReview === "apply" ||
      args.step.expectedReview === "mixed" ||
      (args.step.expectedReview === "apply_or_no_change" &&
        (review === "apply" || review === "mixed"));

  if (shouldApply) {
    for (const row of pipeline.resolved) {
      if (row.decision.kind !== "write" || !row.suggestion) continue;
      const applied = await applyApprovedCaptureSuggestion({
        item: row.suggestion,
        text: args.step.transcript,
        projectId: args.projectId,
        expectedTarget: row.suggestion.expectedTarget,
        loadWorkspace: async () => ({
          workspaceId: "stacked",
          userId: "stacked",
          state,
        }),
      });
      if (applied.executed.kind === "wrote") {
        state = applied.state;
      }
    }
  }

  return {
    stepId: args.step.id,
    review,
    writeCount: pipeline.resolved.filter((r) => r.decision.kind === "write").length,
    needsYouCount: pipeline.resolved.filter((r) => r.decision.kind === "needs_you")
      .length,
    noChangeCount: pipeline.resolved.filter((r) => r.decision.kind === "no_change")
      .length,
    lumeFailures: lume.totals.lumeFailures,
    pipeline,
    state,
  };
}

export async function runStackedStory(story: StackedStory, seed?: MissionState) {
  let state = cloneState(seed ?? experimentalMissionState());
  const seedSnapshots = {
    candyland: snapshotProject(state, "proj-candy"),
    toyworld: snapshotProject(state, "proj-toy"),
    gamingstudio5000: snapshotProject(state, "proj-game"),
  };
  const steps: StackedStepResult[] = [];
  for (const step of story.steps) {
    const result = await runStackedStep({
      step,
      projectId: story.projectId,
      state,
    });
    state = result.state;
    steps.push(result);
  }
  return {
    storyId: story.id,
    steps,
    state,
    final: snapshotProject(state, story.projectId),
    seedSnapshots,
  };
}

export function reviewMatches(
  expected: StackedStep["expectedReview"],
  actual: StackedStepResult["review"],
): boolean {
  if (expected === "apply_or_no_change") {
    return actual === "apply" || actual === "no_change";
  }
  if (expected === "mixed") {
    return actual === "mixed" || actual === "apply" || actual === "needs_you";
  }
  return expected === actual;
}
