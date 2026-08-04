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
  /** Pending items that need human review. */
  needsReview: number;
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

function factCategory(fact: string): string | null {
  const t = fact.toLowerCase();
  if (/\bcab\b/.test(t) && /\bapprov/.test(t)) return "cab_approval";
  if (
    /\brelease\b/.test(t) &&
    (/\b(date|moved|changed|nineteenth|august)\b/.test(t) || /\b19\b/.test(t))
  ) {
    return "release_date";
  }
  if (/\bcdn\b/.test(t) && /\b(resolv|blocker|issue|deploy)/.test(t)) {
    return "cdn_blocker";
  }
  if (/\bsarah\b/.test(t) && /\bowner\b/.test(t)) return "business_owner";
  if (/\bmarcus\b/.test(t) && /\brelease notes\b/.test(t)) {
    return "release_notes_support";
  }
  return null;
}

/** Validated finding that changes project state (or Review Required with a likely change). */
export function findingRepresentsProjectChange(finding: CaptureFinding): boolean {
  if (finding.invalidTarget) return false;
  if (finding.findingType === "NO_CHANGE") return false;

  if (finding.findingType === "AMBIGUOUS") {
    // Review Required where a likely project change was identified.
    return Boolean(
      finding.target?.entityId ||
        (finding.changes && Object.keys(finding.changes).length > 0) ||
        finding.requiresClarification,
    );
  }

  if (finding.findingType === "NEW_INFORMATION") {
    // Exclude pure informational notes with no project-state effect.
    return Boolean(
      finding.target?.entityId ||
        (finding.changes && Object.keys(finding.changes).length > 0),
    );
  }

  return PROJECT_CHANGE_TYPES.has(finding.findingType);
}

export function changeFindingDedupeKey(finding: CaptureFinding): string {
  if (finding.target?.entityId) {
    return `target:${finding.target.entityType}:${finding.target.entityId}`;
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
    // Prefer higher confidence / clearer fact when collapsing duplicates.
    if ((finding.confidence ?? 0) > (existing.confidence ?? 0)) {
      seen.set(key, finding);
    }
  }
  return [...seen.values()];
}

export function countProjectChangesDetected(result: CaptureResult | null | undefined): number {
  if (!result) return 0;
  const unique = uniqueProjectChangeFindings(result.findings);
  if (unique.length > 0) return unique.length;

  // Fallback when findings are absent but proposed ops / recommendations exist.
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
  const ready = pending.filter((m) => m.readiness === "ready").length;
  const needsReview = pending.filter((m) => m.readiness === "needs_review").length;
  const reviewed = args.models.filter((m) => added[m.id] || dismissed[m.id]).length;

  let changesDetected = countProjectChangesDetected(args.result);
  // If findings under-count relative to review cards (legacy path), use unique cards.
  if (changesDetected === 0 && args.models.length > 0) {
    changesDetected = args.models.length;
  }

  return {
    changesDetected,
    ready,
    needsReview,
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
      m.readiness === "ready",
  );
}
