/**
 * Review-only Left untouched helpers.
 *
 * Never a canonical store, never an Apply write, never a substitute
 * for rematerialise / hydrate. Prompt A is unchanged — the disposition
 * is accepted when present, and coverage can synthesise it.
 */

export const LEFT_UNTOUCHED_GENERIC_REASON =
  "Lume couldn't safely interpret this part of your capture.";

export const LEFT_UNTOUCHED_MODEL_FALLBACK_REASON =
  "Lume could not safely turn this part of the capture into a project change, so it left it alone.";

export type LeftUntouchedSource = "model" | "coverage";

export function leftUntouchedReasonFromModel(
  commentary?: string | null,
): string {
  const trimmed = commentary?.trim();
  return trimmed || LEFT_UNTOUCHED_MODEL_FALLBACK_REASON;
}

export function isLeftUntouchedDisposition(
  value: string | null | undefined,
): boolean {
  return value === "left_untouched";
}

export function isLeftUntouchedValues(
  values?: Record<string, unknown> | null,
): boolean {
  return values?.leftUntouched === true;
}

export function leftUntouchedSourceFromValues(
  values?: Record<string, unknown> | null,
): LeftUntouchedSource | undefined {
  return values?.leftUntouchedSource === "model" ||
    values?.leftUntouchedSource === "coverage"
    ? values.leftUntouchedSource
    : undefined;
}
