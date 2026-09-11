/** Semantic date matching for hosted vertical journeys. Not product UI. */

const MONTH_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export function parseYmd(ymd: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/**
 * True when visible text unambiguously represents the calendar day.
 * Accepts ISO, long form, and the product's compact "20 Sep" / "12 Sep" paint.
 * Does not match day 2 inside "12 Sep".
 */
export function textRepresentsYmd(text: string, ymd: string): boolean {
  const parsed = parseYmd(ymd);
  if (!parsed) return false;
  if (text.includes(ymd)) return true;
  const hay = text.replace(/\u00a0/g, " ");
  const month = MONTH_SHORT[parsed.month - 1];
  if (!month) return false;
  const day = String(parsed.day);
  const year = String(parsed.year);
  const monthToken = `${month}[a-z]*\\.?`;
  const dayToken = `(?:^|[^0-9])${day}(?![0-9])`;
  const patterns = [
    new RegExp(`${dayToken}\\s+${monthToken}\\s+${year}\\b`, "i"),
    new RegExp(`${dayToken}\\s+${monthToken}(?!\\s+\\d)`, "i"),
    new RegExp(`\\b${monthToken}\\s+${day}(?:st|nd|rd|th)?(?![0-9])[,\\s]+${year}\\b`, "i"),
    new RegExp(`\\b${monthToken}\\s+${day}(?:st|nd|rd|th)?(?![0-9])`, "i"),
  ];
  return patterns.some((re) => re.test(hay));
}

export function organisedDraftHasYmd(body: unknown, ymd: string): boolean {
  if (!body || typeof body !== "object") return false;
  const blob = JSON.stringify(body);
  if (blob.includes(ymd)) return true;
  const draft = (body as { draft?: { importantDates?: unknown[] } }).draft;
  const dates = Array.isArray(draft?.importantDates) ? draft.importantDates : [];
  return dates.some((row) => {
    if (!row || typeof row !== "object") return false;
    return Object.values(row as Record<string, unknown>).some(
      (value) => typeof value === "string" && value.includes(ymd),
    );
  });
}
