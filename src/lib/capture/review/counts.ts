/**
 * Shared review counters for Capture summary, badges, and bulk actions.
 * Presentation-layer only — does not alter findings or persistence.
 */

import type { CaptureResult } from "@/lib/types";
import type { CaptureFinding } from "@/lib/capture/findings";
import type { ReviewChangeViewModel } from "./viewModel";

export type ReviewCountSummary = {
  /** Unique validated findings that represent a project-state change. */
  changesDetected: number;
  /** Pending actionable ops that are ready to apply. */
  ready: number;
  /** Pending items that need human review (ambiguous / unsafe). */
  needsReview: number;
  /** Pending actionable findings that could not match a target. */
  unmatched: number;
  /** needsReview + unmatched — high-level attention count. */
  needsAttention: number;
  /** Cards already approved or dismissed. */
  reviewed: number;
  /** Total review cards (pending + reviewed). */
  total: number;
};

const PROJECT_CHANGE_TYPES = new Set([
  "ENTITY_COMPLETED",
  "ENTITY_UPDATED",
  "ENTITY_BLOCKED",
  "ENTITY_REOPENED",
  "NEW_INFORMATION",
]);

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function factCategory(_fact: string): string | null {
  return null;
}

/** Validated finding that changes project state (or Review Required with a likely change). */
export function findingRepresentsProjectChange(finding: CaptureFinding): boolean {
  if (finding.findingType === "NO_CHANGE") return false;

  // Invalid-target findings are still project changes — they surface as Unmatched.
  if (finding.invalidTarget) return true;

  if (finding.findingType === "AMBIGUOUS") {
    return Boolean(
      finding.target?.entityId ||
        (finding.changes && Object.keys(finding.changes).length > 0) ||
        finding.requiresClarification ||
        finding.invalidTarget,
    );
  }

  if (finding.findingType === "NEW_INFORMATION") {
    return Boolean(
      finding.target?.entityId ||
        (finding.changes && Object.keys(finding.changes).length > 0) ||
        /\b(create|raise|add|book|new (to-?do|task|risk|action))\b/i.test(
          finding.fact,
        ),
    );
  }

  return PROJECT_CHANGE_TYPES.has(finding.findingType);
}

export function changeFindingDedupeKey(finding: CaptureFinding): string {
  if (finding.target?.entityId) {
    const fields = finding.changes
      ? Object.keys(finding.changes).sort().join(",")
      : finding.findingType;
    return `target:${finding.target.entityType}:${finding.target.entityId}:${fields}`;
  }
  const category = factCategory(finding.fact);
  if (category) return `category:${category}`;
  return `fact:${normalizeKey(finding.fact)}`;
}

/** Unique validated project-change findings (duplicates collapsed). */
export function uniqueProjectChangeFindings(
  findings: CaptureFinding[] | undefined,
): CaptureFinding[] {
  if (!findings?.length) return [];
  const seen = new Map<string, CaptureFinding>();
  for (const finding of findings) {
    if (!findingRepresentsProjectChange(finding)) continue;
    const key = changeFindingDedupeKey(finding);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, finding);
      continue;
    }
    if ((finding.confidence ?? 0) > (existing.confidence ?? 0)) {
      seen.set(key, finding);
    } else if (
      (finding.confidence ?? 0) === (existing.confidence ?? 0) &&
      finding.fact.length > existing.fact.length
    ) {
      // Prefer the more informative phrasing when confidence ties.
      seen.set(key, finding);
    }
  }
  return [...seen.values()];
}

export function countProjectChangesDetected(result: CaptureResult | null | undefined): number {
  if (!result) return 0;

  // Prefer coverage actionable count when present (shared source of truth).
  if (result.findingCoverage) {
    return result.findingCoverage.actionableCount;
  }

  const unique = uniqueProjectChangeFindings(result.findings);
  if (unique.length > 0) return unique.length;

  const actionable = (result.proposedOperations ?? []).filter(
    (op) => op.operation !== "NO_CHANGE",
  );
  if (actionable.length > 0) {
    const keys = new Set(
      actionable.map(
        (op) =>
          op.targetId ??
          op.sourceFindingId ??
          `${op.operation}:${op.targetTitle ?? op.id}`,
      ),
    );
    return keys.size;
  }
  return 0;
}

export function computeReviewCounts(args: {
  result: CaptureResult | null | undefined;
  models: ReviewChangeViewModel[];
  added?: Record<string, boolean>;
  dismissed?: Record<string, boolean>;
}): ReviewCountSummary {
  const added = args.added ?? {};
  const dismissed = args.dismissed ?? {};
  const pending = args.models.filter((m) => !added[m.id] && !dismissed[m.id]);
  const ready = pending.filter(
    (m) =>
      m.readiness === "ready" &&
      m.executableApply !== false &&
      m.canApprove !== false,
  ).length;
  const needsReview = pending.filter((m) => m.readiness === "needs_review").length;
  const unmatched = pending.filter((m) => m.readiness === "unmatched").length;
  const reviewed = args.models.filter((m) => added[m.id] || dismissed[m.id]).length;

  let changesDetected = countProjectChangesDetected(args.result);
  if (changesDetected === 0 && args.models.length > 0) {
    changesDetected = args.models.length;
  }

  // Never imply "nothing to review" when unresolved actionable cards exist.
  const needsAttention = needsReview + unmatched;

  return {
    changesDetected,
    ready,
    needsReview,
    unmatched,
    needsAttention,
    reviewed,
    total: args.models.length,
  };
}

/** Pending ready models only — used by Apply Ready bulk action. */
export function pendingReadyModels(
  models: ReviewChangeViewModel[],
  added: Record<string, boolean>,
  dismissed: Record<string, boolean>,
): ReviewChangeViewModel[] {
  return models.filter(
    (m) =>
      !added[m.id] &&
      !dismissed[m.id] &&
      m.readiness === "ready" &&
      m.executableApply !== false &&
      m.canApprove !== false,
  );
}
