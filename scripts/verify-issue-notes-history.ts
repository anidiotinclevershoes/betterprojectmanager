/**
 * Issue Notes and exact History target identity.
 * Additive schema, transactional Notes+History, no title/fuzzy attribution.
 *
 * Run: npx tsx scripts/verify-issue-notes-history.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { historyInputFromCaptureOperation } from "../src/lib/capture/apply/history-evidence";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import {
  persistHistoryEvent,
  persistRiskNotes,
} from "../src/lib/data/supabase/persist-mutations";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { historyEventsForItem } from "../src/lib/knowledge-centre/item-history";
import { resolveKnowledgeItemDetail } from "../src/lib/knowledge-centre/knowledge-item-detail";
import { applyRiskNotesLocal } from "../src/lib/risks/issue-notes";
import type { HistoryEvent, MissionState, ProjectRisk } from "../src/lib/types";
import { FakeWorkspaceClient, type FakeRow } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const RISK_A = "33333333-3333-4333-8333-333333333333";
const RISK_B = "44444444-4444-4444-8444-444444444444";
const FOREIGN_WS = "55555555-5555-4555-8555-555555555555";
const TITLE = "Same title";
const NOTES = "wet-store mould note that must stay supplementary";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  console.log(`✓ ${name}`);
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as never;
}

function seedProject(fake: FakeWorkspaceClient, projectId: string) {
  if (fake.tables.projects.some((row) => row.id === projectId)) return;
  fake.seedProject({
    id: projectId,
    workspace_id: fake.workspaceId,
    name: "Old project",
    code: projectId === PROJECT ? "OLD" : "OTHER",
    summary: "",
    status: "healthy",
    kind: "delivery",
    current_focus: "",
  });
}

/** Pre-migration row shape: no notes column on the object. */
function seedOldRisk(
  fake: FakeWorkspaceClient,
  projectId: string,
  riskId: string,
  title = TITLE,
) {
  seedProject(fake, projectId);
  const row: FakeRow = {
    id: riskId,
    workspace_id: fake.workspaceId,
    project_id: projectId,
    title,
    status: "open",
    source: "manual",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  assert.equal("notes" in row, false);
  fake.tables.risks.push(row);
}

function seedOldHistory(fake: FakeWorkspaceClient, projectId: string) {
  const row: FakeRow = {
    id: "77777777-7777-4777-8777-777777777777",
    workspace_id: fake.workspaceId,
    project_id: projectId,
    type: "other",
    title: TITLE,
    detail: NOTES,
    source: "user",
    created_at: "2026-01-02T00:00:00.000Z",
  };
  assert.equal("target_kind" in row, false);
  assert.equal("target_id" in row, false);
  fake.tables.history_events.push(row);
}

async function reload(fake: FakeWorkspaceClient): Promise<MissionState> {
  const loaded = await loadMissionStateFromSupabase(asClient(fake));
  return loaded.state;
}

function riskNotes(state: MissionState, riskId: string) {
  return state.risks?.find((risk) => risk.id === riskId)?.notes ?? null;
}

async function main() {
  await check("migration is additive and does not backfill or fuzzy-match", () => {
    const sql = read(
      "supabase/migrations/20260929120000_issue_notes_and_history_target.sql",
    );
    assert.match(sql, /alter table public\.risks add column if not exists notes text;/);
    assert.match(
      sql,
      /alter table public\.history_events add column if not exists target_kind text;/,
    );
    assert.match(
      sql,
      /alter table public\.history_events add column if not exists target_id uuid;/,
    );
    assert.doesNotMatch(sql, /notes text not null/i);
    assert.doesNotMatch(sql, /target_id uuid not null/i);
    assert.doesNotMatch(sql, /update public\.history_events/i);
    const executable = sql.replace(/--[^\n]*/g, "");
    assert.doesNotMatch(executable, /backfill|ilike|similarity|fuzzy/i);
    assert.doesNotMatch(executable, /drop table|delete from|truncate/i);
    const riskUpdates = sql.match(/update public\.risks/gi) ?? [];
    assert.equal(riskUpdates.length, 1);
    assert.match(sql, /set notes = v_next/);
    assert.match(sql, /target_kind is null or target_kind = 'risk'/);
    assert.match(sql, /is_workspace_member/);
    assert.match(sql, /project is not in this workspace/);
    assert.match(sql, /issue is not in this project/);
    assert.match(sql, /Issue notes added/);
    assert.match(sql, /Issue notes updated/);
    assert.match(sql, /Issue notes cleared/);
    assert.match(sql, /Previous notes:/);
    assert.match(sql, /Current notes:/);
    assert.match(sql, /grant execute on function public\.set_risk_notes/);
    assert.doesNotMatch(sql, /security definer/i);

    const applyTx = read(
      "supabase/migrations/20260829200000_authoritative_apply_tx.sql",
    );
    const riskInsert = applyTx.slice(
      applyTx.indexOf("insert into public.risks"),
      applyTx.indexOf("insert into public.risks") + 280,
    );
    assert.match(riskInsert, /title, status, source, created_by/);
    assert.doesNotMatch(riskInsert, /\bnotes\b/);
  });

  await check("old risk and history rows load without notes or a target", async () => {
    const oldRisk: ProjectRisk = {
      id: RISK_A,
      projectId: PROJECT,
      title: TITLE,
      status: "open",
    };
    const oldEvent: HistoryEvent = {
      id: "hist-old",
      type: "other",
      title: TITLE,
      detail: NOTES,
      projectId: PROJECT,
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    assert.equal(oldRisk.notes, undefined);
    assert.equal(oldEvent.targetKind, undefined);
    assert.equal(oldEvent.targetId, undefined);

    const fake = new FakeWorkspaceClient();
    seedOldRisk(fake, PROJECT, RISK_A);
    seedOldHistory(fake, PROJECT);
    const state = await reload(fake);
    assert.equal(riskNotes(state, RISK_A), null);
    const loadedOld = state.history?.find((event) => event.id.startsWith("77777777"));
    assert.ok(loadedOld);
    assert.equal(loadedOld?.targetKind ?? null, null);
    assert.equal(loadedOld?.targetId ?? null, null);
    const read = historyEventsForItem(state, PROJECT, {
      kind: "risk",
      riskId: RISK_A,
    });
    assert.equal(read.events.length, 0);
    assert.equal(read.limitation, "D-004");
    assert.match(read.notice, /D-004/);
    const knowledgeText = JSON.stringify(state.knowledge ?? []);
    assert.match(knowledgeText, new RegExp(TITLE));
    assert.doesNotMatch(knowledgeText, new RegExp(NOTES));
  });

  await check("notes add, update, and clear survive authoritative reload", async () => {
    const fake = new FakeWorkspaceClient();
    seedOldRisk(fake, PROJECT, RISK_A);
    const added = await persistRiskNotes(asClient(fake), fake.workspaceId, fake.userId, {
      projectId: PROJECT,
      riskId: RISK_A,
      notes: `  ${NOTES}  `,
    });
    assert.equal(added.ok, true);
    assert.equal(added.changed, true);
    let state = await reload(fake);
    assert.equal(riskNotes(state, RISK_A), NOTES);
    let item = historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_A });
    assert.equal(item.events.length, 1);
    assert.equal(item.events[0]?.title, "Issue notes added");
    assert.match(item.events[0]?.detail ?? "", new RegExp(NOTES));
    assert.equal(item.events[0]?.targetKind, "risk");
    assert.equal(item.events[0]?.targetId, RISK_A);

    const updated = await persistRiskNotes(asClient(fake), fake.workspaceId, fake.userId, {
      projectId: PROJECT,
      riskId: RISK_A,
      notes: `${NOTES} revised`,
    });
    assert.equal(updated.ok, true);
    assert.equal(updated.changed, true);
    state = await reload(fake);
    assert.equal(riskNotes(state, RISK_A), `${NOTES} revised`);
    item = historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_A });
    assert.equal(item.events.some((event) => event.title === "Issue notes updated"), true);
    const revision = item.events.find((event) => event.title === "Issue notes updated");
    assert.match(revision?.detail ?? "", new RegExp(NOTES));
    assert.match(revision?.detail ?? "", /revised/);

    const same = await persistRiskNotes(asClient(fake), fake.workspaceId, fake.userId, {
      projectId: PROJECT,
      riskId: RISK_A,
      notes: `  ${NOTES} revised  `,
    });
    assert.equal(same.ok, true);
    assert.equal(same.changed, false);
    assert.equal(fake.tables.history_events.length, 2);

    const cleared = await persistRiskNotes(asClient(fake), fake.workspaceId, fake.userId, {
      projectId: PROJECT,
      riskId: RISK_A,
      notes: "   ",
    });
    assert.equal(cleared.ok, true);
    assert.equal(cleared.changed, true);
    state = await reload(fake);
    assert.equal(riskNotes(state, RISK_A), null);
    assert.equal(fake.tables.risks[0]?.notes ?? null, null);
    item = historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_A });
    const clear = item.events.find((event) => event.title === "Issue notes cleared");
    assert.ok(clear);
    assert.match(clear?.detail ?? "", new RegExp(`${NOTES} revised`));
    const knowledgeText = JSON.stringify(state.knowledge ?? []);
    assert.doesNotMatch(knowledgeText, /revised/);
  });

  await check("same title does not attribute history, including NULL targets", async () => {
    const fake = new FakeWorkspaceClient();
    seedOldRisk(fake, PROJECT, RISK_A);
    seedOldRisk(fake, PROJECT, RISK_B);
    seedOldHistory(fake, PROJECT);
    const wrote = await persistRiskNotes(asClient(fake), fake.workspaceId, fake.userId, {
      projectId: PROJECT,
      riskId: RISK_A,
      notes: NOTES,
    });
    assert.equal(wrote.ok, true);
    const state = await reload(fake);
    const first = historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_A });
    const second = historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_B });
    assert.equal(first.events.length, 1);
    assert.equal(first.events[0]?.targetId, RISK_A);
    assert.equal(second.events.length, 0);
    assert.equal(
      state.history?.filter((event) => event.title === TITLE && !event.targetId).length,
      1,
    );
    const todo = historyEventsForItem(state, PROJECT, {
      kind: "todo",
      todoId: RISK_A,
    });
    assert.equal(todo.events.length, 0);
    assert.equal(todo.attributable, false);
    assert.equal(todo.limitation, "D-004");
  });

  await check("history insert failure rolls notes back", async () => {
    const fake = new FakeWorkspaceClient();
    seedOldRisk(fake, PROJECT, RISK_A);
    fake.tables.risks[0]!.notes = "keep me";
    fake.armFailOnTable("history_events");
    const failed = await persistRiskNotes(asClient(fake), fake.workspaceId, fake.userId, {
      projectId: PROJECT,
      riskId: RISK_A,
      notes: "changed",
    });
    assert.equal(failed.ok, false);
    assert.match(failed.error ?? "", /history_events/);
    assert.equal(fake.tables.risks[0]?.notes, "keep me");
    assert.equal(fake.tables.history_events.length, 0);
  });

  await check("wrong project, workspace, and target cannot change notes", async () => {
    const fake = new FakeWorkspaceClient();
    seedOldRisk(fake, PROJECT, RISK_A);
    seedOldRisk(fake, OTHER, RISK_B);
    fake.tables.risks.find((row) => row.id === RISK_A)!.notes = "stay";
    fake.tables.risks.find((row) => row.id === RISK_B)!.notes = "foreign";

    const wrongProject = await persistRiskNotes(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      { projectId: OTHER, riskId: RISK_A, notes: "hijack" },
    );
    assert.equal(wrongProject.ok, false);
    assert.match(wrongProject.error ?? "", /issue is not in this project/);

    const missingProject = await persistRiskNotes(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      {
        projectId: "88888888-8888-4888-8888-888888888888",
        riskId: RISK_A,
        notes: "hijack",
      },
    );
    assert.equal(missingProject.ok, false);
    assert.match(missingProject.error ?? "", /project is not in this workspace/);

    const foreignWorkspace = await persistRiskNotes(
      asClient(fake),
      FOREIGN_WS,
      fake.userId,
      { projectId: PROJECT, riskId: RISK_A, notes: "hijack" },
    );
    assert.equal(foreignWorkspace.ok, false);
    assert.match(foreignWorkspace.error ?? "", /not a workspace member/);

    const foreignTarget = await persistRiskNotes(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      { projectId: PROJECT, riskId: RISK_B, notes: "hijack" },
    );
    assert.equal(foreignTarget.ok, false);
    assert.match(foreignTarget.error ?? "", /issue is not in this project/);

    assert.equal(fake.tables.risks.find((row) => row.id === RISK_A)?.notes, "stay");
    assert.equal(fake.tables.risks.find((row) => row.id === RISK_B)?.notes, "foreign");
    assert.equal(fake.tables.history_events.length, 0);
  });

  await check("local notes mutation matches durable history semantics", () => {
    const base = emptyMissionState();
    const risks: ProjectRisk[] = [
      { id: RISK_A, projectId: PROJECT, title: TITLE, status: "open" },
      { id: RISK_B, projectId: PROJECT, title: TITLE, status: "open", notes: "other" },
    ];
    const untouched: HistoryEvent = {
      id: "hist-old",
      type: "other",
      title: TITLE,
      detail: NOTES,
      projectId: PROJECT,
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    let state: MissionState = { ...base, risks, history: [untouched] };
    const missing = applyRiskNotesLocal(state, {
      projectId: OTHER,
      riskId: RISK_A,
      notes: NOTES,
    });
    assert.equal(missing.ok, false);
    const added = applyRiskNotesLocal(state, {
      projectId: PROJECT,
      riskId: RISK_A,
      notes: NOTES,
    });
    assert.equal(added.ok, true);
    if (!added.ok) return;
    state = added.state;
    assert.equal(state.risks?.find((risk) => risk.id === RISK_B)?.notes, "other");
    const first = historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_A });
    const second = historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_B });
    assert.equal(first.events.length, 1);
    assert.equal(second.events.length, 0);
    const cleared = applyRiskNotesLocal(state, {
      projectId: PROJECT,
      riskId: RISK_A,
      notes: null,
    });
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    assert.equal(cleared.state.risks?.find((risk) => risk.id === RISK_A)?.notes ?? null, null);
    const after = historyEventsForItem(cleared.state, PROJECT, {
      kind: "risk",
      riskId: RISK_A,
    });
    assert.match(
      after.events.find((event) => event.title === "Issue notes cleared")?.detail ?? "",
      new RegExp(NOTES),
    );
    const noop = applyRiskNotesLocal(cleared.state, {
      projectId: PROJECT,
      riskId: RISK_A,
      notes: "  ",
    });
    assert.equal(noop.ok, true);
    if (!noop.ok) return;
    assert.equal(noop.changed, false);
    assert.equal(noop.state.history?.length, cleared.state.history?.length);
  });

  await check("capture update_risk_status history carries the existing risk id", async () => {
    const updated = historyInputFromCaptureOperation({
      operation: {
        type: "update_risk_status",
        projectId: PROJECT,
        riskId: RISK_A,
        status: "watch",
      },
    });
    assert.equal(updated.type, "other");
    assert.equal(updated.title, "Capture updated a risk");
    assert.equal(updated.targetKind, "risk");
    assert.equal(updated.targetId, RISK_A);

    const created = historyInputFromCaptureOperation({
      operation: {
        type: "create_risk",
        projectId: PROJECT,
        title: TITLE,
      },
    });
    assert.equal(created.type, "risk_added");
    assert.equal(created.title, "Capture added a risk");
    assert.equal(created.targetKind, undefined);
    assert.equal(created.targetId, undefined);

    const fake = new FakeWorkspaceClient();
    seedProject(fake, PROJECT);
    await persistHistoryEvent(asClient(fake), fake.workspaceId, fake.userId, updated);
    const row = fake.tables.history_events[0];
    assert.equal(row?.target_kind, "risk");
    assert.equal(row?.target_id, RISK_A);
    assert.equal(row?.type, "other");

    await persistHistoryEvent(asClient(fake), fake.workspaceId, fake.userId, {
      type: "other",
      title: "Untargeted",
      projectId: PROJECT,
      source: "system",
      targetKind: "risk",
    });
    const untargeted = fake.tables.history_events[1];
    assert.equal(untargeted?.target_kind, undefined);
    assert.equal(untargeted?.target_id, undefined);
  });

  await check("detail model carries notes and this slice does not edit titles or prompts", () => {
    const state = emptyMissionState();
    state.projects = [
      {
        id: PROJECT,
        name: "Old project",
        code: "OLD",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      },
    ];
    state.risks = [
      {
        id: RISK_A,
        projectId: PROJECT,
        title: TITLE,
        status: "open",
        notes: NOTES,
      },
    ];
    const detail = resolveKnowledgeItemDetail(state, PROJECT, {
      kind: "risk",
      riskId: RISK_A,
    });
    assert.equal(detail?.issueNotes, NOTES);
    assert.equal(detail?.body, TITLE);
    assert.equal(detail?.canEditBody, false);

    for (const rel of [
      "src/lib/capture-v2/prompt.ts",
      "src/lib/knowledge-centre/project-scan.ts",
      "src/lib/tell-me/knowledge-search.ts",
      "src/lib/knowledge-centre/search-authority.ts",
      "src/lib/capture/apply/apply-approved.ts",
      "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /set_risk_notes|canonicalRiskNotes|issueNotes/);
    }
    assert.doesNotMatch(read("src/lib/store.tsx"), /setRiskTitle|persistRiskTitle/);
    assert.match(read("src/lib/data/supabase/load-mission-state.ts"), /notes: canonicalRiskNotes\(row\.notes\)/);
    assert.match(
      read("src/lib/data/supabase/load-mission-state.ts"),
      /targetKind: row\.target_kind/,
    );
    assert.match(read("src/lib/store.tsx"), /persistRiskNotes/);
  });

  console.log("verify-issue-notes-history: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
