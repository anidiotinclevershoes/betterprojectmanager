/**
 * Item-level History attribution.
 *
 * A History row belongs to an Issue only when it carries the stable
 * target pair for that Risk in the same project. Title, detail, substring,
 * and fuzzy matching are not attribution. NULL target rows stay
 * unattributed (D-004), including older events written before target
 * identity existed.
 */
import type { HistoryEvent, MissionState } from "@/lib/types";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import { RISK_HISTORY_TARGET_KIND } from "@/lib/risks/issue-notes";

export const ITEM_HISTORY_ATTRIBUTION = {
  /** Exact target identity exists for genuine Risk refs only. */
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

/**
 * Return History events only when a deterministic item contract exists.
 * Genuine risk refs match project + target kind `risk` + exact risk id.
 * Every other kind stays empty. NULL-target rows never match.
 */
export function historyEventsForItem(
  state: MissionState,
  projectId: string,
  ref: KnowledgeItemRef | null,
): ItemHistoryRead {
  if (!ref || ref.kind !== "risk") return unattributed();
  const events = (state.history ?? []).filter(
    (event) =>
      event.projectId === projectId &&
      event.targetKind === RISK_HISTORY_TARGET_KIND &&
      event.targetId === ref.riskId,
  );
  return {
    events,
    attributable: true,
    limitation: ITEM_HISTORY_ATTRIBUTION.limitation,
    notice: ITEM_HISTORY_NOTICE,
  };
}
