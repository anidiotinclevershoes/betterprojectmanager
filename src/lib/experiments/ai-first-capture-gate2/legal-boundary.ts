/**
 * Gate 2 — minimal deterministic legal-write boundary.
 *
 * Read-only inspection of the existing Apply planner contract:
 *   applySupportsOperation(domain, op)
 *   planCaptureApply(...)   // consulted; outcomes are NOT adopted
 *
 * If the exact proposed write is not a legal/plannable operation type,
 * it cannot become a write. It becomes Left untouched.
 *
 * This does not:
 * - rewrite values, targets, domains, or operations into a supported alias
 * - convert restatement updates into no_change
 * - convert instance-level planner Needs You / no_change into a new meaning
 * - invent a second legal-operation matrix
 */
import {
  applySupportsOperation,
  classifyCaptureLegalDomain,
  planCaptureApply,
  type CaptureApplyWorld,
  type CaptureLegalDomain,
} from "@/lib/capture/apply";
import type { PendingSuggestion, SuggestionKind, SuggestionOp } from "@/lib/capture/suggestions";
import type { Gate1V2Domain, Gate1V2Item, Gate1V2Operation } from "@/lib/experiments/ai-first-capture-gate1-v2/types";

export const GATE2_UNSUPPORTED_REASON =
  "Lume cannot safely apply this type of change.";

export type LegalBoundaryTrace = {
  index: number;
  operation: Gate1V2Operation;
  domain: Gate1V2Domain;
  targetCanonicalId: string | null;
  mappedLegalDomain: CaptureLegalDomain | null;
  mappedOp: SuggestionOp | null;
  classifiedDomain: CaptureLegalDomain | null;
  applySupports: boolean | null;
  plannerKind: string | null;
  plannerReason: string | null;
  plannerConsulted: boolean;
  intercepted: boolean;
  interceptReason: string | null;
};

const WRITE_OPS = new Set<Gate1V2Operation>(["create", "update", "remove"]);

function asSuggestionOp(operation: Gate1V2Operation): SuggestionOp | null {
  if (operation === "create" || operation === "update" || operation === "remove") {
    return operation;
  }
  return null;
}

/**
 * Map the AI-stated domain onto the existing Capture legal domain.
 * `decision` is the historical AI-first alias for knowledge/decision writes.
 * No other aliasing or rescue.
 */
export function mapAiDomainToLegalDomain(
  domain: Gate1V2Domain,
): CaptureLegalDomain {
  if (domain === "decision") return "knowledge";
  return domain;
}

function domainToKind(domain: Gate1V2Domain): SuggestionKind {
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
    case "unsupported":
      return "meeting";
  }
}

export function suggestionFromAiItem(
  item: Gate1V2Item,
  index: number,
  projectId: string,
): PendingSuggestion | null {
  const op = asSuggestionOp(item.operation);
  if (!op) return null;
  const legalDomain = mapAiDomainToLegalDomain(item.domain);
  const values = { ...item.proposedValues };
  return {
    id: `gate2-inspect-${index}`,
    kind: domainToKind(item.domain),
    op,
    content: item.subject || item.understood,
    destination: "review",
    projectId,
    legalDomain,
    targetEntityId: item.targetCanonicalId ?? undefined,
    targetTodoId: item.domain === "todo" ? item.targetCanonicalId ?? undefined : undefined,
    personId: item.domain === "person" ? item.targetCanonicalId ?? undefined : undefined,
    personName: item.proposedValues.personName ?? item.proposedValues.name ?? undefined,
    responsibilityScope: item.proposedValues.scope ?? undefined,
    ownershipSemantics: undefined,
    proposedValues: values,
  };
}

function consultPlanner(
  suggestion: PendingSuggestion,
  world: CaptureApplyWorld,
  projectId: string,
): { kind: string; reason: string | null } {
  const decision = planCaptureApply({
    item: suggestion,
    text: suggestion.content,
    world,
    captureEntryProjectId: projectId,
  });
  if (decision.kind === "write") {
    return { kind: decision.kind, reason: decision.operation.type };
  }
  return { kind: decision.kind, reason: decision.reason };
}

function asLeftUntouched(item: Gate1V2Item): Gate1V2Item {
  return {
    ...item,
    operation: "left_untouched",
    question: null,
    leftUntouchedReason: GATE2_UNSUPPORTED_REASON,
  };
}

/**
 * Inspect each AI item. Preserve non-writes and legal writes unchanged.
 * Unsupported write types become Left untouched. No semantic repair.
 */
export function applyLegalWriteBoundary(
  items: Gate1V2Item[],
  world: CaptureApplyWorld,
  projectId: string,
): { items: Gate1V2Item[]; traces: LegalBoundaryTrace[] } {
  const out: Gate1V2Item[] = [];
  const traces: LegalBoundaryTrace[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const mappedOp = asSuggestionOp(item.operation);
    const mappedLegalDomain = WRITE_OPS.has(item.operation)
      ? mapAiDomainToLegalDomain(item.domain)
      : null;

    const trace: LegalBoundaryTrace = {
      index,
      operation: item.operation,
      domain: item.domain,
      targetCanonicalId: item.targetCanonicalId,
      mappedLegalDomain,
      mappedOp,
      classifiedDomain: null,
      applySupports: null,
      plannerKind: null,
      plannerReason: null,
      plannerConsulted: false,
      intercepted: false,
      interceptReason: null,
    };

    if (!mappedOp || !mappedLegalDomain) {
      traces.push(trace);
      out.push(item);
      continue;
    }

    const supported = applySupportsOperation(mappedLegalDomain, mappedOp);
    trace.applySupports = supported;

    const suggestion = suggestionFromAiItem(item, index, projectId);
    if (suggestion) {
      try {
        trace.classifiedDomain = classifyCaptureLegalDomain(suggestion);
        const planned = consultPlanner(suggestion, world, projectId);
        trace.plannerConsulted = true;
        trace.plannerKind = planned.kind;
        trace.plannerReason = planned.reason;
      } catch (err) {
        trace.plannerConsulted = true;
        trace.plannerKind = "planner_error";
        trace.plannerReason = err instanceof Error ? err.message : String(err);
      }
    }

    if (!supported) {
      trace.intercepted = true;
      trace.interceptReason = GATE2_UNSUPPORTED_REASON;
      traces.push(trace);
      out.push(asLeftUntouched(item));
      continue;
    }

    traces.push(trace);
    out.push(item);
  }

  return { items: out, traces };
}
