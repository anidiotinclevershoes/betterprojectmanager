/**
 * Opt-in read-only production DB audit for the long-run programme.
 * Never wired into npm test.
 *
 *   npx tsx scripts/audit-hosted-longrun-db.ts --first-run
 *   npx tsx scripts/audit-hosted-longrun-db.ts --prove-env
 *   LONGRUN_PROJECT_ID=… npx tsx scripts/audit-hosted-longrun-db.ts --live
 */
import { proveProductionSupabaseCorrespondence } from "../e2e-hosted-longrun/db-environment";
import {
  hashCanonicalSlice,
  LONGRUN_PRODUCTION_SUPABASE_NAME,
  LONGRUN_PRODUCTION_SUPABASE_REF,
} from "../e2e-hosted-longrun/db-verify";
import { fetchReadOnlySqlSnapshot, hasReadOnlySqlCredentials } from "../e2e-hosted-longrun/db-sql";
import { firstRunCheckpointTable } from "../e2e-hosted-longrun/reconstruct-first-run";
import { LONGRUN_PRODUCTION_ORIGIN } from "../e2e-hosted-longrun/types";
import type { CanonicalSlice } from "../e2e-hosted-longrun/types";
import * as fs from "node:fs";
import * as path from "node:path";

const args = process.argv.slice(2);
const wantFirst = args.includes("--first-run") || args.length === 0;
const wantProve = args.includes("--prove-env") || wantFirst;
const wantLive = args.includes("--live");

async function main() {
  if (wantProve) {
    const proof = await proveProductionSupabaseCorrespondence(LONGRUN_PRODUCTION_ORIGIN);
    console.log("environment");
    console.log(`  origin: ${proof.origin}`);
    console.log(`  supabase: ${LONGRUN_PRODUCTION_SUPABASE_NAME} ${LONGRUN_PRODUCTION_SUPABASE_REF}`);
    console.log(`  observed: ${proof.observedRefs.join(",") || "(none)"}`);
    console.log(`  ok: ${proof.ok}`);
    if (!proof.ok) {
      console.error(`STOP: ${proof.reason}`);
      process.exit(2);
    }
    console.log(`  proof: ${proof.proof}`);
  }

  if (wantFirst) {
    const table = firstRunCheckpointTable();
    const final = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "e2e-hosted-longrun/baselines/first-complete-run/state-final.json"), "utf8"),
    ) as CanonicalSlice;
    console.log("\nfirst-run reconstructed SQL checkpoints (lr-20260912T2212Z)");
    console.log("| Checkpoint | As-of | People | Todos | Risks | Dates | Resp | Hash prefix |");
    console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of table) {
      console.log(
        `| C${row.n} | ${row.asOf} | ${row.actualCounts.people} | ${row.actualCounts.todos} | ${row.actualCounts.risks} | ${row.actualCounts.milestones} | ${row.actualCounts.responsibilities} | ${row.hash.slice(0, 12)} |`,
      );
    }
    console.log(`\nfinal API hash: ${hashCanonicalSlice(final).slice(0, 16)}`);
    console.log(`C50 reconstruct hash: ${table[table.length - 1]?.hash.slice(0, 16)}`);
    const out = path.join(process.cwd(), "e2e-hosted-longrun/baselines/first-complete-run/db-checkpoints.json");
    fs.writeFileSync(out, JSON.stringify(table, null, 2));
    console.log(`wrote ${out}`);
  }

  if (wantLive) {
    if (!hasReadOnlySqlCredentials()) {
      console.error("STOP: --live needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
      process.exit(2);
    }
    const projectId = process.env.LONGRUN_PROJECT_ID || "8537b7cf-1b50-453e-af64-2b21e2d29e90";
    const snap = await fetchReadOnlySqlSnapshot(projectId);
    console.log("\nlive SQL snapshot");
    console.log(JSON.stringify({ projectId: snap.projectId, hash: snap.hash, counts: snap.counts, receipts: snap.receipts.length }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
