/**
 * Lightweight validation for data entering Supabase repositories.
 * Does not rewrite Capture validators — only persistence boundary checks.
 */

export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${field}: expected a non-empty string`);
  }
  return value.trim();
}

export function optionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("Expected string or null");
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function requireUuid(value: unknown, field: string): string {
  const s = requireNonEmptyString(value, field);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s,
    )
  ) {
    throw new Error(`Invalid ${field}: expected a UUID`);
  }
  return s;
}

export function requireDateOnly(value: unknown, field: string): string {
  const s = requireNonEmptyString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid ${field}: expected YYYY-MM-DD`);
  }
  return s;
}
