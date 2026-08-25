/**
 * Phase 3B — map a review finding onto one legal mutation domain.
 * Unknown combinations become `unsupported` (Needs you), never Todo.
 *
 * `kind` is the primary authority. `legalDomain` / ownership / availability
 * may only *refine* a compatible kind. They must never retarget Risk,
 * milestone, or Todo into another domain.
 */

import type { PendingSuggestion, SuggestionKind } from "@/lib/capture/suggestions";
import {
  hasInvalidOwnershipSemantics,
  isCaptureLegalDomain,
  isOwnershipSemantics,
  type CaptureLegalDomain,
} from "./types";

function proposedValues(item: PendingSuggestion): Record<string, unknown> {
  return (
    (item as PendingSuggestion & { proposedValues?: Record<string, unknown> })
      .proposedValues ?? {}
  );
}

function ownershipSemanticsRaw(item: PendingSuggestion): unknown {
  if (item.ownershipSemantics !== undefined) return item.ownershipSemantics;
  return proposedValues(item).ownershipSemantics;
}

function proposedKind(item: PendingSuggestion): string | undefined {
  const values = item.recommendation
    ? (item as PendingSuggestion & {
        proposedValues?: Record<string, unknown>;
      }).proposedValues
    : undefined;
  const fromItem = (item as PendingSuggestion & {
    proposedValues?: Record<string, unknown>;
  }).proposedValues;
  const bag = fromItem ?? values;
  if (bag && typeof bag.kind === "string") return bag.kind;
  if (typeof item.knowledgeBullet === "string" && item.knowledgeSection === "people") {
    return undefined;
  }
  return undefined;
}

function hasAvailabilityPayload(item: PendingSuggestion): boolean {
  if (item.kind === "availability") return true;
  if (item.legalDomain === "availability") return true;
  const values = (item as PendingSuggestion & {
    proposedValues?: Record<string, unknown>;
  }).proposedValues;
  if (values?.kind === "availability") return true;
  if (typeof values?.awayFromIso === "string") return true;
  if (item.knowledgeSection === "people" && typeof values?.awayFromIso === "string") {
    return true;
  }
  return false;
}

function kindToDomain(kind: SuggestionKind): CaptureLegalDomain {
  switch (kind) {
    case "action":
    case "nudge":
      return "todo";
    case "risk":
      return "risk";
    case "milestone":
      return "milestone";
    case "stakeholder":
      return "person";
    case "availability":
      return "availability";
    case "decision":
    case "knowledge":
      return "knowledge";
    case "memory":
      return "memory";
    case "meeting":
      return "unsupported";
    default:
      return "unsupported";
  }
}

function canRefineToAvailability(fromKind: CaptureLegalDomain): boolean {
  return fromKind === "availability" || fromKind === "person" || fromKind === "knowledge";
}

function canRefineToResponsibility(fromKind: CaptureLegalDomain): boolean {
  return fromKind === "person" || fromKind === "knowledge";
}

/**
 * Classify the single legal domain this finding may mutate.
 * Conflicting stickers fail closed (`unsupported`) instead of falling through.
 */
export function classifyCaptureLegalDomain(
  item: PendingSuggestion,
): CaptureLegalDomain {
  // Mapping already failed closed. Refinements must not reopen a write.
  if (item.legalDomain === "unsupported") {
    return "unsupported";
  }

  const fromKind = kindToDomain(item.kind);
  const ownershipRaw = ownershipSemanticsRaw(item);

  // Unknown ownership language is not a Person or Todo. Fail closed.
  if (hasInvalidOwnershipSemantics(ownershipRaw)) {
    return "unsupported";
  }

  if (hasAvailabilityPayload(item)) {
    return canRefineToAvailability(fromKind) ? "availability" : "unsupported";
  }

  const semantics = isOwnershipSemantics(ownershipRaw) ? ownershipRaw : undefined;
  const proposed = proposedKind(item);
  if (semantics || proposed === "responsibility") {
    return canRefineToResponsibility(fromKind) ? "responsibility" : "unsupported";
  }

  if (item.legalDomain && isCaptureLegalDomain(item.legalDomain)) {
    if (item.legalDomain === fromKind) return fromKind;
    if (fromKind === "person" && item.legalDomain === "responsibility") {
      return "responsibility";
    }
    if (fromKind === "knowledge" && item.legalDomain === "availability") {
      return "availability";
    }
    // A sticker must not retarget an incompatible kind (e.g. Risk → Todo).
    return "unsupported";
  }

  return fromKind;
}
