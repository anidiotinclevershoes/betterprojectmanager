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
  walkthroughPath,
} from "./helpers";

test.describe("Capture V2 frozen journeys", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await seedExperimentalWorlds(page, testInfo.testId);
  });

  test("existing Person — no duplicate stakeholder after review", async ({
    page,
  }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(page, "existing-person");
    await openCapture(page);
    await expect(page.getByRole("heading", { name: "Candyland" })).toBeVisible();
    await analyseFrozenTranscript(page, frozen.transcript);
    await expect(
      page.getByText("Nothing to apply."),
    ).toBeVisible();
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
    await expect(page.getByRole("button", { name: /Apply Ready/i })).toBeVisible();
    const riskShot = walkthroughPath("capture_v2_risk_review.png");
    if (riskShot) await page.screenshot({ path: riskShot, fullPage: true });
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
    await expect(dates.getByText(/29 Oct/)).toBeVisible();
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
    await expect(people.getByText(/Away 5–12 Oct/)).toBeVisible();
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
    const todoShot = walkthroughPath("capture_v2_todo_on_board.png");
    if (todoShot) await page.screenshot({ path: todoShot, fullPage: true });
  });

  test("Needs you — share vs replace is not Apply Ready", async ({ page }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(
      page,
      "share-vs-replace-ambiguous",
    );
    await openCapture(page);
    await analyseFrozenTranscript(page, frozen.transcript);
    await expect(page.getByText(/Needs Review|Needs you/i).first()).toBeVisible();
    await expect(page.getByTestId("review-ownership-choice")).toBeVisible();
    await expect(
      page.getByText(/Pippa Gumdrop already owns UAT lead/i),
    ).toBeVisible();
    await expect(page.getByTestId("review-ownership-share")).toBeVisible();
    await expect(page.getByTestId("review-ownership-replace")).toBeVisible();
    await expect(page.getByTestId("review-ownership-keep")).toBeVisible();
    await expect(page.locator(".capture-apply-ready-btn")).toHaveCount(0);
    await page.getByTestId("review-ownership-keep").click();
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
    const isoShot = walkthroughPath("capture_v2_toyworld_isolation.png");
    if (isoShot) await page.screenshot({ path: isoShot, fullPage: true });
  });
});

test.describe("Capture Review Needs-you interactions", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await seedExperimentalWorlds(page, testInfo.testId);
  });

  test("sibling Apply Ready does not freeze the ownership card", async ({
    page,
  }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(
      page,
      "sibling-ready-and-needs-you",
    );
    await openCapture(page);
    await analyseFrozenTranscript(page, frozen.transcript);
    await expect(page.getByTestId("review-ownership-choice")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Apply Ready \(1\)/i }),
    ).toBeVisible();
    await applyReadyIfPresent(page);
    await expect(page.getByTestId("review-ownership-choice")).toBeVisible();
    await expect(
      page.getByText(/Fizz Caramel|Share with Fizz/i).first(),
    ).toBeVisible();
    await page.getByTestId("review-ownership-share").click();
    await expect(page.getByText("Approved").first()).toBeVisible();
  });

  test("missing milestone date asks for a date and does not invent today", async ({
    page,
  }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(
      page,
      "milestone-date-missing",
    );
    await openCapture(page);
    await analyseFrozenTranscript(page, frozen.transcript);
    await expect(page.getByTestId("review-missing-date")).toBeVisible();
    await expect(page.getByText(/What date should I use for Parade day/i)).toBeVisible();
    const dateInput = page.getByTestId("review-missing-date-input");
    await expect(dateInput).toHaveValue("");
    await dateInput.fill("2026-10-29");
    await page.getByTestId("review-missing-date-apply").click();
    await openKnowledgeCentre(page);
    await expect(page.getByTestId("ocean-frame-dates").getByText("Parade day")).toBeVisible();
    await expect(page.getByTestId("ocean-frame-dates").getByText(/29 Oct/)).toBeVisible();
  });

  test("named existing target offers update vs create, without fuzzy matching", async ({
    page,
  }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(
      page,
      "existing-or-new-uncertain",
    );
    await openCapture(page, TOYWORLD_ID);
    await analyseFrozenTranscript(page, frozen.transcript);
    await expect(page.getByTestId("review-existing-or-new")).toBeVisible();
    await expect(
      page.getByText(/existing “Packaging delay” risk/i),
    ).toBeVisible();
    await expect(page.getByTestId("review-existing-or-new-update")).toHaveText(
      /Update Packaging delay/,
    );
    await expect(page.getByTestId("review-existing-or-new-create")).toHaveText(
      /Create a new risk/,
    );
    await page.getByTestId("review-existing-or-new-update").click();
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  });
});

test.describe("Capture experience — annotated transcript", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await seedExperimentalWorlds(page, testInfo.testId);
  });

  test("matched evidence is highlighted; mixed siblings stay independent", async ({
    page,
  }) => {
    const frozen = await mockLocalAuthAndFrozenCapture(
      page,
      "sibling-ready-and-needs-you",
    );
    await openCapture(page);
    await expect(page.getByPlaceholder("Tell Lume what changed…")).toBeVisible();
    const inputShot = walkthroughPath("capture_experience_input.png");
    if (inputShot) await page.screenshot({ path: inputShot, fullPage: true });
    await analyseFrozenTranscript(page, frozen.transcript);

    const notes = page.getByTestId("annotated-transcript");
    await expect(notes).toBeVisible();
    const body = notes.locator(".annotated-transcript-body");
    await expect(body).toContainText(
      "The icing on Gumdrop Bridge has melted; that risk is closed.",
    );
    await expect(body).toContainText(
      "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it.",
    );
    const marks = notes.getByTestId("transcript-mark");
    await expect(marks).toHaveCount(2);
    await expect(notes.locator('[data-category="risks"]')).toContainText(
      "Gumdrop Bridge",
    );
    await expect(notes.locator('[data-category="people"]')).toContainText(
      "Fizz Caramel",
    );
    await expect(page.getByText("Needs you").first()).toBeVisible();
    await expect(page.getByTestId("review-ownership-choice")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Apply Ready \(1\)/i }),
    ).toBeVisible();
    const annotatedShot = walkthroughPath("capture_experience_annotated.png");
    if (annotatedShot) await page.screenshot({ path: annotatedShot, fullPage: true });
  });

  test("Needs-you choices stay tappable on a narrow viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const frozen = await mockLocalAuthAndFrozenCapture(
      page,
      "share-vs-replace-ambiguous",
    );
    await openCapture(page);
    await analyseFrozenTranscript(page, frozen.transcript);
    const share = page.getByTestId("review-ownership-share");
    await expect(share).toBeVisible();
    const box = await share.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    await expect(page.getByTestId("review-ownership-replace")).toBeVisible();
    await expect(page.getByTestId("annotated-transcript")).toBeVisible();
    const mobileShot = walkthroughPath("capture_experience_mobile_needs_you.png");
    if (mobileShot) await page.screenshot({ path: mobileShot, fullPage: true });
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
