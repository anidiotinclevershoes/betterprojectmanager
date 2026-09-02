/**
 * Shared Review ↔ Apply executability contract — static half.
 *
 * A Review item may be Ready only when Apply has a legal mutation for
 * this exact domain × operation AND the instance preflight in
 * `readiness.ts` can construct a faithful write. This file is the verb
 * matrix: what Apply will never execute, regardless of world.
 *
 * Person update is not in the matrix. `ensure_person` does not edit or
 * end involvement, so an "update" would be a false success.
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
    case "person":
      // Create is the only representable person write (ensure_person).
      return new Set(["create"]);
    case "milestone":
    case "responsibility":
    case "availability":
    case "knowledge":
    case "memory":
      return CREATE_UPDATE;
    case "unsupported":
      return null;
  }
}

function asProposedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const STRUCTURED_CESSATION = new Set([
  "removed",
  "inactive",
  "ended",
  "departed",
  "left",
  "complete",
  "completed",
  "archived",
  "gone",
]);

/**
 * Structured involvement-ended payload only. Free-text phrases are not a gate.
 */
export function hasStructuredCessationSignal(item: PendingSuggestion): boolean {
  const values = item.proposedValues ?? {};
  if (
    values.involved === false ||
    values.active === false ||
    values.current === false
  ) {
    return true;
  }
  const status = (
    asProposedString(values.status) ??
    asProposedString(values.involvement) ??
    asProposedString(values.lifecycle) ??
    ""
  ).toLowerCase();
  return STRUCTURED_CESSATION.has(status);
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

  if (
    domain === "person" &&
    (item.op === "remove" || item.op === "delete")
  ) {
    return `${name} is no longer involved.\n\nLume needs clarification about what that means for this stakeholder.`;
  }
  if (domain === "person" && item.op === "update") {
    if (hasStructuredCessationSignal(item)) {
      return `${name} is no longer involved.\n\nLume needs clarification about what that means for this stakeholder.`;
    }
    return `${name} is mentioned, but Lume cannot represent this as a stakeholder change.\n\nLume needs clarification about what that means for this stakeholder.`;
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
