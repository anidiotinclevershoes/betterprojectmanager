/**
 * Ocean date presentation — explicit semantic labels, never invent "Due".
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatShortDayMonth(isoOrDate: string): string | null {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) {
    // Already a short label?
    if (/^\d{1,2}\s+[A-Za-z]{3}/.test(isoOrDate.trim())) return isoOrDate.trim();
    return null;
  }
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Genuine due dates only. */
export function formatDueLabel(dueAt: string | null | undefined): string | null {
  if (!dueAt) return null;
  const short = formatShortDayMonth(dueAt);
  return short ? `Due ${short}` : null;
}

export function formatMilestoneLabel(
  label: string,
  startAt: string | null | undefined,
): string | null {
  if (!startAt) return label.trim() || null;
  const short = formatShortDayMonth(startAt);
  if (!short) return label.trim() || null;
  const clean = label.trim();
  if (!clean) return short;
  return `${clean} · ${short}`;
}

export function formatAwayRange(
  fromIso?: string | null,
  toIso?: string | null,
): string | null {
  if (!fromIso && !toIso) return null;
  if (fromIso && toIso) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      if (
        from.getUTCMonth() === to.getUTCMonth() &&
        from.getUTCFullYear() === to.getUTCFullYear()
      ) {
        return `Away ${from.getUTCDate()}–${to.getUTCDate()} ${MONTHS[from.getUTCMonth()]}`;
      }
      const a = formatShortDayMonth(fromIso);
      const b = formatShortDayMonth(toIso);
      if (a && b) return `Away ${a}–${b}`;
    }
  }
  const a = fromIso ? formatShortDayMonth(fromIso) : null;
  const b = toIso ? formatShortDayMonth(toIso) : null;
  if (a && b) return `Away ${a}–${b}`;
  if (a) return `Away ${a}`;
  if (b) return `Away until ${b}`;
  return null;
}

export type PriorityDot = "high" | "medium" | "low" | "none";

/** Priority dots only — never show High/Medium/Low text. */
export function priorityDotClass(priority: PriorityDot): string {
  return `ocean-priority-dot is-${priority}`;
}
