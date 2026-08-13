/**
 * Persistence mode for MissionState.
 *
 * Production → always Supabase when configured; never silent localStorage.
 * Development → local for demo/regression; supabase when authenticated product path.
 */
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type LumePersistenceMode = "local" | "supabase";

export function getPersistenceMode(
  env: NodeJS.ProcessEnv = process.env,
): LumePersistenceMode {
  const raw = (env.LUME_PERSISTENCE || "").trim().toLowerCase();
  const authForced = (env.LUME_AUTH || "").trim().toLowerCase();
  const prod = (env.NODE_ENV || process.env.NODE_ENV) === "production";
  const allowLocal = env.LUME_ALLOW_LOCAL_IN_PRODUCTION === "true";

  if (prod) {
    if (raw === "local" && allowLocal) return "local";
    return "supabase";
  }

  if (raw === "local") return "local";
  if (raw === "supabase") return "supabase";
  if (authForced === "demo") return "local";
  if (isSupabaseConfigured(env)) return "supabase";
  return "local";
}

export function usesSupabasePersistence(
  env?: NodeJS.ProcessEnv,
): boolean {
  return getPersistenceMode(env) === "supabase";
}
