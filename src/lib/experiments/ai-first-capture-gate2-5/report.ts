import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Gate1V2Call } from "@/lib/experiments/ai-first-capture-gate1-v2/interpreter";
import type {
  AggregateScore,
  CaseScore,
  Gate1V2Item,
  InspectedEnvelope,
  SnapshotSizes,
} from "@/lib/experiments/ai-first-capture-gate1-v2/types";
import { rates } from "@/lib/experiments/ai-first-capture-gate1-v2/score";
import type { Gate2Case } from "@/lib/experiments/ai-first-capture-gate2/cases";
import type { Gate25Trace } from "./apply-path";

export type Gate25Record = {
  testCase: Gate2Case;
  snapshot: string;
  snapshotSizes: SnapshotSizes;
  astra: Gate1V2Call;
  inspected: InspectedEnvelope;
  gate25Items: Gate1V2Item[];
  traces: Gate25Trace[];
  gate2Score: CaseScore;
  gate25Score: CaseScore;
  replayFromGate2: {
    convertedSameValue: number;
    items: Gate1V2Item[];
    score: CaseScore;
  } | null;
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

function table(g2: AggregateScore, g25: AggregateScore): string {
  const a = rates(g2);
  const b = rates(g25);
  return [
    "| Metric | Gate 2 | Gate 2.5 |",
    "| --- | --- | --- |",
    `| Correct explicit facts | ${a.correctExplicit} | ${b.correctExplicit} |`,
    `| False writes / bad proposals | ${a.falseWrites} | ${b.falseWrites} |`,
    `| Wrong-target | ${a.wrongTarget} | ${b.wrongTarget} |`,
    `| Silent loss | ${a.silentLoss} | ${b.silentLoss} |`,
    `| Appropriate human fallback | ${a.humanFallback} | ${b.humanFallback} |`,
    `| Correct no-change | ${a.noChange} | ${b.noChange} |`,
    `| Invented / unsupported ops | ${a.invented} | ${b.invented} |`,
    `| Malformed cases | ${a.malformed} | ${b.malformed} |`,
  ].join("\n");
}

const NAMED = [
  "nochange-pippa",
  "cross-project-bait",
  "holdout-h6",
  "relative-date-parade",
] as const;

export function writeGate25Report(args: {
  branch: string;
  commit: string;
  gate2Head: string;
  originMain: string;
  model: string;
  frozen: { cases: number; atomicFacts: number };
  records: Gate25Record[];
  gate2Agg: AggregateScore;
  gate25Agg: AggregateScore;
  replayAgg: AggregateScore | null;
  assessment: string;
  finding: string;
  complexity: string;
  tempted: string[];
}): { reportPath: string; jsonPath: string } {
  const dir = resolve(process.cwd(), "src/lib/experiments/ai-first-capture-gate2-5");
  mkdirSync(dir, { recursive: true });
  const reportPath = resolve(dir, "GATE2_5_REPORT.md");
  const jsonPath = resolve(dir, "GATE2_5_RUN.json");

  const named = args.records.filter((r) => (NAMED as readonly string[]).includes(r.testCase.id));

  const body = [
    "# AI-first Capture Gate 2.5 report",
    "",
    "Non-mergeable bounded hardening. Isolated from Simplified Capture.",
    "Same frozen 43-case / 50-fact corpus as Gate 2. Expectations unchanged.",
    "",
    `A. branch \`${args.branch}\` HEAD \`${args.commit}\``,
    `   Gate 2 HEAD \`${args.gate2Head}\``,
    `   origin/main \`${args.originMain}\` (not imported)`,
    "",
    args.finding,
    "",
    `G. frozen corpus: ${args.frozen.cases} cases / ${args.frozen.atomicFacts} atomic facts (unchanged)`,
    "",
    "## H. Gate 2 vs Gate 2.5 (live Astra + Gate 2.5 path)",
    "",
    table(args.gate2Agg, args.gate25Agg),
    "",
    args.replayAgg
      ? [
          "### Change 1 isolation: Gate 2 Astra items replayed through same-value only",
          "",
          table(args.gate2Agg, args.replayAgg),
          "",
        ].join("\n")
      : "",
    "## M. Named residual cases",
    "",
    ...named.flatMap((r) => [
      `### ${r.testCase.id}`,
      "",
      fence("text", r.testCase.captureText),
      "",
      "**Gate 2.5 items**",
      "",
      fence("json", JSON.stringify(r.gate25Items, null, 2)),
      "",
      "**Gate 2 score (live baseline from GATE2_RUN.json)**",
      "",
      scoreLines(r.gate2Score),
      "",
      "**Gate 2.5 score**",
      "",
      scoreLines(r.gate25Score),
      "",
      r.replayFromGate2
        ? [
            `Replay same-value conversions from Gate 2 items: ${r.replayFromGate2.convertedSameValue}`,
            "",
            scoreLines(r.replayFromGate2.score),
            "",
          ].join("\n")
        : "",
    ]),
    ...args.records
      .filter((r) => !(NAMED as readonly string[]).includes(r.testCase.id))
      .map((r) =>
        [
          `## ${r.testCase.id}`,
          "",
          `- snapshot ${r.snapshotSizes.characters}c ~${r.snapshotSizes.approxTokensCl100k}t`,
          `- astra ${r.astra.responseModel} ${r.astra.latencyMs}ms ${JSON.stringify(r.astra.usage)}`,
          `- same-value conversions: ${r.traces.filter((t) => t.sameValueConverted).length}`,
          `- legal intercepts: ${r.traces.filter((t) => t.intercepted).length}`,
          "",
          "**Gate 2.5 items**",
          "",
          fence("json", JSON.stringify(r.gate25Items, null, 2)),
          "",
          "**Gate 2.5 score**",
          "",
          scoreLines(r.gate25Score),
          "",
        ].join("\n"),
      ),
    "## N. Production-equivalent complexity added",
    "",
    args.complexity,
    "",
    "## O. Tempting fixes still NOT implemented",
    "",
    ...args.tempted.map((line) => `- ${line}`),
    "",
    "## Q. Recommendation",
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
        gate2Head: args.gate2Head,
        originMain: args.originMain,
        model: args.model,
        frozen: args.frozen,
        gate2Agg: args.gate2Agg,
        gate25Agg: args.gate25Agg,
        replayAgg: args.replayAgg,
        cases: args.records.map((r) => ({
          id: r.testCase.id,
          snapshotSizes: r.snapshotSizes,
          astra: {
            requestedModel: r.astra.requestedModel,
            responseModel: r.astra.responseModel,
            latencyMs: r.astra.latencyMs,
            usage: r.astra.usage,
            items: r.inspected.items,
          },
          traces: r.traces,
          gate25Items: r.gate25Items,
          gate2Score: r.gate2Score,
          gate25Score: r.gate25Score,
          replayFromGate2: r.replayFromGate2,
        })),
      },
      null,
      2,
    ),
  );
  return { reportPath, jsonPath };
}
