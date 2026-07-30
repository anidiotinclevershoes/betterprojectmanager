/**
 * Golden Test — scoring presentation checks + three pipeline runs.
 * Run: npx tsx scripts/verify-golden-test.ts
 */
import assert from "node:assert/strict";
import {
  WEBSITE_REFRESH_SCENARIO,
  fixtureToMissionState,
  presentGoldenResult,
  scoreGoldenResult,
} from "../src/lib/dev/golden";
import { buildCaptureContext } from "../src/lib/capture/context";
import { localCaptureFallback } from "../src/lib/openai";
import type { MissionState } from "../src/lib/types";

const scenario = WEBSITE_REFRESH_SCENARIO;
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
  assert.equal(result.proposedOperations?.length, 3);
  assert.ok(presented.findingCards && presented.findingCards.length >= 3);
  assert.ok(
    presented.reasoning.every((r) => r.sourceFindingId),
    "reasoning must link to findings",
  );
  runs.push(score);
}

console.log("verify-golden-test: all checks passed");
for (const [i, score] of runs.entries()) {
  console.log(
    `  live-local run ${i + 1}: ${score.gradeEmoji} ${score.gradeLabel} (${score.matched}/${score.total}, unexpected=${score.unexpectedCount})`,
  );
}
