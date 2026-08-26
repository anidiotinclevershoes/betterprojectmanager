import { test, expect } from "@playwright/test";
import {
  dismissCoachIfPresent,
  openKnowledgeCentre,
  readMissionState,
  seedExperimentalWorlds,
  CANDYLAND_ID,
} from "./helpers";

test.describe("Tell Me server-truth smoke", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await seedExperimentalWorlds(page, testInfo.testId);
  });

  test("Ask Lume sends intent only, shows answer, leaves project unchanged", async ({
    page,
  }) => {
    const tellMeBodies: unknown[] = [];

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        json: { persistence: "local", mode: "none", user: null },
      });
    });

    await page.route("**/api/tell-me", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ json: { error: "method" }, status: 405 });
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      tellMeBodies.push(body);
      await route.fulfill({
        json: {
          result: {
            answer:
              "Gumdrop Bridge icing is recorded as a Candyland risk.",
            confidence: "direct_confirmation",
            sources: [],
            noticed: [],
            needsConfirmation: [],
            scope: {
              mode: "project",
              projectId: CANDYLAND_ID,
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
              structuredItems: 1,
              approxChars: 120,
            },
          },
        },
      });
    });

    await page.goto(`/projects/${CANDYLAND_ID}`);
    await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
    await dismissCoachIfPresent(page);
    await openKnowledgeCentre(page);

    const before = await readMissionState(page);

    await page.getByTestId("ocean-ask-input").fill(
      "What is the status of Gumdrop Bridge icing?",
    );
    await page.getByTestId("ocean-ask-send").click();

    await expect(page.getByTestId("ocean-ask-answer")).toBeVisible();
    await expect(
      page.getByText("Gumdrop Bridge icing is recorded as a Candyland risk."),
    ).toBeVisible();

    expect(tellMeBodies).toHaveLength(1);
    const sent = tellMeBodies[0] as Record<string, unknown>;
    expect(sent.question).toBe("What is the status of Gumdrop Bridge icing?");
    expect(sent.projectId).toBe(CANDYLAND_ID);
    expect(sent).not.toHaveProperty("state");
    expect(sent).not.toHaveProperty("snapshot");

    const after = await readMissionState(page);
    expect(after).toEqual(before);
  });
});
