/**
 * Live Phase 2 application isolation + persistence checks.
 * Requires the same credentials as verify:tenant-isolation.
 * Skips cleanly when credentials are absent.
 */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRepositories } from "../src/lib/data/supabase/repositories";
import { ensurePersonalWorkspace } from "../src/lib/data/workspace-bootstrap";
import { persistNewProject } from "../src/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "../src/lib/supabase/env";

function loadDotEnvLocal() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

loadDotEnvLocal();

const url = getSupabaseUrl();
const anon = getSupabaseAnonKey();
const service = getSupabaseServiceRoleKey();

if (!url || !anon || !service) {
  console.log(
    "SKIPPED: Phase 2 live auth/persistence tests require Supabase credentials in .env.local",
  );
  process.exit(0);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function userClient(accessToken: string) {
  return createClient(url!, anon!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureUser(email: string, password: string) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: email.split("@")[0] },
  });
  if (
    created.error &&
    !/already|registered|exists/i.test(created.error.message)
  ) {
    throw created.error;
  }
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) throw listed.error;
  const user = listed.data.users.find((u) => u.email === email);
  if (!user) throw new Error(`Could not find user ${email}`);

  const signIn = await createClient(url!, anon!).auth.signInWithPassword({
    email,
    password,
  });
  if (signIn.error || !signIn.data.session) {
    throw signIn.error ?? new Error(`No session for ${email}`);
  }
  return {
    id: user.id,
    accessToken: signIn.data.session.access_token,
  };
}

async function cleanupUser(userId: string) {
  const { data: memberships } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);
  for (const m of memberships ?? []) {
    await admin.from("workspaces").delete().eq("id", m.workspace_id);
  }
  await admin.auth.admin.deleteUser(userId);
}

const stamp = Date.now();
const emailA = `lume-p2-a-${stamp}@example.com`;
const emailB = `lume-p2-b-${stamp}@example.com`;
const password = `TestPass-${stamp}!aA1`;

let userA: { id: string; accessToken: string } | null = null;
let userB: { id: string; accessToken: string } | null = null;
let passed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

async function main() {
  console.log("Running Phase 2 live auth + persistence checks…");
  userA = await ensureUser(emailA, password);
  userB = await ensureUser(emailB, password);
  const clientA = userClient(userA.accessToken);
  const clientB = userClient(userB.accessToken);

  await check("bootstrap personal workspace for user A", async () => {
    const { workspaceId } = await ensurePersonalWorkspace(clientA);
    assert.ok(workspaceId);
    const again = await ensurePersonalWorkspace(clientA);
    assert.equal(again.workspaceId, workspaceId);
  });

  await check("bootstrap personal workspace for user B", async () => {
    const { workspaceId } = await ensurePersonalWorkspace(clientB);
    assert.ok(workspaceId);
  });

  let projectAId = "";
  await check("create project persists for user A", async () => {
    const { workspaceId } = await ensurePersonalWorkspace(clientA);
    const bundle = await persistNewProject(clientA, workspaceId, userA!.id, {
      name: "Phase2 Project A",
      code: "P2A",
      summary: "Persisted project",
      currentFocus: "Prove persistence",
      sourceMode: "blank",
    });
    projectAId = bundle.project.id;
    assert.ok(projectAId);

    const loaded = await loadMissionStateFromSupabase(clientA);
    assert.ok(loaded.state.projects.some((p) => p.id === projectAId));
  });

  await check("user B cannot see user A project via list", async () => {
    const loaded = await loadMissionStateFromSupabase(clientB);
    assert.equal(
      loaded.state.projects.some((p) => p.id === projectAId),
      false,
    );
  });

  await check("user B cannot fetch user A project by id", async () => {
    const repos = createSupabaseRepositories(clientB);
    const row = await repos.projects.getById(projectAId);
    assert.equal(row, null);
  });

  await check("todo create/read persists for user A", async () => {
    const { workspaceId } = await ensurePersonalWorkspace(clientA);
    const repos = createSupabaseRepositories(clientA);
    const todoId = await repos.todos.create({
      workspaceId,
      projectId: projectAId,
      title: "Persisted todo",
      createdBy: userA!.id,
    });
    const listed = await repos.todos.listByProject(projectAId);
    assert.ok(listed.some((t) => t.id === todoId));

    const { data: asB } = await clientB
      .from("todos")
      .select("id")
      .eq("id", todoId);
    assert.equal((asB ?? []).length, 0);
  });

  console.log(`\n${passed} Phase 2 live auth/persistence checks passed.`);
}

main()
  .catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (userA) await cleanupUser(userA.id).catch(() => undefined);
    if (userB) await cleanupUser(userB.id).catch(() => undefined);
  });
