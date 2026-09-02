/**
 * Bulk Apply Ready queue. One item needing Confirm Owner must not
 * skip later Ready items.
 */
import type { CaptureApplyDecision, CaptureConfirmOwnerRequest } from "@/lib/capture/apply/types";
import type { PendingSuggestion } from "@/lib/capture/suggestions";
import type { ReviewChangeViewModel } from "./viewModel";

export type ApplyReadyOwnerPrompt = CaptureConfirmOwnerRequest & {
  suggestionId: string;
};

export async function applyPendingReadyQueue(args: {
  models: ReviewChangeViewModel[];
  applyOne: (item: PendingSuggestion) => Promise<CaptureApplyDecision>;
}): Promise<{ confirmOwner: ApplyReadyOwnerPrompt | null }> {
  let confirmOwner: ApplyReadyOwnerPrompt | null = null;
  for (const model of args.models) {
    if (model.canApprove === false || model.executableApply === false) {
      continue;
    }
    const decision = await args.applyOne(model.suggestion);
    if (decision.kind === "needs_you" && decision.confirmOwner && !confirmOwner) {
      confirmOwner = {
        suggestionId: model.id,
        ...decision.confirmOwner,
      };
    }
  }
  return { confirmOwner };
}
