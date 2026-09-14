import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Gate1V2Case } from "./cases";
import type { InspectedEnvelope } from "./types";
import type { Gate1V2Call } from "./interpreter";
import type { ProductionComparison } from "./production";
import type { AggregateScore, CaseScore, SnapshotSizes } from "./types";
import { rates } from "./score";

export type CaseRecord = {
  testCase: Gate1V2Case;
  snapshot: string;
  snapshotSizes: SnapshotSizes;
  astra: Gate1V2Call;
  inspected: InspectedEnvelope;
  production: ProductionComparison | { label: string; text: string; items: [] };
  aiScore: CaseScore;
  prodScore: CaseScore;
};

function fence(lang: string, body: string): string {
  return ["```" + lang, body.trimEnd(), "```"].join("\n");
}

function scoreLines(score: CaseScore): string {
  return [
    ...score.facts.map((f) => `- ${f.bucket}: ${f.meaning} (${f.note})`),
    ...score.extraInvented.map((x) => `- extra invented write: ${x}`),
    score.malformed ? "- malformed envelope" : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderCase(record: CaseRecord): string {
  const { testCase, snapshot, snapshotSizes, astra, inspected, production, aiScore, prodScore } =
    record;
  return [
    `## ${testCase.id}`,
    "",
    `**CASE** ${testCase.title}`,
    "",
    `- family: ${testCase.family}`,
    `- source: ${testCase.source} (${testCase.expectedSource})`,
    `- notes: ${testCase.notes}`,
    "",
    "### Raw Capture",
    "",
    fence("text", testCase.captureText),
    "",
    "### Canonical snapshot supplied to the model",
    "",
    fence("text", snapshot),
    "",
    `Snapshot: ${snapshotSizes.characters} chars, ~${snapshotSizes.approxTokensCl100k} cl100k tokens.`,
    "",
    "### AI-first (one call, rescue bypassed)",
    "",
    `- requested=${astra.requestedModel} response=${astra.responseModel} latency=${astra.latencyMs}ms usage=${JSON.stringify(astra.usage)}`,
    `- inspect.ok=${inspected.ok} malformed=${inspected.malformed} issues=${JSON.stringify(inspected.issues)}`,
    "",
    fence("json", JSON.stringify(inspected.items, null, 2)),
    "",
    "### Production (Prompt A + resolve with rematerialise/hydrate)",
    "",
    production.label,
    "",
    fence("text", production.text),
    "",
    "### Comparison",
    "",
    "**AI-first score**",
    "",
    scoreLines(aiScore),
    "",
    "**Production score**",
    "",
    scoreLines(prodScore),
    "",
  ].join("\n");
}

export function writeGate1V2Report(args: {
  branch: string;
  commit: string;
  baseSha: string;
  model: string;
  records: CaseRecord[];
  aiAgg: AggregateScore;
  prodAgg: AggregateScore;
  assessment: string;
  complexity: string;
  tempted: string[];
}): { reportPath: string; jsonPath: string } {
  const dir = resolve(process.cwd(), "src/lib/experiments/ai-first-capture-gate1-v2");
  mkdirSync(dir, { recursive: true });
  const reportPath = resolve(dir, "GATE1_V2_REPORT.md");
  const jsonPath = resolve(dir, "GATE1_V2_RUN.json");
  const aiRates = rates(args.aiAgg);
  const prodRates = rates(args.prodAgg);

  const body = [
    "# AI-first Capture Gate 1 v2 report",
    "",
    "Disposable experiment from current origin/main. Not mergeable. Rescue pipeline bypassed on the AI-first path.",
    "",
    `A. branch \`${args.branch}\` base/origin/main \`${args.baseSha}\` HEAD \`${args.commit}\``,
    `E. one semantic AI call per case: YES (requested ${args.model})`,
    "F. rematerialise / hydrateFromLocalEvidence / regex recovery / resolve.ts: NOT used on AI-first output",
    "",
    "## I. Aggregate",
    "",
    "| Metric | AI-first | Production |",
    "| --- | --- | --- |",
    `| Correct explicit facts | ${aiRates.correctExplicit} | ${prodRates.correctExplicit} |`,
    `| False writes / bad proposals | ${aiRates.falseWrites} | ${prodRates.falseWrites} |`,
    `| Wrong-target | ${aiRates.wrongTarget} | ${prodRates.wrongTarget} |`,
    `| Silent loss | ${aiRates.silentLoss} | ${prodRates.silentLoss} |`,
    `| Appropriate human fallback | ${aiRates.humanFallback} | ${prodRates.humanFallback} |`,
    `| Correct no-change | ${aiRates.noChange} | ${prodRates.noChange} |`,
    `| Invented / unsupported ops | ${aiRates.invented} | ${prodRates.invented} |`,
    `| Malformed cases | ${aiRates.malformed} | ${prodRates.malformed} |`,
    "",
    ...args.records.map(renderCase),
    "## P. Implementation complexity",
    "",
    args.complexity,
    "",
    "## Q. Rescue logic deliberately not added",
    "",
    ...args.tempted.map((line) => `- ${line}`),
    "",
    "## R. Assessment",
    "",
    args.assessment,
    "",
  ].join("\n");

  writeFileSync(reportPath, body);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        branch: args.branch,
        commit: args.commit,
        baseSha: args.baseSha,
        model: args.model,
        aiAgg: args.aiAgg,
        prodAgg: args.prodAgg,
        cases: args.records.map((r) => ({
          id: r.testCase.id,
          snapshot: r.snapshot,
          snapshotSizes: r.snapshotSizes,
          astra: {
            requestedModel: r.astra.requestedModel,
            responseModel: r.astra.responseModel,
            latencyMs: r.astra.latencyMs,
            usage: r.astra.usage,
            items: r.inspected.items,
            issues: r.inspected.issues,
          },
          production: r.production,
          aiScore: r.aiScore,
          prodScore: r.prodScore,
        })),
      },
      null,
      2,
    ),
  );
  return { reportPath, jsonPath };
}
