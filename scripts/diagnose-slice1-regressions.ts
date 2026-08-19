/**
 * Offline diagnostic dump for Slice 1 regressions (no OpenAI).
 */
import { buildMissionStateForStage } from "../src/lib/evals/build-state";
import { getCase, getOfficialBenchmark } from "../src/lib/evals/fixtures";
import { serializeCanonicalTruth } from "../src/lib/canonical-truth/serialize";
import { buildTellMeContext } from "../src/lib/tell-me/context";
import { estimateTokens } from "../src/lib/evals/token-breakdown";
import { TELL_ME_SYSTEM_CANONICAL } from "../src/lib/tell-me/answer";

const ids = [
  "v1-harbor-q1-vendor-contact",
  "v1-quiet-q1-pm",
  "v1-cascade-q7-hr-owner",
  "v1-cascade-q6-tech-risk",
  "v1-quiet-q8-budget",
  "v1-quiet-q7-discovery-end",
  "v1-quiet-q9-will-we-hit",
  "v1-meridian-q6-what-blocks-cab",
  "v1-meridian-q9-ops-slack",
  "v1-northline-q5-tom-freeze",
];

const suite = getOfficialBenchmark();
for (const id of ids) {
  const f = getCase(id)!;
  const world = suite.worlds.find((w) => w.id === f.worldId)!;
  const { state, projectId, contextDocument } = buildMissionStateForStage(
    world,
    f.stageId,
  );
  const k = state.knowledge.find((x) => x.projectId === projectId)!;
  const canon = serializeCanonicalTruth({
    state,
    projectId,
    question: f.question,
  });
  const legacy = buildTellMeContext({
    state,
    question: f.question,
    selectedProjectId: projectId,
    useCanonicalTruth: false,
  });
  console.log(`\n=== ${id} ===`);
  console.log("now:", k.sections.now);
  console.log("people:", k.sections.people);
  console.log("decisions:", k.sections.decisions.slice(0, 6));
  console.log("risks:", k.sections.risks);
  console.log("openLoops:", k.sections.openLoops);
  console.log(
    "needsConfirmation:",
    canon.needsConfirmationHints.map((h) => h.summary),
  );
  console.log("baselineDoc has Elena?", /Elena/i.test(contextDocument));
  console.log("baselineDoc has Alex Rivera?", /Alex Rivera/i.test(contextDocument));
  console.log("baselineDoc has jointly own HR?", /jointly own HR/i.test(contextDocument));
  console.log("baselineDoc has identity platform?", /identity platform/i.test(contextDocument));
  console.log("baselineDoc has Budget.*TBC|TBC after discovery?", /TBC after discovery|budget TBC/i.test(contextDocument));
  console.log("baselineDoc has end August?", /end August|mid-September/i.test(contextDocument));
  console.log("canon Elena?", /Elena/i.test(canon.promptBlock));
  console.log("canon Alex?", /Alex/i.test(canon.promptBlock));
  console.log("canon Helen|Omar?", /Helen|Omar/i.test(canon.promptBlock));
  console.log("canon 10 Oct|identity|scope cut?", /10 Oct|identity|scope cut/i.test(canon.promptBlock));
  console.log("canon budget|TBC?", /budget|TBC/i.test(canon.promptBlock));
  console.log("canon August|mid-September?", /August|mid-September/i.test(canon.promptBlock));
  console.log("canon Tom owns UX?", /Tom owns UX/i.test(canon.promptBlock));
  console.log("canon Tom does not?", /Tom does not own/i.test(canon.promptBlock));
  console.log("legacy prompt Elena?", /Elena/i.test(legacy.promptBlock));
  console.log("legacy prompt identity?", /identity platform/i.test(legacy.promptBlock));
  console.log(
    "tokens canon prompt",
    estimateTokens(TELL_ME_SYSTEM_CANONICAL) + estimateTokens(canon.promptBlock),
    "legacy prompt",
    estimateTokens(legacy.promptBlock),
  );
}
