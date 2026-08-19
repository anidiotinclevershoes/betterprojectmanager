/**
 * Golden Test — scoring, hard-scenario repair, facts, reliability separation.
 * Run: npx tsx scripts/verify-golden-test.ts
 */
import assert from "node:assert/strict";
import {
  MIXED_OPERATIONS_SCENARIO,
  WEBSITE_REFRESH_HARD_SCENARIO,
  WEBSITE_REFRESH_SCENARIO,
  assessGoldenReliability,
  expectedChangesMatch,
  extractAtomicFacts,
  fixtureToMissionState,
  hardRegressionBand,
  listGoldenScenarios,
  presentGoldenResult,
  scoreGoldenResult,
} from "../src/lib/dev/golden";
import { buildCaptureContext } from "../src/lib/capture/context";
import { localCaptureFallback } from "../src/lib/openai";
import type { CaptureResult, MissionState } from "../src/lib/types";
import type { ProposedOperation } from "../src/lib/capture/findings";

function baseOp(
  over: Partial<ProposedOperation> &
    Pick<
      ProposedOperation,
      "id" | "operation" | "entityType" | "sourceFindingId"
    >,
): ProposedOperation {
  return {
    targetTitle: over.targetTitle ?? "x",
    reason: over.reason ?? "test",
    evidence: over.evidence ?? "test",
    confidence: over.confidence ?? 90,
    destructive: false,
    requiresClarification: false,
    ...over,
  };
}

// --- Standard remains strict and unchanged ---
const scenario = WEBSITE_REFRESH_SCENARIO;
assert.equal(scenario.name, "Website Refresh — Standard");
assert.equal(scenario.scoringMode, "standard");
assert.equal(scenario.expected[1]?.entity, "knowledge");
assert.equal(scenario.expected[1]?.targetId, "know-golden-proj-website-refresh-now-0");

const listed = listGoldenScenarios();
assert.ok(listed.some((s) => s.id === "website-refresh-hard"));

const fixture = fixtureToMissionState(scenario);
const state: MissionState = { ...fixture, memories: [] };

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
  const score = scoreGoldenResult(scenario, result, {
    captureText: scenario.defaultCapture,
  });
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
  // Facts must be atomic — not raw multi-sentence transcript dumps
  assert.ok(presented.facts.every((f) => f.length < 160));
  assert.ok(
    presented.facts.some((f) => /cab/i.test(f)),
    "facts should mention CAB",
  );
  runs.push(score);
}

// --- Hard scenario expectations ---
const hard = WEBSITE_REFRESH_HARD_SCENARIO;
assert.equal(hard.scoringMode, "hard");
assert.equal(hard.expected[1]?.entity, "milestone");
assert.equal(hard.expected[1]?.targetId, "golden-tl-release");
assert.equal(hard.expected[2]?.entity, "risk");
assert.deepEqual(hard.expected[2]?.acceptedOperations, ["complete", "update"]);

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
const hardScore = scoreGoldenResult(hard, hardResult, {
  captureText: hard.defaultCapture,
});
const hardPresented = presentGoldenResult(
  hard,
  hardResult,
  hard.defaultCapture,
);

assert.equal(hardScore.matched, 3, `hard matched ${hardScore.matched}/3: ${hardScore.outcomes.map((o) => `${o.status}:${o.label}`).join(" | ")}`);
assert.equal(hardScore.prohibitedTriggered, 0);
assert.equal(hardScore.unexpectedCount, 0);
assert.equal(hardScore.invalidTargetCount, 0);
assert.equal(hardScore.hardBandLabel, "Strong");
assert.ok(hardScore.reliability);
assert.notEqual(
  hardScore.reliability!.label,
  "Limited",
  "reliability must not be Limited when signals are clean",
);
// Overall grade is Strong (regression), not Unreliable from op labels
assert.equal(hardScore.gradeLabel, "Strong");

const opsText = JSON.stringify(hardResult.proposedOperations ?? []).toLowerCase();
assert.equal(opsText.includes("milk"), false);
assert.ok(
  (hardResult.proposedOperations ?? []).some(
    (o) => o.entityType === "milestone" && o.operation === "UPDATE",
  ),
  "hard local pipeline should UPDATE the Release milestone",
);

// Atomic facts — filler / milk out; negated ownership in
const factsBlob = hardPresented.facts.join("\n");
assert.equal(/milk/i.test(factsBlob), false, "milk must be omitted from Facts");
assert.equal(
  /okay,? so|before i forget/i.test(factsBlob),
  false,
  "filler speech must be omitted from Facts",
);
assert.ok(
  hardPresented.facts.some((f) => /sarah remains/i.test(f)),
  "Sarah remains owner should be retained",
);
assert.ok(
  hardPresented.facts.some((f) => /marcus/i.test(f) && /release notes/i.test(f)),
  "Marcus release-notes support should be retained",
);
assert.ok(hardPresented.facts.every((f) => f.length < 160));

// --- Semantic Risk alternative (UPDATE + RESOLVED) ---
const altRiskResult: CaptureResult = {
  ...hardResult,
  proposedOperations: (hardResult.proposedOperations ?? []).map((op) =>
    op.entityType === "risk"
      ? {
          ...op,
          operation: "UPDATE" as const,
          proposedValues: { status: "RESOLVED" },
        }
      : op,
  ),
};
const altScore = scoreGoldenResult(hard, altRiskResult, {
  captureText: hard.defaultCapture,
});
assert.equal(altScore.matched, 3);
assert.ok(
  altScore.outcomes.some(
    (o) =>
      o.expectedId === "resolve-cdn" && o.status === "valid_alternative",
  ),
  "UPDATE+RESOLVED risk should be Valid alternative",
);
assert.equal(altScore.hardBandLabel, "Strong");

// Wrong target still fails
const wrongTarget: CaptureResult = {
  ...hardResult,
  proposedOperations: (hardResult.proposedOperations ?? []).map((op) =>
    op.entityType === "todo"
      ? { ...op, targetId: "golden-todo-window", targetTitle: "Confirm release window" }
      : op,
  ),
};
const wrongScore = scoreGoldenResult(hard, wrongTarget, {
  captureText: hard.defaultCapture,
});
assert.ok(wrongScore.matched < 3);

// Duplicate Knowledge creation still fails (prohibited)
const dupKnowledge: CaptureResult = {
  ...hardResult,
  proposedOperations: [
    ...(hardResult.proposedOperations ?? []),
    baseOp({
      id: "op-dup-know",
      sourceFindingId: "f-dup",
      operation: "CREATE",
      entityType: "knowledge",
      targetTitle: "Release planned for 19 August",
      proposedValues: { text: "Release planned for 19 August" },
    }),
  ],
};
const dupScore = scoreGoldenResult(hard, dupKnowledge, {
  captureText: hard.defaultCapture,
});
assert.ok((dupScore.prohibitedTriggered ?? 0) >= 1);

// Invented monitoring Risk still fails
const monitorRisk: CaptureResult = {
  ...hardResult,
  proposedOperations: [
    ...(hardResult.proposedOperations ?? []),
    baseOp({
      id: "op-monitor",
      sourceFindingId: "f-mon",
      operation: "CREATE",
      entityType: "risk",
      targetTitle: "Monitor CDN after fix",
    }),
  ],
};
const monitorScore = scoreGoldenResult(hard, monitorRisk, {
  captureText: hard.defaultCapture,
});
assert.ok((monitorScore.prohibitedTriggered ?? 0) >= 1);
assert.equal(monitorScore.hardBandLabel, "Failed");

// Reliability independent from expected-operation matching
const reliabilityClean = assessGoldenReliability(hardResult, hard.defaultCapture);
assert.equal(reliabilityClean.state, "normal");
const mismatchedLabels: CaptureResult = {
  ...hardResult,
  // Force a regression miss without dirtying reliability signals
  proposedOperations: (hardResult.proposedOperations ?? []).filter(
    (o) => o.entityType !== "milestone",
  ),
};
const missScore = scoreGoldenResult(hard, mismatchedLabels, {
  captureText: hard.defaultCapture,
});
assert.ok(missScore.matched < 3);
assert.equal(missScore.reliability?.state, "normal");
assert.notEqual(missScore.gradeLabel, "Unreliable");

assert.equal(
  hardRegressionBand({
    matched: 3,
    total: 3,
    prohibitedTriggered: 0,
    unexpectedCount: 0,
  }).label,
  "Strong",
);

assert.ok(
  expectedChangesMatch(
    { status: ["COMPLETED", "RESOLVED"] },
    { status: "RESOLVED" },
  ),
);
assert.equal(
  expectedChangesMatch({ status: ["COMPLETED"] }, { status: "OPEN" }),
  false,
);

// extractAtomicFacts unit checks
const atomic = extractAtomicFacts(hardResult, hard.defaultCapture);
assert.equal(atomic.some((f) => /milk/i.test(f)), false);
assert.ok(atomic.some((f) => /sarah remains/i.test(f)));

// Hard gate: no silent drops when findings exist for expected outcomes
assert.equal(
  hardScore.coverage?.silentDrops ??
    hardScore.outcomes.filter((o) => o.status === "missing").length,
  0,
  "hard scenario must have 0 silent drops",
);

// --- Mixed 3/3/3 coverage gate ---
const mixed = MIXED_OPERATIONS_SCENARIO;
assert.equal(mixed.scoringMode, "mixed");
assert.equal(mixed.expected.length, 9);
assert.ok(listGoldenScenarios().some((s) => s.id === "mixed-operations"));

const mixedFixture = fixtureToMissionState(mixed);
const mixedState: MissionState = { ...mixedFixture, memories: [] };
const mixedContext = buildCaptureContext({
  projectId: mixed.project.id,
  captureText: mixed.defaultCapture,
  state: mixedState,
});
const mixedResult = localCaptureFallback(
  {
    content: mixed.defaultCapture,
    projectId: mixed.project.id,
    sourceType: "note",
  },
  mixedState,
  mixedContext,
);
const mixedScore = scoreGoldenResult(mixed, mixedResult, {
  captureText: mixed.defaultCapture,
});

assert.ok(mixedScore.coverage, "mixed score should include coverage summary");
assert.equal(
  mixedScore.coverage!.silentDrops,
  0,
  `mixed silent drops must be 0; outcomes=${mixedScore.outcomes.map((o) => `${o.status}:${o.label}`).join(" | ")}`,
);
assert.equal(
  mixedScore.coverage!.accountedFor,
  9,
  `mixed must account for 9/9; got ${mixedScore.coverage!.accountedFor}; outcomes=${mixedScore.outcomes.map((o) => `${o.status}:${o.label}`).join(" | ")}`,
);
assert.equal(mixedScore.prohibitedTriggered, 0);
assert.equal(mixedScore.invalidTargetCount, 0);
assert.equal(mixedScore.coverage!.createsAccounted, 3);
assert.equal(mixedScore.coverage!.updatesAccounted, 3);
assert.equal(mixedScore.coverage!.completionsAccounted, 3);
assert.equal(mixedResult.findingCoverage?.silentDropCount ?? 0, 0);

const mixedOpsText = JSON.stringify(mixedResult.proposedOperations ?? []).toLowerCase();
assert.equal(mixedOpsText.includes("timesheet"), false);
assert.equal(mixedOpsText.includes("onetrust"), false);

console.log("verify-golden-test: all checks passed");
for (const [i, score] of runs.entries()) {
  console.log(
    `  standard local run ${i + 1}: ${score.gradeEmoji} ${score.gradeLabel} (${score.matched}/${score.total})`,
  );
}
console.log(
  `  hard local run: ${hardScore.hardBandLabel} (${hardScore.matched}/${hardScore.total}) reliability=${hardScore.reliability?.label} silentDrops=${hardScore.coverage?.silentDrops ?? 0}`,
);
console.log(`  hard explanation: ${hardScore.hardExplanation}`);
console.log(`  hard facts: ${hardPresented.facts.join(" | ")}`);
console.log(
  `  hard outcomes: ${hardScore.outcomes.map((o) => `${o.statusLabel}:${o.label}`).join(" · ")}`,
);
console.log(
  `  mixed coverage: ${mixedScore.coverage!.accountedFor}/${mixedScore.coverage!.expectedActionable} correct=${mixedScore.coverage!.correct} needsReview=${mixedScore.coverage!.needsReview} unmatched=${mixedScore.coverage!.unmatched} silentDrops=${mixedScore.coverage!.silentDrops}`,
);
console.log(
  `  mixed outcomes: ${mixedScore.outcomes.map((o) => `${o.statusLabel}:${o.label}`).join(" · ")}`,
);
