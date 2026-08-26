/**
 * Replay archived first-live envelopes through CURRENT production + scorer v2.
 * Not a live benchmark. Does not mutate historical v1/v2 artifacts.
 *
 *   npx tsx scripts/replay-capture-v2-post-identity.ts
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  POST_IDENTITY_REPLAY_ID,
  replayArchivedThroughCurrentProduction,
  type FirstLiveEnvelopeArchive,
} from "../src/lib/eval-capture-v2/rescore";

const ROOT = process.cwd();
const ARCHIVE_DIR = join(ROOT, "src/lib/eval-capture-v2/archive");
const ENVELOPES_PATH = join(ARCHIVE_DIR, "first-live-benchmark-envelopes-v1.json");
const HISTORICAL_RESCORE_PATH = join(ARCHIVE_DIR, "first-live-rescore-scorer-v2.json");
const OUT_PATH = join(ARCHIVE_DIR, `${POST_IDENTITY_REPLAY_ID}.json`);

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function productionSha(): string {
  const argIdx = process.argv.indexOf("--production-sha");
  if (argIdx >= 0 && process.argv[argIdx + 1]) return process.argv[argIdx + 1]!;
  return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
}

function main() {
  if (!existsSync(ENVELOPES_PATH)) {
    throw new Error(`Missing envelope archive ${ENVELOPES_PATH}`);
  }
  const beforeEnvelopes = sha256File(ENVELOPES_PATH);
  const beforeRescore = existsSync(HISTORICAL_RESCORE_PATH)
    ? sha256File(HISTORICAL_RESCORE_PATH)
    : null;

  const archive = JSON.parse(readFileSync(ENVELOPES_PATH, "utf8")) as FirstLiveEnvelopeArchive;
  const production = productionSha();
  const report = replayArchivedThroughCurrentProduction({
    archive,
    productionSha: production,
  });

  const slim = {
    ...report,
    historicalArtifactSha256: {
      envelopes: beforeEnvelopes,
      scorerV2Rescore: beforeRescore,
    },
    cases: report.cases.map((row) => ({
      caseId: row.caseId,
      runIndex: row.runIndex,
      provider: row.provider,
      model: row.model,
      original: row.original,
      v2: row.v2,
      applyReady: row.applyReady,
      needsYou: row.needsYou,
      rejected: row.rejected,
      noChange: row.noChange,
      writeOperations: row.writeOperations,
      decisionKinds: row.decisionKinds,
      outcome: row.outcome,
    })),
  };
  writeFileSync(OUT_PATH, `${JSON.stringify(slim)}\n`);

  if (sha256File(ENVELOPES_PATH) !== beforeEnvelopes) {
    throw new Error("Envelope archive mutated during replay");
  }
  if (beforeRescore && sha256File(HISTORICAL_RESCORE_PATH) !== beforeRescore) {
    throw new Error("Historical scorer-v2 rescore mutated during replay");
  }

  console.log(
    `Capture V2 post-identity replay  id=${report.replayId} production=${report.productionSha} scorer=${report.scorerVersion} corpus=${report.corpusVersion}`,
  );
  for (const model of report.models) {
    console.log(
      `${model.provider}/${model.model}: success=${model.successfulEnvelopes} errors=${model.callErrors} lumeFailure=${model.lumeFailures} lumeCatch=${model.lumeCatches} modelFailure=${model.modelFailures} applyReady=${model.applyReady}`,
    );
  }
  const genuine = report.cases.filter((c) => c.outcome === "still_genuine_lume_failure");
  console.log(`genuine LUME FAILURE envelopes: ${genuine.length}`);
  for (const row of genuine) {
    console.log(
      `  ${row.model} ${row.caseId} run${row.runIndex} writes=${row.writeOperations.join(",") || "none"}`,
    );
  }
  console.log(`Wrote ${OUT_PATH}`);
}

main();
