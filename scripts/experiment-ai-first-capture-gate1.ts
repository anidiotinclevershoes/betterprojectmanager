/**
 * Disposable Gate 1 runner. Non-mergeable. Does not touch production Capture.
 *
 *   LUME_EXPERIMENT=1 npx --yes tsx scripts/experiment-ai-first-capture-gate1.ts
 */
import { execSync } from "node:child_process";
import { gate1Cases } from "@/lib/experiments/ai-first-capture-gate1/cases";
import { compareInterpretation } from "@/lib/experiments/ai-first-capture-gate1/compare";
import { existingLumeForCase } from "@/lib/experiments/ai-first-capture-gate1/existing-lume";
import {
  AstraUnavailableError,
  interpretCaptureWithAstra,
} from "@/lib/experiments/ai-first-capture-gate1/interpreter";
import { writeGate1Report } from "@/lib/experiments/ai-first-capture-gate1/report";
import {
  measureSnapshot,
  serializeCanonicalSnapshot,
} from "@/lib/experiments/ai-first-capture-gate1/snapshot";
import { GATE1_ASTRA_MODEL } from "@/lib/experiments/ai-first-capture-gate1/types";
import type { CaseRunRecord } from "@/lib/experiments/ai-first-capture-gate1/report";

function git(args: string): string {
  return execSync(`git ${args}`, { encoding: "utf8" }).trim();
}

function assertSnapshotDumpsWorld(
  snapshot: string,
  projectId: string,
  world: ReturnType<typeof gate1Cases>[number]["world"],
): void {
  const project = world.projects.find((p) => p.id === projectId);
  for (const person of project?.stakeholders ?? []) {
    if (!snapshot.includes(person.id)) {
      throw new Error(`Snapshot omitted person ${person.id}`);
    }
  }
  for (const risk of world.risks.filter((r) => r.projectId === projectId)) {
    if (!snapshot.includes(risk.id)) {
      throw new Error(`Snapshot omitted risk ${risk.id}`);
    }
  }
  for (const todo of world.todos.filter((t) => t.projectId === projectId)) {
    if (!snapshot.includes(todo.id)) {
      throw new Error(`Snapshot omitted todo ${todo.id}`);
    }
  }
}

function assess(records: CaseRunRecord[]): string {
  const missed = records.flatMap((r) => r.comparison.materialFactsMissed);
  const invented = records.flatMap((r) => r.comparison.unsupportedOrInvented);
  const unsafeAmbiguity = records.filter((r) =>
    r.comparison.ambiguityHandling.startsWith("unsafe"),
  );
  const badRefs = records.filter((r) =>
    r.comparison.existingEntityReferences.startsWith("incorrect"),
  );
  const ungrounded = records.filter((r) =>
    r.comparison.evidenceGrounding.startsWith("not grounded"),
  );

  if (
    missed.length === 0 &&
    invented.length === 0 &&
    unsafeAmbiguity.length === 0 &&
    badRefs.length === 0
  ) {
    return [
      "PROMISING",
      "",
      "Raw Capture + a dumb current canonical snapshot + one Astra call recovered the material facts on all five cases, bound existing ids where expected, left identity/speculation ambiguous, and did not invent unsupported project truth.",
      "This appears capable of replacing a meaningful portion of Lume's existing semantic interpretation machinery for understanding. It does not by itself replace deterministic Review/Apply safety.",
    ].join("\n");
  }

  if (missed.length <= 2 && unsafeAmbiguity.length === 0) {
    return [
      "MIXED",
      "",
      `Some facts were missed (${missed.length}) or extra observations appeared (${invented.length}). Ambiguity unsafe cases=${unsafeAmbiguity.length}. Incorrect existing-entity binds=${badRefs.length}. Ungrounded evidence cases=${ungrounded.length}.`,
      "The simple architecture understood a useful portion of the information, but it did not cleanly replace the current interpretation layer on every selected case.",
    ].join("\n");
  }

  return [
    "FAILED",
    "",
    `Missed facts=${missed.length}. Invented=${invented.length}. Unsafe ambiguity=${unsafeAmbiguity.length}. Incorrect binds=${badRefs.length}.`,
    "Raw Capture + dumb snapshot + one model call did not appear capable of replacing a meaningful portion of the existing interpretation machinery on this five-case set.",
  ].join("\n");
}

async function main() {
  const branch = git("rev-parse --abbrev-ref HEAD");
  const head = git("rev-parse HEAD");
  const originMain = git("rev-parse origin/main");
  if (!branch.startsWith("experiment/")) {
    throw new Error("Refuse to run except on an experiment/ branch");
  }

  console.log(`Gate 1 spike on ${branch} @ ${head}`);
  console.log(`Requested model: ${GATE1_ASTRA_MODEL}`);

  const cases = gate1Cases();
  const records: CaseRunRecord[] = [];

  for (const testCase of cases) {
    console.log(`\n--- ${testCase.id} ---`);
    const snapshot = serializeCanonicalSnapshot(testCase.world, testCase.projectId);
    assertSnapshotDumpsWorld(snapshot, testCase.projectId, testCase.world);
    const snapshotSizes = measureSnapshot(snapshot);
    console.log(
      `snapshot ${snapshotSizes.characters} chars / ~${snapshotSizes.approxTokensCl100k} tokens`,
    );

    let astra;
    try {
      astra = await interpretCaptureWithAstra({
        captureText: testCase.captureText,
        snapshot,
      });
    } catch (err) {
      if (err instanceof AstraUnavailableError) {
        console.error("STOP: Astra unavailable.");
        console.error(err.message);
        process.exit(2);
      }
      throw err;
    }
    console.log(
      `astra model=${astra.responseModel} latency=${astra.latencyMs}ms usage=${JSON.stringify(astra.usage)} observations=${astra.interpretation.observations.length}`,
    );

    let existingLume;
    try {
      existingLume = await existingLumeForCase(testCase, testCase.world);
    } catch (err) {
      existingLume = {
        source: "harness-error",
        label: "Existing Lume harness failed; experiment interpretation still recorded",
        text: err instanceof Error ? err.message : String(err),
      };
    }

    const comparison = compareInterpretation(
      astra.interpretation,
      testCase.expectedFacts,
      testCase.captureText,
    );
    records.push({
      testCase,
      snapshot,
      snapshotSizes,
      astra,
      existingLume,
      comparison,
    });
  }

  const assessment = assess(records);
  const written = writeGate1Report({
    branch,
    commit: head,
    originMain,
    files: [
      "src/lib/experiments/ai-first-capture-gate1/**",
      "scripts/experiment-ai-first-capture-gate1.ts",
    ],
    records,
    assessment,
    extraNotes: [
      "No resolver / Review / Apply / persistence work was added.",
      "No second Astra call, repair call, or fallback model was used.",
      "Existing Lume comparison used the current extract+resolve harness for corpus cases and the published H6 holdout excerpt for the long-haul case.",
    ],
  });

  console.log(`\nWrote ${written.reportPath}`);
  console.log(`Wrote ${written.jsonPath}`);
  console.log(`\n${assessment.split("\n")[0]}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
