import type { AIEntityType } from "@/ai/domain/types";
import type {
  CaptureFinding,
  IndexedContextRecord,
  ProposedOperation,
} from "./types";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function isDestructive(
  operation: ProposedOperation["operation"],
): boolean {
  return operation === "DELETE" || operation === "ARCHIVE";
}

/**
 * Deterministic finding → operation mapping.
 * Pure and independently testable.
 *
 * Canonical resolved Risk action in Lume: COMPLETE
 * (recommendations use status "done" / operation "complete").
 */
export function mapFindingToOperation(
  finding: CaptureFinding,
  targetRecord?: IndexedContextRecord | null,
): ProposedOperation | null {
  if (finding.requiresClarification || finding.findingType === "AMBIGUOUS") {
    // Project-only uncertainty: still emit CREATE so review can show project chips.
    const projectUncertainCreate =
      Boolean(finding.projectCandidates?.length) &&
      !finding.projectId &&
      finding.findingType === "NEW_INFORMATION" &&
      Boolean(
        finding.target?.entityType ||
          finding.changes?.entityType?.proposed,
      );
    if (!projectUncertainCreate) {
      return null;
    }
  }
  if (finding.invalidTarget) {
    return null;
  }
  if (finding.findingType === "NO_CHANGE") {
    return null;
  }

  const entityType =
    finding.target?.entityType ?? targetRecord?.entityType ?? null;
  const targetId = finding.target?.entityId ?? targetRecord?.id;
  const targetTitle =
    finding.target?.title ?? targetRecord?.title ?? undefined;
  const projectFields = {
    projectId: finding.projectId,
    projectName: finding.projectName,
    projectCode: finding.projectCode,
  };

  if (finding.findingType === "ENTITY_COMPLETED" && entityType && targetId) {
    // Risks: COMPLETE is the canonical resolved lifecycle action.
    if (entityType === "todo" || entityType === "risk" || entityType === "nudge") {
      return {
        id: id("op"),
        sourceFindingId: finding.id,
        operation: "COMPLETE",
        entityType: entityType === "nudge" ? "todo" : entityType,
        targetId,
        targetTitle,
        ...projectFields,
        proposedValues:
          entityType === "todo" || entityType === "risk" || entityType === "nudge"
            ? { status: "COMPLETED" }
            : undefined,
        reason: finding.reasoningSummary,
        evidence: finding.evidence,
        confidence: finding.confidence,
        destructive: false,
        requiresClarification: false,
      };
    }
    // Meetings / milestones completed → COMPLETE
    if (entityType === "meeting" || entityType === "milestone") {
      return {
        id: id("op"),
        sourceFindingId: finding.id,
        operation: "COMPLETE",
        entityType,
        targetId,
        targetTitle,
        reason: finding.reasoningSummary,
        evidence: finding.evidence,
        confidence: finding.confidence,
        destructive: false,
        requiresClarification: false,
      };
    }
    return null;
  }

  if (finding.findingType === "ENTITY_UPDATED" && entityType && targetId) {
    const proposedValues: Record<string, unknown> = {};
    if (finding.changes) {
      for (const [key, change] of Object.entries(finding.changes)) {
        proposedValues[key] = change.proposed;
      }
    }
    return {
      id: id("op"),
      sourceFindingId: finding.id,
      operation: "UPDATE",
      entityType,
      targetId,
      targetTitle,
      proposedValues: Object.keys(proposedValues).length
        ? proposedValues
        : undefined,
      reason: finding.reasoningSummary,
      evidence: finding.evidence,
      confidence: finding.confidence,
      destructive: false,
      requiresClarification: false,
    };
  }

  if (finding.findingType === "ENTITY_BLOCKED" && entityType && targetId) {
    return {
      id: id("op"),
      sourceFindingId: finding.id,
      operation: "UPDATE",
      entityType,
      targetId,
      targetTitle,
      proposedValues: { status: "BLOCKED" },
      reason: finding.reasoningSummary,
      evidence: finding.evidence,
      confidence: finding.confidence,
      destructive: false,
      requiresClarification: false,
    };
  }

  if (finding.findingType === "ENTITY_REOPENED" && entityType && targetId) {
    return {
      id: id("op"),
      sourceFindingId: finding.id,
      operation: "UPDATE",
      entityType,
      targetId,
      targetTitle,
      proposedValues: { status: "OPEN" },
      reason: finding.reasoningSummary,
      evidence: finding.evidence,
      confidence: finding.confidence,
      destructive: false,
      requiresClarification: false,
    };
  }

  // NEW_INFORMATION — safer option: no automatic Knowledge CREATE.
  // Only emit CREATE when the finding explicitly names a supported entity type
  // in changes.entityType / target without id (rare). Prefer review-only.
  if (finding.findingType === "NEW_INFORMATION") {
    const explicitType = resolveExplicitCreateType(finding);
    if (!explicitType) {
      return null; // unmatched finding for user review — not an actionable op
    }
    // Still prefer not creating Knowledge for transient status updates
    if (explicitType === "knowledge" && looksTransientStatusUpdate(finding)) {
      return null;
    }
    const createTitle =
      (typeof finding.changes?.title?.proposed === "string"
        ? String(finding.changes.title.proposed)
        : null) ?? finding.fact.slice(0, 120);
    const todoKind =
      typeof finding.changes?.todoKind?.proposed === "string"
        ? String(finding.changes.todoKind.proposed)
        : undefined;
    const waitingOn =
      typeof finding.changes?.waitingOn?.proposed === "string"
        ? String(finding.changes.waitingOn.proposed)
        : undefined;
    return {
      id: id("op"),
      sourceFindingId: finding.id,
      operation: "CREATE",
      entityType: explicitType === "nudge" ? "todo" : explicitType,
      targetTitle: createTitle,
      projectId: finding.projectId,
      projectName: finding.projectName,
      projectCode: finding.projectCode,
      proposedValues: {
        title: createTitle,
        summary: finding.evidence,
        ...(todoKind ? { todoKind } : {}),
        ...(waitingOn ? { waitingOn } : {}),
        ...(finding.changes
          ? Object.fromEntries(
              Object.entries(finding.changes).map(([k, v]) => [k, v.proposed]),
            )
          : {}),
      },
      reason: finding.reasoningSummary,
      evidence: finding.evidence,
      confidence: finding.confidence,
      destructive: false,
      requiresClarification: Boolean(finding.projectCandidates?.length) && !finding.projectId,
    };
  }

  return null;
}

function resolveExplicitCreateType(
  finding: CaptureFinding,
): AIEntityType | null {
  if (finding.target?.entityType && !finding.target.entityId) {
    return finding.target.entityType === "nudge"
      ? "todo"
      : finding.target.entityType;
  }
  const proposed = finding.changes?.entityType?.proposed;
  if (typeof proposed === "string") {
    const t = proposed.toLowerCase();
    if (t === "todo" || t === "action" || t === "nudge") return "todo";
    if (t === "risk") return "risk";
    if (t === "meeting") return "meeting";
    if (t === "milestone") return "milestone";
    if (t === "stakeholder") return "stakeholder";
    if (t === "knowledge") return "knowledge";
  }
  return null;
}

function looksTransientStatusUpdate(finding: CaptureFinding): boolean {
  const blob = `${finding.fact} ${finding.evidence} ${finding.reasoningSummary}`.toLowerCase();
  return (
    /\b(completed|received|resolved|approved|done|finished|closed)\b/.test(
      blob,
    ) && /\b(todo|task|risk|approval|cab|cdn)\b/.test(blob)
  );
}

export function mapFindingsToOperations(
  findings: CaptureFinding[],
  contextIndex: Map<string, IndexedContextRecord>,
): ProposedOperation[] {
  const ops: ProposedOperation[] = [];
  for (const finding of findings) {
    const target = finding.target?.entityId
      ? contextIndex.get(finding.target.entityId) ?? null
      : null;
    const op = mapFindingToOperation(finding, target);
    if (op) ops.push(op);
  }
  return ops;
}

export { isDestructive };
