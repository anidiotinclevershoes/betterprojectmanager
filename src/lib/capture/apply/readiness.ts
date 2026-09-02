/**
 * Shared Review ↔ Apply readiness contract.
 *
 * READY only when all four hold:
 * 1. The intended change is semantically representable.
 * 2. Apply legally supports that domain × operation.
 * 3. This exact proposal has enough target / value / current-state to plan.
 * 4. The planner constructs that write without inventing project truth.
 *
 * Apply still revalidates at execution time. This module is the Review
 * preflight — the same planner Apply uses, with no I/O.
 *
 * Do not add person-removal or other new mutation semantics here.
 */

import type { PendingSuggestion } from "@/lib/capture/suggestions";
import { classifyCaptureLegalDomain } from "./classify";
import {
  hasStructuredCessationSignal,
  isApplyExecutableSuggestion,
  unsupportedApplyReason,
} from "./executability";
import { planCaptureApply } from "./dispatch";
import {
  fingerprintExpectedTarget,
  staleExpectedTargetReason,
} from "./expected-target";
import type {
  CaptureApplyDecision,
  CaptureApplyWorld,
  CaptureLegalOperation,
} from "./types";

export type ReviewPreflightContext = {
  world: CaptureApplyWorld;
  captureEntryProjectId?: string | null;
};

export type ApplyReadinessVerdict = {
  /** Static legality + semantic representability. Not world-dependent. */
  executableApply: boolean;
  /** Planner constructed a faithful write against this world snapshot. */
  canApprove: boolean;
  plannerKind?: CaptureApplyDecision["kind"];
  reason?: string;
  missingRequiredField?: "date";
  stale?: boolean;
  unrepresentable?: boolean;
};

const NO_WORLD_REASON =
  "Lume cannot confirm this change against current project records.";

/**
 * Sanctioned meaning-preserving normalizations.
 * Anything else that collapses intent is lossy and must not be Ready.
 */
export const SANCTIONED_NORMALIZATIONS = [
  {
    domain: "todo",
    fromOp: "archive",
    write: "complete_todo",
    note: "To Do has no archive row state; archive is accepted as complete.",
  },
  {
    domain: "todo",
    fromOp: "remove",
    write: "delete_todo",
    note: "Remove and delete are the same To Do mutation.",
  },
  {
    domain: "todo",
    fromOp: "delete",
    write: "delete_todo",
    note: "Remove and delete are the same To Do mutation.",
  },
  {
    domain: "risk",
    fromOp: "complete",
    write: "update_risk_status",
    note: "Completing a Risk means status resolved.",
  },
] as const;

export { hasStructuredCessationSignal };

/**
 * Person domain has no field-level update and no cessation write.
 * Create is the only representable person mutation.
 */
export function isSemanticallyRepresentableSuggestion(
  item: PendingSuggestion,
): boolean {
  const domain = classifyCaptureLegalDomain(item);
  if (domain === "person" && item.op !== "create") {
    return false;
  }
  return true;
}

export function writeRepresentsProposal(
  item: PendingSuggestion,
  decision: CaptureApplyDecision,
): boolean {
  if (decision.kind !== "write") return false;
  const domain = classifyCaptureLegalDomain(item);
  const writeType = decision.operation.type;

  if (domain === "person") {
    if (item.op !== "create") return false;
    return writeType === "ensure_person";
  }

  const sanctioned = SANCTIONED_NORMALIZATIONS.some(
    (row) =>
      row.domain === domain &&
      row.fromOp === item.op &&
      row.write === writeType,
  );
  if (sanctioned) return true;

  return operationMatchesOp(item.op, decision.operation);
}

function operationMatchesOp(
  op: PendingSuggestion["op"],
  operation: CaptureLegalOperation,
): boolean {
  switch (op) {
    case "create":
      return (
        operation.type === "create_todo" ||
        operation.type === "create_risk" ||
        operation.type === "create_milestone" ||
        operation.type === "ensure_person" ||
        operation.type === "confirm_responsibility" ||
        operation.type === "write_availability" ||
        operation.type === "write_knowledge" ||
        operation.type === "write_memory"
      );
    case "update":
      return (
        operation.type === "update_todo" ||
        operation.type === "update_risk_status" ||
        operation.type === "update_milestone" ||
        operation.type === "confirm_responsibility" ||
        operation.type === "write_availability" ||
        operation.type === "write_knowledge" ||
        operation.type === "write_memory"
      );
    case "complete":
      return (
        operation.type === "complete_todo" ||
        operation.type === "update_risk_status"
      );
    case "archive":
      return operation.type === "complete_todo";
    case "delete":
    case "remove":
      return operation.type === "delete_todo";
  }
}

function missingDateFromReason(
  item: PendingSuggestion,
  reason: string,
): "date" | undefined {
  const domain = classifyCaptureLegalDomain(item);
  if (domain !== "milestone" && item.kind !== "milestone") return undefined;
  if (/date/i.test(reason) && /missing|not specific|cannot be saved/i.test(reason)) {
    return "date";
  }
  return undefined;
}

/**
 * Shared preflight. Pure. Safe to call from Review.
 * Without a world snapshot, nothing can be approved — instance
 * executability cannot be proven.
 */
export function assessApplyReadiness(input: {
  item: PendingSuggestion;
  text: string;
  preflight?: ReviewPreflightContext | null;
}): ApplyReadinessVerdict {
  const { item, text, preflight } = input;
  const representable = isSemanticallyRepresentableSuggestion(item);
  const staticallyLegal = isApplyExecutableSuggestion(item);
  const executableApply = staticallyLegal && representable;

  if (!executableApply) {
    return {
      executableApply: false,
      canApprove: false,
      unrepresentable: !representable,
      reason: unsupportedApplyReason(item, item.content),
    };
  }

  if (!preflight?.world) {
    return {
      executableApply: true,
      canApprove: false,
      reason: NO_WORLD_REASON,
    };
  }

  const expected =
    item.expectedTarget ?? fingerprintExpectedTarget(preflight.world, item);
  const projectId =
    item.projectId?.trim() || preflight.captureEntryProjectId?.trim() || "";
  if (expected && projectId) {
    const stale = staleExpectedTargetReason(
      preflight.world,
      expected,
      projectId,
    );
    if (stale) {
      return {
        executableApply: true,
        canApprove: false,
        stale: true,
        reason: stale,
      };
    }
  }

  const decision = planCaptureApply({
    item,
    text,
    world: preflight.world,
    captureEntryProjectId: preflight.captureEntryProjectId,
  });

  if (decision.kind !== "write") {
    return {
      executableApply: true,
      canApprove: false,
      plannerKind: decision.kind,
      reason: decision.reason,
      missingRequiredField: missingDateFromReason(item, decision.reason),
    };
  }

  if (!writeRepresentsProposal(item, decision)) {
    return {
      executableApply: false,
      canApprove: false,
      plannerKind: "write",
      unrepresentable: true,
      reason: unsupportedApplyReason(item, item.content),
    };
  }

  return {
    executableApply: true,
    canApprove: true,
    plannerKind: "write",
  };
}

export function attachReviewExpectedTarget(
  item: PendingSuggestion,
  world?: CaptureApplyWorld | null,
): PendingSuggestion {
  if (item.expectedTarget || !world) return item;
  const expected = fingerprintExpectedTarget(world, item);
  if (!expected) return item;
  return { ...item, expectedTarget: expected };
}
