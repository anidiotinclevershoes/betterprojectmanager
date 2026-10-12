/**
 * V1 functional edits: To Do Waiting-on people, Person name/role,
 * targeted History, and the informational analysis count.
 *
 * Run: npm run verify:v1-functional
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { historyEventsForItem } from "../src/lib/knowledge-centre/item-history";
import { resolveKnowledgeItemDetail } from "../src/lib/knowledge-centre/knowledge-item-detail";
import { applyPersonEdit, planPersonEdit } from "../src/lib/people/person-edit";
import { applyTodoEdit, planTodoEdit } from "../src/lib/todos/todo-edit";
import type { MissionState, Stakeholder, TodoItem } from "../src/lib/types";
import {
  adoptAnalysisLedger,
  nextAnalysisCount,
  readAnalysisLedger,
} from "../src/lib/workspace/usage-ledger";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

const PROJECT = "11111111-1111-4111-8111-111111111111";
const OLGA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const SARAH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const TODO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

const people: Stakeholder[] = [
  { id: OLGA, name: "Olga Petrov", role: "UAT lead" },
  { id: SARAH, name: "Sarah Kim", role: "Release manager" },
  { id: "dup-a", name: "Alex Morgan", role: "Supplier liaison" },
  { id: "dup-b", name: "Alex Morgan", role: "Finance partner" },
];

function todo(extra: Partial<TodoItem> = {}): TodoItem {
  return {
    id: TODO,
    projectId: PROJECT,
    title: "Confirm the window",
    done: false,
    createdAt: "2026-09-15T09:00:00.000Z",
    waitingOn: "the supplier desk",
    ...extra,
  };
}

function state(): MissionState {
  const next = emptyMissionState();
  next.projects = [
    {
      id: PROJECT,
      name: "Bridge",
      code: "BRG",
      summary: "",
      status: "healthy",
      currentFocus: "",
      stakeholders: people,
    },
  ];
  next.todos = [todo()];
  next.knowledge = [
    {
      projectId: PROJECT,
      updatedAt: "2026-09-15T09:00:00.000Z",
      sections: {
        now: [],
        decisions: [],
        risks: [],
        people: [],
        openLoops: [],
      },
      structured: [
        {
          id: "resp-1",
          projectId: PROJECT,
          section: "people",
          body: "Olga Petrov — UAT",
          kind: "responsibility",
          epistemic: "confirmed",
          lifecycle: "current",
          meta: {
            responsibility: {
              personId: OLGA,
              personName: "Olga Petrov",
              scope: "UAT",
            },
          },
        },
      ],
    },
  ];
  return next;
}

check("a To Do can wait on two existing people without rewriting the legacy note", () => {
  const before = todo();
  const plan = planTodoEdit(before, people, {
    title: "Confirm the window",
    waitingOn: "the supplier desk",
    waitingOnPersonIds: [SARAH, OLGA, OLGA],
  });
  assert.equal(plan.ok, true);
  if (!plan.ok || !plan.changed) throw new Error("expected a change");
  assert.deepEqual(plan.todo.waitingOnPersonIds, [OLGA, SARAH]);
  assert.equal(plan.todo.waitingOn, "the supplier desk");
  assert.equal(plan.historyTitle, "You updated a To Do");
  assert.match(plan.historyDetail, /Olga Petrov, Sarah Kim/);
  assert.doesNotMatch(plan.historyDetail, /supplier desk →/);
});

check("clearing people does not discard the legacy waiting note", () => {
  const before = todo({ waitingOnPersonIds: [OLGA] });
  const plan = planTodoEdit(before, people, {
    title: before.title,
    waitingOn: before.waitingOn,
    waitingOnPersonIds: [],
  });
  assert.equal(plan.ok, true);
  if (!plan.ok || !plan.changed) throw new Error("expected a change");
  assert.deepEqual(plan.todo.waitingOnPersonIds, []);
  assert.equal(plan.todo.waitingOn, "the supplier desk");
  assert.match(plan.historyDetail, /Waiting on: nobody/);
});

check("an unchanged To Do writes no history", () => {
  const before = todo({ waitingOnPersonIds: [OLGA] });
  const plan = planTodoEdit(before, people, {
    title: "  Confirm the window  ",
    waitingOn: "the supplier desk",
    waitingOnPersonIds: [OLGA],
  });
  assert.equal(plan.ok, true);
  if (!plan.ok || plan.changed) throw new Error("expected no change");
  assert.equal(plan.todo.waitingOn, "the supplier desk");
  assert.deepEqual(plan.todo.waitingOnPersonIds, [OLGA]);
  assert.equal(plan.todo.title, before.title);
});

check("blank title and unknown people are rejected", () => {
  const blank = planTodoEdit(todo(), people, {
    title: "   ",
    waitingOnPersonIds: [],
  });
  assert.equal(blank.ok, false);
  const unknown = planTodoEdit(todo(), people, {
    title: "Confirm the window",
    waitingOnPersonIds: ["missing-person"],
  });
  assert.equal(unknown.ok, false);
});

check("saving a To Do records targeted history and keeps the legacy string", () => {
  const applied = applyTodoEdit(state(), {
    projectId: PROJECT,
    todoId: TODO,
    title: "Confirm the new window",
    detail: null,
    dueAt: null,
    waitingOn: "the supplier desk",
    waitingOnPersonIds: [OLGA, SARAH],
  });
  assert.equal(applied.ok, true);
  if (!applied.ok || !applied.changed) throw new Error("expected a change");
  const saved = applied.state.todos.find((row) => row.id === TODO)!;
  assert.equal(saved.waitingOn, "the supplier desk");
  assert.deepEqual(saved.waitingOnPersonIds, [OLGA, SARAH]);
  const readHistory = historyEventsForItem(applied.state, PROJECT, {
    kind: "todo",
    todoId: TODO,
  });
  assert.equal(readHistory.events.length, 1);
  assert.equal(readHistory.events[0]?.targetKind, "todo");
  assert.equal(readHistory.events[0]?.targetId, TODO);
  assert.equal(readHistory.attributable, true);
  const other = historyEventsForItem(applied.state, PROJECT, {
    kind: "todo",
    todoId: "other-todo",
  });
  assert.equal(other.events.length, 0);
});

check("a string-only legacy note is not turned into person links", () => {
  const seeded = state();
  seeded.todos[0]!.waitingOn = "Olga Petrov · Sarah Kim";
  const detail = resolveKnowledgeItemDetail(seeded, PROJECT, {
    kind: "person",
    personId: OLGA,
  });
  assert.equal(detail?.waitingLines?.length ?? 0, 0);
  const linked = state();
  linked.todos[0]!.waitingOn = "the supplier desk";
  linked.todos[0]!.waitingOnPersonIds = [OLGA, SARAH];
  const olga = resolveKnowledgeItemDetail(linked, PROJECT, {
    kind: "person",
    personId: OLGA,
  });
  const sarah = resolveKnowledgeItemDetail(linked, PROJECT, {
    kind: "person",
    personId: SARAH,
  });
  assert.deepEqual(olga?.waitingLines, ["Confirm the window"]);
  assert.deepEqual(sarah?.waitingLines, ["Confirm the window"]);
  assert.equal(linked.todos[0]!.waitingOn, "the supplier desk");
});

check("renaming onto another person is rejected and the id stays", () => {
  const blocked = planPersonEdit(people, OLGA, {
    name: "Sarah Kim",
    role: "UAT lead",
  });
  assert.equal(blocked.ok, false);
  const same = planPersonEdit(people, "dup-a", {
    name: "Alex Morgan",
    role: "Supplier lead",
  });
  assert.equal(same.ok, true);
  if (!same.ok || !same.changed) throw new Error("role change should save");
  assert.equal(same.person.id, "dup-a");
  assert.equal(same.person.role, "Supplier lead");
});

check("a person edit keeps responsibilities and writes person history", () => {
  const before = state();
  const responsibility = JSON.stringify(before.knowledge[0]?.structured);
  const applied = applyPersonEdit(before, {
    projectId: PROJECT,
    personId: OLGA,
    name: "Olga Petrova",
    role: "UAT director",
  });
  assert.equal(applied.ok, true);
  if (!applied.ok || !applied.changed) throw new Error("expected a change");
  const person = applied.state.projects[0]?.stakeholders.find((row) => row.id === OLGA);
  assert.equal(person?.name, "Olga Petrova");
  assert.equal(person?.id, OLGA);
  assert.equal(JSON.stringify(applied.state.knowledge[0]?.structured), responsibility);
  const readHistory = historyEventsForItem(applied.state, PROJECT, {
    kind: "person",
    personId: OLGA,
  });
  assert.equal(readHistory.events.length, 1);
  assert.equal(readHistory.events[0]?.targetKind, "person");
  const unchanged = applyPersonEdit(applied.state, {
    projectId: PROJECT,
    personId: OLGA,
    name: "Olga Petrova",
    role: "UAT director",
  });
  assert.equal(unchanged.ok, true);
  if (!unchanged.ok) throw new Error("expected ok");
  assert.equal(unchanged.changed, false);
});

check("NULL targets and other items stay unattributed", () => {
  const seeded = state();
  seeded.history = [
    {
      id: "hist-null",
      type: "other",
      title: "You updated a To Do",
      projectId: PROJECT,
      createdAt: "2026-09-16T10:00:00.000Z",
      targetKind: null,
      targetId: null,
    },
    {
      id: "hist-risk",
      type: "other",
      title: "You updated a To Do",
      projectId: PROJECT,
      createdAt: "2026-09-16T10:01:00.000Z",
      targetKind: "risk",
      targetId: TODO,
    },
  ];
  const todoRead = historyEventsForItem(seeded, PROJECT, { kind: "todo", todoId: TODO });
  const personRead = historyEventsForItem(seeded, PROJECT, {
    kind: "person",
    personId: OLGA,
  });
  assert.equal(todoRead.events.length, 0);
  assert.equal(personRead.events.length, 0);
  assert.match(todoRead.notice, /D-004/);
});

check("usage count rolls the month and adopts a server ledger", () => {
  assert.equal(nextAnalysisCount({ used: 4, monthKey: "2026-09" }, "2026-09"), 5);
  assert.equal(nextAnalysisCount({ used: 4, monthKey: "2026-09" }, "2026-10"), 1);
  const adopted = adoptAnalysisLedger(
    { analysesThisMonth: 9, analysesMonthKey: "2026-08" },
    { used: 2, monthKey: "2026-10" },
  );
  assert.equal(adopted.analysesThisMonth, 2);
  assert.equal(adopted.analysesMonthKey, "2026-10");
  assert.equal(readAnalysisLedger({ used: "2", monthKey: "2026-10" }), null);
});

check("migration is additive and does not reinterpret history or waiting notes", () => {
  const sql = read("supabase/migrations/20261012214638_v1_todo_person_history_usage.sql");
  assert.match(sql, /create table if not exists public\.todo_waiting_people/);
  assert.match(sql, /target_kind in \('risk', 'todo', 'person'\)/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /waiting_on = v_waiting/);
  assert.doesNotMatch(sql, /update public\.todos[\s\S]*waiting_on = .*name/i);
  assert.doesNotMatch(sql, /delete from public\.history_events/i);
  assert.doesNotMatch(sql, /insert into public\.todo_waiting_people[\s\S]*waiting_on/i);
  const personFn = sql.slice(sql.indexOf("function public.save_person_identity"));
  assert.doesNotMatch(personFn.slice(0, 2500), /knowledge_items/);
  const load = read("src/lib/data/supabase/load-mission-state.ts");
  assert.match(load, /todo_waiting_people/);
  assert.match(load, /isMissingRelation\(res\.error\)/);
  assert.match(load, /analyses_this_month/);
  const capture = read("src/app/api/capture/route.ts");
  assert.match(capture, /recordWorkspaceAnalysis/);
  const settings = read("src/app/settings/page.tsx");
  assert.match(settings, /not a price, a plan/);
  assert.match(settings, /href="\/account"/);
});

console.log("\nv1 functional checks passed");
