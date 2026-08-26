/**
 * D-035 — project-domain mutation isolation.
 *
 * Credential-free. Fake Supabase client (no production data).
 * Proves whether UPDATE/DELETE helpers accept a foreign project object UUID.
 *
 * Run: npx tsx scripts/verify-d035-project-isolation.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planCaptureApply } from "../src/lib/capture/apply/dispatch";
import type { CaptureApplyWorld } from "../src/lib/capture/apply/types";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import { applyKnowledgeReconcilePlan } from "../src/lib/data/supabase/reconcile-knowledge";
import {
  persistEnsureStakeholder,
  persistKnowledgeLifecycle,
  persistProjectDelete,
  persistRiskStatus,
  persistTimelineUpdate,
  persistTodoDelete,
  persistTodoUpdate,
} from "../src/lib/data/supabase/persist-mutations";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const TODO_A = "aaaa1111-1111-4111-8111-aaaaaaaaaaaa";
const TODO_B = "bbbb2222-2222-4222-8222-bbbbbbbbbbbb";
const RISK_A = "aa111111-1111-4111-8111-aaaaaaaaaaaa";
const RISK_B = "bb222222-2222-4222-8222-bbbbbbbbbbbb";
const MILESTONE_A = "aa333333-3333-4333-8333-aaaaaaaaaaaa";
const MILESTONE_B = "bb333333-3333-4333-8333-bbbbbbbbbbbb";
const KNOW_A = "aa444444-4444-4444-8444-aaaaaaaaaaaa";
const KNOW_B = "bb444444-4444-4444-8444-bbbbbbbbbbbb";
const PERSON_A = "aa555555-5555-4555-8555-aaaaaaaaaaaa";
const PERSON_B = "bb555555-5555-4555-8555-bbbbbbbbbbbb";

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
  );
  fake.tables.risks.push(
    {
      id: RISK_A,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_A,
      title: "A risk",
      status: "open",
      source: "manual",
    },
    {
      id: RISK_B,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_B,
      title: "B risk",
      status: "open",
      source: "manual",
    },
  );
  fake.tables.milestones.push(
    {
      id: MILESTONE_A,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_A,
      label: "A date",
      type: "milestone",
      start_on: "2026-10-01",
      source: "manual",
    },
    {
      id: MILESTONE_B,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_B,
      label: "B date",
      type: "milestone",
      start_on: "2026-11-01",
      source: "manual",
    },
  );
  fake.tables.knowledge_items.push(
    {
      id: KNOW_A,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_A,
      section: "people",
      body: "A owner",
      lifecycle: "current",
    },
    {
      id: KNOW_B,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_B,
      section: "people",
      body: "B owner",
      lifecycle: "current",
    },
  );
  fake.tables.stakeholders.push(
    {
      id: PERSON_A,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_A,
      name: "Ada A",
      role: "Sponsor",
    },
    {
      id: PERSON_B,
      workspace_id: fake.workspaceId,
      project_id: PROJECT_B,
      name: "Brick B",
      role: "Sponsor",
    },
  );
}

function todoB(fake: FakeWorkspaceClient) {
  return fake.tables.todos.find((row) => row.id === TODO_B);
}

function riskB(fake: FakeWorkspaceClient) {
  return fake.tables.risks.find((row) => row.id === RISK_B);
}

function milestoneB(fake: FakeWorkspaceClient) {
  return fake.tables.milestones.find((row) => row.id === MILESTONE_B);
}

function knowledgeB(fake: FakeWorkspaceClient) {
  return fake.tables.knowledge_items.find((row) => row.id === KNOW_B);
}

function personB(fake: FakeWorkspaceClient) {
  return fake.tables.stakeholders.find((row) => row.id === PERSON_B);
}

function captureWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT_A, PROJECT_B]),
    projects: [
      {
        id: PROJECT_A,
        name: "Project A",
        code: "PA",
        stakeholders: [{ id: PERSON_A, name: "Ada A", role: "Sponsor" }],
      },
      {
        id: PROJECT_B,
        name: "Project B",
        code: "PB",
        stakeholders: [{ id: PERSON_B, name: "Brick B", role: "Sponsor" }],
      },
    ],
    risks: [
      { id: RISK_A, projectId: PROJECT_A, title: "A risk", status: "open" },
      { id: RISK_B, projectId: PROJECT_B, title: "B risk", status: "open" },
    ],
    todos: [
      { id: TODO_A, projectId: PROJECT_A, title: "A todo", done: false },
      { id: TODO_B, projectId: PROJECT_B, title: "B todo", done: false },
    ],
    timeline: [
      {
        id: MILESTONE_A,
        projectId: PROJECT_A,
        label: "A date",
        startAt: "2026-10-01T12:00:00.000Z",
      },
      {
        id: MILESTONE_B,
        projectId: PROJECT_B,
        label: "B date",
        startAt: "2026-11-01T12:00:00.000Z",
      },
    ],
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
  const repoSrc = readSrc("src/lib/data/supabase/repositories.ts");
  const storeSrc = readSrc("src/lib/store.tsx");
  const persistExecuteSrc = readSrc("src/lib/capture/apply/persist-execute.ts");
  const rlsSrc = readSrc("supabase/migrations/20260812002749_tenant_rls.sql");

  await check("persistTodoUpdate WHERE is id-only (no project/workspace)", () => {
    const fn = extractFn(persistSrc, "persistTodoUpdate");
    assert.match(fn, /\.eq\("id", todoId\)/);
    assert.doesNotMatch(fn, /\.eq\("project_id"/);
    assert.doesNotMatch(fn, /\.eq\("workspace_id"/);
  });

  await check("persistTodoDelete WHERE is id-only (no project/workspace)", () => {
    const fn = extractFn(persistSrc, "persistTodoDelete");
    assert.match(fn, /\.eq\("id", todoId\)/);
    assert.doesNotMatch(fn, /\.eq\("project_id"/);
    assert.doesNotMatch(fn, /\.eq\("workspace_id"/);
  });

  await check("store To Do mutations call id-only persist helpers", () => {
    assert.match(storeSrc, /await persistTodoUpdate\(client, todoId/);
    assert.match(storeSrc, /await persistTodoDelete\(client, todoId\)/);
    assert.doesNotMatch(
      storeSrc,
      /persistTodoUpdate\(client,\s*todoId,\s*\{[^}]*\},\s*(meta\.)?workspaceId/,
    );
  });

  await check("Capture persist-execute To Do hooks still call id-only helpers", () => {
    assert.match(persistExecuteSrc, /await persistTodoUpdate\(client, op\.todoId/);
    assert.match(persistExecuteSrc, /await persistTodoDelete\(client, op\.todoId\)/);
  });

  await check("RLS todo UPDATE/DELETE is workspace membership, not project_id", () => {
    assert.match(rlsSrc, /create policy todos_update_member/);
    assert.match(rlsSrc, /create policy todos_delete_member/);
    const update = rlsSrc.slice(
      rlsSrc.indexOf("create policy todos_update_member"),
      rlsSrc.indexOf("create policy todos_delete_member"),
    );
    const del = rlsSrc.slice(
      rlsSrc.indexOf("create policy todos_delete_member"),
      rlsSrc.indexOf("create policy risks_select_member"),
    );
    assert.match(update, /is_workspace_member\(workspace_id\)/);
    assert.doesNotMatch(update, /project_id = /);
    assert.match(del, /is_workspace_member\(workspace_id\)/);
    assert.doesNotMatch(del, /project_id/);
  });

  await check(
    "HOLE: persistTodoUpdate(Project B id) mutates B from Project A context",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await persistTodoUpdate(asClient(fake), TODO_B, {
        title: "Hacked from A",
        done: true,
      });
      const row = todoB(fake);
      assert.equal(row?.title, "Hacked from A");
      assert.equal(row?.done, true);
      assert.equal(row?.project_id, PROJECT_B);
      const a = fake.tables.todos.find((r) => r.id === TODO_A);
      assert.equal(a?.title, "A todo");
      assert.equal(a?.done, false);
    },
  );

  await check(
    "HOLE: persistTodoUpdate can reassign Project B todo onto Project A",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await persistTodoUpdate(asClient(fake), TODO_B, {
        projectId: PROJECT_A,
      });
      const row = todoB(fake);
      assert.equal(row?.project_id, PROJECT_A);
    },
  );

  await check(
    "HOLE: persistTodoDelete(Project B id) deletes B from Project A context",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await persistTodoDelete(asClient(fake), TODO_B);
      assert.equal(todoB(fake), undefined);
      assert.ok(fake.tables.todos.some((r) => r.id === TODO_A));
    },
  );

  await check("persistRiskStatus WHERE includes project + workspace", () => {
    const fn = extractFn(persistSrc, "persistRiskStatus");
    assert.match(fn, /\.eq\("id", riskId\)/);
    assert.match(fn, /\.eq\("project_id", projectId\)/);
    assert.match(fn, /\.eq\("workspace_id", workspaceId\)/);
  });

  await check(
    "SAFE: persistRiskStatus(Project A, Risk B id) leaves B unchanged",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await persistRiskStatus(
        asClient(fake),
        fake.workspaceId,
        PROJECT_A,
        RISK_B,
        "resolved",
      );
      assert.equal(riskB(fake)?.status, "open");
      assert.equal(
        fake.tables.risks.find((r) => r.id === RISK_A)?.status,
        "open",
      );
    },
  );

  await check("persistTimelineUpdate WHERE includes project + workspace", () => {
    const fn = extractFn(persistSrc, "persistTimelineUpdate");
    assert.match(fn, /\.eq\("id", scopedMilestoneId\)/);
    assert.match(fn, /\.eq\("project_id", scopedProjectId\)/);
    assert.match(fn, /\.eq\("workspace_id", workspaceId\)/);
  });

  await check(
    "SAFE: persistTimelineUpdate(Project A, milestone B) fails and leaves B unchanged",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await assert.rejects(
        () =>
          persistTimelineUpdate(
            asClient(fake),
            fake.workspaceId,
            PROJECT_A,
            MILESTONE_B,
            { label: "Hacked date" },
          ),
        /update milestone/,
      );
      assert.equal(milestoneB(fake)?.label, "B date");
    },
  );

  await check(
    "SAFE: persistKnowledgeLifecycle(Project A, item B) leaves B current",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await persistKnowledgeLifecycle(
        asClient(fake),
        fake.workspaceId,
        PROJECT_A,
        [KNOW_B],
        "superseded",
      );
      assert.equal(knowledgeB(fake)?.lifecycle, "current");
    },
  );

  await check(
    "SAFE: knowledge reconcile delete of B ids scoped to Project A leaves B",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await applyKnowledgeReconcilePlan(
        asClient(fake),
        fake.workspaceId,
        PROJECT_A,
        {
          projectId: PROJECT_A,
          sections: ["people"],
          updates: [],
          inserts: [],
          deleteIds: [KNOW_B],
        },
        fake.userId,
      );
      assert.ok(knowledgeB(fake), "Project B knowledge row must remain");
      assert.ok(
        fake.tables.knowledge_items.some((r) => r.id === KNOW_A),
        "Project A knowledge row must remain (not in delete plan)",
      );
    },
  );

  await check(
    "SAFE: persistEnsureStakeholder with B person id on Project A does not mutate B",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await assert.rejects(
        () =>
          persistEnsureStakeholder(
            asClient(fake),
            fake.workspaceId,
            PROJECT_A,
            { id: PERSON_B, name: "Stolen Brick", role: "Raider" },
          ),
        /duplicate key|create stakeholder/,
      );
      assert.equal(personB(fake)?.name, "Brick B");
      assert.equal(personB(fake)?.project_id, PROJECT_B);
    },
  );

  await check(
    "SAFE: persistProjectDelete(A) leaves Project B rows intact",
    async () => {
      const fake = new FakeWorkspaceClient();
      seedAB(fake);
      await persistProjectDelete(asClient(fake), fake.workspaceId, PROJECT_A);
      assert.equal(todoB(fake)?.title, "B todo");
      assert.equal(riskB(fake)?.title, "B risk");
      assert.equal(milestoneB(fake)?.label, "B date");
      assert.equal(personB(fake)?.name, "Brick B");
      assert.ok(fake.tables.projects.some((p) => p.id === PROJECT_B));
      assert.equal(
        fake.tables.projects.some((p) => p.id === PROJECT_A),
        false,
      );
    },
  );

  await check(
    "Capture planner rejects completing Project B todo while applying on A",
    () => {
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
    },
  );

  await check("dead repositories.ts mutations remain id-only (not a live path)", () => {
    assert.match(repoSrc, /\.from\("todos"\)\.delete\(\)\.eq\("id", todoId\)/);
    assert.match(repoSrc, /\.from\("risks"\)[\s\S]*?\.eq\("id", riskId\)/);
    assert.match(
      repoSrc,
      /Production deletion goes through persistProjectDelete only/,
    );
  });

  console.log(`\nD-035 project isolation: ${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
