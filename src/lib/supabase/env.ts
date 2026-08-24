/**
 * Shared env helpers for Supabase clients.
 * Prefer ANON_KEY; PUBLISHABLE_KEY accepted as alias (newer Supabase naming).
 *
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` into the **browser** bundle
 * when the member is a static access (`process.env.NEXT_PUBLIC_FOO`). Reading
 * `env.NEXT_PUBLIC_FOO` after `env = process.env` leaves those values undefined
 * in the client, so login (server) can work while item saves throw
 * "Supabase is not configured".
 */
export function getSupabaseUrl(
  env?: NodeJS.ProcessEnv,
): string | undefined {
  if (env && env !== process.env) {
    return env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

export function getSupabaseAnonKey(
  env?: NodeJS.ProcessEnv,
): string | undefined {
  if (env && env !== process.env) {
    return (
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      undefined
    );
  }
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    undefined
  );
}

export function getSupabaseServiceRoleKey(
  env?: NodeJS.ProcessEnv,
): string | undefined {
  if (env && env !== process.env) {
    return env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

export function isSupabaseConfigured(
  env?: NodeJS.ProcessEnv,
): boolean {
  return Boolean(getSupabaseUrl(env) && getSupabaseAnonKey(env));
}
