/**
 * Persistence mode for MissionState.
 *
 * - Explicit LUME_PERSISTENCE=local → localStorage (dev / regression)
 * - Explicit LUME_PERSISTENCE=supabase → Supabase
 * - Auto: Supabase configured (and not forced demo auth) → Supabase
 * - Otherwise → local
 *
 * Production with Supabase configured cannot accidentally stay on localStorage
 * unless LUME_ALLOW_LOCAL_IN_PRODUCTION=true (discouraged).
 */
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type LumePersistenceMode = "local" | "supabase";

export function getPersistenceMode(): LumePersistenceMode {
  const raw = (process.env.LUME_PERSISTENCE || "").trim().toLowerCase();
  const authForced = (process.env.LUME_AUTH || "").trim().toLowerCase();

  if (raw === "local") {
    if (
      process.env.NODE_ENV === "production" &&
      isSupabaseConfigured() &&
      process.env.LUME_ALLOW_LOCAL_IN_PRODUCTION !== "true"
    ) {
      return "supabase";
    }
    return "local";
  }
  if (raw === "supabase") return "supabase";

  // Forced demo auth keeps local MissionState for regression fixtures.
  if (authForced === "demo") return "local";

  if (isSupabaseConfigured()) return "supabase";
  if (process.env.NODE_ENV === "production" && isSupabaseConfigured()) {
    return "supabase";
  }
  return "local";
}

export function usesSupabasePersistence(): boolean {
  return getPersistenceMode() === "supabase";
}
