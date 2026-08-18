/**
 * Phase 2C.1 — Trust intelligence targeted checks (no live OpenAI).
 * Locks context/prompt behaviour for ownership restraint, supersession,
 * and informal≠official without changing the evaluator.
 */
import assert from "node:assert/strict";
import { buildMissionStateForStage } from "../src/lib/evals/build-state";
import { getOfficialBenchmark, getCase } from "../src/lib/evals/fixtures";
import { buildTellMeContext } from "../src/lib/tell-me/context";
import {
  ownershipTopicTokens,
  questionLooksCurrentState,
  questionLooksOwnership,
  recordMentionsOwnershipOfTopic,
} from "../src/lib/tell-me/question-shape";
import { answerTellMeQuestion } from "../src/lib/tell-me/answer";
import fs from "node:fs";
import path from "node:path";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed += 1;
      console.log(`✓ ${name}`);
    } catch (err) {
      console.error(`✗ ${name}`);
      throw err;
    }
  })();
}

async function main() {
  await check("system prompt encodes three trust rules", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/tell-me/answer.ts"),
      "utf8",
    );
    assert.match(src, /Ownership: only state an owner/);
    assert.match(src, /Current vs history/);
    assert.match(src, /Epistemic status: informal/);
  });

  await check("ownership topic matching distinguishes UX vs security", () => {
    const securityQ = "Who owns security sign-off on Northline?";
    const topic = ownershipTopicTokens(securityQ);
    assert.ok(topic.includes("security"));
    assert.equal(
      recordMentionsOwnershipOfTopic(
        "Ava Chen owns UX design sign-off",
        topic,
      ),
      false,
    );
    assert.equal(
      recordMentionsOwnershipOfTopic(
        "David Okonkwo owns security review",
        topic,
      ),
      true,
    );
    assert.equal(questionLooksOwnership(securityQ), true);
  });

  await check("Meridian pre-CAB: current knowledge has one Snyk, not two in risks", () => {
    const world = getOfficialBenchmark().worlds.find(
      (w) => w.id === "world-v1-meridian-payments",
    )!;
    const { state, projectId } = buildMissionStateForStage(
      world,
      "mer-stage-pre-cab",
    );
    const k = state.knowledge[0]!;
    assert.match(k.sections.now.join(" | "), /One Snyk critical still open/i);
    const risksBlob = k.sections.risks.join(" | ");
    assert.doesNotMatch(risksBlob, /Two Snyk criticals remain open/i);
    assert.doesNotMatch(risksBlob, /two reported/i);

    const bundle = buildTellMeContext({
      state,
      question: "Are Snyk critical findings cleared for CAB?",
      selectedProjectId: projectId,
    });
    assert.match(bundle.promptBlock, /Current position:/i);
    assert.match(bundle.promptBlock, /One Snyk critical still open/i);
    // Superseded full narrative must not reappear as current Knowledge/Risks
    const withoutHistory = bundle.promptBlock.split(/\nHistory:/i)[0] ?? bundle.promptBlock;
    assert.doesNotMatch(
      withoutHistory,
      /Two Snyk criticals remain open on the payments service/i,
    );
    // Current-state asks should not resurface superseded Snyk count via History either
    assert.doesNotMatch(
      bundle.promptBlock,
      /Two Snyk criticals remain open on the payments service/i,
    );
    assert.equal(questionLooksCurrentState("Are Snyk critical findings cleared for CAB?"), true);
  });

  await check("Meridian historical question still retains history channel", () => {
    const world = getOfficialBenchmark().worlds.find(
      (w) => w.id === "world-v1-meridian-payments",
    )!;
    const { state, projectId } = buildMissionStateForStage(
      world,
      "mer-stage-pre-cab",
    );
    const hist = buildTellMeContext({
      state,
      question: "Was Meridian originally planned for 19 August?",
      selectedProjectId: projectId,
    });
    assert.match(hist.promptBlock, /History:/i);
    // History may still mention earlier Snyk state in truncated detail — OK for historical channel
    assert.ok(hist.contexts[0]!.history.length >= 1);
  });

  await check("Northline security owner: local path does not invent Ava", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const world = getOfficialBenchmark().worlds.find(
        (w) => w.id === "world-v1-northline-crm",
      )!;
      const { state, projectId } = buildMissionStateForStage(
        world,
        "nl-stage-latest",
      );
      const people = state.knowledge[0]!.sections.people.join(" | ");
      // Explicit UX ownership may be present; must not be collapsed to bare Ava
      if (/Ava/i.test(people)) {
        assert.match(people, /owns UX|UX design|away|research/i);
      }
      const answer = await answerTellMeQuestion({
        question: "Who owns security sign-off on Northline?",
        state,
        selectedProjectId: projectId,
      });
      assert.equal(answer.provider, "local");
      assert.doesNotMatch(answer.answer, /Ava Chen owns the security/i);
      assert.doesNotMatch(answer.answer, /Ava owns security/i);
      assert.match(
        answer.answer,
        /don't have a confirmed owner|can't find|not recorded|no confirmed/i,
      );
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  await check("Northline UX owner still found when explicitly recorded", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const world = getOfficialBenchmark().worlds.find(
        (w) => w.id === "world-v1-northline-crm",
      )!;
      const { state, projectId } = buildMissionStateForStage(
        world,
        "nl-stage-kickoff",
      );
      const answer = await answerTellMeQuestion({
        question: "Who owns UX design sign-off?",
        state,
        selectedProjectId: projectId,
      });
      assert.match(answer.answer, /Ava/i);
      assert.doesNotMatch(answer.answer, /don't have a confirmed owner/i);
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  await check("Harbor rate-limit context keeps informal wording in Current position", () => {
    const world = getOfficialBenchmark().worlds.find(
      (w) => w.id === "world-v1-harbor-datahub",
    )!;
    const { state, projectId } = buildMissionStateForStage(
      world,
      "hb-stage-legal",
    );
    const bundle = buildTellMeContext({
      state,
      question: "What is the official API rate limit?",
      selectedProjectId: projectId,
    });
    assert.match(bundle.promptBlock, /100 rps unofficial|informal/i);
    assert.match(bundle.promptBlock, /Current position:/i);
  });

  await check("current-state context uses fewer history slots than default-ish historical", () => {
    const world = getOfficialBenchmark().worlds.find(
      (w) => w.id === "world-v1-meridian-payments",
    )!;
    const { state, projectId } = buildMissionStateForStage(
      world,
      "mer-stage-pre-cab",
    );
    const current = buildTellMeContext({
      state,
      question: "Are Snyk critical findings cleared for CAB?",
      selectedProjectId: projectId,
    });
    const historical = buildTellMeContext({
      state,
      question: "Was Meridian originally planned for 19 August?",
      selectedProjectId: projectId,
    });
    assert.ok(
      current.contexts[0]!.history.length <= historical.contexts[0]!.history.length,
      `current history ${current.contexts[0]!.history.length} vs historical ${historical.contexts[0]!.history.length}`,
    );
  });

  // Touch getCase so fixture imports stay warm / unused-import safe
  assert.ok(getCase("v1-meridian-q7-snyk-status"));

  console.log(`\n${passed} trust-intelligence checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
