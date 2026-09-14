/**
 * Gate 2.5 runner. Experiment-only.
 *
 *   LUME_EXPERIMENT=1 npx --yes tsx scripts/experiment-ai-first-capture-gate2-5.ts
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inspectEnvelope } from "@/lib/experiments/ai-first-capture-gate1-v2/inspect";
import { aggregateScores, scoreItems } from "@/lib/experiments/ai-first-capture-gate1-v2/score";
import type { CaseScore, Gate1V2Item } from "@/lib/experiments/ai-first-capture-gate1-v2/types";
import {
  frozenCorpusStats,
  gate2Cases,
} from "@/lib/experiments/ai-first-capture-gate2/cases";
import { applyGate25DeterministicPath } from "@/lib/experiments/ai-first-capture-gate2-5/apply-path";
import {
  interpretOnce,
  ModelUnavailableError,
  resolveGate1V2Model,
} from "@/lib/experiments/ai-first-capture-gate2-5/interpreter";
import { writeGate25Report, type Gate25Record } from "@/lib/experiments/ai-first-capture-gate2-5/report";
import { runGate25Fixtures } from "@/lib/experiments/ai-first-capture-gate2-5/same-value.fixtures";
import {
  knownCanonicalIds,
  measureSnapshot,
  serializeCurrentCanonicalTruth,
} from "@/lib/experiments/ai-first-capture-gate2-5/snapshot";

function git(cmd: string): string {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
}

function lineCount(rel: string): number {
  try {
    return readFileSync(resolve(process.cwd(), rel), "utf8").split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

type Gate2Stored = {
  gate2Agg: {
    cases: number;
    factsScored: number;
    correctExplicitFacts: number;
    falseWrites: number;
    wrongTargets: number;
    silentLoss: number;
    appropriateHumanFallback: number;
    correctNoChange: number;
    inventedOperations: number;
    malformedCases: number;
  };
  cases: Array<{
    id: string;
    astra: { items: Gate1V2Item[] };
    gate2Score: CaseScore;
    gate2Items?: Gate1V2Item[];
  }>;
};

function verdict(records: Gate25Record[]): string {
  const g2 = aggregateScores(records.map((r) => r.gate2Score));
  const g25 = aggregateScores(records.map((r) => r.gate25Score));
  const g2Faults = g2.falseWrites + g2.wrongTargets + g2.inventedOperations;
  const g25Faults = g25.falseWrites + g25.wrongTargets + g25.inventedOperations;
  const replayBetter =
    records.some((r) => (r.replayFromGate2?.convertedSameValue ?? 0) > 0);
  const relative = records.find((r) => r.testCase.id === "relative-date-parade");
  const relativeStillWrite = relative?.gate25Items.some(
    (i) => i.operation === "update" || i.operation === "create",
  );

  const lines = [
    "P. Did Gate 2.5 materially improve safety without changing architectural character?",
    "",
  ];

  if (g25.malformedCases > 0) {
    lines.push("AI-FIRST GATE 2.5 REGRESSED");
    lines.push("");
    lines.push("Malformed output appeared.");
    return lines.join("\n");
  }
  if (g25Faults > g2Faults + 1 || g25.wrongTargets > g2.wrongTargets) {
    lines.push("AI-FIRST GATE 2.5 REGRESSED");
    lines.push("");
    lines.push(`Faults Gate2=${g2Faults} Gate2.5=${g25Faults}.`);
    return lines.join("\n");
  }
  if (g25Faults < g2Faults || g25.correctNoChange > g2.correctNoChange || replayBetter) {
    lines.push(
      relativeStillWrite
        ? "relative-date-parade remains unfixed (expected)."
        : "relative-date-parade did not emit a dated write on this run.",
    );
    lines.push("");
    lines.push("AI-FIRST GATE 2.5 IMPROVED CLEANLY — READY FOR SHOWDOWN");
    lines.push("");
    lines.push(
      "Same-value and/or current-project contract reduced pointless writes without a resolver.",
    );
    return lines.join("\n");
  }
  lines.push("AI-FIRST GATE 2.5 NEUTRAL — KEEP GATE 2 BASELINE");
  lines.push("");
  lines.push(
    "Allowed hardening did not move the safety metrics enough to prefer 2.5 over Gate 2.",
  );
  return lines.join("\n");
}

async function main() {
  const branch = git("rev-parse --abbrev-ref HEAD");
  const head = git("rev-parse HEAD");
  const originMain = git("rev-parse origin/main");
  if (!branch.startsWith("experiment/")) {
    throw new Error("Refuse to run except on an experiment/ branch");
  }

  const fixtures = runGate25Fixtures();
  if (!fixtures.ok) {
    console.error("Gate 2.5 fixtures failed:");
    for (const row of fixtures.failures) console.error(`- ${row}`);
    process.exit(1);
  }
  console.log("Gate 2.5 fixtures: PASS");

  const stored = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "src/lib/experiments/ai-first-capture-gate2/GATE2_RUN.json"),
      "utf8",
    ),
  ) as Gate2Stored;
  const storedById = new Map(stored.cases.map((row) => [row.id, row]));

  const cases = gate2Cases();
  const frozen = frozenCorpusStats(cases);
  if (frozen.cases !== 43 || frozen.atomicFacts !== 50) {
    throw new Error(`Frozen corpus drifted: ${frozen.cases} / ${frozen.atomicFacts}`);
  }

  const model = resolveGate1V2Model();
  console.log(`Gate 2.5 on ${branch} @ ${head}`);
  console.log(`model ${model}`);
  console.log(`Frozen corpus: ${frozen.cases} cases, ${frozen.atomicFacts} facts`);

  const records: Gate25Record[] = [];
  for (const testCase of cases) {
    console.log(`\n--- ${testCase.id} ---`);
    const snapshot = serializeCurrentCanonicalTruth(testCase.world, testCase.projectId);
    const snapshotSizes = measureSnapshot(snapshot);
    const ids = knownCanonicalIds(testCase.world, testCase.projectId);
    console.log(`snapshot ${snapshotSizes.characters}c ~${snapshotSizes.approxTokensCl100k}t`);

    let astra;
    try {
      astra = await interpretOnce({
        captureText: testCase.captureText,
        snapshot,
      });
    } catch (err) {
      if (err instanceof ModelUnavailableError) {
        console.error("STOP: model unavailable.");
        console.error(err.message);
        process.exit(2);
      }
      throw err;
    }
    console.log(`ai ${astra.responseModel} ${astra.latencyMs}ms ${JSON.stringify(astra.usage)}`);

    const inspected = inspectEnvelope(astra.raw, ids);
    const bounded = applyGate25DeterministicPath(
      inspected.items,
      testCase.world,
      testCase.projectId,
    );
    const converted = bounded.traces.filter((t) => t.sameValueConverted).length;
    console.log(
      `legal=${bounded.traces.filter((t) => t.intercepted).length} same-value=${converted}`,
    );

    const storedCase = storedById.get(testCase.id);
    if (!storedCase) throw new Error(`Missing Gate 2 stored case ${testCase.id}`);

    const replay = applyGate25DeterministicPath(
      storedCase.astra.items,
      testCase.world,
      testCase.projectId,
    );

    records.push({
      testCase,
      snapshot,
      snapshotSizes,
      astra,
      inspected,
      gate25Items: bounded.items,
      traces: bounded.traces,
      gate2Score: storedCase.gate2Score,
      gate25Score: scoreItems(bounded.items, testCase.expectedFacts, inspected.malformed),
      replayFromGate2: {
        convertedSameValue: replay.traces.filter((t) => t.sameValueConverted).length,
        items: replay.items,
        score: scoreItems(replay.items, testCase.expectedFacts, false),
      },
    });
  }

  const assessment = verdict(records);
  const written = writeGate25Report({
    branch,
    commit: head,
    gate2Head: "9e04a4d0b289279ec09f0aa2fd7c88cfe6bc6ab1",
    originMain,
    model,
    frozen: { cases: frozen.cases, atomicFacts: frozen.atomicFacts },
    records,
    gate2Agg: stored.gate2Agg,
    gate25Agg: aggregateScores(records.map((r) => r.gate25Score)),
    replayAgg: aggregateScores(records.map((r) => r.replayFromGate2!.score)),
    assessment,
    finding: [
      "## B. Three areas inspected",
      "",
      "1. Same-value / already-recorded comparison in `planCaptureApply` (milestone isoDay, responsibility currentOwners, person already-on-project).",
      "2. Astra snapshot current-project identity (Gate 2 already emitted project.id/name/code).",
      "3. Person+responsibility write contract (`confirm_responsibility` + `ensurePersonOnProject`).",
      "",
      "## C. Same-value implementation",
      "",
      "After the Gate 2 legal-type boundary, an UPDATE is converted to no_change only when every proposed planner-canonical field equals the target row.",
      "Reused: ISO-day prefix from planCaptureApply `isoDay`; `namesMatchExact`; responsibility scope trim+lowercase from `currentOwners`.",
      "Not reused as an outcome: `planCaptureApply` kind===no_change (that path mixes wording/semantics).",
      "Partial updates (no comparable proposed fields) stay UPDATE.",
      "",
      "## D. Project-identity snapshot",
      "",
      "Gate 2 already supplied id/name/code on one line. Gate 2.5 makes a CURRENT PROJECT header (id, name, code) and adds two contract sentences: writes belong to the current project; other-project attributions are left_untouched.",
      "No other-project catalogue. No regex project-name parser. No cross-project resolver.",
      "",
      "## E. Person+responsibility finding: A — one atomic write",
      "",
      "`confirm_responsibility` ensures the person. Contract tells Astra to emit one responsibility create (personName+scope), not a sibling person create. Schema unchanged. No dedupe heuristic.",
      "",
      "## F. Schema change: none. Gate 1 v2 json_schema retained.",
      "",
      "## G. Semantic resolver added: NO.",
    ].join("\n"),
    complexity: [
      `same-value.ts: ${lineCount("src/lib/experiments/ai-first-capture-gate2-5/same-value.ts")} lines (exact field compare; 2–3 branches: not-update / not-comparable / exact-match).`,
      `snapshot.ts: ${lineCount("src/lib/experiments/ai-first-capture-gate2-5/snapshot.ts")} lines (header only).`,
      `contract.ts: ${lineCount("src/lib/experiments/ai-first-capture-gate2-5/contract.ts")} lines (3 sentences appended; schema unchanged).`,
      `apply-path.ts: ${lineCount("src/lib/experiments/ai-first-capture-gate2-5/apply-path.ts")} lines (compose legal + same-value).`,
      "Wording-dependent?: no for same-value (canonical fields only). Contract sentences are model-facing but not NL interpretation in code.",
      "Still useful if Astra improves?: yes — same-value remains a truth check; current-project header remains; atomic responsibility shape remains the write model.",
    ].join("\n"),
    tempted: [
      "Date parsing / next Friday — NOT implemented.",
      "Pronoun / first-name / spelling bind — NOT implemented.",
      "Fuzzy matching / correction recovery — NOT implemented.",
      "Share-vs-replace / ownership defaults — NOT implemented.",
      "Sibling person+responsibility dedupe heuristic — NOT implemented.",
      "Adopting planCaptureApply no_change/Needs You rewrites — NOT implemented.",
      "Cross-project name regex / other-project catalogue — NOT implemented.",
      "Second AI call / resolve.ts / rematerialise / hydrate — NOT implemented.",
    ],
  });
  console.log(`\nWrote ${written.reportPath}`);
  console.log(assessment.split("\n").filter((l) => l.startsWith("AI-FIRST")).join("\n") || assessment);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
