/**
 * Map a validated Project Change Form onto the existing CaptureResult.
 * Apply still plans from PendingSuggestion. This file does not write.
 */
import type { AIEntityType, AIOperation } from "@/ai/domain/types";
import {
  attachFindingsToResult,
  type CaptureFinding,
  type ProposedOperation,
} from "@/lib/capture/findings";
import type { CaptureLegalOperation } from "@/lib/capture/apply/types";
import type { CaptureResult } from "@/lib/types";
import type { ReviewedChange } from "./validate";

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function entityFor(domain: string): AIEntityType {
  if (domain === "todo") return "todo";
  if (domain === "risk") return "risk";
  if (domain === "milestone") return "milestone";
  if (domain === "person" || domain === "responsibility" || domain === "availability") {
    return "stakeholder";
  }
  return "knowledge";
}

function valuesFromOperation(
  operation: CaptureLegalOperation,
  evidence: string,
): Record<string, unknown> {
  const base: Record<string, unknown> = { evidence, truthIntent: "current" };
  switch (operation.type) {
    case "ensure_person":
      return {
        ...base,
        name: operation.name,
        personName: operation.name,
        ...(operation.roleHint ? { roleHint: operation.roleHint } : {}),
        title: operation.name,
      };
    case "confirm_responsibility":
      return {
        ...base,
        personName: operation.personName,
        ...(operation.personId ? { personId: operation.personId } : {}),
        scope: operation.scope,
        ownershipSemantics: operation.replacePersonId ? "replace" : "share",
        ...(operation.replacePersonId ? { replacePersonId: operation.replacePersonId } : {}),
        title: `${operation.personName} — ${operation.scope}`,
      };
    case "create_todo":
      return {
        ...base,
        title: operation.title,
        ...(operation.detail ? { detail: operation.detail } : {}),
        ...(operation.dueAt ? { date: operation.dueAt.slice(0, 10), dueAt: operation.dueAt } : {}),
        ...(operation.todoKind ? { todoKind: operation.todoKind } : {}),
        ...(operation.waitingOn ? { waitingOn: operation.waitingOn } : {}),
      };
    case "update_todo":
      return {
        ...base,
        title: operation.title,
        ...(operation.detail ? { detail: operation.detail } : {}),
        ...(operation.dueAt ? { date: operation.dueAt.slice(0, 10) } : {}),
      };
    case "complete_todo":
    case "delete_todo":
      return { ...base, title: evidence };
    case "create_risk":
      return { ...base, title: operation.title };
    case "update_risk_status":
      return { ...base, status: operation.status, title: evidence };
    case "create_milestone":
      return {
        ...base,
        label: operation.label,
        title: operation.label,
        date: (operation.startAt ?? "").slice(0, 10),
        startAt: operation.startAt,
      };
    case "update_milestone":
      return {
        ...base,
        ...(operation.label ? { label: operation.label, title: operation.label } : { title: evidence }),
        ...(operation.startAt
          ? { date: operation.startAt.slice(0, 10), startAt: operation.startAt }
          : {}),
      };
    case "write_availability":
      return {
        ...base,
        kind: "availability",
        personName: operation.personName,
        personId: operation.personId,
        awayFromIso: operation.awayFromIso.slice(0, 10),
        awayToIso: operation.awayToIso.slice(0, 10),
        date: operation.awayFromIso.slice(0, 10),
        title: operation.label || operation.personName,
      };
    case "write_knowledge":
      return {
        ...base,
        text: operation.text,
        title: operation.text,
        section: operation.section,
      };
    case "write_memory":
      return { ...base, text: operation.title, title: operation.title, section: "now" };
    default:
      return base;
  }
}

function operationCode(operation: CaptureLegalOperation): AIOperation {
  switch (operation.type) {
    case "complete_todo":
      return "COMPLETE";
    case "delete_todo":
      return "DELETE";
    case "create_todo":
    case "create_risk":
    case "create_milestone":
    case "ensure_person":
      return "CREATE";
    default:
      return "UPDATE";
  }
}

function targetIdFor(operation: CaptureLegalOperation): string | undefined {
  switch (operation.type) {
    case "update_todo":
    case "complete_todo":
    case "delete_todo":
      return operation.todoId;
    case "update_risk_status":
      return operation.riskId;
    case "update_milestone":
      return operation.milestoneId;
    case "confirm_responsibility":
      return operation.personId ?? undefined;
    case "write_availability":
      return operation.personId;
    default:
      return undefined;
  }
}

export function captureResultFromOrganisedChanges(args: {
  transcript: string;
  projectId?: string | null;
  projectName?: string | null;
  reviewed: ReviewedChange[];
}): CaptureResult {
  const findings: CaptureFinding[] = [];
  const operations: ProposedOperation[] = [];
  const projectId = args.projectId ?? undefined;
  let ready = 0;
  let needsYou = 0;
  let noChange = 0;
  let leftUntouched = 0;

  for (const change of args.reviewed) {
    const systemId = id("org");
    const findingId = `find-${systemId}`;
    const readyWrite = change.label === "Ready" && change.operation;
    const left = change.label === "Left untouched";
    const uncertain = change.label === "Needs You";
    const unchanged = change.label === "No change";
    if (readyWrite) ready += 1;
    else if (uncertain) needsYou += 1;
    else if (left) leftUntouched += 1;
    else noChange += 1;

    const proposedValues = readyWrite
      ? valuesFromOperation(change.operation!, change.evidence || args.transcript)
      : {
          evidence: change.evidence,
          title: change.statement || change.reason,
          truthIntent: uncertain ? "uncertain" : "non_current",
          ...(left
            ? {
                leftUntouched: true,
                leftUntouchedSource: "model",
                leftUntouchedReason: change.reason,
              }
            : {}),
        };
    const title =
      (typeof proposedValues.title === "string" && proposedValues.title) ||
      change.statement ||
      change.reason;
    const entityType = entityFor(change.domain);
    const boundId = change.operation ? targetIdFor(change.operation) : undefined;

    findings.push({
      id: findingId,
      fact: change.statement || change.reason,
      evidence: change.evidence,
      findingType: readyWrite ? "NEW_INFORMATION" : uncertain ? "AMBIGUOUS" : "NO_CHANGE",
      target: boundId
        ? { entityType, entityId: boundId, title }
        : readyWrite
          ? { entityType, title }
          : undefined,
      confidence: 0,
      requiresClarification: uncertain,
      clarificationQuestion: uncertain ? change.reason : undefined,
      reasoningSummary: change.reason || change.statement,
      leftUntouched: left || undefined,
      leftUntouchedReason: left ? change.reason : undefined,
      leftUntouchedSource: left ? "model" : undefined,
      projectId,
      projectName: args.projectName ?? undefined,
    });

    operations.push({
      id: `op-${systemId}`,
      sourceFindingId: findingId,
      operation: readyWrite ? operationCode(change.operation!) : "NO_CHANGE",
      entityType,
      targetId: readyWrite ? targetIdFor(change.operation!) : undefined,
      targetTitle: title,
      proposedValues,
      reason: change.reason || change.statement,
      evidence: change.evidence,
      confidence: 0,
      destructive: change.operation?.type === "delete_todo",
      requiresClarification: uncertain,
      projectId,
      projectName: args.projectName ?? undefined,
    });
  }

  const memoryId = id("mem");
  const now = new Date().toISOString();
  const base: CaptureResult = {
    memory: {
      id: memoryId,
      type: "conversation",
      projectId,
      title: args.transcript.trim().slice(0, 72) || "Capture",
      content: args.transcript,
      tags: [],
      people: [],
      occurredAt: now,
      createdAt: now,
      source: "capture",
    },
    insights: args.reviewed.map((row) => row.statement || row.reason),
    assumptions: [],
    recommendations: [],
    rawContent: args.transcript,
    tidied: true,
    provider: "openai",
    knowledgeProjectId: projectId,
    capturePipeline: "v2",
    observationAccount: {
      total: args.reviewed.length,
      proposedChanges: ready,
      alreadyKnown: noChange,
      merged: 0,
      needsYou,
      commentary: 0,
      rejected: 0,
      leftUntouched,
    },
  };
  return attachFindingsToResult(base, findings, operations);
}
