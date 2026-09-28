/**
 * Deterministic item-level History attribution.
 *
 * New history rows can name a stable target_kind + target_id. Older rows remain
 * valid with null targets and are intentionally not guessed onto an item.
 */
import type {
  HistoryEvent,
  HistoryTargetKind,
  MissionState,
} from "@/lib/types";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";

export const ITEM_HISTORY_ATTRIBUTION = {
  supported: true,
  limitation: "D-004",
  reason:
    "New rows can be attributed by stable target id. Earlier un-targeted History remains project-level only.",
} as const;

export type ItemHistoryRead = {
  events: HistoryEvent[];
  attributable: boolean;
  limitation: typeof ITEM_HISTORY_ATTRIBUTION.limitation | null;
  notice: string;
};

function targetForRef(
  ref: KnowledgeItemRef | null,
): { kind: HistoryTargetKind; id: string } | null {
  if (!ref) return null;
  switch (ref.kind) {
    case "risk":
      return { kind: "risk", id: ref.riskId };
    case "todo":
      return { kind: "todo", id: ref.todoId };
    case "person":
      return { kind: "stakeholder", id: ref.personId };
    case "timeline":
      return { kind: "milestone", id: ref.timelineId };
    case "structured":
      return { kind: "knowledge_item", id: ref.itemId };
    case "section":
      return ref.itemId
        ? { kind: "knowledge_item", id: ref.itemId }
        : null;
    case "unconfirmed_owner":
      return { kind: "knowledge_item", id: ref.itemId };
    case "knowledge_risk":
      return null;
    default:
      return null;
  }
}

export function historyEventsForItem(
  state: MissionState,
  projectId: string,
  ref: KnowledgeItemRef | null,
): ItemHistoryRead {
  const target = targetForRef(ref);
  if (!target) {
    return {
      events: [],
      attributable: false,
      limitation: ITEM_HISTORY_ATTRIBUTION.limitation,
      notice:
        "Item History is limited for this legacy item because it has no stable history target.",
    };
  }

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
    notice:
      events.length > 0
        ? "Earlier project-level history may not be attached to this item."
        : "No item-linked history yet. Earlier project-level history may still exist.",
  };
}
