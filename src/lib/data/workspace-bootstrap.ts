import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseRepositories } from "@/lib/data/supabase/repositories";

const PERSONAL_WORKSPACE_NAME = "Personal Lume Workspace";

/**
 * Ensure the authenticated user has exactly one default personal workspace.
 * Prefer existing membership (from handle_new_user trigger); create only if none.
 * Idempotent and safe if signup/login race.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensurePersonalWorkspace(
  client: SupabaseClient<any>,
): Promise<{ workspaceId: string; created: boolean }> {
  const repos = createSupabaseRepositories(client);
  const existing = await repos.workspaces.listForCurrentUser();
  if (existing.length > 0) {
    // Prefer an exact Personal Lume Workspace name if present; else first.
    const preferred =
      existing.find((w) => w.name === PERSONAL_WORKSPACE_NAME) ?? existing[0]!;
    return { workspaceId: preferred.id, created: false };
  }

  // Prefer RPC that is race-safe under RLS
  const { data, error } = await client.rpc("ensure_personal_workspace");
  if (!error && data) {
    return { workspaceId: String(data), created: true };
  }

  // Fallback to Phase 1 RPC
  const id = await repos.workspaces.createPersonal(PERSONAL_WORKSPACE_NAME);
  return { workspaceId: id, created: true };
}

export { PERSONAL_WORKSPACE_NAME };
