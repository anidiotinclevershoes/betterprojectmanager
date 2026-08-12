import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

/**
 * Service-role client — SERVER ONLY.
 *
 * Why it exists:
 * - Isolation test setup (create users / seed cross-tenant fixtures)
 * - Future admin/bootstrap that must bypass RLS briefly
 *
 * Rules:
 * - Never import from Client Components
 * - Never expose via NEXT_PUBLIC_*
 * - Never use for normal user CRUD (use createServerSupabaseClient)
 */
export function createServiceSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      "Service role Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
