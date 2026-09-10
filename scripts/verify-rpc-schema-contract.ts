/**
 * Prevents release RPCs from referencing columns the repo schema does not have,
 * and records that hosted production can lag the full migration chain.
 *
 * The 10 Sep 2026 hosted New Project failure was:
 *   column "kind" of relation "knowledge_items" does not exist
 * Repo migrations add that column in 20260818230000_knowledge_canonical_metadata.sql.
 * Disposable Postgres applied every migration; hosted SQL Editor apply did not.
 *
 * Run: npx tsx scripts/verify-rpc-schema-contract.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const MIG = path.join(ROOT, "supabase/migrations");
let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function migrationFiles(): string[] {
  return fs
    .readdirSync(MIG)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function extractAddColumns(sql: string, table: string): string[] {
  const cols: string[] = [];
  const re = new RegExp(
    `alter table(?:\\s+if exists)?\\s+public\\.${table}\\s+add column(?:\\s+if not exists)?\\s+(\\w+)`,
    "gi",
  );
  for (const match of sql.matchAll(re)) {
    cols.push(match[1].toLowerCase());
  }
  return cols;
}

function extractCreateTableColumns(sql: string, table: string): string[] {
  const block = sql.match(
    new RegExp(
      `create table(?:\\s+if not exists)?\\s+public\\.${table}\\s*\\(([^;]+)\\);`,
      "i",
    ),
  );
  if (!block) return [];
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--") && !line.startsWith("constraint"))
    .map((line) => line.replace(/,$/, "").split(/\s+/)[0]?.toLowerCase())
    .filter((name): name is string => Boolean(name) && !["primary", "unique", "check", "foreign"].includes(name));
}

function schemaColumns(table: string, files?: string[]): Set<string> {
  const cols = new Set<string>();
  for (const file of files ?? migrationFiles()) {
    const sql = fs.readFileSync(path.join(MIG, file), "utf8");
    for (const col of extractCreateTableColumns(sql, table)) cols.add(col);
    for (const col of extractAddColumns(sql, table)) cols.add(col);
  }
  return cols;
}

function insertColumnLists(sql: string, table: string): string[][] {
  const lists: string[][] = [];
  const re = new RegExp(`insert into public\\.${table}\\s*\\(([^)]+)\\)`, "gi");
  for (const match of sql.matchAll(re)) {
    lists.push(
      match[1]
        .split(",")
        .map((part) => part.trim().split(/\s+/)[0].toLowerCase())
        .filter(Boolean),
    );
  }
  return lists;
}

const createSql = read(
  "supabase/migrations/20260909210000_create_project_bundle.sql",
);
const phase1 = read("supabase/migrations/20260812002748_workspace_schema.sql");
const metadata = read(
  "supabase/migrations/20260818230000_knowledge_canonical_metadata.sql",
);
const tags = read("supabase/migrations/20260831160000_project_retrieval_tags.sql");
const catchup = read(
  "supabase/migrations/20260910120000_hosted_canonical_schema_catchup.sql",
);
const auditSql = read("scripts/hosted-schema-audit.sql");
const persist = read("src/lib/data/supabase/persist-mutations.ts");
const types = read("src/types/database.ts");
const people = read("src/lib/people/identity.ts");
const materialise = read("src/lib/new-project/materialise-setup.ts");

const rpcTables = [
  "projects",
  "stakeholders",
  "todos",
  "risks",
  "knowledge_items",
  "milestones",
  "project_tags",
  "item_tags",
  "recommendations",
  "memories",
] as const;

const hostedLagFiles = migrationFiles().filter(
  (name) =>
    !name.includes("knowledge_canonical_metadata") &&
    !name.includes("project_retrieval_tags") &&
    !name.includes("hosted_canonical_schema_catchup"),
);

check("create_project_bundle insert columns exist in the full migration schema", () => {
  for (const table of rpcTables) {
    const schema = schemaColumns(table);
    const inserts = insertColumnLists(createSql, table);
    assert.ok(inserts.length, `RPC does not insert into ${table}`);
    for (const cols of inserts) {
      for (const col of cols) {
        assert.ok(
          schema.has(col),
          `create_project_bundle inserts ${table}.${col} but no migration defines that column`,
        );
      }
    }
  }
});

check("hosted-lag reconstruction (no metadata/tags/catch-up) is missing knowledge_items.kind", () => {
  const lag = schemaColumns("knowledge_items", hostedLagFiles);
  assert.equal(lag.has("kind"), false);
  assert.equal(lag.has("epistemic"), false);
  const rpcKnowledge = insertColumnLists(createSql, "knowledge_items")[0] ?? [];
  assert.ok(rpcKnowledge.includes("kind"));
});

check("hosted-lag reconstruction is missing project_tags.slug", () => {
  const lag = schemaColumns("project_tags", hostedLagFiles);
  assert.equal(lag.has("slug"), false);
  const rpcTags = insertColumnLists(createSql, "project_tags")[0] ?? [];
  assert.ok(rpcTags.includes("slug"));
  assert.ok(rpcTags.includes("name"));
  assert.ok(!rpcTags.includes("code"));
  assert.ok(!rpcTags.includes("label"));
});

check("knowledge_items.kind is canonical metadata, not a Phase-1 column", () => {
  const phase1Cols = new Set(extractCreateTableColumns(phase1, "knowledge_items"));
  assert.equal(phase1Cols.has("kind"), false);
  assert.match(metadata, /add column if not exists kind text;/);
  assert.doesNotMatch(metadata, /kind text not null/i);
  const rpcKnowledge = insertColumnLists(createSql, "knowledge_items")[0] ?? [];
  assert.ok(rpcKnowledge.includes("kind"));
  assert.ok(rpcKnowledge.includes("epistemic"));
  assert.ok(rpcKnowledge.includes("lifecycle"));
  assert.ok(rpcKnowledge.includes("meta"));
  assert.ok(rpcKnowledge.includes("provenance"));
});

check("catch-up replays canonical metadata and real retrieval tags, not a junk kind column", () => {
  assert.match(catchup, /add column if not exists kind text;/);
  assert.doesNotMatch(catchup, /kind text not null default 'fact'/i);
  assert.doesNotMatch(catchup, /knowledge_items_kind_check/);
  assert.match(catchup, /lifecycle in \('current', 'superseded', 'historical'\)/);
  assert.doesNotMatch(catchup, /lifecycle in \('current','superseded','archived'\)/);
  assert.match(catchup, /provenance jsonb not null default '\[\]'::jsonb/);
  assert.match(catchup, /epistemic in \([\s\S]*'confirmed'[\s\S]*'pending'/);
  assert.match(
    catchup,
    /create table if not exists public\.project_tags \([\s\S]*slug text not null[\s\S]*origin text not null/,
  );
  assert.doesNotMatch(catchup, /create table if not exists public\.project_tags \([\s\S]*\bcode text/);
  assert.match(tags, /slug text not null/);
  assert.match(tags, /unique \(project_id, slug\)/);
});

check("application domain still writes and hydrates knowledge_items.kind", () => {
  assert.match(types, /knowledge_items:[\s\S]*kind: string \| null/);
  assert.match(persist, /row\.kind = meta\.kind/);
  assert.match(people, /kind=responsibility/);
  assert.match(materialise, /kind: "responsibility"/);
  const createFn = persist.slice(
    persist.indexOf("export async function persistNewProject"),
    persist.indexOf("export async function persistTodoCreate"),
  );
  assert.match(createFn, /kind: knowledgeKindForSection/);
  assert.match(createFn, /kind: item\.kind/);
  assert.match(createFn, /rpc\("create_project_bundle"/);
});

check("hosted schema audit SQL is read-only and covers every RPC insert column", () => {
  assert.doesNotMatch(auditSql, /\bdrop\b/i);
  assert.doesNotMatch(auditSql, /\bdelete from\b/i);
  assert.doesNotMatch(auditSql, /\binsert into\b/i);
  assert.doesNotMatch(auditSql, /\bupdate\b/i);
  for (const table of rpcTables) {
    assert.match(auditSql, new RegExp(`'${table}'`));
    const inserts = insertColumnLists(createSql, table);
    for (const cols of inserts) {
      for (const col of cols) {
        assert.match(
          auditSql,
          new RegExp(`'${table}', '${col}'`),
          `audit SQL missing required_column ${table}.${col}`,
        );
      }
    }
  }
  assert.match(auditSql, /required_column/);
  assert.match(auditSql, /recent_project/);
  assert.match(auditSql, /leftover_children/);
  assert.match(auditSql, /interval '24 hours'/);
  assert.match(auditSql, /capture_apply_receipts/);
});

check("operator checklist uses the forward catch-up file, not an in-place RPC edit", () => {
  const actions = read("docs/V1_USER_ACTIONS.md");
  assert.match(actions, /20260910120000_hosted_canonical_schema_catchup\.sql/);
  assert.match(actions, /20260829120000_capture_apply_receipts\.sql/);
  assert.match(actions, /hosted-schema-audit\.sql/);
  assert.doesNotMatch(actions, /strip `kind` from create_project_bundle/);
});

console.log(`\n${passed} rpc-schema-contract checks passed.`);
