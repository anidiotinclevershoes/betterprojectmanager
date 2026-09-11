/**
 * Family 1 — Apply writes canonical milestone truth, then paint cache and
 * projects.next_milestone_on are rederived from that reload. First paint
 * after hard reload must not show pre-Apply dates.
 *
 * Run: npx tsx scripts/verify-apply-authoritative-first-paint.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { supabaseCaptureApplyHooks } from "../src/lib/capture/apply/persist-execute";
import { fingerprintExpectedTarget } from "../src/lib/capture/apply/expected-target";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import {
  persistTimelineUpdate,
  projectNextMilestoneFollowsUpdatedRow,
} from "../src/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase, emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import {
  readMissionSupabaseCache,
  writeConfirmedAppliedWorkspaceCache,
} from "../src/lib/mission-cache";
import { buildDateRows } from "../src/lib/knowledge-centre/ocean-frames";
import type { MissionState } from "../src/lib/types";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const MS_PROD = "aa333333-3333-4333-8333-aaaaaaaaaaaa";
const MS_CAB = "bb333333-3333-4333-8333-bbbbbbbbbbbb";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`✓ ${name}`);
    });
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as never;
}

function installMemoryLocalStorage() {
  const map = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
  (globalThis as { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };
}

function seedCaptureDateProject(fake: FakeWorkspaceClient) {
  fake.seedProject({
    id: PROJECT,
    workspace_id: fake.workspaceId,
    name: "E2E capture",
    code: "CAP",
    next_milestone: "Production release",
    next_milestone_on: "2026-09-12",
  });
  fake.tables.milestones.push(
    {
      id: MS_PROD,
      workspace_id: fake.workspaceId,
      project_id: PROJECT,
      label: "Production release",
      type: "deadline",
      start_on: "2026-09-12",
      source: "manual",
    },
    {
      id: MS_CAB,
      workspace_id: fake.workspaceId,
      project_id: PROJECT,
      label: "CAB preparation session",
      type: "deadline",
      start_on: "2026-09-15",
      source: "manual",
    },
  );
}

function productionRow(state: MissionState) {
  return (state.timeline ?? []).find((row) => row.id === MS_PROD);
}

async function main() {
  await check("project next-milestone pointer follows the named/dated row", () => {
    assert.equal(
      projectNextMilestoneFollowsUpdatedRow({
        nextMilestone: "Production release",
        nextMilestoneOn: "2026-09-12",
        previousLabel: "Production release",
        previousStartOn: "2026-09-12",
        nextLabel: "Production release",
      }),
      true,
    );
    assert.equal(
      projectNextMilestoneFollowsUpdatedRow({
        nextMilestone: "Production release",
        nextMilestoneOn: "2026-09-12",
        previousLabel: "CAB preparation session",
        previousStartOn: "2026-09-15",
        nextLabel: "CAB preparation session",
      }),
      false,
    );
  });

  await check("persistTimelineUpdate writes start_on 20 Sep and rederives next_milestone_on", async () => {
    const fake = new FakeWorkspaceClient();
    seedCaptureDateProject(fake);
    await persistTimelineUpdate(asClient(fake), fake.workspaceId, PROJECT, MS_PROD, {
      startAt: "2026-09-20T12:00:00.000Z",
    });
    const milestone = fake.tables.milestones.find((row) => row.id === MS_PROD);
    const cab = fake.tables.milestones.find((row) => row.id === MS_CAB);
    const project = fake.tables.projects.find((row) => row.id === PROJECT);
    assert.equal(milestone?.start_on, "2026-09-20");
    assert.equal(cab?.start_on, "2026-09-15");
    assert.equal(project?.next_milestone, "Production release");
    assert.equal(project?.next_milestone_on, "2026-09-20");
  });

  await check("sibling milestone update does not rewrite the next-milestone pointer", async () => {
    const fake = new FakeWorkspaceClient();
    seedCaptureDateProject(fake);
    await persistTimelineUpdate(asClient(fake), fake.workspaceId, PROJECT, MS_CAB, {
      startAt: "2026-09-18T12:00:00.000Z",
    });
    const project = fake.tables.projects.find((row) => row.id === PROJECT);
    const cab = fake.tables.milestones.find((row) => row.id === MS_CAB);
    const prod = fake.tables.milestones.find((row) => row.id === MS_PROD);
    assert.equal(cab?.start_on, "2026-09-18");
    assert.equal(prod?.start_on, "2026-09-12");
    assert.equal(project?.next_milestone_on, "2026-09-12");
  });

  await check("Apply wrote + reload hydrate + paint cache first paint are 20 Sep", async () => {
    const fake = new FakeWorkspaceClient();
    seedCaptureDateProject(fake);
    installMemoryLocalStorage();

    const before = await loadMissionStateFromSupabase(asClient(fake));
    assert.equal(productionRow(before.state)?.startAt, "2026-09-12T12:00:00.000Z");
    assert.equal(before.state.projects[0]?.nextMilestoneAt, "2026-09-12T12:00:00.000Z");
    writeConfirmedAppliedWorkspaceCache({
      persistenceMode: "supabase",
      workspaceId: before.workspaceId,
      userId: before.userId,
      state: before.state,
    });
    const stalePaint = readMissionSupabaseCache();
    assert.equal(
      productionRow(stalePaint!.state)?.startAt,
      "2026-09-12T12:00:00.000Z",
    );

    const suggestion: PendingSuggestion = {
      id: "op-date-update",
      kind: "milestone",
      op: "update",
      content: "Production release",
      destination: "project",
      projectId: PROJECT,
      date: "2026-09-20",
      legalDomain: "milestone",
      targetEntityId: MS_PROD,
    };
    suggestion.expectedTarget = fingerprintExpectedTarget(
      captureApplyWorldFromState(before.state),
      suggestion,
    );

    const applied = await applyApprovedCaptureSuggestion({
      item: suggestion,
      text: "The Production release is now scheduled for 20 September 2026.",
      projectId: PROJECT,
      expectedTarget: suggestion.expectedTarget,
      loadWorkspace: async () => before,
      hooks: supabaseCaptureApplyHooks({
        client: asClient(fake),
        workspaceId: fake.workspaceId,
        userId: fake.userId,
        state: before.state,
      }),
      reloadWorkspace: async () =>
        (await loadMissionStateFromSupabase(asClient(fake))).state,
    });
    assert.equal(applied.executed.kind, "wrote");
    assert.ok(applied.state);
    assert.equal(productionRow(applied.state)?.startAt, "2026-09-20T12:00:00.000Z");
    assert.equal(applied.state.projects[0]?.nextMilestoneAt, "2026-09-20T12:00:00.000Z");
    assert.equal(
      fake.tables.milestones.find((row) => row.id === MS_PROD)?.start_on,
      "2026-09-20",
    );
    assert.equal(
      fake.tables.projects.find((row) => row.id === PROJECT)?.next_milestone_on,
      "2026-09-20",
    );

    writeConfirmedAppliedWorkspaceCache({
      persistenceMode: "supabase",
      workspaceId: before.workspaceId,
      userId: before.userId,
      state: applied.state,
    });
    const firstPaint = readMissionSupabaseCache();
    assert.ok(firstPaint);
    assert.equal(productionRow(firstPaint.state)?.startAt, "2026-09-20T12:00:00.000Z");
    assert.equal(firstPaint.state.projects[0]?.nextMilestoneAt, "2026-09-20T12:00:00.000Z");
    const dates = buildDateRows(firstPaint.state, PROJECT);
    assert.ok(dates.some((row) => /Production release · 20 Sep/i.test(row.title)));
    assert.equal(
      dates.some((row) => /Production release · 12 Sep/i.test(row.title)),
      false,
    );

    const laterHydrate = await loadMissionStateFromSupabase(asClient(fake));
    assert.equal(productionRow(laterHydrate.state)?.startAt, "2026-09-20T12:00:00.000Z");
    assert.equal(laterHydrate.state.projects[0]?.nextMilestoneAt, "2026-09-20T12:00:00.000Z");
    const laterDates = buildDateRows(laterHydrate.state, PROJECT);
    assert.ok(laterDates.some((row) => /Production release · 20 Sep/i.test(row.title)));
  });

  await check("adoptAppliedState writes confirmed Apply state into the paint cache", () => {
    const store = readFileSync(join(process.cwd(), "src/lib/store.tsx"), "utf8");
    const adopt = store.slice(store.indexOf("const adoptAppliedState"));
    assert.match(adopt.slice(0, 700), /writeConfirmedAppliedWorkspaceCache/);
    assert.doesNotMatch(adopt.slice(0, 700), /saveStatus !== "saved"/);
    const persist = readFileSync(
      join(process.cwd(), "src/lib/data/supabase/persist-mutations.ts"),
      "utf8",
    );
    assert.match(persist, /projectNextMilestoneFollowsUpdatedRow/);
    assert.match(persist, /next_milestone_on/);
  });

  await check("local persistence must not write the durable supabase paint cache", () => {
    installMemoryLocalStorage();
    const empty = emptyMissionState();
    const wrote = writeConfirmedAppliedWorkspaceCache({
      persistenceMode: "local",
      workspaceId: "ws",
      userId: "user",
      state: empty,
    });
    assert.equal(wrote, false);
    assert.equal(readMissionSupabaseCache(), null);
  });

  console.log(`\n${passed} apply-authoritative-first-paint checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
