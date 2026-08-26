/**
 * Deterministic Capture V2 evaluation-foundation tests.
 * No live provider calls. Fixture model output + scoring + Lume safety path.
 *
 * Run: npx tsx scripts/verify-eval-capture-v2.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAPTURE_V2_EVAL_CORPUS,
  REQUIRED_CORPUS_CATEGORIES,
} from "../src/lib/eval-capture-v2/corpus";
import {
  FROZEN_SYSTEM_MESSAGE,
  FROZEN_V2_BASELINE,
  baselineStillMatchesProduction,
} from "../src/lib/eval-capture-v2/baseline";
import { evaluateAgainstCase, evaluateFrozenCase } from "../src/lib/eval-capture-v2/pipeline";
import { frozenEnvelopeFor, FROZEN_MODEL_OUTPUTS } from "../src/lib/eval-capture-v2/frozen-model-outputs";
import { scoreModelObservations } from "../src/lib/eval-capture-v2/scoring";
import { runCaptureV2Eval } from "../src/lib/eval-capture-v2/harness";
import { PINNED_OPENAI_CHAT_MODEL } from "../src/lib/openai-model";
import { isCaptureV2Enabled } from "../src/lib/capture-v2/flag";
import { CANDYLAND_ID } from "../src/lib/experiments/worlds";

function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => console.log(`✓ ${name}`));
}

async function main() {
  await check("frozen baseline still matches production V2 prompt/schema/model", () => {
    const match = baselineStillMatchesProduction();
    assert.equal(match.ok, true, match.issues.join("\n"));
    assert.equal(FROZEN_V2_BASELINE.defaultModel, PINNED_OPENAI_CHAT_MODEL);
    assert.equal(FROZEN_V2_BASELINE.programme.headSha, "3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4");
    const extract = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/extract.ts"),
      "utf8",
    );
    assert.ok(extract.includes(FROZEN_SYSTEM_MESSAGE));
    assert.ok(extract.includes("temperature: 0.2"));
    assert.ok(extract.includes('response_format: { type: "json_object" }'));
    assert.ok(extract.includes("resolveOpenAIChatModel()"));
  });

  await check("V2 flag behaviour is unchanged", () => {
    assert.equal(isCaptureV2Enabled({}), false);
    assert.equal(isCaptureV2Enabled({ LUME_CAPTURE_V2: "0" }), false);
    assert.equal(isCaptureV2Enabled({ LUME_CAPTURE_V2: "1" }), true);
    assert.equal(isCaptureV2Enabled({ LUME_CAPTURE_V2: "true" }), true);
  });

  await check("corpus is 15–25 high-value cases covering required categories", () => {
    assert.ok(CAPTURE_V2_EVAL_CORPUS.length >= 15);
    assert.ok(CAPTURE_V2_EVAL_CORPUS.length <= 25);
    const categories = new Set(CAPTURE_V2_EVAL_CORPUS.map((c) => c.category));
    for (const required of REQUIRED_CORPUS_CATEGORIES) {
      assert.ok(categories.has(required), `missing category ${required}`);
    }
    assert.ok(CAPTURE_V2_EVAL_CORPUS.every((c) => c.projectId === CANDYLAND_ID));
    const joined = CAPTURE_V2_EVAL_CORPUS.map((c) => c.transcript).join(" ");
    assert.equal(/Niamh|CAB pack|Priya Shah|Atlas Platform/i.test(joined), false);
  });

  await check("metrics stay separate — no opaque overall score helper", () => {
    const scoring = readFileSync(
      join(process.cwd(), "src/lib/eval-capture-v2/scoring.ts"),
      "utf8",
    );
    assert.equal(/overallScore|compositeScore|weightedScore/.test(scoring), false);
    const lume = readFileSync(
      join(process.cwd(), "src/lib/eval-capture-v2/lume-safety.ts"),
      "utf8",
    );
    assert.ok(lume.includes("lume_failure"));
    assert.ok(lume.includes("lume_catch"));
    assert.ok(lume.includes("model_failure"));
  });

  await check("frozen existing-person does not create a duplicate write", () => {
    const testCase = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === "existing-person");
    assert.ok(testCase);
    const evaluated = evaluateFrozenCase(testCase);
    assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
    assert.ok(evaluated.pipeline.resolved.every((r) => r.decision.kind !== "write"));
  });

  await check("frozen risk resolution is a Risk write, not a To Do", () => {
    const testCase = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === "risk-resolution");
    assert.ok(testCase);
    const evaluated = evaluateFrozenCase(testCase);
    const writes = evaluated.pipeline.resolved.filter((r) => r.decision.kind === "write");
    assert.equal(writes.length, 1);
    if (writes[0]?.decision.kind === "write") {
      assert.equal(writes[0].decision.domain, "risk");
      assert.equal(writes[0].decision.operation.type, "update_risk_status");
    }
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
  });

  await check("frozen milestone move is a milestone write", () => {
    const testCase = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === "milestone-move");
    assert.ok(testCase);
    const evaluated = evaluateFrozenCase(testCase);
    const write = evaluated.pipeline.resolved.find((r) => r.decision.kind === "write");
    assert.ok(write);
    if (write?.decision.kind === "write") {
      assert.equal(write.decision.domain, "milestone");
    }
  });

  await check("frozen share-vs-replace is Needs you, never Apply Ready", () => {
    const testCase = CAPTURE_V2_EVAL_CORPUS.find(
      (c) => c.id === "share-vs-replace-ambiguous",
    );
    assert.ok(testCase);
    const evaluated = evaluateFrozenCase(testCase);
    assert.ok(evaluated.pipeline.resolved.every((r) => r.decision.kind === "needs_you"));
    assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
  });

  await check("foreign / invented IDs fail closed (Lume catch, not write)", () => {
    const testCase = CAPTURE_V2_EVAL_CORPUS.find(
      (c) => c.id === "foreign-ids-malformed-envelope",
    );
    assert.ok(testCase);
    const evaluated = evaluateFrozenCase(testCase);
    assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
    assert.ok(evaluated.lumeSafety.totals.foreignProjectTargetsBlocked >= 1);
    assert.equal(evaluated.lumeSafety.totals.projectIsolationViolation, 0);
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
  });

  await check("duplicate restatement does not create two durable writes", () => {
    const testCase = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === "duplicate-observation");
    assert.ok(testCase);
    const evaluated = evaluateFrozenCase(testCase);
    const writes = evaluated.pipeline.resolved.filter((r) => r.decision.kind === "write");
    assert.equal(writes.length, 1);
  });

  await check("scoring is meaning-based, not exact prose equality", () => {
    const testCase = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === "todo-create");
    assert.ok(testCase);
    const paraphrased = scoreModelObservations(testCase, [
      {
        id: "obs-x",
        statement: "Need to shine the candy-cane banners before departure",
        evidence: "Please add a to-do to polish the candy-cane banners before the float leaves.",
        domain: "todo",
        disposition: "create_new",
        projectId: CANDYLAND_ID,
        candidateTargetId: null,
        candidateTargetTitle: null,
        mergeWithObservationId: null,
        proposedValues: { title: "Shine candy-cane banners" },
        commentary: null,
        modelConfidence: null,
      },
    ]);
    assert.equal(paraphrased.materialRecall, 1);
    assert.equal(paraphrased.unsupportedCount, 0);
  });

  await check("live harness without keys skips truthfully and does not fake success", async () => {
    const prev = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    };
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
      const report = await runCaptureV2Eval({
        providers: ["openai", "anthropic", "gemini"],
        runs: 1,
        caseIds: ["explicit-no-change"],
      });
      assert.equal(report.liveCallsAttempted, 0);
      assert.equal(report.liveCallsSucceeded, 0);
      assert.equal(report.results.length, 0);
      assert.equal(report.skipped.length, 3);
      assert.ok(report.skipped.every((s) => s.reason.includes("No results were invented")));
    } finally {
      for (const [key, value] of Object.entries(prev)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  await check("committed e2e fixtures match the frozen V2 pipeline", () => {
    const todo = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === "todo-create");
    assert.ok(todo);
    const evaluated = evaluateFrozenCase(todo);
    const frozen = JSON.parse(
      readFileSync(join(process.cwd(), "e2e/fixtures/capture-results/todo-create.json"), "utf8"),
    ) as { result: { observationAccount?: { proposedChanges?: number } } };
    assert.equal(
      frozen.result.observationAccount?.proposedChanges,
      evaluated.pipeline.result.observationAccount?.proposedChanges,
    );
    for (const id of [
      "existing-person",
      "risk-resolution",
      "milestone-move",
      "availability",
      "todo-create",
      "share-vs-replace-ambiguous",
    ]) {
      assert.ok(FROZEN_MODEL_OUTPUTS.some((row) => row.caseId === id), id);
      frozenEnvelopeFor(id);
    }
  });

  await check("adversarial CREATE of existing person is caught by Lume identity gate", () => {
    const testCase = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === "existing-person");
    assert.ok(testCase);
    const evaluated = evaluateAgainstCase({
      testCase,
      rawModelJson: {
        observations: [
          {
            id: "obs-dup",
            statement: "Pippa Gumdrop is still the UAT lead",
            evidence: "Pippa Gumdrop is still the UAT lead for the licorice stands.",
            domain: "person",
            disposition: "create_new",
            proposedValues: { name: "Pippa Gumdrop" },
          },
        ],
      },
    });
    assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
    assert.ok(
      evaluated.pipeline.resolved[0]?.decision.kind === "no_change" ||
        evaluated.pipeline.resolved[0]?.decision.kind === "needs_you",
    );
  });

  console.log("\nEval foundation checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
