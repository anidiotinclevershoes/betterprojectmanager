/**
 * Test-only persist backends for long-haul.
 * Live mode requires a real disposable Supabase. Fake is deterministic-only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadMissionStateFromSupabase } from "../../src/lib/data/supabase/load-mission-state";
import type { MissionState } from "../../src/lib/types";
import { FakeWorkspaceClient } from "../lib/fake-supabase-workspace";

export type PersistBackend = {
  kind: "fake" | "supabase";
  workspaceId: string;
  userId: string;
  client: SupabaseClient;
  load(): Promise<MissionState>;
  historyCount(projectId: string): Promise<number>;
};

export function supabaseLiveConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && anon && service);
}

export function missingLivePersistReason() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() &&
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  ) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  return missing.length
    ? `LIVE RUN BLOCKED — TEST DATABASE REQUIRED (${missing.join(", ")})`
    : null;
}

export function createFakeBackend(): PersistBackend {
  const fake = new FakeWorkspaceClient();
  return {
    kind: "fake",
    workspaceId: fake.workspaceId,
    userId: fake.userId,
    client: fake as unknown as SupabaseClient,
    async load() {
      return (await loadMissionStateFromSupabase(fake as never)).state;
    },
    async historyCount(projectId) {
      return fake.tables.history_events.filter((row) => row.project_id === projectId)
        .length;
    },
  };
}

export async function createSupabaseBackend(): Promise<PersistBackend> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const anon = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = "hulk-live-100@example.test";
  const password = "HulkLive100!pass";

  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of listed.data.users) {
    if (user.email === email) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Hulk Live 100" },
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? "admin.createUser failed");
  }
  const userId = created.data.user.id;

  const user = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await user.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.user) {
    throw new Error(signed.error?.message ?? "signInWithPassword failed");
  }

  let workspaceId: string | null = null;
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.workspace_id) {
      workspaceId = String(data.workspace_id);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!workspaceId) {
    throw new Error("Signup trigger did not create a personal workspace");
  }

  return {
    kind: "supabase",
    workspaceId,
    userId,
    client: user,
    async load() {
      return (await loadMissionStateFromSupabase(user)).state;
    },
    async historyCount(projectId) {
      const { count, error } = await user
        .from("history_events")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  };
}
