import { expect, test, type Page } from "@playwright/test";
import { emptyKnowledge } from "../src/lib/knowledge";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import type { MissionState } from "../src/lib/types";
import { openKnowledgeCentre, readMissionState, seedMissionState } from "./helpers";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const LEGACY = "22222222-2222-4222-8222-222222222222";
const RISK = "33333333-3333-4333-8333-333333333333";
const WATCH = "88888888-8888-4888-8888-888888888888";
const TODO = "66666666-6666-4666-8666-666666666666";
const DECISION = "77777777-7777-4777-8777-777777777777";
const TITLE = "Vendor delay on the bridge";
const NOTES = "Wet-store mould is supplementary context.";
const LEFTOVER = "Vendor delay on the bridge remains open in the old notes.";
const DECISION_BODY = "Keep the Friday CAB.";
const TODO_TITLE = "Book the bridge review";
const STAMP = "2026-09-15T14:05:00.000Z";

function editorState(): MissionState {
  const state = emptyMissionState();
  state.projects = [
    {
      id: PROJECT,
      name: "Bridge",
      code: "BRG",
      summary: "",
      status: "healthy",
      currentFocus: "",
      stakeholders: [],
    },
    {
      id: LEGACY,
      name: "Legacy",
      code: "LEG",
      summary: "",
      status: "healthy",
      currentFocus: "",
      stakeholders: [],
    },
  ];
  const knowledge = emptyKnowledge(PROJECT);
  knowledge.sections.risks = [LEFTOVER];
  knowledge.sections.decisions = [DECISION_BODY];
  knowledge.sectionItemIds = { decisions: [DECISION] };
  const legacy = emptyKnowledge(LEGACY);
  legacy.sections.risks = ["Only the old prose risk."];
  state.knowledge = [knowledge, legacy];
  state.risks = [
    {
      id: RISK,
      projectId: PROJECT,
      title: TITLE,
      status: "open",
      source: "capture",
      createdAt: STAMP,
      updatedAt: STAMP,
      notes: NOTES,
    },
    {
      id: WATCH,
      projectId: PROJECT,
      title: "Watch the cab window",
      status: "watch",
      createdAt: STAMP,
      updatedAt: STAMP,
      notes: null,
    },
  ];
  state.todos = [
    {
      id: TODO,
      projectId: PROJECT,
      title: TODO_TITLE,
      done: false,
      createdAt: STAMP,
    },
  ];
  state.projectTags = [
    {
      id: "tag-vendor",
      projectId: PROJECT,
      name: "Vendor",
      slug: "vendor",
      origin: "custom",
    },
    {
      id: "tag-schedule",
      projectId: PROJECT,
      name: "Schedule",
      slug: "schedule",
      origin: "custom",
    },
  ];
  state.itemTags = [
    {
      id: "link-vendor",
      projectId: PROJECT,
      tagId: "tag-vendor",
      targetKind: "risk",
      targetId: RISK,
    },
  ];
  state.history = [
    {
      id: "hist-notes",
      type: "other",
      title: "Issue notes added",
      detail: `Previous notes:\n\n\nCurrent notes:\n\n${NOTES}`,
      projectId: PROJECT,
      createdAt: STAMP,
      source: "user",
      targetKind: "risk",
      targetId: RISK,
    },
  ];
  return state;
}

async function boot(page: Page, testId: string) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });
  await seedMissionState(page, editorState(), testId);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${PROJECT}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await openKnowledgeCentre(page);
}

async function openIssue(page: Page, riskId: string) {
  await page.getByTestId(`kc-open-details-issue:${riskId}`).click();
  await expect(page.getByTestId("ocean-item-detail-drawer")).toBeVisible();
}

function storedRisk(state: MissionState | null, riskId = RISK) {
  return (state?.risks ?? []).find((row) => row.id === riskId) ?? null;
}

test("open and watch Issues offer Edit; resolved keeps Reopen", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId);
  await openIssue(page, RISK);
  const drawer = page.getByTestId("ocean-item-detail-drawer");
  await expect(drawer.getByRole("button", { name: "Edit issue" })).toHaveCount(1);
  await expect(page.getByTestId("issue-detail-resolve")).toBeVisible();
  await page.getByTestId("issue-detail-close").click();

  await openIssue(page, WATCH);
  await expect(drawer.getByRole("button", { name: "Edit issue" })).toHaveCount(1);
  await expect(page.getByTestId("issue-detail-resolve")).toBeVisible();
  await page.getByTestId("issue-detail-resolve").click();
  await expect(page.getByTestId("issue-detail-reopen")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Edit issue" })).toHaveCount(0);
  await expect(page.getByTestId("issue-edit")).toHaveCount(0);
});

test("edit preloads canonical fields and does not write before Save", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  await openIssue(page, RISK);
  const drawer = page.getByTestId("ocean-item-detail-drawer");
  await page.screenshot({
    path: "/opt/cursor/artifacts/issue-edit-detail-before.png",
    fullPage: false,
  });
  await page.getByTestId("issue-detail-edit").click();
  await expect(drawer).toHaveAttribute("data-issue-editing", "true");
  await expect(page.getByTestId("issue-edit-title")).toHaveValue(TITLE);
  await expect(page.getByTestId("issue-edit-notes")).toHaveValue(NOTES);
  await expect(page.getByTestId("issue-edit")).toContainText("Vendor");
  await expect(page.getByTestId("issue-edit-heading")).toHaveText("Edit Issue");
  await expect(page.getByTestId("issue-edit-lock")).toContainText(
    "Editing — Save or Discard before leaving.",
  );
  await expect(page.getByTestId("issue-detail-history")).toContainText(
    "Issue notes added",
  );
  await expect(drawer.getByText("TYPE", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("DUE", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("WAITING ON", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("Saved source: Capture")).toHaveCount(0);
  await expect(drawer.locator("select")).toHaveCount(0);
  await expect(page.getByTestId("issue-detail-resolve")).toHaveCount(0);

  await page.screenshot({
    path: "/opt/cursor/artifacts/issue-edit-with-notes-tags.png",
    fullPage: false,
  });

  await page.getByTestId("issue-edit-title").fill("Unsaved title");
  await page.getByTestId("issue-edit-notes").fill("Unsaved notes");
  await page.getByTestId("ocean-tag-input").fill("sch");
  await expect(page.getByTestId("ocean-tag-suggest")).toContainText("Schedule");
  await expect(page.getByTestId("ocean-tag-suggest")).toContainText("Existing tag");
  await page.getByRole("button", { name: /Schedule/ }).click();
  await page.getByTestId("ocean-tag-input").fill("launch");
  await expect(page.getByTestId("ocean-tag-suggest")).toContainText("New tag");
  await page.screenshot({
    path: "/opt/cursor/artifacts/issue-edit-tag-suggest.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: /Create Launch/ }).click();

  const mid = (await readMissionState(page)) as MissionState;
  const risk = storedRisk(mid);
  expect(risk?.title).toBe(TITLE);
  expect(risk?.notes).toBe(NOTES);
  expect(mid.projectTags?.some((tag) => tag.slug === "launch")).toBe(false);
  expect(
    mid.itemTags?.some((row) => row.targetId === RISK && row.tagId !== "tag-vendor"),
  ).toBe(false);
  await expect(page.getByTestId("issue-detail-history")).not.toContainText(
    "Issue title updated",
  );
});

test("save writes title, notes, and tags once and returns to detail", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  await openIssue(page, RISK);
  await page.getByTestId("issue-detail-edit").click();
  await page.getByTestId("issue-edit-title").fill("Vendor data feed is two weeks late");
  await page.getByTestId("issue-edit-notes").fill("Supplier data is late.");
  await page.getByTestId("ocean-tag-input").fill("launch");
  await page.getByRole("button", { name: /Create Launch/ }).click();
  await page.getByTestId("issue-edit-save").click();

  await expect(page.getByTestId("issue-detail-title")).toHaveText(
    "Vendor data feed is two weeks late",
  );
  await expect(page.getByTestId("issue-detail-notes-body")).toHaveText(
    "Supplier data is late.",
  );
  await expect(page.getByTestId("issue-detail-tags")).toContainText("Vendor");
  await expect(page.getByTestId("issue-detail-tags")).toContainText("Launch");
  await expect(page.getByTestId("issue-detail-status")).toHaveText("Open");
  await expect(page.getByTestId("issue-detail-resolve")).toBeVisible();
  await expect(page.getByTestId("issue-edit")).toHaveCount(0);
  const history = page.getByTestId("issue-detail-history");
  await expect(history).toContainText("Issue title updated");
  await expect(history).toContainText("Issue notes updated");
  await expect(history).toContainText("Previous title:");
  await expect(history).toContainText("Current notes:");
  await expect(page.getByTestId("ocean-item-history-limited")).toContainText("D-004");

  const saved = (await readMissionState(page)) as MissionState;
  expect(saved.knowledge[0]?.sections.risks).toEqual([LEFTOVER]);
  expect(storedRisk(saved)?.status).toBe("open");
  expect(saved.projectTags?.filter((tag) => tag.slug === "launch")).toHaveLength(1);

  await page.screenshot({
    path: "/opt/cursor/artifacts/issue-edit-detail-after.png",
    fullPage: false,
  });

  await page.reload();
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await openKnowledgeCentre(page);
  await expect(page.getByTestId(`kc-item-issue:${RISK}`)).toContainText(
    "Vendor data feed is two weeks late",
  );
  await expect(page.getByText(LEFTOVER)).toHaveCount(0);
});

test("a tags-only save updates tags and adds no Issue history", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  await openIssue(page, RISK);
  const before = ((await readMissionState(page)) as MissionState).history ?? [];
  await page.getByTestId("issue-detail-edit").click();
  await page.getByTestId("ocean-tag-input").fill("sch");
  await page.getByRole("button", { name: /Schedule/ }).click();
  await page.getByTestId("issue-edit-save").click();
  await expect(page.getByTestId("issue-detail-tags")).toContainText("Schedule");
  await expect(page.getByTestId("issue-detail-title")).toHaveText(TITLE);
  await expect(page.getByTestId("issue-detail-notes-body")).toHaveText(NOTES);
  await expect(page.getByTestId("issue-detail-history")).not.toContainText(
    "Issue title updated",
  );
  const after = ((await readMissionState(page)) as MissionState).history ?? [];
  expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
});

test("a blank title is rejected and Discard writes nothing", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId);
  await openIssue(page, RISK);
  await page.getByTestId("issue-detail-edit").click();
  await page.getByTestId("issue-edit-title").fill("   ");
  await page.getByTestId("issue-edit-notes").fill("Do not keep this");
  await page.getByTestId("issue-edit-save").click();
  await expect(page.getByTestId("issue-edit-error")).toContainText(
    "Title cannot be blank.",
  );
  await expect(page.getByTestId("issue-edit-title")).toHaveValue("   ");
  await expect(page.getByTestId("issue-edit-notes")).toHaveValue("Do not keep this");
  let stored = (await readMissionState(page)) as MissionState;
  expect(storedRisk(stored)?.title).toBe(TITLE);
  expect(storedRisk(stored)?.notes).toBe(NOTES);

  await page.getByTestId("issue-edit-title").fill("Another unsaved title");
  await page.getByTestId("ocean-tag-input").fill("launch");
  await page.getByRole("button", { name: /Create Launch/ }).click();
  await page.getByTestId("issue-edit-discard").click();
  await expect(page.getByTestId("issue-detail-title")).toHaveText(TITLE);
  await expect(page.getByTestId("issue-detail-notes-body")).toHaveText(NOTES);
  await expect(page.getByTestId("issue-detail-tags")).toContainText("Vendor");
  await expect(page.getByTestId("issue-detail-tags")).not.toContainText("Launch");
  stored = (await readMissionState(page)) as MissionState;
  expect(storedRisk(stored)?.title).toBe(TITLE);
  expect(storedRisk(stored)?.notes).toBe(NOTES);
  expect(stored.projectTags?.some((tag) => tag.slug === "launch")).toBe(false);
  expect((stored.history ?? []).map((row) => row.id)).toEqual(["hist-notes"]);
});

test("back, close, backdrop, and escape keep an active edit", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  await openIssue(page, RISK);
  await page.getByTestId("issue-detail-edit").click();
  await page.getByTestId("issue-edit-title").fill("Stay open");

  await page.getByTestId("ocean-item-detail-back").click();
  await expect(page.getByTestId("issue-edit-lock")).toHaveAttribute(
    "data-lock-announced",
    "true",
  );
  await page.getByTestId("issue-detail-close").click();
  await expect(page.getByTestId("issue-edit")).toBeVisible();
  await page.mouse.click(30, 180);
  await expect(page.getByTestId("issue-edit-title")).toHaveValue("Stay open");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("ocean-item-detail-drawer")).toHaveAttribute(
    "data-issue-editing",
    "true",
  );
  await expect(page.getByTestId("issue-edit-save")).toBeVisible();
  await expect(page.getByTestId("issue-edit-discard")).toBeVisible();

  const stored = (await readMissionState(page)) as MissionState;
  expect(storedRisk(stored)?.title).toBe(TITLE);
});

test("knowledge-only risks and To Do or Knowledge editing stay on their own paths", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  await page.getByTestId(`kc-open-details-todo:${TODO}`).click();
  const drawer = page.getByTestId("ocean-item-detail-drawer");
  await expect(drawer).toHaveAttribute("data-todo-detail", "true");
  await expect(drawer).not.toHaveAttribute("data-issue-detail", "true");
  await expect(drawer.getByRole("button", { name: "Edit issue" })).toHaveCount(0);
  await expect(drawer.getByTestId("ocean-item-detail-edit")).toHaveCount(0);
  await expect(drawer.getByTestId("todo-detail-title")).toHaveText(TODO_TITLE);
  await expect(drawer.getByTestId("todo-detail-close")).toBeVisible();
  await page.getByTestId("ocean-item-detail-back").click();

  await page.getByTestId(`kc-open-details-decision:${DECISION}`).click();
  await expect(drawer.getByRole("button", { name: "Edit issue" })).toHaveCount(0);
  await expect(page.getByTestId("issue-edit")).toHaveCount(0);
  await page.getByTestId("ocean-item-detail-edit").click();
  await page.getByTestId("ocean-item-detail-edit-input").fill("Move CAB to Monday.");
  await page.getByTestId("ocean-item-detail-save").click();
  await expect(
    page.getByRole("button", { name: /KNOWLEDGE Move CAB to Monday/ }),
  ).toBeVisible();
  await expect(page.getByTestId("issue-edit")).toHaveCount(0);
  if (await drawer.count()) {
    await page.keyboard.press("Escape");
  }

  await page.goto(`/projects/${LEGACY}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await openKnowledgeCentre(page);
  await page.getByTestId("kc-open-details-issue:kr-0").click();
  await expect(drawer).toBeVisible();
  await expect(drawer).not.toHaveAttribute("data-issue-detail", "true");
  await expect(drawer.getByRole("button", { name: "Edit issue" })).toHaveCount(0);
  await expect(page.getByTestId("issue-edit")).toHaveCount(0);
  await expect(page.getByTestId("ocean-item-detail-resolve-kr")).toBeVisible();
  await expect(drawer).toContainText("Only the old prose risk.");
});

test("the 390px edit state does not overflow the viewport", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId);
  await page.setViewportSize({ width: 390, height: 844 });
  await openIssue(page, RISK);
  await page.getByTestId("issue-detail-edit").click();
  await page.getByTestId("ocean-tag-input").fill("launch");
  await expect(page.getByTestId("ocean-tag-suggest")).toBeVisible();
  await page.screenshot({
    path: "/opt/cursor/artifacts/issue-edit-narrow.png",
    fullPage: false,
  });

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const save = document.querySelector("[data-testid='issue-edit-save']");
    const discard = document.querySelector("[data-testid='issue-edit-discard']");
    const suggest = document.querySelector("[data-testid='ocean-tag-suggest']");
    const drawer = document.querySelector("[data-testid='ocean-item-detail-drawer']");
    const nodes = drawer ? [drawer, ...drawer.querySelectorAll("*")] : [];
    const overflowing = nodes.filter(
      (node) =>
        node instanceof HTMLElement &&
        node.scrollWidth > node.clientWidth + 2 &&
        node.clientWidth > 0,
    );
    const box = (node: Element | null) => node?.getBoundingClientRect();
    return {
      docOverflow: doc.scrollWidth - doc.clientWidth,
      overflowCount: overflowing.length,
      saveHeight: box(save)?.height ?? 0,
      discardHeight: box(discard)?.height ?? 0,
      suggestRight: box(suggest)?.right ?? 0,
      suggestLeft: box(suggest)?.left ?? 0,
    };
  });
  expect(metrics.docOverflow).toBeLessThanOrEqual(1);
  expect(metrics.overflowCount).toBe(0);
  expect(metrics.saveHeight).toBeGreaterThanOrEqual(44);
  expect(metrics.discardHeight).toBeGreaterThanOrEqual(44);
  expect(metrics.suggestLeft).toBeGreaterThanOrEqual(0);
  expect(metrics.suggestRight).toBeLessThanOrEqual(390);
});
