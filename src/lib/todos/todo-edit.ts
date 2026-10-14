import type { MissionState, Stakeholder, TodoItem } from "@/lib/types";
import { makeHistoryEvent, pushHistory } from "@/lib/workspace/history";

export type TodoEditInput = {
  title: string;
  detail?: string | null;
  dueAt?: string | null;
  /** Omit to leave the legacy note untouched. */
  waitingOn?: string | null;
  waitingOnPersonIds: string[];
};

export type TodoEditPlan =
  | { ok: false; error: string }
  | { ok: true; changed: false; todo: TodoItem }
  | {
      ok: true;
      changed: true;
      todo: TodoItem;
      historyTitle: string;
      historyDetail: string;
    };

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : undefined;
}

export function normalisePersonIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/**
 * Plan a To Do edit. Person links are ids of people already in the project.
 * The legacy waitingOn string is never derived from those names.
 */
export function planTodoEdit(
  before: TodoItem,
  people: Stakeholder[],
  input: TodoEditInput,
): TodoEditPlan {
  const title = input.title.replace(/\s+/g, " ").trim();
  if (!title) return { ok: false, error: "Enter a title before saving." };

  const allowed = new Set(people.map((person) => person.id));
  const personIds = normalisePersonIds(input.waitingOnPersonIds);
  if (personIds.some((id) => !allowed.has(id))) {
    return {
      ok: false,
      error: "Waiting on can only use people already in this project.",
    };
  }

  const next: TodoItem = {
    ...before,
    title,
    detail: input.detail === undefined ? before.detail : clean(input.detail),
    dueAt:
      input.dueAt === undefined
        ? before.dueAt
        : input.dueAt === null || !input.dueAt.trim()
          ? undefined
          : input.dueAt,
    waitingOn:
      input.waitingOn === undefined ? before.waitingOn : clean(input.waitingOn),
    waitingOnPersonIds: personIds,
  };

  const previousIds = normalisePersonIds(before.waitingOnPersonIds ?? []);
  const changes: string[] = [];
  if (before.title !== next.title) {
    changes.push(`Title: ${before.title} → ${next.title}`);
  }
  if ((before.detail ?? "") !== (next.detail ?? "")) changes.push("Detail updated");
  if ((before.dueAt ?? "") !== (next.dueAt ?? "")) changes.push("Due date updated");
  if ((before.waitingOn ?? "") !== (next.waitingOn ?? "")) {
    changes.push("Saved waiting note updated");
  }
  if (!sameIds(previousIds, personIds)) {
    const names = personIds.map(
      (id) => people.find((person) => person.id === id)?.name ?? id,
    );
    changes.push(names.length ? `Waiting on: ${names.join(", ")}` : "Waiting on: nobody");
  }

  if (!changes.length) return { ok: true, changed: false, todo: next };
  return {
    ok: true,
    changed: true,
    todo: next,
    historyTitle: "You updated a To Do",
    historyDetail: `${next.title}\n${changes.join("\n")}`,
  };
}

/** Keep the stored instant when the calendar day did not change. */
export function dueAtForEdit(
  existing: string | undefined,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (existing && existing.slice(0, 10) === trimmed.slice(0, 10)) return existing;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T12:00:00.000Z`;
  return trimmed;
}

export type TodoEditRequest = {
  projectId: string;
  todoId: string;
  title: string;
  detail: string | null;
  dueAt: string | null;
  waitingOn: string | null;
  waitingOnPersonIds: string[];
  historyId?: string;
};

export function applyTodoEdit(
  state: MissionState,
  input: TodoEditRequest,
):
  | { ok: false; error: string }
  | { ok: true; changed: false }
  | { ok: true; changed: true; state: MissionState } {
  const project = state.projects.find((row) => row.id === input.projectId);
  if (!project) return { ok: false, error: "That project is not open." };
  const before = (state.todos ?? []).find(
    (todo) => todo.id === input.todoId && (todo.projectId ?? null) === input.projectId,
  );
  if (!before) return { ok: false, error: "That To Do is not in this project." };

  const plan = planTodoEdit(before, project.stakeholders ?? [], {
    title: input.title,
    detail: input.detail,
    dueAt: input.dueAt,
    waitingOn: input.waitingOn,
    waitingOnPersonIds: input.waitingOnPersonIds,
  });
  if (!plan.ok) return plan;
  if (!plan.changed) return { ok: true, changed: false };

  const todos = (state.todos ?? []).map((todo) =>
    todo.id === before.id ? plan.todo : todo,
  );
  const event = {
    ...makeHistoryEvent({
      type: "task_updated",
      title: plan.historyTitle,
      detail: plan.historyDetail,
      projectId: input.projectId,
      source: "user",
      targetKind: "todo",
      targetId: before.id,
    }),
    ...(input.historyId ? { id: input.historyId } : {}),
  };
  return {
    ok: true,
    changed: true,
    state: pushHistory({ ...state, todos }, event),
  };
}
