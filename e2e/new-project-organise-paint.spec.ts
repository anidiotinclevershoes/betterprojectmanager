import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { seedExperimentalWorlds } from "./helpers";

const HOSTED_ORGANISE = JSON.parse(
  readFileSync(join(process.cwd(), "e2e/fixtures/new-project-bob-mike-organise.json"), "utf8"),
) as { draft: { stakeholders: Array<{ name: string }> } };

const EMPTY_MISSION = {
  projects: [],
  memories: [],
  recommendations: [],
  meetings: [],
  releases: [],
  todos: [],
  knowledge: [],
  risks: [],
  timeline: [],
  history: [],
  analysesThisMonth: 0,
  projectTags: [],
  itemTags: [],
};

async function mockHostedComposerShell(
  page: Page,
  args: {
    billingReleased: Promise<void>;
    organiseReleased: Promise<void>;
  },
) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: {
        persistence: "supabase",
        mode: "supabase",
        user: { id: "user-e2e", email: "e2e@example.com", name: "E2E" },
      },
    });
  });
  await page.route("**/api/workspace/state", async (route) => {
    await route.fulfill({
      json: {
        workspaceId: "ws-e2e",
        userId: "user-e2e",
        state: EMPTY_MISSION,
        projectCount: 0,
      },
    });
  });
  await page.route("**/api/billing/status", async (route) => {
    await args.billingReleased;
    await route.fulfill({
      json: {
        entitlement: {
          workspaceId: "ws-e2e",
          status: "active",
          canUseLume: true,
          reason: "early_access",
        },
        billingConfigured: false,
        billingEnabled: false,
      },
    });
  });
  await page.route("**/api/new-project", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
      return;
    }
    await args.organiseReleased;
    await route.fulfill({ json: HOSTED_ORGANISE });
  });
}

test("hosted Organise people survive the billing-gate paint", async ({ page }, testInfo) => {
  let releaseBilling = () => {};
  const billingReleased = new Promise<void>((resolve) => {
    releaseBilling = resolve;
  });
  let releaseOrganise = () => {};
  const organiseReleased = new Promise<void>((resolve) => {
    releaseOrganise = resolve;
  });

  await seedExperimentalWorlds(page, testInfo.testId);
  await mockHostedComposerShell(page, { billingReleased, organiseReleased });

  const billingStarted = page.waitForRequest(
    (req) => req.url().includes("/api/billing/status"),
    { timeout: 20_000 },
  );
  await page.goto("/projects/new");
  await expect(page.getByTestId("np-experience")).toBeVisible();
  await billingStarted;
  await page.getByText("Organise notes", { exact: true }).click();
  await page
    .getByTestId("np-organise-notes")
    .fill("bob is the ba\nmike handles the legacy builds");
  const organise = page.getByTestId("np-organise");
  await organise.click();
  await expect(organise).toBeDisabled();

  // Hosted Preview: billing status returns while OpenAI Organise is still in flight.
  // EntitlementGate used to change fragment shape here and remount the composer.
  const billingFinished = page.waitForResponse(
    (res) => res.url().includes("/api/billing/status"),
    { timeout: 20_000 },
  );
  releaseBilling();
  await billingFinished;
  releaseOrganise();

  await expect(page.getByTestId("np-frame-people").getByText("Bob", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("np-frame-people").getByText(/Mike — legacy builds/)).toBeVisible();
  await expect(page.getByTestId("np-needs-you")).toHaveCount(0);
});
