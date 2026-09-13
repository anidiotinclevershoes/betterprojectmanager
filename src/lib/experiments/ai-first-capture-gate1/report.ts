import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GATE1_ASTRA_MODEL, type ComparisonRow, type SnapshotSizes } from "./types";
import type { Gate1Case } from "./cases";
import type { Gate1ModelCall } from "./interpreter";
import type { ExistingLumeSummary } from "./types";

export type CaseRunRecord = {
  testCase: Gate1Case;
  snapshot: string;
  snapshotSizes: SnapshotSizes;
  astra: Gate1ModelCall;
  existingLume: ExistingLumeSummary;
  comparison: ComparisonRow;
};

function fence(label: string, body: string): string {
  return ["```" + label, body.trimEnd(), "```"].join("\n");
}

function renderCase(record: CaseRunRecord): string {
  const { testCase, snapshot, snapshotSizes, astra, existingLume, comparison } =
    record;
  return [
    `## ${testCase.id}`,
    "",
    `**CASE** ${testCase.title}`,
    "",
    `- kind: ${testCase.kind}`,
    `- source: ${testCase.source}`,
    `- expected source: ${testCase.expectedSource}`,
    "",
    "### Raw Capture",
    "",
    fence("text", testCase.captureText),
    "",
    "### Canonical snapshot supplied to model",
    "",
    fence("text", snapshot),
    "",
    `Snapshot size: ${snapshotSizes.characters} characters, ~${snapshotSizes.approxTokensCl100k} cl100k tokens.`,
    "",
    "### Astra structured interpretation",
    "",
    `- requestedModel: ${astra.requestedModel}`,
    `- responseModel: ${astra.responseModel}`,
    `- latencyMs: ${astra.latencyMs}`,
    `- usage: ${JSON.stringify(astra.usage)}`,
    "",
    fence("json", JSON.stringify(astra.interpretation, null, 2)),
    "",
    "### Expected interpretation",
    "",
    testCase.expectedInterpretationNotes,
    "",
    ...testCase.expectedFacts.map(
      (fact) =>
        `- ${fact.id}: ${fact.meaning}` +
        (fact.expectedCanonicalId
          ? ` (id ${fact.expectedCanonicalId})`
          : fact.expectedReferenceKind
            ? ` (${fact.expectedReferenceKind})`
            : ""),
    ),
    "",
    "### Existing Lume result",
    "",
    existingLume.label,
    "",
    fence("text", existingLume.text),
    "",
    "### Basic comparison",
    "",
    `- material facts expected: ${comparison.materialFactsExpected.join(" | ") || "(none)"}`,
    `- material facts found: ${comparison.materialFactsFound.join(" | ") || "(none)"}`,
    `- material facts missed: ${comparison.materialFactsMissed.join(" | ") || "(none)"}`,
    `- unsupported/invented facts: ${comparison.unsupportedOrInvented.join(" | ") || "(none)"}`,
    `- existing-entity references: ${comparison.existingEntityReferences}`,
    `- ambiguity handled: ${comparison.ambiguityHandling}`,
    `- evidence: ${comparison.evidenceGrounding}`,
    `- snapshot approximate token size: ${snapshotSizes.approxTokensCl100k}`,
    `- model input/output tokens: prompt=${astra.usage?.prompt_tokens ?? "n/a"} completion=${astra.usage?.completion_tokens ?? "n/a"} total=${astra.usage?.total_tokens ?? "n/a"} reasoning=${astra.usage?.reasoning_tokens ?? "n/a"}`,
    `- model latency: ${astra.latencyMs} ms`,
    "",
  ].join("\n");
}

export function writeGate1Report(args: {
  branch: string;
  commit: string;
  originMain: string;
  files: string[];
  records: CaseRunRecord[];
  assessment: string;
  extraNotes: string[];
}): { reportPath: string; jsonPath: string } {
  const dir = resolve(process.cwd(), "src/lib/experiments/ai-first-capture-gate1");
  mkdirSync(dir, { recursive: true });
  const reportPath = resolve(dir, "GATE1_REPORT.md");
  const jsonPath = resolve(dir, "GATE1_RUN.json");

  const body = [
    "# AI-first Capture Gate 1 report",
    "",
    "Disposable experiment. Not a production implementation. Stop after these five cases.",
    "",
    `- branch: ${args.branch}`,
    `- commit: ${args.commit}`,
    `- origin/main: ${args.originMain}`,
    `- exact model requested: ${GATE1_ASTRA_MODEL}`,
    `- exact model returned: ${args.records.map((r) => r.astra.responseModel).join(", ")}`,
    `- files added/changed: ${args.files.join(", ")}`,
    "",
    ...args.records.map(renderCase),
    "## Assessment",
    "",
    args.assessment,
    "",
    ...args.extraNotes.map((note) => `- ${note}`),
    "",
  ].join("\n");

  writeFileSync(reportPath, body);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        branch: args.branch,
        commit: args.commit,
        model: GATE1_ASTRA_MODEL,
        cases: args.records.map((record) => ({
          id: record.testCase.id,
          snapshot: record.snapshot,
          snapshotSizes: record.snapshotSizes,
          astra: {
            requestedModel: record.astra.requestedModel,
            responseModel: record.astra.responseModel,
            latencyMs: record.astra.latencyMs,
            usage: record.astra.usage,
            interpretation: record.astra.interpretation,
          },
          existingLume: record.existingLume,
          comparison: record.comparison,
        })),
      },
      null,
      2,
    ),
  );
  return { reportPath, jsonPath };
}
