/**
 * Capture V2 Slice 1C — server-authoritative current truth.
 * Deterministic. No live OpenAI. Injected workspace loader (no live Supabase).
 *
 * Run: npm run verify:capture-server-truth
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  runCaptureV2FromModelJson,
} from "../src/lib/capture-v2";
import {
  CaptureServerTruthError,
  clientPostedTruthFields,
  loadServerCaptureWorld,
} from "../src/lib/capture-v2/server-truth";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { fingerprintExpectedTarget } from "../src/lib/capture/apply/expected-target";
import { planCaptureApply } from "../src/lib/capture/apply";
import { DurableWorkspaceError } from "../src/lib/data/durable-workspace";
import { loadAuthenticatedWorkspace } from "../src/lib/data/durable-workspace";
import type { LoadedWorkspace } from "../src/lib/data/supabase/load-mission-state";
import type { MissionState } from "../src/lib/types";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";

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

function riskEnvelope(targetId: string, status = "resolved") {
  return {
    observations: [
      {
        id: "obs-risk",
        statement: "Gumdrop Bridge icing is resolved",
        evidence: "Gumdrop Bridge icing is resolved",
        domain: "risk",
        disposition: "update_existing",
        projectId: CANDY,
        candidateTargetId: targetId,
        candidateTargetTitle: "Gumdrop Bridge icing",
        proposedValues: { status },
      },
    ],
  };
}

function projectTruth(state: MissionState, projectId: string) {
  return {
    people: (state.projects.find((p) => p.id === projectId)?.stakeholders ?? [])
      .map((s) => ({ id: s.id, name: s.name, role: s.role }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    risks: (state.risks ?? [])
      .filter((r) => r.projectId === projectId)
      .map((r) => ({ id: r.id, title: r.title, status: r.status }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    todos: (state.todos ?? [])
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ id: t.id, title: t.title, done: Boolean(t.done) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    dates: (state.timeline ?? [])
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ id: t.id, label: t.label, startAt: t.startAt }))
      .sort((a, b) => a.id.localeCompare(b.id)),
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

  await check("A: stale/forged client MissionState ignored during Analyse", async () => {
    const serverState = clone(durable);
    const bridge = serverState.risks?.find((r) => r.id === "risk-bridge");
    assert.ok(bridge);
    bridge!.status = "resolved";

    const forged = clone(durable);
    const forgedRisk = forged.risks?.find((r) => r.id === "risk-bridge");
    assert.ok(forgedRisk);
    forgedRisk!.status = "open";

    assert.equal(clientPostedTruthFields({ state: forged }), true);

    const loaded = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(serverState),
    });
    const serverPrompt = loaded.world.risks.find((r) => r.id === "risk-bridge");
    assert.equal(serverPrompt?.status, "resolved");
    assert.equal(loaded.state.projects.length, 1);
    assert.equal(loaded.state.projects[0]?.id, CANDY);

    const ifClientWon = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(forged),
    });
    assert.equal(
      ifClientWon.world.risks.find((r) => r.id === "risk-bridge")?.status,
      "open",
    );
    assert.notEqual(
      serverPrompt?.status,
      ifClientWon.world.risks.find((r) => r.id === "risk-bridge")?.status,
    );
  });

  await check("B: foreign project ID returned by model is rejected", async () => {
    const loaded = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const run = runCaptureV2FromModelJson({
      transcript: "Resolve the console certification slip",
      rawModelJson: riskEnvelope("risk-console"),
      world: loaded.world,
      projectId: CANDY,
    });
    assert.ok(run.validation.rejected.length >= 1);
    assert.ok(
      run.validation.issues.some(
        (i) => i.code === "foreign_id" || i.code === "cross_project_id",
      ),
    );
    assert.equal(
      run.resolved.filter((r) => r.decision.kind === "write").length,
      0,
    );
    const suggestions = run.resolved
      .map((r) => r.suggestion)
      .filter(Boolean);
    assert.equal(suggestions.length, 0);
  });

  await check("C: valid current target resolves correctly", async () => {
    const loaded = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const run = runCaptureV2FromModelJson({
      transcript: "Gumdrop Bridge icing is resolved",
      rawModelJson: riskEnvelope("risk-bridge"),
      world: loaded.world,
      projectId: CANDY,
    });
    const writes = run.resolved.filter((r) => r.decision.kind === "write");
    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.suggestion?.targetEntityId, "risk-bridge");
    assert.equal(writes[0]?.suggestion?.expectedTarget?.id, "risk-bridge");
    assert.equal(writes[0]?.suggestion?.expectedTarget?.status, "open");
  });

  await check("D: entity changed between Analyse and Apply → fail closed", async () => {
    const loaded = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const run = runCaptureV2FromModelJson({
      transcript: "Gumdrop Bridge icing is resolved",
      rawModelJson: riskEnvelope("risk-bridge"),
      world: loaded.world,
      projectId: CANDY,
    });
    const item = run.resolved.find((r) => r.suggestion)?.suggestion;
    assert.ok(item);

    const changed = clone(durable);
    const risk = changed.risks?.find((r) => r.id === "risk-bridge");
    assert.ok(risk);
    risk!.status = "watch";

    const applied = await applyApprovedCaptureSuggestion({
      item,
      text: "Gumdrop Bridge icing is resolved",
      projectId: CANDY,
      expectedTarget: item.expectedTarget,
      loadWorkspace: async () => workspaceFrom(changed),
    });
    assert.equal(applied.decision.kind, "needs_you");
    assert.equal(applied.executed.kind, "needs_you");
    if (applied.decision.kind === "needs_you") {
      assert.match(applied.decision.reason, /changed since Review/i);
    }
    assert.equal(
      applied.state.risks?.find((r) => r.id === "risk-bridge")?.status,
      "watch",
    );
  });

  await check("E: entity deleted between Analyse and Apply → fail closed", async () => {
    const loaded = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const run = runCaptureV2FromModelJson({
      transcript: "Gumdrop Bridge icing is resolved",
      rawModelJson: riskEnvelope("risk-bridge"),
      world: loaded.world,
      projectId: CANDY,
    });
    const item = run.resolved.find((r) => r.suggestion)?.suggestion;
    assert.ok(item);

    const deleted = clone(durable);
    deleted.risks = (deleted.risks ?? []).filter((r) => r.id !== "risk-bridge");

    const applied = await applyApprovedCaptureSuggestion({
      item,
      text: "Gumdrop Bridge icing is resolved",
      projectId: CANDY,
      expectedTarget: item.expectedTarget,
      loadWorkspace: async () => workspaceFrom(deleted),
    });
    assert.equal(applied.executed.kind, "needs_you");
    assert.ok(
      !applied.state.risks?.some((r) => r.id === "risk-bridge"),
    );
  });

  await check("F: later sequential Capture sees durable truth from earlier Apply", async () => {
    let evolving = clone(durable);
    const firstLoad = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(evolving),
    });
    const first = runCaptureV2FromModelJson({
      transcript: "Gumdrop Bridge icing is resolved",
      rawModelJson: riskEnvelope("risk-bridge"),
      world: firstLoad.world,
      projectId: CANDY,
    });
    const item = first.resolved.find((r) => r.suggestion)?.suggestion;
    assert.ok(item);
    const applied = await applyApprovedCaptureSuggestion({
      item,
      text: "Gumdrop Bridge icing is resolved",
      projectId: CANDY,
      expectedTarget: item.expectedTarget,
      loadWorkspace: async () => workspaceFrom(evolving),
    });
    assert.equal(applied.executed.kind, "wrote");
    evolving = applied.state;
    assert.equal(
      evolving.risks?.find((r) => r.id === "risk-bridge")?.status,
      "resolved",
    );

    const secondLoad = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(evolving),
    });
    assert.equal(
      secondLoad.world.risks.find((r) => r.id === "risk-bridge")?.status,
      "resolved",
    );
  });

  await check("G: reload parity — Apply returns the mutated workspace", async () => {
    const applied = await applyApprovedCaptureSuggestion({
      item: {
        id: "s1",
        kind: "risk",
        op: "complete",
        content: "Gumdrop Bridge icing is resolved",
        destination: "project",
        projectId: CANDY,
        legalDomain: "risk",
        targetEntityId: "risk-bridge",
        proposedValues: { status: "resolved" },
      },
      text: "Gumdrop Bridge icing is resolved",
      projectId: CANDY,
      expectedTarget: {
        id: "risk-bridge",
        domain: "risk",
        title: "Gumdrop Bridge icing",
        status: "open",
      },
      loadWorkspace: async () => workspaceFrom(clone(durable)),
    });
    assert.equal(applied.executed.kind, "wrote");
    assert.ok(applied.state.projects.some((p) => p.id === TOY));
    assert.ok(applied.state.projects.some((p) => p.id === GAME));
    assert.equal(
      applied.state.risks?.find((r) => r.id === "risk-bridge")?.status,
      "resolved",
    );
    assert.equal(
      applied.state.risks?.find((r) => r.id === "risk-packaging")?.status,
      "open",
    );
  });

  await check("L: Apply adopted state is the committed result — subsequent server load matches without a hard refresh", async () => {
    const applied = await applyApprovedCaptureSuggestion({
      item: {
        id: "s-visibility",
        kind: "risk",
        op: "complete",
        content: "Gumdrop Bridge icing is resolved",
        destination: "project",
        projectId: CANDY,
        legalDomain: "risk",
        targetEntityId: "risk-bridge",
        proposedValues: { status: "resolved" },
      },
      text: "Gumdrop Bridge icing is resolved",
      projectId: CANDY,
      expectedTarget: {
        id: "risk-bridge",
        domain: "risk",
        title: "Gumdrop Bridge icing",
        status: "open",
      },
      loadWorkspace: async () => workspaceFrom(clone(durable)),
    });
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(
      applied.state.risks?.find((r) => r.id === "risk-bridge")?.status,
      "resolved",
      "returned Apply state must already represent the committed result",
    );

    const subsequent = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(applied.state),
    });
    assert.equal(
      subsequent.world.risks.find((r) => r.id === "risk-bridge")?.status,
      "resolved",
    );
    assert.deepEqual(
      projectTruth(subsequent.workspaceState, CANDY),
      projectTruth(applied.state, CANDY),
      "a subsequent server load must return the same relevant project truth — no hard refresh required",
    );
    assert.deepEqual(
      projectTruth(subsequent.state, CANDY),
      projectTruth(applied.state, CANDY),
    );
    assert.equal(
      subsequent.workspaceState.risks?.find((r) => r.id === "risk-packaging")?.status,
      "open",
    );
  });

  await check("H: Candyland / Toyworld / GamingStudio5000 isolation", async () => {
    const candy = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const toy = await loadServerCaptureWorld({
      projectId: TOY,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const game = await loadServerCaptureWorld({
      projectId: GAME,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    assert.equal(candy.state.projects[0]?.name, "Candyland");
    assert.equal(toy.state.projects[0]?.name, "Toyworld");
    assert.equal(game.state.projects[0]?.name, "GamingStudio5000");
    assert.ok(candy.world.risks.every((r) => r.projectId === CANDY));
    assert.ok(toy.world.risks.every((r) => r.projectId === TOY));
    assert.ok(!candy.world.todos.some((t) => t.id === "todo-track"));
    assert.ok(!candy.state.projects[0]?.stakeholders.some((s) => s.name === "Brick Oakley"));
    assert.ok(!toy.state.projects[0]?.stakeholders.some((s) => s.name === "Pippa Gumdrop"));

    const foreignApply = await applyApprovedCaptureSuggestion({
      item: {
        id: "foreign",
        kind: "risk",
        op: "complete",
        content: "Resolve packaging delay",
        destination: "project",
        projectId: CANDY,
        legalDomain: "risk",
        targetEntityId: "risk-packaging",
        proposedValues: { status: "resolved" },
        expectedTarget: {
          id: "risk-packaging",
          domain: "risk",
          title: "Packaging delay",
          status: "open",
        },
      },
      text: "Resolve packaging delay",
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    assert.notEqual(foreignApply.executed.kind, "wrote");
  });

  await check("I: Review-before-write intact — Analyse does not mutate", async () => {
    const before = clone(durable);
    const loaded = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(before),
    });
    runCaptureV2FromModelJson({
      transcript: "Gumdrop Bridge icing is resolved",
      rawModelJson: riskEnvelope("risk-bridge"),
      world: loaded.world,
      projectId: CANDY,
    });
    assert.equal(
      before.risks?.find((r) => r.id === "risk-bridge")?.status,
      durable.risks?.find((r) => r.id === "risk-bridge")?.status,
    );
  });

  await check("J: no durable mutation before approval", async () => {
    const evolving = { state: clone(durable) };
    const loaded = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(evolving.state),
    });
    const run = runCaptureV2FromModelJson({
      transcript: "Gumdrop Bridge icing is resolved",
      rawModelJson: riskEnvelope("risk-bridge"),
      world: loaded.world,
      projectId: CANDY,
    });
    assert.ok(run.resolved.some((r) => r.decision.kind === "write"));
    assert.equal(
      evolving.state.risks?.find((r) => r.id === "risk-bridge")?.status,
      "open",
    );
  });

  await check("K: Phase 3B still rejects illegal domain/action", () => {
    const item: PendingSuggestion = {
      id: "illegal",
      kind: "meeting",
      op: "create",
      content: "Schedule a mystery meeting",
      destination: "project",
      projectId: CANDY,
      legalDomain: "unsupported",
    };
    const loadedWorld = {
      projectIds: new Set([CANDY]),
      projects: durable.projects
        .filter((p) => p.id === CANDY)
        .map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          stakeholders: p.stakeholders ?? [],
        })),
      risks: (durable.risks ?? [])
        .filter((r) => r.projectId === CANDY)
        .map((r) => ({
          id: r.id,
          projectId: r.projectId,
          title: r.title,
          status: r.status,
        })),
      todos: (durable.todos ?? [])
        .filter((t) => t.projectId === CANDY)
        .map((t) => ({
          id: t.id,
          projectId: t.projectId,
          title: t.title,
          done: t.done,
        })),
      timeline: (durable.timeline ?? [])
        .filter((t) => t.projectId === CANDY)
        .map((t) => ({
          id: t.id,
          projectId: t.projectId,
          label: t.label,
          startAt: t.startAt,
        })),
      knowledge: [],
    };
    const decision = planCaptureApply({
      item,
      text: item.content,
      world: loadedWorld,
      captureEntryProjectId: CANDY,
    });
    assert.notEqual(decision.kind, "write");
  });

  await check("L: server-load failure never falls back to client truth", async () => {
    await assert.rejects(
      () =>
        loadServerCaptureWorld({
          projectId: CANDY,
          loadWorkspace: async () => {
            throw new Error("db down");
          },
        }),
      (err: unknown) => {
        assert.ok(
          err instanceof CaptureServerTruthError ||
            err instanceof DurableWorkspaceError,
        );
        return true;
      },
    );

    const prev = process.env.LUME_PERSISTENCE;
    process.env.LUME_PERSISTENCE = "local";
    try {
      await assert.rejects(
        () => loadAuthenticatedWorkspace(),
        (err: unknown) => {
          assert.ok(err instanceof DurableWorkspaceError);
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

  await check("person / todo / milestone foreign IDs fail closed", async () => {
    const loaded = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    for (const [domain, id] of [
      ["person", "person-brick"],
      ["todo", "todo-track"],
      ["milestone", "ms-freeze"],
    ] as const) {
      const run = runCaptureV2FromModelJson({
        transcript: `Update ${id}`,
        rawModelJson: {
          observations: [
            {
              id: `obs-${domain}`,
              statement: `Update ${id}`,
              evidence: `Update ${id}`,
              domain,
              disposition: "update_existing",
              projectId: CANDY,
              candidateTargetId: id,
            },
          ],
        },
        world: loaded.world,
        projectId: CANDY,
      });
      assert.equal(
        run.resolved.filter((r) => r.decision.kind === "write").length,
        0,
        domain,
      );
    }
  });

  await check("HTTP V2 Analyse never uses body.state as truth", () => {
    const route = readFileSync(join(ROOT, "src/app/api/capture/route.ts"), "utf8");
    assert.match(route, /loadServerCaptureWorld/);
    assert.match(route, /postCaptureV2/);
    assert.match(route, /ignoredClientTruth/);
    const v2Fn = route.slice(route.indexOf("async function postCaptureV2"));
    const v2Body = v2Fn.slice(0, v2Fn.indexOf("async function postCaptureLegacy"));
    assert.doesNotMatch(v2Body, /worldFromCaptureState\(\{[\s\S]*body\.state/);
    assert.doesNotMatch(v2Body, /body\.state\?\.projects/);
    assert.match(v2Body, /loadServerCaptureWorld/);

    const apply = readFileSync(
      join(ROOT, "src/app/api/capture/apply/route.ts"),
      "utf8",
    );
    assert.match(apply, /applyApprovedCaptureSuggestion/);
    assert.match(apply, /loadServerCaptureWorld/);
    assert.match(apply, /planCaptureApply|applyApprovedCaptureSuggestion/);
    assert.doesNotMatch(apply, /body\.state/);
    assert.match(apply, /requireAiCaller/);
  });

  await check("client V2 apply sends item not MissionState", () => {
    const client = readFileSync(
      join(ROOT, "src/components/capture/CaptureSessionContext.tsx"),
      "utf8",
    );
    assert.match(client, /fetch\("\/api\/capture\/apply"/);
    const applyBlock = client.slice(client.indexOf("/api/capture/apply"));
    const payload = applyBlock.slice(
      applyBlock.indexOf("JSON.stringify"),
      applyBlock.indexOf("});", applyBlock.indexOf("JSON.stringify")) + 2,
    );
    assert.match(payload, /projectId/);
    assert.match(payload, /expectedTarget/);
    assert.doesNotMatch(payload, /\bstate\b/);
  });

  await check("missing project is rejected", async () => {
    await assert.rejects(
      () =>
        loadServerCaptureWorld({
          projectId: "proj-does-not-exist",
          loadWorkspace: async () => workspaceFrom(durable),
        }),
      (err: unknown) => {
        assert.ok(err instanceof CaptureServerTruthError);
        assert.equal(err.status, 404);
        return true;
      },
    );
  });

  await check("fingerprint helper is analyse-time not apply-time", async () => {
    const loaded = await loadServerCaptureWorld({
      projectId: CANDY,
      loadWorkspace: async () => workspaceFrom(durable),
    });
    const item: PendingSuggestion = {
      id: "fp",
      kind: "risk",
      op: "complete",
      content: "x",
      destination: "project",
      projectId: CANDY,
      legalDomain: "risk",
      targetEntityId: "risk-bridge",
    };
    const fp = fingerprintExpectedTarget(loaded.world, item);
    assert.equal(fp?.status, "open");
    assert.equal(fp?.title, "Gumdrop Bridge icing");
  });

  console.log(`\nverify-capture-server-truth: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
