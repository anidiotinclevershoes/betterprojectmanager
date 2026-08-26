/**
 * Sequential stacked Capture runtime.
 * Frozen model JSON + real V2 validate/resolve/3B plan, then optional apply
 * against evolving MissionState. Test-only. Does not change production Capture.
 */

import { emptyKnowledge } from "@/lib/knowledge";
import { ensurePersonOnProject } from "@/lib/people/identity";
import {
  executeCaptureApply,
  type CaptureApplyHooks,
  type CaptureLegalOperation,
} from "@/lib/capture/apply";
import { worldFromCaptureState, runCaptureV2FromModelJson } from "@/lib/capture-v2";
import type { CaptureV2Run } from "@/lib/capture-v2/run";
import type { MissionState, TodoItem } from "@/lib/types";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";
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

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function knowledgeFor(
  state: MissionState,
  projectId: string,
): MissionState["knowledge"][number] {
  return (
    state.knowledge.find((k) => k.projectId === projectId) ?? emptyKnowledge(projectId)
  );
}

function setKnowledge(
  state: MissionState,
  projectId: string,
  next: MissionState["knowledge"][number],
): MissionState {
  return {
    ...state,
    knowledge: [
      ...(state.knowledge ?? []).filter((k) => k.projectId !== projectId),
      next,
    ],
  };
}

function applyOperation(state: MissionState, op: CaptureLegalOperation): MissionState {
  const now = new Date().toISOString();
  switch (op.type) {
    case "create_todo": {
      const todo: TodoItem = {
        id: newId("todo"),
        projectId: op.projectId,
        title: op.title,
        detail: op.detail,
        done: false,
        createdAt: now,
        dueAt: op.dueAt,
        kind: op.todoKind,
        waitingOn: op.waitingOn,
      };
      return { ...state, todos: [todo, ...(state.todos ?? [])] };
    }
    case "update_todo":
      return {
        ...state,
        todos: (state.todos ?? []).map((t) =>
          t.id === op.todoId
            ? { ...t, title: op.title ?? t.title, detail: op.detail ?? t.detail, dueAt: op.dueAt ?? t.dueAt }
            : t,
        ),
      };
    case "complete_todo":
      return {
        ...state,
        todos: (state.todos ?? []).map((t) =>
          t.id === op.todoId ? { ...t, done: true } : t,
        ),
      };
    case "delete_todo":
      return {
        ...state,
        todos: (state.todos ?? []).filter((t) => t.id !== op.todoId),
      };
    case "create_risk": {
      const riskId = newId("risk");
      const current = knowledgeFor(state, op.projectId);
      return setKnowledge(
        {
          ...state,
          risks: [
            ...(state.risks ?? []),
            {
              id: riskId,
              projectId: op.projectId,
              title: op.title,
              status: "open",
              source: "capture",
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        op.projectId,
        {
          ...current,
          sections: {
            ...current.sections,
            risks: [...(current.sections.risks ?? []), op.title],
          },
        },
      );
    }
    case "update_risk_status":
      return {
        ...state,
        risks: (state.risks ?? []).map((r) =>
          r.id === op.riskId && r.projectId === op.projectId
            ? { ...r, status: op.status, updatedAt: now }
            : r,
        ),
      };
    case "create_milestone":
      return {
        ...state,
        timeline: [
          ...(state.timeline ?? []),
          {
            id: newId("ms"),
            projectId: op.projectId,
            label: op.label,
            type: "milestone",
            startAt: op.startAt ?? now,
            endAt: op.endAt,
            notes: op.notes,
            source: "capture",
          },
        ],
      };
    case "update_milestone":
      return {
        ...state,
        timeline: (state.timeline ?? []).map((t) =>
          t.id === op.milestoneId
            ? {
                ...t,
                label: op.label ?? t.label,
                startAt: op.startAt ?? t.startAt,
                endAt: op.endAt ?? t.endAt,
                notes: op.notes ?? t.notes,
              }
            : t,
        ),
      };
    case "ensure_person": {
      const result = ensurePersonOnProject(
        state.projects,
        op.projectId,
        op.name,
        op.personId,
        op.roleHint,
      );
      return { ...state, projects: result.projects };
    }
    case "confirm_responsibility":
      return state;
    case "write_availability": {
      const current = knowledgeFor(state, op.projectId);
      const fromDay = op.awayFromIso.slice(0, 10);
      const toDay = op.awayToIso.slice(0, 10);
      const body =
        fromDay === toDay
          ? `${op.personName} — away ${fromDay}`
          : `${op.personName} — away ${fromDay} to ${toDay}`;
      const row: CanonicalTruthItem = {
        id: newId("avail"),
        projectId: op.projectId,
        section: "people",
        body,
        kind: "availability",
        epistemic: "confirmed",
        lifecycle: "current",
        meta: {
          personId: op.personId,
          availability: {
            personId: op.personId,
            personName: op.personName,
            awayFromIso: op.awayFromIso,
            awayToIso: op.awayToIso,
            label: op.label ?? null,
          },
        },
        provenance: [{ type: "capture", at: now }],
      };
      return setKnowledge(state, op.projectId, {
        ...current,
        structured: [...(current.structured ?? []), row],
      });
    }
    case "write_knowledge":
    case "write_memory":
      return state;
    default:
      return state;
  }
}

function hooksFor(box: { state: MissionState }): CaptureApplyHooks {
  const apply = async (op: CaptureLegalOperation) => {
    box.state = applyOperation(box.state, op);
  };
  return {
    createTodo: apply,
    updateTodo: apply,
    completeTodo: apply,
    deleteTodo: apply,
    createRisk: apply,
    updateRiskStatus: apply,
    createMilestone: apply,
    updateMilestone: apply,
    ensurePerson: apply,
    confirmResponsibility: apply,
    writeAvailability: apply,
    writeKnowledge: apply,
    writeMemory: apply,
  };
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
  const shouldApply =
    args.step.expectedReview === "apply" ||
    (args.step.expectedReview === "apply_or_no_change" && review === "apply");

  if (shouldApply) {
    const box = { state };
    const hooks = hooksFor(box);
    for (const row of pipeline.resolved) {
      if (row.decision.kind === "write") {
        await executeCaptureApply(row.decision, hooks);
      }
    }
    state = box.state;
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
  return expected === actual;
}
