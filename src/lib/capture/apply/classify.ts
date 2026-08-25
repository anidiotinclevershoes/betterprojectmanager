/**
 * Phase 3B — map a review finding onto one legal mutation domain.
 * Unknown combinations become `unsupported` (Needs you), never Todo.
 */

import type { PendingSuggestion, SuggestionKind } from "@/lib/capture/suggestions";
import {
  isCaptureLegalDomain,
  type CaptureLegalDomain,
  type OwnershipSemantics,
} from "./types";

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

export function classifyCaptureLegalDomain(
  item: PendingSuggestion,
): CaptureLegalDomain {
  if (item.legalDomain && isCaptureLegalDomain(item.legalDomain)) {
    return item.legalDomain;
  }

  const semantics = item.ownershipSemantics as OwnershipSemantics | undefined;
  if (semantics) return "responsibility";

  if (hasAvailabilityPayload(item)) return "availability";

  const proposed = proposedKind(item);
  if (proposed === "availability") return "availability";
  if (proposed === "responsibility") return "responsibility";

  return kindToDomain(item.kind);
}
