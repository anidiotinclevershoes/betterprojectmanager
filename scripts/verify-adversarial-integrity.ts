/**
 * Adversarial integrity probes — read-only / in-memory by default.
 * Closed dogfood defects (A-001/002/004/005/008, N-05/06/07) are inverted
 * to regressions. Remaining probes still document open gaps.
 * SQL probes printed at the end are operator-only and do not mutate.
 *
 * Run: npm run verify:adversarial-integrity
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { assessApplyReadiness } from "../src/lib/capture/apply/readiness";
import {
  fingerprintExpectedTarget,
  staleExpectedTargetReason,
} from "../src/lib/capture/apply/expected-target";
import { memoryCaptureApplyHooks } from "../src/lib/capture/apply/memory-execute";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { emptyKnowledge } from "../src/lib/knowledge";
import { createSeedState } from "../src/lib/seed";
import type { MissionState } from "../src/lib/types";
import type { PendingSuggestion as Suggestion } from "../src/lib/capture/suggestions";

const ROOT = join(import.meta.dirname, "..");
const ATLAS = "proj-atlas";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`✓ ${name}`);
    });
}

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export type IntegrityHit = {
  code: string;
  projectId?: string;
  detail: string;
};

/** Read-only scan of in-memory / hydrated project truth. */
export function scanMissionIntegrity(state: MissionState): IntegrityHit[] {
  const hits: IntegrityHit[] = [];
  const projectIds = new Set(state.projects.map((p) => p.id));
  const personIds = new Set(
    state.projects.flatMap((p) => p.stakeholders.map((s) => s.id)),
  );

  for (const todo of state.todos ?? []) {
    if (todo.projectId && !projectIds.has(todo.projectId)) {
      hits.push({
        code: "orphan-todo-project",
        projectId: todo.projectId,
        detail: `todo ${todo.id} names missing project`,
      });
    }
  }
  for (const risk of state.risks ?? []) {
    if (!projectIds.has(risk.projectId)) {
      hits.push({
        code: "orphan-risk-project",
        projectId: risk.projectId,
        detail: `risk ${risk.id} names missing project`,
      });
    }
  }
  for (const row of state.timeline ?? []) {
    if (!projectIds.has(row.projectId)) {
      hits.push({
        code: "orphan-timeline-project",
        projectId: row.projectId,
        detail: `timeline ${row.id} names missing project`,
      });
    }
    if (!row.startAt || Number.isNaN(Date.parse(row.startAt))) {
      hits.push({
        code: "malformed-timeline-date",
        projectId: row.projectId,
        detail: `timeline ${row.id} has unusable startAt`,
      });
    }
  }
  for (const meeting of state.meetings ?? []) {
    if (!projectIds.has(meeting.projectId)) {
      hits.push({
        code: "orphan-meeting-project",
        projectId: meeting.projectId,
        detail: `meeting ${meeting.id} names missing project`,
      });
    }
  }
  for (const project of state.projects) {
    const names = project.stakeholders.map((s) => s.name.trim().toLowerCase());
    const dup = names.filter((n, i) => n && names.indexOf(n) !== i);
    if (dup.length) {
      hits.push({
        code: "duplicate-person-name",
        projectId: project.id,
        detail: `duplicate stakeholder names: ${[...new Set(dup)].join(", ")}`,
      });
    }
  }
  for (const knowledge of state.knowledge ?? []) {
    for (const item of knowledge.structured ?? []) {
      if (item.kind !== "responsibility" || item.lifecycle !== "current") continue;
      const personId =
        typeof item.meta?.responsibility?.personId === "string"
          ? item.meta.responsibility.personId
          : typeof item.meta?.personId === "string"
            ? item.meta.personId
            : undefined;
      if (personId && !personIds.has(personId)) {
        hits.push({
          code: "responsibility-missing-person",
          projectId: knowledge.projectId,
          detail: `responsibility ${item.id} points at missing person ${personId}`,
        });
      }
    }
  }
  for (const tag of state.itemTags ?? []) {
    if (tag.projectId && !projectIds.has(tag.projectId)) {
      hits.push({
        code: "item-tag-wrong-project",
        projectId: tag.projectId,
        detail: `item tag ${tag.id} names missing project`,
      });
    }
  }
  return hits;
}

function candyState(): MissionState {
  return {
    projects: [
      {
        id: "proj-candy",
        name: "Candy",
        code: "CNDY",
        summary: "",
        status: "healthy",
        currentFocus: "UAT",
        stakeholders: [{ id: "p-elena", name: "Elena", role: "BA" }],
      },
    ],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [
      {
        id: "todo-cab",
        projectId: "proj-candy",
        title: "Obtain CAB approval",
        done: false,
        createdAt: "2026-07-01T10:00:00.000Z",
        dueAt: "2026-07-10T09:00:00.000Z",
        detail: "Owner: Elena",
      },
    ],
    knowledge: [emptyKnowledge("proj-candy")],
    risks: [],
    timeline: [],
  };
}

function updateTodoItem(due?: string): Suggestion {
  return {
    id: "sug-due",
    kind: "action",
    op: "update",
    content: "Move CAB approval to next Friday",
    destination: "project",
    projectId: "proj-candy",
    legalDomain: "todo",
    targetEntityId: "todo-cab",
    targetTodoId: "todo-cab",
    date: due,
  };
}

async function main() {
await check("seed hydrates without integrity violations the scanner can see", () => {
  const hits = scanMissionIntegrity(createSeedState());
  assert.deepEqual(hits, []);
});

await check("scanner detects constructed orphans and impossible relationships", () => {
  const state = clone(createSeedState());
  state.todos.push({
    id: "todo-orphan",
    projectId: "proj-missing",
    title: "Ghost",
    done: false,
    createdAt: new Date().toISOString(),
  });
  state.knowledge[0]!.structured = [
    {
      id: "resp-ghost",
      projectId: ATLAS,
      section: "people",
      body: "CAB · nobody",
      kind: "responsibility",
      epistemic: null,
      lifecycle: "current",
      meta: { responsibility: { personId: "person-does-not-exist", scope: "CAB" } },
    },
  ];
  const codes = scanMissionIntegrity(state).map((h) => h.code);
  assert.ok(codes.includes("orphan-todo-project"));
  assert.ok(codes.includes("responsibility-missing-person"));
});

await check("A-001 Apply reload failure does not return pre-write state after a successful write", async () => {
  const start = candyState();
  const before = JSON.stringify(start.todos);
  const box = { state: clone(start) };
  const item = {
    id: "sug-create",
    kind: "action" as const,
    op: "create" as const,
    content: "Book the war room",
    destination: "project",
    projectId: "proj-candy",
    legalDomain: "todo" as const,
  };
  const result = await applyApprovedCaptureSuggestion({
    item,
    text: "Book the war room",
    projectId: "proj-candy",
    loadWorkspace: async () => ({
      workspaceId: "ws-1",
      userId: "user-1",
      state: start,
    }),
    hooks: {
      ...memoryCaptureApplyHooks(box),
    },
    reloadWorkspace: async () => {
      throw new Error("simulated reload failure after commit");
    },
  });
  assert.equal(result.executed.kind, "wrote");
  assert.equal(result.reconcileFailed, true);
  assert.equal(result.state, undefined);
  assert.notEqual(
    JSON.stringify(box.state.todos),
    before,
    "the write itself landed in the hook-backed store",
  );
  assert.ok(
    box.state.todos.some((t) => /war room/i.test(t.title)),
    "the write itself landed in the hook-backed store",
  );
  const src = readSrc("src/lib/capture/apply/apply-approved.ts");
  assert.match(src, /reload after write failed/);
  assert.match(src, /reconcileFailed: true/);
});

await check("A-002 concurrent dueAt/detail change stales Ready; Apply fails closed", async () => {
  const start = candyState();
  const item = updateTodoItem("2026-07-17T09:00:00.000Z");
  const world = captureApplyWorldFromState(start);
  const fingerprinted = {
    ...item,
    expectedTarget: fingerprintExpectedTarget(world, item),
  };
  const mutated = clone(start);
  mutated.todos[0]!.dueAt = "2026-07-12T09:00:00.000Z";
  mutated.todos[0]!.detail = "Owner: Jordan — changed in another tab";
  const laterWorld = captureApplyWorldFromState(mutated);
  assert.ok(
    staleExpectedTargetReason(laterWorld, fingerprinted.expectedTarget, "proj-candy"),
  );
  const ready = assessApplyReadiness({
    item: fingerprinted,
    text: "Move CAB approval to next Friday",
    preflight: { world: laterWorld, captureEntryProjectId: "proj-candy" },
  });
  assert.equal(ready.canApprove, false);
  assert.ok("dueAt" in (laterWorld.todos[0] ?? {}));

  const box = { state: clone(mutated) };
  const applied = await applyApprovedCaptureSuggestion({
    item: fingerprinted,
    text: "Move CAB approval to next Friday",
    projectId: "proj-candy",
    expectedTarget: fingerprinted.expectedTarget,
    loadWorkspace: async () => ({
      workspaceId: "ws-1",
      userId: "user-1",
      state: mutated,
    }),
    hooks: memoryCaptureApplyHooks(box),
  });
  assert.equal(applied.executed.kind, "needs_you");
  assert.equal(box.state.todos[0]?.dueAt, "2026-07-12T09:00:00.000Z");
});

await check("A-003 New Project create and project delete are one DB transaction each", () => {
  const persist = readSrc("src/lib/data/supabase/persist-mutations.ts");
  const createFn = persist.slice(persist.indexOf("export async function persistNewProject"));
  const createBody = createFn.slice(
    0,
    createFn.indexOf("export async function persistTodoCreate"),
  );
  assert.match(createBody, /rpc\("create_project_bundle"/);
  assert.doesNotMatch(createBody, /\.from\("projects"\)\s*\.insert/);
  assert.doesNotMatch(createBody, /\.from\("stakeholders"\)\s*\.insert/);
  assert.doesNotMatch(createBody, /\.from\("todos"\)\s*\.insert/);
  assert.match(persist, /rpc\("delete_project_bundle"/);
  const deleteSql = readSrc(
    "supabase/migrations/20260909160000_external_v1_safety.sql",
  );
  const createSql = readSrc(
    "supabase/migrations/20260909210000_create_project_bundle.sql",
  );
  assert.match(deleteSql, /create or replace function public.delete_project_bundle/);
  assert.match(createSql, /create or replace function public.create_project_bundle/);
});

await check("A-004 Apply world and fingerprint include fields Apply writes", () => {
  const worldSrc = readSrc("src/lib/capture/apply/world.ts");
  assert.match(worldSrc, /dueAt: t\.dueAt/);
  assert.match(worldSrc, /detail: t\.detail/);
  assert.match(worldSrc, /endAt: t\.endAt/);
  const fp = readSrc("src/lib/capture/apply/expected-target.ts");
  assert.match(fp, /dueAt: asField\(todo\.dueAt\)/);
  assert.match(fp, /detail: asField\(todo\.detail\)/);
  assert.match(fp, /replacePersonId/);
});

await check("A-005 knowledge write and availability write use apply receipts", () => {
  const exec = readSrc("src/lib/capture/apply/persist-execute.ts");
  const knowledgeFn = exec.slice(
    exec.indexOf("writeKnowledge:"),
    exec.indexOf("findApplyReceipt:"),
  );
  const availabilityFn = exec.slice(
    exec.indexOf("writeAvailability:"),
    exec.indexOf("writeKnowledge:"),
  );
  assert.match(knowledgeFn, /persistFindCaptureApplyReceipt/);
  assert.match(knowledgeFn, /entityType: "knowledge"/);
  assert.match(availabilityFn, /persistFindCaptureApplyReceipt/);
  assert.match(availabilityFn, /entityType: "availability"/);
});

await check("A-006 todos.project_id is nullable SET NULL — orphans are representable in DB", () => {
  const schema = readSrc("supabase/migrations/20260812002748_workspace_schema.sql");
  assert.match(schema, /project_id uuid references public\.projects \(id\) on delete set null/);
  assert.match(schema, /create table public.todos/);
});

await check("A-007 no unique constraint on stakeholder name, todo title, or risk title", () => {
  const schema = readSrc("supabase/migrations/20260812002748_workspace_schema.sql");
  assert.doesNotMatch(schema, /unique \(project_id, name\)/);
  assert.doesNotMatch(schema, /todos[\s\S]{0,400}unique \(project_id, title\)/);
  assert.doesNotMatch(schema, /risks[\s\S]{0,400}unique \(project_id, title\)/);
});

await check("A-008 Capture session binds to the open project and refuses cross-project Apply", () => {
  const ctx = readSrc("src/components/capture/CaptureSessionContext.tsx");
  const ws = readSrc("src/components/capture/CaptureWorkspace.tsx");
  const keys = readSrc("src/lib/capture/suggestions.ts");
  assert.match(keys, /captureSessionStorageKey/);
  assert.match(keys, /captureSessionProjectMismatch/);
  assert.match(ctx, /bindOpenProject/);
  assert.match(ws, /bindOpenProject\(defaultProjectId\)/);
});

await check("A-009 meeting-scoped Catch Me Up and Capture context still isolate stored prep", () => {
  const cmu = readSrc("src/lib/knowledge-centre/meeting-catch-up.ts");
  const ctx = readSrc("src/lib/capture/context.ts");
  assert.match(cmu, /Does not use stored generic Meeting.prep/);
  assert.doesNotMatch(ctx, /m\.prep\.openingScript/);
});

await check("A-010 production Timeline / meetings routes stay disconnected from leftover writes", () => {
  const frame = readSrc("src/components/frames/TimelineFrame.tsx");
  const meetings = readSrc("src/app/meetings/page.tsx");
  const detail = readSrc("src/app/meetings/[id]/page.tsx");
  assert.doesNotMatch(frame, /from \"@\/components\/ProjectTimelineGantt\"/);
  assert.match(meetings, /redirect\("\/"\)/);
  assert.doesNotMatch(detail, /meeting\.prep/);
});

await check("N-01 Capture V2 is hard-wired; env flag cannot revive the deleted findings path", () => {
  const flag = readSrc("src/lib/capture-v2/flag.ts");
  assert.match(flag, /return true/);
  assert.match(flag, /LUME_CAPTURE_V2` is ignored/);
});

await check("N-02 persistTodoUpdate/Delete now require workspace + project + id (stale D-035 instance)", () => {
  const persist = readSrc("src/lib/data/supabase/persist-mutations.ts");
  assert.match(persist, /function scopeExistingTodo/);
  assert.match(persist, /not found in this project/);
  const updateBlock = persist.slice(persist.indexOf("export async function persistTodoUpdate"));
  assert.match(updateBlock.slice(0, 1600), /scopeExistingTodo/);
});

await check("N-03 hydrate keeps complete knowledge section lists aligned with structured", () => {
  const hydrate = readSrc("src/lib/data/supabase/load-mission-state.ts");
  const fold = hydrate.slice(hydrate.indexOf("for (const row of knowledgeRes.data"));
  const foldFn = fold.slice(0, fold.indexOf("const risks:"));
  assert.doesNotMatch(foldFn, /\.slice\(\s*0\s*,\s*24\s*\)/);
  assert.match(hydrate, /current\.structured = \[/);
});

await check("N-04 analysesThisMonth is always 0 on hydrate — meter is not durable", () => {
  const hydrate = readSrc("src/lib/data/supabase/load-mission-state.ts");
  assert.match(hydrate, /analysesThisMonth: 0/);
});

await check("N-05 planKnowledge / writeKnowledge carry applyOperationId (retry is receipted)", () => {
  const dispatch = readSrc("src/lib/capture/apply/dispatch.ts");
  const plan = dispatch.slice(dispatch.indexOf("function planKnowledge"));
  assert.match(plan.slice(0, 900), /applyOperationId/);
  const exec = readSrc("src/lib/capture/apply/persist-execute.ts");
  const writeK = exec.slice(
    exec.indexOf("writeKnowledge:"),
    exec.indexOf("findApplyReceipt:"),
  );
  assert.match(writeK, /persistFindCaptureApplyReceipt/);
  const memory = readSrc("src/lib/capture/apply/memory-execute.ts");
  assert.match(memory, /case "write_knowledge":/);
  assert.doesNotMatch(
    memory,
    /case "write_knowledge":\s*\n\s*case "write_memory":\s*\n\s*return state;/,
  );
});

await check("N-06 Capture session key is project-scoped; switch parks the prior review", () => {
  const ctx = readSrc("src/components/capture/CaptureSessionContext.tsx");
  const keys = readSrc("src/lib/capture/suggestions.ts");
  assert.match(keys, /CAPTURE_SESSION_KEY = "lume-capture-session-v1"/);
  assert.match(keys, /\$\{CAPTURE_SESSION_KEY\}:\$\{id\}/);
  assert.match(ctx, /bindOpenProject/);
  assert.match(ctx, /captureSessionProjectMismatch/);
});

await check("N-07 replacePersonId and owner set are part of the expected-target fingerprint", () => {
  const fp = readSrc("src/lib/capture/apply/expected-target.ts");
  assert.match(fp, /replacePersonId/);
  assert.match(fp, /ownerIds/);
  const apply = readSrc("src/lib/capture/apply/apply-approved.ts");
  assert.doesNotMatch(apply, /bindResolvedReplacement/);
});

await check("N-08 todo persist helpers never write source_recommendation_id", () => {
  const persist = readSrc("src/lib/data/supabase/persist-mutations.ts");
  assert.doesNotMatch(persist, /source_recommendation/);
});

await check("N-09 recommendations / history_events / capture_sessions require project in workspace", () => {
  const sql = readSrc("supabase/migrations/20260909160000_external_v1_safety.sql");
  assert.match(sql, /recommendations_insert_member/);
  assert.match(sql, /history_events_insert_member/);
  assert.match(sql, /capture_sessions_insert_member/);
  assert.match(sql, /project_belongs_to_workspace/);
});

await check("N-10 adoptAppliedState does not refresh the durable paint cache", () => {
  const store = readSrc("src/lib/store.tsx");
  const adopt = store.slice(store.indexOf("const adoptAppliedState"));
  assert.match(adopt.slice(0, 200), /setState\(normaliseState\(next\)\)/);
  assert.doesNotMatch(adopt.slice(0, 200), /writeMissionSupabaseCache/);
});

await check("N-11 memory-only updateMeeting / acceptSuggestion are not mounted on current pages", () => {
  const widget = readSrc("src/components/ProjectWidgetGrid.tsx");
  assert.match(widget, /acceptSuggestion/);
  const pages = readSrc("src/app/page.tsx") + readSrc("src/components/frames/TimelineFrame.tsx");
  assert.doesNotMatch(pages, /ProjectWidgetGrid/);
  assert.doesNotMatch(pages, /updateMeeting\(/);
});

await check("N-12 Apply API does not require a Review attestation — planner is the gate", () => {
  const route = readSrc("src/app/api/capture/apply/route.ts");
  assert.match(route, /applyApprovedCaptureSuggestion/);
  assert.doesNotMatch(route, /readiness === ["']ready["']/);
  const apply = readSrc("src/lib/capture/apply/apply-approved.ts");
  assert.doesNotMatch(apply, /writeRepresentsProposal/);
});

await check("N-13 knowledge_items.supersedes_id is a global FK — cross-project pointer is representable", () => {
  const meta = readSrc("supabase/migrations/20260818230000_knowledge_canonical_metadata.sql");
  assert.match(meta, /supersedes_id uuid references public\.knowledge_items \(id\)/);
  assert.doesNotMatch(meta, /supersedes_id[\s\S]{0,200}project_id/);
});

console.log(`\n${passed} adversarial integrity probes passed.`);
console.log(`
SQL probes for a live workspace (read-only; do not run as a migration):

-- orphan todos after project delete
select id, project_id, title from todos where project_id is null;

-- stakeholder name collisions inside one project
select project_id, lower(name), count(*) from stakeholders group by 1, 2 having count(*) > 1;

-- responsibility JSON pointing at a missing person
select ki.id, ki.project_id, ki.meta
from knowledge_items ki
where ki.kind = 'responsibility' and coalesce(ki.lifecycle, 'current') = 'current'
  and ki.meta -> 'responsibility' ->> 'personId' is not null
  and not exists (
    select 1 from stakeholders s
    where s.id::text = ki.meta -> 'responsibility' ->> 'personId'
  );

-- apply receipts without a surviving entity
select r.* from capture_apply_receipts r
where r.entity_type = 'todo'
  and not exists (select 1 from todos t where t.id = r.entity_id);
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
