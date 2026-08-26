/**
 * Current-production replay of archived first-live envelopes (post #77 identity).
 * Historical v1/v2 artifacts must stay immutable. No provider calls.
 *
 * Run: npx tsx scripts/verify-eval-post-identity-replay.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { CAPTURE_V2_EVAL_CORPUS } from "../src/lib/eval-capture-v2/corpus";
import {
  CAPTURE_V2_EVAL_SCORER_V1,
  CAPTURE_V2_EVAL_SCORER_VERSION,
} from "../src/lib/eval-capture-v2/lume-safety";
import { FROZEN_CORPUS_COMPOSITION } from "../src/lib/eval-capture-v2/baseline";
import {
  FIRST_LIVE_ENVELOPE_ARCHIVE_ID,
  POST_IDENTITY_REPLAY_ID,
  replayArchivedThroughCurrentProduction,
  type FirstLiveEnvelopeArchive,
} from "../src/lib/eval-capture-v2/rescore";

const ROOT = process.cwd();
const ARCHIVE_DIR = join(ROOT, "src/lib/eval-capture-v2/archive");
const ENVELOPES_PATH = join(ARCHIVE_DIR, "first-live-benchmark-envelopes-v1.json");
const HISTORICAL_RESCORE_PATH = join(ARCHIVE_DIR, "first-live-rescore-scorer-v2.json");

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function main() {
  const envelopeHashBefore = sha256File(ENVELOPES_PATH);
  const rescoreHashBefore = sha256File(HISTORICAL_RESCORE_PATH);
  const archive = JSON.parse(readFileSync(ENVELOPES_PATH, "utf8")) as FirstLiveEnvelopeArchive;
  const productionSha = execSync("git rev-parse origin/main", {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  const report = replayArchivedThroughCurrentProduction({ archive, productionSha });

  check("historical artifacts and versions are unchanged", () => {
    assert.equal(existsSync(ENVELOPES_PATH), true);
    assert.equal(existsSync(HISTORICAL_RESCORE_PATH), true);
    assert.equal(archive.archiveId, FIRST_LIVE_ENVELOPE_ARCHIVE_ID);
    assert.equal(archive.corpusVersion, FROZEN_CORPUS_COMPOSITION.version);
    assert.equal(archive.originalScorerVersion, CAPTURE_V2_EVAL_SCORER_V1);
    assert.equal(CAPTURE_V2_EVAL_SCORER_VERSION, "capture-v2-eval-scorer-v2");
    assert.equal(report.scorerVersion, CAPTURE_V2_EVAL_SCORER_VERSION);
    assert.equal(report.replayId, POST_IDENTITY_REPLAY_ID);
    assert.equal(report.kind, "archived-output-current-production-replay");
    assert.equal(CAPTURE_V2_EVAL_CORPUS.length, 22);
    const lume = readFileSync(join(ROOT, "src/lib/eval-capture-v2/lume-safety.ts"), "utf8");
    assert.match(lume, /operationCreatesNewRecord/);
    assert.match(lume, /observationCoversMaterial/);
    assert.equal(/Fizz Caramel/.test(lume), false);
  });

  check("no provider calls; Gemini remains technical failure", () => {
    const gemini = report.models.find((m) => m.model.includes("gemini"));
    assert.ok(gemini);
    assert.equal(gemini!.successfulEnvelopes, 0);
    assert.equal(gemini!.callErrors, 63);
    assert.equal(gemini!.lumeFailures, 0);
  });

  check("Toyworld incomplete-Person envelopes fail closed (Needs you, no write)", () => {
    const rows = report.cases.filter(
      (row) => row.caseId === "ambiguous-same-first-name" && !row.original.error,
    );
    assert.ok(rows.length >= 9);
    for (const row of rows) {
      const envelope = archive.envelopes.find(
        (env) =>
          env.model === row.model &&
          env.caseId === row.caseId &&
          env.runIndex === row.runIndex,
      );
      const observations =
        envelope && envelope.rawJson && typeof envelope.rawJson === "object"
          ? ((envelope.rawJson as { observations?: Array<{ candidateTargetId?: string }> })
              .observations ?? [])
          : [];
      const suppliedId = observations.some((obs) => obs.candidateTargetId === "person-brick");
      if (suppliedId) {
        assert.equal(row.applyReady, 0, `${row.model} run${row.runIndex}`);
        assert.equal(row.v2.lumeFailures, 0, `${row.model} run${row.runIndex}`);
        assert.equal(row.writeOperations.length, 0, `${row.model} run${row.runIndex}`);
        assert.ok(row.needsYou >= 1, `${row.model} run${row.runIndex}`);
      }
    }
  });

  check("availability and mixed-domain scorer v2 semantics still hold on replay", () => {
    const mini = report.cases.filter((row) => row.model.includes("gpt-4o-mini"));
    const availability = mini.filter((row) => row.caseId === "availability");
    assert.ok(availability.some((row) => row.original.lumeFailures > 0));
    assert.ok(availability.every((row) => row.v2.lumeFailures === 0));
    const mixed = mini.filter((row) => row.caseId === "mixed-domains");
    assert.ok(mixed.every((row) => row.v2.unresolvedTargetConvertedToCreate === 0));
  });

  check("historical archive bytes were not rewritten by this replay", () => {
    assert.equal(sha256File(ENVELOPES_PATH), envelopeHashBefore);
    assert.equal(sha256File(HISTORICAL_RESCORE_PATH), rescoreHashBefore);
  });

  const genuine = report.cases.filter((row) => row.outcome === "still_genuine_lume_failure");
  console.log(
    report.models
      .map(
        (m) =>
          `${m.model}: success=${m.successfulEnvelopes} lumeFailure=${m.lumeFailures} lumeCatch=${m.lumeCatches} modelFailure=${m.modelFailures}`,
      )
      .join("\n"),
  );
  for (const row of genuine) {
    console.log(
      `GENUINE ${row.model} ${row.caseId} run${row.runIndex} writes=${row.writeOperations.join(",")}`,
    );
  }

  check("GATE: archived outputs now produce zero genuine Lume failures", () => {
    const byModel = report.models.map(
      (m) => `${m.model}:${m.lumeFailures}`,
    );
    assert.equal(
      genuine.length,
      0,
      `Current production still permits genuine Lume failures:\n${genuine
        .map(
          (row) =>
            `- ${row.model} ${row.caseId} run${row.runIndex} applyReady=${row.applyReady} writes=${row.writeOperations.join(",") || "none"} reasons=${row.v2.rows
              .filter((r) => r.classification === "lume_failure")
              .map((r) => r.reason)
              .join(" | ")}`,
        )
        .join("\n")}\nmodel totals: ${byModel.join(", ")}`,
    );
  });

  console.log("\nPost-identity replay checks passed.");
}

main();
