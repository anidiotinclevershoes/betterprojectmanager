/**
 * Gate 1 v2 runner. Experiment-only. Does not touch production Capture.
 *
 *   LUME_EXPERIMENT=1 npx --yes tsx scripts/experiment-ai-first-capture-gate1-v2.ts
 */
import { execSync } from "node:child_process";
import { gate1V2Cases } from "@/lib/experiments/ai-first-capture-gate1-v2/cases";
import {
  interpretOnce,
  ModelUnavailableError,
  resolveGate1V2Model,
} from "@/lib/experiments/ai-first-capture-gate1-v2/interpreter";
import { inspectEnvelope } from "@/lib/experiments/ai-first-capture-gate1-v2/inspect";
import { runProductionCapture } from "@/lib/experiments/ai-first-capture-gate1-v2/production";
import {
  writeGate1V2Report,
  type CaseRecord,
} from "@/lib/experiments/ai-first-capture-gate1-v2/report";
import { aggregateScores, scoreItems } from "@/lib/experiments/ai-first-capture-gate1-v2/score";
import {
  knownCanonicalIds,
  measureSnapshot,
  serializeCurrentCanonicalTruth,
} from "@/lib/experiments/ai-first-capture-gate1-v2/snapshot";

function git(cmd: string): string {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
}

function verdict(records: CaseRecord[]): string {
  const ai = aggregateScores(records.map((r) => r.aiScore));
  const prod = aggregateScores(records.map((r) => r.prodScore));
  const aiWriteFaults = ai.falseWrites + ai.wrongTargets + ai.inventedOperations;
  const aiSilent = ai.silentLoss;
  const aiGood =
    ai.correctExplicitFacts + ai.appropriateHumanFallback + ai.correctNoChange;
  const prodGood =
    prod.correctExplicitFacts + prod.appropriateHumanFallback + prod.correctNoChange;

  if (ai.malformedCases > 0 && aiGood < ai.factsScored / 2) {
    return [
      "AI-FIRST FAILED GATE 1",
      "",
      "Malformed or unusable output, or most facts were lost/wrong. Gate 2 is not justified.",
    ].join("\n");
  }
  if (aiWriteFaults === 0 && aiSilent === 0 && aiGood >= prodGood) {
    return [
      "AI-FIRST CLEARLY PROMISING — PROCEED TO GATE 2",
      "",
      "On this set, one call + current-truth snapshot produced no wrong-target/false-write and no silent loss, and matched or beat production understanding. Still do not auto-start Gate 2.",
    ].join("\n");
  }
  if (aiWriteFaults <= 1 && aiSilent <= 2 && aiGood >= prodGood - 2) {
    return [
      "AI-FIRST PROMISING WITH CONDITIONS",
      "",
      `Write faults=${aiWriteFaults} silent loss=${aiSilent}. Competitive with production (AI good ${aiGood} vs production ${prodGood}) but not clean enough to treat as a replacement without human review of the misses.`,
    ].join("\n");
  }
  return [
    "AI-FIRST NOT BETTER ENOUGH TO JUSTIFY THE CHANGE",
    "",
    `Write faults=${aiWriteFaults} silent=${aiSilent} good=${aiGood} vs production good=${prodGood}. The simple path did not clearly remove the need for current interpretation machinery.`,
  ].join("\n");
}

async function main() {
  const branch = git("rev-parse --abbrev-ref HEAD");
  const head = git("rev-parse HEAD");
  const originMain = git("rev-parse origin/main");
  if (!branch.startsWith("experiment/")) {
    throw new Error("Refuse to run except on an experiment/ branch");
  }

  const model = resolveGate1V2Model();
  console.log(`Gate 1 v2 on ${branch} @ ${head}`);
  console.log(`origin/main ${originMain}`);
  console.log(`model ${model}`);

  const records: CaseRecord[] = [];
  for (const testCase of gate1V2Cases()) {
    console.log(`\n--- ${testCase.id} ---`);
    const snapshot = serializeCurrentCanonicalTruth(
      testCase.world,
      testCase.projectId,
    );
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
    const aiScore = scoreItems(
      inspected.items,
      testCase.expectedFacts,
      inspected.malformed,
    );

    let production: CaseRecord["production"];
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
    const prodScore = scoreItems(
      production.items,
      testCase.expectedFacts,
      false,
    );

    records.push({
      testCase,
      snapshot,
      snapshotSizes,
      astra,
      inspected,
      production,
      aiScore,
      prodScore,
    });
  }

  const assessment = verdict(records);
  const written = writeGate1V2Report({
    branch,
    commit: head,
    baseSha: originMain,
    model,
    records,
    aiAgg: aggregateScores(records.map((r) => r.aiScore)),
    prodAgg: aggregateScores(records.map((r) => r.prodScore)),
    assessment,
    complexity: [
      "AI-first path files: snapshot, contract/schema, one-call interpreter, inspect (parse/enum/id-exists), cases, scorer, report.",
      "No rematerialise, hydrate, date regex, name recovery, or resolve.ts on the AI-first path.",
      "Production comparison reuses extractObservationsWithOpenAI + runCaptureV2FromModelJson unchanged.",
      "Prompt/schema is a small operation enum plus proposedValues. Preprocessing: none. Postprocessing: inspect only.",
      "Special cases live in the case list expectations, not in hidden resolver code.",
    ].join("\n"),
    tempted: [
      "Accept resp-uat vs person-gumdrop by rewriting ids — listed as acceptedTargetIds in fixtures only, not rewritten on model output.",
      "ISO-date regex fill when the model left date blank — not added.",
      "Binding 'Brick' or 'she' to the only plausible person — not added.",
      "Running Astra JSON through resolve.ts to mint Review cards — not added.",
      "Second call to verify or repair — not added.",
      "Importing Prompt A Phase 1 / Simplified Capture — not added.",
    ],
  });
  console.log(`\nWrote ${written.reportPath}`);
  console.log(assessment.split("\n")[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
