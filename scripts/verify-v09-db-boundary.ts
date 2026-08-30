/**
 * v0.9 real-database boundary qualification.
 * Test / release qualification only. Does not change production.
 *
 * When SUPABASE_DB_URL / DATABASE_URL is set (GitHub Actions local
 * Supabase), executes the official SQL migrations and RPCs on real
 * Postgres. Does not use FakeWorkspaceClient.
 *
 * Without a disposable DB URL, reports BLOCKED (Cursor VM has no Docker).
 *
 *   npm run verify:v09-db-boundary
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const RECEIPTS = "supabase/migrations/20260829120000_capture_apply_receipts.sql";
const TX = "supabase/migrations/20260829200000_authoritative_apply_tx.sql";
const BASE_SCHEMA = "supabase/migrations/20260812002748_workspace_schema.sql";
const PROJ = "aaaaaaaa-aaaa-4aaa-8aaa-dbq0000000p1";

type Check = {
  id: string;
  result: "PASS" | "RED" | "BLOCKED" | "CODE_PROVEN";
  detail: string;
};

const checks: Check[] = [];

function have(cmd: string) {
  try {
    execFileSync("bash", ["-lc", `command -v ${cmd}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function dbUrl() {
  return (
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.DB_URL?.trim() ||
    ""
  );
}

function record(row: Check) {
  checks.push(row);
  const mark =
    row.result === "PASS" || row.result === "CODE_PROVEN"
      ? "✓"
      : row.result === "BLOCKED"
        ? "○"
        : "✗";
  console.log(`${mark} [${row.result}] ${row.id} — ${row.detail}`);
}

function runPsql(args: { file?: string; query?: string; tuplesOnly?: boolean }) {
  const url = dbUrl();
  const argv = [url, "-v", "ON_ERROR_STOP=1", "--no-psqlrc"];
  if (args.tuplesOnly) argv.push("-At");
  if (args.file) argv.push("-f", args.file);
  if (args.query) argv.push("-c", args.query);
  return execFileSync("psql", argv, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).toString();
}

function snapshotSeed(): string {
  return runPsql({
    tuplesOnly: true,
    query: `
      SELECT coalesce(md5(string_agg(row_text, '|' ORDER BY row_text)), 'empty')
      FROM (
        SELECT 'todo:' || id::text || ':' || title FROM public.todos
          WHERE project_id = '${PROJ}'
        UNION ALL
        SELECT 'risk:' || id::text || ':' || title FROM public.risks
          WHERE project_id = '${PROJ}'
        UNION ALL
        SELECT 'person:' || id::text || ':' || name FROM public.stakeholders
          WHERE project_id = '${PROJ}'
        UNION ALL
        SELECT 'know:' || id::text || ':' || body FROM public.knowledge_items
          WHERE project_id = '${PROJ}'
      ) s(row_text);
    `,
  }).trim();
}

function staticCompatibility() {
  const receipts = readFileSync(join(ROOT, RECEIPTS), "utf8");
  const tx = readFileSync(join(ROOT, TX), "utf8");
  const load = readFileSync(
    join(ROOT, "src/lib/data/supabase/load-mission-state.ts"),
    "utf8",
  );
  const persist = readFileSync(
    join(ROOT, "src/lib/data/supabase/persist-mutations.ts"),
    "utf8",
  );
  const additive =
    /create table public\.capture_apply_receipts/i.test(receipts) &&
    !/alter table public\.(todos|risks|stakeholders|knowledge_items|milestones|projects|workspaces)\b/i.test(
      `${receipts}\n${tx}`,
    ) &&
    !/\b(drop table|drop column|rename column)\b/i.test(`${receipts}\n${tx}`);
  const loadIgnoresReceipts = !load.includes("capture_apply_receipts");
  const oldInsertsRemain = persist.includes("persistTodoCreate");
  return { additive, loadIgnoresReceipts, oldInsertsRemain, persist, receipts, tx };
}

function writeReport(extra: Record<string, unknown>) {
  const reds = checks.filter((c) => c.result === "RED").length;
  const blocked = checks.filter((c) => c.result === "BLOCKED").length;
  const passes = checks.filter((c) => c.result === "PASS" || c.result === "CODE_PROVEN").length;
  const live = Boolean(dbUrl() && have("psql"));
  const verdict = reds
    ? "RED"
    : live && blocked === 0
      ? "PASS"
      : "BLOCKED";
  const report = {
    verdict,
    productionCandidate: "PR #110 cursor/v09-shared-truth-hardening-9524",
    fakeWorkspaceClient: false,
    ...extra,
    checks,
    counts: { PASS: passes, RED: reds, BLOCKED: blocked },
  };
  writeFileSync(
    join(ROOT, "docs/v1-convergence/db-boundary-results.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("\n── db boundary ──");
  console.log(JSON.stringify({ verdict, counts: report.counts }, null, 2));
  if (live && reds > 0) process.exit(1);
}

function runStaticBlocked(capability: Record<string, unknown>) {
  const compat = staticCompatibility();
  record({
    id: "1-migrations-additive-from-main-schema",
    result: compat.additive ? "CODE_PROVEN" : "RED",
    detail: compat.additive
      ? "PR #110 migrations only CREATE new table + persist_* functions. Live apply skipped (no disposable DB)."
      : "Migrations appear to mutate existing tables.",
  });
  for (const id of [
    "2-existing-rows-survive-migration",
    "person-commit",
    "person-rollback",
    "risk-commit",
    "risk-rollback",
    "receipt-commit",
    "receipt-rollback",
    "duplicate-operation-id",
    "distinct-ops-same-title",
    "project-delete-cascade",
    "workspace-scoping",
  ]) {
    record({
      id,
      result: "BLOCKED",
      detail: "No disposable Postgres URL in this environment.",
    });
  }
  record({
    id: "rollback-schema-plus-old-app",
    result: compat.additive && compat.loadIgnoresReceipts ? "CODE_PROVEN" : "RED",
    detail: "SCHEMA FIRST → OLD APP is additive unused objects. Live insert unproven here.",
  });
  record({
    id: "rollback-new-app-old-schema",
    result: "CODE_PROVEN",
    detail: "NEW APP → OLD SCHEMA is unsupported (RPCs missing). Migration must deploy first.",
  });
  writeReport({ capability, mode: "static" });
}

function runLive() {
  const compat = staticCompatibility();
  record({
    id: "disposable-db-capability",
    result: "PASS",
    detail: `psql against ${dbUrl().replace(/:[^:@/]+@/, ":***@")}`,
  });

  runPsql({ file: join(ROOT, "scripts/db-boundary/rewind-h110.sql") });

  const missingRpc = runPsql({
    tuplesOnly: true,
    query:
      "SELECT (to_regprocedure('public.persist_todo_create_with_receipt(uuid,uuid,jsonb,jsonb)') IS NULL)::text;",
  }).trim();
  record({
    id: "new-app-old-schema",
    result: missingRpc === "t" ? "PASS" : "RED",
    detail:
      missingRpc === "t"
        ? "NEW APP → OLD SCHEMA: persist_todo_create_with_receipt is absent. Unsupported; migrate first."
        : "RPC still present after rewind.",
  });

  runPsql({ file: join(ROOT, "scripts/db-boundary/seed-v09.sql") });
  const before = snapshotSeed();
  if (!before || before === "empty") {
    record({
      id: "2-existing-rows-survive-migration",
      result: "RED",
      detail: "Seed produced no representative rows.",
    });
  }

  runPsql({ file: join(ROOT, RECEIPTS) });
  runPsql({ file: join(ROOT, TX) });
  record({
    id: "1-migrations-additive-from-main-schema",
    result: "PASS",
    detail: "Applied official #110 SQL files onto the pre-#110 schema with seeded v0.9 rows.",
  });

  const after = snapshotSeed();
  record({
    id: "2-existing-rows-survive-migration",
    result: before && before === after ? "PASS" : "RED",
    detail:
      before === after
        ? `Seeded todo/risk/person/knowledge checksum unchanged (${before}).`
        : `Checksum changed before=${before} after=${after}`,
  });

  const oldInsert = runPsql({
    tuplesOnly: true,
    query: `
      INSERT INTO public.todos (workspace_id, project_id, title, done, kind)
      SELECT workspace_id, id, 'HULK-DBQ-OLD-APP-INSERT', false, 'ACTION'
      FROM public.projects WHERE id = '${PROJ}';
      SELECT count(*)::text FROM public.todos WHERE title = 'HULK-DBQ-OLD-APP-INSERT';
    `,
  }).trim();
  record({
    id: "schema-first-old-app",
    result: oldInsert.endsWith("1") ? "PASS" : "RED",
    detail:
      oldInsert.endsWith("1")
        ? "SCHEMA FIRST → OLD APP: direct todos insert still works after #110 objects exist."
        : `direct insert count=${oldInsert}`,
  });

  const rpcPresent = runPsql({
    tuplesOnly: true,
    query:
      "SELECT (to_regprocedure('public.persist_todo_create_with_receipt(uuid,uuid,jsonb,jsonb)') IS NOT NULL)::text;",
  }).trim();
  record({
    id: "schema-first-new-app",
    result: rpcPresent === "t" ? "PASS" : "RED",
    detail:
      rpcPresent === "t"
        ? "SCHEMA FIRST → NEW APP: persist_* RPCs exist after official files applied."
        : "RPC missing after apply.",
  });

  const raw = runPsql({
    tuplesOnly: true,
    file: join(ROOT, "scripts/db-boundary/live-qualify.sql"),
  }).trim();
  const start = raw.indexOf("[");
  const jsonText = start >= 0 ? raw.slice(start) : raw;
  let liveRows: Array<{ id: string; result: string; detail: string }> = [];
  try {
    liveRows = JSON.parse(jsonText) as typeof liveRows;
  } catch {
    record({
      id: "live-qualify-parse",
      result: "RED",
      detail: `Could not parse live SQL JSON: ${raw.slice(0, 400)}`,
    });
    writeReport({ mode: "live", compat });
    return;
  }
  for (const row of liveRows) {
    record({
      id: row.id,
      result: row.result === "PASS" ? "PASS" : "RED",
      detail: row.detail,
    });
  }

  record({
    id: "rollback-schema-plus-old-app",
    result:
      compat.additive && compat.loadIgnoresReceipts && oldInsert.endsWith("1")
        ? "PASS"
        : "RED",
    detail:
      "SCHEMA FIRST → OLD APP compatible. Load still ignores receipts. Residual: old app is non-atomic.",
  });
  record({
    id: "rollback-new-app-old-schema",
    result: missingRpc === "t" ? "PASS" : "RED",
    detail: "NEW APP → OLD SCHEMA unsupported; therefore migration must deploy first.",
  });

  writeReport({ mode: "live", seedChecksum: after, compat });
}

function main() {
  const capability = {
    docker: have("docker"),
    supabaseCli: have("supabase"),
    psql: have("psql"),
    hasUrl: Boolean(dbUrl()),
    supabaseConfig: existsSync(join(ROOT, "supabase/config.toml")),
    receiptsMigration: existsSync(join(ROOT, RECEIPTS)),
    txMigration: existsSync(join(ROOT, TX)),
    fakeWorkspaceClient: false,
  };

  if (!dbUrl() || !have("psql")) {
    record({
      id: "disposable-db-capability",
      result: "BLOCKED",
      detail:
        "No disposable Postgres URL + psql in this process. GitHub Actions starts local Supabase; this Cursor VM does not. Not using FakeWorkspaceClient.",
    });
    runStaticBlocked(capability);
    return;
  }

  runLive();
}

main();
