/**
 * Tell Me Slice 1B — server-authoritative current truth.
 * Deterministic. No live OpenAI. Injected workspace loader (no live Supabase).
 *
 * Run: npm run verify:tell-me-server-truth
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TellMeServerTruthError,
  clientPostedTruthFields,
  filterMissionStateToProject,
  loadAuthenticatedWorkspaceForTellMe,
  loadServerCurrentTruthForTellMe,
} from "../src/lib/tell-me/server-truth";
import { serializeCanonicalTruth } from "../src/lib/canonical-truth/serialize";
import { answerTellMeQuestion } from "../src/lib/tell-me/answer";
import type { LoadedWorkspace } from "../src/lib/data/supabase/load-mission-state";
import type { MissionState } from "../src/lib/types";

const ROOT = process.cwd();
const CANDY = "proj-candy";
const TOY = "proj-toy";
const GAME = "proj-game";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadFixtureState(): MissionState {
  return JSON.parse(
    readFileSync(join(ROOT, "e2e/fixtures/mission-state.json"), "utf8"),
  ) as MissionState;
}

function workspaceFrom(state: MissionState): LoadedWorkspace {
  return {
    workspaceId: "ws-test",
    userId: "user-test",
    state,
  };
}

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await Promise.resolve()
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
  const durable = loadFixtureState();

  await check("A: correct project load returns only that project", async () => {
    const loaded = await loadServerCurrentTruthForTellMe({
      projectId: CANDY,
      question: "What are the open risks?",
      loadWorkspace: async () => workspaceFrom(durable),
    });
    assert.equal(loaded.projectId, CANDY);
    assert.equal(loaded.state.projects.length, 1);
    assert.equal(loaded.state.projects[0]?.id, CANDY);
    assert.equal(loaded.state.projects[0]?.name, "Candyland");
    assert.match(loaded.canonical.promptBlock, /Gumdrop Bridge icing/);
    assert.match(loaded.canonical.promptBlock, /Pippa Gumdrop/);
    assert.match(loaded.canonical.promptBlock, /Prepare the jelly pack/);
    assert.match(loaded.canonical.promptBlock, /Parade day/);
  });

  await check("B: missing / unauthorised project is rejected", async () => {
    await assert.rejects(
      () =>
        loadServerCurrentTruthForTellMe({
          projectId: "proj-does-not-exist",
          question: "What is going on?",
          loadWorkspace: async () => workspaceFrom(durable),
        }),
      (err: unknown) => {
        assert.ok(err instanceof TellMeServerTruthError);
        assert.equal(err.status, 404);
        assert.equal(err.code, "project_not_found");
        return true;
      },
    );
    await assert.rejects(
      () =>
        loadServerCurrentTruthForTellMe({
          projectId: "",
          question: "What is going on?",
          loadWorkspace: async () => workspaceFrom(durable),
        }),
      (err: unknown) => {
        assert.ok(err instanceof TellMeServerTruthError);
        assert.equal(err.status, 400);
        return true;
      },
    );
  });

  await check("C: current truth is built from durable loader state", async () => {
    const loaded = await loadServerCurrentTruthForTellMe({
      projectId: CANDY,
      question: "What is the current position?",
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const direct = serializeCanonicalTruth({
      state: filterMissionStateToProject(durable, CANDY),
      projectId: CANDY,
      question: "What is the current position?",
    });
    assert.equal(loaded.canonical.promptBlock, direct.promptBlock);
    assert.equal(loaded.canonical.projectId, CANDY);
    assert.ok(loaded.canonical.approxChars > 0);
  });

  await check(
    "D: stale/forged client MissionState cannot override durable risk status",
    async () => {
      const serverState = clone(durable);
      const bridge = serverState.risks?.find((r) => r.id === "risk-bridge");
      assert.ok(bridge);
      bridge!.status = "resolved";

      const forgedClient = clone(durable);
      const forgedRisk = forgedClient.risks?.find((r) => r.id === "risk-bridge");
      assert.ok(forgedRisk);
      forgedRisk!.status = "open";
      forgedClient.knowledge[0]!.sections.now = [
        "CLIENT FORGERY: Gumdrop Bridge icing is still an open crisis",
      ];

      assert.equal(clientPostedTruthFields({ state: forgedClient }), true);

      const loaded = await loadServerCurrentTruthForTellMe({
        projectId: CANDY,
        question: "What is the status of Gumdrop Bridge icing?",
        loadWorkspace: async () => workspaceFrom(serverState),
      });

      assert.match(
        loaded.canonical.promptBlock,
        /\[risk-risk-bridge\] \(risk, resolved\) Gumdrop Bridge icing/,
      );
      assert.doesNotMatch(
        loaded.canonical.promptBlock,
        /\[risk-risk-bridge\] \(risk, open\)/,
      );
      assert.doesNotMatch(
        loaded.canonical.promptBlock,
        /CLIENT FORGERY/,
      );

      const ifClientWon = serializeCanonicalTruth({
        state: forgedClient,
        projectId: CANDY,
        question: "What is the status of Gumdrop Bridge icing?",
      });
      assert.match(
        ifClientWon.promptBlock,
        /\[risk-risk-bridge\] \(risk, open\) Gumdrop Bridge icing/,
      );
      assert.notEqual(loaded.canonical.promptBlock, ifClientWon.promptBlock);
    },
  );

  await check("E: Candyland / Toyworld / GamingStudio5000 cannot leak", async () => {
    const candy = await loadServerCurrentTruthForTellMe({
      projectId: CANDY,
      question: "What do we know?",
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const toy = await loadServerCurrentTruthForTellMe({
      projectId: TOY,
      question: "What do we know?",
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const game = await loadServerCurrentTruthForTellMe({
      projectId: GAME,
      question: "What do we know?",
      loadWorkspace: async () => workspaceFrom(durable),
    });

    assert.match(candy.canonical.promptBlock, /Candyland/);
    assert.doesNotMatch(candy.canonical.promptBlock, /Brick Oakley/);
    assert.doesNotMatch(candy.canonical.promptBlock, /Packaging delay/);
    assert.doesNotMatch(candy.canonical.promptBlock, /Pixel Ramos/);
    assert.doesNotMatch(candy.canonical.promptBlock, /Console certification slip/);
    assert.doesNotMatch(candy.canonical.promptBlock, /Print the track map/);
    assert.doesNotMatch(candy.canonical.promptBlock, /Boss balancing pass/);
    assert.equal(candy.state.todos.length, 1);
    assert.equal(candy.state.risks?.length, 1);

    assert.match(toy.canonical.promptBlock, /Toyworld/);
    assert.match(toy.canonical.promptBlock, /Captain Buttons/);
    assert.doesNotMatch(toy.canonical.promptBlock, /Pippa Gumdrop/);
    assert.doesNotMatch(toy.canonical.promptBlock, /Gumdrop Bridge icing/);
    assert.doesNotMatch(toy.canonical.promptBlock, /Pixel Ramos/);
    assert.doesNotMatch(toy.canonical.promptBlock, /GamingStudio5000/);

    assert.match(game.canonical.promptBlock, /GamingStudio5000/);
    assert.match(game.canonical.promptBlock, /Pixel Ramos/);
    assert.doesNotMatch(game.canonical.promptBlock, /Pippa Gumdrop/);
    assert.doesNotMatch(game.canonical.promptBlock, /Brick Oakley/);
    assert.doesNotMatch(game.canonical.promptBlock, /Parade day/);
  });

  await check("F: Tell Me ask path is read-only (no domain mutation helpers)", () => {
    const files = [
      "src/lib/tell-me/server-truth.ts",
      "src/app/api/tell-me/route.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(src, /\.insert\s*\(/);
      assert.doesNotMatch(src, /\.update\s*\(/);
      assert.doesNotMatch(src, /\.upsert\s*\(/);
      assert.doesNotMatch(src, /\.delete\s*\(/);
      assert.doesNotMatch(src, /applyOne/);
      assert.doesNotMatch(src, /planCaptureApply/);
      assert.doesNotMatch(src, /persistTodo/);
      assert.doesNotMatch(src, /persistRisk/);
      assert.doesNotMatch(src, /confirmResponsibilityOwner/);
    }
    const helper = readFileSync(
      join(ROOT, "src/lib/tell-me/server-truth.ts"),
      "utf8",
    );
    assert.match(helper, /serializeCanonicalTruth/);
    assert.doesNotMatch(helper, /buildCurrentTruthV2/);
    assert.doesNotMatch(helper, /TruthSnapshotService/);
    assert.doesNotMatch(helper, /ProjectTruthEngine/);
  });

  await check(
    "G: current structured truth outranks stale historical prose",
    async () => {
      const state = clone(durable);
      const bridge = state.risks?.find((r) => r.id === "risk-bridge");
      assert.ok(bridge);
      bridge!.status = "resolved";
      state.history = [
        {
          id: "hist-stale",
          type: "other",
          title: "Gumdrop Bridge icing is an emergency",
          detail: "Treat as open crisis",
          projectId: CANDY,
          createdAt: "2026-01-01T00:00:00.000Z",
          source: "system",
        },
      ];
      const k = state.knowledge.find((row) => row.projectId === CANDY)!;
      k.sections.risks = ["[Resolved] Gumdrop Bridge icing"];
      k.structured = [
        ...(k.structured ?? []),
        {
          id: "risk-prose-stale",
          projectId: CANDY,
          section: "risks",
          body: "[Resolved] Gumdrop Bridge icing",
          kind: "risk",
          epistemic: "legacy",
          lifecycle: "superseded",
        },
      ];

      const current = await loadServerCurrentTruthForTellMe({
        projectId: CANDY,
        question: "What is the current status of Gumdrop Bridge icing?",
        loadWorkspace: async () => workspaceFrom(state),
      });
      assert.equal(current.canonical.includedHistoryEvidence, false);
      assert.doesNotMatch(current.canonical.promptBlock, /EVIDENCE \(history/);
      assert.doesNotMatch(
        current.canonical.promptBlock,
        /Gumdrop Bridge icing is an emergency/,
      );
      assert.match(
        current.canonical.promptBlock,
        /\[risk-risk-bridge\] \(risk, resolved\) Gumdrop Bridge icing/,
      );
      assert.doesNotMatch(
        current.canonical.promptBlock,
        /\[Resolved\] Gumdrop Bridge icing/,
      );
    },
  );

  await check("H: answer contract still returns UI fields from server truth", async () => {
    const loaded = await loadServerCurrentTruthForTellMe({
      projectId: CANDY,
      question: "What are the open risks?",
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const result = await answerTellMeQuestion({
      question: "What are the open risks?",
      state: loaded.state,
      selectedProjectId: loaded.projectId,
      snapshot: null,
      useCanonicalTruth: true,
    });
    assert.equal(typeof result.answer, "string");
    assert.ok(result.answer.length > 0);
    assert.ok(
      result.confidence === "direct_confirmation" ||
        result.confidence === "related_context" ||
        result.confidence === "not_found" ||
        result.confidence === "inference",
    );
    assert.equal(result.scope.projectId, CANDY);
    assert.equal(result.scope.projectName, "Candyland");
    assert.equal(result.usedCanonicalTruth, true);
    assert.equal(result.contextStats.snapshotUsed, false);
    assert.ok(Array.isArray(result.sources));
  });

  await check("HTTP route never trusts body.state and always uses server load", () => {
    const route = readFileSync(join(ROOT, "src/app/api/tell-me/route.ts"), "utf8");
    assert.match(route, /loadServerCurrentTruthForTellMe/);
    assert.match(route, /useCanonicalTruth:\s*true/);
    assert.match(route, /snapshot:\s*null/);
    assert.doesNotMatch(route, /state:\s*body\.state/);
    assert.doesNotMatch(route, /loadSnapshotFromSupabase/);
    assert.match(route, /TellMeServerTruthError/);

    const refresh = readFileSync(
      join(ROOT, "src/app/api/tell-me/refresh/route.ts"),
      "utf8",
    );
    assert.match(refresh, /loadServerCurrentTruthForTellMe/);
    assert.doesNotMatch(refresh, /body\.state\.projects/);
    assert.doesNotMatch(refresh, /state:\s*body\.state/);
  });

  await check("Client Tell Me request sends intent, not MissionState", () => {
    const client = readFileSync(
      join(ROOT, "src/components/tell-me/TellMeSessionContext.tsx"),
      "utf8",
    );
    assert.match(client, /fetch\("\/api\/tell-me"/);
    assert.doesNotMatch(client, /snapshot:\s*activeSnapshot/);
    const askBlock = client.slice(
      client.indexOf('fetch("/api/tell-me"'),
      client.indexOf('fetch("/api/tell-me/refresh"'),
    );
    const refreshBlock = client.slice(
      client.indexOf('fetch("/api/tell-me/refresh"'),
    );
    const askPayload = askBlock.slice(
      askBlock.indexOf("JSON.stringify"),
      askBlock.indexOf("});", askBlock.indexOf("JSON.stringify")) + 2,
    );
    assert.match(askPayload, /question:\s*q/);
    assert.match(askPayload, /projectId/);
    assert.doesNotMatch(askPayload, /\bstate\b/);
    assert.doesNotMatch(askPayload, /\bsnapshot\b/);

    const refreshPayload = refreshBlock.slice(
      refreshBlock.indexOf("JSON.stringify"),
      refreshBlock.indexOf(
        "});",
        refreshBlock.indexOf("JSON.stringify"),
      ) + 2,
    );
    assert.match(refreshPayload, /projectId/);
    assert.doesNotMatch(refreshPayload, /\bstate\b/);
  });

  await check("no silent fallback: local persistence fails visibly", async () => {
    const prev = process.env.LUME_PERSISTENCE;
    process.env.LUME_PERSISTENCE = "local";
    try {
      await assert.rejects(
        () => loadAuthenticatedWorkspaceForTellMe(),
        (err: unknown) => {
          assert.ok(err instanceof TellMeServerTruthError);
          assert.equal(err.status, 503);
          assert.equal(err.code, "persistence_unavailable");
          return true;
        },
      );
    } finally {
      if (prev === undefined) delete process.env.LUME_PERSISTENCE;
      else process.env.LUME_PERSISTENCE = prev;
    }
  });

  await check("load helper never takes client MissionState as truth", () => {
    const src = readFileSync(join(ROOT, "src/lib/tell-me/server-truth.ts"), "utf8");
    assert.match(
      src,
      /Never accepts client MissionState/,
    );
    assert.doesNotMatch(src, /clientState/);
    assert.doesNotMatch(src, /fall back to client/i);
    const fn = loadServerCurrentTruthForTellMe.toString();
    assert.doesNotMatch(fn, /clientState/);
  });

  console.log(`\nverify-tell-me-server-truth: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
