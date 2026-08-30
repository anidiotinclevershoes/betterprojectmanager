/**
 * Capture V2 Apply against freshly loaded durable truth.
 * Phase 3B planCaptureApply / executeCaptureApply remain the mutation boundary.
 *
 * Never fingerprints expected state from the fresh Apply world — that would
 * hide concurrent edits. Expected target comes from Analyse-time Review.
 */
import type { LoadedWorkspace } from "@/lib/data/supabase/load-mission-state";
import type { PendingSuggestion } from "@/lib/capture/suggestions";
import type { HistoryEvent, MissionState } from "@/lib/types";
import { makeHistoryEvent, pushHistory } from "@/lib/workspace/history";
import { planCaptureApply } from "./dispatch";
import {
  executeCaptureApply,
  type CaptureApplyHooks,
  type CaptureExecuteResult,
} from "./execute";
import { historyInputFromCaptureOperation } from "./history-evidence";
import type { CaptureApplyDecision } from "./types";
import {
  staleExpectedTargetReason,
  type CaptureExpectedTarget,
} from "./expected-target";
import { loadServerCaptureWorld } from "@/lib/capture-v2/server-truth";
import { memoryCaptureApplyHooks } from "./memory-execute";

export type ApplyApprovedCaptureResult = {
  decision: CaptureApplyDecision;
  executed: CaptureExecuteResult;
  state: MissionState;
};

function needsYouDecision(
  domain: CaptureApplyDecision["domain"],
  reason: string,
): {
  decision: CaptureApplyDecision;
  executed: CaptureExecuteResult;
} {
  return {
    decision: { kind: "needs_you", domain, reason },
    executed: { kind: "needs_you", reason, domain },
  };
}

export async function applyApprovedCaptureSuggestion(args: {
  item: PendingSuggestion;
  text: string;
  projectId: string;
  expectedTarget?: CaptureExpectedTarget | null;
  loadWorkspace?: () => Promise<LoadedWorkspace>;
  hooks?: CaptureApplyHooks;
  /**
   * Durable History evidence. Called only after the authoritative write
   * succeeded. Failure here must not roll back that write.
   */
  recordHistory?: (
    event: Omit<HistoryEvent, "id" | "createdAt">,
  ) => Promise<void>;
  /** After a durable persist execute, reload the full workspace. */
  reloadWorkspace?: () => Promise<MissionState>;
}): Promise<ApplyApprovedCaptureResult> {
  const loaded = await loadServerCaptureWorld({
    projectId: args.projectId,
    loadWorkspace: args.loadWorkspace,
  });

  const expected = args.expectedTarget ?? args.item.expectedTarget ?? null;
  const domain = args.item.legalDomain ?? "unsupported";

  if (
    expected?.id &&
    args.item.targetEntityId &&
    args.item.targetEntityId.trim() !== expected.id
  ) {
    const blocked = needsYouDecision(
      domain,
      "Review target does not match. Capture again before applying.",
    );
    return { ...blocked, state: loaded.workspaceState };
  }

  const stale = staleExpectedTargetReason(
    loaded.world,
    expected,
    loaded.projectId,
  );
  if (stale) {
    const blocked = needsYouDecision(domain, stale);
    return { ...blocked, state: loaded.workspaceState };
  }

  const decision = planCaptureApply({
    item: args.item,
    text: args.text,
    world: loaded.world,
    captureEntryProjectId: loaded.projectId,
  });

  const box = { state: structuredClone(loaded.workspaceState) };
  const hooks = args.hooks ?? memoryCaptureApplyHooks(box);

  const replayId =
    decision.kind === "write" && "applyOperationId" in decision.operation
      ? decision.operation.applyOperationId
      : undefined;
  if (replayId && hooks.findApplyReceipt && decision.kind === "write") {
    const existing = await hooks.findApplyReceipt({
      projectId: decision.operation.projectId,
      operationId: replayId,
    });
    if (existing) {
      return {
        decision: {
          kind: "no_change",
          domain: decision.domain,
          reason: "This approved create was already applied.",
        },
        executed: {
          kind: "no_change",
          domain: decision.domain,
          reason: "This approved create was already applied.",
        },
        state: loaded.workspaceState,
      };
    }
  }

  const executed = await executeCaptureApply(decision, hooks);

  if (executed.kind === "wrote" && decision.kind === "write") {
    const historyInput = historyInputFromCaptureOperation({
      operation: decision.operation,
      evidence: args.text,
    });
    if (!args.hooks) {
      box.state = pushHistory(box.state, makeHistoryEvent(historyInput));
    }
    if (args.recordHistory) {
      try {
        await args.recordHistory(historyInput);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          "[applyApprovedCaptureSuggestion] history evidence skipped",
          message,
        );
      }
    }
  }

  let state = args.hooks ? loaded.workspaceState : box.state;
  if (executed.kind === "wrote" && args.reloadWorkspace) {
    try {
      state = await args.reloadWorkspace();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        "[applyApprovedCaptureSuggestion] reload after write skipped",
        message,
      );
    }
  }

  return {
    decision,
    executed,
    state,
  };
}
