/**
 * Real Postgres proof that a hosted-like schema (Phase-1 + V1 RPCs, without
 * later additive files) fails New Project the way production did, and that
 * the forward catch-up makes a full bundle succeed and roll back cleanly.
 *
 * Skip when Postgres is unavailable unless LUME_REQUIRE_PG=1.
 *
 * Run: npx tsx scripts/prove-hosted-schema-lag.ts
 */
import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const REQUIRE = process.env.LUME_REQUIRE_PG === "1";

type Pg = {
  env: NodeJS.ProcessEnv;
  prefix: string[];
};

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function detectPg(): Pg | null {
  if (process.env.PGHOST || process.env.DATABASE_URL) {
    return { env: { ...process.env }, prefix: [] };
  }
  try {
    execSync("sudo -n -u postgres psql -d postgres -c 'select 1'", {
      stdio: "pipe",
    });
    return {
      env: { ...process.env },
      prefix: ["sudo", "-n", "-u", "postgres"],
    };
  } catch {
    return null;
  }
}

function psql(pg: Pg, database: string, sql: string): string {
  const args = [...pg.prefix, "psql", "-v", "ON_ERROR_STOP=1", "-d", database, "-tA", "-c", sql];
  const bin = args.shift() as string;
  return execFileSync(bin, args, {
    env: pg.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

function psqlFile(pg: Pg, database: string, file: string) {
  const args = [...pg.prefix, "psql", "-v", "ON_ERROR_STOP=1", "-d", database, "-f", file];
  const bin = args.shift() as string;
  execFileSync(bin, args, {
    env: pg.env,
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function createdb(pg: Pg, name: string) {
  try {
    const args = [...pg.prefix, "dropdb", "--if-exists", name];
    const bin = args.shift() as string;
    execFileSync(bin, args, { env: pg.env, stdio: "pipe" });
  } catch {
    /* ignore */
  }
  const args = [...pg.prefix, "createdb", name];
  const bin = args.shift() as string;
  execFileSync(bin, args, { env: pg.env, stdio: "pipe" });
}

function dropdb(pg: Pg, name: string) {
  const args = [...pg.prefix, "dropdb", "--if-exists", name];
  const bin = args.shift() as string;
  execFileSync(bin, args, { env: pg.env, stdio: "pipe" });
}

const pg = detectPg();
if (!pg) {
  if (REQUIRE) {
    throw new Error("Postgres is required (LUME_REQUIRE_PG=1) but was not reachable.");
  }
  console.log("SKIP prove-hosted-schema-lag: no local Postgres (set LUME_REQUIRE_PG=1 to require it).");
  process.exit(0);
}

const db = `lume_hosted_lag_${process.pid}`;
const stub = `
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
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;
`;

const hostedLag = [
  "supabase/migrations/20260812002748_workspace_schema.sql",
  "supabase/migrations/20260812002749_tenant_rls.sql",
  "supabase/migrations/20260812195500_fix_grants_and_membership_helper.sql",
  "supabase/migrations/20260812203000_phase2_ensure_personal_workspace.sql",
  "supabase/migrations/20260909160000_external_v1_safety.sql",
  "supabase/migrations/20260909210000_create_project_bundle.sql",
];

const catchup = "supabase/migrations/20260910120000_hosted_canonical_schema_catchup.sql";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const wsA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const wsB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const projectOkId = "33333333-3333-4333-8333-333333333333";
const projectFailId = "44444444-4444-4444-8444-444444444444";
const projectRetryId = "55555555-5555-4555-8555-555555555555";

function bundleSql(projectId: string, opts?: { badSection?: boolean; workspace?: string }) {
  const workspace = opts?.workspace ?? wsA;
  const section = opts?.badSection ? "not_a_section" : "now";
  const suffix = projectId.replace(/-/g, "").slice(0, 12);
  const ids = {
    person: `66666666-6666-4666-8666-${suffix}`,
    todo: `77777777-7777-4777-8777-${suffix}`,
    risk: `88888888-8888-4888-8888-${suffix}`,
    knowledge: `99999999-9999-4999-8999-${suffix}`,
    resp: `aaaa1111-aaaa-4aaa-8aaa-${suffix}`,
    milestone: `bbbb1111-bbbb-4bbb-8bbb-${suffix}`,
    rec: `cccc1111-cccc-4ccc-8ccc-${suffix}`,
    tag: `dddd1111-dddd-4ddd-8ddd-${suffix}`,
    itemTag: `eeee1111-eeee-4eee-8eee-${suffix}`,
    memory: `ffff1111-ffff-4fff-8fff-${suffix}`,
  };
  return `
select set_config('request.jwt.claim.sub', '${userA}', false);
select public.create_project_bundle(
  '${workspace}'::uuid,
  '${userA}'::uuid,
  jsonb_build_object(
    'id', '${projectId}',
    'name', 'Harbourline smoke',
    'code', 'HBR-${projectId.slice(0, 4)}',
    'summary', 'External V1 schema lag proof',
    'status', 'healthy',
    'kind', 'delivery',
    'current_focus', 'Unblock New Project',
    'next_milestone', 'Kickoff',
    'next_milestone_on', '2026-09-20'
  ),
  jsonb_build_array(jsonb_build_object(
    'id', '${ids.person}',
    'name', 'Alex Rivera',
    'role', 'Owner',
    'preferences', '[]'::jsonb,
    'concerns', '[]'::jsonb
  )),
  jsonb_build_array(jsonb_build_object(
    'id', '${ids.todo}',
    'title', 'Book kickoff',
    'detail', 'Confirm the room',
    'done', false,
    'due_on', '2026-09-12',
    'kind', 'ACTION'
  )),
  jsonb_build_array(jsonb_build_object(
    'id', '${ids.risk}',
    'title', 'Permit delay',
    'status', 'open',
    'source', 'manual'
  )),
  jsonb_build_array(
    jsonb_build_object(
      'id', '${ids.knowledge}',
      'section', '${section}',
      'body', 'The harbour wall is the constraint.',
      'position', 0,
      'kind', 'fact',
      'epistemic', 'confirmed',
      'lifecycle', 'current',
      'meta', '{}'::jsonb,
      'provenance', '[]'::jsonb
    ),
    jsonb_build_object(
      'id', '${ids.resp}',
      'section', 'people',
      'body', 'Alex owns the permit.',
      'position', 1,
      'kind', 'responsibility',
      'epistemic', 'confirmed',
      'lifecycle', 'current',
      'meta', jsonb_build_object('personName', 'Alex Rivera', 'scope', 'permit'),
      'provenance', '[]'::jsonb
    )
  ),
  jsonb_build_array(jsonb_build_object(
    'id', '${ids.milestone}',
    'label', 'Kickoff',
    'type', 'milestone',
    'start_on', '2026-09-20',
    'end_on', null,
    'notes', 'Go / no-go',
    'source', 'manual'
  )),
  jsonb_build_array(jsonb_build_object(
    'id', '${ids.rec}',
    'kind', 'focus',
    'urgency', 'this_week',
    'title', 'Name the constraint',
    'action', 'Write it in Now',
    'why', 'It is already true',
    'leadership_impact', 'Stops fake progress',
    'suggested_script', null,
    'status', 'active'
  )),
  jsonb_build_array(jsonb_build_object(
    'id', '${ids.tag}',
    'name', 'Harbour',
    'slug', 'harbour',
    'origin', 'custom'
  )),
  jsonb_build_array(jsonb_build_object(
    'id', '${ids.itemTag}',
    'tag_id', '${ids.tag}',
    'target_kind', 'knowledge_item',
    'target_id', '${ids.knowledge}'
  )),
  jsonb_build_object(
    'id', '${ids.memory}',
    'type', 'conversation',
    'title', 'Project setup — HBR',
    'content', 'Source narrative for Harbourline.',
    'tags', '["project-setup"]'::jsonb,
    'people', '["Alex Rivera"]'::jsonb,
    'source', 'capture'
  )
);
`;
}

function seedSql() {
  return `
insert into auth.users (id, email) values
  ('${userA}', 'a@example.com'),
  ('${userB}', 'b@example.com')
on conflict (id) do nothing;
insert into public.workspaces (id, name) values
  ('${wsA}', 'Workspace A'),
  ('${wsB}', 'Workspace B')
on conflict (id) do nothing;
insert into public.workspace_members (workspace_id, user_id, role) values
  ('${wsA}', '${userA}', 'owner'),
  ('${wsB}', '${userB}', 'owner')
on conflict do nothing;
`;
}

function countsSql(projectId: string) {
  return `
select format(
  '%s,%s,%s,%s,%s,%s,%s,%s,%s,%s',
  (select count(*) from public.projects where id = '${projectId}'),
  (select count(*) from public.stakeholders where project_id = '${projectId}'),
  (select count(*) from public.todos where project_id = '${projectId}'),
  (select count(*) from public.risks where project_id = '${projectId}'),
  (select count(*) from public.knowledge_items where project_id = '${projectId}'),
  (select count(*) from public.milestones where project_id = '${projectId}'),
  (select count(*) from public.recommendations where project_id = '${projectId}'),
  (select count(*) from public.memories where project_id = '${projectId}'),
  (select count(*) from public.project_tags where project_id = '${projectId}'),
  (select count(*) from public.item_tags where project_id = '${projectId}')
);
`;
}

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

createdb(pg, db);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lume-hosted-lag-"));
fs.chmodSync(tmp, 0o755);
try {
  const stubPath = path.join(tmp, "stub.sql");
  fs.writeFileSync(stubPath, stub);
  fs.chmodSync(stubPath, 0o644);
  psqlFile(pg, db, stubPath);
  for (const file of hostedLag) {
    psqlFile(pg, db, path.join(ROOT, file));
  }
  psql(pg, db, seedSql());

  check("hosted-lag schema has no knowledge_items.kind", () => {
    const kind = psql(
      pg,
      db,
      `select count(*) from information_schema.columns
       where table_schema='public' and table_name='knowledge_items' and column_name='kind';`,
    );
    assert.equal(kind, "0");
  });

  check("hosted-lag create_project_bundle fails with the production kind error", () => {
    let err = "";
    try {
      psql(pg, db, bundleSql(projectOkId));
    } catch (caught) {
      err = caught instanceof Error ? caught.message : String(caught);
    }
    assert.match(err, /column "kind" of relation "knowledge_items" does not exist/i);
    const leftover = psql(pg, db, `select count(*) from public.projects where id = '${projectOkId}';`);
    assert.equal(leftover, "0");
  });

  psqlFile(pg, db, path.join(ROOT, catchup));

  check("catch-up adds knowledge_items.kind and project_tags.slug", () => {
    const kind = psql(
      pg,
      db,
      `select count(*) from information_schema.columns
       where table_schema='public' and table_name='knowledge_items' and column_name='kind';`,
    );
    const slug = psql(
      pg,
      db,
      `select count(*) from information_schema.columns
       where table_schema='public' and table_name='project_tags' and column_name='slug';`,
    );
    assert.equal(kind, "1");
    assert.equal(slug, "1");
  });

  check("full bundle commits every supported item type", () => {
    psql(pg, db, bundleSql(projectOkId));
    const counts = psql(pg, db, countsSql(projectOkId));
    assert.equal(counts, "1,1,1,1,2,1,1,1,1,1");
    const kinds = psql(
      pg,
      db,
      `select string_agg(kind, ',' order by kind) from public.knowledge_items where project_id = '${projectOkId}';`,
    );
    assert.equal(kinds, "fact,responsibility");
  });

  check("forced mid-transaction failure leaves zero bundle rows", () => {
    let err = "";
    try {
      psql(pg, db, bundleSql(projectFailId, { badSection: true }));
    } catch (caught) {
      err = caught instanceof Error ? caught.message : String(caught);
    }
    assert.match(err, /violates check constraint|knowledge_items_section/i);
    assert.equal(psql(pg, db, countsSql(projectFailId)), "0,0,0,0,0,0,0,0,0,0");
  });

  check("wrong workspace fails closed and writes nothing", () => {
    let err = "";
    try {
      psql(pg, db, bundleSql(projectRetryId, { workspace: wsB }));
    } catch (caught) {
      err = caught instanceof Error ? caught.message : String(caught);
    }
    assert.match(err, /not a workspace member/i);
    assert.equal(
      psql(pg, db, `select count(*) from public.projects where id = '${projectRetryId}';`),
      "0",
    );
  });

  check("retry of the same project id is unique-safe", () => {
    let err = "";
    try {
      psql(pg, db, bundleSql(projectOkId));
    } catch (caught) {
      err = caught instanceof Error ? caught.message : String(caught);
    }
    assert.match(err, /duplicate key|unique/i);
    assert.equal(psql(pg, db, `select count(*) from public.projects where id = '${projectOkId}';`), "1");
    assert.equal(
      psql(pg, db, `select count(*) from public.knowledge_items where project_id = '${projectOkId}';`),
      "2",
    );
  });

  console.log(`\n${passed} hosted-schema-lag Postgres proofs passed.`);
} finally {
  try {
    dropdb(pg, db);
  } catch {
    /* keep going */
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
