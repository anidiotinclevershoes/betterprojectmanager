/**
 * Capture V2 Apply against freshly loaded durable truth.
 * Phase 3B planCaptureApply / executeCaptureApply remain the mutation boundary.
 *
 * Never fingerprints expected state from the fresh Apply world — that would
 * hide concurrent edits. Expected target comes from Analyse-time Review.
 */
import type { LoadedWorkspace } from "@/lib/data/supabase/load-mission-state";
import type { PendingSuggestion } from "@/lib/capture/suggestions";
import type { MissionState } from "@/lib/types";
import { planCaptureApply } from "./dispatch";
import {
  executeCaptureApply,
  type CaptureApplyHooks,
  type CaptureExecuteResult,
} from "./execute";
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
  const executed = await executeCaptureApply(decision, hooks);

  let state = args.hooks ? loaded.workspaceState : box.state;
  if (executed.kind === "wrote" && args.reloadWorkspace) {
    state = await args.reloadWorkspace();
  }

  return {
    decision,
    executed,
    state,
  };
}
