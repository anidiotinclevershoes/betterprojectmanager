/** Canonical date helpers for form inputs (YYYY-MM-DD) and validation. */

export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function compareDateInputs(a: string, b: string): number {
  if (!isValidDateInput(a) || !isValidDateInput(b)) return 0;
  return a.localeCompare(b);
}

/** Release must be on or after merge. Empty values are not considered invalid yet. */
export function mergeReleaseDateError(
  mergeDate: string,
  releaseDate: string,
): string | null {
  if (!mergeDate || !releaseDate) return null;
  if (!isValidDateInput(mergeDate)) return "Merge date is not a valid date.";
  if (!isValidDateInput(releaseDate)) return "Release date is not a valid date.";
  if (compareDateInputs(releaseDate, mergeDate) < 0) {
    return "Release date must be on or after the merge date.";
  }
  return null;
}

export function dateInputToIso(value: string, hour = 9): string | undefined {
  if (!value || !isValidDateInput(value)) return undefined;
  return new Date(`${value}T${String(hour).padStart(2, "0")}:00:00`).toISOString();
}

export function formatDateDisplay(isoOrInput?: string | null): string {
  if (!isoOrInput) return "—";
  const iso = isoOrInput.includes("T")
    ? isoOrInput
    : isValidDateInput(isoOrInput)
      ? `${isoOrInput}T12:00:00`
      : isoOrInput;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const FRAME_TRANSITION_MS = 700;
