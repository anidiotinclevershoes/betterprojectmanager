/**
 * Prove that an authoritative workspace snapshot contains Apply writes.
 * Client-safe. Does not plan, persist, or invent rows.
 */
import type { MissionState } from "@/lib/types";
import type { CaptureLegalOperation } from "./types";

export function appliedStateContainsWrite(
  state: MissionState,
  operation: CaptureLegalOperation,
): boolean {
  switch (operation.type) {
    case "create_todo":
      return (state.todos ?? []).some(
        (todo) =>
          todo.projectId === operation.projectId &&
          todo.title.trim() === operation.title.trim(),
      );
    case "complete_todo":
      return (state.todos ?? []).some(
        (todo) => todo.id === operation.todoId && todo.done,
      );
    case "create_risk":
      return (state.risks ?? []).some(
        (risk) =>
          risk.projectId === operation.projectId &&
          risk.title.trim() === operation.title.trim(),
      );
    case "update_risk_status":
      return (state.risks ?? []).some(
        (risk) =>
          risk.id === operation.riskId && risk.status === operation.status,
      );
    case "create_milestone":
      return (state.timeline ?? []).some(
        (item) =>
          item.projectId === operation.projectId &&
          item.label.trim() === operation.label.trim(),
      );
    case "update_milestone": {
      const row = state.timeline.find((item) => item.id === operation.milestoneId);
      if (!row) return false;
      if (operation.startAt && row.startAt.slice(0, 10) !== operation.startAt.slice(0, 10)) {
        return false;
      }
      return true;
    }
    case "ensure_person": {
      const project = state.projects.find((item) => item.id === operation.projectId);
      return Boolean(
        project?.stakeholders.some(
          (person) => person.name.trim() === operation.name.trim(),
        ),
      );
    }
    default:
      return true;
  }
}

export function appliedStateContainsAllWrites(
  state: MissionState,
  operations: CaptureLegalOperation[],
): boolean {
  return operations.every((operation) => appliedStateContainsWrite(state, operation));
}

export type ConfirmAuthoritativeWritesResult =
  | { state: MissionState; reconcileFailed?: false }
  | { state?: undefined; reconcileFailed: true };

/**
 * Bounded prove-write for one Apply or a completed Ready batch.
 * Reloads immediately until every successful operation is visible.
 * Does not sleep, invent rows, or adopt an incomplete snapshot.
 */
export async function confirmAuthoritativeWrites(args: {
  operations: CaptureLegalOperation[];
  reloadWorkspace: () => Promise<MissionState>;
  maxAttempts?: number;
}): Promise<ConfirmAuthoritativeWritesResult> {
  const operations = args.operations;
  const maxAttempts = args.maxAttempts ?? 4;
  if (operations.length === 0) {
    return { state: await args.reloadWorkspace() };
  }
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const state = await args.reloadWorkspace();
    if (appliedStateContainsAllWrites(state, operations)) {
      return { state };
    }
  }
  return { reconcileFailed: true };
}
