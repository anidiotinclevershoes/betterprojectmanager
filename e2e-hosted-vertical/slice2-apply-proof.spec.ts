import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  RUN_ID,
  addComposeLine,
  analyseCapture,
  applyReady,
  assertHostedAiSuccess,
  collectReviewCards,
  createProjectFromComposer,
  currentProjectId,
  expectNoCaptureError,
  fillUniqueProject,
  installApiRecorder,
  openCapture,
  openNewProject,
  sanitizeValue,
  signIn,
  textRepresentsYmd,
} from "./helpers";

const OUT_DIR = path.join(process.cwd(), "test-results", "hosted-vertical", "slice2");
const ARTIFACT_DIR = "/opt/cursor/artifacts";

function writeProof(name: string, value: unknown): string {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const body = JSON.stringify(sanitizeValue(value), null, 2);
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, body);
  fs.writeFileSync(path.join(ARTIFACT_DIR, name), body);
  return file;
}

test("Slice 2 hosted milestone-create Apply + receipt replay", async ({ page }) => {
  test.setTimeout(240_000);
  await installApiRecorder(page);
  await signIn(page);

  await openNewProject(page);
  const identity = await fillUniqueProject(page, "capture");
  await addComposeLine(page, "np-frame-people", "Proof Owner");
  const projectId = await createProjectFromComposer(page);
  expect(projectId).toBeTruthy();

  await openCapture(page);
  const capture = await analyseCapture(
    page,
    "The Slice2 Hosted Gate is scheduled for 22 September 2026.",
  );
  assertHostedAiSuccess(capture, "Slice 2 capture");

  const cards = await collectReviewCards(page);
  const dateCard = cards.find((card) => /slice2 hosted gate/i.test(card.text));
  writeProof("slice2-review-cards.json", { projectId, identity, cards, captureStatus: capture?.status });
  if (!dateCard || dateCard.family !== "create") {
    throw new Error(
      `REVIEW_UI: expected Review family create for Slice2 Hosted Gate, got ${JSON.stringify(cards)}`,
    );
  }
  expect(textRepresentsYmd(`${dateCard.text}`, "2026-09-22") || /22\s*Sep/i.test(dateCard.text)).toBeTruthy();

  let applyRequestJson: unknown;
  page.on("request", (req) => {
    try {
      if (new URL(req.url()).pathname === "/api/capture/apply" && req.method() === "POST") {
        applyRequestJson = req.postDataJSON();
      }
    } catch {
      /* ignore parse errors; replay will fail closed */
    }
  });
  const applyCall = await applyReady(page);
  await expectNoCaptureError(page);
  expect(applyCall?.status).toBe(200);
  const applyBody = (applyCall?.body || {}) as Record<string, unknown>;
  writeProof("slice2-first-apply.json", {
    projectId,
    status: applyCall?.status,
    request: applyRequestJson,
    response: applyBody,
  });

  const executed = applyBody?.executed as { kind?: string; operation?: string } | undefined;
  if (executed?.kind !== "wrote") {
    throw new Error(`APPLY: first Apply executed.kind=${executed?.kind ?? "missing"}, expected wrote`);
  }

  const replay = await page.request.post("/api/capture/apply", {
    data: applyRequestJson,
    headers: { Accept: "application/json" },
  });
  const replayBody = (await replay.json().catch(() => ({}))) as Record<string, unknown>;
  writeProof("slice2-replay-apply.json", {
    projectId,
    status: replay.status(),
    request: applyRequestJson,
    response: replayBody,
  });
  expect(replay.status()).toBe(200);
  const replayExecuted = replayBody.executed as { kind?: string; reason?: string } | undefined;
  if (replayExecuted?.kind !== "no_change") {
    throw new Error(
      `APPLY: replay executed.kind=${replayExecuted?.kind ?? "missing"}, expected no_change. ${JSON.stringify(replayBody).slice(0, 800)}`,
    );
  }

  const workspace = await page.request.get("/api/workspace/state");
  expect(workspace.status()).toBe(200);
  const payload = (await workspace.json()) as {
    state?: {
      timeline?: Array<{ projectId?: string; label?: string; startAt?: string }>;
      projects?: Array<{ id?: string; name?: string }>;
    };
  };
  const timeline = (payload.state?.timeline || []).filter((row) => row.projectId === projectId);
  const slice2Rows = timeline.filter((row) => /slice2 hosted gate/i.test(String(row.label || "")));
  writeProof("slice2-workspace-after.json", {
    projectId,
    currentProjectId: await currentProjectId(page),
    slice2Rows,
    timelineCount: timeline.length,
  });
  expect(slice2Rows).toHaveLength(1);
  expect(slice2Rows[0]?.startAt || "").toMatch(/2026-09-22/);

  writeProof("slice2-proof-summary.json", {
    runId: RUN_ID,
    projectId,
    identity,
    reviewFamily: dateCard.family,
    firstExecutedKind: executed.kind,
    replayExecutedKind: replayExecuted.kind,
    replayReason: replayExecuted.reason,
    canonicalLabel: slice2Rows[0]?.label,
    canonicalStartAt: slice2Rows[0]?.startAt,
  });
});
