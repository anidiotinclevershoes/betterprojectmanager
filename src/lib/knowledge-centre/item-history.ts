/**
 * Item-level History attribution.
 *
 * A History row belongs to an item only when it carries that item's
 * exact target kind and id in the same project. Risk, To Do, and Person
 * use that contract. Title, detail, substring, and fuzzy matching are
 * not attribution. NULL target rows stay unattributed (D-004).
 */
import type { HistoryEvent, MissionState } from "@/lib/types";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import { RISK_HISTORY_TARGET_KIND } from "@/lib/risks/issue-notes";

export const TODO_HISTORY_TARGET_KIND = "todo" as const;
export const PERSON_HISTORY_TARGET_KIND = "person" as const;

export const ITEM_HISTORY_ATTRIBUTION = {
  /** Exact target identity for Risk, To Do, and Person. NULL targets stay out. */
  supported: false,
  limitation: "D-004",
  reason:
    "Only history_events with target_kind and target_id can be attributed. NULL-target rows stay unattributed. Title and fuzzy matching are prohibited.",
} as const;

export type ItemHistoryRead = {
  events: HistoryEvent[];
  attributable: boolean;
  limitation: typeof ITEM_HISTORY_ATTRIBUTION.limitation | null;
  notice: string;
};

const ITEM_HISTORY_NOTICE =
  "Item History is limited. Lume only shows events that are deterministically tied to this item. Many earlier actions were never stored that way (D-004), so this list can be empty even when the workspace History page has later project-level events.";

function unattributed(): ItemHistoryRead {
  return {
    events: [],
    attributable: false,
    limitation: ITEM_HISTORY_ATTRIBUTION.limitation,
    notice: ITEM_HISTORY_NOTICE,
  };
}

function exactTarget(
  ref: KnowledgeItemRef,
): { kind: string; id: string } | null {
  if (ref.kind === "risk") {
    return { kind: RISK_HISTORY_TARGET_KIND, id: ref.riskId };
  }
  if (ref.kind === "todo") {
    return { kind: TODO_HISTORY_TARGET_KIND, id: ref.todoId };
  }
  if (ref.kind === "person") {
    return { kind: PERSON_HISTORY_TARGET_KIND, id: ref.personId };
  }
  return null;
}

/**
 * Return History events only when a deterministic item contract exists.
 * Risk, To Do, and Person match project + exact target kind + exact id.
 * Every other kind stays empty. NULL-target rows never match.
 */
export function historyEventsForItem(
  state: MissionState,
  projectId: string,
  ref: KnowledgeItemRef | null,
): ItemHistoryRead {
  const target = ref ? exactTarget(ref) : null;
  if (!target) return unattributed();
  const events = (state.history ?? []).filter(
    (event) =>
      event.projectId === projectId &&
      event.targetKind === target.kind &&
      event.targetId === target.id,
  );
  return {
    events,
    attributable: true,
    limitation: ITEM_HISTORY_ATTRIBUTION.limitation,
    notice: ITEM_HISTORY_NOTICE,
  };
}
