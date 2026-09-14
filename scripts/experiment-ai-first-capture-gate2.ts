/**
 * Gate 2 runner. Experiment-only. Does not touch production Capture.
 *
 *   LUME_EXPERIMENT=1 npx --yes tsx scripts/experiment-ai-first-capture-gate2.ts
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FROZEN_GATE1_CASE_IDS,
  frozenCorpusStats,
  gate2Cases,
} from "@/lib/experiments/ai-first-capture-gate2/cases";
import { applyLegalWriteBoundary } from "@/lib/experiments/ai-first-capture-gate2/legal-boundary";
import { runLegalBoundaryFixtures } from "@/lib/experiments/ai-first-capture-gate2/legal-boundary.fixtures";
import {
  restatementAsUpdateCount,
  subsetByIds,
  unsupportedWriteCount,
  writeGate2Report,
  type Gate2CaseRecord,
} from "@/lib/experiments/ai-first-capture-gate2/report";
import {
  interpretOnce,
  ModelUnavailableError,
  resolveGate1V2Model,
} from "@/lib/experiments/ai-first-capture-gate1-v2/interpreter";
import { inspectEnvelope } from "@/lib/experiments/ai-first-capture-gate1-v2/inspect";
import { runProductionCapture } from "@/lib/experiments/ai-first-capture-gate1-v2/production";
import { aggregateScores, scoreItems } from "@/lib/experiments/ai-first-capture-gate1-v2/score";
import {
  knownCanonicalIds,
  measureSnapshot,
  serializeCurrentCanonicalTruth,
} from "@/lib/experiments/ai-first-capture-gate1-v2/snapshot";

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

function verdict(records: Gate2CaseRecord[]): string {
  const prod = aggregateScores(records.map((r) => r.prodScore));
  const g1 = aggregateScores(records.map((r) => r.gate1Score));
  const g2 = aggregateScores(records.map((r) => r.gate2Score));
  const g1sub = subsetByIds(records, FROZEN_GATE1_CASE_IDS);
  const unsupportedBefore = unsupportedWriteCount(records, "before");
  const unsupportedAfter = unsupportedWriteCount(records, "after");
  const g2Faults = g2.falseWrites + g2.wrongTargets + g2.inventedOperations;
  const g1Faults = g1.falseWrites + g1.wrongTargets + g1.inventedOperations;
  const prodFaults = prod.falseWrites + prod.wrongTargets + prod.inventedOperations;
  const g2Good =
    g2.correctExplicitFacts + g2.appropriateHumanFallback + g2.correctNoChange;
  const prodGood =
    prod.correctExplicitFacts + prod.appropriateHumanFallback + prod.correctNoChange;
  const g1Good =
    g1.correctExplicitFacts + g1.appropriateHumanFallback + g1.correctNoChange;
  const gate1Intact =
    g1sub.gate2.wrongTargets === g1sub.gate1.wrongTargets &&
    g1sub.gate2.silentLoss === g1sub.gate1.silentLoss &&
    g1sub.gate2.correctExplicitFacts >= g1sub.gate1.correctExplicitFacts - 1;

  const lines: string[] = [];
  lines.push("V. Whether further deterministic rules appear necessary");
  lines.push("");
  if (g2.wrongTargets > 0 || g2.silentLoss > 0) {
    lines.push(
      "Wrong-target or silent-loss is non-zero on the expanded set. Do not add recovery rules in this gate; record the misses.",
    );
  } else if (g2.falseWrites > 0) {
    lines.push(
      "False writes remain after the legal-type boundary. They are semantic (restatement, inference, identity), not unsupported-op class. Do not add another rule here.",
    );
  } else {
    lines.push(
      "The unsupported-write class is blocked. Remaining misses do not justify a new deterministic layer in this gate.",
    );
  }
  lines.push("");

  const blockedClass = unsupportedBefore > 0 && unsupportedAfter === 0;
  const noRepair = records.every((r) =>
    r.traces.every((t) => {
      if (!t.intercepted) return true;
      return t.interceptReason === "Lume cannot safely apply this type of change.";
    }),
  );
  const simpler = true;
  const beatsProd = g2Good >= prodGood && g2Faults <= prodFaults;
  const favourableSample =
    g1.correctExplicitFacts / (g1.factsScored || 1) -
      g2.correctExplicitFacts / (g2.factsScored || 1) >
    0.15;

  if (!noRepair) {
    lines.push("AI-FIRST COMPLEXITY CREEP DETECTED");
    lines.push("");
    lines.push("The boundary rewrote more than unsupported-type rejection.");
    return lines.join("\n");
  }
  if (g2.malformedCases > 0 && g2Good < g2.factsScored / 2) {
    lines.push("AI-FIRST FAILED");
    lines.push("");
    lines.push("Malformed or majority-lost output on the expanded set.");
    return lines.join("\n");
  }
  if (!blockedClass && unsupportedBefore > 0) {
    lines.push("AI-FIRST NEEDS MORE EXPERIMENTATION");
    lines.push("");
    lines.push("Unsupported writes were not fully intercepted.");
    return lines.join("\n");
  }
  if (!gate1Intact) {
    lines.push("AI-FIRST GATE 2 PASSED WITH CONDITIONS");
    lines.push("");
    lines.push("Legal boundary exists, but Gate 1 twelve-case outcomes drifted.");
    return lines.join("\n");
  }
  if (favourableSample) {
    lines.push("AI-FIRST GATE 2 PASSED WITH CONDITIONS");
    lines.push("");
    lines.push(
      "Gate 1's small sample looked stronger than the expanded set. AI-first is not disproved, but the 12-case score was favourable.",
    );
    return lines.join("\n");
  }
  if (
    blockedClass &&
    g2.wrongTargets === 0 &&
    g2Faults <= 2 &&
    beatsProd &&
    simpler &&
    g1Faults >= g2Faults
  ) {
    lines.push("AI-FIRST GATE 2 PASSED — READY FOR ARCHITECTURE SHOWDOWN");
    lines.push("");
    lines.push(
      "Unsupported writes are deterministically blocked, Gate 1 outcomes stay intact, and the expanded set still beats production on the safety-first metrics. Stop. Do not start a showdown automatically.",
    );
    return lines.join("\n");
  }
  if (blockedClass && beatsProd && g2.wrongTargets === 0) {
    lines.push("AI-FIRST GATE 2 PASSED WITH CONDITIONS");
    lines.push("");
    lines.push(
      `Unsupported class blocked. Expanded Gate 2 good=${g2Good} faults=${g2Faults} vs production good=${prodGood} faults=${prodFaults}. Remaining residuals are recorded, not fixed.`,
    );
    return lines.join("\n");
  }
  if (!beatsProd) {
    lines.push("AI-FIRST NEEDS MORE EXPERIMENTATION");
    lines.push("");
    lines.push(
      `Expanded evaluation does not clearly beat production (Gate2 good=${g2Good} faults=${g2Faults} vs prod good=${prodGood} faults=${prodFaults}).`,
    );
    return lines.join("\n");
  }
  lines.push("AI-FIRST NEEDS MORE EXPERIMENTATION");
  lines.push("");
  lines.push("Boundary is in place but the expanded evidence is not decisive.");
  return lines.join("\n");
}

async function main() {
  const branch = git("rev-parse --abbrev-ref HEAD");
  const head = git("rev-parse HEAD");
  const originMain = git("rev-parse origin/main");
  if (!branch.startsWith("experiment/")) {
    throw new Error("Refuse to run except on an experiment/ branch");
  }

  const fixtures = runLegalBoundaryFixtures();
  if (!fixtures.ok) {
    console.error("Deterministic legal-boundary fixtures failed:");
    for (const row of fixtures.failures) console.error(`- ${row}`);
    process.exit(1);
  }
  console.log("Legal-boundary fixtures: PASS");

  const cases = gate2Cases();
  const frozen = frozenCorpusStats(cases);
  console.log(
    `Frozen corpus: ${frozen.cases} cases, ${frozen.atomicFacts} atomic facts (Gate1=${frozen.gate1Cases} expanded=${frozen.expandedCases})`,
  );

  const model = resolveGate1V2Model();
  console.log(`Gate 2 on ${branch} @ ${head}`);
  console.log(`origin/main ${originMain}`);
  console.log(`model ${model}`);

  const records: Gate2CaseRecord[] = [];
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
    console.log(
      `ai ${astra.responseModel} ${astra.latencyMs}ms ${JSON.stringify(astra.usage)}`,
    );
    const inspected = inspectEnvelope(astra.raw, ids);
    const bounded = applyLegalWriteBoundary(
      inspected.items,
      testCase.world,
      testCase.projectId,
    );
    const intercepted = bounded.traces.filter((t) => t.intercepted).length;
    console.log(`boundary intercepted=${intercepted}`);

    const gate1Score = scoreItems(
      inspected.items,
      testCase.expectedFacts,
      inspected.malformed,
    );
    const gate2Score = scoreItems(
      bounded.items,
      testCase.expectedFacts,
      inspected.malformed,
    );

    let production: Gate2CaseRecord["production"];
    try {
      const prod = await runProductionCapture({
        transcript: testCase.captureText,
        world: testCase.world,
        projectId: testCase.projectId,
      });
      production = prod;
      console.log(`prod ${prod.responseModel} items=${prod.items.length}`);
    } catch (err) {
      production = {
        label: "Production harness failed",
        text: err instanceof Error ? err.message : String(err),
        items: [],
      };
      console.log("prod FAILED", production.text);
    }
    const prodScore = scoreItems(production.items, testCase.expectedFacts, false);

    records.push({
      testCase,
      snapshot,
      snapshotSizes,
      astra,
      inspected,
      gate2Items: bounded.items,
      traces: bounded.traces,
      production,
      prodScore,
      gate1Score,
      gate2Score,
    });
  }

  const prodAgg = aggregateScores(records.map((r) => r.prodScore));
  const gate1Agg = aggregateScores(records.map((r) => r.gate1Score));
  const gate2Agg = aggregateScores(records.map((r) => r.gate2Score));
  const assessment = verdict(records);

  const latencies = records.map((r) => r.astra.latencyMs);
  const tokens = records.map((r) => r.astra.usage?.total_tokens ?? 0);
  const avg = (xs: number[]) =>
    xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

  const written = writeGate2Report({
    branch,
    commit: head,
    gate1Base: "92d61d13c4407d04a8e20960e7eb38efa0b103c3",
    originMain,
    model,
    frozen,
    records,
    prodAgg,
    gate1Agg,
    gate2Agg,
    gate1Subset: subsetByIds(records, FROZEN_GATE1_CASE_IDS),
    assessment,
    architecture: [
      "## B. Gate 2 architecture",
      "",
      "raw Capture + compact current canonical snapshot",
      "→ exactly one Astra json_schema call (Gate 1 contract unchanged)",
      "→ inspect: JSON / enum / id-exists (no rewrite)",
      "→ read-only legal-write planner check (`applySupportsOperation` + `planCaptureApply` consult)",
      "→ Create / Update / Remove preserved unchanged if the exact op is legal",
      "→ otherwise Left untouched (unsupported capability)",
      "→ inspect/score only. No production Apply.",
      "",
      "D. existing `planCaptureApply` / `applySupportsOperation` reused: YES (read-only).",
      "E. semantic repair: NO. Failed writes are not rewritten into update/archive/another domain/Needs You.",
      "F. exactly one AI call remains: YES.",
    ].join("\n"),
    boundary: [
      "## C. Exact deterministic boundary added",
      "",
      "For each inspected item whose operation is `create` | `update` | `remove`:",
      "1. Map the AI domain onto `CaptureLegalDomain` (`decision` → `knowledge`; otherwise the stated domain).",
      "2. Ask `applySupportsOperation(domain, op)` — the existing Apply verb matrix.",
      "3. Also call `planCaptureApply` read-only and record its kind/reason. Do **not** adopt its Needs You / no_change / rewritten write.",
      "4. If the exact operation type is not supported, replace only the operation with `left_untouched` and reason `Lume cannot safely apply this type of change.` Preserve domain, target, values, evidence.",
      "5. If supported, leave the AI item unchanged — including restatement-as-update.",
    ].join("\n"),
    complexity: [
      "AI-semantic complexity: Gate 1 prompt + json_schema + one Astra call. Prompt not retuned.",
      `Deterministic safety complexity: legal-boundary.ts (${lineCount("src/lib/experiments/ai-first-capture-gate2/legal-boundary.ts")} lines) reusing applySupportsOperation / planCaptureApply.`,
      "Evaluation-only complexity: expanded cases, scorer reuse, production harness, this runner, report.",
      "",
      "Estimated production path if this architecture were adopted (not counting corpus/harness):",
      `- canonical snapshot serialization: snapshot.ts ~${lineCount("src/lib/experiments/ai-first-capture-gate1-v2/snapshot.ts")} lines`,
      `- one model call + contract: interpreter.ts + contract.ts ~${lineCount("src/lib/experiments/ai-first-capture-gate1-v2/interpreter.ts") + lineCount("src/lib/experiments/ai-first-capture-gate1-v2/contract.ts")} lines`,
      `- schema/type validation: inspect.ts ~${lineCount("src/lib/experiments/ai-first-capture-gate1-v2/inspect.ts")} lines`,
      "- ID existence validation: included in inspect.ts",
      `- legal planner validation: legal-boundary.ts ~${lineCount("src/lib/experiments/ai-first-capture-gate2/legal-boundary.ts")} lines (calls existing Apply matrix/planner)`,
      "- conversion to Review candidate shape: not implemented; estimate 80–150 lines of field mapping, no resolver",
      `  Total new AI-first production surface: ~${
        lineCount("src/lib/experiments/ai-first-capture-gate1-v2/snapshot.ts") +
        lineCount("src/lib/experiments/ai-first-capture-gate1-v2/interpreter.ts") +
        lineCount("src/lib/experiments/ai-first-capture-gate1-v2/contract.ts") +
        lineCount("src/lib/experiments/ai-first-capture-gate1-v2/inspect.ts") +
        lineCount("src/lib/experiments/ai-first-capture-gate2/legal-boundary.ts") +
        120
      } lines plus reuse of planCaptureApply / applySupportsOperation.`,
      "",
      `R. latency/token: Astra n=${latencies.length} avg ${avg(latencies)}ms (min ${Math.min(...latencies)} / max ${Math.max(...latencies)}); avg total_tokens ${avg(tokens)}.`,
      `   restatement-as-update: prod=${restatementAsUpdateCount(records, "prod")} gate1=${restatementAsUpdateCount(records, "gate1")} gate2=${restatementAsUpdateCount(records, "gate2")}`,
    ].join("\n"),
    productionComplexity: [
      "Current production interpretation/resolver layer (this baseline, pre-#175):",
      `- src/lib/capture-v2/resolve.ts: ${lineCount("src/lib/capture-v2/resolve.ts")} lines`,
      `- src/lib/capture-v2/validate.ts: ${lineCount("src/lib/capture-v2/validate.ts")} lines`,
      `- src/lib/capture-v2/extract.ts + prompt.ts: ${lineCount("src/lib/capture-v2/extract.ts") + lineCount("src/lib/capture-v2/prompt.ts")} lines`,
      `- src/lib/capture-v2/toResult.ts: ${lineCount("src/lib/capture-v2/toResult.ts")} lines`,
      `- src/lib/capture-v2/source-coverage.ts: ${lineCount("src/lib/capture-v2/source-coverage.ts")} lines`,
      `- src/lib/capture-v2/contract.ts: ${lineCount("src/lib/capture-v2/contract.ts")} lines`,
      "Plus rematerialise / hydrateFromLocalEvidence, date/name/status regex recovery, and Apply planner/readiness.",
      "The production path is an interpretation + recovery stack. Gate 2's candidate path is snapshot + one call + inspect + legal-type check.",
    ].join("\n"),
    tempted: [
      "Convert restatement `update` (Pippa still UAT / Track freeze remains) into `no_change` via planner same-value detection — NOT implemented.",
      "ISO-date fill or 'next Friday' resolution — NOT implemented.",
      "Pronoun / first-name / spelling bind (she, Brick, Brikk) — NOT implemented.",
      "Fuzzy similar-name matching or second Brick rescue — NOT implemented.",
      "Correction recovery beyond what the model already did — NOT implemented.",
      "Responsibility default owner / share-vs-replace resolver — NOT implemented.",
      "Unsupported-operation aliases (milestone remove → archive/update; person rename → create) — NOT implemented.",
      "Adopting planCaptureApply Needs You / no_change / rewritten values — NOT implemented.",
      "Second Astra call or running Astra JSON through resolve.ts — NOT implemented.",
      "Importing Simplified Capture / PR #175 / Prompt A Left untouched behaviour — NOT implemented.",
    ],
  });

  console.log(`\nWrote ${written.reportPath}`);
  console.log(assessment.split("\n").filter((l) => l.startsWith("AI-FIRST")).join("\n") || assessment);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
