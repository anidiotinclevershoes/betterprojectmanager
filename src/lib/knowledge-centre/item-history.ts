/**
 * Item-level History attribution.
 *
 * history_events has no item_id / target_id. Title, detail, and fuzzy
 * matching are not attribution. Do not present unmatched events as
 * belonging to an item.
 */
import type { HistoryEvent, MissionState } from "@/lib/types";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";

export const ITEM_HISTORY_ATTRIBUTION = {
  supported: false,
  limitation: "D-004",
  reason:
    "history_events has no item_id or target_id. Existing contracts cannot deterministically attribute a row to one item.",
} as const;

export type ItemHistoryRead = {
  events: HistoryEvent[];
  attributable: boolean;
  limitation: typeof ITEM_HISTORY_ATTRIBUTION.limitation | null;
  notice: string;
};

/**
 * Return History events only when a deterministic item contract exists.
 * Today that contract does not exist — always empty + D-004 notice.
 */
export function historyEventsForItem(
  _state: MissionState,
  _projectId: string,
  _ref: KnowledgeItemRef | null,
): ItemHistoryRead {
  void _state;
  void _projectId;
  void _ref;
  return {
    events: [],
    attributable: ITEM_HISTORY_ATTRIBUTION.supported,
    limitation: ITEM_HISTORY_ATTRIBUTION.limitation,
    notice:
      "Item History is limited. Lume only shows events that are deterministically tied to this item. Many earlier actions were never stored that way (D-004), so this list can be empty even when the workspace History page has later project-level events.",
  };
}
