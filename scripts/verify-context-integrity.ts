/**
 * Phase 2C.2 — Context integrity + ownership attempt 2 (deterministic).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildMissionStateForStage } from "../src/lib/evals/build-state";
import { getOfficialBenchmark, getCase } from "../src/lib/evals/fixtures";
import {
  buildTellMeContext,
  filterKnowledgeForOwnershipQuestion,
} from "../src/lib/tell-me/context";
import {
  ownershipTopicTokens,
  recordMentionsOwnershipOfTopic,
  isAdjacentOwnershipStatement,
} from "../src/lib/tell-me/ownership";
import { answerTellMeQuestion, TELL_ME_CONVERSATION_AUTHORITY_MARKER } from "../src/lib/tell-me/answer";
import {
  truncatePreservingMeaning,
  truncationWouldDropQualifier,
} from "../src/lib/text/semantic-truncate";

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
  await check("semantic truncate preserves mocks unit-test-only qualification", () => {
    const src =
      "Elena's written confirmation due 20 August has not arrived. Chris asked whether we can start coding against a mocked API — Maya (architect) said mocks are fine for unit tests only; integration tests require real staging. Someone suggested 8 September integration start might slip to 15 September; no formal replan yet.";
    assert.equal(truncationWouldDropQualifier(src, 160), true);
    const kept = truncatePreservingMeaning(src, 220);
    assert.match(kept, /unit tests only/i);
    assert.match(kept, /real staging/i);
    assert.doesNotMatch(kept, /mocks are fine\s*$/i);
  });

  await check("semantic truncate preserves unconfirmed-cover qualification", () => {
    const src =
      "A later chat says maybe Tom from Design Ops can sign the freeze if Ava is away — that is unconfirmed speculation, not a decision. No record that Tom owns UX sign-off.";
    const hard = src.slice(0, 90);
    assert.match(hard, /Tom from Design Ops can sign/);
    assert.doesNotMatch(hard, /unconfirmed/);
    const kept = truncatePreservingMeaning(src, 160);
    assert.match(kept, /unconfirmed speculation/i);
  });

  await check("Harbor mocks prompt retains unit-tests-only after 2C.2 context build", () => {
    const f = getCase("v1-harbor-q7-mock-api")!;
    const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
    const { state, projectId } = buildMissionStateForStage(world, f.stageId);
    const decisions = state.knowledge[0]!.sections.decisions.join(" | ");
    assert.match(decisions, /unit tests only|real staging/i);

    const bundle = buildTellMeContext({
      state,
      question: f.question,
      selectedProjectId: projectId,
    });
    assert.match(bundle.promptBlock, /unit tests only/i);
    assert.match(bundle.promptBlock, /real staging/i);
    assert.doesNotMatch(
      bundle.promptBlock,
      /Maya \(architect\) said mocks are fine\s*(?:\n|$)/i,
    );
  });

  await check("ownership: UX record does not match Security topic", () => {
    const topic = ownershipTopicTokens(
      "Who owns security sign-off on Northline?",
    );
    assert.ok(topic.includes("security"));
    assert.equal(
      recordMentionsOwnershipOfTopic(
        "Ava Chen owns UX design sign-off",
        topic,
      ),
      false,
    );
    assert.equal(
      isAdjacentOwnershipStatement(
        "Ava Chen owns UX design sign-off",
        topic,
      ),
      true,
    );
    assert.equal(
      recordMentionsOwnershipOfTopic(
        "David Okonkwo owns security review",
        topic,
      ),
      true,
    );
  });

  await check("ownership filter drops Ava UX from security question context", () => {
    const f = getCase("v1-northline-q9-security-owner")!;
    const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
    const { state, projectId } = buildMissionStateForStage(world, f.stageId);
    const bundle = buildTellMeContext({
      state,
      question: f.question,
      selectedProjectId: projectId,
    });
    assert.doesNotMatch(
      bundle.promptBlock,
      /Ava Chen owns UX|Ava owns UX/i,
    );
    // Denial for security may remain if present in earlier stage truths via people extract
    const filtered = filterKnowledgeForOwnershipQuestion(
      bundle.contexts[0]!.knowledge,
      f.question,
    );
    for (const row of filtered) {
      const text = `${row.title} ${row.summary ?? ""}`;
      assert.equal(
        isAdjacentOwnershipStatement(
          text,
          ownershipTopicTokens(f.question),
        ),
        false,
        `adjacent ownership leaked: ${text}`,
      );
    }
  });

  await check("ownership: local path does not invent Ava for security", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const f = getCase("v1-northline-q9-security-owner")!;
      const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
      const { state, projectId } = buildMissionStateForStage(world, f.stageId);
      const answer = await answerTellMeQuestion({
        question: f.question,
        state,
        selectedProjectId: projectId,
      });
      assert.doesNotMatch(answer.answer, /Ava.*security|security.*Ava|includes security/i);
      assert.match(
        answer.answer,
        /don't have a confirmed owner|can't find|not recorded|no confirmed/i,
      );
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  await check("ownership: explicit UX owner still resolves", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const f = getCase("v1-northline-q1-ux-owner")!;
      const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
      const { state, projectId } = buildMissionStateForStage(world, f.stageId);
      const answer = await answerTellMeQuestion({
        question: f.question,
        state,
        selectedProjectId: projectId,
      });
      assert.match(answer.answer, /Ava/i);
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  await check("Meridian Snyk current still one-open in Current position", () => {
    const f = getCase("v1-meridian-q7-snyk-status")!;
    const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
    const { state, projectId } = buildMissionStateForStage(world, f.stageId);
    const now = state.knowledge[0]!.sections.now.join(" | ");
    assert.match(now, /One Snyk critical still open/i);
    const decisions = state.knowledge[0]!.sections.decisions.join(" | ");
    assert.doesNotMatch(decisions, /two reported/i);
    const bundle = buildTellMeContext({
      state,
      question: f.question,
      selectedProjectId: projectId,
    });
    assert.match(bundle.promptBlock, /One Snyk critical still open/i);
  });

  await check("conversation authority rule present in Tell Me system prompt", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/tell-me/answer.ts"),
      "utf8",
    );
    assert.ok(src.includes(TELL_ME_CONVERSATION_AUTHORITY_MARKER));
    assert.match(src, /Previous assistant answers may be wrong/i);
  });

  await check("Tell Me session clears conversation on project change (source)", () => {
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/components/tell-me/TellMeSessionContext.tsx",
      ),
      "utf8",
    );
    assert.match(src, /Project isolation/);
    assert.match(src, /conversationProjectRef/);
    assert.match(src, /setConversation\(\[\]\)/);
  });

  console.log(`\n${passed} context-integrity checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
