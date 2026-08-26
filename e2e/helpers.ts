import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Page, expect } from "@playwright/test";

export const CANDYLAND_ID = "proj-candy";
export const TOYWORLD_ID = "proj-toy";
const STORAGE_KEY = "mission-control-state-v5";
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

export async function seedExperimentalWorlds(page: Page) {
  await page.addInitScript(
    ({ storageKey, sessionKey, stateJson }) => {
      window.localStorage.setItem(storageKey, stateJson);
      window.sessionStorage.removeItem(sessionKey);
    },
    {
      storageKey: STORAGE_KEY,
      sessionKey: CAPTURE_SESSION_KEY,
      stateJson: JSON.stringify(loadMissionState()),
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
  await page.getByTestId("ocean-mode-capture").click();
  await expect(page.getByTestId("ocean-capture-mode")).toBeVisible();
}

export async function analyseFrozenTranscript(page: Page, transcript: string) {
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
  const btn = page.locator(".capture-apply-ready-btn");
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await expect(page.getByText("Approved").first()).toBeVisible();
  }
}

export async function openKnowledgeCentre(page: Page) {
  await page.getByTestId("ocean-mode-knowledge").click();
  await expect(page.getByTestId("ocean-knowledge-centre")).toBeVisible();
}
