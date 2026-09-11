import { test, expect } from "@playwright/test";
import { holdoutJourney } from "./frozen-spec";
import {
  RUN_ID,
  addComposeLine,
  analyseCapture,
  applyReady,
  applyExecutionNote,
  assertHostedAiSuccess,
  assertTextRepresentsYmd,
  attachJson,
  bodyText,
  captureFailureArtifacts,
  classifyFromApi,
  classifyNewProjectLoss,
  collectNeedsYou,
  collectReviewCards,
  createProjectFromComposer,
  emptyMatrix,
  expectNoCaptureError,
  fillHoldoutProject,
  frameLines,
  hardReload,
  holdoutPeopleNames,
  installApiRecorder,
  openCapture,
  openKnowledge,
  openKnowledgeBucket,
  openKnowledgeDates,
  openNewProject,
  organisedDraftHasYmd,
  organiseNotes,
  passCell,
  provenanceNote,
  recordedCalls,
  reviewCards,
  signIn,
  textRepresentsYmd,
} from "./helpers";
import type { JourneyClassification, JourneyMatrixRow, VerticalBoundary } from "./helpers";

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

function mark(
  row: JourneyMatrixRow,
  classification: JourneyClassification,
  boundary: VerticalBoundary,
): VerticalBoundary {
  row.classification = classification;
  return boundary;
}

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
  if (/APPLY:|Apply HTTP|Apply Ready|persist_|schema cache/i.test(message)) return "APPLY";
  if (/reload|afterReload|lost or reverted|does not represent 2026-10/i.test(message)) {
    return "PROJECTION_RELOAD";
  }
  if (/review|data-review-family|Needs you|needs_you|finding|independently actionable|identity/i.test(message)) {
    return "REVIEW_UI";
  }
  if (/waitForResponse|did not return \/api\//i.test(message)) return "HOSTED_API";
  if (/np-name|np-organise|ocean-capture-input|fill|UI_INPUT:/i.test(message)) return "UI_INPUT";
  return "UNKNOWN";
}

test.beforeEach(async ({ page }, testInfo) => {
  installApiRecorder(page);
  testInfo.annotations.push({ type: "runId", description: RUN_ID });
  testInfo.annotations.push({ type: "suite", description: "hosted-holdout-v1" });
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

test("New Project issues and dated todos", async ({ page }, testInfo) => {
  const spec = holdoutJourney("H1_NEW_PROJECT_ISSUES_TODOS");
  const row = emptyMatrix(spec.title);
  row.review = "n/a";
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillHoldoutProject(page, spec.kind);
    const call = await organiseNotes(page, spec.input);
    row.hostedApi = passCell(Boolean(call && call.status === 200));
    row.notes = provenanceNote(call);
    assertHostedAiSuccess(call, "Holdout H1 organise");
    row.liveOpenAi = "PASS";

    const hasWorkshop = organisedDraftHasYmd(call?.body, "2026-10-08");
    const hasStart = organisedDraftHasYmd(call?.body, "2026-10-14");
    if (!hasWorkshop || !hasStart) {
      boundary = mark(row, "PRODUCT_DEFECT", "VALIDATION");
      throw new Error(
        `Organised draft is missing stored dates (has 2026-10-08=${hasWorkshop}, has 2026-10-14=${hasStart}). Compact composer labels are not a substitute for draft values.`,
      );
    }

    const issues = await frameLines(page, "np-frame-issues");
    const todos = await frameLines(page, "np-frame-todo");
    const knowledge = await frameLines(page, "np-frame-knowledge");
    const people = await frameLines(page, "np-frame-people");
    const composed = [...issues, ...todos, ...knowledge, await bodyText(page)].join("\n");
    const hasVoid = /void inspection/i.test(composed);
    const hasSla = /inbox sla|repairs inbox/i.test(composed);
    const hasWorkshopTitle = /mobilisation workshop/i.test(composed);
    const hasStartTitle = /contractor start/i.test(composed);
    const hasDhp = /dhp backlog/i.test(composed);
    row.uiInterpretation = passCell(hasVoid && hasSla && hasWorkshopTitle && hasStartTitle && hasDhp);
    if (!hasVoid || !hasSla || !hasWorkshopTitle || !hasStartTitle || !hasDhp) {
      boundary = classifyNewProjectLoss(call, people);
      throw new Error(
        `Organised composer lost Harbour issues/todos/knowledge: issues=${JSON.stringify(issues)} todos=${JSON.stringify(todos)} knowledge=${JSON.stringify(knowledge)}`,
      );
    }

    const needsYou = await collectNeedsYou(page);
    const peopleNeed = needsYou.some((text) => /add a person|who (are|is) the people|missing people/i.test(text));
    if (peopleNeed) {
      boundary = mark(row, "PRODUCT_DEFECT", "VALIDATION");
      throw new Error(`Needs You was raised for missing optional people: ${JSON.stringify(needsYou)}`);
    }

    await createProjectFromComposer(page);
    const afterCreate = await openKnowledgeBucket(page, "all");
    expect(afterCreate).toMatch(/void inspection/i);
    expect(afterCreate).toMatch(/inbox sla|repairs inbox/i);
    expect(afterCreate).toMatch(/mobilisation workshop/i);
    expect(afterCreate).toMatch(/contractor start/i);
    expect(afterCreate).toMatch(/dhp backlog/i);
    assertTextRepresentsYmd(afterCreate, "2026-10-08", "Knowledge after Create");
    assertTextRepresentsYmd(afterCreate, "2026-10-14", "Knowledge after Create");
    row.apply = "PASS";

    await hardReload(page);
    const afterReload = await openKnowledgeBucket(page, "all");
    expect(afterReload).toMatch(/void inspection/i);
    expect(afterReload).toMatch(/inbox sla|repairs inbox/i);
    expect(afterReload).toMatch(/mobilisation workshop/i);
    expect(afterReload).toMatch(/contractor start/i);
    expect(afterReload).toMatch(/dhp backlog/i);
    assertTextRepresentsYmd(afterReload, "2026-10-08", "Knowledge after hard reload");
    assertTextRepresentsYmd(afterReload, "2026-10-14", "Knowledge after hard reload");
    const datesOnly = await openKnowledgeDates(page);
    assertTextRepresentsYmd(datesOnly, "2026-10-08", "Dates filter after hard reload");
    assertTextRepresentsYmd(datesOnly, "2026-10-14", "Dates filter after hard reload");
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

test("Capture create dated action", async ({ page }, testInfo) => {
  const spec = holdoutJourney("H2_CAPTURE_CREATE_DATED_ACTION");
  const row = emptyMatrix(spec.title);
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillHoldoutProject(page, spec.kind);
    for (const person of spec.seed?.people ?? []) {
      await addComposeLine(page, "np-frame-people", person);
    }
    for (const fact of spec.seed?.knowledge ?? []) {
      await addComposeLine(page, "np-frame-knowledge", fact);
    }
    row.hostedApi = "n/a";
    row.liveOpenAi = "n/a";
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(page, spec.input);
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertHostedAiSuccess(capture, "Holdout H2 capture");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(capture);

    const cards = await collectReviewCards(page);
    const keysCard = cards.find(
      (card) => /void keys|depot/i.test(card.text) && ["create", "update"].includes(card.family),
    );
    const inventedPerson = cards.some(
      (card) =>
        ["create", "update"].includes(card.family) &&
        /\bI\b/.test(card.text) &&
        /person|responsible|owns/i.test(card.text) &&
        !/priya/i.test(card.text),
    );
    if (!keysCard || !textRepresentsYmd(`${keysCard.text}\n${await bodyText(page)}`, "2026-10-16")) {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(`Depot void-key create missing or undated: ${JSON.stringify(cards)}`);
    }
    if (inventedPerson) {
      boundary = mark(row, "PRODUCT_DEFECT", "IDENTITY");
      throw new Error(`Capture invented a person from first-person 'I': ${JSON.stringify(cards)}`);
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
    row.notes = [row.notes, applyExecutionNote(applyCall.body)].filter(Boolean).join(" | ");

    await hardReload(page);
    const people = await openKnowledgeBucket(page, "people");
    const knowledge = await openKnowledgeBucket(page, "all");
    expect(people).toMatch(/Priya Nair/i);
    expect(knowledge).toMatch(/repairs policy v3/i);
    expect(knowledge).toMatch(/void keys|depot/i);
    assertTextRepresentsYmd(knowledge, "2026-10-16", "Knowledge after hard reload");
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

test("Capture ISO date update", async ({ page }, testInfo) => {
  const spec = holdoutJourney("H3_CAPTURE_ISO_DATE_UPDATE");
  const row = emptyMatrix(spec.title);
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillHoldoutProject(page, spec.kind);
    const organise = await organiseNotes(page, spec.seed?.notes || "");
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertHostedAiSuccess(organise, "Holdout H3 organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    if (!organisedDraftHasYmd(organise?.body, "2026-10-08")) {
      boundary = mark(row, "PRODUCT_DEFECT", "VALIDATION");
      throw new Error("Seed organise did not store mobilisation workshop 2026-10-08.");
    }
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(page, spec.input);
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertHostedAiSuccess(capture, "Holdout H3 capture");
    row.notes = [row.notes, provenanceNote(capture)].filter(Boolean).join(" | ");

    const cards = await collectReviewCards(page);
    const workshop = cards.find((card) => /mobilisation workshop/i.test(card.text));
    const visible = `${workshop?.text || ""}\n${await bodyText(page)}`;
    if (!workshop || !["update", "create"].includes(workshop.family) || !textRepresentsYmd(visible, "2026-10-22")) {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(`Workshop slip to 2026-10-22 missing or not actionable: ${JSON.stringify(cards)}`);
    }
    const stolen = cards.filter(
      (card) =>
        /priya/i.test(card.text) &&
        /mobilisation workshop/i.test(card.text) &&
        /contractor lead|void keys|kwame/i.test(card.text),
    );
    if (stolen.length) {
      boundary = mark(row, "PRODUCT_DEFECT", "IDENTITY");
      throw new Error(`Priya card stole workshop identity: ${JSON.stringify(stolen)}`);
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
    row.notes = [row.notes, applyExecutionNote(applyCall.body)].filter(Boolean).join(" | ");

    await hardReload(page);
    const reloaded = await openKnowledgeDates(page);
    assertTextRepresentsYmd(reloaded, "2026-10-22", "Knowledge after hard reload");
    expect(reloaded).toMatch(/mobilisation workshop/i);
    if (textRepresentsYmd(reloaded, "2026-10-08")) {
      boundary = mark(row, "PRODUCT_DEFECT", "PROJECTION_RELOAD");
      throw new Error("Hard reload still presents 8 October 2026 as a current workshop date.");
    }
    const people = await openKnowledgeBucket(page, "people");
    expect(people).toMatch(/Priya Nair/i);
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

test("Multi-person identity isolation", async ({ page }, testInfo) => {
  const spec = holdoutJourney("H4_MULTI_PERSON_IDENTITY");
  const row = emptyMatrix(spec.title);
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillHoldoutProject(page, spec.kind);
    const organise = await organiseNotes(page, spec.seed?.notes || "");
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertHostedAiSuccess(organise, "Holdout H4 organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(page, spec.input);
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertHostedAiSuccess(capture, "Holdout H4 capture");
    row.notes = [row.notes, provenanceNote(capture)].filter(Boolean).join(" | ");

    const cards = await collectReviewCards(page);
    await attachJson(testInfo, "h4-review-cards", { cards });
    const kwame = cards.find((card) => /kwame/i.test(card.text));
    if (!kwame || !["create", "needs_you", "update"].includes(kwame.family)) {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(`Kwame Boateng missing from Review: ${JSON.stringify(cards)}`);
    }
    const absorbed = cards.filter(
      (card) =>
        /priya nair|tomos reed|jess hale/i.test(card.text) &&
        /kwame/i.test(card.text) &&
        /contractor lead/i.test(card.text),
    );
    if (absorbed.length) {
      boundary = mark(row, "PRODUCT_DEFECT", "IDENTITY");
      throw new Error(`Existing person absorbed Kwame contractor-lead: ${JSON.stringify(absorbed)}`);
    }
    const tomosDhp = cards.filter(
      (card) =>
        ["create", "update"].includes(card.family) &&
        /tomos/i.test(card.text) &&
        /dhp/i.test(card.text) &&
        !/priya/i.test(card.text),
    );
    if (tomosDhp.length) {
      boundary = mark(row, "PRODUCT_DEFECT", "IDENTITY");
      throw new Error(`DHP queries leaked onto Tomos: ${JSON.stringify(tomosDhp)}`);
    }
    row.uiInterpretation = "PASS";
    row.review = "PASS";

    const ready = cards.some((card) => ["create", "update"].includes(card.family));
    const appliedKwame = kwame.family === "create" || kwame.family === "update";
    if (ready) {
      const applyCall = await applyReady(page);
      await expectNoCaptureError(page);
      row.apply = passCell(Boolean(applyCall && applyCall.status === 200));
      if (!applyCall || applyCall.status !== 200) {
        boundary = applyCall && applyCall.status >= 500 ? "PERSISTENCE" : "APPLY";
        throw new Error(`Apply HTTP ${applyCall?.status ?? "missing"}`);
      }
      row.notes = [row.notes, applyExecutionNote(applyCall.body)].filter(Boolean).join(" | ");
    } else {
      row.apply = "n/a";
    }

    await hardReload(page);
    await openKnowledge(page);
    const people = await openKnowledgeBucket(page, "people");
    expect(people).toMatch(/Priya Nair/i);
    expect(people).toMatch(/Tomos Reed/i);
    expect(people).toMatch(/Jess Hale/i);
    if (ready && appliedKwame) {
      expect(people).toMatch(/Kwame Boateng/i);
    }
    expect(people).not.toMatch(/Kwame Boateng[\s\S]{0,80}Priya Nair|Priya Nair[\s\S]{0,80}contractor lead for Harbour/i);
    row.reload = ready ? "PASS" : "n/a";
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

test("Ambiguous they plus safe date", async ({ page }, testInfo) => {
  const spec = holdoutJourney("H5_AMBIGUOUS_THEY_PLUS_SAFE");
  const row = emptyMatrix(spec.title);
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillHoldoutProject(page, spec.kind);
    for (const person of spec.seed?.people ?? []) {
      await addComposeLine(page, "np-frame-people", person);
    }
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(page, spec.input);
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertHostedAiSuccess(capture, "Holdout H5 capture");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(capture);

    const cards = await collectReviewCards(page);
    const chair = cards.find(
      (card) =>
        card.family === "needs_you" &&
        (/huddle|chair/i.test(card.text) || /they agreed|one of them/i.test(card.text)),
    ) || cards.find((card) => card.family === "needs_you");
    const keys = cards.find(
      (card) => /void keys|depot/i.test(card.text) && ["create", "update"].includes(card.family),
    );
    if (!chair || chair.family !== "needs_you") {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(`Huddle chair was not isolated as Needs You: ${JSON.stringify(cards)}`);
    }
    if (!keys || !textRepresentsYmd(`${keys.text}\n${await bodyText(page)}`, "2026-10-16")) {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(`Safe depot date was not independently actionable: ${JSON.stringify(cards)}`);
    }
    const guessedChair = cards.filter(
      (card) =>
        ["create", "update"].includes(card.family) &&
        /chair|huddle/i.test(card.text) &&
        /elena|tomos/i.test(card.text),
    );
    if (guessedChair.length) {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(`Lume guessed a huddle chair: ${JSON.stringify(guessedChair)}`);
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
    const reloaded = await openKnowledgeBucket(page, "all");
    assertTextRepresentsYmd(reloaded, "2026-10-16", "Knowledge after hard reload");
    expect(reloaded).toMatch(/void keys|depot/i);
    expect(reloaded).not.toMatch(/chair the weekly mobilisation huddle/i);
    expect(reloaded).not.toMatch(/Elena Voss[\s\S]{0,60}huddle chair|Tomos Reed[\s\S]{0,60}huddle chair/i);
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

test("Messy ops paste", async ({ page }, testInfo) => {
  const spec = holdoutJourney("H6_MESSY_OPS_PASTE");
  const row = emptyMatrix(spec.title);
  let boundary: VerticalBoundary | undefined;
  try {
    await openNewProject(page);
    await fillHoldoutProject(page, spec.kind);
    const organise = await organiseNotes(page, spec.seed?.notes || "");
    row.hostedApi = passCell(Boolean(organise && organise.status === 200));
    assertHostedAiSuccess(organise, "Holdout H6 organise");
    row.liveOpenAi = "PASS";
    row.notes = provenanceNote(organise);
    await createProjectFromComposer(page);

    await openCapture(page);
    const capture = await analyseCapture(page, spec.input);
    row.hostedApi = passCell(Boolean(capture && capture.status === 200));
    assertHostedAiSuccess(capture, "Holdout H6 capture");
    row.notes = [row.notes, provenanceNote(capture)].filter(Boolean).join(" | ");

    const cards = await collectReviewCards(page);
    const body = await bodyText(page);
    await attachJson(testInfo, "h6-review-cards", { cards });
    const workshop = cards.find((card) => /mobilisation workshop/i.test(card.text));
    const keys = cards.find((card) => /void keys|depot/i.test(card.text));
    const kwame = cards.find((card) => /kwame/i.test(card.text));
    const plantsWritten = cards.some(
      (card) => ["create", "update"].includes(card.family) && /office plants|biscuits/i.test(card.text),
    );
    const speculativeDhpWritten = cards.some(
      (card) =>
        ["create", "update"].includes(card.family) &&
        /dhp/i.test(card.text) &&
        /priya/i.test(card.text) &&
        /might|speculat|if housing insist/i.test(card.text),
    );
    const workshopReady = Boolean(
      workshop && ["update", "create"].includes(workshop.family) && textRepresentsYmd(`${workshop.text}\n${body}`, "2026-10-22"),
    );
    const keysReady = Boolean(
      keys && ["create", "update"].includes(keys.family) && textRepresentsYmd(`${keys.text}\n${body}`, "2026-10-16"),
    );
    if (!workshopReady || !keysReady || !kwame || plantsWritten || speculativeDhpWritten) {
      boundary = mark(row, "PRODUCT_DEFECT", "REVIEW_UI");
      throw new Error(
        `Messy paste lost or transformed observations incorrectly: workshopReady=${workshopReady} keysReady=${keysReady} kwame=${Boolean(kwame)} plantsWritten=${plantsWritten} speculativeDhpWritten=${speculativeDhpWritten}. Cards=${JSON.stringify(cards)}`,
      );
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
    const reloaded = await openKnowledgeBucket(page, "all");
    assertTextRepresentsYmd(reloaded, "2026-10-22", "Knowledge after hard reload");
    expect(reloaded).toMatch(/mobilisation workshop/i);
    expect(reloaded).not.toMatch(/office plants need watering/i);
    expect(reloaded).not.toMatch(/bring biscuits/i);
    expect(reloaded).not.toMatch(/priya might take dhp/i);
    const people = await holdoutPeopleNames(page);
    expect(people.join(" ")).toMatch(/Priya Nair/i);
    expect(people.join(" ")).toMatch(/Tomos Reed/i);
    expect(people.join(" ")).toMatch(/Elena Voss/i);
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
