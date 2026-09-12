import { expect, type Page } from "@playwright/test";
import {
  fillProjectName,
  frameLines,
  openKnowledge,
  RUN_ID,
} from "../e2e-hosted-vertical/helpers";
import type { HoldoutKind } from "./frozen-spec";

export {
  RUN_ID,
  addComposeLine,
  analyseCapture,
  applyReady,
  assertHostedAiSuccess,
  assertTextRepresentsYmd,
  attachJson,
  captureFailureArtifacts,
  classifyFromApi,
  classifyNewProjectLoss,
  collectNeedsYou,
  collectReviewCards,
  createProjectFromComposer,
  emptyMatrix,
  expectNoCaptureError,
  frameLines,
  hardReload,
  installApiRecorder,
  openCapture,
  openKnowledge,
  openKnowledgeDates,
  openNewProject,
  organisedDraftHasYmd,
  organiseNotes,
  passCell,
  provenanceNote,
  recordedCalls,
  reviewCardByName,
  reviewCards,
  reviewFamilies,
  signIn,
  textRepresentsYmd,
} from "../e2e-hosted-vertical/helpers";

export type { JourneyClassification, JourneyMatrixRow, VerticalBoundary } from "../e2e-hosted-vertical/types";

const HOLDOUT_CODE_PREFIX: Record<HoldoutKind, string> = {
  issues: "I",
  create: "K",
  update: "U",
  identity: "Y",
  isolate: "S",
  messy: "P",
};

export function uniqueHoldoutIdentity(kind: HoldoutKind): { name: string; code: string } {
  const compact = RUN_ID.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-10);
  return {
    name: `HO ${kind} ${RUN_ID}`,
    code: `${HOLDOUT_CODE_PREFIX[kind]}${compact}`.slice(0, 12),
  };
}

export async function fillHoldoutProject(page: Page, kind: HoldoutKind): Promise<{ name: string; code: string }> {
  const identity = uniqueHoldoutIdentity(kind);
  await fillProjectName(page, identity.name);
  const codeField = page.getByTestId("np-code");
  await expect(codeField).toBeVisible({ timeout: 20_000 });
  await codeField.fill(identity.code);
  await expect(codeField).toHaveValue(identity.code);
  return identity;
}

export async function bodyText(page: Page): Promise<string> {
  return ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
}

export async function openKnowledgeBucket(
  page: Page,
  bucket: "all" | "issues" | "people" | "todo" | "knowledge",
): Promise<string> {
  await openKnowledge(page);
  const tab = page.getByTestId(`kc-bucket-${bucket}`);
  if ((await tab.count()) > 0) await tab.click();
  return bodyText(page);
}

export async function holdoutPeopleNames(page: Page): Promise<string[]> {
  const names = new Set<string>();
  for (const testId of ["np-frame-people", "kc-bucket-people", "ocean-frame-people"]) {
    for (const line of await frameLines(page, testId)) {
      names.add(line);
    }
  }
  const body = await bodyText(page);
  for (const name of ["Priya Nair", "Tomos Reed", "Jess Hale", "Kwame Boateng", "Elena Voss"]) {
    if (new RegExp(`\\b${name}\\b`, "i").test(body)) names.add(name);
  }
  return [...names];
}

export function applyExecutionNote(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const rec = body as { executed?: { kind?: string; reason?: string }; kind?: string };
  const executed = rec.executed;
  if (executed && typeof executed === "object") {
    return `executed.kind=${executed.kind ?? "?"} reason=${executed.reason ?? ""}`.trim();
  }
  return undefined;
}
