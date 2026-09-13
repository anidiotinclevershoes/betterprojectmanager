/**
 * Observation-local title evidence for Risk / To Do / milestone identity.
 *
 * A model-supplied UUID is not identity. Bind an existing record only when
 * observation-local text names that record's title.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Recorded title as a whole phrase. Exact phrase only. */
export function recordedTitleAppearsInText(
  text: string,
  recordedTitle: string,
): boolean {
  const title = recordedTitle.trim().replace(/\s+/g, " ");
  if (!title || !text.trim()) return false;
  const re = new RegExp(`\\b${escapeRegExp(title)}\\b`, "i");
  return re.test(text);
}

const TITLE_EVIDENCE_STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "to",
  "for",
  "on",
  "in",
  "at",
  "is",
  "risk",
  "detail",
  "outstanding",
]);

/**
 * True when observation-local text names the recorded title.
 * Exact phrase, or at least two significant title words.
 */
export function recordedTitleEvidencedInText(
  text: string,
  recordedTitle: string,
): boolean {
  if (recordedTitleAppearsInText(text, recordedTitle)) return true;
  const words = recordedTitle
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word && !TITLE_EVIDENCE_STOP.has(word));
  if (words.length === 0) return false;
  const hay = text.toLowerCase();
  const hits = words.filter((word) => hay.includes(word));
  return hits.length >= Math.min(2, words.length);
}

export function titlesCompatible(proposed: string, recorded: string): boolean {
  const a = proposed.trim().replace(/\s+/g, " ").toLowerCase();
  const b = recorded.trim().replace(/\s+/g, " ").toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
