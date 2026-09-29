import { expect, test, type Page } from "@playwright/test";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import type { MissionState } from "../src/lib/types";
import { openKnowledgeCentre, seedMissionState } from "./helpers";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const ALEX_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALEX_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MARIA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DAN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SAM = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RESP_SITE = "12121212-1212-4121-8121-121212121212";
const RESP_BUDGET = "34343434-3434-4343-8343-343434343434";
const RESP_CUT_MARIA = "56565656-5656-4565-8565-565656565656";
const RESP_CUT_DAN = "78787878-7878-4787-8787-787878787878";
const RESP_OLD = "90909090-9090-4909-8909-909090909090";
const AVAIL = "abababab-abab-4aba-8aba-abababababab";

function responsibility(
  id: string,
  personId: string,
  personName: string,
  scope: string,
  lifecycle: CanonicalTruthItem["lifecycle"] = "current",
): CanonicalTruthItem {
  return {
    id,
    projectId: PROJECT,
    section: "people",
    body: `${personName} — ${scope}`,
    kind: "responsibility",
    epistemic: "confirmed",
    lifecycle,
    meta: {
      responsibility: {
        personId,
        personName,
        scope,
        ownerConfirmed: true,
      },
    },
  };
}

function personState(): MissionState {
  const state = emptyMissionState();
  state.projects = [
    {
      id: PROJECT,
      name: "Bridge",
      code: "BRG",
      summary: "",
      status: "healthy",
      currentFocus: "",
      stakeholders: [
        { id: ALEX_A, name: "Alex Morgan", role: "Supplier liaison" },
        { id: ALEX_B, name: "Alex Morgan", role: "Finance partner" },
        {
          id: MARIA,
          name: "Maria Chen",
          role: "Supplier contact",
          lastContactAt: "2026-09-16T11:20:00.000Z",
          concerns: ["Cut-over weekend"],
          preferences: ["Morning calls"],
        },
        { id: DAN, name: "Dan Roberts", role: "Operations" },
        { id: SAM, name: "Sam Lee", role: "" },
      ],
    },
  ];
  const knowledge = emptyKnowledge(PROJECT);
  knowledge.sections.people = [
    "Maria Chen usually works Fridays in the office and is away next week.",
  ];
  knowledge.structured = [
    responsibility(RESP_SITE, ALEX_A, "Alex Morgan", "Site access"),
    responsibility(RESP_BUDGET, ALEX_B, "Alex Morgan", "Budget sign-off"),
    responsibility(RESP_CUT_MARIA, MARIA, "Maria Chen", "Cut-over communications"),
    responsibility(RESP_CUT_DAN, DAN, "Dan Roberts", "Cut-over communications"),
    responsibility(RESP_OLD, MARIA, "Maria Chen", "Launch checklist", "historical"),
    {
      id: AVAIL,
      projectId: PROJECT,
      section: "people",
      body: "Away 29 Sep–2 Oct",
      kind: "availability",
      epistemic: "confirmed",
      lifecycle: "current",
      meta: { personId: MARIA },
    },
  ];
  state.knowledge = [knowledge];
  state.todos = [
    {
      id: "todo-exact",
      projectId: PROJECT,
      title: "Confirm supplier cut-over window",
      done: false,
      createdAt: "2026-09-16T11:20:00.000Z",
      waitingOn: "Maria Chen",
    },
    {
      id: "todo-joined",
      projectId: PROJECT,
      title: "Joined waiting string must stay hidden",
      done: false,
      createdAt: "2026-09-16T11:20:00.000Z",
      waitingOn: "Maria Chen and Dan Roberts",
    },
  ];
  state.history = [
    {
      id: "hist-person-sample",
      type: "other",
      title: "Person added to the project",
      detail: "Maria Chen joined",
      projectId: PROJECT,
      createdAt: "2026-09-01T09:00:00.000Z",
      source: "system",
      targetKind: null,
      targetId: null,
    },
  ];
  state.projectTags = [
    {
      id: "tag-people",
      projectId: PROJECT,
      name: "Supplier",
      slug: "supplier",
      origin: "custom",
    },
  ];
  state.itemTags = [
    {
      id: "link-maria",
      projectId: PROJECT,
      tagId: "tag-people",
      targetKind: "stakeholder",
      targetId: MARIA,
    },
  ];
  return state;
}

async function boot(page: Page, testId: string, width = 1440, height = 900) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: { persistence: "local", mode: "none", user: null },
    });
  });
  await seedMissionState(page, personState(), testId);
  await page.setViewportSize({ width, height });
  await page.goto(`/projects/${PROJECT}`);
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible();
  await openKnowledgeCentre(page);
}

async function openPerson(page: Page, personId: string) {
  await page.getByTestId(`kc-open-details-person:${personId}`).click();
  const drawer = page.getByTestId("ocean-item-detail-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("data-person-detail", "true");
  return drawer;
}

test("Person detail shows bundle fields and omits stale actions", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  const drawer = await openPerson(page, MARIA);
  await expect(drawer.getByTestId("person-detail-name")).toHaveText("Maria Chen");
  await expect(drawer.getByTestId("person-detail-role")).toHaveText(
    "Supplier contact",
  );
  await expect(drawer.locator(".lume-domain-badge[data-domain='people']")).toHaveText(
    "Person",
  );
  await expect(drawer.getByTestId("person-detail-last-contact")).toHaveText("16 Sep");
  await expect(drawer.getByTestId("person-detail-responsibility")).toContainText(
    "Cut-over communications",
  );
  await expect(drawer.getByTestId("person-detail-shared")).toContainText(
    "Shared with Dan Roberts",
  );
  await expect(drawer.getByTestId("person-detail-previous")).toContainText(
    "Previous responsibilities",
  );
  await expect(drawer.getByTestId("person-detail-previous")).toContainText(
    "Launch checklist",
  );
  await expect(drawer.getByTestId("person-detail-availability")).toContainText(
    "Away 29 Sep–2 Oct",
  );
  await expect(drawer.getByTestId("person-detail-availability")).not.toContainText(
    "Fridays",
  );
  await expect(drawer.getByTestId("person-detail-legacy")).toContainText("Fridays");
  await expect(drawer.getByTestId("person-detail-waiting")).toContainText(
    "Confirm supplier cut-over window",
  );
  await expect(drawer.getByTestId("person-detail-waiting")).not.toContainText(
    "Joined waiting",
  );
  await expect(drawer.getByTestId("ocean-item-history-limited")).toContainText("D-004");
  await expect(drawer.getByText("Person added to the project")).toHaveCount(0);
  await expect(drawer.getByText("Last updated")).toHaveCount(0);
  await expect(drawer.getByText("Added", { exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("heading", { name: "Tags" })).toHaveCount(0);
  await expect(drawer.getByText("Supplier", { exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Edit person" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: /Remove/ })).toHaveCount(0);
  await expect(drawer.getByText("Cut-over weekend")).toHaveCount(0);
  await expect(drawer.getByText("Morning calls")).toHaveCount(0);
  await page.screenshot({
    path: "/opt/cursor/artifacts/person-detail-rich.png",
    fullPage: false,
  });
});

test("Person without availability or history stays honest", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  const drawer = await openPerson(page, SAM);
  await expect(drawer.getByTestId("person-detail-name")).toHaveText("Sam Lee");
  await expect(drawer.getByTestId("person-detail-role")).toHaveText(
    "No role recorded.",
  );
  await expect(drawer.getByTestId("person-detail-last-contact")).toHaveCount(0);
  await expect(drawer.getByTestId("person-detail-availability")).toHaveCount(0);
  await expect(drawer.getByTestId("person-detail-waiting")).toHaveCount(0);
  await expect(drawer.getByTestId("person-detail-previous")).toHaveCount(0);
  await expect(drawer.getByTestId("ocean-item-history-limited")).toContainText("D-004");
  await expect(drawer.getByTestId("person-detail-add")).toBeVisible();
  await page.screenshot({
    path: "/opt/cursor/artifacts/person-detail-sparse.png",
    fullPage: false,
  });
});

test("same display name stays tied to the stable person id", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  const first = await openPerson(page, ALEX_A);
  await expect(first.getByTestId("person-detail-role")).toHaveText("Supplier liaison");
  await expect(first.getByTestId("person-detail-responsibility")).toContainText(
    "Site access",
  );
  await expect(first.getByText("Budget sign-off")).toHaveCount(0);
  await first.getByTestId("person-detail-close").click();
  const second = await openPerson(page, ALEX_B);
  await expect(second.getByTestId("person-detail-role")).toHaveText("Finance partner");
  await expect(second.getByTestId("person-detail-responsibility")).toContainText(
    "Budget sign-off",
  );
  await expect(second.getByText("Site access")).toHaveCount(0);
});

test("Add responsibility prefills Confirm Owner and keeps share versus replace", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  const drawer = await openPerson(page, SAM);
  await drawer.getByTestId("person-detail-add").click();
  await expect(page.getByTestId("confirm-owner-dialog")).toBeVisible();
  await expect(page.getByTestId("confirm-owner-scope-input")).toHaveValue("");
  await expect(page.getByTestId("confirm-owner-person-select")).toHaveValue("Sam Lee");
  await page.getByTestId("confirm-owner-scope-input").fill("Cut-over communications");
  await expect(page.getByTestId("confirm-owner-intent")).toBeVisible();
  await expect(page.getByTestId("confirm-owner-intent-share")).toBeVisible();
  await expect(page.getByTestId("confirm-owner-intent-replace")).toBeVisible();
  await page.getByTestId("confirm-owner-intent-replace").check();
  await expect(page.getByTestId("confirm-owner-replace-select")).toBeVisible();
  await page.getByTestId("confirm-owner-intent-share").check();
  await page.screenshot({
    path: "/opt/cursor/artifacts/person-detail-add-responsibility.png",
    fullPage: false,
  });
  await page.getByTestId("confirm-owner-submit").click();
  await expect(page.getByTestId("confirm-owner-dialog")).toHaveCount(0);
  await expect(drawer.getByTestId("person-detail-responsibility")).toContainText(
    "Cut-over communications",
  );
  await expect(drawer.getByTestId("person-detail-shared")).toContainText("Shared with");
  await expect(drawer.getByTestId("person-detail-name")).toHaveText("Sam Lee");
});

test("handover still opens replace for the current scope", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId);
  const drawer = await openPerson(page, MARIA);
  await drawer.getByTestId(`ocean-item-detail-handover-${RESP_CUT_MARIA}`).click();
  await expect(page.getByTestId("confirm-owner-scope-input")).toHaveCount(0);
  await expect(page.getByTestId("confirm-owner-dialog")).toContainText(
    "Cut-over communications",
  );
  await expect(page.getByTestId("confirm-owner-intent-replace")).toBeChecked();
  await expect(page.getByTestId("confirm-owner-replace-select")).toHaveValue(MARIA);
});

test("390px Person detail and Confirm Owner do not overflow", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo.testId, 390, 844);
  const drawer = await openPerson(page, MARIA);
  const box = await drawer.getByTestId("person-detail-add").boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth <= root.clientWidth + 1;
  });
  expect(overflow).toBe(true);
  await page.screenshot({
    path: "/opt/cursor/artifacts/person-detail-narrow.png",
    fullPage: false,
  });
  await drawer.getByTestId("person-detail-add").click();
  await expect(page.getByTestId("confirm-owner-dialog")).toBeVisible();
  await expect(page.getByTestId("confirm-owner-person-select")).toHaveValue(
    "Maria Chen",
  );
  const dialogOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth <= root.clientWidth + 1;
  });
  expect(dialogOverflow).toBe(true);
  await page.screenshot({
    path: "/opt/cursor/artifacts/person-detail-narrow-add.png",
    fullPage: false,
  });
});
