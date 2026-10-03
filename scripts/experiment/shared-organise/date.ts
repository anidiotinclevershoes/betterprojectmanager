/**
 * Experimental milestone date contract.
 * Luna chooses the intent and, for a relative move, the direction.
 * This module checks that structure and adds or subtracts days.
 * It does not classify English tense or words such as "back".
 */
export const DATE_INTENTS = ["set_explicit", "move_relative", "historical", "uncertain"] as const;
export type DateIntent = (typeof DATE_INTENTS)[number];

export const DATE_DIRECTIONS = ["earlier", "later"] as const;
export type DateDirection = (typeof DATE_DIRECTIONS)[number];

const MONTHS: Array<{ month: number; names: string[] }> = [
  { month: 1, names: ["january", "jan"] },
  { month: 2, names: ["february", "feb"] },
  { month: 3, names: ["march", "mar"] },
  { month: 4, names: ["april", "apr"] },
  { month: 5, names: ["may"] },
  { month: 6, names: ["june", "jun"] },
  { month: 7, names: ["july", "jul"] },
  { month: 8, names: ["august", "aug"] },
  { month: 9, names: ["september", "sept", "sep"] },
  { month: 10, names: ["october", "oct"] },
  { month: 11, names: ["november", "nov"] },
  { month: 12, names: ["december", "dec"] },
];

export type DateDecision =
  | { kind: "needs_you"; reason: string }
  | { kind: "no_change"; reason: string }
  | { kind: "ready"; startAt: string };

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isDateIntent(value: string): value is DateIntent {
  return (DATE_INTENTS as readonly string[]).includes(value);
}

export function isoDay(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function shiftIsoDate(
  canonical: string,
  direction: DateDirection,
  amount: number,
  unit: "days" | "weeks",
): string | null {
  const day = isoDay(canonical);
  if (!day || !Number.isInteger(amount) || amount < 1) return null;
  const [year, month, date] = day.split("-").map(Number);
  const days = unit === "weeks" ? amount * 7 : amount;
  const delta = direction === "later" ? days : -days;
  const next = new Date(Date.UTC(year!, month! - 1, date!) + delta * 86400000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Next civil date for this month and day on or after the reference day. */
export function nextOccurrenceIso(month: number, day: number, referenceDate: string): string | null {
  const ref = isoDay(referenceDate);
  if (!ref || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const [ry, rm, rd] = ref.split("-").map(Number);
  const candidate = (year: number) => {
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
    const m = String(month).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };
  const thisYear = candidate(ry!);
  if (!thisYear) return null;
  return thisYear >= ref ? thisYear : candidate(ry! + 1);
}

function yearsIn(evidence: string): string[] {
  return [...new Set([...evidence.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => match[0]))];
}

function hasToken(evidence: string, token: string): boolean {
  return new RegExp(`\\b${token}\\b`, "i").test(evidence);
}

function dayAppears(evidence: string, day: number): boolean {
  return new RegExp(`\\b0?${day}(?!\\d)`, "i").test(evidence);
}

/**
 * The proposed ISO is the civil date written in the evidence.
 * A missing year is accepted only when it is the next occurrence
 * on or after the reference date. Month and day must still be present.
 */
export function explicitDateIsGrounded(
  evidence: string,
  iso: string,
  referenceDate: string,
): { ok: true; startAt: string } | { ok: false; reason: string } {
  const day = isoDay(iso);
  if (!day) return { ok: false, reason: "This milestone date is not a real calendar day." };
  if (evidence.toLowerCase().includes(day)) return { ok: true, startAt: day };
  const [, monthText, dayText] = day.split("-");
  const month = Number(monthText);
  const date = Number(dayText);
  const names = MONTHS.find((row) => row.month === month)?.names ?? [];
  if (!names.some((name) => hasToken(evidence, name)) || !dayAppears(evidence, date)) {
    return { ok: false, reason: "This ISO date is not the civil date stated in the input." };
  }
  const years = yearsIn(evidence);
  if (years.length > 1 && !years.includes(day.slice(0, 4))) {
    return { ok: false, reason: "This year is not one of the years stated in the input." };
  }
  if (years.length === 1 && years[0] !== day.slice(0, 4)) {
    return { ok: false, reason: "This year does not match the year stated in the input." };
  }
  if (years.length === 0) {
    const resolved = nextOccurrenceIso(month, date, referenceDate);
    if (!resolved || resolved !== day) {
      return {
        ok: false,
        reason: "The year is not stated, and this ISO date is not the next occurrence of that month and day.",
      };
    }
  }
  return { ok: true, startAt: day };
}

function relativeAmount(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isInteger(number) || number < 1 || number > 520) return null;
  return number;
}

function relativeUnit(value: unknown): "days" | "weeks" | null {
  const unit = asString(value).toLowerCase();
  if (unit === "day" || unit === "days") return "days";
  if (unit === "week" || unit === "weeks") return "weeks";
  return null;
}

export function decideMilestoneDate(args: {
  values: Record<string, unknown>;
  evidence: string;
  referenceDate: string;
  canonicalDate?: string;
}): DateDecision {
  const intent = asString(args.values.dateIntent).toLowerCase();
  if (!intent || !isDateIntent(intent)) {
    return { kind: "needs_you", reason: "This milestone date has no supported date intent." };
  }
  if (intent === "historical") {
    return {
      kind: "no_change",
      reason: "This describes a former date, so it does not change the current milestone.",
    };
  }
  if (intent === "uncertain") {
    return { kind: "needs_you", reason: "The current milestone date is not established." };
  }
  if (intent === "move_relative") {
    const direction = asString(args.values.direction).toLowerCase();
    if (direction !== "earlier" && direction !== "later") {
      return { kind: "needs_you", reason: "A relative milestone move needs a direction of earlier or later." };
    }
    const amount = relativeAmount(args.values.amount);
    const unit = relativeUnit(args.values.unit);
    if (!amount || !unit) {
      return { kind: "needs_you", reason: "A relative milestone move needs a number of days or weeks." };
    }
    const canonical = args.canonicalDate ? isoDay(args.canonicalDate) : null;
    if (!canonical) {
      return {
        kind: "needs_you",
        reason: "This milestone has no canonical date, so a relative move cannot be calculated.",
      };
    }
    const startAt = shiftIsoDate(canonical, direction, amount, unit);
    if (!startAt) return { kind: "needs_you", reason: "This relative milestone move cannot be calculated." };
    if (startAt === canonical) {
      return { kind: "no_change", reason: "This date is already recorded." };
    }
    return { kind: "ready", startAt };
  }
  const proposed = asString(args.values.date) || asString(args.values.startAt);
  const grounded = explicitDateIsGrounded(args.evidence, proposed, args.referenceDate);
  if (!grounded.ok) return { kind: "needs_you", reason: grounded.reason };
  const canonical = args.canonicalDate ? isoDay(args.canonicalDate) : null;
  if (canonical && canonical === grounded.startAt) {
    return { kind: "no_change", reason: "This date is already recorded." };
  }
  return { kind: "ready", startAt: grounded.startAt };
}
