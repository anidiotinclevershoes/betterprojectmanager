/**
 * Capture Apply → durable History evidence.
 * Successful writes record persistHistoryEvent AFTER the truth write.
 * Needs you / no_change / failed / stale do not.
 *
 * Run: npx tsx scripts/verify-capture-apply-history.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { supabaseCaptureApplyHooks } from "../src/lib/capture/apply/persist-execute";
import { historyInputFromCaptureOperation } from "../src/lib/capture/apply/history-evidence";
import type { CaptureApplyHooks } from "../src/lib/capture/apply/execute";
import { memoryCaptureApplyHooks } from "../src/lib/capture/apply/memory-execute";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import { persistHistoryEvent } from "../src/lib/data/supabase/persist-mutations";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { experimentalMissionState } from "../src/lib/eval-capture-v2/mission-state";
import type { HistoryEvent, MissionState } from "../src/lib/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const CANDY = "proj-candy";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  console.log(`✓ ${name}`);
}

function suggestion(
  partial: Partial<PendingSuggestion> &
    Pick<PendingSuggestion, "id" | "kind" | "op" | "content">,
): PendingSuggestion {
  return {
    destination: partial.destination ?? "test",
    ...partial,
  };
}

function workspace(state: MissionState) {
  return {
    workspaceId: "ws-test",
    userId: "user-test",
    state,
  };
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as never;
}

function historyFromFake(fake: FakeWorkspaceClient): HistoryEvent[] {
  return (fake.tables.history_events ?? []).map((row) => ({
    id: String(row.id),
    type: String(row.type) as HistoryEvent["type"],
    title: String(row.title),
    detail: row.detail ? String(row.detail) : undefined,
    projectId: (row.project_id as string | null) ?? null,
    createdAt: String(row.created_at),
    source: (row.source as HistoryEvent["source"]) ?? undefined,
  }));
}

async function main() {
  await check("production Apply records History only after a successful write", () => {
    const apply = readSrc("src/lib/capture/apply/apply-approved.ts");
    const route = readSrc("src/app/api/capture/apply/route.ts");
    const execute = readSrc("src/lib/capture/apply/execute.ts");
    const prompt = readSrc("src/lib/capture-v2/prompt.ts");
    assert.match(apply, /executed\.kind === "wrote"/);
    assert.match(apply, /recordHistory/);
    assert.match(apply, /history evidence skipped/);
    assert.match(route, /persistHistoryEvent/);
    assert.match(route, /recordHistory/);
    assert.doesNotMatch(execute, /persistHistoryEvent/);
    assert.doesNotMatch(execute, /pushHistory/);
    assert.doesNotMatch(prompt, /history_events|persistHistoryEvent/);
  });

  await check("successful memory Apply writes truth and History evidence", async () => {
    const seed = experimentalMissionState();
    const applied = await applyApprovedCaptureSuggestion({
      item: suggestion({
        id: "hist-create-todo",
        kind: "action",
        op: "create",
        content: "Book the wet-store dehumidifier",
        projectId: CANDY,
        legalDomain: "todo",
      }),
      text: "Book the wet-store dehumidifier",
      projectId: CANDY,
      loadWorkspace: async () => workspace(seed),
    });
    assert.equal(applied.executed.kind, "wrote");
    assert.ok(
      (applied.state.todos ?? []).some(
        (t) => t.title === "Book the wet-store dehumidifier",
      ),
    );
    const events = applied.state.history ?? [];
    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, "task_added");
    assert.equal(events[0]?.projectId, CANDY);
    assert.match(events[0]?.title ?? "", /Capture added a To Do/);
    assert.match(events[0]?.detail ?? "", /Book the wet-store dehumidifier/);
    assert.equal(events[0]?.source, "ai");
  });

  await check("Needs you does not record History", async () => {
    const seed = experimentalMissionState();
    const applied = await applyApprovedCaptureSuggestion({
      item: suggestion({
        id: "hist-stale",
        kind: "action",
        op: "complete",
        content: "Prepare the jelly pack is done",
        projectId: CANDY,
        legalDomain: "todo",
        targetEntityId: "todo-pack",
        targetTodoId: "todo-pack",
      }),
      text: "Prepare the jelly pack is done",
      projectId: CANDY,
      expectedTarget: {
        id: "todo-pack",
        domain: "todo",
        title: "Prepare the jelly pack",
        done: false,
      },
      loadWorkspace: async () => {
        const changed = structuredClone(seed);
        const todo = changed.todos.find((t) => t.id === "todo-pack");
        assert.ok(todo);
        todo.done = true;
        return workspace(changed);
      },
    });
    assert.equal(applied.executed.kind, "needs_you");
    assert.equal((applied.state.history ?? []).length, 0);
  });

  await check("no_change does not record History", async () => {
    const seed = experimentalMissionState();
    const applied = await applyApprovedCaptureSuggestion({
      item: suggestion({
        id: "hist-no-change",
        kind: "action",
        op: "create",
        content: "Prepare the jelly pack",
        projectId: CANDY,
        legalDomain: "todo",
        targetEntityId: "todo-pack",
        targetTodoId: "todo-pack",
      }),
      text: "Prepare the jelly pack",
      projectId: CANDY,
      loadWorkspace: async () => workspace(seed),
    });
    assert.equal(applied.executed.kind, "no_change");
    assert.equal((applied.state.history ?? []).length, 0);
    assert.equal(
      seed.todos.filter((t) => t.title === "Prepare the jelly pack").length,
      (applied.state.todos ?? []).filter((t) => t.title === "Prepare the jelly pack")
        .length,
    );
  });

  await check("failed persistence does not record History", async () => {
    const seed = experimentalMissionState();
    const box = { state: structuredClone(seed) };
    const hooks: CaptureApplyHooks = {
      ...memoryCaptureApplyHooks(box),
      createTodo: async () => {
        throw new Error("injected persist failure");
      },
    };
    const applied = await applyApprovedCaptureSuggestion({
      item: suggestion({
        id: "hist-fail",
        kind: "action",
        op: "create",
        content: "Should not land",
        projectId: CANDY,
        legalDomain: "todo",
      }),
      text: "Should not land",
      projectId: CANDY,
      loadWorkspace: async () => workspace(seed),
      hooks,
      recordHistory: async () => {
        throw new Error("history must not be called");
      },
    });
    assert.equal(applied.executed.kind, "failed");
    assert.equal((applied.state.history ?? []).length, 0);
    assert.ok(!(applied.state.todos ?? []).some((t) => t.title === "Should not land"));
  });

  await check("durable write then History then reload keeps both", async () => {
    const fake = new FakeWorkspaceClient();
    fake.seedProject({
      id: PROJECT_A,
      workspace_id: fake.workspaceId,
      name: "Project A",
      code: "PA",
    });
    const seed: MissionState = {
      ...emptyMissionState(),
      projects: [
        {
          id: PROJECT_A,
          name: "Project A",
          code: "PA",
          summary: "",
          status: "watch",
          currentFocus: "",
          stakeholders: [],
        },
      ],
    };
    const applied = await applyApprovedCaptureSuggestion({
      item: suggestion({
        id: "hist-durable",
        kind: "action",
        op: "create",
        content: "Issue the scan specification",
        projectId: PROJECT_A,
        legalDomain: "todo",
      }),
      text: "Issue the scan specification",
      projectId: PROJECT_A,
      loadWorkspace: async () => ({
        workspaceId: fake.workspaceId,
        userId: fake.userId,
        state: seed,
      }),
      hooks: supabaseCaptureApplyHooks({
        client: asClient(fake),
        workspaceId: fake.workspaceId,
        userId: fake.userId,
        state: seed,
      }),
      recordHistory: (event) =>
        persistHistoryEvent(asClient(fake), fake.workspaceId, fake.userId, event),
      reloadWorkspace: async () => ({
        ...seed,
        todos: fake.tables.todos.map((row) => ({
          id: String(row.id),
          projectId: String(row.project_id),
          title: String(row.title),
          done: Boolean(row.done),
          createdAt: String(row.created_at),
        })),
        history: historyFromFake(fake),
      }),
    });
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(fake.tables.todos.length, 1);
    assert.equal(fake.tables.todos[0]?.title, "Issue the scan specification");
    assert.equal(fake.tables.history_events.length, 1);
    assert.equal(fake.tables.history_events[0]?.type, "task_added");
    assert.equal(fake.tables.history_events[0]?.project_id, PROJECT_A);
    assert.equal((applied.state.todos ?? []).length, 1);
    assert.equal((applied.state.history ?? []).length, 1);
    assert.equal(applied.state.history?.[0]?.type, "task_added");
  });

  await check("durable truth-write failure records no History", async () => {
    const fake = new FakeWorkspaceClient({ failOnTable: "todos" });
    fake.seedProject({
      id: PROJECT_A,
      workspace_id: fake.workspaceId,
      name: "Project A",
      code: "PA",
    });
    const seed: MissionState = {
      ...emptyMissionState(),
      projects: [
        {
          id: PROJECT_A,
          name: "Project A",
          code: "PA",
          summary: "",
          status: "watch",
          currentFocus: "",
          stakeholders: [],
        },
      ],
    };
    const applied = await applyApprovedCaptureSuggestion({
      item: suggestion({
        id: "hist-durable-fail",
        kind: "action",
        op: "create",
        content: "Must not persist",
        projectId: PROJECT_A,
        legalDomain: "todo",
      }),
      text: "Must not persist",
      projectId: PROJECT_A,
      loadWorkspace: async () => ({
        workspaceId: fake.workspaceId,
        userId: fake.userId,
        state: seed,
      }),
      hooks: supabaseCaptureApplyHooks({
        client: asClient(fake),
        workspaceId: fake.workspaceId,
        userId: fake.userId,
        state: seed,
      }),
      recordHistory: (event) =>
        persistHistoryEvent(asClient(fake), fake.workspaceId, fake.userId, event),
    });
    assert.equal(applied.executed.kind, "failed");
    assert.equal(fake.tables.todos.length, 0);
    assert.equal(fake.tables.history_events.length, 0);
  });

  await check("History insert failure does not roll back the truth write", async () => {
    const fake = new FakeWorkspaceClient({ failOnTable: "history_events" });
    fake.seedProject({
      id: PROJECT_A,
      workspace_id: fake.workspaceId,
      name: "Project A",
      code: "PA",
    });
    const seed: MissionState = {
      ...emptyMissionState(),
      projects: [
        {
          id: PROJECT_A,
          name: "Project A",
          code: "PA",
          summary: "",
          status: "watch",
          currentFocus: "",
          stakeholders: [],
        },
      ],
    };
    const applied = await applyApprovedCaptureSuggestion({
      item: suggestion({
        id: "hist-skip",
        kind: "action",
        op: "create",
        content: "Truth without History",
        projectId: PROJECT_A,
        legalDomain: "todo",
      }),
      text: "Truth without History",
      projectId: PROJECT_A,
      loadWorkspace: async () => ({
        workspaceId: fake.workspaceId,
        userId: fake.userId,
        state: seed,
      }),
      hooks: supabaseCaptureApplyHooks({
        client: asClient(fake),
        workspaceId: fake.workspaceId,
        userId: fake.userId,
        state: seed,
      }),
      recordHistory: (event) =>
        persistHistoryEvent(asClient(fake), fake.workspaceId, fake.userId, event),
    });
    assert.equal(applied.executed.kind, "wrote");
    assert.equal(fake.tables.todos.length, 1);
    assert.equal(fake.tables.history_events.length, 0);
  });

  await check("operation mapping reuses existing History types", () => {
    const created = historyInputFromCaptureOperation({
      operation: {
        type: "create_risk",
        projectId: CANDY,
        title: "Mould in the wet-store",
      },
      evidence: "mould in the wet-store",
    });
    assert.equal(created.type, "risk_added");
    const milestone = historyInputFromCaptureOperation({
      operation: {
        type: "update_milestone",
        projectId: CANDY,
        milestoneId: "ms-1",
        startAt: "2026-10-09",
      },
    });
    assert.equal(milestone.type, "milestone_changed");
    const person = historyInputFromCaptureOperation({
      operation: {
        type: "ensure_person",
        projectId: CANDY,
        name: "Owen Hart",
      },
    });
    assert.equal(person.type, "other");
  });

  console.log("verify-capture-apply-history: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
