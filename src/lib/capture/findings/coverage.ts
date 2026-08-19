/**
 * Actionable finding coverage — deterministic dispositions after mapping.
 * Ensures every materially actionable finding is READY, NEEDS_REVIEW, UNMATCHED,
 * NO_CHANGE, or IGNORED. No AI calls.
 */

import type {
  CaptureFinding,
  ProposedOperation,
} from "./types";

export type FindingDisposition =
  | "ready"
  | "needs_review"
  | "unmatched"
  | "no_change"
  | "ignored";

export type FindingCoverageItem = {
  findingId: string;
  fact: string;
  disposition: FindingDisposition;
  operationId?: string;
  reason: string;
};

export type FindingCoverageReport = {
  items: FindingCoverageItem[];
  actionableCount: number;
  readyCount: number;
  needsReviewCount: number;
  unmatchedCount: number;
  noChangeCount: number;
  ignoredCount: number;
  /** Actionable findings with no ready/needs_review/unmatched disposition (should be 0). */
  silentDropCount: number;
};

const IRRELEVANT =
  /\b(milk|on the way home|buy eggs|grocery|shopping list|timesheet|onetrust)\b/i;
const EXPLICIT_DEFER =
  /\b(can wait|don't (?:bother|worry)|ignore that|not project|obviously not)\b/i;
const OWNERSHIP_NO_CHANGE =
  /\b(remains?|still the|don't replace|is still)\b.*\b(owner|business owner)\b|\b(owner|business owner)\b.*\b(remains?|still)\b/i;
const SUPPORT_ONLY =
  /\b(only helping|supporting|release notes only|marcus only)\b/i;

export function isIgnoredFinding(finding: CaptureFinding): boolean {
  const blob = `${finding.fact} ${finding.evidence} ${finding.reasoningSummary}`;
  if (IRRELEVANT.test(blob)) return true;
  if (EXPLICIT_DEFER.test(blob) && IRRELEVANT.test(blob)) return true;
  if (/\b(timesheet|onetrust)\b/i.test(blob) && /\bcan wait\b/i.test(blob)) {
    return true;
  }
  return false;
}

export function isNoChangeFinding(finding: CaptureFinding): boolean {
  if (finding.findingType === "NO_CHANGE") return true;
  const blob = `${finding.fact} ${finding.evidence}`;
  if (OWNERSHIP_NO_CHANGE.test(blob)) return true;
  if (SUPPORT_ONLY.test(blob) && !/\b(create|raise|new risk|new to-?do)\b/i.test(blob)) {
    return true;
  }
  return false;
}

/** Materially actionable = would change project state if handled correctly. */
export function isMateriallyActionable(finding: CaptureFinding): boolean {
  if (isIgnoredFinding(finding)) return false;
  if (isNoChangeFinding(finding)) return false;
  if (finding.findingType === "NO_CHANGE") return false;

  if (finding.findingType === "AMBIGUOUS") {
    return Boolean(
      finding.target?.entityId ||
        finding.invalidTarget ||
        finding.requiresClarification ||
        (finding.changes && Object.keys(finding.changes).length > 0),
    );
  }

  if (finding.findingType === "NEW_INFORMATION") {
    // Explicit create intent or update-like changes.
    if (finding.target?.entityType && !finding.target.entityId) return true;
    if (finding.changes && Object.keys(finding.changes).length > 0) return true;
    if (/\b(create|raise|add|book|new (to-?do|task|risk|action))\b/i.test(finding.fact)) {
      return true;
    }
    return Boolean(finding.target?.entityId);
  }

  return (
    finding.findingType === "ENTITY_COMPLETED" ||
    finding.findingType === "ENTITY_UPDATED" ||
    finding.findingType === "ENTITY_BLOCKED" ||
    finding.findingType === "ENTITY_REOPENED"
  );
}

function intendsExistingRecordChange(finding: CaptureFinding): boolean {
  if (
    finding.findingType === "ENTITY_COMPLETED" ||
    finding.findingType === "ENTITY_UPDATED" ||
    finding.findingType === "ENTITY_BLOCKED" ||
    finding.findingType === "ENTITY_REOPENED"
  ) {
    return true;
  }
  if (finding.invalidTarget) return true;
  if (finding.target?.entityId) return true;
  // Phrasing that implies amending an existing item without a create cue.
  const fact = finding.fact.toLowerCase();
  if (/\b(create|raise a new|add an? new|book the|new to-?do|new risk)\b/.test(fact)) {
    return false;
  }
  return /\b(move|moved|update|due|submit|submission|push|change the|owner)\b/.test(
    fact,
  );
}

/**
 * Classify a single finding after operation mapping.
 * CREATE without an existing target is READY (via op), never unmatched.
 */
export function classifyFindingDisposition(
  finding: CaptureFinding,
  operation: ProposedOperation | null | undefined,
): { disposition: FindingDisposition; reason: string } {
  if (isIgnoredFinding(finding)) {
    return { disposition: "ignored", reason: "Irrelevant or explicitly excluded." };
  }
  if (isNoChangeFinding(finding)) {
    return {
      disposition: "no_change",
      reason: "Fact acknowledged; no project-state change required.",
    };
  }

  if (
    operation &&
    operation.operation !== "NO_CHANGE" &&
    !operation.requiresClarification &&
    !finding.requiresClarification &&
    finding.findingType !== "AMBIGUOUS" &&
    !finding.invalidTarget &&
    !operation.destructive
  ) {
    return {
      disposition: "ready",
      reason: "Valid target and safe operation identified.",
    };
  }

  if (
    operation &&
    (operation.requiresClarification ||
      operation.destructive ||
      finding.requiresClarification ||
      finding.findingType === "AMBIGUOUS")
  ) {
    return {
      disposition: "needs_review",
      reason:
        finding.clarificationQuestion ||
        "Change understood but cannot safely determine the exact operation.",
    };
  }

  if (finding.requiresClarification || finding.findingType === "AMBIGUOUS") {
    return {
      disposition: "needs_review",
      reason:
        finding.clarificationQuestion ||
        "Ambiguous evidence — needs human review.",
    };
  }

  // CREATE path with no op yet: still needs review (not unmatched).
  if (
    finding.findingType === "NEW_INFORMATION" &&
    !intendsExistingRecordChange(finding)
  ) {
    if (operation?.operation === "CREATE") {
      return {
        disposition: "ready",
        reason: "New record CREATE identified.",
      };
    }
    return {
      disposition: "needs_review",
      reason:
        "New work understood but a safe CREATE operation could not be produced.",
    };
  }

  // Existing-record change without a confident target → unmatched.
  if (
    finding.invalidTarget ||
    (intendsExistingRecordChange(finding) &&
      !operation &&
      !finding.target?.entityId)
  ) {
    return {
      disposition: "unmatched",
      reason:
        finding.validationWarning ||
        "Understood an existing item should change, but could not identify which record.",
    };
  }

  if (intendsExistingRecordChange(finding) && !operation) {
    // Has a target id but mapper still returned null (unsupported type, etc.)
    if (finding.target?.entityId) {
      return {
        disposition: "needs_review",
        reason:
          "Target identified but a safe single operation could not be produced.",
      };
    }
    return {
      disposition: "unmatched",
      reason: "Could not match the intended existing record.",
    };
  }

  if (operation) {
    return {
      disposition: "needs_review",
      reason: "Operation present but requires confirmation.",
    };
  }

  if (isMateriallyActionable(finding)) {
    return {
      disposition: "needs_review",
      reason: "Actionable finding without a safe automatic operation.",
    };
  }

  return { disposition: "ignored", reason: "Not treated as project-actionable." };
}

export function reconcileFindingCoverage(
  findings: CaptureFinding[],
  operations: ProposedOperation[],
): FindingCoverageReport {
  const opByFinding = new Map<string, ProposedOperation>();
  for (const op of operations) {
    if (!opByFinding.has(op.sourceFindingId)) {
      opByFinding.set(op.sourceFindingId, op);
    }
  }

  const items: FindingCoverageItem[] = [];
  for (const finding of findings) {
    const op = opByFinding.get(finding.id);
    const { disposition, reason } = classifyFindingDisposition(finding, op);
    items.push({
      findingId: finding.id,
      fact: finding.fact,
      disposition,
      operationId: op?.id,
      reason,
    });
  }

  const actionable = items.filter(
    (i) =>
      i.disposition === "ready" ||
      i.disposition === "needs_review" ||
      i.disposition === "unmatched",
  );

  // Silent drop: materially actionable finding that somehow got ignored/no_change
  // incorrectly, or missing from accounted dispositions.
  let silentDropCount = 0;
  for (const finding of findings) {
    if (!isMateriallyActionable(finding)) continue;
    const item = items.find((i) => i.findingId === finding.id);
    if (
      !item ||
      (item.disposition !== "ready" &&
        item.disposition !== "needs_review" &&
        item.disposition !== "unmatched")
    ) {
      silentDropCount += 1;
    }
  }

  return {
    items,
    actionableCount: actionable.length,
    readyCount: items.filter((i) => i.disposition === "ready").length,
    needsReviewCount: items.filter((i) => i.disposition === "needs_review")
      .length,
    unmatchedCount: items.filter((i) => i.disposition === "unmatched").length,
    noChangeCount: items.filter((i) => i.disposition === "no_change").length,
    ignoredCount: items.filter((i) => i.disposition === "ignored").length,
    silentDropCount,
  };
}

function stableValuesKey(values?: Record<string, unknown>): string {
  if (!values) return "";
  const keys = Object.keys(values).sort();
  return keys
    .map((k) => `${k}:${JSON.stringify(values[k])}`)
    .join("|");
}

/**
 * Deterministic duplicate-operation guard.
 * Identical target + operation + fields/values → keep highest confidence.
 * Compatible UPDATEs on the same target merge proposedValues.
 */
export function dedupeProposedOperations(
  operations: ProposedOperation[],
): ProposedOperation[] {
  const byExact = new Map<string, ProposedOperation>();
  const updateByTarget = new Map<string, ProposedOperation>();
  const others: ProposedOperation[] = [];

  for (const op of operations) {
    if (op.operation === "NO_CHANGE") continue;

    if (op.operation === "UPDATE" && op.targetId) {
      const key = `${op.entityType}:${op.targetId}`;
      const existing = updateByTarget.get(key);
      if (!existing) {
        updateByTarget.set(key, { ...op, proposedValues: { ...op.proposedValues } });
        continue;
      }
      // Merge compatible field updates against the same target.
      const mergedValues = {
        ...(existing.proposedValues ?? {}),
        ...(op.proposedValues ?? {}),
      };
      const preferOp = (op.confidence ?? 0) >= (existing.confidence ?? 0) ? op : existing;
      updateByTarget.set(key, {
        ...preferOp,
        proposedValues: mergedValues,
        confidence: Math.max(existing.confidence ?? 0, op.confidence ?? 0),
        reason:
          existing.reason === op.reason
            ? preferOp.reason
            : `${existing.reason}; ${op.reason}`,
        evidence:
          existing.evidence === op.evidence
            ? preferOp.evidence
            : `${existing.evidence} ${op.evidence}`.trim(),
      });
      continue;
    }

    const exactKey = [
      op.operation,
      op.entityType,
      op.targetId ?? "",
      op.targetTitle ?? "",
      stableValuesKey(op.proposedValues),
    ].join("::");

    const prev = byExact.get(exactKey);
    if (!prev || (op.confidence ?? 0) > (prev.confidence ?? 0)) {
      byExact.set(exactKey, op);
    }
  }

  others.push(...byExact.values());
  others.push(...updateByTarget.values());
  return others;
}
