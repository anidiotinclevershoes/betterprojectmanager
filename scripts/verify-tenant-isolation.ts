/**
 * Live tenant isolation tests against a real Supabase project.
 *
 * Requires (server-side / .env.local — do not paste service role into chat):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * If credentials are missing, exits 0 with SKIPPED (structural verify covers CI).
 * If credentials are present, creates User A / User B fixtures and asserts RLS.
 */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRepositories } from "../src/lib/data/supabase/repositories";
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
    "SKIPPED: live tenant isolation tests require NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  console.log(
    "See docs/SUPABASE_SETUP_FOR_TOM.md — then re-run: npm run verify:tenant-isolation",
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
const emailA = `lume-iso-a-${stamp}@example.com`;
const emailB = `lume-iso-b-${stamp}@example.com`;
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
  console.log("Running live tenant isolation against Supabase…");
  userA = await ensureUser(emailA, password);
  userB = await ensureUser(emailB, password);

  const clientA = userClient(userA.accessToken);
  const clientB = userClient(userB.accessToken);
  const repoA = createSupabaseRepositories(clientA);
  const repoB = createSupabaseRepositories(clientB);

  let workspacesA = await repoA.workspaces.listForCurrentUser();
  let workspacesB = await repoB.workspaces.listForCurrentUser();
  if (!workspacesA.length) {
    const id = await repoA.workspaces.createPersonal("Workspace A");
    workspacesA = [{ id, name: "Workspace A", role: "owner" }];
  }
  if (!workspacesB.length) {
    const id = await repoB.workspaces.createPersonal("Workspace B");
    workspacesB = [{ id, name: "Workspace B", role: "owner" }];
  }

  const workspaceA = workspacesA[0]!;
  const workspaceB = workspacesB[0]!;

  const projectA = await repoA.projects.create({
    workspaceId: workspaceA.id,
    name: "Project A",
    code: "PROJA",
    summary: "Tenant A project",
    createdBy: userA.id,
  });
  const projectB = await repoB.projects.create({
    workspaceId: workspaceB.id,
    name: "Project B",
    code: "PROJB",
    summary: "Tenant B project",
    createdBy: userB.id,
  });

  const todoA = await repoA.todos.create({
    workspaceId: workspaceA.id,
    projectId: projectA,
    title: "Todo A",
    createdBy: userA.id,
  });
  const riskA = await repoA.risks.create({
    workspaceId: workspaceA.id,
    projectId: projectA,
    title: "Risk A",
    createdBy: userA.id,
  });
  const knowledgeA = await repoA.knowledge.create({
    workspaceId: workspaceA.id,
    projectId: projectA,
    section: "decisions",
    body: "CAB needs the pack 48h before",
    createdBy: userA.id,
  });
  const captureA = await repoA.captureSessions.create({
    workspaceId: workspaceA.id,
    projectId: projectA,
    transcript: "Capture A transcript",
    createdBy: userA.id,
  });
  const historyA = await repoA.history.create({
    workspaceId: workspaceA.id,
    projectId: projectA,
    type: "other",
    title: "History A",
    createdBy: userA.id,
  });

  const riskB = await repoB.risks.create({
    workspaceId: workspaceB.id,
    projectId: projectB,
    title: "Risk B",
    createdBy: userB.id,
  });

  await check("User A can read Project A", async () => {
    const row = await repoA.projects.getById(projectA);
    assert.ok(row);
    assert.equal(row!.id, projectA);
  });

  await check("User A can create todos in Workspace A", async () => {
    assert.ok(todoA);
  });

  await check("User A CANNOT read Project B", async () => {
    const row = await repoA.projects.getById(projectB);
    assert.equal(row, null);
  });

  await check("User A CANNOT update Project B", async () => {
    const { data } = await clientA
      .from("projects")
      .update({ name: "Hacked" })
      .eq("id", projectB)
      .select("id");
    assert.equal((data ?? []).length, 0);
    const still = await repoB.projects.getById(projectB);
    assert.equal(still?.name, "Project B");
  });

  await check("User A CANNOT delete Project B", async () => {
    const { data } = await clientA
      .from("projects")
      .delete()
      .eq("id", projectB)
      .select("id");
    assert.equal((data ?? []).length, 0);
    const still = await repoB.projects.getById(projectB);
    assert.ok(still);
  });

  await check("User A CANNOT create child against Project B", async () => {
    const { data, error } = await clientA
      .from("todos")
      .insert({
        workspace_id: workspaceB.id,
        project_id: projectB,
        title: "Illegal todo",
      })
      .select("id");
    assert.ok(error || !(data && data.length));
  });

  await check("User A CANNOT read User B risk by UUID", async () => {
    const { data } = await clientA
      .from("risks")
      .select("id")
      .eq("id", riskB)
      .maybeSingle();
    assert.equal(data, null);
  });

  await check("User A CANNOT update User B risk", async () => {
    const { data } = await clientA
      .from("risks")
      .update({ title: "Stolen" })
      .eq("id", riskB)
      .select("id");
    assert.equal((data ?? []).length, 0);
  });

  await check("User A CANNOT delete User B risk", async () => {
    const { data } = await clientA
      .from("risks")
      .delete()
      .eq("id", riskB)
      .select("id");
    assert.equal((data ?? []).length, 0);
  });

  await check("User B CANNOT read Project A", async () => {
    const row = await repoB.projects.getById(projectA);
    assert.equal(row, null);
  });

  await check("User B CANNOT read nested A entities by UUID", async () => {
    for (const [table, id] of [
      ["todos", todoA],
      ["risks", riskA],
      ["knowledge_items", knowledgeA],
      ["capture_sessions", captureA],
      ["history_events", historyA],
    ] as const) {
      const { data } = await clientB
        .from(table)
        .select("id")
        .eq("id", id)
        .maybeSingle();
      assert.equal(data, null, `${table} leaked to User B`);
    }
  });

  await check("Guessed random UUID does not bypass RLS", async () => {
    const fake = "00000000-0000-4000-8000-000000000099";
    const { data } = await clientA
      .from("projects")
      .select("id")
      .eq("id", fake)
      .maybeSingle();
    assert.equal(data, null);
  });

  console.log(`\n${passed} live tenant isolation checks passed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (userA) await cleanupUser(userA.id);
      if (userB) await cleanupUser(userB.id);
    } catch (err) {
      console.warn("Cleanup warning:", err);
    }
  });
