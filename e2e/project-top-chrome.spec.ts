import { expect, test, type Page } from "@playwright/test";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import { currentMonthKey } from "../src/lib/workspace/history";
import type { MissionState } from "../src/lib/types";
import { seedMissionState } from "./helpers";

const ACTIVE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function shellState(used = 11): MissionState {
  const state = emptyMissionState();
  state.projects = [
    {
      id: ACTIVE,
      name: "Supplier replatform",
      code: "SR",
      summary: "",
      status: "healthy",
      currentFocus: "",
      stakeholders: [],
    },
    {
      id: OTHER,
      name: "Website migration",
      code: "WEB",
      summary: "",
      status: "healthy",
      currentFocus: "",
      stakeholders: [],
    },
  ];
  state.knowledge = state.projects.map((row) => emptyKnowledge(row.id));
  state.analysesMonthKey = currentMonthKey();
  state.analysesThisMonth = used;
  return state;
}

async function boot(page: Page, testId: string, width: number, height: number, used = 11) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: {
        persistence: "local",
        mode: "session",
        user: { email: "ada@example.com", name: "Ada Lovelace" },
      },
    });
  });
  await seedMissionState(page, shellState(used), testId);
  await page.setViewportSize({ width, height });
}

test("desktop project chrome follows Page 03 and keeps content at x252", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId, 1440, 900);
  await page.goto(`/projects/${ACTIVE}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();

  await expect(page.getByTestId("ocean-project-mobile-header")).toBeHidden();
  await expect(page.getByTestId("app-top-header")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await expect(page.getByText("Ada Lovelace")).toHaveCount(0);

  const side = await page.getByTestId("ocean-sidebar").boundingBox();
  expect(side?.width ?? 0).toBeGreaterThanOrEqual(218);
  expect(side?.width ?? 0).toBeLessThanOrEqual(222);

  const title = await page.getByTestId("ocean-project-title").boundingBox();
  expect(title?.x ?? 0).toBeGreaterThanOrEqual(244);
  expect(title?.x ?? 0).toBeLessThanOrEqual(260);
  expect(title?.y ?? 0).toBeGreaterThanOrEqual(26);
  expect(title?.y ?? 0).toBeLessThanOrEqual(42);

  const meta = await page.getByTestId("ocean-project-meta").boundingBox();
  expect(meta?.x ?? 0).toBeGreaterThanOrEqual(244);
  expect(meta?.x ?? 0).toBeLessThanOrEqual(260);
  expect(meta?.y ?? 0).toBeGreaterThanOrEqual(64);
  expect(meta?.y ?? 0).toBeLessThanOrEqual(80);
  await expect(page.getByTestId("ocean-project-meta")).toContainText("SR");
  await expect(page.getByTestId("ocean-delete-project")).toBeVisible();

  const usage = page.getByTestId("ocean-workspace-usage");
  const usageBox = await usage.boundingBox();
  expect(usageBox?.x ?? 0).toBeGreaterThanOrEqual(1140);
  expect(usageBox?.x ?? 0).toBeLessThanOrEqual(1168);
  expect(usageBox?.y ?? 0).toBeGreaterThanOrEqual(16);
  expect(usageBox?.y ?? 0).toBeLessThanOrEqual(32);
  expect(usageBox?.width ?? 0).toBeGreaterThanOrEqual(246);
  expect(usageBox?.width ?? 0).toBeLessThanOrEqual(262);
  expect(usageBox?.height ?? 0).toBeGreaterThanOrEqual(48);
  expect(usageBox?.height ?? 0).toBeLessThanOrEqual(56);
  await expect(usage).toContainText("AI usage · 39 local analyses left");
  await expect(usage).not.toContainText("AI token use");
  await expect(usage).not.toContainText("Usage & spending");
  await expect(usage).not.toContainText(/[$€£]|tokens/i);
  await expect(usage.locator("[data-testid='lume-me-mark']")).toHaveCount(1);
  const account = usage.getByTestId("ocean-usage-account");
  await expect(account).toHaveText("Account & billing →");
  await expect(account).toHaveAttribute("href", "/account");
  await expect(usage).toHaveAttribute(
    "title",
    "Local analysis allowance is informational and is not billing entitlement.",
  );

  const headerFill = await page.getByTestId("ocean-workspace-header").evaluate((el) => {
    const style = getComputedStyle(el);
    return { radius: style.borderRadius, background: style.backgroundColor };
  });
  expect(headerFill.radius).toBe("0px");
  expect(headerFill.background).toBe("rgba(0, 0, 0, 0)");

  const tabs = await page.getByTestId("ocean-mode-selector").boundingBox();
  expect(tabs?.x ?? 0).toBeGreaterThanOrEqual(212);
  expect(tabs?.x ?? 0).toBeLessThanOrEqual(228);
  expect(tabs?.y ?? 0).toBeGreaterThanOrEqual(98);
  expect(tabs?.y ?? 0).toBeLessThanOrEqual(114);
  expect(tabs?.width ?? 0).toBeGreaterThanOrEqual(1200);
  expect(tabs?.width ?? 0).toBeLessThanOrEqual(1240);
  expect(tabs?.height ?? 0).toBeGreaterThanOrEqual(52);
  expect(tabs?.height ?? 0).toBeLessThanOrEqual(56);

  const homeHeading = await page.getByTestId("lume-page-heading").boundingBox();
  expect(homeHeading?.x ?? 0).toBeGreaterThanOrEqual(244);
  expect(homeHeading?.x ?? 0).toBeLessThanOrEqual(260);
  expect(homeHeading?.y ?? 0).toBeGreaterThanOrEqual(172);
  expect(homeHeading?.y ?? 0).toBeLessThanOrEqual(190);

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
    path: "/opt/cursor/artifacts/project-chrome-home-1440.png",
    fullPage: false,
  });

  await page.getByTestId("ocean-mode-capture").click();
  await expect(page.getByRole("heading", { name: "Tell Lume what changed." })).toBeVisible();
  const captureHeading = await page
    .getByRole("heading", { name: "Tell Lume what changed." })
    .boundingBox();
  expect(captureHeading?.x ?? 0).toBeGreaterThanOrEqual(244);
  expect(captureHeading?.x ?? 0).toBeLessThanOrEqual(260);
  expect(captureHeading?.y ?? 0).toBeGreaterThanOrEqual(172);
  expect(captureHeading?.y ?? 0).toBeLessThanOrEqual(192);
  await expect(page.locator(".p09-capture-usage")).toBeHidden();
  await page.screenshot({
    path: "/opt/cursor/artifacts/project-chrome-capture-1440.png",
    fullPage: false,
  });
  await page.getByTestId("ocean-workspace-usage").screenshot({
    path: "/opt/cursor/artifacts/project-chrome-usage-callout.png",
  });
});

test("zero remaining still blocks Review changes without a desktop meter", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId, 1440, 900, 50);
  await page.goto(`/projects/${ACTIVE}`);
  await page.getByTestId("ocean-mode-capture").click();
  await page.locator("#capture-input").fill("The supplier date moved.");
  await expect(page.getByTestId("ocean-workspace-usage")).toContainText(
    "AI usage · 0 local analyses left",
  );
  await expect(page.locator(".p09-capture-usage")).toBeHidden();
  await expect(page.getByTestId("ocean-capture-analyse")).toBeDisabled();
});

test("narrow project chrome stays near 160px and keeps Capture usage", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId, 390, 844);
  await page.goto(`/projects/${ACTIVE}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await expect(page.getByTestId("ocean-workspace-usage")).toBeHidden();

  const mobile = page.getByTestId("ocean-project-mobile-header");
  const mobileBox = await mobile.boundingBox();
  expect(mobileBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(mobileBox?.height ?? 0).toBeLessThanOrEqual(52);
  await expect(mobile).toContainText("Lume");
  await expect(mobile.locator("svg")).toHaveCount(1);
  await expect(mobile.getByRole("button", { name: "Sign out" })).toHaveCount(0);

  const title = await page.getByTestId("ocean-project-title").boundingBox();
  expect(title?.y ?? 0).toBeGreaterThanOrEqual(54);
  expect(title?.y ?? 0).toBeLessThanOrEqual(70);
  const meta = await page.getByTestId("ocean-project-meta").boundingBox();
  expect(meta?.y ?? 0).toBeGreaterThanOrEqual(76);
  expect(meta?.y ?? 0).toBeLessThanOrEqual(92);
  await expect(page.getByTestId("ocean-delete-project")).toBeVisible();

  const tabs = await page.getByTestId("ocean-mode-selector").boundingBox();
  expect(tabs?.y ?? 0).toBeGreaterThanOrEqual(104);
  expect(tabs?.y ?? 0).toBeLessThanOrEqual(120);
  expect((tabs?.y ?? 0) + (tabs?.height ?? 0)).toBeGreaterThanOrEqual(152);
  expect((tabs?.y ?? 0) + (tabs?.height ?? 0)).toBeLessThanOrEqual(168);

  await page.getByTestId("ocean-mode-capture").click();
  const captureHeading = await page
    .getByRole("heading", { name: "Tell Lume what changed." })
    .boundingBox();
  expect(captureHeading?.y ?? 0).toBeGreaterThanOrEqual(170);
  expect(captureHeading?.y ?? 0).toBeLessThanOrEqual(194);
  await expect(page.locator(".p09-capture-usage")).toBeVisible();
  await expect(page.locator(".p09-capture-usage")).toContainText("39 analyses remaining");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(true);

  await page.screenshot({
    path: "/opt/cursor/artifacts/project-chrome-capture-390.png",
    fullPage: false,
  });

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByTestId("ocean-sidebar")).toHaveClass(/is-mobile-open/);
  await page.getByTestId("ocean-sidebar-backdrop").click({ position: { x: 300, y: 200 } });
  await expect(page.getByTestId("ocean-sidebar")).not.toHaveClass(/is-mobile-open/);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByTestId(`ocean-project-link-${OTHER}`).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${OTHER}`));
  await expect(page.getByTestId("ocean-sidebar")).not.toHaveClass(/is-mobile-open/);
});

test("non-project routes keep the normal TopHeader", async ({ page }, testInfo) => {
  await boot(page, testInfo.testId, 1440, 900);
  await page.goto("/todos");
  const header = page.getByTestId("app-top-header");
  await expect(header).toBeVisible();
  await expect(header.getByRole("heading", { name: "Master To Do" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(header.getByText("Ada Lovelace")).toBeVisible();
  await expect(page.getByTestId("ocean-project-mobile-header")).toHaveCount(0);
});
