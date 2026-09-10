/**
 * Expand/compatible deploy proof for the external-V1 migrations vs current main.
 * Credential-free. Does not talk to production.
 *
 * Current main still creates/deletes via table inserts. The new SQL only adds
 * functions and tighter WITH CHECK predicates. Legitimate current-main writes
 * already name the project they just created, so migrate-first is safe.
 * New code calls the RPCs, so it must not deploy before the functions exist.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
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
const newPersist = read("src/lib/data/supabase/persist-mutations.ts");
const mainPersist = gitShow("origin/main:src/lib/data/supabase/persist-mutations.ts");

check("migrations are additive — no drop table / no column rewrite", () => {
  for (const sql of [safety, createSql]) {
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /alter table[\s\S]{0,80}drop column/i);
    assert.doesNotMatch(sql, /alter table[\s\S]{0,80}rename/i);
  }
  assert.match(safety, /create or replace function public.delete_project_bundle/);
  assert.match(safety, /create or replace function public.project_belongs_to_workspace/);
  assert.match(createSql, /create or replace function public.create_project_bundle/);
});

check("tighter RLS is membership PLUS project-in-workspace, not a new tenancy model", () => {
  assert.match(safety, /is_workspace_member\(workspace_id\)/);
  assert.match(safety, /project_belongs_to_workspace\(workspace_id, project_id\)/);
  assert.doesNotMatch(safety, /security definer/);
  assert.match(createSql, /security invoker/);
});

check("current main still uses table inserts — it does not require the new RPCs", () => {
  assert.doesNotMatch(mainPersist, /create_project_bundle/);
  assert.doesNotMatch(mainPersist, /delete_project_bundle/);
  assert.match(mainPersist, /from\("projects"\)[\s\S]*\.insert/);
  assert.match(mainPersist, /from\("stakeholders"\)[\s\S]*\.insert/);
  assert.match(mainPersist, /PROJECT_BUNDLE_SET_NULL_TABLES/);
});

check("new code requires the RPCs, so it must deploy after the migrations", () => {
  assert.match(newPersist, /rpc\("create_project_bundle"/);
  assert.match(newPersist, /rpc\("delete_project_bundle"/);
  const createFn = newPersist.slice(
    newPersist.indexOf("export async function persistNewProject"),
    newPersist.indexOf("export async function persistTodoCreate"),
  );
  assert.doesNotMatch(createFn, /\.from\("projects"\)\s*\.insert/);
});

check("deploy order documented as migrate → verify → merge/deploy", () => {
  const actions = read("docs/V1_USER_ACTIONS.md");
  assert.match(actions, /Apply both SQL files first/);
  assert.match(actions, /THEN merge/);
  assert.match(actions, /pg_proc/);
  assert.match(actions, /pg_get_expr\(pol\.polwithcheck/);
  assert.match(actions, /null_project_is_allowed/);
  assert.match(actions, /missing_named_project_is_rejected/);
  assert.doesNotMatch(actions, /\\df/);
});

console.log(`\n${passed} external-V1 deploy-compat checks passed.`);
