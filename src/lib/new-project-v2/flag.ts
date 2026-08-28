/**
 * Historical flag. Talk/Paste no longer consults this — the live path always
 * uses shared Capture observation extraction, then the New Project adapter.
 */

export function isNewProjectV2Enabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.LUME_NEW_PROJECT_V2?.trim();
  return raw === "1" || raw === "true";
}
