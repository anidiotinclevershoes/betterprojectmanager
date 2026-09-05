import { spawnSync } from "node:child_process";
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
  seedMissionState,
  startNewCapture,
  writeStackedSnapshot,
  CANDYLAND_ID,
} from "./helpers";

function loadSupport(cmd: string): unknown {
  const run = spawnSync("npx", ["--yes", "tsx", "scripts/stress-e2e-support.ts", cmd], {
    encoding: "utf8",
    cwd: process.cwd(),
    timeout: 25_000,
  });
  if (run.status !== 0) {
    throw new Error(`stress-e2e-support ${cmd} failed: ${run.stderr || run.stdout}`);
  }
  const text = (run.stdout || "").trim();
  const start = text.indexOf("{") >= 0 ? text.indexOf("{") : text.indexOf("[");
  if (start < 0) throw new Error(`stress-e2e-support ${cmd} produced no JSON`);
  return JSON.parse(text.slice(start));
}

function computeCaptureResult(input: {
  transcript: string;
  projectId: string;
  rawModelJson: unknown;
  bindTarget?: { domain: string; titleIncludes: string };
  state: unknown;
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
    throw new Error(`stacked-capture-step failed: ${run.stderr || run.stdout}`);
  }
  const text = (run.stdout || "").trim();
  const start = text.indexOf("{");
  if (start < 0) throw new Error(`stacked-capture-step produced no JSON: ${text}`);
  return JSON.parse(text.slice(start)) as { result: unknown };
}

type SliceStep = {
  id: string;
  title: string;
  transcript: string;
  rawModelJson: unknown;
  expectedReview: string;
  bindTarget?: { domain: "todo" | "person" | "risk" | "milestone"; titleIncludes: string };
};

async function mockAuth(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });
}

async function mockStackedCapture(page: Page, projectId: string, steps: SliceStep[]) {
  await mockAuth(page);
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
          model: "frozen-stress",
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
      steps.find((s) => s.transcript.trim() === transcript) ??
      steps.find((s) => transcript.includes(s.transcript.trim().slice(0, 24)));
    if (!step) {
      await route.fulfill({
        status: 400,
        json: { error: `No stress step for transcript: ${transcript.slice(0, 80)}` },
      });
      return;
    }
    const durable = await readMissionState(page);
    const computed = computeCaptureResult({
      transcript: step.transcript,
      projectId: body.projectId || projectId,
      rawModelJson: step.rawModelJson,
      bindTarget: step.bindTarget,
      state: durable,
    });
    await route.fulfill({
      json: {
        result: computed.result,
        openaiConfigured: true,
        captureV2Enabled: true,
        capturePipeline: "v2",
        requestId: `e2e-stress-${step.id}`,
      },
    });
  });
}

test.describe("Harbourline deep stress slices", () => {
  test.describe.configure({ timeout: 180_000 });

  test("Deep Project Creation — paste → organise → create → reload", async ({
    page,
  }, testInfo) => {
    const payload = loadSupport("new-project-payload") as {
      pipeline: "v2";
      provisionalItems: unknown[];
      projectSeed: { name: string; summary: string; currentFocus: string };
      draft: { name: string };
      narrative: string;
    };
    await seedExperimentalWorlds(page, testInfo.testId);
    await mockAuth(page);
    await page.route("**/api/new-project", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
        return;
      }
      await route.fulfill({
        json: {
          pipeline: "v2",
          openaiConfigured: true,
          provider: "frozen-stress",
          provisionalItems: payload.provisionalItems,
          projectSeed: payload.projectSeed,
          draft: payload.draft,
        },
      });
    });

    await page.goto("/projects/new");
    await page.getByText("Organise notes", { exact: true }).click();
    await page.getByTestId("np-organise-notes").fill(payload.narrative);
    await page.getByTestId("np-organise").click();
    await expect(page.getByTestId("np-frame-people").getByText("Miriam Cole")).toBeVisible({
      timeout: 20_000,
    });
    // Shared Capture extract does not invent Objective. The user types the
    // evidenced name before create.
    await expect(page.getByTestId("np-summary")).toHaveValue("");
    await page.getByTestId("np-name").fill("Harbourline Civic Archive Refresh");
    await page.getByTestId("np-create").click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Harbourline Civic Archive Refresh/i,
      }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-people").getByText("Miriam Cole")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-people").getByText("Owen Hart").first()).toBeVisible();
    await expect(page.getByText(/cinnamon bun/i)).toHaveCount(0);
    const before = await readMissionState(page);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Harbourline Civic Archive Refresh/i,
      }),
    ).toBeVisible();
    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-people").getByText("Miriam Cole")).toBeVisible();
    await page.goto(`/projects/${CANDYLAND_ID}`);
    await expect(page.getByRole("heading", { name: /Candyland/i })).toBeVisible();
    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-people").getByText("Pippa Gumdrop")).toBeVisible();
    await writeStackedSnapshot("stress-deep-creation-e2e.json", {
      beforePeople: (before as { projects?: Array<{ name: string; stakeholders?: unknown[] }> })?.projects?.find(
        (p) => /harbourline/i.test(p.name),
      )?.stakeholders,
    });
  });

  test("Capture Marathon slice — easy write, first-name Needs you, later Person", async ({
    page,
  }, testInfo) => {
    const slice = loadSupport("marathon-slice") as { projectId: string; steps: SliceStep[] };
    await seedMissionState(page, loadSupport("seed-early"), testInfo.testId);
    await mockStackedCapture(page, slice.projectId, slice.steps);
    await openCapture(page, slice.projectId);
    await expect(page.getByRole("heading", { name: /Harbourline/i })).toBeVisible();

    await analyseFrozenTranscript(page, slice.steps[0].transcript);
    await applyReadyIfPresent(page);

    await startNewCapture(page);
    await analyseFrozenTranscript(page, slice.steps[1].transcript);
    await expect(page.locator(".capture-apply-ready-btn")).toHaveCount(0);

    await startNewCapture(page);
    await analyseFrozenTranscript(page, slice.steps[2].transcript);
    await applyReadyIfPresent(page);

    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-people").getByText("Quinn Adler")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-people").getByText("Robin")).toHaveCount(0);
    await page.reload();
    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-people").getByText("Quinn Adler")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-people").getByText("Miriam Cole")).toBeVisible();
  });

  test("PM handover slice — clear Person, stale-date Review, first-name Sarah", async ({
    page,
  }, testInfo) => {
    const slice = loadSupport("handover-slice") as { projectId: string; steps: SliceStep[] };
    await seedMissionState(page, loadSupport("seed-mature"), testInfo.testId);
    await mockStackedCapture(page, slice.projectId, slice.steps);
    await openCapture(page, slice.projectId);
    await expect(page.getByRole("heading", { name: /Harbourline/i })).toBeVisible();

    await analyseFrozenTranscript(page, slice.steps[0].transcript);
    await applyReadyIfPresent(page);

    await startNewCapture(page);
    await analyseFrozenTranscript(page, slice.steps[1].transcript);
    await expect(page.getByTestId("ocean-capture-review")).toBeVisible();
    // Do not apply the stale-date envelope here. Node stress applies it to
    // observe durable mutation. This slice proves Review still gates the write.

    await startNewCapture(page);
    await analyseFrozenTranscript(page, slice.steps[2].transcript);
    await expect(page.locator(".capture-apply-ready-btn")).toHaveCount(0);

    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-people").getByText("Quinn Adler")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-people").getByText("Sarah")).toHaveCount(0);
    await expect(page.getByTestId("ocean-frame-dates").getByText(/9 Oct|09 Oct|Oct 9/i)).toBeVisible();
    await page.reload();
    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-people").getByText("Quinn Adler")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-people").getByText("Daniel Okonkwo")).toBeVisible();
  });
});
