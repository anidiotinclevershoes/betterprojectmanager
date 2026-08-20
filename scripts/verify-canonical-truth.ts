/**
 * Slice 1 canonical truth verification.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCanonicalSuggestions,
  CANONICAL_SUGGESTIONS_NO_AI,
  confirmResponsibilityOwner,
  findConfirmedOwner,
  isCanonicalTruthEnabled,
  serializeCanonicalTruth,
} from "../src/lib/canonical-truth";
import { buildTellMeContext } from "../src/lib/tell-me/context";
import { answerTellMeQuestion } from "../src/lib/tell-me/answer";
import { buildMissionStateForStage } from "../src/lib/evals/build-state";
import { getCase, getOfficialBenchmark } from "../src/lib/evals/fixtures";
import { emptyKnowledge } from "../src/lib/knowledge";
import type { MissionState } from "../src/lib/types";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`✓ ${name}`);
    })
    .catch((err) => {
      console.error(`✗ ${name}`);
      throw err;
    });
}

async function main() {
  await check("flag: eval enables canonical by default when env unset", () => {
    const prev = process.env.LUME_CANONICAL_TRUTH;
    delete process.env.LUME_CANONICAL_TRUTH;
    try {
      assert.equal(isCanonicalTruthEnabled({ forEval: true }), true);
      assert.equal(isCanonicalTruthEnabled({}), false);
      assert.equal(isCanonicalTruthEnabled({ explicit: true }), true);
    } finally {
      if (prev !== undefined) process.env.LUME_CANONICAL_TRUTH = prev;
    }
  });

  await check("flag: LUME_CANONICAL_TRUTH=0 forces off even for eval", () => {
    const prev = process.env.LUME_CANONICAL_TRUTH;
    process.env.LUME_CANONICAL_TRUTH = "0";
    try {
      assert.equal(isCanonicalTruthEnabled({ forEval: true }), false);
    } finally {
      if (prev !== undefined) process.env.LUME_CANONICAL_TRUTH = prev;
      else delete process.env.LUME_CANONICAL_TRUTH;
    }
  });

  await check("serialize: current mode excludes superseded", () => {
    const f = getCase("v1-northline-q9-security-owner")!;
    const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
    const { state, projectId } = buildMissionStateForStage(world, f.stageId);
    const knowledge = state.knowledge.find((k) => k.projectId === projectId)!;
    knowledge.structured = [
      {
        id: "old-sec",
        projectId,
        body: "Someone — Security sign-off",
        kind: "responsibility",
        epistemic: "unknown",
        lifecycle: "superseded",
        meta: {
          responsibility: {
            scope: "Security sign-off",
            ownerConfirmed: false,
          },
        },
      },
      {
        id: "cur-focus",
        projectId,
        body: "UX freeze pending",
        kind: "fact",
        epistemic: null,
        lifecycle: "current",
      },
    ];
    const bundle = serializeCanonicalTruth({
      state,
      projectId,
      question: "What is the current focus?",
    });
    assert.ok(!bundle.promptBlock.includes("Someone — Security sign-off"));
    assert.ok(bundle.promptBlock.includes("UX freeze pending"));
    assert.equal(bundle.includedHistoryEvidence, false);
  });

  await check("serialize: ownership question does not invent unknown_owner from absence", () => {
    const f = getCase("v1-northline-q9-security-owner")!;
    const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
    const { state, projectId } = buildMissionStateForStage(world, f.stageId);
    const bundle = serializeCanonicalTruth({
      state,
      projectId,
      question: f.question,
    });
    // D-009: missing match ≠ stored known gap
    assert.equal(
      bundle.needsConfirmationHints.filter((h) => h.kind === "unknown_owner")
        .length,
      0,
      "must not invent owner-not-recorded from topic tokens alone",
    );
  });

  await check("serialize: stored unconfirmed responsibility still surfaces as gap", () => {
    const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const state: MissionState = {
      projects: [
        {
          id: projectId,
          name: "Gap",
          code: "GAP",
          summary: "",
          status: "healthy",
          currentFocus: "",
          stakeholders: [],
        },
      ],
      memories: [],
      recommendations: [],
      meetings: [],
      releases: [],
      todos: [],
      knowledge: [
        {
          projectId,
          updatedAt: new Date().toISOString(),
          sections: {
            now: [],
            decisions: [],
            risks: [],
            people: [],
            openLoops: [],
          },
          structured: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              projectId,
              section: "people",
              body: "Security sign-off — unconfirmed",
              kind: "responsibility",
              epistemic: "unknown",
              lifecycle: "current",
              meta: {
                responsibility: {
                  scope: "Security sign-off",
                  personName: null,
                  personId: null,
                  ownerConfirmed: false,
                },
              },
            },
          ],
        },
      ],
      risks: [],
      timeline: [],
      history: [],
    };
    const bundle = serializeCanonicalTruth({
      state,
      projectId,
      question: "Who owns Security sign-off?",
    });
    assert.ok(
      bundle.needsConfirmationHints.some((h) => h.kind === "unknown_owner"),
      "stored unconfirmed responsibility remains a real gap",
    );
  });

  await check("confirm owner is scoped responsibility, not global owner", () => {
    const f = getCase("v1-northline-q9-security-owner")!;
    const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
    const built = buildMissionStateForStage(world, f.stageId);
    const result = confirmResponsibilityOwner({
      state: built.state,
      projectId: built.projectId,
      scope: "Security sign-off",
      personName: "Maya Okonkwo",
    });
    const hit = findConfirmedOwner(
      result.state.knowledge.find((k) => k.projectId === built.projectId),
      "security",
    );
    assert.ok(hit);
    assert.equal(hit!.personName, "Maya Okonkwo");
    assert.equal(hit!.scope, "Security sign-off");
    assert.match(result.peopleBullet, /Maya Okonkwo/);
    assert.match(result.peopleBullet, /Security sign-off/);
    // Must not invent a project-level "Owner" field
    const project = result.state.projects.find((p) => p.id === built.projectId)!;
    assert.ok(!("owner" in project));
  });

  await check("mutation: confirm then Q&A answers from structured truth", async () => {
    const f = getCase("v1-northline-q9-security-owner")!;
    const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
    const built = buildMissionStateForStage(world, f.stageId);

    const before = await answerTellMeQuestion({
      question: f.question,
      state: built.state,
      selectedProjectId: built.projectId,
      useCanonicalTruth: true,
      debugTokenBreakdown: true,
    });
    assert.ok(
      (before.needsConfirmation?.length ?? 0) > 0 ||
        /not recorded|don't have|cannot find|can't find|no .*owner/i.test(
          before.answer,
        ),
      `expected unknown before confirm, got: ${before.answer}`,
    );

    const confirmed = confirmResponsibilityOwner({
      state: built.state,
      projectId: built.projectId,
      scope: "Security sign-off",
      personName: "Maya Okonkwo",
    });

    const after = await answerTellMeQuestion({
      question: f.question,
      state: confirmed.state,
      selectedProjectId: built.projectId,
      useCanonicalTruth: true,
      debugTokenBreakdown: true,
    });
    assert.match(after.answer, /Maya Okonkwo/i);
    assert.match(after.answer, /Security sign-off/i);
    assert.equal(after.provider, "local");
    assert.equal((after.needsConfirmation ?? []).length, 0);
  });

  await check("suggestions: generated without OpenAI module", () => {
    assert.equal(CANONICAL_SUGGESTIONS_NO_AI, true);
    const src = readFileSync(
      join(process.cwd(), "src/lib/canonical-truth/suggestions.ts"),
      "utf8",
    );
    assert.ok(!/from ["']@\/lib\/openai|api\.openai\.com|getOpenAIKey/i.test(src));
    assert.ok(!/\bfetch\s*\(/i.test(src));

    const f = getCase("v1-northline-q9-security-owner")!;
    const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
    const built = buildMissionStateForStage(world, f.stageId);
    const withResp = confirmResponsibilityOwner({
      state: built.state,
      projectId: built.projectId,
      scope: "CAB pack",
      personName: "Priya Nair",
    });
    const suggestions = buildCanonicalSuggestions({
      state: withResp.state,
      projectId: built.projectId,
      limit: 8,
    });
    assert.ok(
      suggestions.some((s) => /CAB pack/i.test(s.question)),
      JSON.stringify(suggestions),
    );
  });

  await check("suggestions: project isolation", () => {
    const suite = getOfficialBenchmark();
    const north = suite.worlds.find((w) => w.id.includes("northline"))!;
    const harbor = suite.worlds.find((w) => w.id.includes("harbor"))!;
    assert.ok(north && harbor);
    const nStage = north.stages[north.stages.length - 1]!;
    const hStage = harbor.stages[harbor.stages.length - 1]!;
    const n = buildMissionStateForStage(north, nStage.id);
    const h = buildMissionStateForStage(harbor, hStage.id);

    // Merge both projects into one state
    const merged: MissionState = {
      ...n.state,
      projects: [...n.state.projects, ...h.state.projects],
      knowledge: [...n.state.knowledge, ...h.state.knowledge],
      todos: [...n.state.todos, ...h.state.todos],
      timeline: [...n.state.timeline, ...h.state.timeline],
    };
    const confirmed = confirmResponsibilityOwner({
      state: merged,
      projectId: n.projectId,
      scope: "UniqueNorthScopeXYZ",
      personName: "Ava Chen",
    });
    const northQs = buildCanonicalSuggestions({
      state: confirmed.state,
      projectId: n.projectId,
    });
    const harborQs = buildCanonicalSuggestions({
      state: confirmed.state,
      projectId: h.projectId,
    });
    assert.ok(northQs.some((q) => /UniqueNorthScopeXYZ/i.test(q.question)));
    assert.ok(!harborQs.some((q) => /UniqueNorthScopeXYZ/i.test(q.question)));
  });

  await check("canonical current Q uses authoritative domains without History dump", () => {
    const f = getCase("v1-meridian-q7-snyk-status")!;
    const world = getOfficialBenchmark().worlds.find((w) => w.id === f.worldId)!;
    const { state, projectId } = buildMissionStateForStage(world, f.stageId);

    process.env.LUME_CANONICAL_TRUTH = "0";
    const legacy = buildTellMeContext({
      state,
      question: f.question,
      selectedProjectId: projectId,
      useCanonicalTruth: false,
    });
    process.env.LUME_CANONICAL_TRUTH = "1";
    const canon = buildTellMeContext({
      state,
      question: f.question,
      selectedProjectId: projectId,
      useCanonicalTruth: true,
    });
    delete process.env.LUME_CANONICAL_TRUTH;

    assert.equal(canon.usedCanonicalTruth, true);
    assert.equal(Boolean(legacy.usedCanonicalTruth), false);
    // Slice 1D: authority over token-minimisation — do not require canon < legacy size
    assert.match(canon.promptBlock, /AUTHORITATIVE PROJECT STATE/);
    assert.match(canon.promptBlock, /MODE: current/);
    assert.match(canon.promptBlock, /RISKS \(domain lifecycle\)/);
    assert.ok(!/EVIDENCE \(history/i.test(canon.promptBlock));
    assert.ok(!/History:/i.test(canon.promptBlock));
  });

  await check("emptyKnowledge still has no structured by default", () => {
    const k = emptyKnowledge("p1");
    assert.equal(k.structured, undefined);
  });

  console.log(`\n${passed} canonical-truth checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
