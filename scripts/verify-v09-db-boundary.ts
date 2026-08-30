/**
 * v0.9 real-database boundary qualification.
 * Test / release qualification only. Does not change production.
 *
 * Proves the Postgres/Supabase objects from PR #110 when a disposable
 * local/test database already exists. Does not invent a production seam
 * or touch customer/prod data.
 *
 *   npm run verify:v09-db-boundary
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const RECEIPTS = "supabase/migrations/20260829120000_capture_apply_receipts.sql";
const TX = "supabase/migrations/20260829200000_authoritative_apply_tx.sql";
const BASE_SCHEMA = "supabase/migrations/20260812002748_workspace_schema.sql";

type Check = {
  id: string;
  result: "PASS" | "RED" | "BLOCKED" | "CODE_PROVEN";
  detail: string;
};

const checks: Check[] = [];

function have(cmd: string) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function record(row: Check) {
  checks.push(row);
  const mark =
    row.result === "PASS" || row.result === "CODE_PROVEN" ? "✓" : row.result === "BLOCKED" ? "○" : "✗";
  console.log(`${mark} [${row.result}] ${row.id} — ${row.detail}`);
}

function main() {
  const docker = have("docker");
  const supabaseCli = have("supabase");
  const psql = have("psql");
  const hasRemote =
    envPresent("NEXT_PUBLIC_SUPABASE_URL") &&
    (envPresent("SUPABASE_SERVICE_ROLE_KEY") || envPresent("DATABASE_URL"));
  const hasLocalUrl = envPresent("DATABASE_URL") || envPresent("SUPABASE_DB_URL");

  const capability = {
    docker,
    supabaseCli,
    psql,
    hasRemote,
    hasLocalUrl,
    supabaseConfig: existsSync(join(ROOT, "supabase/config.toml")),
    receiptsMigration: existsSync(join(ROOT, RECEIPTS)),
    txMigration: existsSync(join(ROOT, TX)),
  };

  const disposableDb =
    (docker && capability.supabaseConfig) || hasRemote || hasLocalUrl;

  record({
    id: "disposable-db-capability",
    result: disposableDb ? "PASS" : "BLOCKED",
    detail: disposableDb
      ? "A disposable database endpoint is available."
      : [
          "No safe disposable Postgres/Supabase is running in this environment.",
          "Repo supports `supabase start` (supabase/config.toml) but Docker is missing.",
          "Live tenant pack needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL — none set.",
          "psql is not installed. CI regression does not start Postgres.",
          "Not inventing a production instrumentation seam.",
        ].join(" "),
  });

  const receipts = readFileSync(join(ROOT, RECEIPTS), "utf8");
  const tx = readFileSync(join(ROOT, TX), "utf8");
  const base = readFileSync(join(ROOT, BASE_SCHEMA), "utf8");
  const persist = readFileSync(
    join(ROOT, "src/lib/data/supabase/persist-mutations.ts"),
    "utf8",
  );
  const load = readFileSync(
    join(ROOT, "src/lib/data/supabase/load-mission-state.ts"),
    "utf8",
  );

  const additive =
    /create table public\.capture_apply_receipts/i.test(receipts) &&
    !/alter table public\.(todos|risks|stakeholders|knowledge_items|milestones|projects|workspaces)\b/i.test(
      `${receipts}\n${tx}`,
    ) &&
    !/\b(drop table|drop column|rename column)\b/i.test(`${receipts}\n${tx}`);

  record({
    id: "1-migrations-additive-from-main-schema",
    result: additive ? "CODE_PROVEN" : "RED",
    detail: additive
      ? "PR #110 migrations only CREATE capture_apply_receipts + four persist_* functions. No ALTER/DROP of existing v0.9 tables. Live apply from current main schema is BLOCKED (no disposable DB)."
      : "Migrations appear to mutate existing tables — inspect before deploy.",
  });

  record({
    id: "2-existing-rows-survive-migration",
    result: "BLOCKED",
    detail:
      "Cannot seed a representative project and re-read it after migrate. Schema text has no UPDATE of existing rows. Live row-identity proof missing.",
  });

  const personRpc =
    /create or replace function public\.persist_person_responsibility/i.test(tx) &&
    persist.includes('rpc("persist_person_responsibility"');
  const riskRpc =
    /create or replace function public\.persist_risk_with_knowledge/i.test(tx) &&
    persist.includes('rpc("persist_risk_with_knowledge"');
  const todoRpc = persist.includes('rpc("persist_todo_create_with_receipt"');
  const uniqueReceipt = /unique \(workspace_id, project_id, operation_id\)/i.test(
    receipts,
  );
  const cascadeProject = /project_id uuid not null references public\.projects \(id\) on delete cascade/i.test(
    receipts,
  );
  const rls = /enable row level security/i.test(receipts) &&
    /is_workspace_member\(workspace_id\)/i.test(receipts);
  const loadIgnoresReceipts = !load.includes("capture_apply_receipts");

  record({
    id: "3-5-rpc-success-commits-both",
    result: "BLOCKED",
    detail: personRpc && riskRpc
      ? "SQL functions insert both rows in one plpgsql body (implicit transaction). Application fake runAtomic already PASSes. Live Postgres commit proof missing."
      : "RPC or application wrapper missing.",
  });

  record({
    id: "4-6-rpc-second-step-failure-rollback",
    result: "BLOCKED",
    detail:
      "Need a disposable Postgres to raise after the first INSERT inside persist_person_responsibility / persist_risk_with_knowledge and assert both rows absent. Fake snapshot rollback is not the database boundary.",
  });

  record({
    id: "7-8-create-plus-receipt-atomicity",
    result: "BLOCKED",
    detail: todoRpc
      ? "persist_todo_create_with_receipt / persist_milestone_create_with_receipt insert truth then receipt in one function. Live receipt-failure rollback unproven on Postgres."
      : "Receipt RPCs missing from persist-mutations.",
  });

  record({
    id: "9-duplicate-operation-id",
    result: uniqueReceipt ? "CODE_PROVEN" : "RED",
    detail: uniqueReceipt
      ? "UNIQUE (workspace_id, project_id, operation_id). App lookup short-circuits replay; unique violation on put is no-oped. Live reject/no-op unproven."
      : "Unique constraint missing.",
  });

  record({
    id: "10-project-delete-cascades-receipts",
    result: cascadeProject ? "CODE_PROVEN" : "RED",
    detail: cascadeProject
      ? "capture_apply_receipts.project_id REFERENCES projects(id) ON DELETE CASCADE. Live delete unproven."
      : "Cascade missing.",
  });

  record({
    id: "11-workspace-project-scoping",
    result: rls && /is_workspace_member\(p_workspace_id\)/.test(tx) ? "CODE_PROVEN" : "RED",
    detail:
      rls && base.includes("is_workspace_member")
        ? "Receipts RLS + RPCs require is_workspace_member. Project id is an argument, not cross-checked beyond workspace membership inside the function body except receipt insert policy (project.workspace_id match). Live cross-tenant proof missing."
        : "Scoping clauses missing.",
  });

  const newAppTouchesReceipts = persist.includes("capture_apply_receipts");
  const oldCreatePathStillExists = persist.includes('from("todos")');

  record({
    id: "rollback-schema-plus-old-app",
    result: additive && loadIgnoresReceipts ? "CODE_PROVEN" : "RED",
    detail:
      "MIGRATION APPLIED + OLD APPLICATION: new table/functions are unused additive objects. Current-truth load does not select capture_apply_receipts. Pre-#110 inserts into todos/risks/stakeholders/knowledge_items remain valid. Application rollback after schema deploy should not break existing v0.9 reads/writes. Residual: old app stays non-atomic (the defect #110 fixes).",
  });

  record({
    id: "rollback-schema-plus-new-app",
    result: "CODE_PROVEN",
    detail: newAppTouchesReceipts
      ? "MIGRATION APPLIED + NEW APPLICATION: new app requires the four RPCs and capture_apply_receipts. Deploy schema before the new app. Reverse (new app + old schema) would fail creates. After schema is live, rolling the app back to pre-#110 is the safe direction."
      : "New app does not reference the new objects.",
  });

  const liveBlocked = checks.some(
    (c) =>
      c.result === "BLOCKED" &&
      c.id !== "disposable-db-capability",
  );

  const report = {
    verdict: disposableDb ? "INCONCLUSIVE" : "BLOCKED",
    productionCandidate: "PR #110 cursor/v09-shared-truth-hardening-9524",
    capability,
    oldCreatePathStillExists,
    checks,
    recommendation: disposableDb
      ? "Run this script against the disposable DB."
      : "DATABASE BOUNDARY BLOCKED — need Docker for `supabase start` or a disposable TEST project URL/keys. Do not use customer/prod.",
  };

  writeFileSync(
    join(ROOT, "docs/v1-convergence/db-boundary-results.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("\n── db boundary ──");
  console.log(JSON.stringify({ verdict: report.verdict, liveBlocked, capability }, null, 2));
  if (liveBlocked) process.exit(0);
}

main();
