/**
 * Nick Fury persistence audit — resurrection / delete-stays-deleted.
 *
 * Representative Todo lifecycle on the shared persist + load path
 * (FakeWorkspaceClient, not a new persistence platform):
 * create → reload present → delete → immediate absent → reload absent →
 * unrelated mutation → reload still absent. Sibling project with the
 * same Todo title remains untouched.
 *
 * Cheap extra domain: resolved Risk stays resolved after reload.
 *
 * Run: npx tsx scripts/verify-resurrection.ts
 */
import assert from "node:assert/strict";
import type { CreateProjectInput } from "../src/lib/create-project";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import {
  persistKnowledgeLifecycle,
  persistNewProject,
  persistRiskStatus,
  persistTodoCreate,
  persistTodoDelete,
} from "../src/lib/data/supabase/persist-mutations";
import type { MissionState } from "../src/lib/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const PROJECT_A_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_B_ID = "22222222-2222-4222-8222-222222222222";
const SHARED_TODO_TITLE = "File the parade permit";

let passed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as unknown as Parameters<typeof persistNewProject>[0];
}

function draft(
  name: string,
  overrides: Partial<CreateProjectInput> = {},
): CreateProjectInput {
  return {
    name,
    code: name.replace(/\s+/g, "-").slice(0, 12).toUpperCase(),
    summary: `${name} summary`,
    currentFocus: `${name} focus`,
    sourceMode: "talk",
    stakeholders: [{ name: `${name} person`, role: "Sponsor" }],
    risks: [{ title: `${name} risk` }],
    importantDates: [{ label: `${name} milestone`, date: "2026-10-01" }],
    todos: [{ title: SHARED_TODO_TITLE }],
    knowledgeRemember: [{ text: `${name} knowledge`, remember: true }],
    ...overrides,
  };
}

async function seedAB(fake: FakeWorkspaceClient) {
  await persistNewProject(
    asClient(fake),
    fake.workspaceId,
    fake.userId,
    draft("Project A", { clientProjectId: PROJECT_A_ID }),
  );
  await persistNewProject(
    asClient(fake),
    fake.workspaceId,
    fake.userId,
    draft("Project B", { clientProjectId: PROJECT_B_ID }),
  );
}

async function load(fake: FakeWorkspaceClient): Promise<MissionState> {
  return (await loadMissionStateFromSupabase(asClient(fake))).state;
}

function todosNamed(state: MissionState, projectId: string, title: string) {
  return (state.todos ?? []).filter(
    (t) => t.projectId === projectId && t.title === title,
  );
}

function rowTodo(
  fake: FakeWorkspaceClient,
  projectId: string,
  title: string,
) {
  return (fake.tables.todos ?? []).find(
    (row) => row.project_id === projectId && row.title === title,
  );
}

function snapshotB(state: MissionState) {
  return {
    name: state.projects.find((p) => p.id === PROJECT_B_ID)?.name,
    todos: (state.todos ?? [])
      .filter((t) => t.projectId === PROJECT_B_ID)
      .map((t) => ({ id: t.id, title: t.title, done: t.done }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    risks: (state.risks ?? [])
      .filter((r) => r.projectId === PROJECT_B_ID)
      .map((r) => ({ id: r.id, title: r.title, status: r.status }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    knowledge: (state.knowledge.find((k) => k.projectId === PROJECT_B_ID)
      ?.structured ?? [])
      .map((row) => ({ id: row.id, body: row.body, lifecycle: row.lifecycle }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    dates: (state.timeline ?? [])
      .filter((t) => t.projectId === PROJECT_B_ID)
      .map((t) => ({ id: t.id, label: t.label, startAt: t.startAt }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

async function main() {
  await check("Todo lifecycle: create survives reload; delete stays deleted", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);

    const afterCreate = await load(fake);
    const createdA = todosNamed(afterCreate, PROJECT_A_ID, SHARED_TODO_TITLE);
    const createdB = todosNamed(afterCreate, PROJECT_B_ID, SHARED_TODO_TITLE);
    assert.equal(createdA.length, 1, "Project A durable Todo must be present after create");
    assert.equal(createdB.length, 1, "Project B same-named Todo must be present");
    const todoAId = createdA[0]!.id;
    const todoBId = createdB[0]!.id;
    assert.notEqual(todoAId, todoBId);
    const bAfterCreate = snapshotB(afterCreate);

    const row = rowTodo(fake, PROJECT_A_ID, SHARED_TODO_TITLE);
    assert.ok(row);
    await persistTodoDelete(
      asClient(fake),
      fake.workspaceId,
      PROJECT_A_ID,
      String(row!.id),
    );

    assert.equal(
      (fake.tables.todos ?? []).some(
        (t) => t.id === todoAId || (t.project_id === PROJECT_A_ID && t.title === SHARED_TODO_TITLE),
      ),
      false,
      "deleted Todo must be absent immediately on the persist path",
    );
    assert.ok(
      (fake.tables.todos ?? []).some(
        (t) => t.id === todoBId && t.project_id === PROJECT_B_ID,
      ),
      "Project B same-named Todo must survive the delete",
    );

    const afterDelete = await load(fake);
    assert.equal(todosNamed(afterDelete, PROJECT_A_ID, SHARED_TODO_TITLE).length, 0);
    assert.equal(todosNamed(afterDelete, PROJECT_B_ID, SHARED_TODO_TITLE).length, 1);
    assert.equal(todosNamed(afterDelete, PROJECT_B_ID, SHARED_TODO_TITLE)[0]?.id, todoBId);
    assert.deepEqual(snapshotB(afterDelete), bAfterCreate);

    await persistTodoCreate(asClient(fake), fake.workspaceId, fake.userId, {
      projectId: PROJECT_A_ID,
      title: "Order extra banners",
      done: false,
    });

    const afterUnrelated = await load(fake);
    assert.equal(
      todosNamed(afterUnrelated, PROJECT_A_ID, SHARED_TODO_TITLE).length,
      0,
      "deleted Todo must not resurrect after an unrelated persist",
    );
    assert.equal(
      (afterUnrelated.todos ?? []).filter(
        (t) => t.projectId === PROJECT_A_ID && t.title === "Order extra banners",
      ).length,
      1,
    );
    assert.equal(todosNamed(afterUnrelated, PROJECT_B_ID, SHARED_TODO_TITLE).length, 1);
    assert.equal(todosNamed(afterUnrelated, PROJECT_B_ID, SHARED_TODO_TITLE)[0]?.id, todoBId);
    assert.deepEqual(snapshotB(afterUnrelated), bAfterCreate);
  });

  await check("resolved Risk stays resolved after reload; sibling untouched", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);
    const before = await load(fake);
    const riskA = (before.risks ?? []).find((r) => r.projectId === PROJECT_A_ID);
    const riskB = (before.risks ?? []).find((r) => r.projectId === PROJECT_B_ID);
    assert.ok(riskA);
    assert.ok(riskB);
    assert.equal(riskA?.status, "open");
    const bBefore = snapshotB(before);

    await persistRiskStatus(
      asClient(fake),
      fake.workspaceId,
      PROJECT_A_ID,
      riskA!.id,
      "resolved",
    );

    const after = await load(fake);
    assert.equal(
      (after.risks ?? []).find((r) => r.id === riskA!.id)?.status,
      "resolved",
    );
    assert.equal(
      (after.risks ?? []).find((r) => r.id === riskB!.id)?.status,
      riskB!.status,
    );
    assert.deepEqual(snapshotB(after), bBefore);
  });

  await check("superseded Knowledge item stays superseded after reload", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);
    const knowledgeA = (fake.tables.knowledge_items ?? []).find(
      (row) => row.project_id === PROJECT_A_ID,
    );
    const knowledgeB = (fake.tables.knowledge_items ?? []).find(
      (row) => row.project_id === PROJECT_B_ID,
    );
    assert.ok(knowledgeA);
    assert.ok(knowledgeB);

    await persistKnowledgeLifecycle(
      asClient(fake),
      fake.workspaceId,
      PROJECT_A_ID,
      [String(knowledgeA!.id)],
      "superseded",
    );

    const after = await load(fake);
    const structuredA =
      after.knowledge.find((k) => k.projectId === PROJECT_A_ID)?.structured ?? [];
    const structuredB =
      after.knowledge.find((k) => k.projectId === PROJECT_B_ID)?.structured ?? [];
    assert.equal(
      structuredA.find((row) => row.id === knowledgeA!.id)?.lifecycle,
      "superseded",
    );
    assert.equal(
      structuredB.find((row) => row.id === knowledgeB!.id)?.lifecycle ?? "current",
      "current",
    );
  });

  console.log(`\nverify-resurrection: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
