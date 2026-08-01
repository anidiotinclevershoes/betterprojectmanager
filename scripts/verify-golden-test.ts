/**
 * Golden Test — scoring presentation checks + three pipeline runs.
 * Run: npx tsx scripts/verify-golden-test.ts
 */
import assert from "node:assert/strict";
import {
  WEBSITE_REFRESH_HARD_SCENARIO,
  WEBSITE_REFRESH_SCENARIO,
  fixtureToMissionState,
  hardScenarioBand,
  hardScenarioExplanation,
  listGoldenScenarios,
  presentGoldenResult,
  scoreGoldenResult,
} from "../src/lib/dev/golden";
import { buildCaptureContext } from "../src/lib/capture/context";
import { localCaptureFallback } from "../src/lib/openai";
import type { CaptureResult, MissionState } from "../src/lib/types";

const scenario = WEBSITE_REFRESH_SCENARIO;
assert.equal(scenario.name, "Website Refresh — Standard");
assert.equal(scenario.scoringMode, "standard");

const listed = listGoldenScenarios();
assert.ok(listed.some((s) => s.id === "website-refresh"));
assert.ok(listed.some((s) => s.id === "website-refresh-hard"));
assert.equal(
  listed.find((s) => s.id === "website-refresh-hard")?.name,
  "Website Refresh — Hard Capture",
);

const fixture = fixtureToMissionState(scenario);
const state: MissionState = { ...fixture, memories: [] };

assert.equal(state.projects[0]?.name, "Website Refresh");
assert.ok(state.todos.some((t) => t.title === "Obtain CAB approval"));

const runs: Array<ReturnType<typeof scoreGoldenResult>> = [];
for (let i = 0; i < 3; i++) {
  const captureContext = buildCaptureContext({
    projectId: scenario.project.id,
    captureText: scenario.defaultCapture,
    state,
  });
  const result = localCaptureFallback(
    {
      content: scenario.defaultCapture,
      projectId: scenario.project.id,
      sourceType: "note",
    },
    state,
    captureContext,
  );
  const score = scoreGoldenResult(scenario, result);
  const presented = presentGoldenResult(
    scenario,
    result,
    scenario.defaultCapture,
  );
  assert.equal(score.passed, true, `run ${i + 1} failed: ${score.gradeLabel}`);
  assert.equal(score.matched, 3);
  assert.equal(score.unexpectedCount, 0);
  assert.equal(score.scoringMode, "standard");
  assert.equal(result.proposedOperations?.length, 3);
  assert.ok(presented.findingCards && presented.findingCards.length >= 3);
  assert.ok(
    presented.reasoning.every((r) => r.sourceFindingId),
    "reasoning must link to findings",
  );
  runs.push(score);
}

// --- Hard scenario ---
const hard = WEBSITE_REFRESH_HARD_SCENARIO;
assert.equal(hard.scoringMode, "hard");
assert.ok(hard.defaultCapture.toLowerCase().includes("milk"));
assert.ok(hard.defaultCapture.toLowerCase().includes("marcus"));
assert.ok(/\.\.\./.test(hard.defaultCapture) || /wait, no/i.test(hard.defaultCapture));
assert.equal(hard.stakeholders[0]?.role, "Business Owner");

const hardFixture = fixtureToMissionState(hard);
const hardState: MissionState = { ...hardFixture, memories: [] };
const hardContext = buildCaptureContext({
  projectId: hard.project.id,
  captureText: hard.defaultCapture,
  state: hardState,
});
const hardResult = localCaptureFallback(
  {
    content: hard.defaultCapture,
    projectId: hard.project.id,
    sourceType: "note",
  },
  hardState,
  hardContext,
);
const hardScore = scoreGoldenResult(hard, hardResult);

assert.equal(hardScore.scoringMode, "hard");
assert.ok(hardScore.hardBandLabel);
assert.ok(hardScore.hardExplanation);
// Hard is exploratory — do not require Perfect / passed.
assert.equal(hardScore.passed, false);
assert.ok(
  ["Strong", "Mixed", "Unreliable"].includes(hardScore.hardBandLabel!),
);

const opsText = JSON.stringify(hardResult.proposedOperations ?? []).toLowerCase();
assert.equal(
  opsText.includes("milk"),
  false,
  "irrelevant personal content must not become an operation",
);

// Prohibited outcomes affect the hard score when triggered
const withProhibited: CaptureResult = {
  ...hardResult,
  proposedOperations: [
    ...(hardResult.proposedOperations ?? []),
    {
      id: "op-bad-milk",
      sourceFindingId: "f-milk",
      operation: "CREATE",
      entityType: "todo",
      targetId: null,
      targetTitle: "Buy milk on the way home",
      proposedValues: { text: "Buy milk" },
      confidence: 40,
      requiresConfirmation: true,
      reason: "Personal reminder",
    },
  ],
};
const prohibitedScore = scoreGoldenResult(hard, withProhibited);
assert.ok(
  (prohibitedScore.prohibitedTriggered ?? 0) >= 1,
  "prohibited milk operation should be counted",
);
assert.equal(prohibitedScore.hardBand, "unreliable");

// Friendly explanation rules are deterministic
assert.equal(
  hardScenarioBand({
    matched: 3,
    total: 3,
    prohibitedTriggered: 0,
    unexpectedCount: 0,
    invalidTargetCount: 0,
  }).label,
  "Strong",
);
assert.equal(
  hardScenarioBand({
    matched: 2,
    total: 3,
    prohibitedTriggered: 0,
    unexpectedCount: 1,
    invalidTargetCount: 0,
  }).label,
  "Mixed",
);
assert.match(
  hardScenarioExplanation({
    matched: 0,
    total: 3,
    prohibitedTriggered: 1,
    unexpectedCount: 2,
    ambiguousFindings: 2,
    invalidTargetCount: 1,
  }),
  /too ambiguous/i,
);

console.log("verify-golden-test: all checks passed");
for (const [i, score] of runs.entries()) {
  console.log(
    `  standard local run ${i + 1}: ${score.gradeEmoji} ${score.gradeLabel} (${score.matched}/${score.total}, unexpected=${score.unexpectedCount})`,
  );
}
console.log(
  `  hard local run: ${hardScore.hardBandLabel} (${hardScore.matched}/${hardScore.total}, prohibited=${hardScore.prohibitedTriggered}, unexpected=${hardScore.unexpectedCount})`,
);
console.log(`  hard explanation: ${hardScore.hardExplanation}`);
