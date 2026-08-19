/**
 * Model tidy verification — same-model control + token breakdown helpers.
 */
import assert from "node:assert/strict";
import {
  LEGACY_OPENAI_CHAT_ALIAS,
  PINNED_OPENAI_CHAT_MODEL,
  modelsAlignedForComparison,
  resolveOpenAIChatModel,
} from "../src/lib/openai-model";
import {
  estimateBaselineTokenBreakdown,
  estimateLumeTokenBreakdown,
  estimateTokens,
} from "../src/lib/evals/token-breakdown";
import { BASELINE_SYSTEM_PROMPT } from "../src/lib/evals/baseline";
import { TELL_ME_SYSTEM } from "../src/lib/tell-me/answer";
import { buildMissionStateForStage } from "../src/lib/evals/build-state";
import { getCase, getOfficialBenchmark } from "../src/lib/evals/fixtures";
import { buildTellMeContext } from "../src/lib/tell-me/context";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

check("default resolves to pinned snapshot, not floating alias", () => {
  const prev = process.env.OPENAI_MODEL;
  const prevEval = process.env.OPENAI_EVAL_MODEL;
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENAI_EVAL_MODEL;
  try {
    assert.equal(resolveOpenAIChatModel(), PINNED_OPENAI_CHAT_MODEL);
    assert.notEqual(resolveOpenAIChatModel(), LEGACY_OPENAI_CHAT_ALIAS);
  } finally {
    if (prev !== undefined) process.env.OPENAI_MODEL = prev;
    else delete process.env.OPENAI_MODEL;
    if (prevEval !== undefined) process.env.OPENAI_EVAL_MODEL = prevEval;
    else delete process.env.OPENAI_EVAL_MODEL;
  }
});

check("floating alias OPENAI_MODEL=gpt-4o-mini pins to snapshot", () => {
  const prev = process.env.OPENAI_MODEL;
  process.env.OPENAI_MODEL = LEGACY_OPENAI_CHAT_ALIAS;
  try {
    assert.equal(resolveOpenAIChatModel(), PINNED_OPENAI_CHAT_MODEL);
  } finally {
    if (prev !== undefined) process.env.OPENAI_MODEL = prev;
    else delete process.env.OPENAI_MODEL;
  }
});

check("modelsAlignedForComparison treats alias and snapshot as aligned", () => {
  assert.equal(
    modelsAlignedForComparison(
      LEGACY_OPENAI_CHAT_ALIAS,
      PINNED_OPENAI_CHAT_MODEL,
    ),
    true,
  );
  assert.equal(
    modelsAlignedForComparison(
      PINNED_OPENAI_CHAT_MODEL,
      PINNED_OPENAI_CHAT_MODEL,
    ),
    true,
  );
});

check("Lume and baseline resolvers agree for eval", () => {
  const prev = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENAI_EVAL_MODEL;
  try {
    assert.equal(
      resolveOpenAIChatModel({ forEval: true }),
      resolveOpenAIChatModel({ forEval: false }),
    );
  } finally {
    if (prev !== undefined) process.env.OPENAI_MODEL = prev;
  }
});

check("token breakdown estimates Lume buckets", () => {
  const f = getCase("v1-harbor-q7-mock-api")!;
  const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
  const { state, projectId } = buildMissionStateForStage(world, f.stageId);
  const bundle = buildTellMeContext({
    state,
    question: f.question,
    selectedProjectId: projectId,
  });
  const bd = estimateLumeTokenBreakdown({
    systemPrompt: TELL_ME_SYSTEM,
    promptBlock: bundle.promptBlock,
  });
  assert.ok(bd.systemInstructions > 50);
  assert.ok(bd.knowledgeNow > 0 || bd.history > 0);
  assert.ok(bd.estimatedInputTotal > bd.systemInstructions);
  assert.ok(estimateTokens(TELL_ME_SYSTEM) === bd.systemInstructions);
});

check("token breakdown estimates baseline document", () => {
  const f = getCase("v1-harbor-q7-mock-api")!;
  const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
  const { contextDocument } = buildMissionStateForStage(world, f.stageId);
  const bd = estimateBaselineTokenBreakdown({
    systemPrompt: BASELINE_SYSTEM_PROMPT,
    contextDocument,
    question: f.question,
  });
  assert.ok(bd.contextDocument > bd.systemInstructions);
  assert.ok(bd.estimatedInputTotal > bd.contextDocument);
});

check("Tell Me system is larger than baseline system (cost signal)", () => {
  assert.ok(
    estimateTokens(TELL_ME_SYSTEM) > estimateTokens(BASELINE_SYSTEM_PROMPT),
  );
});

console.log(`\n${passed} model-tidy checks passed`);
console.log(
  JSON.stringify(
    {
      pinnedDefault: PINNED_OPENAI_CHAT_MODEL,
      legacyAlias: LEGACY_OPENAI_CHAT_ALIAS,
      resolvedNow: resolveOpenAIChatModel({ forEval: true }),
    },
    null,
    2,
  ),
);
