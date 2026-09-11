import { test, expect } from "@playwright/test";
import {
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
  collectPeopleNames,
  collectReviewCards,
  createProjectFromComposer,
  emptyMatrix,
  expectNoCaptureError,
  fillUniqueProject,
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
} from "./helpers";
import type { JourneyClassification, JourneyMatrixRow, VerticalBoundary } from "./types";

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
    ["classification", row.classification],
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

function composerHasCoreTitles(text: string): boolean {
  return (
    /Olga Petrov/i.test(text) &&
    /Sarah Kim/i.test(text) &&
    /Production release/i.test(text) &&
    /CAB/i.test(text) &&
    /Cutover runbook v2/i.test(text)
  );
}

function mark(
  row: JourneyMatrixRow,
  classification: JourneyClassification,
  boundary: VerticalBoundary,
): VerticalBoundary {
  row.classification = classification;
  return boundary;
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
    await fillUniqueProject(page, "bob");
    const call = await organiseNotes(page, "bob is the ba\nmike handles the legacy builds");
    row.hostedApi = passCell(Boolean(call && call.status === 200));
    row.notes = provenanceNote(call);
    assertHostedAiSuccess(call, "New Project organise");
    row.liveOpenAi = "PASS";

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
        calls: [call!],
        extra: { people, needsYou, expected: ["Bob", "Mike"] },
      });
      throw new Error(
        `Bob/Mike vanished after Organise (people=${JSON.stringify(people)}; needsYou=${JSON.stringify(needsYou)}; stakeholders=${JSON.stringify((call!.body as { draft?: { stakeholders?: unknown } })?.draft?.stakeholders || [])}; provisional=${JSON.stringify((call!.body as { provisionalItems?: unknown })?.provisionalItems || [])})`,
      );
    }
    row.result = "PASS";
  } catch (error) {
    row.result = "FAIL";
    const message = error instanceof Error ? error.message : String(error);
    if (/AUTH:/i.test(message) && /HTTP 401|HTTP 403|session not ready/i.test(message)) {
      row.classification = /session not ready/i.test(message) ? "AUTH_FLAKE" : "PRODUCT_DEFECT";
    }
    row.earliestBoundary = boundary || classifyThrown(error);
    row.notes = [row.notes, message].filter(Boolean).join(" | ");
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
    await fillUniqueProject(page, "full");
    const call = await organiseNotes(page, FULL_NOTES);
    row.hostedApi = passCell(Boolean(call && call.status === 200));
    assertHostedAiSuccess(call, "Full New Project organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(call);

    const hasRelease = organisedDraftHasYmd(call?.body, "2026-09-12");
    const hasCab = organisedDraftHasYmd(call?.body, "2026-09-15");
    if (!hasRelease || !hasCab) {
      boundary = mark(row, "PRODUCT_DEFECT", "VALIDATION");
      throw new Error(
        `Organised draft is missing stored dates (has 2026-09-12=${hasRelease}, has 2026-09-15=${hasCab}). Compact composer labels are not a substitute for draft values.`,
      );
    }

    const people = await frameLines(page, "np-frame-people");
    const knowledge = await frameLines(page, "np-frame-knowledge");
    const issues = await frameLines(page, "np-frame-issues");
    const composed = [...people, ...knowledge, ...issues].join("\n");
    const bodyText = ((await page.locator("body").innerText()) || "");
    const titlesVisible = composerHasCoreTitles(`${composed}\n${bodyText}`);
    row.uiInterpretation = passCell(titlesVisible);
    if (!titlesVisible) {
      boundary = classifyNewProjectLoss(call, people);
      throw new Error(`Organised draft is missing expected people/knowledge titles before Create: ${composed}`);
    }

    await createProjectFromComposer(page);
    await openKnowledge(page);
    const afterCreate = ((await page.locator("body").innerText()) || "");
    expect(afterCreate).toMatch(/Olga Petrov/i);
    expect(afterCreate).toMatch(/Sarah Kim/i);
    expect(afterCreate).toMatch(/Production release/i);
    expect(afterCreate).toMatch(/CAB/i);
    expect(afterCreate).toMatch(/Cutover runbook v2/i);
    assertTextRepresentsYmd(afterCreate, "2026-09-12", "Knowledge after Create");
    assertTextRepresentsYmd(afterCreate, "2026-09-15", "Knowledge after Create");
    row.apply = "PASS";

    await hardReload(page);
    const afterReload = await openKnowledgeDates(page);
    expect(afterReload).toMatch(/Olga Petrov/i);
    expect(afterReload).toMatch(/Sarah Kim/i);
    expect(afterReload).toMatch(/Production release/i);
    expect(afterReload).toMatch(/CAB/i);
    expect(afterReload).toMatch(/Cutover runbook v2/i);
    assertTextRepresentsYmd(afterReload, "2026-09-12", "Knowledge after hard reload");
    assertTextRepresentsYmd(afterReload, "2026-09-15", "Knowledge after hard reload");
    row.reload = "PASS";
    row.review = "n/a";
    row.result = "PASS";
  } catch (error) {
    row.result = "FAIL";
    row.earliestBoundary = boundary || classifyThrown(error);
    row.classification =
      row.classification ||
      (/does not represent 2026-09-1/i.test(error instanceof Error ? error.message : "")
        ? "PRODUCT_DEFECT"
        : undefined);
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
    await fillUniqueProject(page, "capture");
    const organise = await organiseNotes(
      page,
      "The Production release is scheduled for 12 September 2026.\nOlga Petrov is responsible for UAT.",
    );
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertHostedAiSuccess(organise, "Date journey organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(page, "The Production release is now scheduled for 20 September 2026.");
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertHostedAiSuccess(capture, "Date journey capture");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(capture);

    const update = reviewCardByName(page, /Production release/i).first();
    await expect(update).toBeVisible({ timeout: 15_000 });
    await expect(update).toHaveAttribute("data-review-family", "update");
    const reviewText = ((await update.innerText()) || "");
    if (!textRepresentsYmd(reviewText, "2026-09-20") && !textRepresentsYmd(await page.locator("body").innerText(), "2026-09-20")) {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error("Review does not semantically represent 20 September 2026.");
    }
    row.uiInterpretation = "PASS";
    row.review = "PASS";

    const applyCall = await applyReady(page);
    await expectNoCaptureError(page);
    row.apply = passCell(Boolean(applyCall && applyCall.status === 200));
    if (!applyCall || applyCall.status !== 200) {
      boundary = applyCall && applyCall.status >= 500 ? "PERSISTENCE" : "APPLY";
      throw new Error(`Apply HTTP ${applyCall?.status ?? "missing"}`);
    }

    const knowledge = await openKnowledgeDates(page);
    assertTextRepresentsYmd(knowledge, "2026-09-20", "Knowledge after Apply");
    expect(knowledge).toMatch(/Production release/i);

    await hardReload(page);
    const reloaded = await openKnowledgeDates(page);
    if (!textRepresentsYmd(reloaded, "2026-09-20")) {
      boundary = mark(row, "PRODUCT_DEFECT", "PROJECTION_RELOAD");
      throw new Error("Hard reload lost or reverted Production release 20 September 2026.");
    }
    expect(reloaded).toMatch(/Production release/i);
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
    await fillUniqueProject(page, "andris");
    const organise = await organiseNotes(
      page,
      "Olga Petrov is responsible for UAT.\nSarah Kim is responsible for Release.",
    );
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertHostedAiSuccess(organise, "Andris journey organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(page, "Andris is responsible for Legacy.");
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertHostedAiSuccess(capture, "Andris journey capture");
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
    const identity = await fillUniqueProject(page, "ambiguity");
    await addComposeLine(page, "np-frame-people", "Olga Petrov");
    await addComposeLine(page, "np-frame-people", "Sarah Kim");
    await addComposeLine(page, "np-frame-knowledge", "Production release");
    row.hostedApi = "n/a";
    row.liveOpenAi = "n/a";
    row.notes = `Seeded via New Project UI (no Organise). name=${identity.name} code=${identity.code}`;
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
    assertHostedAiSuccess(capture, "Ambiguity journey capture");
    row.liveOpenAi = "PASS";
    row.notes = [row.notes, provenanceNote(capture)].filter(Boolean).join(" | ");

    const cards = await collectReviewCards(page);
    const dateCard = cards.find((card) => /production release/i.test(card.text));
    const pronounCard = cards.find(
      (card) =>
        card.family === "needs_you" &&
        (/she will own/i.test(card.text) ||
          /own uat/i.test(card.text) ||
          (/she\b/i.test(card.text) && /uat/i.test(card.text)) ||
          /needs you/i.test(card.text)),
    ) || cards.find((card) => card.family === "needs_you");
    if (!dateCard || !["update", "create"].includes(dateCard.family)) {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(`Date sibling missing or not independently actionable: ${JSON.stringify(cards)}`);
    }
    if (!pronounCard || pronounCard.family !== "needs_you") {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(`Pronoun UAT ownership was not isolated as Needs You: ${JSON.stringify(cards)}`);
    }
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
    const reloaded = await openKnowledgeDates(page);
    assertTextRepresentsYmd(reloaded, "2026-09-21", "Knowledge after hard reload");
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
    await fillUniqueProject(page, "mixed");
    const organise = await organiseNotes(page, FULL_NOTES);
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertHostedAiSuccess(organise, "Mixed journey organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    await createProjectFromComposer(page);

    const sourceObservations = [
      {
        source: "The Production release is now scheduled for 20 September 2026.",
        meaning: "UPDATE existing Production release milestone to 2026-09-20",
      },
      {
        source: "Andris is responsible for Legacy.",
        meaning: "New person Andris / Legacy responsibility; Needs You is acceptable",
      },
      {
        source: "She will own the remaining UAT gaps.",
        meaning: "Ambiguous pronoun ownership; must stay local / not write",
      },
      {
        source: "Parking-lot: catering is still undecided and is not a project control.",
        meaning: "Unrelated commentary; must not become project truth",
      },
      {
        source: "Cutover runbook v2 remains the current working version.",
        meaning: "Already-known knowledge; no-op or commentary is fine",
      },
      {
        source: "The CAB preparation session is still 15 September 2026.",
        meaning: "Already-known CAB date; no-op or same-date update is fine",
      },
    ];

    await openCapture(page);
    const capture = await analyseCapture(
      page,
      [
        "Stand-up notes from Thursday.",
        ...sourceObservations.map((item) => item.source),
      ].join(" "),
    );
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertHostedAiSuccess(capture, "Mixed journey capture");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(capture);

    const cards = await collectReviewCards(page);
    const reviewBlob = cards.map((card) => `${card.family}:${card.text}`).join("\n");
    const bodyText = ((await page.locator("body").innerText()) || "");
    const dateCard = cards.find((card) => /production release/i.test(card.text));
    const andrisCard = cards.find((card) => /andris/i.test(card.text));
    const pronounSurvived =
      cards.some(
        (card) =>
          /she will own|remaining uat|own the remaining/i.test(card.text) ||
          (card.family === "needs_you" && /uat/i.test(card.text)),
      ) || /she will own the remaining uat gaps/i.test(bodyText);

    const traces = sourceObservations.map((item) => {
      if (/Production release/.test(item.source)) {
        return {
          ...item,
          reviewDisposition: dateCard ? `${dateCard.family}: ${dateCard.text.slice(0, 180)}` : "missing",
          applyStatus: dateCard && ["update", "create"].includes(dateCard.family) ? "ready" : "not-ready",
        };
      }
      if (/Andris/.test(item.source)) {
        return {
          ...item,
          reviewDisposition: andrisCard ? `${andrisCard.family}: ${andrisCard.text.slice(0, 180)}` : "missing",
          applyStatus: andrisCard?.family === "needs_you" ? "will-not-write" : andrisCard ? "ready-or-update" : "missing",
        };
      }
      if (/She will own/.test(item.source)) {
        return {
          ...item,
          reviewDisposition: pronounSurvived ? "present as Needs You or review transcript (exact sentence not required)" : "missing",
          applyStatus: "must-not-write",
        };
      }
      return {
        ...item,
        reviewDisposition: "not required as a Review card",
        applyStatus: "must-not-become-new-truth",
      };
    });
    await attachJson(testInfo, "mixed-observation-map", { cards, traces });

    const dateReady = Boolean(dateCard && ["update", "create"].includes(dateCard.family) && textRepresentsYmd(`${dateCard.text}\n${bodyText}`, "2026-09-20"));
    const andrisPresent = Boolean(andrisCard);
    if (!dateReady || !andrisPresent || !pronounSurvived) {
      const lost: string[] = [];
      if (!dateReady) lost.push("Production release 20 Sep");
      if (!andrisPresent) lost.push("Andris Legacy");
      if (!pronounSurvived) lost.push("pronoun UAT ownership");
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(`Mixed paste lost or transformed observations incorrectly: ${lost.join(", ")}. Cards=${reviewBlob}`);
    }
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
    const reloaded = await openKnowledgeDates(page);
    assertTextRepresentsYmd(reloaded, "2026-09-20", "Knowledge after hard reload");
    expect(reloaded).not.toMatch(/She will own the remaining UAT gaps/i);
    expect(reloaded).not.toMatch(/catering is still undecided/i);
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
  if (/reload|afterReload|lost or reverted|2026-09-20|2026-09-21|20 Sep|21 Sep/i.test(message)) {
    return "PROJECTION_RELOAD";
  }
  if (/review|data-review-family|Needs you|needs_you|finding|independently actionable/i.test(message)) {
    return "REVIEW_UI";
  }
  if (/waitForResponse|did not return \/api\//i.test(message)) return "HOSTED_API";
  if (/np-name|np-organise|ocean-capture-input|fill|Timeout|UI_INPUT:/i.test(message)) return "UI_INPUT";
  return "UNKNOWN";
}
