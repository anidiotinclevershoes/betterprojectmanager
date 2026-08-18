/**
 * Offline suite token footprint (no OpenAI calls).
 */
import {
  estimateBaselineTokenBreakdown,
  estimateLumeTokenBreakdown,
} from "../src/lib/evals/token-breakdown";
import { BASELINE_SYSTEM_PROMPT } from "../src/lib/evals/baseline";
import { TELL_ME_SYSTEM } from "../src/lib/tell-me/answer";
import { buildMissionStateForStage } from "../src/lib/evals/build-state";
import { getOfficialBenchmark } from "../src/lib/evals/fixtures";
import { buildTellMeContext } from "../src/lib/tell-me/context";
import {
  PINNED_OPENAI_CHAT_MODEL,
  resolveOpenAIChatModel,
} from "../src/lib/openai-model";

const suite = getOfficialBenchmark();
const cases = suite.worlds.flatMap((w) => w.cases);
const lumeAcc: Record<string, number> = {};
const baseAcc: Record<string, number> = {};
let n = 0;
for (const c of cases) {
  const world = suite.worlds.find((w) => w.id === c.worldId)!;
  const { state, projectId, contextDocument } = buildMissionStateForStage(
    world,
    c.stageId,
  );
  const bundle = buildTellMeContext({
    state,
    question: c.question,
    selectedProjectId: projectId,
  });
  const lb = estimateLumeTokenBreakdown({
    systemPrompt: TELL_ME_SYSTEM,
    promptBlock: bundle.promptBlock,
  });
  const bb = estimateBaselineTokenBreakdown({
    systemPrompt: BASELINE_SYSTEM_PROMPT,
    contextDocument,
    question: c.question,
  });
  for (const [k, v] of Object.entries(lb)) {
    if (typeof v === "number") lumeAcc[k] = (lumeAcc[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(bb)) {
    if (typeof v === "number") baseAcc[k] = (baseAcc[k] ?? 0) + v;
  }
  n += 1;
}
const top = Object.entries(lumeAcc)
  .filter(([k]) => !k.startsWith("api") && k !== "estimatedInputTotal")
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12);
console.log(
  JSON.stringify(
    {
      model: resolveOpenAIChatModel({ forEval: true }),
      pinned: PINNED_OPENAI_CHAT_MODEL,
      cases: n,
      lumeEstInput: lumeAcc.estimatedInputTotal,
      gptEstInput: baseAcc.estimatedInputTotal,
      ratio: +(lumeAcc.estimatedInputTotal / baseAcc.estimatedInputTotal).toFixed(
        3,
      ),
      lumeTop: top,
      gpt: {
        system: baseAcc.systemInstructions,
        context: baseAcc.contextDocument,
        question: baseAcc.question,
      },
      perQuestionApprox: {
        lume: Math.round(lumeAcc.estimatedInputTotal / n),
        gpt: Math.round(baseAcc.estimatedInputTotal / n),
      },
    },
    null,
    2,
  ),
);
