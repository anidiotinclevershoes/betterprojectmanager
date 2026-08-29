/**
 * In-memory Phase 3B execute hooks.
 * Used by Capture V2 Apply tests, stacked sequential journeys, and
 * Playwright apply mocks. Production HTTP Apply uses the same
 * planCaptureApply decision, then persist hooks.
 */
import { emptyKnowledge } from "@/lib/knowledge";
import { ensurePersonOnProject } from "@/lib/people/identity";
import { confirmResponsibilityOwner } from "@/lib/people/identity";
import type { CanonicalTruthItem } from "@/lib/canonical-truth/types";
import type { MissionState, TodoItem } from "@/lib/types";
import type { CaptureApplyHooks } from "./execute";
import type { CaptureLegalOperation } from "./types";

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function knowledgeFor(
  state: MissionState,
  projectId: string,
): MissionState["knowledge"][number] {
  return (
    state.knowledge.find((k) => k.projectId === projectId) ??
    emptyKnowledge(projectId)
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

export function applyCaptureOperationInMemory(
  state: MissionState,
  op: CaptureLegalOperation,
): MissionState {
  const now = new Date().toISOString();
  switch (op.type) {
    case "create_todo": {
      if (op.applyOperationId) {
        const existing = (state.todos ?? []).find(
          (t) => t.sourceRecommendationId === op.applyOperationId,
        );
        if (existing) return state;
      }
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
        sourceRecommendationId: op.applyOperationId,
      };
      return { ...state, todos: [todo, ...(state.todos ?? [])] };
    }
    case "update_todo":
      return {
        ...state,
        todos: (state.todos ?? []).map((t) =>
          t.id === op.todoId
            ? {
                ...t,
                title: op.title ?? t.title,
                detail: op.detail ?? t.detail,
                dueAt: op.dueAt ?? t.dueAt,
              }
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
    case "create_milestone": {
      if (!op.startAt) {
        throw new Error("This date cannot be saved — the date is missing.");
      }
      return {
        ...state,
        timeline: [
          ...(state.timeline ?? []),
          {
            id: newId("ms"),
            projectId: op.projectId,
            label: op.label,
            type: "milestone",
            startAt: op.startAt,
            endAt: op.endAt,
            notes: op.notes,
            source: "capture",
          },
        ],
      };
    }
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
      return confirmResponsibilityOwner({
        state,
        projectId: op.projectId,
        scope: op.scope,
        personName: op.personName,
        personId: op.personId,
        replacePersonId: op.replacePersonId,
      }).state;
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

export function memoryCaptureApplyHooks(box: {
  state: MissionState;
}): CaptureApplyHooks {
  const apply = async (op: CaptureLegalOperation) => {
    box.state = applyCaptureOperationInMemory(box.state, op);
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
