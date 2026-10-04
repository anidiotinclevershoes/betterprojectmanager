/**
 * Shared Organise is opt-in.
 * Unset or any other value keeps the observation Capture path.
 */
export function isSharedOrganiseEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.LUME_SHARED_ORGANISE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}
