import { expect, test, type Page } from "@playwright/test";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import type { MissionState } from "../src/lib/types";
import { seedMissionState } from "./helpers";

const ACTIVE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function project(id: string, name: string) {
  return {
    id,
    name,
    code: name.slice(0, 3).toUpperCase(),
    summary: "",
    status: "healthy" as const,
    currentFocus: "",
    stakeholders: [],
  };
}

function shellState(extra = 0): MissionState {
  const state = emptyMissionState();
  state.projects = [
    project(ACTIVE, "Supplier replatform and a very long secondary title"),
    project(OTHER, "Website migration"),
  ];
  for (let i = 0; i < extra; i += 1) {
    const n = (i + 3).toString(16);
    state.projects.push(
      project(
        `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`,
        `Payments refresh ${i + 1}`,
      ),
    );
  }
  state.knowledge = state.projects.map((row) => emptyKnowledge(row.id));
  return state;
}

async function boot(page: Page, testId: string, width = 1440, height = 900, extra = 0) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });
  await seedMissionState(page, shellState(extra), testId);
  await page.setViewportSize({ width, height });
  await page.goto(`/projects/${ACTIVE}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
}

test("desktop sidebar follows Page 09 and keeps project content at x252", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  const sidebar = page.getByTestId("ocean-sidebar");
  const side = await sidebar.boundingBox();
  expect(side?.width ?? 0).toBeGreaterThanOrEqual(218);
  expect(side?.width ?? 0).toBeLessThanOrEqual(222);

  const brand = page.getByTestId("ocean-wordmark");
  await expect(brand).toContainText("Lume");
  await expect(brand.locator("svg")).toHaveCount(1);
  await expect(brand.locator(".ocean-wordmark-me")).toHaveCount(0);
  const brandBox = await brand.boundingBox();
  expect((brandBox?.x ?? 0) - (side?.x ?? 0)).toBeGreaterThanOrEqual(16);
  expect((brandBox?.x ?? 0) - (side?.x ?? 0)).toBeLessThanOrEqual(36);
  expect((brandBox?.y ?? 0) - (side?.y ?? 0)).toBeGreaterThanOrEqual(12);
  expect((brandBox?.y ?? 0) - (side?.y ?? 0)).toBeLessThanOrEqual(36);

  const create = page.getByTestId("ocean-new-project");
  await expect(create).toHaveText("+ New project");
  const createBox = await create.boundingBox();
  expect(createBox?.width ?? 0).toBeGreaterThanOrEqual(180);
  expect(createBox?.width ?? 0).toBeLessThanOrEqual(196);
  expect(createBox?.height ?? 0).toBeGreaterThanOrEqual(32);
  expect(createBox?.height ?? 0).toBeLessThanOrEqual(38);
  const purple = await create.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(purple).toBe("rgb(124, 92, 255)");

  const active = page.getByTestId(`ocean-project-link-${ACTIVE}`);
  await expect(active).toHaveAttribute("aria-current", "page");
  const activeBox = await active.boundingBox();
  expect(activeBox?.width ?? 0).toBeGreaterThanOrEqual(180);
  expect(activeBox?.width ?? 0).toBeLessThanOrEqual(196);
  expect(activeBox?.height ?? 0).toBeGreaterThanOrEqual(38);
  expect(activeBox?.height ?? 0).toBeLessThanOrEqual(44);
  await expect(page.getByTestId(`ocean-project-link-${OTHER}`)).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  const account = page.getByTestId("ocean-nav-account");
  await expect(account).toHaveText(/Account/);
  await expect(account).not.toHaveText(/Settings/);
  const accountBox = await account.boundingBox();
  const bottomGap =
    (side?.y ?? 0) + (side?.height ?? 0) - ((accountBox?.y ?? 0) + (accountBox?.height ?? 0));
  expect(bottomGap).toBeGreaterThanOrEqual(0);
  expect(bottomGap).toBeLessThanOrEqual(40);

  await expect(sidebar.getByText("Master To Do")).toHaveCount(0);
  await expect(sidebar.getByText("History")).toHaveCount(0);
  await expect(sidebar.getByText("Captures")).toHaveCount(0);
  await expect(sidebar.getByText("Help & support")).toHaveCount(0);
  await expect(sidebar.getByText("Settings")).toHaveCount(0);
  await expect(sidebar.getByText("Golden Test")).toHaveCount(0);
  await expect(sidebar.getByText("AI Cockpit")).toHaveCount(0);
  await expect(sidebar.getByText("Reset demo data")).toHaveCount(0);
  await expect(sidebar.getByText("Evals")).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: /Collapse/ })).toHaveCount(0);
  await expect(page.getByTestId("ocean-mode-selector")).toContainText("Home");
  await expect(page.getByTestId("ocean-mode-selector")).toContainText("Project Scan");

  const geometry = await page.locator(".app-content").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const padL = Number.parseFloat(style.paddingLeft);
    const padR = Number.parseFloat(style.paddingRight);
    return {
      innerLeft: rect.left + padL,
      innerWidth: rect.width - padL - padR,
    };
  });
  expect(geometry.innerLeft).toBeGreaterThanOrEqual(248);
  expect(geometry.innerLeft).toBeLessThanOrEqual(256);
  expect(geometry.innerWidth).toBeGreaterThanOrEqual(1156);
  expect(geometry.innerWidth).toBeLessThanOrEqual(1180);

  await page.screenshot({
    path: "/opt/cursor/artifacts/sidebar-home-1440.png",
    fullPage: false,
  });

  await create.click();
  await expect(page).toHaveURL(/\/projects\/new$/);
});

test("Account stays anchored when the project list is long", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId, 1440, 900, 12);
  const sidebar = page.getByTestId("ocean-sidebar");
  const list = page.getByTestId("ocean-sidebar-nav");
  const overflow = await list.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(overflow).toBe(true);
  const side = await sidebar.boundingBox();
  const account = await page.getByTestId("ocean-nav-account").boundingBox();
  const bottomGap =
    (side?.y ?? 0) + (side?.height ?? 0) - ((account?.y ?? 0) + (account?.height ?? 0));
  expect(bottomGap).toBeLessThanOrEqual(40);
  await page.screenshot({
    path: "/opt/cursor/artifacts/sidebar-account-anchored.png",
    fullPage: false,
  });
});

test("mobile hamburger opens the sidebar and project or backdrop closes it", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId, 390, 844);
  const sidebar = page.getByTestId("ocean-sidebar");
  await expect(sidebar).not.toHaveClass(/is-mobile-open/);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(sidebar).toHaveClass(/is-mobile-open/);
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth <= root.clientWidth + 1;
  });
  expect(overflow).toBe(true);
  await page.screenshot({
    path: "/opt/cursor/artifacts/sidebar-mobile-open.png",
    fullPage: false,
  });
  await page.getByTestId("ocean-sidebar-backdrop").click();
  await expect(sidebar).not.toHaveClass(/is-mobile-open/);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByTestId(`ocean-project-link-${OTHER}`).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${OTHER}`));
  await expect(sidebar).not.toHaveClass(/is-mobile-open/);
  await expect(page.getByTestId(`ocean-project-link-${OTHER}`)).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Account routes to /account", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId);
  await page.getByTestId("ocean-nav-account").click();
  await expect(page).toHaveURL(/\/account$/);
});
