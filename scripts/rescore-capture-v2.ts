/**
 * Offline scorer-v2 rescore of archived first-live Capture V2 envelopes.
 * No provider calls. Does not mutate the original GitHub artifact.
 *
 *   npx tsx scripts/rescore-capture-v2.ts
 *   npx tsx scripts/rescore-capture-v2.ts --from /tmp/hulk-eval/evidence
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  buildFirstLiveEnvelopeArchive,
  rescoreArchivedEnvelopes,
  rescoreReportToHarnessShape,
  type FirstLiveEnvelopeArchive,
  type LooseHarness,
} from "../src/lib/eval-capture-v2/rescore";
import { CAPTURE_V2_EVAL_SCORER_VERSION } from "../src/lib/eval-capture-v2/lume-safety";
import { FROZEN_CORPUS_COMPOSITION } from "../src/lib/eval-capture-v2/baseline";

const ROOT = process.cwd();
const ARCHIVE_DIR = join(ROOT, "src/lib/eval-capture-v2/archive");
const ENVELOPES_PATH = join(ARCHIVE_DIR, "first-live-benchmark-envelopes-v1.json");
const RESCORE_PATH = join(ARCHIVE_DIR, "first-live-rescore-scorer-v2.json");

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1];
  return undefined;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadOriginalReports(dir: string) {
  const names = ["capture-v2-eval.json", "eval-capture-v2.json"];
  return names.map((name) => {
    const path = join(dir, name);
    if (!existsSync(path)) {
      throw new Error(`Original harness file missing: ${path}`);
    }
    return {
      name,
      path,
      sha256: sha256File(path),
      bytes: readFileSync(path).byteLength,
      report: JSON.parse(readFileSync(path, "utf8")) as LooseHarness,
    };
  });
}

function summarise(report: ReturnType<typeof rescoreArchivedEnvelopes>): string {
  const lines = [
    `Capture V2 archived rescore  corpus=${report.corpusVersion} scorer=${report.scorerVersion}`,
    `original scorer=${report.originalScorerVersion}  workflow=${report.originalWorkflowRunId}`,
    "",
  ];
  for (const model of report.models) {
    lines.push(
      `${model.provider}/${model.model}: original lumeFailure=${model.original.lumeFailures} lumeCatch=${model.original.lumeCatches} modelFailure=${model.original.modelFailures} errors=${model.original.callErrors}`,
    );
    lines.push(
      `  scorer-v2 lumeFailure=${model.v2.lumeFailures} lumeCatch=${model.v2.lumeCatches} modelFailure=${model.v2.modelFailures} errors=${model.v2.callErrors}`,
    );
  }
  return lines.join("\n");
}

function main() {
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  const from = arg("from");
  let archive: FirstLiveEnvelopeArchive;

  if (from) {
    const originals = loadOriginalReports(from);
    archive = buildFirstLiveEnvelopeArchive(originals.map((row) => row.report));
    writeFileSync(ENVELOPES_PATH, `${JSON.stringify(archive)}\n`);
    console.log(`Wrote envelope archive ${ENVELOPES_PATH}`);
    for (const original of originals) {
      const after = sha256File(original.path);
      if (after !== original.sha256) {
        throw new Error(`Original artifact mutated: ${original.path}`);
      }
      console.log(
        `preserved original ${original.name} sha256=${original.sha256} bytes=${original.bytes}`,
      );
    }
  } else if (existsSync(ENVELOPES_PATH)) {
    archive = JSON.parse(readFileSync(ENVELOPES_PATH, "utf8")) as FirstLiveEnvelopeArchive;
  } else {
    throw new Error(
      `No envelope archive at ${ENVELOPES_PATH}. Pass --from <dir> with the original harness JSON.`,
    );
  }

  const report = rescoreArchivedEnvelopes(archive);
  const slim = {
    ...report,
    cases: report.cases.map((row) => ({
      caseId: row.caseId,
      runIndex: row.runIndex,
      provider: row.provider,
      model: row.model,
      original: row.original,
      v2: row.v2,
    })),
  };
  writeFileSync(RESCORE_PATH, `${JSON.stringify(slim, null, 2)}\n`);

  const out = arg("out");
  if (out) {
    const path = join(ROOT, out);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(rescoreReportToHarnessShape(report), null, 2)}\n`);
    console.log(`Wrote dashboard-shaped report ${path}`);
  }

  console.log(summarise(report));
  console.log(`\nWrote ${RESCORE_PATH}`);
  console.log(`corpus ${FROZEN_CORPUS_COMPOSITION.version}`);
  console.log(`scorer ${CAPTURE_V2_EVAL_SCORER_VERSION}`);
}

main();
