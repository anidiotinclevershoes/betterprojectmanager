const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

export const TODAY_ISO = "2026-08-21";

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function daysFromToday(iso: string): number {
  const a = parseISO(iso).getTime();
  const b = parseISO(TODAY_ISO).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** "Tomorrow", "In 3 days", "24 Aug" — whichever a person would actually say. */
export function formatShort(iso: string): string {
  const diff = daysFromToday(iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 6) return `In ${diff} days`;
  if (diff < -1 && diff >= -6) return `${Math.abs(diff)} days ago`;
  const d = parseISO(iso);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** "26 Aug" — the calendar fact, not a relative phrase. */
export function formatDay(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** "24 Aug–1 Sep" for periods such as leave or a hypercare window. */
export function formatRange(startISO: string, endISO?: string): string {
  return endISO ? `${formatDay(startISO)}–${formatDay(endISO)}` : formatDay(startISO);
}

export function formatLong(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function relativeSuffix(iso: string): string {
  const diff = daysFromToday(iso);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

export interface CalendarCell {
  iso: string;
  day: number;
  outside: boolean;
}

/** Monday-first month grid, padded with the neighbouring months' days. */
export function monthGrid(iso: string): { title: string; cells: CalendarCell[] } {
  const anchor = parseISO(iso);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ iso: toISO(d), day: d.getDate(), outside: d.getMonth() !== month });
  }
  return { title: `${MONTHS[month]} ${year}`, cells: cells.slice(0, 35) };
}

export const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
