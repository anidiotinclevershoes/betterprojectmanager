/**
 * Adapt V2 resolved observations into the existing CaptureResult / Review shape.
 * Apply still goes through Phase 3B — this is presentation + suggestion wiring only.
 */

import type { AIEntityType, AIOperation } from "@/ai/domain/types";
import {
  attachFindingsToResult,
  knowledgePatchFromOperations,
  recommendationsFromOperations,
  type CaptureFinding,
  type ProposedOperation,
} from "@/lib/capture/findings";
import type { CaptureResult } from "@/lib/types";
import { accountObservations } from "./account";
import type { ResolvedObservation } from "./resolve";
import type { CaptureObservationV2, ObservationDomain } from "./types";

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DOMAIN_ENTITY: Record<ObservationDomain, AIEntityType> = {
  person: "stakeholder",
  responsibility: "stakeholder",
  availability: "stakeholder",
  risk: "risk",
  milestone: "milestone",
  todo: "todo",
  knowledge: "knowledge",
  decision: "knowledge",
  commentary: "knowledge",
  unknown: "knowledge",
};

export function captureResultFromResolved(args: {
  transcript: string;
  projectId?: string | null;
  projectName?: string | null;
  resolved: ResolvedObservation[];
  rejected?: CaptureObservationV2[];
}): CaptureResult {
  const findings: CaptureFinding[] = [];
  const operations: ProposedOperation[] = [];
  const projectId = args.projectId ?? undefined;

  const rows: Array<{
    observation: CaptureObservationV2;
    resolved?: ResolvedObservation;
    rejected?: boolean;
  }> = [
    ...args.resolved.map((resolved) => ({
      observation: resolved.observation,
      resolved,
    })),
    ...(args.rejected ?? []).map((observation) => ({
      observation,
      rejected: true as const,
    })),
  ];

  for (const row of rows) {
    const observation = row.observation;
    const decision = row.resolved?.decision;
    const findingId = `find-${observation.id}`;
    const entityType = DOMAIN_ENTITY[observation.domain];
    const title =
      observation.candidateTargetTitle ||
      String(observation.proposedValues?.name ?? observation.proposedValues?.title ?? "") ||
      observation.statement;
    const requiresClarification =
      Boolean(row.rejected) ||
      decision?.kind === "needs_you" ||
      observation.disposition === "ambiguous";
    const findingType = findingTypeFor(observation, decision?.kind, row.rejected);
    const proposedValues = {
      ...(observation.proposedValues ?? {}),
      ...(observation.domain === "availability"
        ? { kind: "availability" as const }
        : {}),
      ...(observation.domain === "person"
        ? {
            personName:
              observation.proposedValues?.name ?? observation.candidateTargetTitle,
            name: observation.proposedValues?.name ?? observation.candidateTargetTitle,
          }
        : {}),
    };

    findings.push({
      id: findingId,
      fact: observation.statement,
      evidence: observation.evidence,
      findingType,
      target: observation.candidateTargetId
        ? {
            entityType,
            entityId: observation.candidateTargetId,
            title,
          }
        : observation.disposition === "create_new"
          ? { entityType, title }
          : undefined,
      changes:
        observation.disposition === "create_new" ||
        observation.disposition === "update_existing"
          ? {
              value: { proposed: observation.statement },
            }
          : undefined,
      confidence: Math.round((observation.modelConfidence ?? 0) * 100) || 0,
      requiresClarification,
      clarificationQuestion: requiresClarification
        ? decision && "reason" in decision
          ? decision.reason
          : observation.commentary ?? "Lume needs you to confirm this."
        : undefined,
      reasoningSummary: observation.statement,
      invalidTarget: row.rejected === true,
      projectId,
      projectName: args.projectName ?? undefined,
    });

    const op = operationCode(observation, decision?.kind);
    operations.push({
      id: `v2op-${observation.id}`,
      sourceFindingId: findingId,
      operation: op,
      entityType,
      targetId: observation.candidateTargetId ?? undefined,
      targetTitle: title,
      proposedValues,
      reason:
        decision && "reason" in decision
          ? decision.reason
          : observation.statement,
      evidence: observation.evidence,
      confidence: Math.round((observation.modelConfidence ?? 0) * 100) || 0,
      destructive: false,
      requiresClarification,
      projectId,
      projectName: args.projectName ?? undefined,
    });
  }

  const memoryId = id("mem");
  const now = new Date().toISOString();
  const account = accountObservations({
    resolved: args.resolved,
    rejectedCount: args.rejected?.length ?? 0,
  });
  const recommendations = recommendationsFromOperations(
    operations,
    projectId,
    memoryId,
  );
  const knowledgePatch = knowledgePatchFromOperations(operations, findings);
  const title =
    args.transcript.trim().slice(0, 72) || "Capture";

  const base: CaptureResult = {
    memory: {
      id: memoryId,
      type: "conversation",
      projectId,
      title,
      content: args.transcript,
      tags: [],
      people: [],
      occurredAt: now,
      createdAt: now,
      source: "capture",
    },
    insights: args.resolved.map((row) => row.observation.statement),
    assumptions: [],
    recommendations,
    rawContent: args.transcript,
    tidied: true,
    provider: "openai",
    knowledgePatch,
    knowledgeProjectId: projectId,
    findingsValidation: {
      ok: (args.rejected?.length ?? 0) === 0,
      errors: [],
      warnings: args.rejected?.map((o) => o.statement) ?? [],
      invalidTargetCount: args.rejected?.length ?? 0,
    },
    capturePipeline: "v2",
    observationAccount: account,
  };

  return attachFindingsToResult(base, findings, operations);
}

function findingTypeFor(
  observation: CaptureObservationV2,
  decisionKind?: string,
  rejected?: boolean,
): CaptureFinding["findingType"] {
  if (rejected) return "AMBIGUOUS";
  if (decisionKind === "needs_you" || observation.disposition === "ambiguous") {
    return "AMBIGUOUS";
  }
  if (
    decisionKind === "no_change" ||
    observation.disposition === "no_change" ||
    observation.disposition === "commentary" ||
    observation.disposition === "ignore" ||
    observation.disposition === "merge" ||
    observation.domain === "commentary"
  ) {
    return "NO_CHANGE";
  }
  const status = String(
    observation.proposedValues?.status ?? "",
  ).toLowerCase();
  if (status === "resolved" || status === "complete" || status === "completed") {
    return "ENTITY_COMPLETED";
  }
  if (observation.disposition === "create_new") return "NEW_INFORMATION";
  return "ENTITY_UPDATED";
}

function operationCode(
  observation: CaptureObservationV2,
  decisionKind?: string,
): AIOperation {
  if (
    decisionKind === "no_change" ||
    observation.disposition === "no_change" ||
    observation.disposition === "commentary" ||
    observation.disposition === "ignore" ||
    observation.disposition === "merge" ||
    observation.domain === "commentary"
  ) {
    return "NO_CHANGE";
  }
  if (observation.disposition === "create_new") return "CREATE";
  const status = String(
    observation.proposedValues?.status ?? "",
  ).toLowerCase();
  if (status === "resolved" || status === "complete" || status === "completed") {
    return "COMPLETE";
  }
  return "UPDATE";
}
