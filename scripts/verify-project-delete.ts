/**
 * Phase 3A.1 — safe project deletion & regression hygiene.
 * Credential-free. Fake Supabase client for failure injection.
 *
 * Run: npx tsx scripts/verify-project-delete.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CreateProjectInput } from "../src/lib/create-project";
import {
  persistNewProject,
  persistProjectDelete,
  PROJECT_BUNDLE_SET_NULL_TABLES,
} from "../src/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import { shouldWriteDurableMissionCache } from "../src/lib/mission-cache";
import {
  nextHrefAfterProjectDelete,
  removeProjectFromMissionState,
} from "../src/lib/workspace/project-delete";
import type { MissionState } from "../src/lib/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const PROJECT_A_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_B_ID = "22222222-2222-4222-8222-222222222222";
const ORPHAN_TODO_ID = "44444444-4444-4444-8444-444444444444";
const WORKSPACE_TODO_ID = "55555555-5555-4555-8555-555555555555";
const SNAPSHOT_A_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_WORKSPACE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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
    todos: [{ title: `${name} todo` }],
    knowledgeRemember: [{ text: `${name} knowledge`, remember: true }],
    ...overrides,
  };
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as unknown as Parameters<typeof persistNewProject>[0];
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

function injectSetNullOrphans(fake: FakeWorkspaceClient, projectId: string) {
  const extra = {
    workspace_id: fake.workspaceId,
    project_id: projectId,
    created_at: new Date().toISOString(),
  };
  fake.tables.todos.push({
    ...extra,
    id: ORPHAN_TODO_ID,
    title: "A extra todo that would become a workspace orphan",
    done: false,
  });
  fake.tables.memories.push({
    ...extra,
    id: "77777777-7777-4777-8777-777777777777",
    title: "A extra memory",
    content: "only A",
    type: "conversation",
  });
  fake.tables.recommendations.push({
    ...extra,
    id: "88888888-8888-4888-8888-888888888888",
    title: "A extra recommendation",
    status: "active",
  });
  fake.tables.history_events.push({
    ...extra,
    id: "99999999-9999-4999-8999-999999999999",
    type: "other",
    title: "A extra history",
    source: "user",
  });
  fake.tables.capture_sessions.push({
    ...extra,
    id: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    transcript: "A capture only",
  });
  fake.tables.coach_sessions.push({
    ...extra,
    id: "bbbb1111-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    markdown: "A coach only",
  });
  fake.tables.todos.push({
    id: WORKSPACE_TODO_ID,
    workspace_id: fake.workspaceId,
    project_id: null,
    title: "Workspace-level todo must survive",
    done: false,
    created_at: new Date().toISOString(),
  });
  fake.tables.project_intelligence_snapshots.push({
    id: SNAPSHOT_A_ID,
    workspace_id: fake.workspaceId,
    project_id: projectId,
    summary: "A snapshot",
  });
}

function emptyState(): MissionState {
  return {
    projects: [],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [],
    knowledge: [],
    risks: [],
    timeline: [],
    history: [],
  };
}

async function main() {
  await check("Successful delete removes A and keeps B unchanged", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);
    injectSetNullOrphans(fake, PROJECT_A_ID);

    const beforeB = {
      risks: fake.rowsForProject("risks", PROJECT_B_ID).map((r) => r.title),
      todos: fake.rowsForProject("todos", PROJECT_B_ID).map((r) => r.title),
      people: fake.rowsForProject("stakeholders", PROJECT_B_ID).map((r) => r.name),
      milestones: fake.rowsForProject("milestones", PROJECT_B_ID).map((r) => r.label),
      knowledge: fake.rowsForProject("knowledge_items", PROJECT_B_ID).map(
        (r) => r.content ?? r.title,
      ),
    };

    await persistProjectDelete(asClient(fake), fake.workspaceId, PROJECT_A_ID);

    assert.equal(fake.tables.projects.some((p) => p.id === PROJECT_A_ID), false);
    assert.ok(fake.tables.projects.some((p) => p.id === PROJECT_B_ID));

    for (const table of [
      "stakeholders",
      "risks",
      "knowledge_items",
      "milestones",
      "todos",
      "memories",
      "recommendations",
      "history_events",
      "capture_sessions",
      "coach_sessions",
      "project_intelligence_snapshots",
    ]) {
      assert.equal(fake.rowsForProject(table, PROJECT_A_ID).length, 0, table);
    }

    assert.deepEqual(
      fake.rowsForProject("risks", PROJECT_B_ID).map((r) => r.title),
      beforeB.risks,
    );
    assert.deepEqual(
      fake.rowsForProject("todos", PROJECT_B_ID).map((r) => r.title),
      beforeB.todos,
    );
    assert.deepEqual(
      fake.rowsForProject("stakeholders", PROJECT_B_ID).map((r) => r.name),
      beforeB.people,
    );
    assert.deepEqual(
      fake.rowsForProject("milestones", PROJECT_B_ID).map((r) => r.label),
      beforeB.milestones,
    );
    assert.deepEqual(
      fake.rowsForProject("knowledge_items", PROJECT_B_ID).map(
        (r) => r.content ?? r.title,
      ),
      beforeB.knowledge,
    );
  });

  await check("SET NULL children are removed, not merely detached", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);
    injectSetNullOrphans(fake, PROJECT_A_ID);

    await persistProjectDelete(asClient(fake), fake.workspaceId, PROJECT_A_ID);

    for (const table of PROJECT_BUNDLE_SET_NULL_TABLES) {
      const detached = (fake.tables[table] ?? []).filter(
        (row) => row.project_id == null && String(row.id).includes("1111"),
      );
      assert.equal(
        (fake.tables[table] ?? []).some((row) => row.id === ORPHAN_TODO_ID),
        false,
        `${table} must not keep the A-only extra row`,
      );
      assert.equal(detached.length, 0, `${table} must not leave A rows as projectless`);
    }
    assert.equal(
      fake.tables.todos.some((row) => row.id === ORPHAN_TODO_ID),
      false,
    );
    assert.ok(
      fake.tables.todos.some(
        (row) =>
          row.id === WORKSPACE_TODO_ID &&
          row.project_id == null &&
          /Workspace-level/.test(String(row.title)),
      ),
      "workspace-level todo must survive",
    );
  });

  await check("Raw project-row delete would orphan SET NULL rows (why cleanup exists)", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);
    injectSetNullOrphans(fake, PROJECT_A_ID);
    fake.applyProjectDelete([PROJECT_A_ID]);
    assert.ok(
      fake.tables.todos.some(
        (row) => row.id === ORPHAN_TODO_ID && row.project_id == null,
      ),
      "without explicit cleanup the extra A todo would become a workspace orphan",
    );
  });

  await check("Fresh hydrate does not restore deleted project A", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);
    await persistProjectDelete(asClient(fake), fake.workspaceId, PROJECT_A_ID);
    const loaded = await loadMissionStateFromSupabase(asClient(fake));
    assert.equal(
      loaded.state.projects.some((p) => p.id === PROJECT_A_ID),
      false,
    );
    const b = loaded.state.projects.find((p) => p.id === PROJECT_B_ID);
    assert.ok(b);
    assert.equal(b?.name, "Project B");
    assert.ok((loaded.state.risks ?? []).some((r) => r.projectId === PROJECT_B_ID));
    assert.equal(
      (loaded.state.risks ?? []).some((r) => r.projectId === PROJECT_A_ID),
      false,
    );
    assert.ok(loaded.state.todos.some((t) => t.projectId === PROJECT_B_ID));
    assert.ok(loaded.state.knowledge.some((k) => k.projectId === PROJECT_B_ID));
    assert.ok(loaded.state.timeline.some((t) => t.projectId === PROJECT_B_ID));
  });

  await check("Delete failure leaves A intact", async () => {
    const fake = new FakeWorkspaceClient({ failOnDeleteTable: "projects" });
    await seedAB(fake);
    injectSetNullOrphans(fake, PROJECT_A_ID);
    await assert.rejects(() =>
      persistProjectDelete(asClient(fake), fake.workspaceId, PROJECT_A_ID),
    );
    assert.ok(fake.tables.projects.some((p) => p.id === PROJECT_A_ID));
    assert.ok(fake.tables.projects.some((p) => p.id === PROJECT_B_ID));
  });

  await check("SET NULL cleanup failure also refuses to pretend success", async () => {
    const fake = new FakeWorkspaceClient({ failOnDeleteTable: "todos" });
    await seedAB(fake);
    await assert.rejects(() =>
      persistProjectDelete(asClient(fake), fake.workspaceId, PROJECT_A_ID),
    );
    assert.ok(fake.tables.projects.some((p) => p.id === PROJECT_A_ID));
    assert.ok(
      fake.rowsForProject("todos", PROJECT_A_ID).length > 0,
      "must not delete the project after a SET NULL child delete failed",
    );
  });

  await check("Wrong workspace or non-UUID is refused", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);
    await assert.rejects(
      () => persistProjectDelete(asClient(fake), OTHER_WORKSPACE, PROJECT_A_ID),
      /not found in this workspace|expected a UUID/,
    );
    assert.ok(fake.tables.projects.some((p) => p.id === PROJECT_A_ID));
    await assert.rejects(() =>
      persistProjectDelete(asClient(fake), fake.workspaceId, "not-a-uuid"),
    );
    await assert.rejects(() =>
      persistProjectDelete(asClient(fake), fake.workspaceId, "Project A"),
    );
  });

  await check("Clone of A survives deleting A", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);
    const b = fake.tables.projects.find((p) => p.id === PROJECT_B_ID);
    assert.ok(b);
    b!.cloned_from_id = PROJECT_A_ID;
    await persistProjectDelete(asClient(fake), fake.workspaceId, PROJECT_A_ID);
    const remaining = fake.tables.projects.find((p) => p.id === PROJECT_B_ID);
    assert.ok(remaining);
    assert.equal(remaining!.cloned_from_id, null);
  });

  await check("Selected-project navigation reuses Home's first-remaining rule", () => {
    assert.equal(
      nextHrefAfterProjectDelete([PROJECT_B_ID]),
      `/projects/${PROJECT_B_ID}`,
    );
    assert.equal(nextHrefAfterProjectDelete([]), "/");
    const state = emptyState();
    state.projects = [
      {
        id: PROJECT_A_ID,
        name: "A",
        code: "A",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      },
      {
        id: PROJECT_B_ID,
        name: "B",
        code: "B",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      },
    ];
    state.todos = [
      {
        id: "t1",
        projectId: PROJECT_A_ID,
        title: "A todo",
        done: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        kind: "ACTION",
      },
      {
        id: "t2",
        projectId: PROJECT_B_ID,
        title: "B todo",
        done: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        kind: "ACTION",
      },
    ];
    const next = removeProjectFromMissionState(state, PROJECT_A_ID);
    assert.equal(next.projects.some((p) => p.id === PROJECT_A_ID), false);
    assert.ok(next.projects.some((p) => p.id === PROJECT_B_ID));
    assert.equal(next.todos.some((t) => t.projectId === PROJECT_A_ID), false);
    assert.ok(next.todos.some((t) => t.projectId === PROJECT_B_ID));
    assert.equal(nextHrefAfterProjectDelete(next.projects.map((p) => p.id)), `/projects/${PROJECT_B_ID}`);
  });

  await check("One server delete path; persist-first; visible failure", () => {
    const store = readSrc("src/lib/store.tsx");
    const deleteFn = store.slice(store.indexOf("const deleteProject = useCallback"));
    const deleteBody = deleteFn.slice(0, deleteFn.indexOf("const cloneRelOps"));
    assert.match(deleteBody, /method:\s*"DELETE"/);
    assert.match(deleteBody, /\/api\/workspace\/projects\//);
    assert.doesNotMatch(deleteBody, /persistProjectDelete\(/);
    assert.doesNotMatch(deleteBody, /repositories\.projects\.delete/);
    assert.match(deleteBody, /applyDurableWorkspace/);
    assert.match(deleteBody, /reportPersistFailure/);
    assert.match(deleteBody, /Could not delete this project/);
    assert.match(store, /deleteProjectInFlightRef/);
    const supabaseSlice = deleteBody.slice(
      deleteBody.indexOf('if (meta.mode === "supabase")'),
    );
    const localSliceStart = supabaseSlice.indexOf("if (process.env.NODE_ENV === \"production\")");
    const supabasePath = supabaseSlice.slice(0, localSliceStart);
    assert.doesNotMatch(
      supabasePath,
      /removeProjectFromMissionState/,
      "must not optimistic-delete MissionState before server success",
    );
    assert.match(
      supabasePath,
      /pruneBrowserResidueForDeletedProject/,
    );
    const catchSlice = deleteBody.slice(deleteBody.indexOf("} catch"));
    assert.doesNotMatch(
      catchSlice,
      /pruneBrowserResidueForDeletedProject/,
      "must not prune browser residue after a failed delete",
    );

    const route = readSrc("src/app/api/workspace/projects/[id]/route.ts");
    assert.match(route, /export async function DELETE/);
    assert.match(route, /persistProjectDelete/);
    assert.match(route, /ensurePersonalWorkspace/);
    assert.match(route, /loadMissionStateFromSupabase/);
    assert.doesNotMatch(route, /body\.name|projectName/);

    const persist = readSrc("src/lib/data/supabase/persist-mutations.ts");
    assert.match(persist, /export async function persistProjectDelete/);
    assert.match(persist, /not found in this workspace/);
    for (const table of PROJECT_BUNDLE_SET_NULL_TABLES) {
      assert.match(persist, new RegExp(`"${table}"`));
    }

    const ui = readSrc("src/components/knowledge-centre/DeleteProjectButton.tsx");
    assert.match(ui, /DetailModal/);
    assert.match(ui, /Delete project/);
    assert.match(ui, /permanently/);
    assert.match(ui, /Cancel/);
    assert.match(ui, /danger-btn/);
    assert.match(ui, /project\.name/);
    assert.doesNotMatch(ui, /✦|ocean-ai-glyph/);
    const workspace = readSrc(
      "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
    );
    assert.match(workspace, /DeleteProjectButton/);

    assert.equal(
      shouldWriteDurableMissionCache({
        reason: "hydrate",
        persistenceMode: "supabase",
        workspaceId: OTHER_WORKSPACE,
        userId: PROJECT_B_ID,
      }),
      true,
    );
  });

  await check("History for the deleted project is removed with the bundle", async () => {
    const fake = new FakeWorkspaceClient();
    await seedAB(fake);
    injectSetNullOrphans(fake, PROJECT_A_ID);
    const bHistoryBefore = fake.rowsForProject("history_events", PROJECT_B_ID).length;
    await persistProjectDelete(asClient(fake), fake.workspaceId, PROJECT_A_ID);
    assert.equal(fake.rowsForProject("history_events", PROJECT_A_ID).length, 0);
    assert.equal(
      fake.rowsForProject("history_events", PROJECT_B_ID).length,
      bHistoryBefore,
    );
  });

  console.log(`\n${passed} project-delete checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
