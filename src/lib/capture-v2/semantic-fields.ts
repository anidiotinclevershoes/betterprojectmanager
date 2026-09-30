/**
 * Deterministic field contract for Capture observations.
 * Corrects model field loss against the explicit source quote.
 * Not a second extractor and not a general scheduler.
 */
import type { CaptureObservationV2 } from "./types";

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const START_DATE_KEYS = ["date", "startAt", "dueDate", "dueAt", "awayFromIso"] as const;
const END_DATE_KEYS = ["endAt", "awayToIso"] as const;

/** UTC calendar day. Tests pass this in; production uses the clock. */
export function captureReferenceDate(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isoDay(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parsedIso(value: unknown): { year: number; month: number; day: number; iso: string } | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const iso = isoDay(year, month, day);
  if (!iso) return null;
  return { year, month, day, iso };
}

function calendarDays(text: string): Array<{ month: number; day: number }> {
  const pattern =
    /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)|(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?)\b/gi;
  const found: Array<{ month: number; day: number }> = [];
  for (const match of text.matchAll(pattern)) {
    const day = Number(match[1] || match[4]);
    const monthName = (match[2] || match[3] || "").toLowerCase();
    const month = MONTH_INDEX[monthName];
    if (!month || day < 1 || day > 31) continue;
    found.push({ month, day });
  }
  return found;
}

function explicitYears(text: string): number[] {
  return [...text.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => Number(match[0]));
}

function namedWeekday(text: string): number | null {
  if (calendarDays(text).length > 0) return null;
  const found = new Set<number>();
  const pattern =
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/gi;
  for (const match of text.matchAll(pattern)) {
    const day = WEEKDAY_INDEX[match[1]!.toLowerCase()];
    if (day !== undefined) found.add(day);
  }
  if (found.size !== 1) return null;
  return [...found][0]!;
}

function distinctCalendarDays(text: string): Array<{ month: number; day: number }> {
  const seen = new Set<string>();
  const days: Array<{ month: number; day: number }> = [];
  for (const day of calendarDays(text)) {
    const key = `${day.month}-${day.day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    days.push(day);
  }
  return days;
}

function textHasDay(text: string, month: number, day: number): boolean {
  return calendarDays(text).some((found) => found.month === month && found.day === day);
}

/** A month name with no day number is not a date. A single weekday is left for weekday resolution. */
function monthWithoutDay(text: string): boolean {
  if (calendarDays(text).length > 0 || namedWeekday(text) !== null) return false;
  return /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
    text,
  );
}

/**
 * A milestone end is real only when this observation quotes two different
 * calendar days and the transcript also states the end day.
 * Model evidence cannot invent a second day the transcript never said.
 */
function milestoneEndAllowed(args: {
  evidence: string;
  transcript: string;
  end: { month: number; day: number } | null;
}): boolean {
  if (!args.end) return false;
  const authority = args.transcript.trim() ? args.transcript : args.evidence;
  if (distinctCalendarDays(authority).length < 2) return false;
  if (distinctCalendarDays(args.evidence).length < 2) return false;
  return (
    textHasDay(authority, args.end.month, args.end.day) &&
    textHasDay(args.evidence, args.end.month, args.end.day)
  );
}

function contextualYearDay(
  referenceDate: string,
  month: number,
  day: number,
  explicitYear?: number,
): string | null {
  if (explicitYear) return isoDay(explicitYear, month, day);
  const reference = parsedIso(referenceDate);
  if (!reference) return null;
  const sameYear = isoDay(reference.year, month, day);
  if (!sameYear) return null;
  const candidate = Date.UTC(reference.year, month - 1, day);
  const referenceUtc = Date.UTC(reference.year, reference.month - 1, reference.day);
  if (candidate >= referenceUtc) return sameYear;
  return isoDay(reference.year + 1, month, day);
}

function nextWeekdayOnOrAfter(referenceDate: string, weekday: number): string | null {
  const reference = parsedIso(referenceDate);
  if (!reference) return null;
  const date = new Date(Date.UTC(reference.year, reference.month - 1, reference.day));
  const delta = (weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return isoDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Anchor one proposed ISO day to the reference date.
 * Returns undefined to leave the field untouched, null to drop an unsafe year.
 */
function anchorIso(args: {
  evidence: string;
  proposed: unknown;
  referenceDate: string;
  slot: "start" | "end";
}): string | null | undefined {
  if (monthWithoutDay(args.evidence)) return null;
  const days = calendarDays(args.evidence);
  const years = explicitYears(args.evidence);
  const proposed = parsedIso(args.proposed);
  const reference = parsedIso(args.referenceDate);
  const explicitYear = years.length === 1 ? years[0] : undefined;
  const historical = Boolean(proposed && reference && proposed.year < reference.year);

  if (days.length > 0) {
    const picked = args.slot === "end" ? (days.length >= 2 ? days[1] : null) : days[0];
    if (!picked) {
      if (historical && years.length === 0) return null;
      return proposed?.iso;
    }
    const anchored = contextualYearDay(
      args.referenceDate,
      picked.month,
      picked.day,
      explicitYear,
    );
    if (!anchored) return proposed?.iso;
    if (
      proposed &&
      proposed.month === picked.month &&
      proposed.day === picked.day &&
      !historical &&
      (!explicitYear || proposed.year === explicitYear)
    ) {
      return proposed.iso;
    }
    if (!proposed || historical || (explicitYear != null && proposed.year !== explicitYear)) {
      return anchored;
    }
    return proposed.iso;
  }

  if (args.slot === "start") {
    const weekday = namedWeekday(args.evidence);
    if (weekday !== null && historical) {
      return nextWeekdayOnOrAfter(args.referenceDate, weekday) ?? proposed?.iso;
    }
  }

  if (historical && years.length === 0) return null;
  return proposed?.iso;
}

function rewriteDates(
  observation: CaptureObservationV2,
  referenceDate: string,
  transcript: string,
): Record<string, unknown> {
  const values = { ...(observation.proposedValues ?? {}) };
  const evidence = `${observation.evidence}\n${observation.statement}`;
  const dated =
    observation.domain === "milestone" ||
    observation.domain === "todo" ||
    observation.domain === "availability";
  if (!dated) return values;

  for (const key of START_DATE_KEYS) {
    if (values[key] == null || values[key] === "") continue;
    const next = anchorIso({
      evidence,
      proposed: values[key],
      referenceDate,
      slot: "start",
    });
    if (next === null) delete values[key];
    else if (next) values[key] = next;
  }

  for (const key of END_DATE_KEYS) {
    const hasValue = values[key] != null && values[key] !== "";
    const next = anchorIso({
      evidence,
      proposed: hasValue ? values[key] : undefined,
      referenceDate,
      slot: "end",
    });
    if (!hasValue && next && observation.domain === "milestone" && key === "endAt") {
      const end = parsedIso(next);
      if (
        end &&
        milestoneEndAllowed({
          evidence,
          transcript,
          end,
        })
      ) {
        values[key] = next;
      }
      continue;
    }
    if (!hasValue) continue;
    if (next === null) delete values[key];
    else if (next) values[key] = next;
  }
  if (observation.domain === "milestone" && values.endAt) {
    const end = parsedIso(values.endAt);
    if (!milestoneEndAllowed({ evidence, transcript, end })) {
      delete values.endAt;
    }
  }

  const hasStart = START_DATE_KEYS.some((key) => values[key] != null && values[key] !== "");
  if (
    observation.domain === "todo" &&
    observation.disposition === "create_new" &&
    !hasStart
  ) {
    const weekdaySource = `${evidence}\n${asTrimmed(values.detail) ?? ""}`;
    const byWeekday = weekdaySource.match(
      /\bby\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
    );
    if (byWeekday && calendarDays(weekdaySource).length === 0) {
      const weekday = WEEKDAY_INDEX[byWeekday[1]!.toLowerCase()];
      const next = weekday === undefined ? null : nextWeekdayOnOrAfter(referenceDate, weekday);
      if (next) {
        values.dueDate = next;
        values.date = next;
      }
    }
  }

  return values;
}

function explicitPersonRole(evidence: string, proposed: unknown): string | undefined {
  const stated = asTrimmed(proposed);
  if (stated && evidence.toLowerCase().includes(stated.toLowerCase())) return stated;
  const match = evidence.match(
    /\bas the ([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){0,3})\b/,
  );
  return match?.[1];
}

function explicitRiskNotes(evidence: string, proposed: unknown): string | undefined {
  const stated = asTrimmed(proposed);
  if (stated) {
    const needle = stated.replace(/[.?!]+$/g, "").toLowerCase();
    return evidence.toLowerCase().includes(needle) ? stated : undefined;
  }
  const match = evidence.match(/\bbecause\s+(.+?)[.?!]?\s*$/i);
  const clause = match?.[1]?.trim();
  return clause || undefined;
}

const BY_MONTH =
  /\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;

function unstatedByMonth(text: string, evidence: string): boolean {
  const hits = text.match(BY_MONTH) ?? [];
  const source = evidence.toLowerCase();
  return hits.some((hit) => !source.includes(hit.toLowerCase()));
}

function adjustObservation(
  observation: CaptureObservationV2,
  referenceDate: string,
  transcript: string,
): CaptureObservationV2 {
  const values = rewriteDates(observation, referenceDate, transcript);
  let statement = observation.statement;

  if (observation.domain === "person" && observation.disposition === "create_new") {
    const role = explicitPersonRole(observation.evidence, values.role);
    if (role) values.role = role;
    else delete values.role;
  }

  if (observation.domain === "risk" && observation.disposition === "create_new") {
    const notes = explicitRiskNotes(observation.evidence, values.notes);
    if (notes) values.notes = notes;
    else delete values.notes;
  }

  if (observation.domain === "knowledge" || observation.domain === "decision") {
    const proposed = asTrimmed(values.text) ?? statement;
    if (unstatedByMonth(proposed, observation.evidence) || unstatedByMonth(statement, observation.evidence)) {
      const faithful = observation.evidence.trim().replace(/[.?!]+$/g, "");
      if (faithful) {
        statement = faithful;
        values.text = faithful;
      }
    }
  }

  return {
    ...observation,
    statement,
    proposedValues: Object.keys(values).length ? values : observation.proposedValues,
  };
}

function observationTitle(observation: CaptureObservationV2): string {
  const values = observation.proposedValues ?? {};
  return (
    asTrimmed(values.title) ||
    asTrimmed(values.label) ||
    observation.statement ||
    ""
  );
}

const TODO_QUALIFIER = /^(?:and\s+)?include\b/i;

/**
 * One requested action plus an "Include …" qualifier is one To Do.
 * Two independent actions are left alone.
 */
function foldTodoQualifiers(observations: CaptureObservationV2[]): CaptureObservationV2[] {
  const creates = observations.filter(
    (row) => row.domain === "todo" && row.disposition === "create_new",
  );
  if (creates.length < 2) return observations;
  const qualifiers = creates.filter((row) => TODO_QUALIFIER.test(observationTitle(row)));
  const primaries = creates.filter((row) => !TODO_QUALIFIER.test(observationTitle(row)));
  if (primaries.length !== 1 || qualifiers.length === 0) return observations;
  if (primaries.length + qualifiers.length !== creates.length) return observations;

  const primary = primaries[0]!;
  const extra = qualifiers
    .map((row) => observationTitle(row))
    .filter((title) => title && !TODO_QUALIFIER.test(asTrimmed(primary.proposedValues?.detail) ?? ""));
  const existing = asTrimmed(primary.proposedValues?.detail);
  const detail = [existing, ...extra.filter((title) => title !== existing)]
    .filter(Boolean)
    .join("\n");
  const qualifierIds = new Set(qualifiers.map((row) => row.id));
  const evidence = [primary.evidence, ...qualifiers.map((row) => row.evidence)]
    .filter(Boolean)
    .join(" ");

  return observations.map((row) => {
    if (row.id === primary.id) {
      return {
        ...row,
        evidence,
        proposedValues: { ...(row.proposedValues ?? {}), detail },
      };
    }
    if (!qualifierIds.has(row.id)) return row;
    return {
      ...row,
      disposition: "merge",
      mergeWithObservationId: primary.id,
    };
  });
}

export function applyCaptureSemanticContract(
  observations: CaptureObservationV2[],
  referenceDate: string,
  transcript = "",
): CaptureObservationV2[] {
  return foldTodoQualifiers(
    observations.map((observation) =>
      adjustObservation(observation, referenceDate, transcript),
    ),
  );
}
