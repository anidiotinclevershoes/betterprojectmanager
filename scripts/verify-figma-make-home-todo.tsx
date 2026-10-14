/**
 * Faithful Make Home To Do row.
 * Presentation only. Run: npm run verify:figma-make-home-todo
 */
import "./lib/stub-css.cjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeTodoRow, HomeTodoSection } from "../src/components/home/HomeTodoRow";
import { homeTodoRowModel } from "../src/lib/home/home-todo-row";
import type { TodoItem } from "../src/lib/types";

const NOW = Date.parse("2026-09-16T12:00:00.000Z");

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

function todo(partial: Partial<TodoItem> & Pick<TodoItem, "id" | "title">): TodoItem {
  return {
    done: false,
    createdAt: "2026-09-01T09:00:00.000Z",
    ...partial,
  };
}

check("stored id, title, waiting string, and tags pass through", () => {
  const model = homeTodoRowModel({
    todo: todo({
      id: "todo-1",
      title: "Confirm the window",
      waitingOn: "  finance desk  ",
    }),
    tagLabels: [" UAT ", "", "Release"],
    now: NOW,
  });
  assert.equal(model.id, "todo-1");
  assert.equal(model.title, "Confirm the window");
  assert.equal(model.waitingOn, "finance desk");
  assert.deepEqual(model.tags, ["UAT", "Release"]);
  assert.equal(model.dueLabel, null);
  assert.equal(model.dueTone, null);
});

check("a missing due date does not become today, overdue, or a priority", () => {
  const model = homeTodoRowModel({
    todo: todo({ id: "todo-2", title: "Undated" }),
    now: NOW,
  });
  assert.equal(model.dueLabel, null);
  assert.equal(model.dueTone, null);
  assert.equal("priority" in model, false);
  assert.equal("urgent" in model, false);
});

check("due today and overdue come only from the stored instant", () => {
  const today = homeTodoRowModel({
    todo: todo({
      id: "todo-3",
      title: "Today",
      dueAt: "2026-09-16T10:30:00.000Z",
    }),
    now: NOW,
  });
  assert.equal(today.dueTone, "today");
  assert.equal(today.dueLabel, "Due today");
  assert.equal(today.dueLabel?.includes("10:30"), false);

  const overdue = homeTodoRowModel({
    todo: todo({
      id: "todo-4",
      title: "Late",
      dueAt: "2026-09-15T09:00:00.000Z",
    }),
    now: NOW,
  });
  assert.equal(overdue.dueTone, "overdue");
  assert.equal(overdue.dueLabel, "Overdue · 15 Sep");
});

check("markup keeps Close and withholds unwired Make controls", () => {
  const html = renderToStaticMarkup(
    <HomeTodoRow
      todo={todo({
        id: "todo-5",
        title: "Fixture row",
        dueAt: "2026-09-16T10:30:00.000Z",
        waitingOn: "finance desk",
      })}
      density="comfortable"
      tagLabels={["UAT"]}
      now={NOW}
      onOpen={() => {}}
      onClose={() => {}}
    />,
  );
  assert.match(html, /data-todo-id="todo-5"/);
  assert.match(html, /Fixture row/);
  assert.match(html, />Close</);
  assert.match(html, /Due today/);
  assert.match(html, /Waiting on finance desk/);
  assert.match(html, /UAT/);
  assert.equal(html.includes("Move Date"), false);
  assert.equal(html.includes("More actions"), false);
  assert.equal(html.includes("Priya"), false);
  assert.equal(html.includes("Suggestions"), false);
});

check("Close is omitted when the caller does not provide it", () => {
  const html = renderToStaticMarkup(
    <HomeTodoRow
      todo={todo({ id: "todo-6", title: "Read only" })}
      density="compact"
      now={NOW}
    />,
  );
  assert.equal(html.includes(">Close<"), false);
  assert.match(html, /data-density="compact"/);
});

check("empty section renders the empty state and collapse stays local", () => {
  const html = renderToStaticMarkup(
    <HomeTodoSection todos={[]} density="comfortable" now={NOW} />,
  );
  assert.match(html, /No to do information yet/);
  assert.match(html, /data-collapsed="false"/);
  assert.match(html, /aria-expanded="true"/);
  assert.equal(html.includes("Add To Do"), false);
});

check("the row does not own persistence or the Make runtime", () => {
  const component = readFileSync("src/components/home/HomeTodoRow.tsx", "utf8");
  const css = readFileSync("src/components/home/home-todo-row.css", "utf8");
  const preview = readFileSync("src/components/home/HomeTodoPreview.tsx", "utf8");
  for (const source of [component, preview]) {
    assert.equal(source.includes("useMission"), false);
    assert.equal(source.includes("toggleTodo"), false);
    assert.equal(source.includes("removeTodo"), false);
    assert.equal(source.includes("lucide-react"), false);
  }
  assert.equal(css.includes("@import"), false);
  assert.equal(/\bbody\s*\{/.test(css), false);
  assert.equal(/\bhtml\s*\{/.test(css), false);
  assert.match(css, /^\.lume-home-todo-/m);
});

console.log("figma make home todo row ok");
