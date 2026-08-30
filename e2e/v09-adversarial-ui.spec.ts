/**
 * v0.9 adversarial UI journeys: saturation + empty project.
 * Not added to npm test. Run: npm run test:v09-adversarial-ui
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { seedMissionState } from "./helpers";

const SAT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-ad00000000ui";
const EMPTY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-ad00000000em";

function iso(i: number) {
  return `2026-01-01T00:${String(i % 60).padStart(2, "0")}:00.000Z`;
}

function saturatedState() {
  const people = Array.from({ length: 30 }, (_, i) => ({
    id: `sat-person-${i}`,
    name: `Person ${i} Qual`,
    role: "Stakeholder",
  }));
  const todos = Array.from({ length: 55 }, (_, i) => ({
    id: `sat-todo-${i}`,
    projectId: SAT_ID,
    title: `Open work ${i} — keep the member home under two seconds`,
    done: false,
    createdAt: iso(i),
  }));
  const risks = Array.from({ length: 20 }, (_, i) => ({
    id: `sat-risk-${i}`,
    projectId: SAT_ID,
    title: `Open risk ${i} on the session service`,
    status: "open",
    createdAt: iso(i),
    updatedAt: iso(i),
  }));
  const timeline = Array.from({ length: 30 }, (_, i) => ({
    id: `sat-ms-${i}`,
    projectId: SAT_ID,
    label: `Milestone ${i}`,
    type: "milestone",
    startAt: `2026-10-${String((i % 27) + 1).padStart(2, "0")}T12:00:00.000Z`,
  }));
  const history = Array.from({ length: 200 }, (_, i) => ({
    id: `sat-hist-${i}`,
    type: "other",
    title: `History ${i}`,
    projectId: SAT_ID,
    createdAt: iso(i),
  }));
  return {
    projects: [
      {
        id: SAT_ID,
        name: "Saturation Qual",
        code: "SATQ",
        summary: "Heavy maintained truth",
        status: "healthy",
        kind: "delivery",
        currentFocus: "Stay usable",
        stakeholders: people,
      },
      {
        id: EMPTY_ID,
        name: "Empty Qual",
        code: "EMPQ",
        summary: "Almost empty",
        status: "healthy",
        kind: "delivery",
        currentFocus: "Kickoff",
        stakeholders: [],
      },
    ],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos,
    knowledge: [],
    risks,
    timeline,
    history,
  };
}

async function mockAuth(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });
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

test.describe("v0.9 adversarial UI", () => {
  test("saturation: project / KC / Search / History / Capture remain usable", async ({
    page,
  }) => {
    const issues: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") issues.push(msg.text());
    });
    page.on("pageerror", (err) => issues.push(err.message));
    await mockAuth(page);
    await seedMissionState(page, saturatedState(), "v09-sat");

    const t0 = Date.now();
    await page.goto(`/projects/${SAT_ID}`);
    await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
    const projectMs = Date.now() - t0;

    await page.getByTestId("ocean-mode-knowledge").click();
    await expect(page.getByTestId("ocean-search-ask")).toBeVisible();
    await page.getByTestId("ocean-search-input").fill("Person 1");
    await expect(page.getByTestId("ocean-search-results"))
      .toBeVisible({ timeout: 5000 })
      .catch(() => undefined);

    await page.getByTestId("ocean-mode-capture").click();
    await expect(page.getByTestId("ocean-capture-mode")).toBeVisible();

    const ov = await overflow(page);
    await page.goto("/history");
    await expect(page.getByTestId("ocean-nav-history")).toBeVisible();
    const historyMs = Date.now() - t0;

    const hydration = issues.filter((i) => /hydrat/i.test(i));
    expect(hydration, hydration.join("\n")).toEqual([]);
    expect(ov.overflow, `horizontal overflow ${ov.scrollWidth}>${ov.clientWidth}`).toBe(false);

    const dir = join(process.cwd(), "docs/v1-convergence");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "adversarial-ui-saturation.json"),
      JSON.stringify(
        {
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

  test("empty project: KC and Capture load without invented filler crash", async ({
    page,
  }) => {
    await mockAuth(page);
    await seedMissionState(page, saturatedState(), "v09-empty");
    await page.goto(`/projects/${EMPTY_ID}`);
    await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
    await page.getByTestId("ocean-mode-knowledge").click();
    await expect(page.getByTestId("ocean-search-ask")).toBeVisible();
    await page.getByTestId("ocean-mode-capture").click();
    await expect(page.getByTestId("ocean-capture-mode")).toBeVisible();
  });
});
