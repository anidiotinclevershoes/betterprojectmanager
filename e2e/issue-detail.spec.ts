import { expect, test } from "@playwright/test";
import { emptyKnowledge } from "../src/lib/knowledge";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import type { MissionState } from "../src/lib/types";
import { openKnowledgeCentre, seedMissionState } from "./helpers";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const RISK_NOTES = "33333333-3333-4333-8333-333333333333";
const RISK_EMPTY = "44444444-4444-4444-8444-444444444444";
const RISK_OTHER = "55555555-5555-4555-8555-555555555555";
const TITLE = "Vendor delay on the bridge";
const EMPTY_TITLE = "Quiet issue with no notes";
const NOTES = "Wet-store mould is supplementary context.";
const STAMP = "2026-09-15T14:05:00.000Z";

function issueState(): MissionState {
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
  ];
  state.knowledge = [emptyKnowledge(PROJECT)];
  state.risks = [
    {
      id: RISK_NOTES,
      projectId: PROJECT,
      title: TITLE,
      status: "open",
      source: "capture",
      createdAt: STAMP,
      updatedAt: STAMP,
      notes: NOTES,
    },
    {
      id: RISK_EMPTY,
      projectId: PROJECT,
      title: EMPTY_TITLE,
      status: "open",
      createdAt: STAMP,
      updatedAt: STAMP,
      notes: null,
    },
    {
      id: RISK_OTHER,
      projectId: PROJECT,
      title: TITLE,
      status: "open",
      notes: "Other risk notes must stay off this Issue.",
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
  ];
  state.itemTags = [
    {
      id: "link-notes",
      projectId: PROJECT,
      tagId: "tag-vendor",
      targetKind: "risk",
      targetId: RISK_NOTES,
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
      targetId: RISK_NOTES,
    },
    {
      id: "hist-other",
      type: "other",
      title: "Issue notes added",
      detail: "Current notes:\n\nOther risk notes must stay off this Issue.",
      projectId: PROJECT,
      createdAt: STAMP,
      source: "user",
      targetKind: "risk",
      targetId: RISK_OTHER,
    },
    {
      id: "hist-null",
      type: "other",
      title: TITLE,
      detail: "Added from Capture",
      projectId: PROJECT,
      createdAt: STAMP,
      source: "system",
      targetKind: null,
      targetId: null,
    },
  ];
  return state;
}

async function openIssue(page: import("@playwright/test").Page, riskId: string) {
  await page.getByTestId(`kc-open-details-issue:${riskId}`).click();
  await expect(page.getByTestId("ocean-item-detail-drawer")).toBeVisible();
}

test("genuine Issue detail shows Notes, tags, and exact History", async ({
  page,
}, testInfo) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });
  await seedMissionState(page, issueState(), testInfo.testId);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${PROJECT}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await openKnowledgeCentre(page);

  await openIssue(page, RISK_NOTES);
  const drawer = page.getByTestId("ocean-item-detail-drawer");
  await expect(drawer).toHaveAttribute("data-issue-detail", "true");
  await expect(page.getByTestId("issue-detail-title")).toHaveText(TITLE);
  await expect(page.getByTestId("issue-detail-status")).toHaveText("Open");
  await expect(page.getByTestId("issue-detail-notes-body")).toHaveText(NOTES);
  await expect(page.getByTestId("issue-detail-tags")).toContainText("Vendor");
  await expect(page.getByTestId("issue-detail-history")).toContainText(
    "Issue notes added",
  );
  await expect(page.getByTestId("issue-detail-history")).toContainText(
    "Previous notes:",
  );
  await expect(page.getByTestId("issue-detail-history")).toContainText(
    "Current notes:",
  );
  await expect(page.getByTestId("issue-detail-history")).not.toContainText(
    "Added from Capture",
  );
  await expect(page.getByTestId("issue-detail-history")).not.toContainText(
    "Other risk notes",
  );
  await expect(page.getByTestId("ocean-item-history-limited")).toContainText(
    "D-004",
  );
  await expect(page.getByTestId("issue-detail-resolve")).toHaveText(
    "Resolve issue",
  );
  await expect(page.getByTestId("issue-detail-related")).toHaveCount(0);
  await expect(drawer.getByText("Source: Capture")).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Edit issue" })).toHaveCount(1);
  await expect(drawer.getByRole("button", { name: "Close item" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Remove item" })).toHaveCount(0);
  await expect(drawer.locator("textarea")).toHaveCount(0);
  await expect(page.getByTestId("issue-detail-reopen")).toHaveCount(0);

  const box = await drawer.boundingBox();
  expect(box?.width).toBeGreaterThan(420);
  expect(box?.width).toBeLessThan(450);
  const backdrop = page.getByTestId("ocean-item-detail-backdrop");
  const backdropBox = await backdrop.boundingBox();
  expect(backdropBox?.width).toBeGreaterThan(1400);
  expect(backdropBox?.height).toBeGreaterThan(800);
  const hit = await page.evaluate(() =>
    document.elementFromPoint(24, 80)?.getAttribute("data-testid"),
  );
  expect(hit).toBe("ocean-item-detail-backdrop");

  await page.screenshot({
    path: "/opt/cursor/artifacts/issue-detail-open-notes.png",
    fullPage: false,
  });

  await page.getByTestId("issue-detail-close").click();
  await expect(drawer).toHaveCount(0);

  await openIssue(page, RISK_EMPTY);
  await expect(page.getByTestId("issue-detail-title")).toHaveText(EMPTY_TITLE);
  await expect(page.getByTestId("issue-detail-notes-empty")).toHaveText(
    "No notes yet.",
  );
  await expect(page.getByTestId("issue-detail-notes-body")).toHaveCount(0);
  await expect(drawer.getByText(NOTES)).toHaveCount(0);
  await page.screenshot({
    path: "/opt/cursor/artifacts/issue-detail-open-empty.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);

  await openIssue(page, RISK_NOTES);
  const before = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    const state = raw ? (JSON.parse(raw) as MissionState) : null;
    return (state?.history ?? []).map((row) => row.id);
  }, "mission-control-state-v5");
  await page.getByTestId("issue-detail-resolve").click();
  await expect(page.getByTestId("issue-detail-status")).toHaveText("Resolved");
  await expect(page.getByTestId("issue-detail-reopen")).toHaveText("Reopen issue");
  await expect(page.getByTestId("issue-detail-resolve")).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Edit issue" })).toHaveCount(0);
  await expect(page.getByTestId("issue-detail-title")).toHaveText(TITLE);
  await expect(page.getByTestId("issue-detail-notes-body")).toHaveText(NOTES);
  const afterResolve = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    const state = raw ? (JSON.parse(raw) as MissionState) : null;
    const risk = (state?.risks ?? []).find(
      (row) => row.id === "33333333-3333-4333-8333-333333333333",
    );
    return {
      status: risk?.status ?? null,
      history: (state?.history ?? []).map((row) => row.id),
    };
  }, "mission-control-state-v5");
  expect(afterResolve.status).toBe("resolved");
  expect(afterResolve.history).toEqual(before);
  await page.screenshot({
    path: "/opt/cursor/artifacts/issue-detail-resolved.png",
    fullPage: false,
  });

  await page.getByTestId("issue-detail-reopen").click();
  await expect(page.getByTestId("issue-detail-status")).toHaveText("Open");
  await expect(page.getByTestId("issue-detail-resolve")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/opt/cursor/artifacts/issue-detail-narrow.png",
    fullPage: false,
  });
  const narrow = await drawer.evaluate((el) => {
    const nodes = [el, ...el.querySelectorAll("*")];
    const overflowing = nodes.filter(
      (node) =>
        node instanceof HTMLElement &&
        node.scrollWidth > node.clientWidth + 2 &&
        node.clientWidth > 0,
    );
    const action = el.querySelector("[data-testid='issue-detail-resolve']");
    const rect = action?.getBoundingClientRect();
    return {
      drawerWidth: el.getBoundingClientRect().width,
      overflowCount: overflowing.length,
      actionHeight: rect?.height ?? 0,
    };
  });
  expect(narrow.drawerWidth).toBeLessThanOrEqual(390);
  expect(narrow.overflowCount).toBe(0);
  expect(narrow.actionHeight).toBeGreaterThanOrEqual(44);
  const actionInView = await page.getByTestId("issue-detail-resolve").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  expect(actionInView).toBe(true);

  const stillCovered = await page.evaluate(() => {
    const el = document.elementFromPoint(12, 40);
    const drawer = document.querySelector(
      '[data-testid="ocean-item-detail-drawer"]',
    );
    const backdrop = document.querySelector(
      '[data-testid="ocean-item-detail-backdrop"]',
    );
    return Boolean(
      el && (el === backdrop || el === drawer || drawer?.contains(el)),
    );
  });
  expect(stillCovered).toBe(true);
  await page.getByTestId("ocean-item-detail-back").click();
  await expect(drawer).toHaveCount(0);
});
