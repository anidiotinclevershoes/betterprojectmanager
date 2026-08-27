import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import {
  analyseFrozenTranscript,
  applyReadyIfPresent,
  dismissCoachIfPresent,
  mockCaptureApplyFromDurable,
  openCapture,
  openKnowledgeCentre,
  readMissionState,
  seedExperimentalWorlds,
  startNewCapture,
  walkthroughPath,
  writeStackedSnapshot,
  CANDYLAND_ID,
  TOYWORLD_ID,
  GAMING_ID,
} from "./helpers";

type StackedStory = {
  id: "candyland" | "toyworld" | "gamingstudio5000";
  title: string;
  projectId: string;
  steps: Array<{
    id: string;
    title: string;
    transcript: string;
    rawModelJson: unknown;
    expectedReview: "no_change" | "apply" | "needs_you" | "apply_or_no_change";
    bindTarget?: { domain: string; titleIncludes: string };
  }>;
};

const STACKED_STORIES = JSON.parse(
  readFileSync(join(process.cwd(), "e2e/fixtures/stacked-stories.json"), "utf8"),
) as StackedStory[];

function computeCaptureResult(input: {
  transcript: string;
  projectId: string;
  rawModelJson: unknown;
  bindTarget?: { domain: string; titleIncludes: string };
  state: unknown;
  clientState?: unknown;
}): { result: unknown } {
  const run = spawnSync(
    "npx",
    ["--yes", "tsx", "scripts/stacked-capture-step.ts"],
    {
      input: JSON.stringify(input),
      encoding: "utf8",
      cwd: process.cwd(),
      timeout: 25_000,
    },
  );
  if (run.status !== 0) {
    throw new Error(
      `stacked-capture-step failed: ${run.stderr || run.stdout || run.status}`,
    );
  }
  const text = (run.stdout || "").trim();
  const start = text.indexOf("{");
  if (start < 0) {
    throw new Error(`stacked-capture-step produced no JSON: ${text}`);
  }
  return JSON.parse(text.slice(start)) as { result: unknown };
}

async function mockAuthAndStackedCapture(page: Page, story: StackedStory) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });

  await mockCaptureApplyFromDurable(page);

  await page.route("**/api/capture", async (route) => {
    if (route.request().url().includes("/api/capture/apply")) {
      await route.fallback();
      return;
    }
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          openaiConfigured: true,
          captureV2Enabled: true,
          model: "frozen-stacked",
        },
      });
      return;
    }
    const body = route.request().postDataJSON() as {
      content?: string;
      projectId?: string;
      state?: unknown;
    };
    const transcript = (body.content ?? "").trim();
    const step =
      story.steps.find((s) => s.transcript.trim() === transcript) ??
      story.steps.find((s) => transcript.includes(s.transcript.trim().slice(0, 24)));
    if (!step) {
      await route.fulfill({
        status: 400,
        json: { error: `No stacked step for transcript: ${transcript.slice(0, 80)}` },
      });
      return;
    }
    const durable = await readMissionState(page);
    const computed = computeCaptureResult({
      transcript: step.transcript,
      projectId: body.projectId || story.projectId,
      rawModelJson: step.rawModelJson,
      bindTarget: step.bindTarget,
      state: durable,
      clientState: body.state,
    });
    await route.fulfill({
      json: {
        result: computed.result,
        openaiConfigured: true,
        captureV2Enabled: true,
        capturePipeline: "v2",
        requestId: `e2e-stacked-${step.id}`,
      },
    });
  });
}

async function assertReview(page: Page, expected: StackedStory["steps"][number]["expectedReview"]) {
  await dismissCoachIfPresent(page);
  if (expected === "needs_you") {
    await expect(page.getByText(/Needs Review|Needs you/i).first()).toBeVisible();
    await expect(page.locator(".capture-apply-ready-btn")).toHaveCount(0);
    return;
  }
  if (expected === "no_change") {
    await expect(
      page.getByText("Nothing to apply."),
    ).toBeVisible();
    return;
  }
  if (expected === "apply" || expected === "apply_or_no_change") {
    const noChange = page.getByText("Nothing to apply.");
    if (expected === "apply_or_no_change" && (await noChange.isVisible().catch(() => false))) {
      return;
    }
    await applyReadyIfPresent(page);
  }
}

async function runStory(page: Page, story: StackedStory) {
  await mockAuthAndStackedCapture(page, story);
  await openCapture(page, story.projectId);
  await expect(page.getByRole("heading", { name: new RegExp(story.id === "gamingstudio5000" ? "GamingStudio5000" : story.id === "toyworld" ? "Toyworld" : "Candyland", "i") })).toBeVisible();

  for (const [index, step] of story.steps.entries()) {
    if (index > 0) {
      await startNewCapture(page);
    }
    await analyseFrozenTranscript(page, step.transcript);
    await assertReview(page, step.expectedReview);
  }

  await openKnowledgeCentre(page);
}

function peopleFrame(page: Page) {
  return page.getByTestId("ocean-frame-people");
}

const only = process.env.STACKED_STORY;

test.describe("stacked Capture regression", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }, testInfo) => {
    await seedExperimentalWorlds(page, testInfo.testId);
  });

  test("candyland long-run sequential journey", async ({ page }) => {
    test.skip(Boolean(only && only !== "candyland" && only !== "all"), "STACKED_STORY filter");
    const story = STACKED_STORIES.find((s) => s.id === "candyland");
    if (!story) throw new Error("missing candyland story");
    await runStory(page, story);

    const people = peopleFrame(page);
    await expect(people.getByText("Pippa Gumdrop")).toBeVisible();
    await expect(people.getByText("Fizz Caramel")).toBeVisible();
    await expect(people.getByText("Marzipan Cole")).toHaveCount(0);
    await expect(people.getByText(/Away 5–12 Oct/)).toBeVisible();
    await expect(page.getByTestId("ocean-frame-risks").getByText("Gumdrop Bridge icing")).toHaveCount(0);
    await expect(page.getByTestId("ocean-frame-dates").getByText(/29 Oct/)).toBeVisible();
    await expect(page.getByTestId("ocean-frame-todo").getByText("Prepare the jelly pack")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-todo").getByText(/candy-cane banners/i)).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Candyland" })).toBeVisible();
    await openKnowledgeCentre(page);
    await expect(peopleFrame(page).getByText("Pippa Gumdrop")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-dates").getByText(/29 Oct/)).toBeVisible();
    await expect(page.getByTestId("ocean-frame-risks").getByText("Gumdrop Bridge icing")).toHaveCount(0);

    await page.goto(`/projects/${TOYWORLD_ID}`);
    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-todo").getByText("Print the track map")).toBeVisible();
    await expect(page.getByText(/candy-cane banners/i)).toHaveCount(0);
    await expect(peopleFrame(page).getByText("Pippa Gumdrop")).toHaveCount(0);

    const shot = walkthroughPath("stacked_candyland_final.png");
    if (shot) await page.screenshot({ path: shot, fullPage: true });
    await writeStackedSnapshot("stacked-e2e-candyland.json", await readMissionState(page));
  });

  test("toyworld identity and isolation journey", async ({ page }) => {
    test.skip(Boolean(only && only !== "toyworld" && only !== "all"), "STACKED_STORY filter");
    const story = STACKED_STORIES.find((s) => s.id === "toyworld");
    if (!story) throw new Error("missing toyworld story");
    await runStory(page, story);

    const people = peopleFrame(page);
    await expect(people.getByText("Velvet Sprocket")).toBeVisible();
    await expect(people.getByText("Brick Oakley")).toBeVisible();
    await expect(people.getByText("Captain Buttons")).toBeVisible();
    await expect(people.getByText("Velvet Sprocket")).toHaveCount(1);
    await expect(page.getByTestId("ocean-frame-risks").getByText("Packaging delay")).toBeVisible();

    await page.reload();
    await openKnowledgeCentre(page);
    await expect(peopleFrame(page).getByText("Velvet Sprocket")).toHaveCount(1);

    await page.goto(`/projects/${CANDYLAND_ID}`);
    await openKnowledgeCentre(page);
    await expect(peopleFrame(page).getByText("Pippa Gumdrop")).toBeVisible();
    await expect(peopleFrame(page).getByText("Velvet Sprocket")).toHaveCount(0);
    await expect(page.getByTestId("ocean-frame-risks").getByText("Gumdrop Bridge icing")).toBeVisible();

    await page.goto(`/projects/${GAMING_ID}`);
    await openKnowledgeCentre(page);
    await expect(peopleFrame(page).getByText("Pixel Ramos")).toBeVisible();
    await expect(peopleFrame(page).getByText("Velvet Sprocket")).toHaveCount(0);

    const shot = walkthroughPath("stacked_toyworld_isolation.png");
    if (shot) await page.screenshot({ path: shot, fullPage: true });
    await writeStackedSnapshot("stacked-e2e-toyworld.json", await readMissionState(page));
  });

  test("gamingstudio5000 correction and ambiguity journey", async ({ page }) => {
    test.skip(Boolean(only && only !== "gamingstudio5000" && only !== "all"), "STACKED_STORY filter");
    const story = STACKED_STORIES.find((s) => s.id === "gamingstudio5000");
    if (!story) throw new Error("missing gaming story");
    await runStory(page, story);

    const people = peopleFrame(page);
    await expect(people.getByText("Pixel Ramos")).toBeVisible();
    await expect(people.getByText(/Nova Quill/)).toHaveCount(0);
    await expect(page.getByTestId("ocean-frame-risks").getByText("Console certification slip")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-risks").getByText(/audio bus/i)).toBeVisible();
    await expect(page.getByTestId("ocean-frame-risks").getByText(/shader/i)).toBeVisible();
    await expect(page.getByTestId("ocean-frame-todo").getByText(/chiptune/i)).toHaveCount(0);

    await page.reload();
    await openKnowledgeCentre(page);
    await expect(peopleFrame(page).getByText("Pixel Ramos")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-risks").getByText(/audio bus/i)).toBeVisible();

    await page.goto(`/projects/${CANDYLAND_ID}`);
    await openKnowledgeCentre(page);
    await expect(peopleFrame(page).getByText("Pippa Gumdrop")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-risks").getByText(/audio bus/i)).toHaveCount(0);

    const shot = walkthroughPath("stacked_gaming_final.png");
    if (shot) await page.screenshot({ path: shot, fullPage: true });
    await writeStackedSnapshot("stacked-e2e-gamingstudio5000.json", await readMissionState(page));
  });
});
