/**
 * The paired V4/V5 trial route may run on a Vercel preview, where the
 * project OpenAI key lives, and in local development. Production stays closed.
 */
export function sharedOrganiseTrialAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === "preview") return true;
  if (env.VERCEL_ENV === "production") return false;
  return env.NODE_ENV !== "production";
}
