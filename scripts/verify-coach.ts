/**
 * Smoke verification for the coaching engine.
 * Run: npx tsx scripts/verify-coach.ts
 */
import assert from "node:assert/strict";
import {
  analyseCapture,
  answerMemoryQuestion,
  generateProactiveRecommendations,
  searchMemory,
} from "../src/lib/coach";
import {
  COACHING_SYSTEM_PROMPT,
  DAILY_PRINCIPLE,
  NORTH_STAR_QUESTION,
} from "../src/lib/mission";
import { createSeedState } from "../src/lib/seed";

const state = createSeedState();

assert.ok(COACHING_SYSTEM_PROMPT.includes(NORTH_STAR_QUESTION));
assert.ok(COACHING_SYSTEM_PROMPT.includes(DAILY_PRINCIPLE));
assert.match(
  COACHING_SYSTEM_PROMPT,
  /Never ask ["']What task should I create\?["']/i,
);

const delay = answerMemoryQuestion(state, "Why did we delay Release 8?");
assert.match(delay.answer, /Release 8/i);
assert.ok(delay.memories.length > 0);

const finance = answerMemoryQuestion(
  state,
  "What was Finance concerned about?",
);
assert.match(finance.answer.toLowerCase(), /finance|billing|priya/);

const capture = analyseCapture(
  {
    content:
      "Waiting on Elena for the payments build fix. Risk that CAB slips again. We should decide go/no-go criteria today.",
    projectId: "proj-atlas",
    sourceType: "conversation",
  },
  state,
);
assert.ok(capture.recommendations.length >= 2);
assert.ok(
  capture.recommendations.some((r) => r.why.length > 20),
  "recommendations must explain why",
);
assert.ok(
  capture.recommendations.every((r) => r.leadershipImpact.length > 10),
  "recommendations must include leadership impact",
);

const proactive = generateProactiveRecommendations(state);
assert.ok(proactive.length >= 1);

const memories = searchMemory(state, "CAB approve");
assert.ok(memories.some((m) => /CAB/i.test(m.title) || /CAB/i.test(m.content)));

console.log("verify-coach: all checks passed");
console.log(`  memories: ${state.memories.length}`);
console.log(`  seed recommendations: ${state.recommendations.length}`);
console.log(`  capture recommendations: ${capture.recommendations.length}`);
console.log(`  proactive recommendations: ${proactive.length}`);
