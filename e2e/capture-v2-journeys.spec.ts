import { test, expect } from "@playwright/test";
import {
  analyseFrozenTranscript,
  applyReadyIfPresent,
  mockLocalAuthAndFrozenCapture,
  openCapture,
  openKnowledgeCentre,
  seedExperimentalWorlds,
  CANDYLAND_ID,
  TOYWORLD_ID,
} from "./helpers";

test.describe("Capture V2 frozen journeys", () => {
  test.beforeEach(async ({ page }) => {
    await seedExperimentalWorlds(page);
  });

  test("existing Person — no duplicate stakeholder after review", async ({
    page,
  }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(page, "existing-person");
    await openCapture(page);
    await expect(page.getByRole("heading", { name: "Candyland" })).toBeVisible();
    await analyseFrozenTranscript(page, frozen.transcript);
    await expect(page.getByText(/already known|No operational changes/i)).toBeVisible();
    await openKnowledgeCentre(page);
    const people = page.getByTestId("ocean-frame-people");
    await expect(people.getByText("Pippa Gumdrop")).toBeVisible();
    await expect(people.getByText("Fizz Caramel")).toBeVisible();
    await expect(people.getByText("Marzipan Cole")).toHaveCount(0);
    await page.reload();
    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-people").getByText("Pippa Gumdrop")).toBeVisible();
  });

  test("Risk resolution — authoritative risk domain, not a To Do", async ({
    page,
  }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(page, "risk-resolution");
    await openCapture(page);
    await analyseFrozenTranscript(page, frozen.transcript);
    await expect(page.getByText(/Risk/i).first()).toBeVisible();
    await applyReadyIfPresent(page);
    await openKnowledgeCentre(page);
    const risks = page.getByTestId("ocean-frame-risks");
    await expect(risks.getByText("Gumdrop Bridge icing")).toHaveCount(0);
    const todos = page.getByTestId("ocean-frame-todo");
    await expect(todos.getByText(/Gumdrop Bridge icing/)).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByTestId("ocean-frame-risks").getByText("Gumdrop Bridge icing"),
    ).toHaveCount(0);
  });

  test("milestone date move — Parade day updates, not a To Do", async ({
    page,
  }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(page, "milestone-move");
    await openCapture(page);
    await analyseFrozenTranscript(page, frozen.transcript);
    await applyReadyIfPresent(page);
    await openKnowledgeCentre(page);
    const dates = page.getByTestId("ocean-frame-dates");
    await expect(dates.getByText("Parade day")).toBeVisible();
    await expect(dates.getByText(/29/)).toBeVisible();
    await expect(
      page.getByTestId("ocean-frame-todo").getByText(/Parade day/),
    ).toHaveCount(0);
  });

  test("availability — existing Person, visible on People", async ({
    page,
  }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(page, "availability");
    await openCapture(page);
    await analyseFrozenTranscript(page, frozen.transcript);
    await applyReadyIfPresent(page);
    await openKnowledgeCentre(page);
    const people = page.getByTestId("ocean-frame-people");
    await expect(people.getByText("Fizz Caramel")).toBeVisible();
    await expect(people.getByText(/5|Oct/i).first()).toBeVisible();
  });

  test("To Do create — appears on Candyland board", async ({ page }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(page, "todo-create");
    await openCapture(page);
    await analyseFrozenTranscript(page, frozen.transcript);
    await applyReadyIfPresent(page);
    await openKnowledgeCentre(page);
    await expect(
      page.getByTestId("ocean-frame-todo").getByText(/candy-cane banners/i),
    ).toBeVisible();
    await expect(
      page.getByTestId("ocean-frame-todo").getByText("Prepare the jelly pack"),
    ).toBeVisible();
  });

  test("Needs you — share vs replace is not Apply Ready", async ({ page }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(
      page,
      "share-vs-replace-ambiguous",
    );
    await openCapture(page);
    await analyseFrozenTranscript(page, frozen.transcript);
    await expect(page.getByText(/Needs Review|Needs you/i).first()).toBeVisible();
    await expect(page.locator(".capture-apply-ready-btn")).toHaveCount(0);
    await openKnowledgeCentre(page);
    await expect(
      page.getByTestId("ocean-frame-people").getByText("Pippa Gumdrop"),
    ).toBeVisible();
  });

  test("project isolation + reload parity", async ({ page }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(page, "todo-create");
    await openCapture(page, CANDYLAND_ID);
    await analyseFrozenTranscript(page, frozen.transcript);
    await applyReadyIfPresent(page);
    await openKnowledgeCentre(page);
    await expect(
      page.getByTestId("ocean-frame-todo").getByText(/candy-cane banners/i),
    ).toBeVisible();

    await page.goto(`/projects/${TOYWORLD_ID}`);
    await expect(page.getByRole("heading", { name: "Toyworld" })).toBeVisible();
    await openKnowledgeCentre(page);
    await expect(
      page.getByTestId("ocean-frame-todo").getByText(/candy-cane banners/i),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("ocean-frame-todo").getByText("Print the track map"),
    ).toBeVisible();
    await expect(
      page.getByTestId("ocean-frame-risks").getByText("Packaging delay"),
    ).toBeVisible();
    await expect(
      page.getByTestId("ocean-frame-people").getByText("Brick Oakley"),
    ).toBeVisible();
    await expect(page.getByText("Pippa Gumdrop")).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Toyworld" })).toBeVisible();
    await expect(
      page.getByTestId("ocean-frame-todo").getByText("Print the track map"),
    ).toBeVisible();
    await expect(page.getByText(/candy-cane banners/i)).toHaveCount(0);
  });
});

test.describe("optional live-model smoke (isolated from CI)", () => {
  test.skip(
    !process.env.EVAL_CAPTURE_V2_LIVE_SMOKE || !process.env.OPENAI_API_KEY,
    "Set EVAL_CAPTURE_V2_LIVE_SMOKE=1 and OPENAI_API_KEY to run.",
  );

  test("live smoke is documented as opt-in only", async () => {
    expect(process.env.EVAL_CAPTURE_V2_LIVE_SMOKE).toBe("1");
  });
});
