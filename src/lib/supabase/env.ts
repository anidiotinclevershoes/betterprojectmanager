/**
 * Shared env helpers for Supabase clients.
 * Prefer ANON_KEY; PUBLISHABLE_KEY accepted as alias (newer Supabase naming).
 */
export function getSupabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

export function getSupabaseAnonKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return (
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    undefined
  );
}

export function getSupabaseServiceRoleKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

export function isSupabaseConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(getSupabaseUrl(env) && getSupabaseAnonKey(env));
}
