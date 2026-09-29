/**
 * Page 09 Review workspace presentation contracts.
 * Source-level plus the existing readiness selectors.
 * Does not change Apply, view models, or persistence.
 *
 * Run: npx tsx scripts/verify-review-workspace-presentation.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pendingReadyModels } from "../src/lib/capture/review/counts";
import type { ReviewChangeViewModel } from "../src/lib/capture/review/viewModel";

const ROOT = join(import.meta.dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function testNoFalseUnsavedWarning() {
  const files = [
    "src/components/capture/CaptureWorkspace.tsx",
    "src/components/capture/review/SuggestedChangesList.tsx",
    "src/components/capture/review/CaptureSummary.tsx",
    "src/components/capture/review/DidntUnderstand.tsx",
    "src/components/capture/review-workspace.css",
  ];
  for (const file of files) {
    const src = readSrc(file);
    assert.doesNotMatch(src, /Leaving this screen/);
    assert.doesNotMatch(src, /Unsaved review/);
    assert.doesNotMatch(src, /will lose your changes/);
    assert.doesNotMatch(src, /P09\/Review\/UnsavedWarning/);
  }
}

function testApplyStillUsesExistingPath() {
  const workspace = readSrc("src/components/capture/CaptureWorkspace.tsx");
  const list = readSrc("src/components/capture/review/SuggestedChangesList.tsx");
  assert.match(workspace, /onApproveReady=\{approveReady\}/);
  assert.match(workspace, /applyPendingReadyQueue/);
  assert.match(workspace, /pendingReadyModels\(reviewModels, added, dismissed\)/);
  assert.match(workspace, /confirmAuthoritativeWrites/);
  assert.match(list, /onClick=\{onApproveReady\}/);
  assert.match(list, /aria-label=\{`Apply Ready \(\$\{readyCount\}\)`\}/);
  assert.match(list, /Apply \{readyCount\} changes/);
  assert.match(list, /readyCount > 0/);
  assert.doesNotMatch(list, /Discard review/);
}

function testNeedsYouStaysAGroupNotAFilter() {
  const list = readSrc("src/components/capture/review/SuggestedChangesList.tsx");
  assert.match(list, /id: "all"/);
  assert.match(list, /id: "create"/);
  assert.match(list, /id: "update"/);
  assert.match(list, /id: "remove"/);
  assert.doesNotMatch(list, /id: "needsYou"/);
  const needsAt = list.indexOf('id="group-needs-you"');
  const proposedAt = list.indexOf('id="group-proposed"');
  assert.ok(needsAt > 0 && proposedAt > needsAt);
  assert.match(list, />\s*Needs You\s*</);
}

function testExcludeDoesNotBecomeApply() {
  const card = readSrc("src/components/capture/review/SuggestedChangeCard.tsx");
  const actions = readSrc("src/components/capture/review/CorrectionActions.tsx");
  assert.match(card, /Exclude change/);
  assert.match(card, /onClick=\{onDismiss\}/);
  assert.match(actions, /Exclude change/);
  assert.match(actions, /onClick=\{handlers\.onDismiss\}/);
  assert.doesNotMatch(card, /Exclude change[\s\S]{0,80}onApprove/);
}

function testUpdateRetainsFromTo() {
  const card = readSrc("src/components/capture/review/CompactChangeCard.tsx");
  assert.match(card, /className="lume-review-from">\{diff\.from\}/);
  assert.match(card, /className="lume-review-to">\{diff\.to\}/);
  assert.match(card, /layout === "suggested_only" \|\| !hasFrom/);
  assert.match(card, /data-review-family=\{family\}/);
}

function testCollapseAndFilterDoNotTouchReadiness() {
  const card = readSrc("src/components/capture/review/CompactChangeCard.tsx");
  const list = readSrc("src/components/capture/review/SuggestedChangesList.tsx");
  assert.match(card, /useState\(Boolean\(forceCollapsed\)\)/);
  assert.match(card, /data-testid="review-card-collapse"/);
  const toggle = card.slice(card.indexOf('data-testid="review-card-collapse"'));
  assert.match(toggle, /onClick=\{\(\) => setCollapsed\(\(value\) => !value\)\}/);
  assert.doesNotMatch(toggle.slice(0, 220), /onDismiss|onApprove|setReviewOverride/);
  assert.match(list, /forceCollapsed=\{queueCollapsed\}/);
  assert.match(list, /setQueueCollapsed\(\(value\) => !value\)/);
  assert.match(list, /setFilter\(item\.id\)/);
  assert.doesNotMatch(list, /setFilter[\s\S]{0,120}onApproveReady|setQueueCollapsed[\s\S]{0,120}onDismiss/);
}

function testSpanFocusAndDidntUnderstand() {
  const transcript = readSrc("src/components/capture/review/AnnotatedTranscript.tsx");
  const workspace = readSrc("src/components/capture/CaptureWorkspace.tsx");
  const didnt = readSrc("src/components/capture/review/DidntUnderstand.tsx");
  assert.match(transcript, /onFocusReviewCard\?\.\(segment\.reviewCardId!\)/);
  assert.match(workspace, /getElementById\(`review-card-\$\{reviewCardId\}`\)/);
  assert.match(workspace, /<DidntUnderstand observations=\{observations\} \/>/);
  assert.match(didnt, /actionStatus === "no_change"/);
  assert.match(didnt, /actionStatus === "ignored"/);
  assert.match(didnt, /No change proposed/);
  assert.doesNotMatch(didnt, /onApprove|onDismiss|applyOne|<button/);
  assert.match(
    readSrc("src/components/capture/review/CaptureSummary.tsx"),
    /actionStatus === "no_change"/,
  );
}

function testSemanticLayersUntouched() {
  const forbidden = [
    "src/lib/capture/review/viewModel.ts",
    "src/lib/capture/review/counts.ts",
    "src/lib/capture/review/applyReadyQueue.ts",
    "src/lib/capture/apply/dispatch.ts",
    "src/lib/capture/apply/confirm-writes.ts",
  ];
  for (const file of forbidden) {
    const src = readSrc(file);
    assert.doesNotMatch(src, /p09-|DidntUnderstand|review-workspace/);
  }
  const composer = readSrc("src/components/capture/CaptureWorkspace.tsx");
  assert.match(composer, /Paste or type project notes/);
  assert.match(composer, /Review changes/);
  assert.match(composer, /Nothing is saved until you approve/);
}

function testReadinessSelectorsIgnorePresentation() {
  const ready = {
    id: "ready-1",
    readiness: "ready",
    executableApply: true,
    canApprove: true,
  } as ReviewChangeViewModel;
  const needs = {
    id: "needs-1",
    readiness: "needs_review",
    executableApply: false,
    canApprove: false,
  } as ReviewChangeViewModel;
  const open = pendingReadyModels([ready, needs], {}, {});
  assert.deepEqual(open.map((model) => model.id), ["ready-1"]);
  const excluded = pendingReadyModels(
    [ready, needs],
    {},
    { "ready-1": true },
  );
  assert.deepEqual(excluded, []);
  const stillBlocked = pendingReadyModels([needs], {}, {});
  assert.deepEqual(stillBlocked, []);
}

function main() {
  testNoFalseUnsavedWarning();
  console.log("✓ no false unsaved-loss warning");
  testApplyStillUsesExistingPath();
  console.log("✓ Apply still uses onApproveReady");
  testNeedsYouStaysAGroupNotAFilter();
  console.log("✓ Needs You stays a group above Proposed");
  testExcludeDoesNotBecomeApply();
  console.log("✓ Exclude still dismisses and does not apply");
  testUpdateRetainsFromTo();
  console.log("✓ Update still renders from → to");
  testCollapseAndFilterDoNotTouchReadiness();
  console.log("✓ collapse and filters do not touch readiness");
  testSpanFocusAndDidntUnderstand();
  console.log("✓ span focus and Didn't understand stay non-applying");
  testSemanticLayersUntouched();
  console.log("✓ view-model and Apply sources stay presentation-free");
  testReadinessSelectorsIgnorePresentation();
  console.log("✓ Needs You and Exclude stay out of the ready queue");
  console.log("verify-review-workspace-presentation: OK");
}

main();
