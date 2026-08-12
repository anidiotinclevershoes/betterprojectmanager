/**
 * Shared env helpers for Supabase clients.
 * Prefer ANON_KEY; PUBLISHABLE_KEY accepted as alias (newer Supabase naming).
 */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    undefined
  );
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/** Persistence mode for future dual-write. Default remains local. */
export type LumePersistenceMode = "local" | "supabase";

export function getPersistenceMode(): LumePersistenceMode {
  const raw = (process.env.LUME_PERSISTENCE || "local").trim().toLowerCase();
  return raw === "supabase" ? "supabase" : "local";
}
