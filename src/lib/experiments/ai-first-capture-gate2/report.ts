import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Gate1V2Call } from "@/lib/experiments/ai-first-capture-gate1-v2/interpreter";
import type { ProductionComparison } from "@/lib/experiments/ai-first-capture-gate1-v2/production";
import type {
  AggregateScore,
  CaseScore,
  Gate1V2Item,
  InspectedEnvelope,
  SnapshotSizes,
} from "@/lib/experiments/ai-first-capture-gate1-v2/types";
import { aggregateScores, rates } from "@/lib/experiments/ai-first-capture-gate1-v2/score";
import { FROZEN_GATE1_CASE_IDS, type Gate2Case } from "./cases";
import type { LegalBoundaryTrace } from "./legal-boundary";

export type Gate2CaseRecord = {
  testCase: Gate2Case;
  snapshot: string;
  snapshotSizes: SnapshotSizes;
  astra: Gate1V2Call;
  inspected: InspectedEnvelope;
  gate2Items: Gate1V2Item[];
  traces: LegalBoundaryTrace[];
  production: ProductionComparison | { label: string; text: string; items: [] };
  prodScore: CaseScore;
  gate1Score: CaseScore;
  gate2Score: CaseScore;
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

export function isWriteOp(op: string): boolean {
  return op === "create" || op === "update" || op === "remove";
}

export function restatementAsUpdateCount(records: Gate2CaseRecord[], which: "gate1" | "gate2" | "prod"): number {
  let n = 0;
  for (const record of records) {
    const items =
      which === "gate1"
        ? record.inspected.items
        : which === "gate2"
          ? record.gate2Items
          : record.production.items;
    for (const fact of record.testCase.expectedFacts) {
      const ops = Array.isArray(fact.expectedOperation)
        ? fact.expectedOperation
        : [fact.expectedOperation];
      if (!ops.includes("no_change")) continue;
      const matched = items.find((item) =>
        fact.tokens.every((token) =>
          [
            item.operation,
            item.domain,
            item.subject,
            item.understood,
            item.evidence,
            item.targetCanonicalId ?? "",
            JSON.stringify(item.proposedValues),
          ]
            .join(" ")
            .toLowerCase()
            .includes(token.toLowerCase()),
        ),
      );
      if (matched?.operation === "update") n += 1;
    }
  }
  return n;
}

export function unsupportedWriteCount(records: Gate2CaseRecord[], stage: "before" | "after"): number {
  let n = 0;
  for (const record of records) {
    n += record.traces.filter((trace) =>
      stage === "before"
        ? trace.applySupports === false
        : trace.applySupports === false && !trace.intercepted,
    ).length;
  }
  return n;
}

function renderCase(record: Gate2CaseRecord): string {
  const {
    testCase,
    snapshot,
    snapshotSizes,
    astra,
    inspected,
    gate2Items,
    traces,
    production,
    gate1Score,
    gate2Score,
    prodScore,
  } = record;
  const intercepted = traces.filter((t) => t.intercepted);
  return [
    `## ${testCase.id}`,
    "",
    `**CASE** ${testCase.title}`,
    "",
    `- family: ${testCase.family}`,
    `- source: ${testCase.source} (${testCase.expectedSource})`,
    `- notes: ${testCase.notes}`,
    `- gate1-retained: ${(FROZEN_GATE1_CASE_IDS as readonly string[]).includes(testCase.id)}`,
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
    "### One Astra call",
    "",
    `- requested=${astra.requestedModel} response=${astra.responseModel} latency=${astra.latencyMs}ms usage=${JSON.stringify(astra.usage)}`,
    `- inspect.ok=${inspected.ok} malformed=${inspected.malformed} issues=${JSON.stringify(inspected.issues)}`,
    "",
    "### Gate 1 items (inspect only)",
    "",
    fence("json", JSON.stringify(inspected.items, null, 2)),
    "",
    "### Gate 2 items (after legal-write boundary)",
    "",
    fence("json", JSON.stringify(gate2Items, null, 2)),
    "",
    intercepted.length
      ? [
          "Boundary intercepted:",
          ...intercepted.map(
            (t) =>
              `- [${t.index}] ${t.operation} ${t.domain} ${t.targetCanonicalId ?? "none"} applySupports=${t.applySupports} planner=${t.plannerKind}/${t.plannerReason}`,
          ),
          "",
        ].join("\n")
      : "Boundary intercepted: none\n",
    "### Production (Prompt A + resolve with rematerialise/hydrate)",
    "",
    production.label,
    "",
    fence("text", production.text),
    "",
    "### Scores",
    "",
    "**Production**",
    "",
    scoreLines(prodScore),
    "",
    "**Gate 1 AI-first**",
    "",
    scoreLines(gate1Score),
    "",
    "**Gate 2 AI-first + legal boundary**",
    "",
    scoreLines(gate2Score),
    "",
  ].join("\n");
}

function table(prod: AggregateScore, g1: AggregateScore, g2: AggregateScore): string {
  const p = rates(prod);
  const a = rates(g1);
  const b = rates(g2);
  return [
    "| Metric | Production | Gate 1 AI-first | Gate 2 + legal boundary |",
    "| --- | --- | --- | --- |",
    `| Correct explicit facts | ${p.correctExplicit} | ${a.correctExplicit} | ${b.correctExplicit} |`,
    `| False writes / bad proposals | ${p.falseWrites} | ${a.falseWrites} | ${b.falseWrites} |`,
    `| Wrong-target | ${p.wrongTarget} | ${a.wrongTarget} | ${b.wrongTarget} |`,
    `| Silent loss | ${p.silentLoss} | ${a.silentLoss} | ${b.silentLoss} |`,
    `| Appropriate human fallback | ${p.humanFallback} | ${a.humanFallback} | ${b.humanFallback} |`,
    `| Correct no-change | ${p.noChange} | ${a.noChange} | ${b.noChange} |`,
    `| Invented / unsupported ops | ${p.invented} | ${a.invented} | ${b.invented} |`,
    `| Malformed cases | ${p.malformed} | ${a.malformed} | ${b.malformed} |`,
  ].join("\n");
}

export function writeGate2Report(args: {
  branch: string;
  commit: string;
  gate1Base: string;
  originMain: string;
  model: string;
  frozen: { cases: number; gate1Cases: number; expandedCases: number; atomicFacts: number; ids: string[] };
  records: Gate2CaseRecord[];
  prodAgg: AggregateScore;
  gate1Agg: AggregateScore;
  gate2Agg: AggregateScore;
  gate1Subset: { prod: AggregateScore; gate1: AggregateScore; gate2: AggregateScore };
  assessment: string;
  architecture: string;
  boundary: string;
  complexity: string;
  productionComplexity: string;
  tempted: string[];
}): { reportPath: string; jsonPath: string } {
  const dir = resolve(process.cwd(), "src/lib/experiments/ai-first-capture-gate2");
  mkdirSync(dir, { recursive: true });
  const reportPath = resolve(dir, "GATE2_REPORT.md");
  const jsonPath = resolve(dir, "GATE2_RUN.json");

  const failures = args.records.filter((r) =>
    r.gate2Score.facts.some((f) =>
      [
        "incorrect_proposed_truth",
        "wrong_target",
        "silent_omission",
        "unsupported_invented_operation",
        "malformed_unusable",
      ].includes(f.bucket),
    ) || r.gate2Score.extraInvented.length > 0 || r.gate2Score.malformed,
  );

  const body = [
    "# AI-first Capture Gate 2 report",
    "",
    "Non-mergeable experiment. Isolated from Simplified Capture / PR #175.",
    "One Astra call per case. Gate 2 adds only a read-only legal-write boundary.",
    "",
    `A. branch \`${args.branch}\` HEAD \`${args.commit}\``,
    `   Gate 1 v2 base HEAD \`707b704bbf820fcc4492c86155889d6afe5d5bae\``,
    `   Gate 1 v2 main baseline \`${args.gate1Base}\``,
    `   origin/main at run \`${args.originMain}\` (not imported; includes later Simplified work)`,
    "",
    args.architecture,
    "",
    args.boundary,
    "",
    `G. frozen evaluation corpus: ${args.frozen.cases} Capture scenarios (${args.frozen.gate1Cases} Gate 1 retained + ${args.frozen.expandedCases} expanded)`,
    `H. atomic expected facts: ${args.frozen.atomicFacts}`,
    "",
    "Frozen case ids:",
    "",
    args.frozen.ids.map((id) => `- ${id}`).join("\n"),
    "",
    "## I. Aggregate (Production vs Gate 1 vs Gate 2)",
    "",
    table(args.prodAgg, args.gate1Agg, args.gate2Agg),
    "",
    "### Gate 1 twelve-case subset (must remain essentially intact)",
    "",
    table(args.gate1Subset.prod, args.gate1Subset.gate1, args.gate1Subset.gate2),
    "",
    `O. restatement-as-update frequency: production=${restatementAsUpdateCount(args.records, "prod")} Gate1=${restatementAsUpdateCount(args.records, "gate1")} Gate2=${restatementAsUpdateCount(args.records, "gate2")}`,
    `P. unsupported-operation write proposals: before boundary=${unsupportedWriteCount(args.records, "before")} after boundary=${unsupportedWriteCount(args.records, "after")}`,
    `Q. malformed-output rate: Gate1=${rates(args.gate1Agg).malformed} Gate2=${rates(args.gate2Agg).malformed} Production=${rates(args.prodAgg).malformed}`,
    "",
    "## J. Per-case Gate 2 failures (wrong write / wrong target / silent loss / unsupported / malformed / extra write)",
    "",
    failures.length
      ? failures
          .map((r) => {
            const bad = r.gate2Score.facts.filter((f) =>
              [
                "incorrect_proposed_truth",
                "wrong_target",
                "silent_omission",
                "unsupported_invented_operation",
                "malformed_unusable",
              ].includes(f.bucket),
            );
            return [
              `### ${r.testCase.id}`,
              ...bad.map((f) => `- ${f.bucket}: ${f.meaning} (${f.note})`),
              ...r.gate2Score.extraInvented.map((x) => `- extra invented write: ${x}`),
            ].join("\n");
          })
          .join("\n\n")
      : "_None._",
    "",
    ...args.records.map(renderCase),
    "## S. Estimated production-path complexity",
    "",
    args.complexity,
    "",
    "## T. Current-production complexity comparison",
    "",
    args.productionComplexity,
    "",
    "## U. Tempting fixes deliberately NOT implemented",
    "",
    ...args.tempted.map((line) => `- ${line}`),
    "",
    "## W. Recommendation",
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
        gate1Base: args.gate1Base,
        originMain: args.originMain,
        model: args.model,
        frozen: args.frozen,
        prodAgg: args.prodAgg,
        gate1Agg: args.gate1Agg,
        gate2Agg: args.gate2Agg,
        cases: args.records.map((r) => ({
          id: r.testCase.id,
          snapshotSizes: r.snapshotSizes,
          astra: {
            requestedModel: r.astra.requestedModel,
            responseModel: r.astra.responseModel,
            latencyMs: r.astra.latencyMs,
            usage: r.astra.usage,
            items: r.inspected.items,
            issues: r.inspected.issues,
          },
          traces: r.traces,
          gate2Items: r.gate2Items,
          production: r.production,
          prodScore: r.prodScore,
          gate1Score: r.gate1Score,
          gate2Score: r.gate2Score,
        })),
      },
      null,
      2,
    ),
  );
  return { reportPath, jsonPath };
}

export function subsetByIds(records: Gate2CaseRecord[], ids: readonly string[]) {
  const set = new Set(ids);
  const rows = records.filter((r) => set.has(r.testCase.id));
  return {
    prod: aggregateScores(rows.map((r) => r.prodScore)),
    gate1: aggregateScores(rows.map((r) => r.gate1Score)),
    gate2: aggregateScores(rows.map((r) => r.gate2Score)),
  };
}
