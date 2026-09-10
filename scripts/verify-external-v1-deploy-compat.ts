/**
 * Expand/compatible deploy proof for remaining hosted schema catch-up.
 * Credential-free. Does not talk to production.
 *
 * After PR #150, origin/main already calls create_project_bundle.
 * Production Vercel is on that SHA. The remaining production SQL is the
 * additive catch-up for columns/tables hosted never received.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function gitShow(refPath: string) {
  return execSync(`git show ${refPath}`, {
    cwd: ROOT,
    encoding: "utf8",
  });
}

const safety = read("supabase/migrations/20260909160000_external_v1_safety.sql");
const createSql = read("supabase/migrations/20260909210000_create_project_bundle.sql");
const catchup = read(
  "supabase/migrations/20260910120000_hosted_canonical_schema_catchup.sql",
);
const persist = read("src/lib/data/supabase/persist-mutations.ts");
const mainPersist = gitShow("origin/main:src/lib/data/supabase/persist-mutations.ts");

check("V1 RPC migrations remain additive — no drop table / no column rewrite", () => {
  for (const sql of [safety, createSql, catchup]) {
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /alter table[\s\S]{0,80}drop column/i);
    assert.doesNotMatch(sql, /alter table[\s\S]{0,80}rename/i);
  }
  assert.match(safety, /create or replace function public.delete_project_bundle/);
  assert.match(createSql, /create or replace function public.create_project_bundle/);
  assert.match(catchup, /add column if not exists kind text;/);
});

check("tighter RLS is membership PLUS project-in-workspace, not a new tenancy model", () => {
  assert.match(safety, /is_workspace_member\(workspace_id\)/);
  assert.match(safety, /project_belongs_to_workspace\(workspace_id, project_id\)/);
  assert.doesNotMatch(safety, /security definer/);
  assert.match(createSql, /security invoker/);
});

check("origin/main already requires create_project_bundle (PR #150 is merged)", () => {
  assert.match(mainPersist, /rpc\("create_project_bundle"/);
  assert.match(persist, /rpc\("create_project_bundle"/);
  const createFn = persist.slice(
    persist.indexOf("export async function persistNewProject"),
    persist.indexOf("export async function persistTodoCreate"),
  );
  assert.doesNotMatch(createFn, /\.from\("projects"\)\s*\.insert/);
});

check("catch-up is the remaining hosted SQL — do not edit the already-applied RPC file", () => {
  const actions = read("docs/V1_USER_ACTIONS.md");
  assert.match(actions, /20260910120000_hosted_canonical_schema_catchup\.sql/);
  assert.match(actions, /hosted-schema-audit\.sql/);
  assert.match(actions, /Stop the invite rollout/);
  assert.match(actions, /Do not edit already-applied V1 SQL/);
});

console.log(`\n${passed} external-V1 deploy-compat checks passed.`);
