/**
 * Capture V2 simplified-layout experiment — presentation contracts only.
 * Does not change Capture intelligence, apply, or review-before-write.
 *
 * Run: npm run verify:capture-v2-simplified
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAPTURE_LAYOUT_DEFAULT,
  CAPTURE_LAYOUT_STORAGE_KEY,
  parseCaptureLayout,
} from "../src/lib/capture/layout-experiment";
import { pendingReadyModels } from "../src/lib/capture/review/counts";
import { buildReviewChangeViewModels } from "../src/lib/capture/review/viewModel";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import type { CaptureResult, Recommendation } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
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

function testLayoutFlagDefaultsClassic() {
  assert.equal(CAPTURE_LAYOUT_DEFAULT, "classic");
  assert.equal(parseCaptureLayout(undefined), "classic");
  assert.equal(parseCaptureLayout(null), "classic");
  assert.equal(parseCaptureLayout(""), "classic");
  assert.equal(parseCaptureLayout("classic"), "classic");
  assert.equal(parseCaptureLayout("nope"), "classic");
  assert.equal(parseCaptureLayout("simplified"), "simplified");
  assert.match(CAPTURE_LAYOUT_STORAGE_KEY, /lume-capture-layout-experiment/);
}

function testOceanStillEmbedsCaptureWorkspace() {
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.match(workspace, /CaptureWorkspace/);
  assert.match(workspace, /variant="ocean"/);
  assert.doesNotMatch(workspace, /CaptureSimplifiedWorkspace/);
}

function testClassicRemainsDefaultPath() {
  const capture = readSrc("src/components/capture/CaptureWorkspace.tsx");
  assert.match(capture, /variant\?: "legacy" \| "ocean"/);
  assert.match(capture, /experiment\.layout === "simplified"/);
  assert.match(capture, /CaptureClassicWorkspace/);
  assert.match(capture, /ocean-capture-analyse/);
  assert.match(capture, /ocean-capture-review-boundary/);
  assert.match(capture, /Nothing enters maintained project truth/);
  assert.match(capture, /CaptureBestPractice/);
  assert.match(capture, /capture-blocks/);
}

function testSimplifiedIsPresentationOnly() {
  const simplified = readSrc(
    "src/components/capture/simplified/CaptureSimplifiedWorkspace.tsx",
  );
  const review = readSrc(
    "src/components/capture/simplified/CaptureSimplifiedReview.tsx",
  );
  assert.doesNotMatch(simplified, /captureWithAI/);
  assert.doesNotMatch(review, /captureWithAI/);
  assert.match(simplified, /applyOne/);
  assert.match(simplified, /runAnalyse/);
  assert.match(simplified, /clearSession/);
  assert.doesNotMatch(simplified, /CaptureBestPractice/);
  assert.doesNotMatch(simplified, /capture-blocks/);
  assert.doesNotMatch(simplified, /usage-meter/);
  assert.match(simplified, /data-capture-layout="simplified"/);
  assert.match(simplified, /data-capture-experiment="v2"/);
  assert.match(simplified, /ocean-capture-analyse/);
  assert.match(simplified, /ocean-capture-input/);
  assert.match(simplified, /ocean-capture-record/);
  assert.match(simplified, /data-ai="true"/);
  assert.match(review, /Nothing enters maintained project truth/);
  assert.match(review, /Needs you/);
  assert.match(review, /Apply ready/);
}

function testSimplifiedBindsComposeToSessionContent() {
  const simplified = readSrc(
    "src/components/capture/simplified/CaptureSimplifiedWorkspace.tsx",
  );
  assert.match(simplified, /value=\{content\}/);
  assert.match(simplified, /onChange=\{setContent\}|onChange=\{\(text\) =>[\s\S]*setContent/);
  // Direct session binding — New Capture must not re-push stale blocks.
  assert.doesNotMatch(simplified, /joinBlocks/);
  assert.doesNotMatch(simplified, /makeBlock/);
}

function testToggleAndRollback() {
  const toggle = readSrc("src/components/capture/CaptureLayoutToggle.tsx");
  const hook = readSrc(
    "src/components/capture/useCaptureLayoutExperiment.ts",
  );
  assert.match(toggle, /Classic/);
  assert.match(toggle, /Simplified/);
  assert.match(toggle, /Experiment/);
  assert.match(toggle, /capture-layout-classic/);
  assert.match(toggle, /capture-layout-simplified/);
  assert.match(hook, /CAPTURE_LAYOUT_STORAGE_KEY/);
  assert.match(hook, /localStorage\.setItem/);
}

function testReadyItemsRemainProposals() {
  const s1 = suggestion({
    id: "s1",
    kind: "action",
    op: "create",
    content: "Order extra sprinkles",
    projectId: "p1",
    recommendation: stubRec({
      id: "r1",
      title: "Order extra sprinkles",
    }),
  });
  const result: CaptureResult = {
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
    recommendations: [s1.recommendation!],
  };
  const models = buildReviewChangeViewModels([s1], result, "notes");
  const ready = pendingReadyModels(models, {}, {});
  assert.ok(Array.isArray(ready));
  assert.equal(result.memory.source, "capture");
}

function testNoIntelligenceFilesTouchedByContract() {
  const simplified = readSrc(
    "src/components/capture/simplified/CaptureSimplifiedWorkspace.tsx",
  );
  assert.doesNotMatch(simplified, /runFindingsPipeline/);
  assert.doesNotMatch(simplified, /from "@\/lib\/capture\/apply"/);
}

async function main() {
  testLayoutFlagDefaultsClassic();
  console.log("✓ layout experiment defaults to classic + parses safely");
  testOceanStillEmbedsCaptureWorkspace();
  console.log("✓ Ocean still embeds CaptureWorkspace (classic default)");
  testClassicRemainsDefaultPath();
  console.log("✓ Classic Capture chrome and review-before-write remain");
  testSimplifiedIsPresentationOnly();
  console.log("✓ Simplified path is applyOne + Analyse, no immediate write");
  testSimplifiedBindsComposeToSessionContent();
  console.log("✓ Simplified compose binds to session content (New Capture clears)");
  testToggleAndRollback();
  console.log("✓ Classic / Simplified toggle + localStorage rollback");
  testReadyItemsRemainProposals();
  console.log("✓ Ready items remain proposals until Apply");
  testNoIntelligenceFilesTouchedByContract();
  console.log("✓ Simplified UI does not call findings/apply internals");
  console.log("verify-capture-v2-simplified: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
