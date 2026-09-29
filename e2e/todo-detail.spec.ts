import { expect, test, type Page } from "@playwright/test";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import type { MissionState } from "../src/lib/types";
import { openKnowledgeCentre, readMissionState, seedMissionState } from "./helpers";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const TODO_RICH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TODO_SPARSE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TODO_JOINED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OLGA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TITLE = "Confirm UAT environment refresh";

function todoState(): MissionState {
  const state = emptyMissionState();
  state.projects = [
    {
      id: PROJECT,
      name: "Bridge",
      code: "BRG",
      summary: "",
      status: "healthy",
      currentFocus: "",
      stakeholders: [{ id: OLGA, name: "Olga Petrov", role: "UAT lead" }],
    },
  ];
  state.knowledge = [emptyKnowledge(PROJECT)];
  state.todos = [
    {
      id: TODO_RICH,
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
      id: TODO_SPARSE,
      projectId: PROJECT,
      title: TITLE,
      done: false,
      createdAt: "2026-09-02T09:00:00.000Z",
      kind: "ACTION",
    },
    {
      id: TODO_JOINED,
      projectId: PROJECT,
      title: "Chase the pair",
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
    {
      id: "tag-release",
      projectId: PROJECT,
      name: "release",
      slug: "release",
      origin: "custom",
    },
  ];
  state.itemTags = [
    {
      id: "link-uat",
      projectId: PROJECT,
      tagId: "tag-uat",
      targetKind: "todo",
      targetId: TODO_RICH,
    },
    {
      id: "link-release",
      projectId: PROJECT,
      tagId: "tag-release",
      targetKind: "todo",
      targetId: TODO_RICH,
    },
  ];
  state.history = [
    {
      id: "hist-todo-sample",
      type: "other",
      title: "Due date moved to 18 Sep",
      detail: "Added from Capture",
      projectId: PROJECT,
      createdAt: "2026-09-16T10:12:00.000Z",
      source: "user",
      targetKind: null,
      targetId: null,
    },
  ];
  return state;
}

async function boot(page: Page, testId: string, width = 1440, height = 900) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });
  await seedMissionState(page, todoState(), testId);
  await page.setViewportSize({ width, height });
  await page.goto(`/projects/${PROJECT}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await openKnowledgeCentre(page);
}

async function openTodo(page: Page, todoId: string) {
  await page.getByTestId(`kc-open-details-todo:${todoId}`).click();
  const drawer = page.getByTestId("ocean-item-detail-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("data-todo-detail", "true");
  return drawer;
}

test("open To Do shows canonical fields and omits stale layers", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  const drawer = await openTodo(page, TODO_RICH);
  await expect(drawer.getByTestId("todo-detail-title")).toHaveText(TITLE);
  await expect(drawer.getByTestId("todo-detail-status")).toHaveText("Open");
  await expect(drawer.locator(".lume-domain-badge[data-domain='todo']")).toHaveText(
    "To Do",
  );
  await expect(drawer.getByTestId("todo-detail-due")).toHaveText("18 Sep");
  await expect(drawer.getByTestId("todo-detail-added")).toHaveText("15 Sep");
  await expect(drawer.getByTestId("todo-detail-tags")).toContainText("uat");
  await expect(drawer.getByTestId("todo-detail-tags")).toContainText("release");
  await expect(drawer.getByTestId("todo-detail-waiting-value")).toHaveText(
    "Olga Petrov",
  );
  await expect(drawer.locator(".lume-review-avatar")).toHaveCount(1);
  await expect(drawer.getByTestId("todo-detail-body-text")).toHaveText(
    "Confirm the refreshed UAT window before release readiness.",
  );
  await expect(drawer.getByText("Saved from Capture")).toHaveCount(0);
  await expect(drawer.getByTestId("todo-detail-provenance")).toContainText(
    "do not carry Capture provenance",
  );
  await expect(drawer.getByTestId("ocean-item-history-limited")).toContainText("D-004");
  await expect(drawer.getByText("Due date moved to 18 Sep")).toHaveCount(0);
  await expect(drawer.getByText("Last updated")).toHaveCount(0);
  await expect(drawer.getByRole("heading", { name: "Type" })).toHaveCount(0);
  await expect(drawer.getByText("WAITING", { exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Edit item" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Edit To Do" })).toHaveCount(0);
  await expect(drawer.getByTestId("todo-detail-close")).toBeVisible();
  await expect(drawer.getByTestId("todo-detail-remove")).toBeVisible();
  await page.screenshot({
    path: "/opt/cursor/artifacts/todo-detail-rich.png",
    fullPage: false,
  });
});

test("sparse To Do omits due, waiting, and detail", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId);
  const drawer = await openTodo(page, TODO_SPARSE);
  await expect(drawer.getByTestId("todo-detail-title")).toHaveText(TITLE);
  await expect(drawer.getByTestId("todo-detail-due")).toHaveCount(0);
  await expect(drawer.getByTestId("todo-detail-waiting")).toHaveCount(0);
  await expect(drawer.getByTestId("todo-detail-body")).toHaveCount(0);
  await expect(drawer.getByTestId("todo-detail-added")).toHaveText("2 Sep");
  await expect(drawer.getByTestId("todo-detail-tags")).toContainText("No tags yet.");
  await page.screenshot({
    path: "/opt/cursor/artifacts/todo-detail-sparse.png",
    fullPage: false,
  });
});

test("a joined waiting string stays one value", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId);
  const drawer = await openTodo(page, TODO_JOINED);
  await expect(drawer.getByTestId("todo-detail-waiting-value")).toHaveText(
    "Olga Petrov · Sarah Kim",
  );
  await expect(drawer.locator(".lume-review-avatar")).toHaveCount(0);
});

test("Close keeps the To Do and Reopen uses the same control", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  const drawer = await openTodo(page, TODO_RICH);
  await drawer.getByTestId("todo-detail-close").click();
  await expect(drawer.getByTestId("todo-detail-status")).toHaveText("Completed");
  await expect(drawer.getByTestId("todo-detail-reopen")).toBeVisible();
  await expect(drawer.getByTestId("todo-detail-close")).toHaveCount(0);
  const afterClose = (await readMissionState(page)) as MissionState;
  const closed = afterClose.todos.find((todo) => todo.id === TODO_RICH);
  expect(closed?.done).toBe(true);
  expect(closed?.title).toBe(TITLE);
  await page.screenshot({
    path: "/opt/cursor/artifacts/todo-detail-completed.png",
    fullPage: false,
  });
  await drawer.getByTestId("todo-detail-reopen").click();
  await expect(drawer.getByTestId("todo-detail-status")).toHaveText("Open");
  const afterReopen = (await readMissionState(page)) as MissionState;
  expect(afterReopen.todos.find((todo) => todo.id === TODO_RICH)?.done).toBe(false);
});

test("Remove deletes the To Do and closes the drawer", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId);
  const drawer = await openTodo(page, TODO_SPARSE);
  await drawer.getByTestId("todo-detail-remove").click();
  await expect(page.getByTestId("ocean-item-detail-drawer")).toHaveCount(0);
  const stored = (await readMissionState(page)) as MissionState;
  expect(stored.todos.some((todo) => todo.id === TODO_SPARSE)).toBe(false);
  expect(stored.todos.some((todo) => todo.id === TODO_RICH)).toBe(true);
});

test("390px To Do detail does not overflow", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId, 390, 844);
  const drawer = await openTodo(page, TODO_RICH);
  const close = await drawer.getByTestId("todo-detail-close").boundingBox();
  const remove = await drawer.getByTestId("todo-detail-remove").boundingBox();
  expect(close?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(remove?.height ?? 0).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth <= root.clientWidth + 1;
  });
  expect(overflow).toBe(true);
  await page.screenshot({
    path: "/opt/cursor/artifacts/todo-detail-narrow.png",
    fullPage: false,
  });
});
