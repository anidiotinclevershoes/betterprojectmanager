/**
 * Qualification gate: ordinary Capture UPDATE must not destroy object identity.
 *
 * Expected invariant (Thor / Nick Fury persistence audit):
 * 1. Ordinary Todo UPDATE preserves the existing title.
 * 2. Ordinary milestone UPDATE preserves the existing label.
 * 3. Intended mutable fields still change (due date, done, milestone date).
 * 4. Reloaded state still preserves identity.
 * 5. Other projects/objects are unaffected.
 *
 * Uses the real Capture V2 Analyse → Apply path (same as stacked journeys).
 * Does not weaken assertions to fit current title/label overwrite.
 *
 * Run: npx tsx scripts/verify-stable-object-identity.ts
 */
import assert from "node:assert/strict";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { worldFromCaptureState, runCaptureV2FromModelJson } from "../src/lib/capture-v2";
import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
  experimentalMissionState,
} from "../src/lib/eval-capture-v2/mission-state";
import { snapshotProject } from "../src/lib/eval-capture-v2/stacked-runtime";
import type { MissionState } from "../src/lib/types";

const JELLY_TITLE = "Prepare the jelly pack";
const PARADE_LABEL = "Parade day";
const TODO_DUE_TRANSCRIPT =
  "Please update Prepare the jelly pack so the due date is 20 October 2026 after the liquorice shipment slipped a week and the parade committee asked us to hold the pack until the banners are painted.";
const TODO_DONE_TRANSCRIPT =
  "We finished preparing the jelly pack this morning after the liquorice ropes arrived.";
const MILESTONE_TRANSCRIPT =
  "Parade day has moved to 29 October 2026 because the council moved the road closure and the float cannot leave the depot until the new date.";

let passed = 0;
const failures: string[] = [];

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`✗ ${name}`);
    console.error(err);
  }
}

function clone(state: MissionState): MissionState {
  return structuredClone(state);
}

function reload(state: MissionState): MissionState {
  return JSON.parse(JSON.stringify(state)) as MissionState;
}

function todoEnvelope(args: {
  transcript: string;
  proposedValues: Record<string, unknown>;
}) {
  return {
    observations: [
      {
        id: "obs-todo-identity",
        statement: args.transcript,
        evidence: args.transcript,
        domain: "todo",
        disposition: "update_existing",
        projectId: CANDYLAND_ID,
        candidateTargetId: "todo-pack",
        candidateTargetTitle: JELLY_TITLE,
        proposedValues: args.proposedValues,
      },
    ],
  };
}

function milestoneEnvelope(transcript: string) {
  return {
    observations: [
      {
        id: "obs-ms-identity",
        statement: transcript,
        evidence: transcript,
        domain: "milestone",
        disposition: "update_existing",
        projectId: CANDYLAND_ID,
        candidateTargetId: "ms-parade",
        candidateTargetTitle: PARADE_LABEL,
        proposedValues: { date: "2026-10-29" },
      },
    ],
  };
}

async function applyV2(args: {
  state: MissionState;
  transcript: string;
  envelope: unknown;
}) {
  const world = worldFromCaptureState(args.state);
  const pipeline = runCaptureV2FromModelJson({
    transcript: args.transcript,
    rawModelJson: args.envelope,
    world,
    projectId: CANDYLAND_ID,
  });
  const writes = pipeline.resolved.filter(
    (row) => row.decision.kind === "write" && row.suggestion,
  );
  assert.ok(writes.length >= 1, "expected at least one Apply-ready write");

  let state = args.state;
  let lastApplied: Awaited<ReturnType<typeof applyApprovedCaptureSuggestion>> | null =
    null;
  for (const row of writes) {
    const applied = await applyApprovedCaptureSuggestion({
      item: row.suggestion!,
      text: args.transcript,
      projectId: CANDYLAND_ID,
      expectedTarget: row.suggestion!.expectedTarget,
      loadWorkspace: async () => ({
        workspaceId: "identity",
        userId: "identity",
        state,
      }),
    });
    lastApplied = applied;
    assert.equal(
      applied.executed.kind,
      "wrote",
      `expected durable write, got ${applied.executed.kind}${
        applied.executed.kind === "needs_you" ? `: ${applied.executed.reason}` : ""
      }`,
    );
    state = applied.state;
  }
  assert.ok(lastApplied);
  return { pipeline, applied: lastApplied, state };
}

function jelly(state: MissionState) {
  return (state.todos ?? []).find((t) => t.id === "todo-pack");
}

function parade(state: MissionState) {
  return (state.timeline ?? []).find((t) => t.id === "ms-parade");
}

async function main() {
  const seed = experimentalMissionState();
  const seedToy = snapshotProject(seed, TOYWORLD_ID);
  const seedGame = snapshotProject(seed, GAMING_ID);

  await check("ordinary Todo complete preserves existing title and id", async () => {
    const { applied, state } = await applyV2({
      state: clone(seed),
      transcript: TODO_DONE_TRANSCRIPT,
      envelope: todoEnvelope({
        transcript: TODO_DONE_TRANSCRIPT,
        proposedValues: { status: "complete", done: true },
      }),
    });
    const pack = jelly(state);
    assert.ok(pack);
    assert.equal(pack?.id, "todo-pack");
    assert.equal(pack?.title, JELLY_TITLE);
    assert.notEqual(pack?.title, TODO_DONE_TRANSCRIPT);
    assert.equal(pack?.done, true);
    if (applied.decision.kind === "write") {
      assert.equal(applied.decision.operation.type, "complete_todo");
    }
  });

  await check("ordinary Todo UPDATE preserves existing title; due date changes", async () => {
    const { applied, state } = await applyV2({
      state: clone(seed),
      transcript: TODO_DUE_TRANSCRIPT,
      envelope: todoEnvelope({
        transcript: TODO_DUE_TRANSCRIPT,
        proposedValues: { date: "2026-10-20" },
      }),
    });
    const pack = jelly(state);
    assert.ok(pack);
    assert.equal(pack?.id, "todo-pack");
    assert.equal(pack?.title, JELLY_TITLE);
    assert.notEqual(pack?.title, TODO_DUE_TRANSCRIPT);
    assert.ok(
      pack?.dueAt?.startsWith("2026-10-20"),
      `expected due date 2026-10-20, got ${pack?.dueAt ?? "none"}`,
    );
    assert.equal(pack?.done, false);
    if (applied.decision.kind === "write") {
      assert.equal(applied.decision.operation.type, "update_todo");
      if (applied.decision.operation.type === "update_todo") {
        assert.equal(
          applied.decision.operation.title,
          undefined,
          "ordinary UPDATE must not copy the Capture transcript onto the Todo title",
        );
      }
    }
    const reloaded = reload(state);
    assert.equal(jelly(reloaded)?.title, JELLY_TITLE);
    assert.equal(jelly(reloaded)?.id, "todo-pack");
    assert.ok(jelly(reloaded)?.dueAt?.startsWith("2026-10-20"));
    assert.deepEqual(snapshotProject(state, TOYWORLD_ID), seedToy);
    assert.deepEqual(snapshotProject(state, GAMING_ID), seedGame);
    assert.equal(
      (state.todos ?? []).find((t) => t.id === "todo-track")?.title,
      "Print the track map",
    );
    assert.equal(
      (state.todos ?? []).find((t) => t.id === "todo-balance")?.title,
      "Boss balancing pass",
    );
  });

  await check("ordinary milestone UPDATE preserves existing label; date changes", async () => {
    const { applied, state } = await applyV2({
      state: clone(seed),
      transcript: MILESTONE_TRANSCRIPT,
      envelope: milestoneEnvelope(MILESTONE_TRANSCRIPT),
    });
    const day = parade(state);
    assert.ok(day);
    assert.equal(day?.id, "ms-parade");
    assert.equal(day?.label, PARADE_LABEL);
    assert.notEqual(day?.label, MILESTONE_TRANSCRIPT);
    assert.ok(
      day?.startAt?.startsWith("2026-10-29"),
      `expected Parade day 2026-10-29, got ${day?.startAt ?? "none"}`,
    );
    if (applied.decision.kind === "write") {
      assert.equal(applied.decision.operation.type, "update_milestone");
      if (applied.decision.operation.type === "update_milestone") {
        assert.equal(
          applied.decision.operation.label,
          undefined,
          "ordinary UPDATE must not copy the Capture transcript onto the milestone label",
        );
      }
    }
    const reloaded = reload(state);
    assert.equal(parade(reloaded)?.label, PARADE_LABEL);
    assert.equal(parade(reloaded)?.id, "ms-parade");
    assert.ok(parade(reloaded)?.startAt?.startsWith("2026-10-29"));
    assert.deepEqual(snapshotProject(state, TOYWORLD_ID), seedToy);
    assert.deepEqual(snapshotProject(state, GAMING_ID), seedGame);
    assert.equal(
      (state.timeline ?? []).find((t) => t.id === "ms-freeze")?.label,
      "Track freeze",
    );
    assert.equal(
      (state.timeline ?? []).find((t) => t.id === "ms-cert")?.label,
      "Console certification",
    );
  });

  console.log(`\nverify-stable-object-identity: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.error("Thor gate still open:");
    for (const name of failures) console.error(`  - ${name}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
