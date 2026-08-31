/**
 * Live Postgres qualification for New Project tags, RLS, and code uniqueness.
 *
 * Prefers local Postgres (peer auth as postgres). Falls back to skip only when
 * neither local Postgres nor Supabase credentials are available.
 *
 * Run: npx tsx scripts/verify-new-project-live-db.ts
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const DB = "lume_new_project_closeout";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";

function psql(sql: string, opts?: { db?: string; asUser?: string }) {
  const args = [
    "-v",
    "ON_ERROR_STOP=1",
    "-d",
    opts?.db ?? "postgres",
    "-t",
    "-A",
    "-c",
    sql,
  ];
  const run = spawnSync("sudo", ["-u", "postgres", "psql", ...args], {
    encoding: "utf8",
    cwd: ROOT,
  });
  if (run.status !== 0) {
    throw new Error(
      `psql failed: ${run.stderr || run.stdout || `exit ${run.status}`}`,
    );
  }
  return (run.stdout ?? "").trim();
}

function psqlFile(path: string, db: string) {
  const run = spawnSync(
    "sudo",
    ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", db, "-f", path],
    { encoding: "utf8", cwd: ROOT },
  );
  if (run.status !== 0) {
    throw new Error(
      `psql -f ${path} failed: ${run.stderr || run.stdout || `exit ${run.status}`}`,
    );
  }
}

function lastUuid(text: string) {
  const match = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  );
  if (!match?.length) {
    throw new Error(`expected uuid in: ${text}`);
  }
  return match[match.length - 1]!;
}

function lastCount(text: string) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+$/.test(l));
  if (!lines.length) {
    throw new Error(`expected count in: ${text}`);
  }
  return Number(lines.at(-1));
}

function pgReady() {
  const run = spawnSync("sudo", ["-u", "postgres", "pg_isready"], {
    encoding: "utf8",
  });
  return run.status === 0;
}

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function asUser(userId: string, sql: string) {
  return psql(
    `select set_config('request.jwt.claim.sub', '${userId}', false);
     set role authenticated;
     ${sql}
     reset role;`,
    { db: DB },
  );
}

async function main() {
  if (!pgReady()) {
    console.log(
      "SKIPPED: live New Project DB qualification requires local Postgres (pg_isready) or apply against a disposable Supabase project.",
    );
    process.exit(0);
  }

  psql(`DROP DATABASE IF EXISTS ${DB};`);
  psql(`CREATE DATABASE ${DB};`);
  psql(
    `
    do $$ begin
      create role anon nologin;
    exception when duplicate_object then null; end $$;
    do $$ begin
      create role authenticated nologin;
    exception when duplicate_object then null; end $$;
    do $$ begin
      create role service_role nologin bypassrls;
    exception when duplicate_object then null; end $$;
    `,
    { db: DB },
  );
  psql(
    `
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to authenticated, anon, service_role;
    `,
    { db: DB },
  );

  const migrations = [
    "supabase/migrations/20260812002748_workspace_schema.sql",
    "supabase/migrations/20260812002749_tenant_rls.sql",
    "supabase/migrations/20260812195500_fix_grants_and_membership_helper.sql",
    "supabase/migrations/20260818230000_knowledge_canonical_metadata.sql",
    "supabase/migrations/20260831160000_project_retrieval_tags.sql",
  ];
  for (const rel of migrations) {
    const path = join(ROOT, rel);
    assert.equal(existsSync(path), true, rel);
    psqlFile(path, DB);
  }

  check("tag + code uniqueness migration applies on empty Postgres", () => {
    const idx = lastCount(
      psql(
        `select count(*) from pg_indexes where indexname = 'projects_workspace_code_lower_idx';`,
        { db: DB },
      ),
    );
    assert.equal(idx, 1);
    const tags = lastCount(
      psql(
        `select count(*) from information_schema.tables where table_schema='public' and table_name in ('project_tags','item_tags');`,
        { db: DB },
      ),
    );
    assert.equal(tags, 2);
  });

  check("duplicate project codes fail the uniqueness preflight without renaming rows", () => {
    psql(`drop index if exists public.projects_workspace_code_lower_idx;`, {
      db: DB,
    });
    const ws = lastUuid(
      psql(
        `insert into public.workspaces (name) values ('dup-ws') returning id;`,
        { db: DB },
      ),
    );
    psql(
      `insert into public.projects (workspace_id, name, code)
       values ('${ws}', 'One', 'MCU'), ('${ws}', 'Two', 'mcu');`,
      { db: DB },
    );
    const preflight = readFileSync(
      join(ROOT, "supabase/migrations/20260831160000_project_retrieval_tags.sql"),
      "utf8",
    );
    const block = preflight.slice(
      preflight.indexOf("do $$"),
      preflight.indexOf("create unique index if not exists"),
    );
    const run = spawnSync(
      "sudo",
      ["-u", "postgres", "psql", "-d", DB, "-v", "ON_ERROR_STOP=1", "-c", block],
      { encoding: "utf8" },
    );
    assert.notEqual(run.status, 0);
    assert.match(run.stderr + run.stdout, /duplicate project codes already exist/i);
    const still = lastCount(
      psql(
        `select count(*) from public.projects where workspace_id = '${ws}';`,
        { db: DB },
      ),
    );
    assert.equal(still, 2);
    psql(`delete from public.projects where workspace_id = '${ws}';`, { db: DB });
    psql(`delete from public.workspaces where id = '${ws}';`, { db: DB });
    psql(
      `create unique index if not exists projects_workspace_code_lower_idx
         on public.projects (workspace_id, lower(code));`,
      { db: DB },
    );
  });

  psql(
    `insert into auth.users (id, email, raw_user_meta_data) values
      ('${USER_A}', 'a@example.com', '{"display_name":"Alice"}'),
      ('${USER_B}', 'b@example.com', '{"display_name":"Bob"}');`,
    { db: DB },
  );

  const wsA = lastUuid(
    psql(
      `select workspace_id from public.workspace_members where user_id = '${USER_A}';`,
      { db: DB },
    ),
  );
  const wsB = lastUuid(
    psql(
      `select workspace_id from public.workspace_members where user_id = '${USER_B}';`,
      { db: DB },
    ),
  );
  assert.ok(wsA);
  assert.ok(wsB);
  assert.notEqual(wsA, wsB);

  const projA = lastUuid(
    asUser(
      USER_A,
      `insert into public.projects (workspace_id, name, code)
       values ('${wsA}', 'Claims', 'MCU') returning id;`,
    ),
  );
  const projB = lastUuid(
    asUser(
      USER_B,
      `insert into public.projects (workspace_id, name, code)
       values ('${wsB}', 'Other', 'OTH') returning id;`,
    ),
  );

  const tagA = lastUuid(
    asUser(
      USER_A,
      `insert into public.project_tags (workspace_id, project_id, name, slug, origin)
       values ('${wsA}', '${projA}', 'Release', 'release', 'custom') returning id;`,
    ),
  );

  check("custom tags persist and reload for the owning workspace", () => {
    const n = lastCount(
      asUser(
        USER_A,
        `select count(*) from public.project_tags where project_id = '${projA}' and slug = 'release';`,
      ),
    );
    assert.equal(n, 1);
  });

  check("RLS hides the other workspace's tags", () => {
    const n = lastCount(
      asUser(
        USER_B,
        `select count(*) from public.project_tags where project_id = '${projA}';`,
      ),
    );
    assert.equal(n, 0);
  });

  check("cannot attach a tag onto another workspace project", () => {
    const run = spawnSync(
      "sudo",
      [
        "-u",
        "postgres",
        "psql",
        "-d",
        DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `select set_config('request.jwt.claim.sub', '${USER_A}', false);
         set role authenticated;
         insert into public.item_tags (workspace_id, project_id, tag_id, target_kind, target_id)
         values ('${wsA}', '${projB}', '${tagA}', 'risk', gen_random_uuid());`,
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(run.status, 0);
  });

  check("cannot reference another project's tag", () => {
    const run = spawnSync(
      "sudo",
      [
        "-u",
        "postgres",
        "psql",
        "-d",
        DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `select set_config('request.jwt.claim.sub', '${USER_B}', false);
         set role authenticated;
         insert into public.item_tags (workspace_id, project_id, tag_id, target_kind, target_id)
         values ('${wsB}', '${projB}', '${tagA}', 'todo', gen_random_uuid());`,
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(run.status, 0);
  });

  const projA2 = lastUuid(
    asUser(
      USER_A,
      `insert into public.projects (workspace_id, name, code)
       values ('${wsA}', 'Sibling', 'SIB') returning id;`,
    ),
  );

  check("cannot attach a tag from a sibling project in the same workspace", () => {
    const run = spawnSync(
      "sudo",
      [
        "-u",
        "postgres",
        "psql",
        "-d",
        DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `select set_config('request.jwt.claim.sub', '${USER_A}', false);
         set role authenticated;
         insert into public.item_tags (workspace_id, project_id, tag_id, target_kind, target_id)
         values ('${wsA}', '${projA2}', '${tagA}', 'todo', gen_random_uuid());`,
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(run.status, 0);
  });

  check("item_tags foreign key rejects another project's tag even for table owner", () => {
    const run = spawnSync(
      "sudo",
      [
        "-u",
        "postgres",
        "psql",
        "-d",
        DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `insert into public.item_tags (workspace_id, project_id, tag_id, target_kind, target_id)
         values ('${wsA}', '${projA2}', '${tagA}', 'todo', gen_random_uuid());`,
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(run.status, 0);
    assert.match(
      `${run.stderr}\n${run.stdout}`,
      /item_tags_tag_matches_project_fk|foreign key/i,
    );
  });

  const riskA = lastUuid(
    asUser(
      USER_A,
      `insert into public.risks (workspace_id, project_id, title, status, source)
       values ('${wsA}', '${projA}', 'IDP delay', 'open', 'manual') returning id;`,
    ),
  );

  asUser(
    USER_A,
    `insert into public.item_tags (workspace_id, project_id, tag_id, target_kind, target_id)
     values ('${wsA}', '${projA}', '${tagA}', 'risk', '${riskA}');`,
  );

  check("item tags reload for the owner", () => {
    const n = lastCount(
      asUser(
        USER_A,
        `select count(*) from public.item_tags where project_id = '${projA}';`,
      ),
    );
    assert.equal(n, 1);
  });

  check("deleting the project cascades tags and associations", () => {
    asUser(USER_A, `delete from public.projects where id = '${projA}';`);
    const tags = lastCount(
      psql(
        `select count(*) from public.project_tags where project_id = '${projA}';`,
        { db: DB },
      ),
    );
    const items = lastCount(
      psql(
        `select count(*) from public.item_tags where project_id = '${projA}';`,
        { db: DB },
      ),
    );
    assert.equal(tags, 0);
    assert.equal(items, 0);
  });

  console.log(`\n${passed} live New Project DB/RLS checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
