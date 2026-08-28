/**
 * Capture V2 is the only production Capture engine.
 * `LUME_CAPTURE_V2` is ignored so a missing or mis-set flag cannot
 * route Analyse/Apply back to the deleted legacy findings path.
 */
export function isCaptureV2Enabled(
  _env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return true;
}
