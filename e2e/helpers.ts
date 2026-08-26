import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Page, expect } from "@playwright/test";

export function walkthroughPath(name: string): string | null {
  if (!process.env.WALKTHROUGH) return null;
  return `/opt/cursor/artifacts/screenshots/${name}`;
}

export const CANDYLAND_ID = "proj-candy";
export const TOYWORLD_ID = "proj-toy";
export const GAMING_ID = "proj-game";
export const STORAGE_KEY = "mission-control-state-v5";
const CAPTURE_SESSION_KEY = "lume-capture-session-v1";
const FIXTURES = join(process.cwd(), "e2e/fixtures");

export function loadMissionState() {
  return JSON.parse(
    readFileSync(join(FIXTURES, "mission-state.json"), "utf8"),
  ) as unknown;
}

export function loadFrozenCapture(caseId: string): {
  caseId: string;
  transcript: string;
  result: unknown;
} {
  return JSON.parse(
    readFileSync(join(FIXTURES, "capture-results", `${caseId}.json`), "utf8"),
  ) as { caseId: string; transcript: string; result: unknown };
}

export async function seedExperimentalWorlds(page: Page, testId: string) {
  await page.addInitScript(
    ({ storageKey, sessionKey, stateJson, testId: runId }) => {
      const marker = "lume-e2e-run";
      if (window.sessionStorage.getItem(marker) === runId) return;
      window.localStorage.setItem(storageKey, stateJson);
      window.sessionStorage.removeItem(sessionKey);
      window.sessionStorage.setItem(marker, runId);
    },
    {
      storageKey: STORAGE_KEY,
      sessionKey: CAPTURE_SESSION_KEY,
      stateJson: JSON.stringify(loadMissionState()),
      testId,
    },
  );
}

export async function mockLocalAuthAndFrozenCapture(page: Page, caseId: string) {
  const frozen = loadFrozenCapture(caseId);

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });

  await page.route("**/api/capture", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          openaiConfigured: true,
          captureV2Enabled: true,
          model: "frozen-fixture",
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        result: frozen.result,
        openaiConfigured: true,
        captureV2Enabled: true,
        requestId: "e2e-frozen",
      },
    });
  });

  return frozen;
}

export async function openCapture(page: Page, projectId = CANDYLAND_ID) {
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await dismissCoachIfPresent(page);
  await page.getByTestId("ocean-mode-capture").click();
  await expect(page.getByTestId("ocean-capture-mode")).toBeVisible();
  await dismissCoachIfPresent(page);
}

export async function dismissCoachIfPresent(page: Page) {
  const dialog = page.getByRole("dialog").filter({
    hasText: "Ready when you are",
  });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button").first().click();
    await expect(dialog).toBeHidden();
  }
}

export async function analyseFrozenTranscript(page: Page, transcript: string) {
  await dismissCoachIfPresent(page);
  await page.getByTestId("ocean-capture-input").fill(transcript);
  const analyse = page.getByTestId("ocean-capture-analyse");
  if (await analyse.isEnabled()) {
    await analyse.click();
  }
  const anyway = page.getByRole("button", { name: "Analyse anyway" });
  if (await anyway.isVisible().catch(() => false)) {
    await anyway.click();
  }
  await expect(page.getByText("Review Changes")).toBeVisible({ timeout: 20_000 });
}

export async function applyReadyIfPresent(page: Page) {
  await dismissCoachIfPresent(page);
  const applyReady = page.getByRole("button", { name: /Apply Ready/i });
  if ((await applyReady.count()) > 0) {
    await applyReady.click();
    await expect(page.getByText("Approved").first()).toBeVisible();
    return;
  }
  const resolveRisk = page.getByRole("button", { name: /Resolve Risk|Resolve/i });
  if ((await resolveRisk.count()) > 0) {
    await resolveRisk.first().click();
    await expect(page.getByText("Approved").first()).toBeVisible();
    return;
  }
  const approve = page.getByRole("button", { name: "Approve" });
  if ((await approve.count()) > 0) {
    await approve.first().click();
    await expect(page.getByText("Approved").first()).toBeVisible();
  }
}

export async function openKnowledgeCentre(page: Page) {
  await dismissCoachIfPresent(page);
  await page.getByTestId("ocean-mode-knowledge").click();
  await expect(page.getByTestId("ocean-knowledge-centre")).toBeVisible();
}

export async function startNewCapture(page: Page) {
  await dismissCoachIfPresent(page);
  await page.getByRole("button", { name: "New Capture" }).click();
  await expect(page.getByTestId("ocean-capture-input")).toBeVisible();
}

export async function readMissionState(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  }, STORAGE_KEY);
}

export async function writeStackedSnapshot(name: string, value: unknown) {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "test-results");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(value, null, 2));
}
