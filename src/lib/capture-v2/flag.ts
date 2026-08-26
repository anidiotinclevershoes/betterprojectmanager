/**
 * Capture V2 experimental path — flag only.
 * Unset / "0" = legacy Capture. "1" = observation extraction + resolver + Phase 3B apply.
 */

export function isCaptureV2Enabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.LUME_CAPTURE_V2?.trim();
  return raw === "1" || raw === "true";
}
