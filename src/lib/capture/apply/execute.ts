/**
 * Phase 3B — execute a planned Capture apply decision.
 * Never invents a write. Needs you / no-change are no-ops.
 */

import type { CaptureApplyDecision, CaptureLegalOperation } from "./types";

export type CaptureApplyHooks = {
  createTodo: (op: Extract<CaptureLegalOperation, { type: "create_todo" }>) => Promise<void> | void;
  updateTodo: (op: Extract<CaptureLegalOperation, { type: "update_todo" }>) => Promise<void> | void;
  completeTodo: (op: Extract<CaptureLegalOperation, { type: "complete_todo" }>) => Promise<void> | void;
  deleteTodo: (op: Extract<CaptureLegalOperation, { type: "delete_todo" }>) => Promise<void> | void;
  createRisk: (op: Extract<CaptureLegalOperation, { type: "create_risk" }>) => Promise<void> | void;
  updateRiskStatus: (
    op: Extract<CaptureLegalOperation, { type: "update_risk_status" }>,
  ) => Promise<void> | void;
  createMilestone: (
    op: Extract<CaptureLegalOperation, { type: "create_milestone" }>,
  ) => Promise<void> | void;
  updateMilestone: (
    op: Extract<CaptureLegalOperation, { type: "update_milestone" }>,
  ) => Promise<void> | void;
  ensurePerson: (op: Extract<CaptureLegalOperation, { type: "ensure_person" }>) => Promise<void> | void;
  confirmResponsibility: (
    op: Extract<CaptureLegalOperation, { type: "confirm_responsibility" }>,
  ) => Promise<void> | void;
  writeAvailability: (
    op: Extract<CaptureLegalOperation, { type: "write_availability" }>,
  ) => Promise<void> | void;
  writeKnowledge: (
    op: Extract<CaptureLegalOperation, { type: "write_knowledge" }>,
  ) => Promise<void> | void;
  writeMemory: (op: Extract<CaptureLegalOperation, { type: "write_memory" }>) => Promise<void> | void;
  /**
   * Optional approved-create receipt lookup. Same Review/Apply operation
   * identity must not mint a second authoritative row.
   */
  findApplyReceipt?: (args: {
    projectId: string;
    operationId: string;
  }) => Promise<{ entityType: string; entityId: string } | null> | {
    entityType: string;
    entityId: string;
  } | null;
};

export type CaptureExecuteResult =
  | { kind: "wrote"; domain: string; operation: CaptureLegalOperation["type"] }
  | { kind: "needs_you"; reason: string; domain: string }
  | { kind: "no_change"; reason: string; domain: string }
  | { kind: "failed"; reason: string; domain: string };

function assertNeverOp(value: never): never {
  throw new Error(`unsupported Capture operation: ${String(value)}`);
}

export async function executeCaptureApply(
  decision: CaptureApplyDecision,
  hooks: CaptureApplyHooks,
): Promise<CaptureExecuteResult> {
  if (decision.kind === "needs_you") {
    return { kind: "needs_you", reason: decision.reason, domain: decision.domain };
  }
  if (decision.kind === "no_change") {
    return { kind: "no_change", reason: decision.reason, domain: decision.domain };
  }

  const op = decision.operation;
  try {
    switch (op.type) {
      case "create_todo":
        await hooks.createTodo(op);
        break;
      case "update_todo":
        await hooks.updateTodo(op);
        break;
      case "complete_todo":
        await hooks.completeTodo(op);
        break;
      case "delete_todo":
        await hooks.deleteTodo(op);
        break;
      case "create_risk":
        await hooks.createRisk(op);
        break;
      case "update_risk_status":
        await hooks.updateRiskStatus(op);
        break;
      case "create_milestone":
        await hooks.createMilestone(op);
        break;
      case "update_milestone":
        await hooks.updateMilestone(op);
        break;
      case "ensure_person":
        await hooks.ensurePerson(op);
        break;
      case "confirm_responsibility":
        await hooks.confirmResponsibility(op);
        break;
      case "write_availability":
        await hooks.writeAvailability(op);
        break;
      case "write_knowledge":
        await hooks.writeKnowledge(op);
        break;
      case "write_memory":
        await hooks.writeMemory(op);
        break;
      default:
        return assertNeverOp(op);
    }
    return { kind: "wrote", domain: decision.domain, operation: op.type };
  } catch (err) {
    return {
      kind: "failed",
      domain: decision.domain,
      reason: err instanceof Error ? err.message : "Could not save this change.",
    };
  }
}
