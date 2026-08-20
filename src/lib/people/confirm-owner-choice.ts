/**
 * Slice 2D — share vs replace decision helpers for Confirm Owner UI.
 * Pure / deterministic. Does not mutate MissionState.
 */
import {
  findConfirmedOwners,
  namesMatchExact,
  type ConfirmedOwnerHit,
} from "@/lib/people/identity";
import type { ProjectKnowledge } from "@/lib/types";

export type OwnershipIntent = "share" | "replace";

export type ConfirmOwnerChoiceState = {
  /** Current confirmed owners for the scope (may be empty). */
  currentOwners: ConfirmedOwnerHit[];
  /** True when the chosen person is already a current owner of this scope. */
  selectedIsCurrentOwner: boolean;
  /**
   * When true, UI must ask share vs replace before confirming
   * (material ambiguity → Needs you).
   */
  requiresOwnershipIntent: boolean;
};

/**
 * Decide whether Confirm Owner must ask share vs replace.
 *
 * Rules:
 * - No current owners → first assignment; no intent needed.
 * - Selected person already owns the scope → idempotent; no intent needed.
 * - Other current owner(s) exist → user must choose share or replace.
 */
export function resolveConfirmOwnerChoice(
  knowledge: ProjectKnowledge | undefined,
  scope: string,
  opts: {
    selectedPersonId?: string | null;
    selectedPersonName?: string | null;
  },
): ConfirmOwnerChoiceState {
  const currentOwners = findConfirmedOwners(knowledge, scope);
  const selectedId = opts.selectedPersonId?.trim() || null;
  const selectedName = opts.selectedPersonName?.trim() || null;

  const selectedIsCurrentOwner = currentOwners.some((o) => {
    if (selectedId && o.personId && o.personId === selectedId) return true;
    if (
      selectedName &&
      o.personName &&
      namesMatchExact(o.personName, selectedName)
    ) {
      return true;
    }
    return false;
  });

  const otherOwners = currentOwners.filter((o) => {
    if (selectedId && o.personId && o.personId === selectedId) return false;
    if (
      selectedName &&
      o.personName &&
      namesMatchExact(o.personName, selectedName)
    ) {
      return false;
    }
    return true;
  });

  return {
    currentOwners,
    selectedIsCurrentOwner,
    requiresOwnershipIntent:
      otherOwners.length > 0 && !selectedIsCurrentOwner,
  };
}

/**
 * Build replacePersonId for the confirm mutation.
 * Returns null for share / first-owner / idempotent paths.
 * Throws if replace intent is incomplete or invalid.
 */
export function resolveReplacePersonId(input: {
  intent: OwnershipIntent | null;
  requiresOwnershipIntent: boolean;
  replacePersonId: string | null;
  currentOwners: ConfirmedOwnerHit[];
}): string | null {
  if (!input.requiresOwnershipIntent) {
    return null;
  }
  if (!input.intent) {
    throw new Error("Choose whether to share or replace ownership");
  }
  if (input.intent === "share") {
    return null;
  }
  const id = input.replacePersonId?.trim() || null;
  if (!id) {
    throw new Error("Choose which owner is being replaced");
  }
  const ok = input.currentOwners.some((o) => o.personId === id);
  if (!ok) {
    throw new Error("Replacement target is not a current owner of this scope");
  }
  return id;
}
