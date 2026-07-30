import type {
  CaptureResult,
  KnowledgeSectionId,
  Recommendation,
  RecommendationKind,
  RecommendationUrgency,
} from "@/lib/types";
import type { CaptureFinding, ProposedOperation } from "./types";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function kindForEntity(
  entityType: ProposedOperation["entityType"],
): RecommendationKind {
  switch (entityType) {
    case "risk":
      return "risk";
    case "meeting":
      return "meeting";
    case "stakeholder":
      return "stakeholder_update";
    case "release":
      return "release";
    case "knowledge":
      return "decision";
    default:
      return "leadership";
  }
}

function itemTypeFor(
  entityType: ProposedOperation["entityType"],
): NonNullable<Recommendation["itemType"]> {
  switch (entityType) {
    case "todo":
      return "action";
    case "risk":
      return "risk";
    case "knowledge":
      return "knowledge";
    case "stakeholder":
      return "stakeholder";
    case "meeting":
      return "meeting";
    case "milestone":
      return "milestone";
    case "nudge":
      return "nudge";
    default:
      return "knowledge";
  }
}

function opLower(
  op: ProposedOperation["operation"],
): NonNullable<Recommendation["operation"]> {
  switch (op) {
    case "CREATE":
      return "create";
    case "UPDATE":
      return "update";
    case "COMPLETE":
      return "complete";
    case "ARCHIVE":
      return "archive";
    case "DELETE":
      return "delete";
    default:
      return "update";
  }
}

/**
 * Convert deterministic proposed operations into CaptureResult recommendations
 * so the existing Capture review UI keeps working without a redesign.
 */
export function recommendationsFromOperations(
  operations: ProposedOperation[],
  projectId: string | undefined,
  memoryId: string,
): Recommendation[] {
  const now = new Date().toISOString();
  return operations
    .filter((op) => op.operation !== "NO_CHANGE")
    .map((op) => {
      const urgency: RecommendationUrgency =
        op.confidence >= 90 ? "now" : op.confidence >= 80 ? "today" : "this_week";
      const title =
        op.targetTitle ??
        (typeof op.proposedValues?.title === "string"
          ? op.proposedValues.title
          : op.reason.slice(0, 80));
      return {
        id: id("rec"),
        kind: kindForEntity(op.entityType),
        urgency,
        title,
        action: op.reason,
        why: op.evidence,
        leadershipImpact: "Act on validated Capture findings without inventing duplicate work.",
        projectId,
        relatedMemoryIds: [memoryId],
        createdAt: now,
        status: "active" as const,
        operation: opLower(op.operation),
        itemType: itemTypeFor(op.entityType),
        targetTitle: op.targetTitle,
        sourceFindingId: op.sourceFindingId,
        proposedOperationId: op.id,
        confidence: op.confidence,
      };
    });
}

/** Knowledge patch only for UPDATE knowledge ops (replace text), never for completed todos/risks. */
export function knowledgePatchFromOperations(
  operations: ProposedOperation[],
  findings: CaptureFinding[],
): Partial<Record<KnowledgeSectionId, string[]>> | undefined {
  const findingById = new Map(findings.map((f) => [f.id, f]));
  const now: string[] = [];
  const risks: string[] = [];

  for (const op of operations) {
    if (op.operation !== "UPDATE") continue;
    if (op.entityType !== "knowledge" && op.entityType !== "risk") continue;
    const finding = findingById.get(op.sourceFindingId);
    const proposedText =
      (typeof op.proposedValues?.text === "string"
        ? op.proposedValues.text
        : null) ??
      (typeof finding?.changes?.text?.proposed === "string"
        ? String(finding.changes.text.proposed)
        : null);
    if (!proposedText) continue;
    if (op.entityType === "risk") risks.push(proposedText);
    else now.push(proposedText);
  }

  if (!now.length && !risks.length) return undefined;
  return {
    ...(now.length ? { now } : {}),
    ...(risks.length ? { risks } : {}),
  };
}

export function attachFindingsToResult(
  result: CaptureResult,
  findings: CaptureFinding[],
  operations: ProposedOperation[],
): CaptureResult {
  return {
    ...result,
    findings,
    proposedOperations: operations,
  };
}
