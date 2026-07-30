/**
 * Golden Test — scoring / presentation unit checks (no network).
 * Run: npx tsx scripts/verify-golden-test.ts
 */
import assert from "node:assert/strict";
import {
  WEBSITE_REFRESH_SCENARIO,
  fixtureToMissionState,
  presentGoldenResult,
  scoreGoldenResult,
} from "../src/lib/dev/golden";
import type { CaptureResult } from "../src/lib/types";

const scenario = WEBSITE_REFRESH_SCENARIO;
const state = fixtureToMissionState(scenario);

assert.equal(state.projects[0]?.name, "Website Refresh");
assert.ok(state.todos.some((t) => t.title === "Obtain CAB approval"));
assert.ok(
  state.knowledge[0]?.sections.risks.includes("CDN deployment delayed"),
);

const strongResult: CaptureResult = {
  memory: {
    id: "mem-1",
    type: "conversation",
    projectId: scenario.project.id,
    title: "CAB approved and release moved",
    content:
      "CAB approval received. Release moved to 19 August. CDN issue resolved.",
    tags: [],
    people: ["Sarah"],
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    source: "capture",
  },
  insights: [
    "CAB approval received",
    "Release moved to 19 August",
    "CDN issue resolved",
  ],
  assumptions: [],
  recommendations: [
    {
      id: "r1",
      kind: "decision",
      urgency: "now",
      title: "Complete Obtain CAB approval",
      action: "Mark Obtain CAB approval complete",
      why: "Approval received",
      leadershipImpact: "Close the loop",
      projectId: scenario.project.id,
      createdAt: new Date().toISOString(),
      status: "active",
      operation: "complete",
      itemType: "action",
      targetTitle: "Obtain CAB approval",
    },
    {
      id: "r2",
      kind: "release",
      urgency: "today",
      title: "Update release date to 19 August",
      action: "Change Release planned for 12 August to 19 August",
      why: "Sarah agreed",
      leadershipImpact: "Keep timeline honest",
      projectId: scenario.project.id,
      createdAt: new Date().toISOString(),
      status: "active",
      operation: "update",
      itemType: "knowledge",
      targetTitle: "Release planned for 12 August",
    },
    {
      id: "r3",
      kind: "risk",
      urgency: "today",
      title: "Close CDN deployment delayed",
      action: "Mark CDN risk complete — issue resolved",
      why: "CDN resolved",
      leadershipImpact: "Reduce noise",
      projectId: scenario.project.id,
      createdAt: new Date().toISOString(),
      status: "active",
      operation: "complete",
      itemType: "risk",
      targetTitle: "CDN deployment delayed",
    },
  ],
  knowledgePatch: {
    now: ["Release planned for 19 August"],
    risks: [],
  },
  knowledgeProjectId: scenario.project.id,
  provider: "openai",
  tidied: true,
};

const score = scoreGoldenResult(scenario, strongResult);
assert.equal(score.total, 3);
assert.ok(score.matched >= 2, `expected >=2 matched, got ${score.matched}`);
assert.ok(["excellent", "good"].includes(score.grade));

const presented = presentGoldenResult(
  scenario,
  strongResult,
  scenario.defaultCapture,
);
assert.ok(presented.summary.length > 10);
assert.ok(presented.facts.length >= 3);
assert.ok(presented.reasoning.length >= 1);
assert.ok(presented.proposed.length >= 3);
assert.equal(presented.proposed.some((p) => p.operation === "complete"), true);

const emptyScore = scoreGoldenResult(scenario, {
  ...strongResult,
  recommendations: [],
  knowledgePatch: {},
  timelinePatch: [],
});
assert.ok(emptyScore.outcomes.some((o) => o.status === "missing"));

console.log("verify-golden-test: all checks passed");
console.log(
  `  strong score: ${score.gradeLabel} (${score.matched}/${score.total})`,
);
