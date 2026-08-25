/**
 * Phase 3B — verified project scope for Capture writes.
 *
 * Selected-project context is allowed when the user entered Capture from A
 * and the finding does not conflict. Unresolved / conflicting identity
 * must not silently fall through to whichever project happens to be open.
 */

import type { PendingSuggestion } from "@/lib/capture/suggestions";

export type ProjectScopeResult =
  | { ok: true; projectId: string }
  | { ok: false; reason: string };

function isPresentId(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Resolve the single project a finding may write to.
 *
 * Never uses `finding.projectId ?? openProject ?? currentProject` as a chain.
 */
export function resolveCaptureProjectScope(args: {
  item: PendingSuggestion;
  captureEntryProjectId?: string | null;
  workspaceProjectIds: Set<string>;
}): ProjectScopeResult {
  const { item, captureEntryProjectId, workspaceProjectIds } = args;

  if (item.projectUncertain) {
    return {
      ok: false,
      reason: "Project is unresolved — choose a project before applying this change.",
    };
  }

  const candidates = item.projectCandidates ?? [];
  if (candidates.length > 1 && !isPresentId(item.projectId)) {
    return {
      ok: false,
      reason: "This finding refers to more than one project. Choose which project to update.",
    };
  }

  if (isPresentId(item.projectId)) {
    if (!workspaceProjectIds.has(item.projectId)) {
      return {
        ok: false,
        reason: "This finding's project is not in the current workspace.",
      };
    }
    if (
      isPresentId(captureEntryProjectId) &&
      item.projectId !== captureEntryProjectId &&
      candidates.some((c) => c.id === captureEntryProjectId)
    ) {
      return {
        ok: false,
        reason: "This finding names a different project than the one Capture was opened from.",
      };
    }
    return { ok: true, projectId: item.projectId };
  }

  // No finding-level project: Capture entry context is legitimate when there
  // is no conflicting evidence (no candidate list, not marked uncertain).
  if (candidates.length > 0) {
    return {
      ok: false,
      reason: "Project identity is not established for this finding.",
    };
  }

  if (
    isPresentId(captureEntryProjectId) &&
    workspaceProjectIds.has(captureEntryProjectId)
  ) {
    return { ok: true, projectId: captureEntryProjectId };
  }

  return {
    ok: false,
    reason: "Choose a project before applying this change.",
  };
}
