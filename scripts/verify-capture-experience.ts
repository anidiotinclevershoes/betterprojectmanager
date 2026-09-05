/**
 * Capture experience polish — presentation + transcript annotation.
 * Deterministic. Does not touch inference, resolution, or Apply.
 *
 * Run: npx tsx scripts/verify-capture-experience.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  annotateTranscript,
  annotationSourcesFromResult,
  categoryFromEntityType,
  locateEvidence,
  segmentsEqualTranscript,
} from "../src/lib/capture/review/annotateTranscript";
import { computeReviewCounts } from "../src/lib/capture/review/viewModel";
import type { ReviewChangeViewModel } from "../src/lib/capture/review/viewModel";
import type { CaptureFinding } from "../src/lib/capture/findings";
import type { CaptureResult } from "../src/lib/types";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";

const ROOT = join(import.meta.dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function testExactAndCaseNormalisedMatch() {
  const transcript = "Sarah owns UAT. Parade day is 29 October.";
  const exact = locateEvidence(transcript, "Parade day");
  assert.deepEqual(exact, { start: 16, end: 26 });

  const cased = locateEvidence(transcript, "SARAH");
  assert.deepEqual(cased, { start: 0, end: 5 });
  assert.equal(transcript.slice(cased!.start, cased!.end), "Sarah");
}

function testTrimEndsOnly() {
  const transcript = "Chase Priya for the CAB pack.";
  const hit = locateEvidence(transcript, "  Priya  ");
  assert.deepEqual(hit, { start: 6, end: 11 });
}

function testInternalWhitespaceDoesNotMatch() {
  const transcript = "Chase Priya for the CAB pack.";
  const miss = locateEvidence(transcript, "Chase  Priya");
  assert.equal(miss, null);
}

function testUnsafeLowercasingDoesNotGuess() {
  // "İ".toLowerCase() is "i̇" (length 2) — matching would mis-index.
  const transcript = "İzmir release";
  const miss = locateEvidence(transcript, "izmir");
  assert.equal(miss, null);
}

function testUnmatchedEvidenceLeavesTranscriptIntact() {
  const transcript = "Ship the banners before the float leaves.";
  const annotated = annotateTranscript(transcript, [
    {
      id: "f1",
      evidence: "this quote is not in the notes",
      entityType: "todo",
    },
  ]);
  assert.equal(annotated.segments.length, 1);
  assert.equal(annotated.segments[0]?.type, "text");
  assert.equal(annotated.segments[0]?.text, transcript);
  assert.deepEqual(annotated.unmatchedSourceIds, ["f1"]);
  assert.equal(annotated.categoriesUsed.length, 0);
  assert.equal(segmentsEqualTranscript(annotated.segments, transcript), true);
}

function testMultipleObservationsDoNotCorruptTranscript() {
  const transcript =
    "The icing on Gumdrop Bridge has melted; that risk is closed. Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it.";
  const annotated = annotateTranscript(transcript, [
    {
      id: "risk",
      evidence: "The icing on Gumdrop Bridge has melted; that risk is closed.",
      entityType: "risk",
      reviewCardId: "card-risk",
    },
    {
      id: "people",
      evidence:
        "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it.",
      entityType: "stakeholder",
      reviewCardId: "card-own",
    },
    {
      id: "ghost",
      evidence: "a paraphrase Lume never quoted",
      entityType: "todo",
    },
  ]);
  assert.equal(segmentsEqualTranscript(annotated.segments, transcript), true);
  const marks = annotated.segments.filter((s) => s.type === "mark");
  assert.equal(marks.length, 2);
  assert.equal(marks[0]?.category, "risks");
  assert.equal(marks[1]?.category, "people");
  assert.deepEqual(annotated.unmatchedSourceIds, ["ghost"]);
  assert.deepEqual(annotated.categoriesUsed, ["people", "risks"]);
}

function testOverlapFirstFindingWins() {
  const transcript = "Sarah owns the UAT pack.";
  const annotated = annotateTranscript(transcript, [
    { id: "person", evidence: "Sarah", entityType: "stakeholder" },
    { id: "longer", evidence: "Sarah owns", entityType: "todo" },
  ]);
  const marks = annotated.segments.filter((s) => s.type === "mark");
  assert.equal(marks.length, 1);
  assert.equal(marks[0]?.sourceId, "person");
  assert.equal(marks[0]?.text, "Sarah");
  assert.equal(segmentsEqualTranscript(annotated.segments, transcript), true);
}

function testKnowledgeIsNotHighlighted() {
  const transcript = "Remember that CAB needs the pack 24h before.";
  const annotated = annotateTranscript(transcript, [
    {
      id: "k",
      evidence: "CAB needs the pack 24h before",
      entityType: "knowledge",
    },
  ]);
  assert.equal(
    annotated.segments.every((s) => s.type === "text"),
    true,
  );
  assert.deepEqual(annotated.unmatchedSourceIds, ["k"]);
}

function testCategoryMap() {
  assert.equal(categoryFromEntityType("stakeholder"), "people");
  assert.equal(categoryFromEntityType("availability"), "people");
  assert.equal(categoryFromEntityType("milestone"), "dates");
  assert.equal(categoryFromEntityType("meeting"), "dates");
  assert.equal(categoryFromEntityType("risk"), "risks");
  assert.equal(categoryFromEntityType("todo"), "todos");
  assert.equal(categoryFromEntityType("nudge"), "todos");
  assert.equal(categoryFromEntityType("knowledge"), null);
  assert.equal(categoryFromEntityType("commentary"), null);
}

function testSourcesPreferFindingEntityThenOperation() {
  const result = {
    memory: {
      id: "m",
      type: "conversation" as const,
      title: "t",
      content: "x",
      tags: [],
      people: [],
      occurredAt: "",
      createdAt: "",
      source: "capture" as const,
    },
    insights: [],
    assumptions: [],
    recommendations: [],
    findings: [
      {
        id: "find-1",
        fact: "UAT share unclear",
        evidence: "they might share it",
        findingType: "AMBIGUOUS",
        confidence: 0,
        requiresClarification: true,
        reasoningSummary: "unclear",
      } satisfies CaptureFinding,
    ],
    proposedOperations: [
      {
        id: "op-1",
        sourceFindingId: "find-1",
        operation: "NO_CHANGE",
        entityType: "stakeholder",
        reason: "Share versus replace is not decided.",
        evidence: "they might share it",
        confidence: 0,
        destructive: false,
        requiresClarification: true,
      },
    ],
  } as CaptureResult;

  const sources = annotationSourcesFromResult(result, { "find-1": "card-1" });
  assert.equal(sources[0]?.entityType, "stakeholder");
  assert.equal(sources[0]?.reviewCardId, "card-1");
  const annotated = annotateTranscript("they might share it", sources);
  assert.equal(annotated.segments.some((s) => s.type === "mark"), true);
}

function testMixedReadyAndNeedsYouCountsStayIndependent() {
  const models: ReviewChangeViewModel[] = [
    {
      id: "ready-1",
      suggestion: { id: "ready-1", kind: "risk", op: "complete", content: "Bridge", destination: "project" } as PendingSuggestion,
      entityKind: "risk",
      entityLabel: "Risk",
      recordName: "Bridge",
      operation: "complete",
      operationLabel: "Complete",
      readiness: "ready",
      evidence: [],
      interpretation: "",
      confidence: 0,
    },
    {
      id: "need-1",
      suggestion: { id: "need-1", kind: "stakeholder", op: "update", content: "UAT", destination: "project" } as PendingSuggestion,
      entityKind: "stakeholder",
      entityLabel: "Person",
      recordName: "UAT",
      operation: "update",
      operationLabel: "Update",
      readiness: "needs_review",
      evidence: [],
      interpretation: "",
      confidence: 0,
    },
  ];
  const counts = computeReviewCounts({
    result: {
      memory: {
        id: "m",
        type: "conversation",
        title: "t",
        content: "x",
        tags: [],
        people: [],
        occurredAt: "",
        createdAt: "",
        source: "capture",
      },
      insights: [],
      assumptions: [],
      recommendations: [],
    },
    models,
    added: { "ready-1": true },
    dismissed: {},
  });
  assert.equal(counts.ready, 0, "approved sibling is no longer pending ready");
  assert.equal(counts.needsReview, 1, "Needs-you sibling stays independent");
}

function testPresentationContracts() {
  const workspace = readSrc("src/components/capture/CaptureWorkspace.tsx");
  const summary = readSrc("src/components/capture/review/CaptureSummary.tsx");
  const changes = readSrc(
    "src/components/capture/review/SuggestedChangesList.tsx",
  );
  const badge = readSrc("src/components/capture/review/ReviewBadge.tsx");
  const why = readSrc("src/components/capture/review/WhyPanel.tsx");
  const annotate = readSrc("src/lib/capture/review/annotateTranscript.ts");
  const dispatch = readSrc("src/lib/capture/apply/dispatch.ts");
  const session = readSrc("src/components/capture/CaptureSessionContext.tsx");

  assert.match(workspace, /AnnotatedTranscript/);
  assert.match(workspace, /Tell Lume what changed/);
  assert.doesNotMatch(workspace, /CaptureBestPractice/);
  assert.match(workspace, /Nothing is saved until you approve/);
  assert.match(summary, /Here.s what I understood/);
  assert.match(changes, /Check these changes/);
  assert.match(badge, /Needs You/);
  assert.match(why, /lume-review-why-toggle/);
  assert.match(annotate, /Does not collapse internal whitespace/);
  assert.match(annotate, /No NLP, fuzzy search/);

  // Collision guard: experience polish must not rewrite Thor-owned files.
  assert.doesNotMatch(
    workspace,
    /planCaptureApply|dispatchCapture/,
  );
  assert.match(dispatch, /export /);
  assert.match(session, /applyOne/);
}

function testMobileStructuralCss() {
  const css = readSrc("src/components/capture/capture-experience.css");
  assert.match(css, /@media \(max-width: 699px\)/);
  assert.match(css, /annotated-transcript-body/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /capture-apply-ready-btn/);
  assert.match(css, /min-height: 2\.75rem/);
}

async function main() {
  testExactAndCaseNormalisedMatch();
  console.log("✓ exact + safe case-normalised evidence match");
  testTrimEndsOnly();
  console.log("✓ evidence end-trim only");
  testInternalWhitespaceDoesNotMatch();
  console.log("✓ internal whitespace mismatch is not highlighted");
  testUnsafeLowercasingDoesNotGuess();
  console.log("✓ unsafe case-folding does not guess indices");
  testUnmatchedEvidenceLeavesTranscriptIntact();
  console.log("✓ unmatched evidence stays unhighlighted");
  testMultipleObservationsDoNotCorruptTranscript();
  console.log("✓ multiple observations reconstruct the original transcript");
  testOverlapFirstFindingWins();
  console.log("✓ overlapping spans: first finding wins");
  testKnowledgeIsNotHighlighted();
  console.log("✓ knowledge/commentary is not a transcript category");
  testCategoryMap();
  console.log("✓ category map is people/dates/risks/todos only");
  testSourcesPreferFindingEntityThenOperation();
  console.log("✓ sources reuse structured findings + operations");
  testMixedReadyAndNeedsYouCountsStayIndependent();
  console.log("✓ mixed ready + Needs-you siblings stay independent");
  testPresentationContracts();
  console.log("✓ Capture input/review copy + annotated transcript wiring");
  testMobileStructuralCss();
  console.log("✓ mobile wrap / tap-target CSS present");
  console.log("verify-capture-experience: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
