/**
 * Bulk Apply Ready queue. One item needing Confirm Owner must not
 * skip later Ready items. Batch completion owns the final
 * authoritative reconciliation for the successful write set.
 */
import {
  confirmAuthoritativeWrites,
  type ConfirmAuthoritativeWritesResult,
} from "@/lib/capture/apply/apply-approved";
import type { CaptureApplyDecision, CaptureConfirmOwnerRequest, CaptureLegalOperation } from "@/lib/capture/apply/types";
import type { PendingSuggestion } from "@/lib/capture/suggestions";
import type { ReviewChangeViewModel } from "./viewModel";

export type ApplyReadyOwnerPrompt = CaptureConfirmOwnerRequest & {
  suggestionId: string;
};

export async function applyPendingReadyQueue(args: {
  models: ReviewChangeViewModel[];
  applyOne: (item: PendingSuggestion) => Promise<CaptureApplyDecision>;
  /**
   * After every approved item has been sent, prove the successful
   * writes on one authoritative reload. Omit for tests that only
   * exercise queue order / Confirm Owner.
   */
  confirmWrites?: (
    operations: CaptureLegalOperation[],
  ) => Promise<ConfirmAuthoritativeWritesResult>;
}): Promise<{
  confirmOwner: ApplyReadyOwnerPrompt | null;
  failures: string[];
  succeededWrites: CaptureLegalOperation[];
  reconcileFailed: boolean;
}> {
  let confirmOwner: ApplyReadyOwnerPrompt | null = null;
  const failures: string[] = [];
  const succeededWrites: CaptureLegalOperation[] = [];
  for (const model of args.models) {
    if (model.canApprove === false || model.executableApply === false) {
      continue;
    }
    const decision = await args.applyOne(model.suggestion);
    if (decision.kind === "write") {
      succeededWrites.push(decision.operation);
    }
    if (decision.kind === "needs_you" && decision.confirmOwner && !confirmOwner) {
      confirmOwner = {
        suggestionId: model.id,
        ...decision.confirmOwner,
      };
    } else if (decision.kind === "needs_you" && !decision.confirmOwner) {
      failures.push(decision.reason);
    }
  }

  let reconcileFailed = false;
  if (args.confirmWrites && succeededWrites.length > 0) {
    const confirmed = await args.confirmWrites(succeededWrites);
    reconcileFailed = confirmed.reconcileFailed === true;
  }

  return { confirmOwner, failures, succeededWrites, reconcileFailed };
}
