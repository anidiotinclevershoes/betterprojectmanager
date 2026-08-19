/**
 * Structural verification that tenant RLS policies exist in migrations.
 * Always runs without network / credentials.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const schemaPath = path.join(
  root,
  "supabase/migrations/20260812002748_workspace_schema.sql",
);
const rlsPath = path.join(
  root,
  "supabase/migrations/20260812002749_tenant_rls.sql",
);

const schema = fs.readFileSync(schemaPath, "utf8");
const rls = fs.readFileSync(rlsPath, "utf8");

const tables = [
  "profiles",
  "workspaces",
  "workspace_members",
  "projects",
  "stakeholders",
  "todos",
  "risks",
  "knowledge_items",
  "milestones",
  "memories",
  "recommendations",
  "meetings",
  "releases",
  "capture_sessions",
  "history_events",
  "coach_sessions",
  "workspace_preferences",
  "workspace_usage",
];

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

check("schema migration creates workspaces + members", () => {
  assert.match(schema, /create table public\.workspaces/i);
  assert.match(schema, /create table public\.workspace_members/i);
  assert.match(schema, /create table public\.projects/i);
  assert.match(schema, /create table public\.todos/i);
  assert.match(schema, /create table public\.risks/i);
  assert.match(schema, /create table public\.knowledge_items/i);
  assert.match(schema, /create table public\.capture_sessions/i);
  assert.match(schema, /create table public\.history_events/i);
});

check("schema uses workspace_id ownership", () => {
  assert.match(schema, /workspace_id uuid not null references public\.workspaces/i);
  assert.match(schema, /is_workspace_member/i);
  assert.match(schema, /create_workspace_with_owner/i);
  assert.match(schema, /handle_new_user/i);
});

check("business dates use date columns where appropriate", () => {
  assert.match(schema, /due_on date/i);
  assert.match(schema, /start_on date/i);
  assert.match(schema, /next_milestone_on date/i);
});

for (const table of tables) {
  check(`RLS enabled on ${table}`, () => {
    assert.match(
      rls,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
  });
}

check("projects have select/insert/update/delete member policies", () => {
  assert.match(rls, /policy projects_select_member/i);
  assert.match(rls, /policy projects_insert_member/i);
  assert.match(rls, /policy projects_update_member/i);
  assert.match(rls, /policy projects_delete_member/i);
});

check("nested entities require workspace membership", () => {
  for (const t of [
    "todos",
    "risks",
    "knowledge_items",
    "capture_sessions",
    "history_events",
  ]) {
    assert.match(rls, new RegExp(`policy ${t}_select_member`, "i"));
    assert.match(rls, new RegExp(`policy ${t}_insert_member`, "i"));
    assert.match(rls, new RegExp(`policy ${t}_delete_member`, "i"));
  }
});

check("policies use is_workspace_member / auth.uid", () => {
  assert.match(rls, /is_workspace_member\(workspace_id\)/i);
  assert.match(rls, /auth\.uid\(\)/i);
});

check("membership helper bypasses row security under FORCE RLS", () => {
  assert.match(schema, /set row_security = off/i);
  assert.match(
    rls,
    /workspace_members_select_member[\s\S]*user_id = auth\.uid\(\)/i,
  );
});

check("authenticated role is granted table access", () => {
  assert.match(schema, /grant select, insert, update, delete on table/i);
  assert.match(schema, /to authenticated, service_role/i);
});

const fixPath = path.join(
  root,
  "supabase/migrations/20260812195500_fix_grants_and_membership_helper.sql",
);
check("fix migration exists for already-applied projects", () => {
  assert.equal(fs.existsSync(fixPath), true);
  const fix = fs.readFileSync(fixPath, "utf8");
  assert.match(fix, /grant select, insert, update, delete on table/i);
  assert.match(fix, /set row_security = off/i);
});

console.log(`\n${passed} RLS/schema structural checks passed.`);
