/**
 * Gate 2 thin deterministic materialisation.
 *
 * One Astra envelope → existing planCaptureApply.
 * Does not parse English, infer IDs from titles, retry the model,
 * or rewrite unsupported ops into nearby supported ones.
 */
import {
  applySupportsOperation,
  isOwnershipSemantics,
  planCaptureApply,
  type CaptureApplyWorld,
  type CaptureLegalDomain,
  type CaptureLegalOperation,
} from "@/lib/capture/apply";
import type { PendingSuggestion, SuggestionKind, SuggestionOp } from "@/lib/capture/suggestions";
import type {
  Gate1V2Domain,
  Gate1V2Item,
  Gate1V2Operation,
} from "@/lib/experiments/ai-first-capture-gate1-v2/types";
import { knownCanonicalIds } from "@/lib/experiments/ai-first-capture-gate1-v2/snapshot";

export const GATE2_LEFT_UNTOUCHED = "Lume cannot safely apply this type of change.";
export const GATE2_UNKNOWN_ID = "The referenced record is not in current project truth.";
export const GATE2_WRONG_TYPE = "The referenced id is not that kind of record.";
export const GATE2_MISSING_FIELDS = "Required fields for this operation are missing.";
export const GATE2_MISSING_IDENTITY =
  "This change needs a proven existing record before Lume can apply it.";
export const GATE2_TARGET_MISMATCH =
  "The planner would write a different record than the one Astra named.";

export type Gate2Trace = {
  index: number;
  fromOperation: Gate1V2Operation;
  toOperation: Gate1V2Operation;
  reason: string | null;
  plannerKind: string | null;
  plannerWriteType: string | null;
  intercepted: boolean;
};

const WRITE_OPS = new Set<Gate1V2Operation>(["create", "update", "remove"]);

function mapDomain(domain: Gate1V2Domain): CaptureLegalDomain {
  if (domain === "decision") return "knowledge";
  if (domain === "unsupported") return "unsupported";
  return domain;
}

function asOp(operation: Gate1V2Operation): SuggestionOp | null {
  if (operation === "create" || operation === "update" || operation === "remove") {
    return operation;
  }
  return null;
}

function domainKind(domain: Gate1V2Domain): SuggestionKind {
  switch (domain) {
    case "person":
    case "responsibility":
      return "stakeholder";
    case "risk":
      return "risk";
    case "milestone":
      return "milestone";
    case "todo":
      return "action";
    case "availability":
      return "availability";
    case "knowledge":
      return "knowledge";
    case "decision":
      return "decision";
    default:
      return "meeting";
  }
}

export function typedIdKind(
  world: CaptureApplyWorld,
  projectId: string,
  id: string,
): Gate1V2Domain | null {
  const project = world.projects.find((p) => p.id === projectId);
  if (project?.stakeholders.some((p) => p.id === id)) return "person";
  if (world.risks.some((r) => r.projectId === projectId && r.id === id)) return "risk";
  if (world.todos.some((t) => t.projectId === projectId && t.id === id)) return "todo";
  if (world.timeline.some((t) => t.projectId === projectId && t.id === id)) return "milestone";
  for (const pack of world.knowledge) {
    if (pack.projectId !== projectId) continue;
    for (const item of pack.structured ?? []) {
      if (item.id !== id) continue;
      if (item.kind === "responsibility") return "responsibility";
      if (item.kind === "availability") return "availability";
      return "knowledge";
    }
  }
  return null;
}

function typeCompatible(domain: Gate1V2Domain, kind: Gate1V2Domain | null): boolean {
  if (!kind) return false;
  if (domain === kind) return true;
  if (domain === "decision" && kind === "knowledge") return true;
  if (domain === "responsibility" && (kind === "person" || kind === "responsibility")) return true;
  if (domain === "availability" && (kind === "person" || kind === "availability")) return true;
  return false;
}

function requiredCreateIdentity(item: Gate1V2Item): string | null {
  const v = item.proposedValues;
  switch (item.domain) {
    case "person":
      return v.name || v.personName;
    case "todo":
    case "risk":
      return v.title;
    case "milestone":
      return v.title || v.date;
    case "knowledge":
    case "decision":
      return v.text || item.subject;
    case "availability":
      return v.personName && v.awayFromIso ? v.personName : null;
    case "responsibility":
      return v.personName && v.scope ? v.personName : null;
    default:
      return null;
  }
}

function leftUntouched(item: Gate1V2Item, reason: string): Gate1V2Item {
  return {
    ...item,
    operation: "left_untouched",
    question: null,
    leftUntouchedReason: reason,
  };
}

function needsYou(item: Gate1V2Item, reason: string): Gate1V2Item {
  return {
    ...item,
    operation: "needs_you",
    question: reason,
    leftUntouchedReason: null,
  };
}

function operationId(op: CaptureLegalOperation): string | null {
  const row = op as Record<string, unknown>;
  for (const key of ["todoId", "riskId", "milestoneId", "personId", "itemId", "knowledgeId"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function writeDisposition(opType: string, proposed: Gate1V2Operation): Gate1V2Operation {
  if (opType.startsWith("create_") || opType === "ensure_person") return "create";
  if (opType.startsWith("delete_") || opType === "remove") return "remove";
  if (opType.startsWith("update_")) return "update";
  // write_knowledge / confirm_responsibility: keep the named op the planner accepted.
  return proposed;
}

export function suggestionFromItem(
  item: Gate1V2Item,
  index: number,
  projectId: string,
): PendingSuggestion | null {
  const op = asOp(item.operation);
  if (!op) return null;
  const legalDomain = mapDomain(item.domain);
  const identity = requiredCreateIdentity(item);
  const values: Record<string, unknown> = { ...item.proposedValues, evidence: item.evidence };
  const ownership = isOwnershipSemantics(item.proposedValues.ownershipSemantics)
    ? item.proposedValues.ownershipSemantics
    : undefined;
  return {
    id: `gate2-${index}`,
    kind: domainKind(item.domain),
    op,
    content: identity || item.subject,
    destination: "review",
    projectId,
    legalDomain,
    targetEntityId: item.targetCanonicalId ?? undefined,
    targetTodoId: item.domain === "todo" ? item.targetCanonicalId ?? undefined : undefined,
    personId:
      item.domain === "person" || item.domain === "responsibility" || item.domain === "availability"
        ? item.targetCanonicalId ?? undefined
        : undefined,
    personName: item.proposedValues.personName ?? item.proposedValues.name ?? undefined,
    responsibilityScope: item.proposedValues.scope ?? undefined,
    ownershipSemantics: ownership === "ambiguous" ? undefined : ownership,
    date: item.proposedValues.date ?? undefined,
    proposedValues: values,
  };
}

/**
 * Materialise Astra items. Non-writes pass through except no_change without
 * a proven id (left untouched — no restatement interpreter).
 */
export function materialiseGate2(args: {
  items: Gate1V2Item[];
  world: CaptureApplyWorld;
  projectId: string;
  captureText: string;
}): { items: Gate1V2Item[]; traces: Gate2Trace[] } {
  const known = knownCanonicalIds(args.world, args.projectId);
  const out: Gate1V2Item[] = [];
  const traces: Gate2Trace[] = [];

  for (let index = 0; index < args.items.length; index += 1) {
    const item = args.items[index];
    const trace: Gate2Trace = {
      index,
      fromOperation: item.operation,
      toOperation: item.operation,
      reason: null,
      plannerKind: null,
      plannerWriteType: null,
      intercepted: false,
    };

    if (item.operation === "needs_you" || item.operation === "left_untouched") {
      traces.push(trace);
      out.push(item);
      continue;
    }

    if (item.operation === "no_change") {
      if (item.targetCanonicalId && known.has(item.targetCanonicalId)) {
        traces.push(trace);
        out.push(item);
      } else {
        const next = leftUntouched(item, GATE2_MISSING_IDENTITY);
        trace.toOperation = next.operation;
        trace.reason = next.leftUntouchedReason;
        trace.intercepted = true;
        traces.push(trace);
        out.push(next);
      }
      continue;
    }

    const mappedOp = asOp(item.operation);
    const legalDomain = mapDomain(item.domain);
    if (!mappedOp || legalDomain === "unsupported") {
      const next = leftUntouched(item, GATE2_LEFT_UNTOUCHED);
      trace.toOperation = next.operation;
      trace.reason = next.leftUntouchedReason;
      trace.intercepted = true;
      traces.push(trace);
      out.push(next);
      continue;
    }

    if (!applySupportsOperation(legalDomain, mappedOp)) {
      const next = leftUntouched(item, GATE2_LEFT_UNTOUCHED);
      trace.toOperation = next.operation;
      trace.reason = next.leftUntouchedReason;
      trace.intercepted = true;
      traces.push(trace);
      out.push(next);
      continue;
    }

    if (mappedOp === "update" || mappedOp === "remove") {
      const id = item.targetCanonicalId;
      if (!id) {
        const next = item.question
          ? needsYou(item, item.question)
          : needsYou(item, GATE2_MISSING_IDENTITY);
        trace.toOperation = next.operation;
        trace.reason = next.question;
        trace.intercepted = true;
        traces.push(trace);
        out.push(next);
        continue;
      }
      if (!known.has(id)) {
        const next = leftUntouched(item, GATE2_UNKNOWN_ID);
        trace.toOperation = next.operation;
        trace.reason = next.leftUntouchedReason;
        trace.intercepted = true;
        traces.push(trace);
        out.push(next);
        continue;
      }
      const kind = typedIdKind(args.world, args.projectId, id);
      if (!typeCompatible(item.domain, kind)) {
        const next = leftUntouched(item, GATE2_WRONG_TYPE);
        trace.toOperation = next.operation;
        trace.reason = next.leftUntouchedReason;
        trace.intercepted = true;
        traces.push(trace);
        out.push(next);
        continue;
      }
    }

    if (mappedOp === "create") {
      if (item.targetCanonicalId && !known.has(item.targetCanonicalId)) {
        const next = leftUntouched(item, GATE2_UNKNOWN_ID);
        trace.toOperation = next.operation;
        trace.reason = next.leftUntouchedReason;
        trace.intercepted = true;
        traces.push(trace);
        out.push(next);
        continue;
      }
      if (!requiredCreateIdentity(item)) {
        const next = item.question
          ? needsYou(item, item.question)
          : needsYou(item, GATE2_MISSING_FIELDS);
        trace.toOperation = next.operation;
        trace.reason = next.question;
        trace.intercepted = true;
        traces.push(trace);
        out.push(next);
        continue;
      }
    }

    const suggestion = suggestionFromItem(item, index, args.projectId);
    if (!suggestion) {
      const next = leftUntouched(item, GATE2_LEFT_UNTOUCHED);
      trace.toOperation = next.operation;
      trace.reason = next.leftUntouchedReason;
      trace.intercepted = true;
      traces.push(trace);
      out.push(next);
      continue;
    }

    let planned: ReturnType<typeof planCaptureApply>;
    try {
      planned = planCaptureApply({
        item: suggestion,
        text: args.captureText,
        world: args.world,
        captureEntryProjectId: args.projectId,
      });
    } catch (error) {
      const next = leftUntouched(
        item,
        error instanceof Error ? error.message : GATE2_LEFT_UNTOUCHED,
      );
      trace.toOperation = next.operation;
      trace.reason = next.leftUntouchedReason;
      trace.plannerKind = "planner_error";
      trace.intercepted = true;
      traces.push(trace);
      out.push(next);
      continue;
    }

    trace.plannerKind = planned.kind;
    if (planned.kind === "write") {
      const writeId = operationId(planned.operation);
      trace.plannerWriteType = planned.operation.type;
      if (
        (mappedOp === "update" || mappedOp === "remove") &&
        item.targetCanonicalId &&
        writeId &&
        writeId !== item.targetCanonicalId
      ) {
        const next = leftUntouched(item, GATE2_TARGET_MISMATCH);
        trace.toOperation = next.operation;
        trace.reason = next.leftUntouchedReason;
        trace.intercepted = true;
        traces.push(trace);
        out.push(next);
        continue;
      }
      const next: Gate1V2Item = {
        ...item,
        operation: writeDisposition(planned.operation.type, mappedOp),
        targetCanonicalId: writeId ?? item.targetCanonicalId,
        question: null,
        leftUntouchedReason: null,
      };
      trace.toOperation = next.operation;
      traces.push(trace);
      out.push(next);
      continue;
    }

    if (planned.kind === "no_change") {
      const next: Gate1V2Item = {
        ...item,
        operation: "no_change",
        question: null,
        leftUntouchedReason: planned.reason,
      };
      trace.toOperation = next.operation;
      trace.reason = planned.reason;
      traces.push(trace);
      out.push(next);
      continue;
    }

    const next = needsYou(item, planned.reason);
    trace.toOperation = next.operation;
    trace.reason = next.question;
    trace.intercepted = next.operation !== item.operation;
    traces.push(trace);
    out.push(next);
  }

  return { items: out, traces };
}

export const GATE2_SPECIAL_CASE_COUNT = 8;
export const GATE2_SPECIAL_CASES = [
  "decision→knowledge domain alias",
  "applySupportsOperation intercept (no capability expansion)",
  "typed canonical-id existence for update/remove",
  "unknown-id writes fail closed (no replacement create)",
  "required create fields from explicit proposedValues only",
  "ownershipSemantics passed only when it is an exact legal enum",
  "adopt planCaptureApply write / needs_you / no_change",
  "reject planner write to a different id than Astra named",
] as const;
