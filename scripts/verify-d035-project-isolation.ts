/**
 * D-035 Slice 1 — To Do UPDATE/DELETE must prove intended project membership.
 *
 * Credential-free. Fake Supabase client (no production data).
 *
 * Run: npx tsx scripts/verify-d035-project-isolation.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planCaptureApply } from "../src/lib/capture/apply/dispatch";
import { supabaseCaptureApplyHooks } from "../src/lib/capture/apply/persist-execute";
import type { CaptureApplyWorld } from "../src/lib/capture/apply/types";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import {
  persistTodoDelete,
  persistTodoUpdate,
} from "../src/lib/data/supabase/persist-mutations";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const TODO_A = "aaaa1111-1111-4111-8111-aaaaaaaaaaaa";
const TODO_B = "bbbb2222-2222-4222-8222-bbbbbbbbbbbb";
const TODO_UNASSIGNED = "cccc3333-3333-4333-8333-cccccccccccc";

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

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function extractFn(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `missing export ${name}`);
  const next = src.indexOf("\nexport async function ", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asClient(fake: FakeWorkspaceClient): any {
  return fake;
}

function seedAB(fake: FakeWorkspaceClient) {
  fake.seedProject({
    id: PROJECT_A,
    workspace_id: fake.workspaceId,
    name: "Project A",
    code: "PA",
  });
  fake.seedProject({
    id: PROJECT_B,
    workspace_id: fake.workspaceId,
    name: "Project B",
    code: "PB",
  });
  fake.tables.todos.push(
    {
      id: TODO_A,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_A,
      title: "A todo",
      done: false,
    },
    {
      id: TODO_B,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_B,
      title: "B todo",
      done: false,
    },
    {
      id: TODO_UNASSIGNED,
      workspace_id: fake.workspaceId,
      project_id: null,
      title: "Unassigned todo",
      done: false,
    },
  );
}

function todoA(fake: FakeWorkspaceClient) {
  return fake.tables.todos.find((row) => row.id === TODO_A);
}

function todoB(fake: FakeWorkspaceClient) {
  return fake.tables.todos.find((row) => row.id === TODO_B);
}

function snapshotB(fake: FakeWorkspaceClient) {
  const row = todoB(fake);
  assert.ok(row, "Project B To Do must still exist");
  return { ...row };
}

function captureWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT_A, PROJECT_B]),
    projects: [
      { id: PROJECT_A, name: "Project A", code: "PA", stakeholders: [] },
      { id: PROJECT_B, name: "Project B", code: "PB", stakeholders: [] },
    ],
    risks: [],
    todos: [
      { id: TODO_A, projectId: PROJECT_A, title: "A todo", done: false },
      { id: TODO_B, projectId: PROJECT_B, title: "B todo", done: false },
    ],
    timeline: [],
    knowledge: [],
  };
}

function todoCompleteSuggestion(targetId: string): PendingSuggestion {
  return {
    id: "sug-1",
    kind: "action",
    op: "complete",
    content: "Complete the todo",
    destination: "To Do",
    legalDomain: "todo",
    targetEntityId: targetId,
    targetTodoId: targetId,
    projectId: PROJECT_A,
  };
}

async function main() {
  const persistSrc = readSrc("src/lib/data/supabase/persist-mutations.ts");
  const storeSrc = readSrc("src/lib/store.tsx");
  const persistExecuteSrc = readSrc("src/lib/capture/apply/persist-execute.ts");

  await check("persistTodoUpdate WHERE is workspace + intended project + id", () => {
    const helperStart = persistSrc.indexOf("function scopeExistingTodo");
    assert.ok(helperStart >= 0, "missing scopeExistingTodo");
    const helper = persistSrc.slice(
      helperStart,
      persistSrc.indexOf("export async function persistTodoUpdate"),
    );
    assert.match(helper, /\.eq\("id", todoId\)/);
    assert.match(helper, /\.eq\("workspace_id", workspaceId\)/);
    assert.match(helper, /\.eq\("project_id", projectId\)/);
    assert.match(helper, /\.is\("project_id", null\)/);
    const fn = extractFn(persistSrc, "persistTodoUpdate");
    assert.match(fn, /scopeExistingTodo\(/);
    assert.match(fn, /not found in this project/);
    assert.match(fn, /patch\.projectId !== undefined/);
    assert.match(fn, /update\.project_id = patch\.projectId/);
  });

  await check("persistTodoDelete WHERE is workspace + intended project + id", () => {
    const fn = extractFn(persistSrc, "persistTodoDelete");
    assert.match(fn, /scopeExistingTodo\(/);
    assert.match(fn, /not found in this project/);
  });

  await check("store To Do mutations pass intended workspace + current project", () => {
    assert.match(
      storeSrc,
      /persistTodoUpdate\(\s*client,\s*meta\.workspaceId!,\s*projectId \?\? null,\s*todoId/,
    );
    assert.match(
      storeSrc,
      /persistTodoDelete\(\s*client,\s*meta\.workspaceId!,\s*projectId \?\? null,\s*todoId/,
    );
    assert.match(
      storeSrc,
      /intendedProjectId = before\.projectId \?\? null/,
    );
    assert.match(
      storeSrc,
      /persistTodoUpdate\(\s*client,\s*meta\.workspaceId!,\s*intendedProjectId \?\? null,\s*todoId/,
    );
  });

  await check("Capture persist-execute To Do hooks pass workspace + op.projectId", () => {
    assert.match(
      persistExecuteSrc,
      /persistTodoUpdate\(client, workspaceId, op\.projectId, op\.todoId/,
    );
    assert.match(
      persistExecuteSrc,
      /persistTodoDelete\(client, workspaceId, op\.projectId, op\.todoId\)/,
    );
  });

  await check(
    "foreign-project update is rejected and leaves B unchanged",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      const before = snapshotB(fake);
      await assert.rejects(
        () =>
          persistTodoUpdate(asClient(fake), fake.workspaceId, PROJECT_A, TODO_B, {
            title: "Hacked from A",
            done: true,
          }),
        /not found in this project/,
      );
      const after = snapshotB(fake);
      assert.equal(after.title, before.title);
      assert.equal(after.done, before.done);
      assert.equal(after.project_id, PROJECT_B);
      assert.equal(todoA(fake)?.title, "A todo");
    },
  );

  await check(
    "foreign-project reassignment via patch.projectId is rejected",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await assert.rejects(
        () =>
          persistTodoUpdate(asClient(fake), fake.workspaceId, PROJECT_A, TODO_B, {
            projectId: PROJECT_A,
          }),
        /not found in this project/,
      );
      const row = snapshotB(fake);
      assert.equal(row.project_id, PROJECT_B);
      assert.equal(row.title, "B todo");
      assert.equal(row.done, false);
    },
  );

  await check("foreign-project delete is rejected and B still exists", async () => {
    const fake = new FakeWorkspaceClient();
    seedAB(fake);
    await assert.rejects(
      () => persistTodoDelete(asClient(fake), fake.workspaceId, PROJECT_A, TODO_B),
      /not found in this project/,
    );
    assert.ok(todoB(fake), "Project B To Do must still exist");
    assert.ok(todoA(fake), "Project A To Do must still exist");
  });

  await check("same-project update still works", async () => {
    const fake = new FakeWorkspaceClient();
    seedAB(fake);
    await persistTodoUpdate(asClient(fake), fake.workspaceId, PROJECT_A, TODO_A, {
      title: "A todo updated",
    });
    assert.equal(todoA(fake)?.title, "A todo updated");
    assert.equal(todoA(fake)?.project_id, PROJECT_A);
    assert.equal(todoB(fake)?.title, "B todo");
  });

  await check("same-project completion still works", async () => {
    const fake = new FakeWorkspaceClient();
    seedAB(fake);
    await persistTodoUpdate(asClient(fake), fake.workspaceId, PROJECT_A, TODO_A, {
      done: true,
    });
    assert.equal(todoA(fake)?.done, true);
    assert.equal(todoB(fake)?.done, false);
  });

  await check("same-project delete still works", async () => {
    const fake = new FakeWorkspaceClient();
    seedAB(fake);
    await persistTodoDelete(asClient(fake), fake.workspaceId, PROJECT_A, TODO_A);
    assert.equal(todoA(fake), undefined);
    assert.ok(todoB(fake), "Project B To Do must remain after deleting A");
  });

  await check(
    "unassigned To Do is proven with project_id IS NULL, not destination projectId",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await assert.rejects(
        () =>
          persistTodoUpdate(
            asClient(fake),
            fake.workspaceId,
            PROJECT_A,
            TODO_UNASSIGNED,
            { title: "Stolen unassigned", projectId: PROJECT_A },
          ),
        /not found in this project/,
      );
      const row = fake.tables.todos.find((r) => r.id === TODO_UNASSIGNED);
      assert.equal(row?.title, "Unassigned todo");
      assert.equal(row?.project_id, null);
      await persistTodoUpdate(
        asClient(fake),
        fake.workspaceId,
        null,
        TODO_UNASSIGNED,
        { title: "Claimed unassigned", projectId: PROJECT_A },
      );
      const moved = fake.tables.todos.find((r) => r.id === TODO_UNASSIGNED);
      assert.equal(moved?.title, "Claimed unassigned");
      assert.equal(moved?.project_id, PROJECT_A);
    },
  );

  await check(
    "legal move: prove source project, then SET destination projectId",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await persistTodoUpdate(asClient(fake), fake.workspaceId, PROJECT_A, TODO_A, {
        projectId: PROJECT_B,
      });
      assert.equal(todoA(fake)?.project_id, PROJECT_B);
      assert.equal(todoB(fake)?.project_id, PROJECT_B);
    },
  );

  await check("reload after same-project update still shows the new title", async () => {
    const fake = new FakeWorkspaceClient();
    seedAB(fake);
    await persistTodoUpdate(asClient(fake), fake.workspaceId, PROJECT_A, TODO_A, {
      title: "Persisted title",
    });
    const { data, error } = await asClient(fake)
      .from("todos")
      .select("*")
      .eq("id", TODO_A)
      .maybeSingle();
    assert.equal(error, null);
    assert.equal(data?.title, "Persisted title");
    assert.equal(data?.project_id, PROJECT_A);
  });

  await check("Capture planner rejects completing Project B todo while applying on A", () => {
    const decision = planCaptureApply({
      item: todoCompleteSuggestion(TODO_B),
      text: "Complete the todo",
      world: captureWorld(),
      captureEntryProjectId: PROJECT_A,
    });
    assert.equal(decision.kind, "needs_you");
    assert.match(
      decision.kind === "needs_you" ? decision.reason : "",
      /not on this project/i,
    );
  });

  await check("Capture persist-execute legal complete still writes the intended todo", async () => {
    const fake = new FakeWorkspaceClient();
    seedAB(fake);
    const hooks = supabaseCaptureApplyHooks({
      client: asClient(fake),
      workspaceId: fake.workspaceId,
      userId: fake.userId,
      state: emptyMissionState(),
    });
    await hooks.completeTodo({
      type: "complete_todo",
      projectId: PROJECT_A,
      todoId: TODO_A,
    });
    assert.equal(todoA(fake)?.done, true);
    assert.equal(todoB(fake)?.done, false);
  });

  await check(
    "Capture persist-execute foreign complete is rejected at persist",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      const hooks = supabaseCaptureApplyHooks({
        client: asClient(fake),
        workspaceId: fake.workspaceId,
        userId: fake.userId,
        state: emptyMissionState(),
      });
      await assert.rejects(
        () =>
          Promise.resolve(
            hooks.completeTodo({
              type: "complete_todo",
              projectId: PROJECT_A,
              todoId: TODO_B,
            }),
          ),
        /not found in this project/,
      );
      assert.equal(todoB(fake)?.done, false);
    },
  );

  console.log(`\nD-035 To Do project isolation: ${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
