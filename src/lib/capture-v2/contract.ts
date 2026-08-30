/**
 * Shared Ready / Apply semantic contract.
 *
 * One observation schema. Domain-specific required fields only.
 * Ready means Apply already has the reviewed values it will execute.
 * Missing values are Needs You — never invented, never guessed later.
 */
import type { CaptureObservationV2, ObservationDisposition } from "./types";

export function asUsableString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Planner-accepted ISO day. Not a natural-language date. */
export function isUsableIsoDate(value: unknown): boolean {
  const raw = asUsableString(value);
  if (!raw) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(raw);
}

export function firstUsableIsoDate(
  ...values: unknown[]
): string | undefined {
  for (const value of values) {
    const raw = asUsableString(value);
    if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  }
  return undefined;
}

const SKIP_DISPOSITIONS = new Set<ObservationDisposition>([
  "commentary",
  "ignore",
  "no_change",
  "merge",
  "ambiguous",
]);

/**
 * Deterministic Ready gate: fields Apply actually consumes.
 * Returns a Needs You reason, or null when the observation may proceed.
 */
export function missingReadySemantics(
  observation: CaptureObservationV2,
): string | null {
  if (SKIP_DISPOSITIONS.has(observation.disposition)) return null;
  if (observation.truthIntent !== "current") return null;

  const values = observation.proposedValues ?? {};
  const named =
    asUsableString(values.name) ||
    asUsableString(values.personName) ||
    asUsableString(observation.candidateTargetTitle);
  const title =
    asUsableString(values.title) ||
    asUsableString(values.label) ||
    asUsableString(observation.statement);
  const date = firstUsableIsoDate(
    values.date,
    values.startAt,
    values.dueAt,
    values.awayFromIso,
  );

  switch (observation.domain) {
    case "person":
      if (observation.disposition === "create_new" && !named) {
        return "A new person needs a name before Lume will write a stakeholder.";
      }
      return null;
    case "todo":
      if (observation.disposition === "create_new" && !title) {
        return "This To Do has no title.";
      }
      if (observation.disposition === "update_existing") {
        const status = asUsableString(values.status)?.toLowerCase();
        const completing =
          status === "resolved" ||
          status === "complete" ||
          status === "completed";
        if (
          !completing &&
          !date &&
          asUsableString(values.detail) == null
        ) {
          return "This To Do update is not specific enough to apply automatically.";
        }
      }
      return null;
    case "risk":
      if (observation.disposition === "create_new" && !title) {
        return "This Risk has no title.";
      }
      if (observation.disposition === "update_existing") {
        const status = asUsableString(values.status)?.toLowerCase();
        const legal =
          status === "resolved" ||
          status === "accepted" ||
          status === "open" ||
          status === "watch" ||
          status === "complete" ||
          status === "completed";
        if (!legal) {
          return "This Risk update is not specific enough to apply automatically.";
        }
      }
      return null;
    case "milestone":
      if (observation.disposition === "create_new") {
        if (!title) return "This date has no label.";
        if (!date) return "This date cannot be saved — the date is missing.";
      }
      if (observation.disposition === "update_existing" && !date) {
        return "This date change is not specific enough to apply automatically.";
      }
      return null;
    case "availability":
      if (!named) {
        return "This availability cannot be saved — Lume cannot tell which person it refers to.";
      }
      if (
        !firstUsableIsoDate(
          values.awayFromIso,
          values.date,
          values.from,
        )
      ) {
        return "This availability cannot be saved — the dates are not clear.";
      }
      return null;
    case "responsibility": {
      const personName =
        asUsableString(values.personName) ||
        asUsableString(values.name) ||
        asUsableString(observation.candidateTargetTitle);
      const scope =
        asUsableString(values.scope) ||
        asUsableString(observation.candidateTargetTitle);
      if (!personName || !scope || personName === scope) {
        return "This ownership change needs a person and a responsibility before it can be saved.";
      }
      const semantics = asUsableString(values.ownershipSemantics);
      if (
        semantics &&
        semantics !== "share" &&
        semantics !== "replace" &&
        semantics !== "continue" &&
        semantics !== "ambiguous"
      ) {
        return "This ownership change is not specific enough to apply automatically.";
      }
      return null;
    }
    case "knowledge":
    case "decision":
      if (!title && !asUsableString(values.text)) {
        return "This knowledge item has no text.";
      }
      return null;
    case "commentary":
    case "unknown":
      return "Unknown observation domain — no write.";
    default:
      return null;
  }
}
