import { createLocalRepositories } from "@/lib/data/local/repositories";
import { createSupabaseRepositories } from "@/lib/data/supabase/repositories";
import type { LumeDataRepositories } from "@/lib/data/types";
import {
  getPersistenceMode,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve repositories for the current persistence mode.
 *
 * Default: local (MissionState / localStorage remains the live UI path).
 * Supabase mode requires a client + configured env.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDataRepositories(
  supabaseClient?: SupabaseClient<any>,
): LumeDataRepositories {
  const mode = getPersistenceMode();
  if (mode === "supabase") {
    if (!isSupabaseConfigured()) {
      throw new Error(
        "LUME_PERSISTENCE=supabase but Supabase env vars are missing.",
      );
    }
    if (!supabaseClient) {
      throw new Error(
        "Supabase repositories require an authenticated Supabase client.",
      );
    }
    return createSupabaseRepositories(supabaseClient);
  }
  return createLocalRepositories();
}

export type { LumeDataRepositories } from "@/lib/data/types";
