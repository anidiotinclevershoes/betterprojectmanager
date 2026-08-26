/**
 * New Project V2 — experimental path.
 * Unset / "0" = legacy Talk assemble. "1" = observation map + categorisation approval.
 */

export function isNewProjectV2Enabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.LUME_NEW_PROJECT_V2?.trim();
  return raw === "1" || raw === "true";
}
