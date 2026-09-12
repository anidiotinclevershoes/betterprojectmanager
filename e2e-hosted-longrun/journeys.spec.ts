import { test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { CAPTURES } from "./frozen-manifest";
import { compactDelta, diffSlices, mentions } from "./ledger";
import {
  applyIfReady,
  applyReviewSteps,
  ARTIFACT_DIR,
  bodyText,
  collectReviewCards,
  createProjectFromComposer,
  ensureComposerPeople,
  expectNoCaptureError,
  fillProjectName,
  hardReload,
  installApiRecorder,
  longrunRunId,
  startFreshCapture,
  collectRememberTexts,
  rememberExpectedKnowledge,
  openDedicatedProject,
  openKnowledge,
  openNewProject,
  organiseNotes,
  projectionCheck,
  readyApplyCount,
  recreateSession,
  screenshot,
  searchKnowledge,
  signIn,
  signOutIfPossible,
  snapshotProject,
  state0Gaps,
  uniqueLongrunIdentity,
  writeJson,
  analyseCapture,
  assertHostedAiSuccess,
  proveProductionSupabaseCorrespondence,
  hashCanonicalSlice,
  isDbCheckpoint,
  sliceCounts,
  fetchReadOnlySqlSnapshot,
  hasReadOnlySqlCredentials,
} from "./helpers";
import { proveIsolation, readWorkspaceState, siblingFingerprint } from "./isolation";
import { NEW_PROJECT_NOTES, STATE0_MUST_INCLUDE } from "./new-project";
import { LONGRUN_PRODUCTION_ORIGIN, LONGRUN_SEED, LONGRUN_SUITE_ID } from "./types";
import type { CaptureResultRow, CanonicalSlice, FailureBoundary } from "./types";

test.describe.configure({ mode: "serial" });

test("production long-run dogfood — New Project + 50 captures", async ({ page, browser }, testInfo) => {
  test.setTimeout(18_000_000);
  test.info().annotations.push({ type: "suite", description: LONGRUN_SUITE_ID });
  test.info().annotations.push({ type: "seed", description: LONGRUN_SEED });

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const runId = longrunRunId();
  const identity = uniqueLongrunIdentity(runId);
  const rows: CaptureResultRow[] = [];
  let pageRef = page;
  let dedicatedProjectId = "";
  let siblingBefore = "";
  let stop = false;

  const report = {
    suite: LONGRUN_SUITE_ID,
    seed: LONGRUN_SEED,
    runId,
    startedAt: new Date().toISOString(),
    originMainSha: "9f24a65c7ea38d1dabb2d513a87503fb9e7a4cd6",
    productionOrigin: LONGRUN_PRODUCTION_ORIGIN,
    playwrightBaseUrl: testInfo.project.use.baseURL,
    projectName: identity.name,
    projectCode: identity.code,
    isolation: {} as Record<string, unknown>,
    state0Gaps: [] as string[],
    composerAdds: [] as string[],
    rows,
    stopReason: "",
    finishedAt: "",
  };

  function persist() {
    writeJson("run-report.json", report);
    const md = [
      `# Long-run first untouched run`,
      ``,
      `- Suite: ${LONGRUN_SUITE_ID}`,
      `- Seed: ${LONGRUN_SEED}`,
      `- Run: ${runId}`,
      `- Origin: ${report.playwrightBaseUrl}`,
      `- Project: ${identity.name} (${identity.code})`,
      `- Dedicated id: ${dedicatedProjectId || "—"}`,
      ``,
      `| # | Summary | Expected | Review | Result | Boundary |`,
      `|---|---|---|---|---|---|`,
      ...rows.map(
        (r) =>
          `| ${r.n} | ${r.summary.replace(/\|/g, "/")} | ${r.expectedOps.replace(/\|/g, "/")} | ${r.review.replace(/\|/g, "/")} | ${r.result} | ${r.earliestBoundary || ""} |`,
      ),
      ``,
    ].join("\n");
    fs.writeFileSync(path.join(ARTIFACT_DIR, "matrix.md"), md);
  }

  installApiRecorder(pageRef);
  const auth = await signIn(pageRef);
  writeJson("auth.json", { vercelAccess: auth.vercelAccess, lumeAuth: auth.lumeAuth, emailRedacted: true });

  const isolation = await proveIsolation(pageRef, process.env.LUME_E2E_EMAIL || "");
  report.isolation = {
    ok: isolation.ok,
    emailDomainOk: isolation.emailDomainOk,
    projectCount: isolation.projectCount,
    projectNames: isolation.projectNames,
    suspiciousNames: isolation.suspiciousNames,
    reason: isolation.reason,
    userIdPresent: Boolean(isolation.userId),
    workspaceIdPresent: Boolean(isolation.workspaceId),
  };
  writeJson("isolation-proof.json", report.isolation);
  if (!isolation.ok) {
    report.stopReason = isolation.reason || "isolation failed";
    persist();
    throw new Error(`STOP CROSS_PROJECT_ISOLATION: ${isolation.reason}`);
  }

  const dbEnv = await proveProductionSupabaseCorrespondence(String(report.playwrightBaseUrl || LONGRUN_PRODUCTION_ORIGIN));
  writeJson("db-environment.json", dbEnv);
  if (!dbEnv.ok) {
    report.stopReason = dbEnv.reason || "production database correspondence failed";
    persist();
    throw new Error(`STOP: production app does not map to expected Supabase project: ${dbEnv.reason}`);
  }

  await openNewProject(pageRef);
  await fillProjectName(pageRef, identity.name);
  await pageRef.getByTestId("np-code").fill(identity.code);
  const organise = await organiseNotes(pageRef, NEW_PROJECT_NOTES);
  try {
    assertHostedAiSuccess(organise, "New Project Organise");
  } catch (error) {
    report.stopReason = error instanceof Error ? error.message : String(error);
    persist();
    throw error;
  }
  report.composerAdds = await ensureComposerPeople(pageRef, STATE0_MUST_INCLUDE.people);
  dedicatedProjectId = await createProjectFromComposer(pageRef);
  await screenshot(pageRef, "np-created");
  await hardReload(pageRef);
  let slice = await snapshotProject(pageRef, dedicatedProjectId);
  writeJson("state-0.json", slice);
  writeJson("db/00-api.json", { n: 0, hash: hashCanonicalSlice(slice), counts: sliceCounts(slice) });
  report.state0Gaps = state0Gaps(slice);
  if (hasReadOnlySqlCredentials()) {
    const sql0 = await fetchReadOnlySqlSnapshot(dedicatedProjectId);
    writeJson("db/00-sql.json", sql0);
    if (sql0.hash !== hashCanonicalSlice(slice)) {
      report.state0Gaps.push("State 0 API hash !== SQL hash");
    }
  }
  const proj0 = await projectionCheck(pageRef, slice);
  writeJson("state-0-projection.json", { gaps: report.state0Gaps, projection: proj0 });
  const ws0 = await readWorkspaceState(pageRef);
  siblingBefore = siblingFingerprint(ws0.state || {}, dedicatedProjectId);

  rows.push({
    n: 0,
    summary: "New Project State 0",
    expectedOps: "people + issues + todos + dates + knowledge",
    review: report.composerAdds.length ? `composer added ${report.composerAdds.join(", ")}` : "organise only",
    result: report.state0Gaps.length ? "FAIL" : "PASS",
    earliestBoundary: report.state0Gaps.length ? "VALIDATE" : undefined,
    notes: [...report.state0Gaps, ...proj0].join("; ") || "State 0 accepted",
    projectionMismatches: proj0,
  });
  persist();

  for (const capture of CAPTURES) {
    if (stop) {
      rows.push({
        n: capture.n,
        summary: capture.summary,
        expectedOps: capture.expected.map((e) => `${e.op}:${e.title}`).join("; "),
        review: capture.review.map((r) => r.kind).join(", ") || "none",
        result: "SKIPPED",
        notes: "skipped after STOP",
      });
      continue;
    }

    const row: CaptureResultRow = {
      n: capture.n,
      summary: capture.summary,
      expectedOps: capture.expected.map((e) => `${e.op} ${e.domain} ${e.title}`).join("; "),
      review: capture.review.map((r) => r.kind).join(", ") || "none",
      result: "PASS",
    };

    try {
      await openDedicatedProject(pageRef, dedicatedProjectId);
      const before = await snapshotProject(pageRef, dedicatedProjectId);
      writeJson(`captures/${String(capture.n).padStart(2, "0")}-before.json`, before);

      await startFreshCapture(pageRef);
      const analyse = await analyseCapture(pageRef, capture.source);
      assertHostedAiSuccess(analyse, `Capture ${capture.n}`);
      const cards = await collectReviewCards(pageRef);
      const remember = await collectRememberTexts(pageRef);
      writeJson(`captures/${String(capture.n).padStart(2, "0")}-review.json`, { cards, remember });
      await screenshot(pageRef, `c${String(capture.n).padStart(2, "0")}-review`);

      row.needsYouObserved = cards.filter((c) => c.family === "needs_you").map((c) => c.text.slice(0, 160));
      row.applyCountBefore = await readyApplyCount(pageRef);
      const reviewNotes = await applyReviewSteps(pageRef, capture.review);
      const knowledgeTitles = capture.expected
        .filter((e) => e.domain === "knowledge" && (e.op === "create" || e.op === "update"))
        .map((e) => e.title);
      reviewNotes.push(...(await rememberExpectedKnowledge(pageRef, knowledgeTitles)));
      row.applyCountAfterExclude = await readyApplyCount(pageRef);
      row.notes = reviewNotes.join(" | ");

      const mid = await snapshotProject(pageRef, dedicatedProjectId);
      const preApplyDelta = compactDelta(diffSlices(before, mid));
      const preApplyWrites = Object.entries(preApplyDelta).filter(([, v]) => v.length);
      const immediateWriteSteps = capture.review.some((s) =>
        s.kind === "edit_date" || (s.kind === "needs_you_resolve" && (s.resolve === "resolve" || s.resolve === "share" || s.resolve === "replace" || s.resolve === "date")),
      );
      if (preApplyWrites.length && !immediateWriteSteps) {
        row.result = "FAIL";
        row.earliestBoundary = "REVIEW_UI";
        row.notes = `${row.notes || ""} | pre-Apply canonical writes: ${JSON.stringify(preApplyWrites)}`;
      }

      const applied = await applyIfReady(pageRef);
      row.applyHttp = applied.http;
      if (applied.error) {
        row.result = "FAIL";
        row.earliestBoundary = row.earliestBoundary || "APPLY";
        row.notes = `${row.notes || ""} | ${applied.error}`;
      }

      await expectNoCaptureError(pageRef).catch((error: Error) => {
        row.result = "FAIL";
        row.earliestBoundary = row.earliestBoundary || "APPLY";
        row.notes = `${row.notes || ""} | ${error.message}`;
      });

      const after = await snapshotProject(pageRef, dedicatedProjectId);
      writeJson(`captures/${String(capture.n).padStart(2, "0")}-after.json`, after);
      const delta = diffSlices(before, after);
      const compact = compactDelta(delta);
      writeJson(`captures/${String(capture.n).padStart(2, "0")}-delta.json`, compact);

      const isolationBreach = (() => {
        if (after.projectId !== dedicatedProjectId) return "dedicated project id changed";
        if (delta.removedPeople.length && !capture.expected.some((e) => e.op === "remove" && e.domain === "person")) {
          return `unexpected person removal: ${delta.removedPeople.map((p) => p.name).join(", ")}`;
        }
        return undefined;
      })();
      if (isolationBreach) {
        row.result = "STOP";
        row.earliestBoundary = "STOP";
        row.notes = isolationBreach;
        report.stopReason = isolationBreach;
        stop = true;
      }

      const ws = await readWorkspaceState(pageRef);
      const siblingAfter = siblingFingerprint(ws.state || {}, dedicatedProjectId);
      if (siblingAfter !== siblingBefore) {
        row.result = "STOP";
        row.earliestBoundary = "CROSS_PROJECT_ISOLATION";
        row.notes = `${row.notes || ""} | sibling project fingerprint changed`;
        report.stopReason = "sibling project fingerprint changed";
        stop = true;
      }

      row.unexpectedCreates = [
        ...delta.createdPeople.filter((p) => !capture.expected.some((e) => e.op === "create" && mentions(p.name, e.title))).map((p) => `person:${p.name}`),
        ...delta.createdTodos.filter((t) => !capture.expected.some((e) => (e.op === "create" || e.op === "exclude_no_write") && mentions(t.title, e.title))).map((t) => `todo:${t.title}`),
        ...delta.createdRisks.filter((r) => !capture.expected.some((e) => e.op === "create" && mentions(r.title, e.title))).map((r) => `risk:${r.title}`),
        ...delta.createdMilestones.filter((m) => !capture.expected.some((e) => e.op === "create" && mentions(m.label, e.title))).map((m) => `milestone:${m.label}`),
      ];
      row.unexpectedRemoves = [
        ...delta.removedPeople.map((p) => `person:${p.name}`),
        ...delta.removedTodos.map((t) => `todo:${t.title}`),
        ...delta.removedRisks.map((r) => `risk:${r.title}`),
        ...delta.removedMilestones.map((m) => `milestone:${m.label}`),
      ];
      row.missingWrites = capture.expected
        .filter((e) => e.op === "create" || e.op === "update" || e.op === "complete")
        .filter((e) => {
          if (e.op === "create") {
            return ![
              ...delta.createdPeople.map((p) => p.name),
              ...delta.createdTodos.map((t) => t.title),
              ...delta.createdRisks.map((r) => r.title),
              ...delta.createdMilestones.map((m) => m.label),
              ...delta.createdKnowledge.map((k) => k.body),
              ...delta.createdResponsibilities.map((r) => `${r.personName} ${r.scope}`),
              ...delta.updatedTodos.map((u) => u.after.title),
              ...delta.updatedMilestones.map((u) => u.after.label),
            ].some((text) => mentions(text, e.title));
          }
          if (e.op === "complete") {
            return !delta.updatedTodos.some((u) => mentions(u.after.title, e.title) && u.after.done) &&
              !delta.updatedRisks.some((u) => mentions(u.after.title, e.title) && /resolved|closed|accepted/i.test(u.after.status));
          }
          if (e.op === "update") {
            const hit =
              delta.updatedTodos.some((u) => mentions(u.after.title, e.title)) ||
              delta.updatedRisks.some((u) => mentions(u.after.title, e.title)) ||
              delta.updatedMilestones.some((u) => mentions(u.after.label, e.title)) ||
              (e.ymd && after.milestones.some((m) => mentions(m.label, e.title) && m.startAt === e.ymd)) ||
              (e.ymd && after.todos.some((t) => mentions(t.title, e.title) && t.dueAt === e.ymd));
            return !hit;
          }
          return false;
        })
        .map((e) => `${e.op}:${e.title}`);

      const excludedLeaked = capture.expected
        .filter((e) => e.op === "exclude_no_write")
        .filter((e) =>
          [...delta.createdTodos, ...delta.createdKnowledge].some((row) =>
            mentions("title" in row ? row.title : row.body, e.title),
          ),
        )
        .map((e) => e.title);
      if (excludedLeaked.length) {
        row.result = "FAIL";
        row.earliestBoundary = row.earliestBoundary || "REVIEW_EXCLUDE";
        row.notes = `${row.notes || ""} | excluded leaked: ${excludedLeaked.join(", ")}`;
      }

      const expectNy = capture.expected.filter((e) => e.op === "needs_you" || e.op === "product_model_gap_needs_you");
      if (expectNy.length && !(row.needsYouObserved || []).length) {
        const guessed = expectNy.filter((e) =>
          [...delta.createdPeople, ...delta.createdTodos, ...delta.createdRisks, ...delta.createdMilestones].some((row) =>
            mentions("name" in row ? row.name : "title" in row ? row.title : row.label, e.title),
          ),
        );
        if (guessed.length) {
          row.result = "FAIL";
          row.earliestBoundary = row.earliestBoundary || "IDENTITY";
          row.notes = `${row.notes || ""} | ambiguity guessed: ${guessed.map((g) => g.title).join(", ")}`;
        }
      }

      if (delta.idReplacements.length) {
        row.result = "FAIL";
        row.earliestBoundary = row.earliestBoundary || "PERSIST";
        row.notes = `${row.notes || ""} | id replacement ${delta.idReplacements.join(", ")}`;
      }
      if (delta.duplicatePeople.length) {
        row.result = "FAIL";
        row.earliestBoundary = row.earliestBoundary || "IDENTITY";
        row.notes = `${row.notes || ""} | duplicate people ${delta.duplicatePeople.join(", ")}`;
      }

      if ((row.missingWrites || []).length && row.result === "PASS") {
        row.result = "FAIL";
        row.earliestBoundary = row.earliestBoundary || "AI_EXTRACT";
      }
      if ((row.unexpectedRemoves || []).length) {
        row.result = "FAIL";
        row.earliestBoundary = row.earliestBoundary || "APPLY";
        if (row.unexpectedRemoves.some((x) => x.startsWith("person:") || x.startsWith("risk:") || x.startsWith("milestone:"))) {
          row.earliestBoundary = "STOP";
          report.stopReason = `unexpected destructive mutation on C${capture.n}: ${row.unexpectedRemoves.join(", ")}`;
          stop = true;
        }
      }

      if (isDbCheckpoint(capture.n) || capture.highRisk || capture.checkpoint?.includes("reload")) {
        writeJson(`db/${String(capture.n).padStart(2, "0")}-api.json`, {
          n: capture.n,
          hash: hashCanonicalSlice(after),
          counts: sliceCounts(after),
        });
        if (hasReadOnlySqlCredentials()) {
          const sql = await fetchReadOnlySqlSnapshot(dedicatedProjectId);
          writeJson(`db/${String(capture.n).padStart(2, "0")}-sql.json`, sql);
          if (sql.hash !== hashCanonicalSlice(after)) {
            row.result = "FAIL";
            row.earliestBoundary = row.earliestBoundary || "PERSIST";
            row.notes = `${row.notes || ""} | API hash !== SQL hash`;
          }
        }
      }

      if (capture.checkpoint?.includes("reload") || capture.highRisk) {
        await hardReload(pageRef);
        const reloaded = await snapshotProject(pageRef, dedicatedProjectId);
        const reloadDelta = compactDelta(diffSlices(after, reloaded));
        const changed = Object.values(reloadDelta).some((v) => v.length);
        if (changed) {
          row.result = "FAIL";
          row.earliestBoundary = row.earliestBoundary || "HYDRATE";
          row.notes = `${row.notes || ""} | reload delta ${JSON.stringify(reloadDelta)}`;
        }
        row.projectionMismatches = await projectionCheck(pageRef, reloaded);
        if (row.projectionMismatches.length && row.result === "PASS") {
          row.result = "FAIL";
          row.earliestBoundary = "PROJECTION";
        }
        slice = reloaded;
      } else {
        slice = after;
      }

      if (capture.checkpoint?.includes("nav")) {
        await pageRef.goto("/projects", { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await openDedicatedProject(pageRef, dedicatedProjectId);
      }
      if (capture.checkpoint?.includes("search")) {
        const found = await searchKnowledge(pageRef, "PC");
        if (!/practical completion|PC/i.test(found)) {
          row.projectionMismatches = [...(row.projectionMismatches || []), "search PC did not surface practical completion"];
        }
      }
      if (capture.checkpoint?.includes("signin")) {
        await signOutIfPossible(pageRef);
        await signIn(pageRef);
        await openDedicatedProject(pageRef, dedicatedProjectId);
      }
      if (capture.checkpoint?.includes("restart")) {
        const next = await recreateSession(browser, dedicatedProjectId);
        await pageRef.context().close().catch(() => undefined);
        pageRef = next;
        const restarted = await snapshotProject(pageRef, dedicatedProjectId);
        const restartDelta = compactDelta(diffSlices(slice, restarted));
        if (Object.values(restartDelta).some((v) => v.length)) {
          row.result = "FAIL";
          row.earliestBoundary = row.earliestBoundary || "HYDRATE";
          row.notes = `${row.notes || ""} | restart delta ${JSON.stringify(restartDelta)}`;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      row.result = /STOP|CROSS_PROJECT|isolation/i.test(message) ? "STOP" : "FAIL";
      row.earliestBoundary = /AUTH/i.test(message)
        ? "AUTH"
        : /isolation|CROSS_PROJECT/i.test(message)
          ? "CROSS_PROJECT_ISOLATION"
          : "INFRASTRUCTURE";
      row.notes = message.slice(0, 500);
      if (row.result === "STOP") {
        report.stopReason = message;
        stop = true;
      }
      await screenshot(pageRef, `c${String(capture.n).padStart(2, "0")}-fail`);
    }

    rows.push(row);
    persist();
    writeJson(`captures/${String(capture.n).padStart(2, "0")}-row.json`, row);
  }

  const finalSlice = dedicatedProjectId ? await snapshotProject(pageRef, dedicatedProjectId).catch(() => slice) : slice;
  writeJson("state-final.json", finalSlice);
  await screenshot(pageRef, "final-knowledge");
  await openKnowledge(pageRef).catch(() => undefined);
  writeJson("final-ui.txt", { body: (await bodyText(pageRef)).slice(0, 8000) });
  report.finishedAt = new Date().toISOString();
  persist();
  await testInfo.attach("run-report", { path: path.join(ARTIFACT_DIR, "run-report.json") }).catch(() => undefined);
  await testInfo.attach("matrix", { path: path.join(ARTIFACT_DIR, "matrix.md") }).catch(() => undefined);

  if (report.stopReason && /CROSS_PROJECT|destructive|isolation/i.test(report.stopReason)) {
    throw new Error(`STOP: ${report.stopReason}`);
  }
});
