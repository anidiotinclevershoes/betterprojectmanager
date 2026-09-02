/**
 * Shared Review ↔ Apply executability contract.
 *
 * A Review item may be Ready / approvable only when Apply has a legal
 * mutation for this exact domain × operation. World-dependent checks
 * (missing target, identity) stay in the planner. This predicate is the
 * static half of that contract — what Apply will never execute.
 *
 * Do not add person-removal or other new mutation semantics here.
 */

import type { PendingSuggestion, SuggestionOp } from "@/lib/capture/suggestions";
import { classifyCaptureLegalDomain } from "./classify";
import type { CaptureLegalDomain } from "./types";

const CREATE_UPDATE: ReadonlySet<SuggestionOp> = new Set(["create", "update"]);

const CREATE_UPDATE_COMPLETE: ReadonlySet<SuggestionOp> = new Set([
  "create",
  "update",
  "complete",
]);

/** To Do is the only domain with delete / archive mutations today. */
const TODO_OPS: ReadonlySet<SuggestionOp> = new Set([
  "create",
  "update",
  "complete",
  "archive",
  "delete",
  "remove",
]);

function supportedOps(domain: CaptureLegalDomain): ReadonlySet<SuggestionOp> | null {
  switch (domain) {
    case "todo":
      return TODO_OPS;
    case "risk":
      return CREATE_UPDATE_COMPLETE;
    case "milestone":
    case "person":
    case "responsibility":
    case "availability":
    case "knowledge":
    case "memory":
      return CREATE_UPDATE;
    case "unsupported":
      return null;
  }
}

/** True when the planner has a legal mutation type for this domain × op. */
export function applySupportsOperation(
  domain: CaptureLegalDomain,
  op: SuggestionOp,
): boolean {
  const ops = supportedOps(domain);
  return Boolean(ops?.has(op));
}

/** Classify then ask whether Apply can execute this suggestion's op. */
export function isApplyExecutableSuggestion(item: PendingSuggestion): boolean {
  const domain = classifyCaptureLegalDomain(item);
  return applySupportsOperation(domain, item.op);
}

/**
 * User-facing Needs You copy when Apply cannot execute the proposed op.
 * Does not invent inactive-person / responsibility-ending choices.
 */
export function unsupportedApplyReason(
  item: PendingSuggestion,
  recordName?: string,
): string {
  const domain = classifyCaptureLegalDomain(item);
  const name = (recordName ?? item.content).trim() || "this record";

  if (domain === "person" && (item.op === "remove" || item.op === "delete")) {
    return `${name} is no longer involved.\n\nLume needs clarification about what that means for this stakeholder.`;
  }
  if (domain === "person" && (item.op === "archive" || item.op === "complete")) {
    return `Lume needs clarification about what that means for this stakeholder.`;
  }
  if (domain === "milestone" && item.op === "complete") {
    return "Completing a date is not supported yet — Lume will not turn this into a To Do.";
  }
  if (domain === "unsupported") {
    return "Lume cannot safely apply this finding to a maintained record.";
  }
  return "Lume cannot apply this change automatically. It needs clarification before anything is written.";
}
