import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { seedMissionState } from "./helpers";

const NORTHSTAR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const CHECKPOINTS = [1, 25, 50, 75, 100] as const;
const SCREENSHOTS = [1, 50, 100] as const;

function loadCheckpoint(n: number) {
  const path = join(process.cwd(), "longhaul-100", "checkpoints", `state-${n}.json`);
  if (!existsSync(path)) {
    throw new Error(`Missing ${path} — run npm run stress:project-longhaul first`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

async function mockAuth(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });
}

async function collectUiIssues(page: Page) {
  const issues: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") issues.push(`console:${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    issues.push(`pageerror:${err.message}`);
  });
  return issues;
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 2,
    };
  });
}

test.describe("longhaul UI torture (Northstar checkpoints)", () => {
  for (const n of CHECKPOINTS) {
    test(`checkpoint ${n} project / KC / History remain usable`, async ({ page }) => {
      const issues = await collectUiIssues(page);
      await mockAuth(page);
      await seedMissionState(page, loadCheckpoint(n), `longhaul-ui-${n}`);

      const t0 = Date.now();
      await page.goto(`/projects/${NORTHSTAR_ID}`);
      await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
      const projectMs = Date.now() - t0;

      await page.getByTestId("ocean-mode-knowledge").click();
      await expect(page.getByTestId("ocean-search-ask")).toBeVisible();
      await page.getByTestId("ocean-search-input").fill("Priya");
      await expect(page.getByTestId("ocean-search-results")).toBeVisible({ timeout: 5000 }).catch(() => undefined);

      await page.getByTestId("ocean-mode-capture").click();
      await expect(page.getByTestId("ocean-capture-mode")).toBeVisible();

      const ov = await overflow(page);

      await page.goto("/history");
      await expect(page.getByTestId("ocean-nav-history")).toBeVisible();
      const historyMs = Date.now() - t0;

      await page.goto("/todos");
      await expect(page.getByTestId("ocean-nav-master-todo")).toBeVisible();

      if (SCREENSHOTS.includes(n as (typeof SCREENSHOTS)[number])) {
        const dir = join(process.cwd(), "longhaul-100", "screenshots");
        mkdirSync(dir, { recursive: true });
        await page.goto(`/projects/${NORTHSTAR_ID}`);
        await page.screenshot({
          path: join(dir, `capture-${n}-project.png`),
          fullPage: true,
        });
        const art = "/opt/cursor/artifacts/screenshots";
        mkdirSync(art, { recursive: true });
        await page.screenshot({
          path: join(art, `longhaul-capture-${n}-project.png`),
          fullPage: true,
        });
      }

      const hydration = issues.filter((i) => /hydrat/i.test(i));
      expect(hydration, hydration.join("\n")).toEqual([]);
      expect(ov.overflow, `horizontal overflow ${ov.scrollWidth}>${ov.clientWidth}`).toBe(false);

      const dir = join(process.cwd(), "longhaul-100");
      mkdirSync(dir, { recursive: true });
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        join(dir, `ui-checkpoint-${n}.json`),
        JSON.stringify(
          {
            n,
            projectMs,
            historyMs,
            overflow: ov,
            consoleErrors: issues,
          },
          null,
          2,
        ),
      );
    });
  }
});
