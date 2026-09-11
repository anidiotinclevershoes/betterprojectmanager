import { test, expect } from "@playwright/test";
import {
  RUN_ID,
  analyseCapture,
  applyReady,
  assertLiveOpenAi,
  captureFailureArtifacts,
  classifyFromApi,
  classifyNewProjectLoss,
  collectNeedsYou,
  collectPeopleNames,
  createProjectFromComposer,
  emptyMatrix,
  expectNoCaptureError,
  fillProjectName,
  frameLines,
  hardReload,
  installApiRecorder,
  openCapture,
  openKnowledge,
  openNewProject,
  organiseNotes,
  passCell,
  provenanceNote,
  recordedCalls,
  reviewCardByName,
  reviewCards,
  reviewFamilies,
  signIn,
} from "./helpers";
import type { JourneyMatrixRow, VerticalBoundary } from "./types";

function annotate(
  testInfo: { annotations: { type: string; description?: string }[] },
  row: JourneyMatrixRow,
): void {
  const entries: Array<[string, string | undefined]> = [
    ["journey", row.journey],
    ["vercelAccess", row.vercelAccess],
    ["lumeAuth", row.lumeAuth],
    ["hostedApi", row.hostedApi],
    ["liveOpenAi", row.liveOpenAi],
    ["uiInterpretation", row.uiInterpretation],
    ["review", row.review],
    ["apply", row.apply],
    ["reload", row.reload],
    ["boundary", row.earliestBoundary],
    ["notes", row.notes],
  ];
  for (const [type, description] of entries) {
    if (description) testInfo.annotations.push({ type, description });
  }
}

const FULL_NOTES = [
  "Olga Petrov is responsible for UAT.",
  "Sarah Kim is responsible for Release.",
  "The Production release is scheduled for 12 September 2026.",
  "The CAB preparation session is scheduled for 15 September 2026.",
  "The UAT environment is currently unavailable.",
  "Cutover runbook v2 is the current working version.",
].join("\n");

const FULL_TRUTH = [
  /Olga Petrov/i,
  /Sarah Kim/i,
  /Production release/i,
  /12 September 2026|12 Sep 2026|Sep 12|2026-09-12/i,
  /CAB/i,
  /15 September 2026|15 Sep 2026|Sep 15|2026-09-15/i,
  /UAT environment|unavailable/i,
  /Cutover runbook v2/i,
];

function truthVisible(text: string): boolean {
  return FULL_TRUTH.every((re) => re.test(text));
}

// One worker + fullyParallel:false already serialises load. Do not use
// describe serial mode: a first AUTH failure would skip the other journeys.

test.beforeEach(async ({ page }, testInfo) => {
  installApiRecorder(page);
  testInfo.annotations.push({ type: "runId", description: RUN_ID });
  const session = await signIn(page);
  testInfo.annotations.push({ type: "vercelAccess", description: session.vercelAccess });
  testInfo.annotations.push({ type: "lumeAuth", description: session.lumeAuth });
});

test.afterEach(async ({ page }, testInfo) => {
  const message = testInfo.error?.message || "";
  if (/VERCEL_PROTECTION:/i.test(message) && !testInfo.annotations.some((item) => item.type === "boundary")) {
    testInfo.annotations.push({ type: "boundary", description: "VERCEL_PROTECTION" });
    testInfo.annotations.push({ type: "vercelAccess", description: "FAIL" });
    testInfo.annotations.push({ type: "lumeAuth", description: "BLOCKED" });
    testInfo.annotations.push({ type: "hostedApi", description: "BLOCKED" });
    testInfo.annotations.push({ type: "liveOpenAi", description: "BLOCKED" });
    testInfo.annotations.push({ type: "uiInterpretation", description: "BLOCKED" });
    testInfo.annotations.push({ type: "notes", description: message.split("\n")[0] });
  } else if (/AUTH:/i.test(message) && !testInfo.annotations.some((item) => item.type === "boundary")) {
    testInfo.annotations.push({ type: "boundary", description: "AUTH" });
    testInfo.annotations.push({ type: "hostedApi", description: "BLOCKED" });
    testInfo.annotations.push({ type: "liveOpenAi", description: "BLOCKED" });
    testInfo.annotations.push({ type: "uiInterpretation", description: "BLOCKED" });
    testInfo.annotations.push({ type: "notes", description: message.split("\n")[0] });
  }
  if (testInfo.status !== testInfo.expectedStatus) {
    await Promise.race([
      captureFailureArtifacts({
        page,
        testInfo,
        journey: testInfo.title,
        calls: recordedCalls(page),
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]).catch(() => undefined);
  }
});

test("New Project partial people", async ({ page }, testInfo) => {
  const row = emptyMatrix("New Project partial people");
  row.review = "n/a";
  row.apply = "n/a";
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillProjectName(page, `E2E People ${RUN_ID}`);
    const call = await organiseNotes(page, "bob is the ba\nmike handles the legacy builds");
    row.hostedApi = passCell(Boolean(call && call.status === 200));
    row.notes = provenanceNote(call);
    if (call) {
      try {
        assertLiveOpenAi(call.provenance, "New Project organise");
        row.liveOpenAi = "PASS";
      } catch (error) {
        row.liveOpenAi = "FAIL";
        boundary = "OPENAI";
        throw error;
      }
    } else {
      row.liveOpenAi = "FAIL";
      boundary = "HOSTED_API";
      throw new Error("Organise did not return /api/new-project");
    }

    const people = [
      ...(await collectPeopleNames(page)),
      ...(await frameLines(page, "np-frame-people")),
    ];
    const needsYou = await collectNeedsYou(page);
    const hasBob = people.some((name) => /bob/i.test(name)) || needsYou.some((text) => /bob/i.test(text));
    const hasMike = people.some((name) => /mike/i.test(name)) || needsYou.some((text) => /mike/i.test(text));
    row.uiInterpretation = passCell(hasBob && hasMike);
    row.reload = "n/a";
    if (!hasBob || !hasMike) {
      boundary = classifyNewProjectLoss(call, people);
      await captureFailureArtifacts({
        page,
        testInfo,
        journey: "New Project partial people",
        calls: [call],
        extra: { people, needsYou, expected: ["Bob", "Mike"] },
      });
      throw new Error(
        `Bob/Mike vanished after Organise (people=${JSON.stringify(people)}; needsYou=${JSON.stringify(needsYou)}; stakeholders=${JSON.stringify((call.body as { draft?: { stakeholders?: unknown } })?.draft?.stakeholders || [])}; provisional=${JSON.stringify((call.body as { provisionalItems?: unknown })?.provisionalItems || [])})`,
      );
    }
    row.result = "PASS";
  } catch (error) {
    row.result = "FAIL";
    row.earliestBoundary = boundary || classifyThrown(error);
    row.notes = [row.notes, error instanceof Error ? error.message : String(error)].filter(Boolean).join(" | ");
    annotate(testInfo, row);
    throw error;
  }
  annotate(testInfo, row);
});

test("Full New Project + Create + hard reload", async ({ page }, testInfo) => {
  const row = emptyMatrix("Full New Project + Create + hard reload");
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillProjectName(page, `E2E Full Truth ${RUN_ID}`);
    const call = await organiseNotes(page, FULL_NOTES);
    row.hostedApi = passCell(Boolean(call && call.status === 200));
    assertLiveOpenAi(call?.provenance, "Full New Project organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(call);

    const people = await frameLines(page, "np-frame-people");
    const knowledge = await frameLines(page, "np-frame-knowledge");
    const issues = await frameLines(page, "np-frame-issues");
    const composed = [...people, ...knowledge, ...issues].join("\n");
    const bodyText = ((await page.locator("body").innerText()) || "");
    const visibleBeforeCreate = truthVisible(`${composed}\n${bodyText}`);
    row.uiInterpretation = passCell(visibleBeforeCreate);
    if (!visibleBeforeCreate) {
      boundary = classifyNewProjectLoss(call, people);
      throw new Error(`Organised draft is missing expected people/dates/knowledge before Create: ${composed}`);
    }

    await createProjectFromComposer(page);
    await openKnowledge(page);
    const afterCreate = ((await page.locator("body").innerText()) || "");
    expect(afterCreate).toMatch(/Olga Petrov/i);
    expect(afterCreate).toMatch(/Sarah Kim/i);
    expect(afterCreate).toMatch(/Production release/i);
    expect(afterCreate).toMatch(/CAB/i);
    expect(afterCreate).toMatch(/Cutover runbook v2/i);
    row.apply = "PASS";

    await hardReload(page);
    await openKnowledge(page);
    const afterReload = ((await page.locator("body").innerText()) || "");
    expect(afterReload).toMatch(/Olga Petrov/i);
    expect(afterReload).toMatch(/Sarah Kim/i);
    expect(afterReload).toMatch(/Production release/i);
    expect(afterReload).toMatch(/CAB/i);
    expect(afterReload).toMatch(/Cutover runbook v2/i);
    row.reload = "PASS";
    row.review = "n/a";
    row.result = "PASS";
  } catch (error) {
    row.result = "FAIL";
    row.earliestBoundary = boundary || classifyThrown(error);
    row.notes = [row.notes, error instanceof Error ? error.message : String(error)].filter(Boolean).join(" | ");
    annotate(testInfo, row);
    throw error;
  }
  annotate(testInfo, row);
});

test("Capture date update → Apply → reload", async ({ page }, testInfo) => {
  const row = emptyMatrix("Capture date update → Apply → reload");
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillProjectName(page, `E2E Capture Update ${RUN_ID}`);
    const organise = await organiseNotes(
      page,
      "The Production release is scheduled for 12 September 2026.\nOlga Petrov is responsible for UAT.",
    );
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertLiveOpenAi(organise?.provenance, "Date journey organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(page, "The Production release is now scheduled for 20 September 2026.");
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertLiveOpenAi(capture?.provenance, "Date journey capture");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(capture);

    const update = reviewCardByName(page, /Production release/i).first();
    await expect(update).toBeVisible({ timeout: 15_000 });
    await expect(update).toHaveAttribute("data-review-family", "update");
    row.uiInterpretation = "PASS";
    row.review = "PASS";

    const applyCall = await applyReady(page);
    await expectNoCaptureError(page);
    row.apply = passCell(Boolean(applyCall && applyCall.status === 200));
    if (!applyCall || applyCall.status !== 200) {
      boundary = applyCall && applyCall.status >= 500 ? "PERSISTENCE" : "APPLY";
      throw new Error(`Apply HTTP ${applyCall?.status ?? "missing"}`);
    }

    await openKnowledge(page);
    await page.getByTestId("kc-bucket-knowledge").click();
    await page.getByTestId("kc-subtype-dates").click();
    const knowledge = ((await page.locator("body").innerText()) || "");
    expect(knowledge).toMatch(/20 September 2026|20 Sep 2026|Sep 20|2026-09-20/i);

    await hardReload(page);
    await openKnowledge(page);
    await page.getByTestId("kc-bucket-knowledge").click();
    await page.getByTestId("kc-subtype-dates").click();
    const reloaded = ((await page.locator("body").innerText()) || "");
    expect(reloaded).toMatch(/20 September 2026|20 Sep 2026|Sep 20|2026-09-20/i);
    row.reload = "PASS";
    row.result = "PASS";
  } catch (error) {
    row.result = "FAIL";
    row.earliestBoundary = boundary || classifyThrown(error);
    row.notes = [row.notes, error instanceof Error ? error.message : String(error)].filter(Boolean).join(" | ");
    annotate(testInfo, row);
    throw error;
  }
  annotate(testInfo, row);
});

test("New person / responsibility", async ({ page }, testInfo) => {
  const row = emptyMatrix("New person / responsibility");
  try {
    await openNewProject(page);
    await fillProjectName(page, `E2E Andris ${RUN_ID}`);
    const organise = await organiseNotes(
      page,
      "Olga Petrov is responsible for UAT.\nSarah Kim is responsible for Release.",
    );
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertLiveOpenAi(organise?.provenance, "Andris journey organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(page, "Andris is responsible for Legacy.");
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertLiveOpenAi(capture?.provenance, "Andris journey capture");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(capture);

    const families = await reviewFamilies(page);
    const andrisCard = reviewCardByName(page, /Andris/i).first();
    await expect(andrisCard).toBeVisible({ timeout: 15_000 });
    const andrisFamily = await andrisCard.getAttribute("data-review-family");
    expect(andrisFamily).not.toBeNull();
    expect(["create", "needs_you", "update"]).toContain(andrisFamily);
    const stolen = reviewCards(page).filter({ hasText: /Olga|Sarah/i });
    const stolenCount = await stolen.count();
    for (let i = 0; i < stolenCount; i += 1) {
      const text = await stolen.nth(i).innerText();
      expect(text, "unrelated existing person must not steal Andris identity").not.toMatch(
        /Andris is responsible for Legacy/i,
      );
    }
    row.uiInterpretation = "PASS";
    row.review = "PASS";
    row.apply = "n/a";
    row.reload = "n/a";
    row.notes = [row.notes, `Andris review family=${andrisFamily}; families=${families.join(",")}`]
      .filter(Boolean)
      .join(" | ");
    row.result = "PASS";
  } catch (error) {
    row.result = "FAIL";
    row.earliestBoundary = classifyThrown(error);
    row.notes = [row.notes, error instanceof Error ? error.message : String(error)].filter(Boolean).join(" | ");
    annotate(testInfo, row);
    throw error;
  }
  annotate(testInfo, row);
});

test("Ambiguity stays local", async ({ page }, testInfo) => {
  const row = emptyMatrix("Ambiguity stays local");
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillProjectName(page, `E2E Ambiguity ${RUN_ID}`);
    const organise = await organiseNotes(
      page,
      "Olga Petrov is responsible for UAT.\nSarah Kim is responsible for Release.\nThe Production release is scheduled for 12 September 2026.",
    );
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertLiveOpenAi(organise?.provenance, "Ambiguity journey organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(
      page,
      [
        "Olga Petrov and Sarah Kim discussed the UAT handover. She will own UAT going forward.",
        "The Production release is now scheduled for 21 September 2026.",
      ].join("\n"),
    );
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertLiveOpenAi(capture?.provenance, "Ambiguity journey capture");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(capture);

    const ambiguous = reviewCardByName(page, /She will own UAT|own UAT going forward/i).first();
    await expect(ambiguous).toBeVisible({ timeout: 15_000 });
    await expect(ambiguous).toHaveAttribute("data-review-family", "needs_you");

    const sibling = reviewCardByName(page, /Production release/i).first();
    await expect(sibling).toBeVisible();
    await expect(sibling).toHaveAttribute("data-review-family", "update");
    row.uiInterpretation = "PASS";
    row.review = "PASS";

    const applyCall = await applyReady(page);
    await expectNoCaptureError(page);
    row.apply = passCell(Boolean(applyCall && applyCall.status === 200));
    if (!applyCall || applyCall.status !== 200) {
      boundary = applyCall && applyCall.status >= 500 ? "PERSISTENCE" : "APPLY";
      throw new Error(`Apply HTTP ${applyCall?.status ?? "missing"}`);
    }

    await hardReload(page);
    await openKnowledge(page);
    const reloaded = ((await page.locator("body").innerText()) || "");
    expect(reloaded).toMatch(/21 September 2026|21 Sep 2026|Sep 21|2026-09-21/i);
    expect(reloaded).not.toMatch(/She will own UAT going forward/i);
    row.reload = "PASS";
    row.result = "PASS";
  } catch (error) {
    row.result = "FAIL";
    row.earliestBoundary = boundary || classifyThrown(error);
    row.notes = [row.notes, error instanceof Error ? error.message : String(error)].filter(Boolean).join(" | ");
    annotate(testInfo, row);
    throw error;
  }
  annotate(testInfo, row);
});

test("Mixed realistic paste", async ({ page }, testInfo) => {
  const row = emptyMatrix("Mixed realistic paste");
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillProjectName(page, `E2E Mixed ${RUN_ID}`);
    const organise = await organiseNotes(page, FULL_NOTES);
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertLiveOpenAi(organise?.provenance, "Mixed journey organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(
      page,
      [
        "Stand-up notes from Thursday.",
        "The Production release is now scheduled for 20 September 2026.",
        "Andris is responsible for Legacy.",
        "She will own the remaining UAT gaps.",
        "Parking-lot: catering is still undecided and is not a project control.",
        "Cutover runbook v2 remains the current working version.",
        "The CAB preparation session is still 15 September 2026.",
      ].join(" "),
    );
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertLiveOpenAi(capture?.provenance, "Mixed journey capture");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(capture);

    const dateCard = reviewCardByName(page, /Production release/i).first();
    await expect(dateCard).toBeVisible();
    await expect(dateCard).toHaveAttribute("data-review-family", "update");

    const andris = reviewCardByName(page, /Andris/i).first();
    await expect(andris).toBeVisible();

    const ambiguous = reviewCardByName(page, /She will own|remaining UAT/i).first();
    await expect(ambiguous).toBeVisible();
    await expect(ambiguous).toHaveAttribute("data-review-family", "needs_you");

    row.uiInterpretation = "PASS";
    row.review = "PASS";

    const applyCall = await applyReady(page);
    await expectNoCaptureError(page);
    row.apply = passCell(Boolean(applyCall && applyCall.status === 200));
    if (!applyCall || applyCall.status !== 200) {
      boundary = applyCall && applyCall.status >= 500 ? "PERSISTENCE" : "APPLY";
      throw new Error(`Apply HTTP ${applyCall?.status ?? "missing"}`);
    }

    await hardReload(page);
    await openKnowledge(page);
    const reloaded = ((await page.locator("body").innerText()) || "");
    expect(reloaded).toMatch(/20 September 2026|20 Sep 2026|Sep 20|2026-09-20/i);
    expect(reloaded).not.toMatch(/She will own the remaining UAT gaps/i);
    row.reload = "PASS";
    row.result = "PASS";
  } catch (error) {
    row.result = "FAIL";
    row.earliestBoundary = boundary || classifyThrown(error);
    row.notes = [row.notes, error instanceof Error ? error.message : String(error)].filter(Boolean).join(" | ");
    annotate(testInfo, row);
    throw error;
  }
  annotate(testInfo, row);
});

function classifyThrown(error: unknown): VerticalBoundary {
  const message = error instanceof Error ? error.message : String(error);
  if (/VERCEL_PROTECTION:/i.test(message)) return "VERCEL_PROTECTION";
  if (/AUTH:|Invalid email|LUME_E2E_/i.test(message)) return "AUTH";
  if (/provider|fallback|provenance|OPENAI/i.test(message)) return "OPENAI";
  const apiBoundary = /\/api\/new-project|\/api\/capture|HTTP /i.test(message)
    ? classifyFromApi({
        url: "",
        method: "POST",
        status: Number(/HTTP (\d+)/.exec(message)?.[1] || 0),
      })
    : undefined;
  if (apiBoundary) return apiBoundary;
  if (/vanished|stakeholders|provisional|Organised draft is missing/i.test(message)) return "VALIDATION";
  if (/Apply HTTP|Apply Ready/i.test(message)) return "APPLY";
  if (/reload|afterReload|2026-09-20|2026-09-21|20 Sep|21 Sep/i.test(message)) return "PROJECTION_RELOAD";
  if (/review|data-review-family|Needs you|needs_you|finding/i.test(message)) return "REVIEW_UI";
  if (/waitForResponse|did not return \/api\//i.test(message)) return "HOSTED_API";
  if (/np-name|np-organise|ocean-capture-input|fill|Timeout|UI_INPUT:/i.test(message)) return "UI_INPUT";
  return "UNKNOWN";
}
