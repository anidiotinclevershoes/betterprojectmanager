import type { FrameSize, WorkspaceFrameConfig } from "@/lib/workspace/layout";

/** Distinct column spans on the 12-column desktop grid. */
export const FRAME_SPAN: Record<FrameSize, number> = {
  compact: 3,
  standard: 4,
  wide: 6,
  full: 12,
};

/** How many list items fit naturally in a frame without internal scroll. */
export const FRAME_ITEM_LIMIT: Record<FrameSize, number> = {
  compact: 3,
  standard: 4,
  wide: 5,
  full: 8,
};

export function itemLimitFor(size?: FrameSize | string | null) {
  if (size && size in FRAME_ITEM_LIMIT) {
    return FRAME_ITEM_LIMIT[size as FrameSize];
  }
  return FRAME_ITEM_LIMIT.standard;
}

export type PackedFrame = {
  frame: WorkspaceFrameConfig;
  span: number;
};

/**
 * Pack frames into 12-column rows and expand neighbours to fill leftover
 * horizontal space when that improves balance (avoids isolated empty cells).
 */
export function packWorkspaceFrames(
  frames: WorkspaceFrameConfig[],
): PackedFrame[] {
  const ordered = [...frames].sort((a, b) => a.order - b.order);
  const rows: PackedFrame[][] = [];
  let row: PackedFrame[] = [];
  let used = 0;

  const flush = () => {
    if (!row.length) return;
    balanceRow(row, used);
    rows.push(row);
    row = [];
    used = 0;
  };

  for (const frame of ordered) {
    const base = FRAME_SPAN[frame.size] ?? FRAME_SPAN.standard;
    if (base >= 12 || frame.size === "full") {
      flush();
      rows.push([{ frame, span: 12 }]);
      continue;
    }
    if (used + base > 12) {
      flush();
    }
    row.push({ frame, span: base });
    used += base;
  }
  flush();

  return rows.flat();
}

function balanceRow(row: PackedFrame[], used: number) {
  let leftover = 12 - used;
  if (leftover <= 0 || row.length === 0) return;

  // Prefer expanding non-compact neighbours so compact stays visually compact.
  const growOrder = [...row.keys()].sort((a, b) => {
    const rank = (p: PackedFrame) =>
      p.frame.size === "wide" ? 0 : p.frame.size === "standard" ? 1 : 2;
    return rank(row[a]) - rank(row[b]);
  });

  for (const index of growOrder) {
    if (leftover <= 0) break;
    const item = row[index];
    const maxExtra =
      item.frame.size === "compact"
        ? 1
        : item.frame.size === "standard"
          ? 2
          : item.frame.size === "wide"
            ? 6
            : 0;
    const room = Math.min(leftover, maxExtra, 12 - item.span);
    if (room <= 0) continue;
    item.span += room;
    leftover -= room;
  }

  // Any remaining gap goes to the last item (keeps the row flush).
  if (leftover > 0) {
    const last = row[row.length - 1];
    last.span = Math.min(12, last.span + leftover);
  }
}

export function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, label, [role="button"], [data-no-card-click]',
    ),
  );
}
