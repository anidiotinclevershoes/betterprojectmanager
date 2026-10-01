/**
 * Fail-closed date validation for Capture observations.
 *
 * Drops an extracted ISO date when its year is earlier than the reference
 * year and that year is not stated in the observation evidence or statement.
 * Does not interpret natural language, fill omitted dates, or rewrite fields.
 */
import type { CaptureObservationV2 } from "./types";

const DATE_KEYS = [
  "date",
  "startAt",
  "dueDate",
  "dueAt",
  "awayFromIso",
  "endAt",
  "awayToIso",
] as const;

/** UTC calendar day. Tests pass this in; production uses the clock. */
export function captureReferenceDate(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parsedYear(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return year;
}

function referenceYear(referenceDate: string): number | null {
  const match = referenceDate.trim().match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) return null;
  return Number(match[1]);
}

function sourceStatesYear(text: string, year: number): boolean {
  return new RegExp(`\\b${year}\\b`).test(text);
}

function rejectUnsafeHistoricalDates(
  observation: CaptureObservationV2,
  referenceDate: string,
): CaptureObservationV2 {
  const yearLimit = referenceYear(referenceDate);
  if (yearLimit == null) return observation;
  const values = { ...(observation.proposedValues ?? {}) };
  const source = `${observation.evidence}\n${observation.statement}`;
  let changed = false;
  for (const key of DATE_KEYS) {
    const year = parsedYear(values[key]);
    if (year == null) continue;
    if (year < yearLimit && !sourceStatesYear(source, year)) {
      delete values[key];
      changed = true;
    }
  }
  if (!changed) return observation;
  return { ...observation, proposedValues: values };
}

export function applyCaptureSemanticContract(
  observations: CaptureObservationV2[],
  referenceDate: string,
): CaptureObservationV2[] {
  return observations.map((observation) =>
    rejectUnsafeHistoricalDates(observation, referenceDate),
  );
}
