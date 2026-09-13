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
import type { CaptureApplyDecision, CaptureLegalOperation } from "./types";
import {
  expectedTargetMismatchReason,
  staleExpectedTargetReason,
  type CaptureExpectedTarget,
} from "./expected-target";
import { loadServerCaptureWorld } from "@/lib/capture-v2/server-truth";
import { memoryCaptureApplyHooks } from "./memory-execute";

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

export type ApplyApprovedCaptureResult = {
  decision: CaptureApplyDecision;
  executed: CaptureExecuteResult;
  /**
   * Authoritative workspace after a confirmed write + successful reload.
   * Absent when reload failed after commit — callers must not treat a
   * missing/pre-write snapshot as current truth.
   */
  state?: MissionState;
  /** Write committed; canonical reload did not. Do not adopt stale state. */
  reconcileFailed?: boolean;
};

/** Callers that need the returned workspace must prove it is present. */
export function requireAppliedState(
  result: ApplyApprovedCaptureResult,
): MissionState {
  if (!result.state) {
    throw new Error(
      result.reconcileFailed
        ? "Apply wrote but reload failed; no workspace state to adopt."
        : "Apply did not return workspace state.",
    );
  }
  return result.state;
}

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

  const mismatch = expectedTargetMismatchReason(args.item, expected);
  if (mismatch) {
    const blocked = needsYouDecision(domain, mismatch);
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

  if (executed.kind !== "wrote") {
    return {
      decision,
      executed,
      state: args.hooks ? loaded.workspaceState : box.state,
    };
  }

  if (args.reloadWorkspace) {
    try {
      let state = await args.reloadWorkspace();
      if (
        decision.kind === "write" &&
        !appliedStateContainsWrite(state, decision.operation)
      ) {
        state = await args.reloadWorkspace();
      }
      return {
        decision,
        executed,
        state,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        "[applyApprovedCaptureSuggestion] reload after write failed",
        message,
      );
      if (!args.hooks) {
        return { decision, executed, state: box.state };
      }
      return { decision, executed, reconcileFailed: true };
    }
  }

  return {
    decision,
    executed,
    state: args.hooks ? undefined : box.state,
  };
}
