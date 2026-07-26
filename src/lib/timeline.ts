import type {
  TimelineItem,
  TimelineItemInput,
  TimelineItemType,
} from "./types";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function similarLabel(a: string, b: string) {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  return (
    na === nb ||
    na.startsWith(nb.slice(0, 24)) ||
    nb.startsWith(na.slice(0, 24))
  );
}

/**
 * Merge timeline patches into existing items.
 * AI / capture only append or lightly update — never rebuild the calendar.
 */
export function mergeTimelineItems(
  existing: TimelineItem[],
  projectId: string,
  patch: TimelineItemInput[],
  source: TimelineItem["source"] = "capture",
): TimelineItem[] {
  if (!patch.length) return existing;

  const others = existing.filter((t) => t.projectId !== projectId);
  const current = existing.filter((t) => t.projectId === projectId);
  const next = [...current];

  for (const item of patch) {
    if (!item.label?.trim() || !item.startAt) continue;
    const matchIdx = next.findIndex(
      (t) =>
        (item.id && t.id === item.id) ||
        (similarLabel(t.label, item.label) &&
          dayKey(t.startAt) === dayKey(item.startAt)),
    );

    if (matchIdx >= 0) {
      const prev = next[matchIdx]!;
      next[matchIdx] = {
        ...prev,
        label: item.label.trim() || prev.label,
        type: item.type || prev.type,
        startAt: item.startAt || prev.startAt,
        endAt: item.endAt ?? prev.endAt,
        notes: item.notes ?? prev.notes,
      };
    } else {
      next.push({
        id: item.id || id("tl"),
        projectId,
        label: item.label.trim(),
        type: item.type,
        startAt: item.startAt,
        endAt: item.endAt,
        notes: item.notes,
        source,
      });
    }
  }

  return [...others, ...next].sort(
    (a, b) =>
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
}

/** Local heuristic: pull explicit dates from capture text into timeline patches. */
export function extractTimelinePatchFromText(
  content: string,
): TimelineItemInput[] {
  const items: TimelineItemInput[] = [];
  const isoMatches = content.matchAll(
    /([A-Za-z][^.!?\n]{8,80}?)\s+(?:on|by|for)\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2,8}\s+\d{1,2}(?:,\s*\d{4})?)/gi,
  );

  for (const match of isoMatches) {
    const label = match[1]?.trim();
    const dateRaw = match[2]?.trim();
    if (!label || !dateRaw) continue;
    const parsed = Date.parse(dateRaw);
    if (Number.isNaN(parsed)) continue;
    const type = inferType(label);
    items.push({
      label: label.replace(/^[-•*\s]+/, ""),
      type,
      startAt: new Date(parsed).toISOString(),
      notes: "Extracted from capture",
    });
  }

  return items.slice(0, 4);
}

function inferType(label: string): TimelineItemType {
  const lower = label.toLowerCase();
  if (/cab|submit|submission|pack due/.test(lower)) return "submission";
  if (/meeting|sync|review|board|walkthrough/.test(lower)) return "meeting";
  if (/deadline|due|freeze|cut.?off/.test(lower)) return "deadline";
  if (/window|phase|testing|hypercare|merge/.test(lower)) return "phase";
  return "milestone";
}

export function projectTimeline(
  items: TimelineItem[],
  projectId: string,
): TimelineItem[] {
  return items
    .filter((t) => t.projectId === projectId)
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}

/** Compute Gantt range with a little padding. */
export function timelineBounds(items: TimelineItem[]) {
  if (!items.length) {
    const start = Date.now() - 3 * 86400000;
    const end = Date.now() + 21 * 86400000;
    return { start, end };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const item of items) {
    const s = new Date(item.startAt).getTime();
    const e = new Date(item.endAt ?? item.startAt).getTime();
    min = Math.min(min, s);
    max = Math.max(max, e);
  }
  const pad = 2 * 86400000;
  if (max <= min) max = min + 7 * 86400000;
  return { start: min - pad, end: max + pad };
}
