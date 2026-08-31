/**
 * Sprint 2.1 refinement — Capture review presentation tests.
 * Run: npx tsx scripts/verify-capture-review.ts
 *
 * Covers observation dedupe, shared count selectors, Apply Ready filtering,
 * and view-model diff layouts. Does not invoke AI or persistence.
 */
import assert from "node:assert/strict";
import {
  buildCaptureObservations,
  dedupeObservationCandidates,
  detectObservationCategory,
} from "../src/lib/capture/review/observations";
import {
  computeReviewCounts,
  countProjectChangesDetected,
  findingRepresentsProjectChange,
  pendingReadyModels,
  uniqueProjectChangeFindings,
} from "../src/lib/capture/review/counts";
import {
  buildReviewChangeViewModels,
  type ReviewChangeViewModel,
} from "../src/lib/capture/review/viewModel";
import {
  isGenericInterpretation,
  needsYouHeadline,
  needsYouSupporting,
  reviewOpFamily,
  whyDisclosureLabel,
  whyHasUsefulContent,
} from "../src/lib/capture/review/reviewLanguage";
import type { CaptureFinding } from "../src/lib/capture/findings";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import type { CaptureResult, Recommendation } from "../src/lib/types";

function stubResult(partial: Partial<CaptureResult> = {}): CaptureResult {
  return {
    memory: {
      id: "mem-test",
      type: "conversation",
      title: "Test",
      content: "",
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
    destination: "project",
    projectId: "proj-1",
    ...partial,
  };
}

function model(
  partial: Partial<ReviewChangeViewModel> &
    Pick<
      ReviewChangeViewModel,
      "id" | "entityKind" | "operation" | "readiness" | "recordName"
    >,
): ReviewChangeViewModel {
  return {
    suggestion: suggestion({
      id: partial.id,
      kind: partial.entityKind,
      op: partial.operation,
      content: partial.recordName,
    }),
    entityLabel: partial.entityKind,
    operationLabel: partial.operation,
    evidence: [],
    interpretation: "",
    confidence: 90,
    ...partial,
  };
}

// --- 1. Semantically duplicated conclusions are presented once ---
{
  const result = stubResult({
    insights: [
      "CAB approved",
      "CAB approval confirmed by Sarah",
      "Release date moved to 19 August",
      "Release date changed to 19 August",
      "CDN issue resolved",
      "CDN deployment blocker resolved",
    ],
    findings: [
      finding({
        id: "f1",
        fact: "CAB approved",
        findingType: "ENTITY_COMPLETED",
        target: {
          entityType: "todo",
          entityId: "todo-cab",
          title: "Obtain CAB approval",
        },
        confidence: 96,
      }),
      finding({
        id: "f1b",
        fact: "CAB approval confirmed by Sarah",
        findingType: "ENTITY_COMPLETED",
        target: {
          entityType: "todo",
          entityId: "todo-cab",
          title: "Obtain CAB approval",
        },
        confidence: 88,
      }),
      finding({
        id: "f2",
        fact: "Release date moved to 19 August",
        findingType: "ENTITY_UPDATED",
        target: {
          entityType: "milestone",
          entityId: "ms-rel",
          title: "Go-live",
        },
        confidence: 94,
      }),
      finding({
        id: "f2b",
        fact: "Release date changed to 19 August",
        findingType: "ENTITY_UPDATED",
        target: {
          entityType: "milestone",
          entityId: "ms-rel",
          title: "Go-live",
        },
        confidence: 90,
      }),
      finding({
        id: "f3",
        fact: "CDN issue resolved",
        findingType: "ENTITY_COMPLETED",
        target: {
          entityType: "risk",
          entityId: "risk-cdn",
          title: "CDN deployment delayed",
        },
        confidence: 80,
      }),
      finding({
        id: "f3b",
        fact: "CDN deployment blocker resolved",
        findingType: "ENTITY_COMPLETED",
        target: {
          entityType: "risk",
          entityId: "risk-cdn",
          title: "CDN deployment delayed",
        },
        confidence: 85,
      }),
    ],
  });

  const obs = buildCaptureObservations(
    result,
    "Sarah is still the Business Owner. Marcus is helping with release notes.",
  );

  const fromFindings = obs.filter((o) => o.findingId);
  assert.equal(
    fromFindings.filter((o) => /cab/i.test(o.text)).length,
    1,
    "CAB conclusions should appear once",
  );
  assert.equal(
    fromFindings.filter((o) => /release/i.test(o.text) && /19|august/i.test(o.text))
      .length,
    1,
    "Release date conclusions should appear once",
  );
  assert.equal(
    fromFindings.filter((o) => /cdn/i.test(o.text)).length,
    1,
    "CDN conclusions should appear once",
  );
  assert.ok(fromFindings.some((o) => /CAB/i.test(o.text)));
  assert.ok(fromFindings.some((o) => /release/i.test(o.text)));
  assert.ok(fromFindings.some((o) => /CDN/i.test(o.text)));
  assert.ok(
    obs.some((o) => o.actionLabel && o.actionLabel.length > 0),
    "observations expose downstream action labels",
  );
}

// --- 2. Distinct related conclusions are retained ---
{
  const merged = dedupeObservationCandidates([
    {
      text: "Ada remains the festival lead",
      category: "other",
      confidence: 80,
      source: "transcript",
    },
    {
      text: "Rafi is supporting programme notes",
      category: "other",
      confidence: 80,
      source: "transcript",
    },
    {
      text: "Rafi is supporting programme notes",
      category: "other",
      confidence: 70,
      source: "insight",
    },
  ]);
  assert.ok(merged.some((o) => /Ada remains the festival lead/i.test(o.text)));
  assert.equal(merged.filter((o) => /Rafi/i.test(o.text)).length, 1);
  assert.equal(detectObservationCategory("Ada remains the festival lead"), "other");
  assert.equal(detectObservationCategory("Rafi supports programme notes"), "other");
}

// --- 3. Change count from unique validated findings ---
{
  const findings: CaptureFinding[] = [
    finding({
      id: "a",
      fact: "CAB approved",
      findingType: "ENTITY_COMPLETED",
      target: { entityType: "todo", entityId: "t1", title: "CAB" },
    }),
    finding({
      id: "a-dup",
      fact: "CAB approval confirmed",
      findingType: "ENTITY_COMPLETED",
      target: { entityType: "todo", entityId: "t1", title: "CAB" },
    }),
    finding({
      id: "b",
      fact: "Release moved",
      findingType: "ENTITY_UPDATED",
      target: { entityType: "milestone", entityId: "m1", title: "Release" },
    }),
    finding({
      id: "c",
      fact: "CDN maybe resolved",
      findingType: "AMBIGUOUS",
      target: { entityType: "risk", entityId: "r1", title: "CDN" },
      requiresClarification: true,
    }),
    finding({
      id: "noise",
      fact: "Already known",
      findingType: "NO_CHANGE",
      target: { entityType: "todo", entityId: "t9", title: "X" },
    }),
    finding({
      id: "invalid",
      fact: "Bad target",
      findingType: "ENTITY_UPDATED",
      invalidTarget: true,
    }),
    finding({
      id: "info",
      fact: "Nice weather for a release party",
      findingType: "NEW_INFORMATION",
    }),
  ];

  assert.equal(findingRepresentsProjectChange(findings[3]), true);
  assert.equal(findingRepresentsProjectChange(findings[4]), false);
  // Invalid-target findings still count as project changes (surfaced as Unmatched).
  assert.equal(findingRepresentsProjectChange(findings[5]), true);
  assert.equal(findingRepresentsProjectChange(findings[6]), false);
  assert.equal(uniqueProjectChangeFindings(findings).length, 4);
  assert.equal(countProjectChangesDetected(stubResult({ findings })), 4);
}

// --- 4. Ready / Needs Review share the same selector ---
{
  const models: ReviewChangeViewModel[] = [
    model({
      id: "ready-1",
      entityKind: "action",
      operation: "complete",
      readiness: "ready",
      recordName: "CAB",
    }),
    model({
      id: "ready-2",
      entityKind: "milestone",
      operation: "update",
      readiness: "ready",
      recordName: "Release",
    }),
    model({
      id: "review-1",
      entityKind: "risk",
      operation: "complete",
      readiness: "needs_review",
      recordName: "CDN",
    }),
  ];

  const result = stubResult({
    findings: [
      finding({
        id: "f1",
        fact: "CAB",
        findingType: "ENTITY_COMPLETED",
        target: { entityType: "todo", entityId: "t1", title: "CAB" },
      }),
      finding({
        id: "f2",
        fact: "Release",
        findingType: "ENTITY_UPDATED",
        target: { entityType: "milestone", entityId: "m1", title: "Release" },
      }),
      finding({
        id: "f3",
        fact: "CDN",
        findingType: "AMBIGUOUS",
        target: { entityType: "risk", entityId: "r1", title: "CDN" },
        requiresClarification: true,
      }),
    ],
  });

  const counts = computeReviewCounts({
    result,
    models,
    added: {},
    dismissed: {},
  });
  assert.equal(counts.changesDetected, 3);
  assert.equal(counts.ready, 2);
  assert.equal(counts.needsReview, 1);
  assert.equal(counts.unmatched, 0);
  assert.equal(counts.needsAttention, 1);
  assert.equal(counts.total, 3);
  assert.equal(counts.reviewed, 0);

  const after = computeReviewCounts({
    result,
    models,
    added: { "ready-1": true },
    dismissed: {},
  });
  assert.equal(after.ready, 1);
  assert.equal(after.needsReview, 1);
  assert.equal(after.reviewed, 1);
  assert.equal(after.changesDetected, 3);
}

// --- 5. Apply Ready includes only valid pending Ready ops ---
{
  const models: ReviewChangeViewModel[] = [
    model({
      id: "r1",
      entityKind: "action",
      operation: "complete",
      readiness: "ready",
      recordName: "A",
    }),
    model({
      id: "n1",
      entityKind: "risk",
      operation: "complete",
      readiness: "needs_review",
      recordName: "B",
    }),
    model({
      id: "d1",
      entityKind: "action",
      operation: "update",
      readiness: "ready",
      recordName: "C",
    }),
  ];

  assert.deepEqual(
    pendingReadyModels(models, { d1: true }, {}).map((m) => m.id),
    ["r1"],
  );
  assert.deepEqual(
    pendingReadyModels(models, {}, { r1: true }).map((m) => m.id),
    ["d1"],
  );
}

// --- 6. Status / date diffs render old and proposed values ---
{
  const result = stubResult({
    findings: [
      finding({
        id: "f-cab",
        fact: "CAB done",
        findingType: "ENTITY_COMPLETED",
        target: {
          entityType: "todo",
          entityId: "todo-cab",
          title: "Obtain CAB approval",
        },
        changes: { status: { previous: "OPEN", proposed: "COMPLETED" } },
        confidence: 95,
      }),
      finding({
        id: "f-rel",
        fact: "Release moved",
        findingType: "ENTITY_UPDATED",
        target: {
          entityType: "milestone",
          entityId: "ms-1",
          title: "Go-live",
        },
        changes: {
          date: { previous: "2025-08-12", proposed: "2025-08-19" },
        },
        confidence: 92,
      }),
    ],
    proposedOperations: [
      {
        id: "op-cab",
        sourceFindingId: "f-cab",
        operation: "COMPLETE",
        entityType: "todo",
        targetId: "todo-cab",
        targetTitle: "Obtain CAB approval",
        proposedValues: { status: "COMPLETED" },
        reason: "done",
        evidence: "CAB",
        confidence: 95,
        destructive: false,
        requiresClarification: false,
      },
      {
        id: "op-rel",
        sourceFindingId: "f-rel",
        operation: "UPDATE",
        entityType: "milestone",
        targetId: "ms-1",
        targetTitle: "Go-live",
        proposedValues: { date: "2025-08-19" },
        reason: "date",
        evidence: "19th",
        confidence: 92,
        destructive: false,
        requiresClarification: false,
      },
    ],
  });

  const models = buildReviewChangeViewModels(
    [
      suggestion({
        id: "op-op-cab-1",
        kind: "action",
        op: "complete",
        content: "Obtain CAB approval",
        recommendation: stubRec({
          id: "rec-cab",
          title: "Obtain CAB approval",
          proposedOperationId: "op-cab",
          sourceFindingId: "f-cab",
          confidence: 95,
          operation: "complete",
          itemType: "action",
          targetTitle: "Obtain CAB approval",
        }),
      }),
      suggestion({
        id: "op-op-rel-1",
        kind: "milestone",
        op: "update",
        content: "Go-live",
        date: "2025-08-19",
        recommendation: stubRec({
          id: "rec-rel",
          title: "Go-live",
          proposedOperationId: "op-rel",
          sourceFindingId: "f-rel",
          confidence: 92,
          operation: "update",
          itemType: "milestone",
          targetTitle: "Go-live",
        }),
      }),
    ],
    result,
    "CAB approved. Release moved to 19 August.",
  );

  const status = models.find((m) => m.operation === "complete");
  const date = models.find((m) => m.operation === "update");
  assert.ok(status?.diff);
  assert.equal(status?.diff?.from, "Open");
  assert.equal(status?.diff?.to, "Complete");
  assert.equal(status?.diff?.layout, "from_to");
  assert.ok(date?.diff);
  assert.match(date!.diff!.from, /12/);
  assert.match(date!.diff!.to, /19/);
  assert.equal(date?.diff?.layout, "from_to");
  // Evidence is available for Why expansion without another AI call
  assert.ok(status?.interpretation);
}

// --- 7. Create / remove layouts + destructive readiness ---
{
  const createModels = buildReviewChangeViewModels(
    [
      suggestion({
        id: "c1",
        kind: "action",
        op: "create",
        content: "Prepare CAB evidence pack",
        date: "2025-08-18",
      }),
      suggestion({
        id: "r1",
        kind: "stakeholder",
        op: "remove",
        content: "Old vendor",
      }),
    ],
    stubResult(),
    "",
  );
  assert.equal(createModels[0].diff?.layout, "create");
  assert.equal(createModels[0].diff?.to, "Prepare CAB evidence pack");
  assert.ok(createModels[0].diff?.meta?.includes("18"));
  assert.equal(createModels[1].diff?.layout, "remove");
  assert.match(createModels[1].diff!.to, /Remove from project/i);
  assert.equal(createModels[1].readiness, "needs_review");
}

// --- 8. Review visual language (presentation only) ---
{
  assert.equal(reviewOpFamily("create"), "create");
  assert.equal(reviewOpFamily("update"), "update");
  assert.equal(reviewOpFamily("complete"), "update");
  assert.equal(reviewOpFamily("remove"), "remove");
  assert.equal(reviewOpFamily("archive"), "remove");
  assert.equal(
    reviewOpFamily("remove", "needs_review", "OPERATION_UNCERTAIN"),
    "remove",
  );
  assert.equal(
    reviewOpFamily("complete", "needs_review", "STATE_UNCERTAIN"),
    "needs_you",
  );
  assert.equal(
    reviewOpFamily("update", "unmatched", "TARGET_UNCERTAIN"),
    "needs_you",
  );
  assert.equal(
    needsYouHeadline("STATE_UNCERTAIN", "Risk"),
    "Is this Risk resolved?",
  );
  assert.equal(
    needsYouHeadline("TARGET_UNCERTAIN", "To Do"),
    "Which record does this refer to?",
  );
  assert.equal(
    whyDisclosureLabel(["quoted evidence"], "Lume suggests to create this."),
    "Evidence",
  );
  assert.equal(
    whyHasUsefulContent(
      [],
      "Lume suggests to create this stakeholder based on the Capture.",
    ),
    false,
  );
  assert.equal(
    isGenericInterpretation(
      "Lume suggests to update this risk based on the Capture.",
    ),
    true,
  );
  assert.equal(
    needsYouSupporting(
      "Which record does this refer to?",
      "Lume thinks this refers to:\nChase the hosting ticket",
      "Chase the hosting ticket",
    ),
    null,
  );
  assert.equal(
    needsYouSupporting(
      "Is this Risk resolved?",
      "Lume isn't sure whether this Risk is resolved.",
      "CDN deployment delayed",
    ),
    null,
  );
}

console.log("verify-capture-review: all checks passed");
