import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  loadMissionState,
  openKnowledgeCentre,
  readMissionState,
  seedMissionState,
} from "./helpers";

const PROJECT = "proj-candy";
const SHOTS = "/opt/cursor/artifacts/manual-add";
const ISSUE_TITLE = "Audit issue detail persists";
const ISSUE_NOTES = "This issue note must persist";
const KNOWLEDGE_BODY = "This knowledge detail must persist";
const TODO_TITLE = "Pack the spare ribbons";
const TODO_DETAIL = "Bring the gold twist ties";
const FALSE_HINT =
  "Close keeps the item and its history. Remove deletes it from the project entirely.";

type SavedState = {
  risks?: Array<{
    id: string;
    projectId: string;
    title: string;
    notes?: string | null;
  }>;
  todos?: Array<{
    id: string;
    projectId: string;
    title: string;
    detail?: string;
  }>;
  knowledge?: Array<{
    projectId: string;
    sections?: { now?: string[] };
  }>;
  history?: Array<{ title?: string; detail?: string; projectId?: string }>;
};

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test.beforeAll(async () => {
  await mkdir(SHOTS, { recursive: true });
});

test.beforeEach(async ({ page }, testInfo) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });
  await seedMissionState(page, loadMissionState(), testInfo.testId);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${PROJECT}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await openKnowledgeCentre(page);
});

test("Manual Add Issue stores Notes and shows them after reload", async ({
  page,
}) => {
  await page.getByTestId("ocean-add-item").click();
  await page.getByTestId("ocean-add-type-issue").click();
  await page.getByTestId("ocean-add-title").fill(ISSUE_TITLE);
  await page.getByTestId("ocean-add-detail").fill(`  ${ISSUE_NOTES}  `);
  await shot(page, "d-add-issue-notes");
  await page.getByTestId("ocean-add-save").click();
  await expect(page.getByTestId("ocean-add-item-drawer")).toBeHidden();

  const saved = (await readMissionState(page)) as SavedState;
  const risk = saved.risks?.find((item) => item.title === ISSUE_TITLE);
  expect(risk?.projectId).toBe(PROJECT);
  expect(risk?.notes).toBe(ISSUE_NOTES);
  expect(
    saved.risks?.some(
      (item) => item.projectId !== PROJECT && item.title === ISSUE_TITLE,
    ),
  ).toBe(false);
  const added = (saved.history ?? []).filter(
    (event) =>
      event.projectId === PROJECT && event.title === "You added an Issue",
  );
  expect(added.some((event) => event.detail === ISSUE_TITLE)).toBe(true);
  expect(
    (saved.history ?? []).some(
      (event) =>
        event.title === "Issue notes added" || event.detail === ISSUE_NOTES,
    ),
  ).toBe(false);

  await page.getByTestId(`kc-open-details-issue:${risk?.id}`).click();
  await expect(page.getByTestId("issue-detail-notes-body")).toHaveText(
    ISSUE_NOTES,
  );
  await shot(page, "d-issue-notes-reopened");

  await page.reload();
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await openKnowledgeCentre(page);
  await page.getByTestId(`kc-open-details-issue:${risk?.id}`).click();
  await expect(page.getByTestId("issue-detail-notes-body")).toHaveText(
    ISSUE_NOTES,
  );
  const reloaded = (await readMissionState(page)) as SavedState;
  expect(
    reloaded.risks?.find((item) => item.id === risk?.id)?.notes,
  ).toBe(ISSUE_NOTES);
});

test("Manual Add Knowledge offers one body and keeps it", async ({ page }) => {
  await page.getByTestId("ocean-add-item").click();
  await page.getByTestId("ocean-add-type-knowledge").click();
  await expect(page.getByTestId("ocean-add-knowledge-body")).toBeVisible();
  await expect(page.getByTestId("ocean-add-title")).toHaveCount(0);
  await expect(page.getByTestId("ocean-add-detail")).toHaveCount(0);
  await page.getByTestId("ocean-add-knowledge-body").fill(`  ${KNOWLEDGE_BODY}  `);
  await shot(page, "d-add-knowledge-body");
  await page.getByTestId("ocean-add-save").click();
  await expect(page.getByTestId("ocean-add-item-drawer")).toBeHidden();

  const saved = (await readMissionState(page)) as SavedState;
  const now =
    saved.knowledge?.find((item) => item.projectId === PROJECT)?.sections?.now ??
    [];
  expect(now.filter((body) => body === KNOWLEDGE_BODY)).toEqual([KNOWLEDGE_BODY]);

  await page
    .locator("[data-testid^='kc-item-now:']", { hasText: KNOWLEDGE_BODY })
    .getByRole("button", { name: "Open Details" })
    .click();
  await expect(page.getByTestId("ocean-item-detail-body")).toHaveText(
    KNOWLEDGE_BODY,
  );
  await expect(page.getByTestId("ocean-item-detail-drawer")).not.toContainText(
    FALSE_HINT,
  );
  await shot(page, "d-knowledge-detail");

  await page.reload();
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  const reloaded = (await readMissionState(page)) as SavedState;
  expect(
    reloaded.knowledge
      ?.find((item) => item.projectId === PROJECT)
      ?.sections?.now?.includes(KNOWLEDGE_BODY),
  ).toBe(true);
});

test("To Do keeps title and detail; Person has neither detail nor tags", async ({
  page,
}) => {
  await page.getByTestId("ocean-add-item").click();
  await page.getByTestId("ocean-add-type-todo").click();
  await expect(page.getByTestId("ocean-add-title")).toBeVisible();
  await expect(page.getByTestId("ocean-add-detail")).toBeVisible();
  await page.getByTestId("ocean-add-title").fill(TODO_TITLE);
  await page.getByTestId("ocean-add-detail").fill(TODO_DETAIL);
  await page.getByTestId("ocean-add-save").click();
  await expect(page.getByTestId("ocean-add-item-drawer")).toBeHidden();

  const saved = (await readMissionState(page)) as SavedState;
  const todo = saved.todos?.find((item) => item.title === TODO_TITLE);
  expect(todo?.detail).toBe(TODO_DETAIL);
  expect(todo?.projectId).toBe(PROJECT);

  await page.getByTestId(`kc-open-details-todo:${todo?.id}`).click();
  await expect(page.getByTestId("todo-detail-title")).toHaveText(TODO_TITLE);
  await expect(page.getByTestId("todo-detail-body-text")).toHaveText(TODO_DETAIL);
  await page.getByTestId("ocean-item-detail-back").click();

  await page.getByTestId("ocean-add-item").click();
  await page.getByTestId("ocean-add-type-person").click();
  await expect(page.getByTestId("ocean-add-title")).toBeVisible();
  await expect(page.getByTestId("ocean-add-detail")).toHaveCount(0);
  await expect(page.getByTestId("ocean-add-knowledge-body")).toHaveCount(0);
  await expect(page.getByTestId("ocean-tag-editor")).toHaveCount(0);
  await expect(page.getByText("Tags are hidden for people.")).toBeVisible();
});

test("Knowledge and Date details omit the false Close/Remove sentence", async ({
  page,
}) => {
  await page.locator("[data-testid^='kc-open-details-date:']").first().click();
  await expect(page.getByTestId("ocean-item-detail-drawer")).toBeVisible();
  await expect(page.getByTestId("ocean-item-detail-drawer")).not.toContainText(
    FALSE_HINT,
  );
  await page.getByTestId("ocean-item-detail-back").click();

  await page
    .locator("[data-testid^='kc-open-details-people-context']")
    .first()
    .click();
  await expect(page.getByTestId("ocean-item-detail-drawer")).toBeVisible();
  await expect(page.getByTestId("ocean-item-detail-drawer")).not.toContainText(
    FALSE_HINT,
  );
  await shot(page, "d-knowledge-no-false-footer");
  await page.getByTestId("ocean-item-detail-back").click();

  await page.getByTestId("kc-open-details-todo:todo-pack").click();
  await expect(page.getByTestId("ocean-item-detail-drawer")).toContainText(
    "Close completes this To Do and keeps the record. Remove deletes it from the project.",
  );
});

test("Ask noticed uses the lightbulb", async ({ page }) => {
  await page.route("**/api/tell-me", async (route) => {
    await route.fulfill({
      json: {
        result: {
          answer: "Parade day is 15 Oct.",
          confidence: "direct_confirmation",
          sources: [],
          noticed: ["The parade date is stored on the project."],
          needsConfirmation: [],
          scope: {
            mode: "project",
            projectId: PROJECT,
            projectCode: "CANDY",
            projectName: "Candyland",
          },
          freshness: {
            currentRevision: "e2e",
            snapshotRevision: null,
            snapshotCreatedAt: null,
            isStale: false,
            changeCountHint: 0,
            message: null,
          },
          refreshRecommended: false,
          refreshReason: null,
          coachHandoff: false,
          capturePrefill: null,
          usage: null,
          model: null,
          modelRequested: null,
          provider: "local",
          usedCanonicalTruth: true,
          contextStats: {
            projectsConsidered: 1,
            recordsSelected: 1,
            snapshotUsed: false,
            knowledgeItems: 1,
            structuredItems: 0,
            approxChars: 40,
          },
        },
      },
    });
  });

  await page.getByTestId("ocean-ask-input").fill("When is parade day?");
  await page.getByTestId("ocean-ask-send").click();
  const label = page.getByTestId("ocean-ask-noticed-label");
  await expect(label).toContainText("Lume noticed");
  await expect(label.getByTestId("lume-me-mark")).toBeVisible();
  await expect(label).not.toContainText("✦");
  await shot(page, "d-ask-noticed");
});

test("narrow Manual Add keeps one Knowledge body and a touch-safe Save", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("ocean-add-item").click();
  await page.getByTestId("ocean-add-type-knowledge").click();
  await expect(page.getByTestId("ocean-add-knowledge-body")).toBeVisible();
  await expect(page.getByTestId("ocean-add-title")).toHaveCount(0);
  await expect(page.getByTestId("ocean-add-detail")).toHaveCount(0);
  const knowledgeOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth + 1,
  );
  expect(knowledgeOverflow).toBe(true);
  const knowledgeSave = await page.getByTestId("ocean-add-save").boundingBox();
  expect(knowledgeSave?.height ?? 0).toBeGreaterThanOrEqual(44);
  await shot(page, "n-add-knowledge");

  await page.getByTestId("ocean-add-type-issue").click();
  await page.getByTestId("ocean-add-title").fill(ISSUE_TITLE);
  await page.getByTestId("ocean-add-detail").fill(ISSUE_NOTES);
  await expect(page.getByTestId("ocean-add-detail")).toBeVisible();
  const issueOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth + 1,
  );
  expect(issueOverflow).toBe(true);
  const issueSave = await page.getByTestId("ocean-add-save").boundingBox();
  expect(issueSave?.height ?? 0).toBeGreaterThanOrEqual(44);
  await shot(page, "n-add-issue-notes");
});
