/**
 * Page 09 To Do detail is presentation over one TodoItem.
 * No editor, no multi-person Waiting On, no fabricated history.
 *
 * Run: npm run verify:todo-detail
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import { formatDueLabel } from "../src/lib/knowledge-centre/format-date-label";
import { historyEventsForItem } from "../src/lib/knowledge-centre/item-history";
import {
  refForTodo,
  resolveKnowledgeItemDetail,
} from "../src/lib/knowledge-centre/knowledge-item-detail";
import { tagsForItem } from "../src/lib/tags";
import type { MissionState } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const TODO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TODO_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TODO_DONE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TODO_JOINED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OLGA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OLGA_2 = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const TITLE = "Confirm UAT environment refresh";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function seeded(): MissionState {
  const state = emptyMissionState();
  state.projects = [
    {
      id: PROJECT,
      name: "Bridge",
      code: "BRG",
      summary: "",
      status: "healthy",
      currentFocus: "",
      stakeholders: [
        { id: OLGA, name: "Olga Petrov", role: "UAT" },
        { id: OLGA_2, name: "Olga Petrov", role: "Release" },
      ],
    },
  ];
  state.knowledge = [emptyKnowledge(PROJECT)];
  state.todos = [
    {
      id: TODO_A,
      projectId: PROJECT,
      title: TITLE,
      detail: "Confirm the refreshed UAT window before release readiness.",
      done: false,
      createdAt: "2026-09-15T09:00:00.000Z",
      dueAt: "2026-09-18T00:00:00.000Z",
      kind: "WAITING",
      waitingOn: "Olga Petrov",
    },
    {
      id: TODO_B,
      projectId: PROJECT,
      title: TITLE,
      done: false,
      createdAt: "2026-09-02T09:00:00.000Z",
      kind: "ACTION",
    },
    {
      id: TODO_DONE,
      projectId: PROJECT,
      title: "Archive the old checklist",
      done: true,
      createdAt: "2026-09-01T09:00:00.000Z",
    },
    {
      id: TODO_JOINED,
      projectId: PROJECT,
      title: "Chase both names",
      detail: "",
      done: false,
      createdAt: "2026-09-10T09:00:00.000Z",
      waitingOn: "Olga Petrov · Sarah Kim",
    },
  ];
  state.projectTags = [
    {
      id: "tag-uat",
      projectId: PROJECT,
      name: "uat",
      slug: "uat",
      origin: "custom",
    },
  ];
  state.itemTags = [
    {
      id: "link-a",
      projectId: PROJECT,
      tagId: "tag-uat",
      targetKind: "todo",
      targetId: TODO_A,
    },
  ];
  state.history = [
    {
      id: "hist-todo-sample",
      type: "other",
      title: "Due date moved to 18 Sep",
      detail: TITLE,
      projectId: PROJECT,
      createdAt: "2026-09-16T10:12:00.000Z",
      source: "user",
      targetKind: null,
      targetId: null,
    },
  ];
  return state;
}

check("1. stable todoId selects the matching To Do when titles overlap", () => {
  const state = seeded();
  const first = resolveKnowledgeItemDetail(state, PROJECT, refForTodo(TODO_A));
  const second = resolveKnowledgeItemDetail(state, PROJECT, refForTodo(TODO_B));
  assert.equal(first!.ref.kind, "todo");
  assert.equal(first!.ref.kind === "todo" && first!.ref.todoId, TODO_A);
  assert.equal(second!.ref.kind === "todo" && second!.ref.todoId, TODO_B);
  assert.equal(first!.body, second!.body);
  assert.notEqual(first!.todoDone, true);
  assert.equal(
    state.todos.find((todo) => todo.id === TODO_A)!.dueAt,
    "2026-09-18T00:00:00.000Z",
  );
  assert.equal(state.todos.find((todo) => todo.id === TODO_B)!.dueAt, undefined);
});

check("2. title comes from TodoItem.title", () => {
  const todo = seeded().todos.find((row) => row.id === TODO_A)!;
  assert.equal(todo.title, TITLE);
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.match(view, /data-testid="todo-detail-title"/);
  assert.match(view, /\{title\}/);
});

check("3. kind and Type are not rendered", () => {
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.doesNotMatch(view, />Type</);
  assert.doesNotMatch(view, /todo\.kind|TodoKind|Kind:/);
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.doesNotMatch(drawer, /TodoDetailView[\s\S]{0,900}kind=/);
});

check("4. due renders only from dueAt", () => {
  const withDue = seeded().todos.find((row) => row.id === TODO_A)!;
  const sparse = seeded().todos.find((row) => row.id === TODO_B)!;
  assert.equal(formatDueLabel(withDue.dueAt), "Due 18 Sep");
  assert.equal(formatDueLabel(sparse.dueAt), null);
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.match(view, /formatDueLabel\(dueAt\)/);
  assert.match(view, /due && dueValue \?/);
});

check("5. Added renders from createdAt", () => {
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.match(view, /formatShortDayMonth\(createdAt\)/);
  assert.match(view, /<dt>Added<\/dt>/);
});

check("6. Last updated is not fabricated", () => {
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.doesNotMatch(view, /Last updated|updatedAt/);
  assert.equal("updatedAt" in seeded().todos[0]!, false);
});

check("7. detail renders only from TodoItem.detail", () => {
  const rich = seeded().todos.find((row) => row.id === TODO_A)!;
  const sparse = seeded().todos.find((row) => row.id === TODO_B)!;
  assert.match(rich.detail ?? "", /refreshed UAT window/);
  assert.equal(sparse.detail, undefined);
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.match(view, /detailText \?/);
  assert.match(view, /\{detailText\}/);
});

check("8. Saved from Capture is not invented", () => {
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.doesNotMatch(view, /Saved from Capture/);
  assert.match(view, /do not carry Capture provenance in V1/);
});

check("9. one stored waitingOn value may render", () => {
  const todo = seeded().todos.find((row) => row.id === TODO_A)!;
  assert.equal(todo.waitingOn, "Olga Petrov");
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.match(view, /waiting \?/);
  assert.match(view, /data-testid="todo-detail-waiting-value"/);
  assert.match(view, /\{waiting\}/);
});

check("10. multi-person Waiting On is not parsed", () => {
  const joined = seeded().todos.find((row) => row.id === TODO_JOINED)!;
  assert.equal(joined.waitingOn, "Olga Petrov · Sarah Kim");
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.doesNotMatch(view, /split\(/);
  assert.match(drawer, /person\.name\.trim\(\)\.toLowerCase\(\) === waitingNeedle/);
  assert.match(drawer, /waitingMatches\.length === 1/);
});

check("11. tags come from the exact To Do association", () => {
  const state = seeded();
  const names = tagsForItem({
    projectTags: state.projectTags ?? [],
    itemTags: state.itemTags ?? [],
    projectId: PROJECT,
    targetKind: "todo",
    targetId: TODO_A,
  }).map((tag) => tag.name);
  assert.deepEqual(names, ["uat"]);
  const other = tagsForItem({
    projectTags: state.projectTags ?? [],
    itemTags: state.itemTags ?? [],
    projectId: PROJECT,
    targetKind: "todo",
    targetId: TODO_B,
  });
  assert.equal(other.length, 0);
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /tags=\{savedTagNames\}/);
});

check("12. project History is not attributed to the To Do", () => {
  const readHistory = historyEventsForItem(seeded(), PROJECT, refForTodo(TODO_A));
  assert.equal(readHistory.events.length, 0);
  assert.match(readHistory.notice, /D-004/);
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.doesNotMatch(view, /Due date moved|Added from Capture|Waiting on changed/);
  const history = read("src/lib/knowledge-centre/item-history.ts");
  assert.match(history, /ref\.kind !== "risk"/);
});

check("13. an open To Do shows Close", () => {
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.match(view, /data-testid="todo-detail-close"/);
  assert.match(view, />\s*Close\s*</);
});

check("14. Close uses the existing toggleTodo path", () => {
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /onToggle=\{\(\) => toggleTodo\(todoItem\.id\)\}/);
  assert.doesNotMatch(
    read("src/components/knowledge-centre/TodoDetailView.tsx"),
    /toggleTodo|removeTodo|updateTodo/,
  );
});

check("15. a completed To Do shows Reopen on the same path", () => {
  const done = seeded().todos.find((row) => row.id === TODO_DONE)!;
  assert.equal(done.done, true);
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.match(view, /Reopen To Do/);
  assert.match(view, /data-testid="todo-detail-reopen"/);
  assert.match(view, /onClick=\{onToggle\}/);
});

check("16. Remove uses the existing removeTodo path", () => {
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /removeTodo\(todoItem\.id\)/);
  assert.match(drawer, /onClose\(\)/);
});

check("17. Close does not delete the To Do", () => {
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  const close = view.slice(view.indexOf('data-testid="todo-detail-close"'));
  assert.match(close, /onClick=\{onToggle\}/);
  assert.doesNotMatch(close.slice(0, 180), /onRemove/);
});

check("18. Remove is a separate action from Close", () => {
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.match(view, /data-testid="todo-detail-remove"/);
  assert.match(view, /onClick=\{onRemove\}/);
  assert.match(view, /Remove deletes it/);
});

check("19. Edit To Do is not mounted", () => {
  const view = read("src/components/knowledge-centre/TodoDetailView.tsx");
  assert.doesNotMatch(view, /Edit item|Edit To Do|<textarea/);
});

check("20. Issue and Person detail views stay mounted", () => {
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /IssueDetailView/);
  assert.match(drawer, /IssueEditView/);
  assert.match(drawer, /PersonDetailView/);
  assert.match(drawer, /saveRiskEdit\(/);
});

check("21. narrow To Do drawer reuses the 438px shell", () => {
  const css = read("src/app/globals.css");
  assert.match(
    css,
    /\.ocean-item-detail-drawer\.is-todo-detail\s*\{[^}]*width:\s*min\(438px,\s*100vw\)/,
  );
  assert.match(css, /\.todo-detail-remove\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

console.log("\ntodo detail checks passed");
