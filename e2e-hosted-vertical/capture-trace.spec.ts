import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  RUN_ID,
  addComposeLine,
  analyseCapture,
  applyReady,
  assertHostedAiSuccess,
  attachJson,
  collectReviewCards,
  createProjectFromComposer,
  fillUniqueProject,
  hardReload,
  installApiRecorder,
  openCapture,
  openKnowledgeDates,
  openNewProject,
  organiseNotes,
  reviewCardByName,
  sanitizeValue,
  signIn,
  textRepresentsYmd,
} from "./helpers";

const OUT_DIR = path.join(process.cwd(), "test-results", "hosted-vertical", "trace");
const ARTIFACT_DIR = "/opt/cursor/artifacts";

type TimelineSnap = {
  id?: string;
  label?: string;
  startAt?: string;
  type?: string;
};

function writeTrace(name: string, value: unknown): string {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const body = JSON.stringify(sanitizeValue(value), null, 2);
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, body);
  fs.writeFileSync(path.join(ARTIFACT_DIR, name), body);
  return file;
}

function productionRows(rows: TimelineSnap[] | undefined): TimelineSnap[] {
  return (rows || []).filter((row) => /production release/i.test(String(row.label || "")));
}

async function snapshotTruth(page: import("@playwright/test").Page, projectId: string) {
  return page.evaluate(async (id) => {
    const cacheRaw = window.localStorage.getItem("lume-mission-supabase-cache-v1");
    const summarise = (state: {
      projects?: Array<{
        id?: string;
        name?: string;
        nextMilestone?: string;
        nextMilestoneAt?: string;
      }>;
      timeline?: Array<{ id?: string; projectId?: string; label?: string; startAt?: string; type?: string }>;
    } | undefined) => {
      const project = state?.projects?.find((row) => row.id === id);
      const timeline = (state?.timeline || [])
        .filter((row) => row.projectId === id)
        .map((row) => ({
          id: row.id,
          label: row.label,
          startAt: row.startAt,
          type: row.type,
        }));
      return {
        projectName: project?.name,
        nextMilestone: project?.nextMilestone ?? null,
        nextMilestoneAt: project?.nextMilestoneAt ?? null,
        timeline,
      };
    };
    let cache: ReturnType<typeof summarise> & { savedAt?: string } | null = null;
    if (cacheRaw) {
      try {
        const parsed = JSON.parse(cacheRaw) as { savedAt?: string; state?: Parameters<typeof summarise>[0] };
        cache = { savedAt: parsed.savedAt, ...summarise(parsed.state) };
      } catch {
        cache = null;
      }
    }
    const res = await fetch("/api/workspace/state", { credentials: "include", cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      state?: Parameters<typeof summarise>[0];
      error?: string;
    };
    return {
      at: new Date().toISOString(),
      hydrateHttp: res.status,
      hydrateError: json.error || null,
      cache,
      hydrate: summarise(json.state),
    };
  }, projectId);
}

function compactCaptureBody(body: unknown) {
  if (!body || typeof body !== "object") return body;
  const rec = body as Record<string, unknown>;
  const result = rec.result && typeof rec.result === "object" ? (rec.result as Record<string, unknown>) : {};
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
  return {
    provenance: rec.provenance,
    capturePipeline: rec.capturePipeline,
    findings: findings.map((item) => {
      const finding = item as Record<string, unknown>;
      return {
        id: finding.id,
        fact: finding.fact,
        evidence: finding.evidence,
        findingType: finding.findingType,
        invalidTarget: finding.invalidTarget,
        requiresClarification: finding.requiresClarification,
        clarificationQuestion: finding.clarificationQuestion,
        target: finding.target,
        projectId: finding.projectId,
        projectName: finding.projectName,
      };
    }),
    suggestions: suggestions.map((item) => {
      const suggestion = item as Record<string, unknown>;
      return {
        id: suggestion.id,
        kind: suggestion.kind,
        op: suggestion.op,
        content: suggestion.content,
        date: suggestion.date,
        legalDomain: suggestion.legalDomain,
        targetEntityId: suggestion.targetEntityId,
        readiness: suggestion.readiness,
        expectedTarget: suggestion.expectedTarget,
        proposedValues: suggestion.proposedValues,
      };
    }),
  };
}

function compactApplyBody(body: unknown, projectId: string) {
  if (!body || typeof body !== "object") return body;
  const rec = body as Record<string, unknown>;
  const state = rec.state && typeof rec.state === "object" ? (rec.state as Record<string, unknown>) : undefined;
  const projects = Array.isArray(state?.projects) ? (state?.projects as Array<Record<string, unknown>>) : [];
  const timeline = Array.isArray(state?.timeline) ? (state?.timeline as Array<Record<string, unknown>>) : [];
  const project = projects.find((row) => row.id === projectId);
  return {
    decision: rec.decision,
    executed: rec.executed,
    reconcileFailed: rec.reconcileFailed ?? false,
    error: rec.error ?? null,
    hasState: Boolean(state),
    project: project
      ? {
          id: project.id,
          name: project.name,
          nextMilestone: project.nextMilestone,
          nextMilestoneAt: project.nextMilestoneAt,
        }
      : null,
    timeline: timeline
      .filter((row) => row.projectId === projectId)
      .map((row) => ({
        id: row.id,
        label: row.label,
        startAt: row.startAt,
        type: row.type,
      })),
  };
}

test.beforeEach(async ({ page }, testInfo) => {
  installApiRecorder(page);
  testInfo.annotations.push({ type: "runId", description: RUN_ID });
  await signIn(page);
});

test("TRACE Capture date update Apply reload", async ({ page }, testInfo) => {
  await openNewProject(page);
  const identity = await fillUniqueProject(page, "capture");
  const organise = await organiseNotes(
    page,
    "The Production release is scheduled for 12 September 2026.\nOlga Petrov is responsible for UAT.",
  );
  assertHostedAiSuccess(organise, "TRACE date organise");
  const projectId = await createProjectFromComposer(page);
  const afterCreate = await snapshotTruth(page, projectId);

  await openCapture(page);
  const captureText = "The Production release is now scheduled for 20 September 2026.";
  const capture = await analyseCapture(page, captureText);
  assertHostedAiSuccess(capture, "TRACE date capture");
  const cards = await collectReviewCards(page);
  const update = reviewCardByName(page, /Production release/i).first();
  await expect(update).toBeVisible({ timeout: 15_000 });
  const reviewFamily = await update.getAttribute("data-review-family");
  const reviewText = ((await update.innerText()) || "").replace(/\s+/g, " ");

  const applyCall = await applyReady(page);
  const afterApplySnap = await snapshotTruth(page, projectId);
  const knowledgeAfterApply = await openKnowledgeDates(page);
  const datesAfterApply = ((await page.getByTestId("ocean-frame-dates").innerText().catch(() => "")) || "").replace(
    /\s+/g,
    " ",
  );

  const reloadStarted = Date.now();
  const stateResponse = page.waitForResponse(
    (res) => {
      try {
        return new URL(res.url()).pathname === "/api/workspace/state" && res.request().method() === "GET";
      } catch {
        return false;
      }
    },
    { timeout: 60_000 },
  );
  await hardReload(page);
  const workspaceVisibleMs = Date.now() - reloadStarted;
  const immediateSnap = await snapshotTruth(page, projectId);
  const immediateKnowledge = await openKnowledgeDates(page);
  const immediateDates = ((await page.getByTestId("ocean-frame-dates").innerText().catch(() => "")) || "").replace(
    /\s+/g,
    " ",
  );
  const hydrateRes = await stateResponse.catch(() => undefined);
  const hydrateMs = Date.now() - reloadStarted;

  await page.waitForTimeout(8_000);
  const waitedSnap = await snapshotTruth(page, projectId);
  const waitedKnowledge = await openKnowledgeDates(page);
  const waitedDates = ((await page.getByTestId("ocean-frame-dates").innerText().catch(() => "")) || "").replace(
    /\s+/g,
    " ",
  );

  const report = {
    runId: RUN_ID,
    journey: "capture-date",
    identity,
    projectId,
    captureText,
    afterCreate: {
      nextMilestoneAt: afterCreate.hydrate.nextMilestoneAt,
      timeline: productionRows(afterCreate.hydrate.timeline),
      cacheTimeline: productionRows(afterCreate.cache?.timeline),
    },
    capture: compactCaptureBody(capture?.body),
    review: { family: reviewFamily, text: reviewText.slice(0, 400), cards },
    apply: {
      http: applyCall?.status ?? null,
      request: sanitizeValue(applyCall?.requestPreview),
      response: compactApplyBody(applyCall?.body, projectId),
    },
    afterApply: {
      snap: afterApplySnap,
      knowledgeHas20: textRepresentsYmd(knowledgeAfterApply, "2026-09-20"),
      knowledgeHas12: textRepresentsYmd(knowledgeAfterApply, "2026-09-12"),
      datesFrame: datesAfterApply.slice(0, 500),
    },
    reload: {
      workspaceVisibleMs,
      hydrateMs,
      hydrateHttp: hydrateRes?.status ?? null,
      immediate: {
        snap: immediateSnap,
        knowledgeHas20: textRepresentsYmd(immediateKnowledge, "2026-09-20"),
        knowledgeHas12: textRepresentsYmd(immediateKnowledge, "2026-09-12"),
        datesFrame: immediateDates.slice(0, 500),
      },
      after8s: {
        snap: waitedSnap,
        knowledgeHas20: textRepresentsYmd(waitedKnowledge, "2026-09-20"),
        knowledgeHas12: textRepresentsYmd(waitedKnowledge, "2026-09-12"),
        datesFrame: waitedDates.slice(0, 500),
      },
    },
  };
  const file = writeTrace(`capture-date-trace-${RUN_ID}.json`, report);
  await attachJson(testInfo, "capture-date-trace", report);
  testInfo.annotations.push({ type: "traceFile", description: file });
  testInfo.annotations.push({ type: "projectId", description: projectId });
});

test("TRACE Ambiguity isolation", async ({ page }, testInfo) => {
  await openNewProject(page);
  const identity = await fillUniqueProject(page, "ambiguity");
  await addComposeLine(page, "np-frame-people", "Olga Petrov");
  await addComposeLine(page, "np-frame-people", "Sarah Kim");
  await addComposeLine(page, "np-frame-knowledge", "Production release");
  const projectId = await createProjectFromComposer(page);
  const afterCreate = await snapshotTruth(page, projectId);

  await openCapture(page);
  const captureText = [
    "Olga Petrov and Sarah Kim discussed the UAT handover. She will own UAT going forward.",
    "The Production release is now scheduled for 21 September 2026.",
  ].join("\n");
  const capture = await analyseCapture(page, captureText);
  assertHostedAiSuccess(capture, "TRACE ambiguity capture");
  const cards = await collectReviewCards(page);
  const report = {
    runId: RUN_ID,
    journey: "ambiguity",
    identity,
    projectId,
    captureText,
    afterCreate: {
      nextMilestoneAt: afterCreate.hydrate.nextMilestoneAt,
      timeline: afterCreate.hydrate.timeline,
      people: afterCreate.hydrate,
    },
    capture: compactCaptureBody(capture?.body),
    reviewCards: cards,
  };
  const file = writeTrace(`ambiguity-trace-${RUN_ID}.json`, report);
  await attachJson(testInfo, "ambiguity-trace", report);
  testInfo.annotations.push({ type: "traceFile", description: file });
  testInfo.annotations.push({ type: "projectId", description: projectId });
});
