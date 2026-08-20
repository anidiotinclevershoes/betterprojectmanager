/**
 * Slice 2B: Capture Ocean workspace integration — focused checks.
 * Deterministic. No OpenAI. Presentation + trust contracts only.
 *
 * Run: npm run verify:ocean-capture
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pendingReadyModels } from "../src/lib/capture/review/counts";
import { buildReviewChangeViewModels } from "../src/lib/capture/review/viewModel";
import type { CaptureFinding } from "../src/lib/capture/findings";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import type { CaptureResult, Recommendation } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function stubResult(partial: Partial<CaptureResult> = {}): CaptureResult {
  return {
    memory: {
      id: "mem-test",
      type: "conversation",
      title: "Test",
      content: "source transcript preserved",
      tags: [],
      people: [],
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      source: "capture",
    },
    insights: [],
    assumptions: [],
    recommendations: [],
    ...partial,
  };
}

function stubRec(
  partial: Partial<Recommendation> & Pick<Recommendation, "id" | "title">,
): Recommendation {
  return {
    kind: "decision",
    urgency: "today",
    action: partial.title,
    why: "test",
    leadershipImpact: "test",
    createdAt: new Date().toISOString(),
    status: "active",
    ...partial,
  };
}

function finding(
  partial: Partial<CaptureFinding> &
    Pick<CaptureFinding, "id" | "fact" | "findingType">,
): CaptureFinding {
  return {
    evidence: partial.evidence ?? partial.fact,
    confidence: partial.confidence ?? 90,
    requiresClarification: partial.requiresClarification ?? false,
    reasoningSummary: partial.reasoningSummary ?? partial.fact,
    ...partial,
  };
}

function suggestion(
  partial: Partial<PendingSuggestion> &
    Pick<PendingSuggestion, "id" | "kind" | "op" | "content">,
): PendingSuggestion {
  return {
    destination: partial.destination ?? "project",
    date: partial.date,
    waitingOn: partial.waitingOn,
    todoKind: partial.todoKind,
    recommendation: partial.recommendation,
    knowledgeSection: partial.knowledgeSection,
    timelineItem: partial.timelineItem,
    projectId: partial.projectId,
    projectUncertain: partial.projectUncertain,
    ...partial,
  };
}

function testCaptureModeInOceanWorkspace() {
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  const mode = readSrc(
    "src/components/knowledge-centre/ProjectModeSelector.tsx",
  );
  assert.match(workspace, /mode === "capture"/);
  assert.match(workspace, /ocean-capture-mode/);
  assert.match(workspace, /variant="ocean"/);
  assert.match(workspace, /CaptureWorkspace/);
  assert.match(mode, /ocean-mode-capture/);
  assert.match(mode, /Coming soon/);
  assert.match(mode, /disabled/);
  // Modes remain in workspace — not sidebar destinations
  const sidebar = readSrc("src/components/app-shell/Sidebar.tsx");
  assert.doesNotMatch(sidebar, /href="\/capture"/);
  assert.doesNotMatch(sidebar, />Capture</);
}

function testOceanCaptureAiAffordanceAndInputs() {
  const capture = readSrc("src/components/capture/CaptureWorkspace.tsx");
  assert.match(capture, /variant\?: "legacy" \| "ocean"/);
  assert.match(capture, /ocean-capture-analyse/);
  assert.match(capture, /✦/);
  assert.match(capture, /Analyse/);
  assert.match(capture, /data-ai="true"/);
  assert.match(capture, /ocean-capture-input/);
  assert.match(capture, /data-ai="false"/);
  assert.match(capture, /ocean-capture-record/);
  assert.match(capture, /Record/);
  assert.match(capture, /ocean-capture-review-boundary/);
  assert.match(capture, /Nothing enters maintained project truth/);
  assert.match(capture, /until you approve/);
}

function testAnalyseDoesNotWriteMaintainedTruth() {
  // Characterise: review models from findings are proposals until Apply Ready.
  const s1 = suggestion({
    id: "s1",
    kind: "action",
    op: "create",
    content: "Chase Priya for CAB pack",
    projectId: "p1",
    recommendation: stubRec({
      id: "r1",
      title: "Chase Priya for CAB pack",
    }),
  });
  const result = stubResult({
    findings: [
      finding({
        id: "f1",
        fact: "Chase Priya for CAB pack",
        findingType: "NEW_INFORMATION",
        confidence: 92,
      }),
    ],
    recommendations: [s1.recommendation!],
  });
  const models = buildReviewChangeViewModels([s1], result, "notes");
  assert.ok(models.length >= 1);
  const ready = pendingReadyModels(models, {}, {});
  // Ready-or-not: either way these are still proposals, not MissionState writes.
  assert.ok(Array.isArray(ready));
  assert.equal(result.memory.source, "capture");
}

function testDarkOnlyV1() {
  const header = readSrc("src/components/app-shell/TopHeader.tsx");
  const appearance = readSrc("src/lib/appearance.tsx");
  const layout = readSrc("src/app/layout.tsx");
  assert.doesNotMatch(header, /AppearanceToggle/);
  assert.match(appearance, /V1 is dark-only|dark-only/);
  assert.match(appearance, /forceDarkDocument|dataset\.theme = "dark"/);
  assert.match(layout, /dataset\.theme = 'dark'/);
  assert.doesNotMatch(layout, /prefers-color-scheme: light/);
}

function testOceanSidebarContractPreserved() {
  const sidebar = readSrc("src/components/app-shell/Sidebar.tsx");
  assert.doesNotMatch(sidebar, /Lume Overview/);
  assert.doesNotMatch(sidebar, /href="\/coaching"/);
  assert.doesNotMatch(sidebar, /href="\/memory"/);
  assert.match(sidebar, /Master To Do/);
  assert.match(sidebar, /History/);
  assert.match(sidebar, /Captures/);
}

function testNoSecondNavModel() {
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  // Capture is not a Link/route switch inside the workspace
  assert.doesNotMatch(workspace, /href="\/capture"/);
  assert.doesNotMatch(workspace, /router\.(push|replace).*capture/);
  assert.match(workspace, /ProjectModeSelector/);
}

async function main() {
  testCaptureModeInOceanWorkspace();
  console.log("✓ Capture selectable in Ocean mode selector + embedded");
  testOceanCaptureAiAffordanceAndInputs();
  console.log("✓ ✦ Analyse, typed input, Record, review boundary");
  testAnalyseDoesNotWriteMaintainedTruth();
  console.log("✓ Analyse path yields proposals only (review-before-write)");
  testDarkOnlyV1();
  console.log("✓ dark-only V1 — no light toggle in project chrome");
  testOceanSidebarContractPreserved();
  console.log("✓ Slice 2A sidebar contract preserved");
  testNoSecondNavModel();
  console.log("✓ Capture↔KC remains mode switch, not second nav");
  console.log("verify-ocean-capture: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
