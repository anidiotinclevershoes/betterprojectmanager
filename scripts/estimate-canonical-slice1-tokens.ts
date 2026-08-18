/**
 * Offline estimate: canonical vs legacy Tell Me input footprint (45 cases).
 */
import { estimateTokens } from "../src/lib/evals/token-breakdown";
import {
  TELL_ME_SYSTEM,
  TELL_ME_SYSTEM_CANONICAL,
} from "../src/lib/tell-me/answer";
import { buildTellMeContext } from "../src/lib/tell-me/context";
import { buildMissionStateForStage } from "../src/lib/evals/build-state";
import { getOfficialBenchmark } from "../src/lib/evals/fixtures";
import { estimateBaselineTokenBreakdown } from "../src/lib/evals/token-breakdown";
import { BASELINE_SYSTEM_PROMPT } from "../src/lib/evals/baseline";

const suite = getOfficialBenchmark();
let canon = 0;
let legacy = 0;
let gpt = 0;
let n = 0;
const sysC = estimateTokens(TELL_ME_SYSTEM_CANONICAL);
const sysL = estimateTokens(TELL_ME_SYSTEM);

for (const w of suite.worlds) {
  for (const c of w.cases) {
    const { state, projectId, contextDocument } = buildMissionStateForStage(
      w,
      c.stageId,
    );
    const canonCtx = buildTellMeContext({
      state,
      question: c.question,
      selectedProjectId: projectId,
      useCanonicalTruth: true,
    });
    const legacyCtx = buildTellMeContext({
      state,
      question: c.question,
      selectedProjectId: projectId,
      useCanonicalTruth: false,
    });
    canon += sysC + estimateTokens(canonCtx.promptBlock);
    legacy += sysL + estimateTokens(legacyCtx.promptBlock);
    const bb = estimateBaselineTokenBreakdown({
      systemPrompt: BASELINE_SYSTEM_PROMPT,
      contextDocument,
      question: c.question,
    });
    gpt += bb.estimatedInputTotal;
    n += 1;
  }
}

console.log(
  JSON.stringify(
    {
      cases: n,
      canonicalLumeEstInput: canon,
      legacyLumeEstInput: legacy,
      gptEstInput: gpt,
      canonicalVsLegacy: +(canon / legacy).toFixed(3),
      canonicalVsGpt: +(canon / gpt).toFixed(3),
      legacyVsGpt: +(legacy / gpt).toFixed(3),
      systemTokens: { canonical: sysC, legacy: sysL },
      note: "Input estimates only; live API totals include output. Compare live run Canonical Truth Slice 1 vs MODEL TIDY PR37 (49157/21470).",
    },
    null,
    2,
  ),
);
