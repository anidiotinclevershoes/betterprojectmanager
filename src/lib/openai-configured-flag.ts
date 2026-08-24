/**
 * Interprets `openaiConfigured` from an API payload.
 *
 * Only HTTP 200 with a boolean is known. Auth failures (401), unexpected
 * JSON, and network errors must stay unknown so the UI does not claim the
 * OpenAI key is missing when the probe simply could not run.
 */
export function readOpenaiConfiguredFlag(
  httpOk: boolean,
  data: unknown,
): boolean | null {
  if (!httpOk || data == null || typeof data !== "object") {
    return null;
  }
  const flag = (data as { openaiConfigured?: unknown }).openaiConfigured;
  return typeof flag === "boolean" ? flag : null;
}
