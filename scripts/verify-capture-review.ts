/**
 * Sprint 2.1 refinement — Capture review presentation tests.
 * Run: npx tsx scripts/verify-capture-review.ts
 *
 * Covers observation dedupe, shared count selectors, Apply Ready filtering,
 * and view-model diff layouts. Does not invoke AI or persistence.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import type {
  CaptureFinding,
  ProposedOperation,
} from "../src/lib/capture/findings";
import {
  buildSuggestions,
  type PendingSuggestion,
} from "../src/lib/capture/suggestions";
import type { CaptureResult, Recommendation } from "../src/lib/types";
import {
  existingOrNewCopy,
  friendlierNeedsYouCopy,
  missingDateCopy,
  ownershipChoiceCopy,
} from "../src/lib/capture/review/reviewReason";
import {
  isGenericInterpretation,
  needsYouHeadline,
  needsYouSupporting,
  reviewDomainLabel,
  reviewFamilyClass,
  reviewOpFamily,
  reviewOpIcon,
  reviewOpWord,
  whyDisclosureLabel,
  whyHasUsefulContent,
} from "../src/lib/capture/review/reviewLanguage";
import { planCaptureApply } from "../src/lib/capture/apply";
import {
  CANDYLAND_ID,
  experimentalApplyWorld,
} from "../src/lib/experiments/worlds";

function reviewPreflight(projectId = CANDYLAND_ID) {
  return {
    world: experimentalApplyWorld(),
    captureEntryProjectId: projectId,
  };
}

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
        projectId: CANDYLAND_ID,
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
    {},
    reviewPreflight(),
  );
  assert.equal(createModels[0].diff?.layout, "create");
  assert.equal(createModels[0].diff?.to, "Prepare CAB evidence pack");
  assert.ok(createModels[0].diff?.meta?.includes("18"));
  assert.equal(createModels[1].diff?.layout, "remove");
  assert.match(createModels[1].diff!.to, /Remove from project/i);
  assert.equal(createModels[1].readiness, "needs_review");
  assert.equal(createModels[1].executableApply, false);
  assert.match(
    createModels[1].needsReviewReason ?? "",
    /needs clarification about what that means for this stakeholder/i,
  );
  assert.equal(createModels[0].readiness, "ready");
  assert.equal(createModels[0].executableApply, true);
}

function proposedOp(
  partial: Partial<ProposedOperation> &
    Pick<ProposedOperation, "id" | "sourceFindingId" | "operation">,
): ProposedOperation {
  return {
    entityType: "risk",
    reason: partial.reason ?? "test",
    evidence: partial.evidence ?? "test",
    confidence: partial.confidence ?? 90,
    destructive: false,
    requiresClarification: false,
    ...partial,
  };
}

function suggestionIdFor(opId: string, index = 0) {
  return `op-${opId}-${index}`;
}

// --- 8. V2 confidence is informational; legacy threshold is unchanged ---
{
  const v2Update = (confidence: number | undefined, extra: Partial<ProposedOperation> = {}) => {
    const op = proposedOp({
      id: "v2op-risk",
      sourceFindingId: "find-risk",
      operation: "COMPLETE",
      entityType: "risk",
      targetId: "risk-bridge",
      targetTitle: "Gumdrop Bridge icing",
      confidence: confidence ?? 0,
      requiresClarification: false,
      projectId: "proj-candy",
      ...extra,
    });
    const models = buildReviewChangeViewModels(
      [
        suggestion({
          id: suggestionIdFor(op.id),
          kind: "risk",
          op: "complete",
          content: "Gumdrop Bridge icing is resolved",
          targetEntityId: "risk-bridge",
          projectId: "proj-candy",
        }),
      ],
      stubResult({
        capturePipeline: "v2",
        findings: [
          finding({
            id: "find-risk",
            fact: "Gumdrop Bridge icing is worse",
            findingType: "ENTITY_COMPLETED",
            target: {
              entityType: "risk",
              entityId: "risk-bridge",
              title: "Gumdrop Bridge icing",
            },
            confidence: confidence ?? 0,
            requiresClarification: false,
          }),
        ],
        proposedOperations: [op],
      }),
      "The icing is resolved.",
      {},
      reviewPreflight(),
    );
    return models[0]!;
  };

  assert.equal(v2Update(12).readiness, "ready", "low confidence V2 complete stays Apply Ready");
  assert.equal(v2Update(0).readiness, "ready", "zero confidence V2 complete stays Apply Ready");
  assert.equal(
    v2Update(undefined).readiness,
    "ready",
    "missing/zero confidence V2 complete stays Apply Ready",
  );

  const v2VagueUpdate = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("v2op-vague"),
        kind: "risk",
        op: "update",
        content: "Gumdrop Bridge icing is worse",
        targetEntityId: "risk-bridge",
        projectId: "proj-candy",
      }),
    ],
    stubResult({
      capturePipeline: "v2",
      findings: [
        finding({
          id: "find-vague",
          fact: "Gumdrop Bridge icing is worse",
          findingType: "ENTITY_UPDATED",
          target: {
            entityType: "risk",
            entityId: "risk-bridge",
            title: "Gumdrop Bridge icing",
          },
          confidence: 12,
          requiresClarification: false,
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "v2op-vague",
          sourceFindingId: "find-vague",
          operation: "UPDATE",
          entityType: "risk",
          targetId: "risk-bridge",
          targetTitle: "Gumdrop Bridge icing",
          confidence: 12,
          projectId: "proj-candy",
        }),
      ],
    }),
    "The icing is worse.",
    {},
    reviewPreflight(),
  );
  assert.equal(
    v2VagueUpdate[0]!.readiness,
    "needs_review",
    "V2 risk update without a legal status is not Ready",
  );

  const v2Create = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("v2op-new"),
        kind: "action",
        op: "create",
        content: "Polish the candy-cane banners",
        projectId: "proj-candy",
      }),
    ],
    stubResult({
      capturePipeline: "v2",
      findings: [
        finding({
          id: "find-new",
          fact: "Polish the candy-cane banners",
          findingType: "NEW_INFORMATION",
          target: { entityType: "todo", title: "Polish the candy-cane banners" },
          confidence: 8,
          requiresClarification: false,
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "v2op-new",
          sourceFindingId: "find-new",
          operation: "CREATE",
          entityType: "todo",
          targetTitle: "Polish the candy-cane banners",
          confidence: 8,
          projectId: "proj-candy",
        }),
      ],
    }),
    "Please add a to-do to polish the candy-cane banners.",
    {},
    reviewPreflight(),
  );
  assert.equal(v2Create[0]!.readiness, "ready", "V2 CREATE still Apply Ready at low confidence");

  const legacyLow = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("legacy-op"),
        kind: "risk",
        op: "update",
        content: "CDN still delayed",
        targetEntityId: "risk-cdn",
      }),
    ],
    stubResult({
      findings: [
        finding({
          id: "find-legacy",
          fact: "CDN still delayed",
          findingType: "ENTITY_UPDATED",
          target: { entityType: "risk", entityId: "risk-cdn", title: "CDN" },
          confidence: 40,
          requiresClarification: false,
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "legacy-op",
          sourceFindingId: "find-legacy",
          operation: "UPDATE",
          entityType: "risk",
          targetId: "risk-cdn",
          targetTitle: "CDN",
          confidence: 40,
        }),
      ],
    }),
    "CDN still delayed",
  );
  assert.equal(
    legacyLow[0]!.readiness,
    "needs_review",
    "legacy path still gates confidence < 70",
  );
  assert.equal(legacyLow[0]!.reviewReason, "VALUE_UNCERTAIN");

  const ambiguous = v2Update(95, {
    requiresClarification: true,
    proposedValues: { ownershipSemantics: "ambiguous", scope: "UAT lead" },
  });
  const ambiguousModels = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("v2op-risk"),
        kind: "stakeholder",
        op: "update",
        content: "UAT may be shared or replaced",
        ownershipSemantics: "ambiguous",
        responsibilityScope: "UAT lead",
        personName: "Fizz Caramel",
        legalDomain: "responsibility",
        projectId: "proj-candy",
      }),
    ],
    stubResult({
      capturePipeline: "v2",
      findings: [
        finding({
          id: "find-risk",
          fact: "UAT may be shared or replaced",
          findingType: "AMBIGUOUS",
          confidence: 95,
          requiresClarification: true,
          clarificationQuestion: "Share versus replace is not decided.",
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "v2op-risk",
          sourceFindingId: "find-risk",
          operation: "NO_CHANGE",
          entityType: "stakeholder",
          confidence: 95,
          requiresClarification: true,
          proposedValues: {
            ownershipSemantics: "ambiguous",
            scope: "UAT lead",
            personName: "Fizz Caramel",
          },
          projectId: "proj-candy",
        }),
      ],
    }),
    "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it.",
  );
  assert.equal(ambiguousModels[0]!.readiness, "needs_review");
  assert.equal(ambiguousModels[0]!.reviewReason, "OWNERSHIP_UNCERTAIN");
  void ambiguous;

  const foreign = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("v2op-foreign"),
        kind: "risk",
        op: "update",
        content: "Update imaginary risk",
        targetEntityId: "risk-does-not-exist",
        projectId: "proj-candy",
      }),
    ],
    stubResult({
      capturePipeline: "v2",
      findings: [
        finding({
          id: "find-foreign",
          fact: "Update imaginary risk",
          findingType: "AMBIGUOUS",
          confidence: 90,
          requiresClarification: true,
          invalidTarget: true,
          validationWarning: "Target id not in context",
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "v2op-foreign",
          sourceFindingId: "find-foreign",
          operation: "NO_CHANGE",
          entityType: "risk",
          targetId: "risk-does-not-exist",
          confidence: 90,
          requiresClarification: true,
        }),
      ],
    }),
    "Please attach this update to the console certification risk.",
  );
  assert.notEqual(foreign[0]!.readiness, "ready");
  assert.ok(
    foreign[0]!.readiness === "unmatched" ||
      foreign[0]!.readiness === "needs_review",
  );
}

// --- 9. Clarifying NO_CHANGE ops become Needs-you cards ---
{
  const result = stubResult({
    capturePipeline: "v2",
    findings: [
      finding({
        id: "find-own",
        fact: "UAT may be shared or replaced",
        findingType: "AMBIGUOUS",
        confidence: 0,
        requiresClarification: true,
        clarificationQuestion: "Share versus replace is not decided.",
      }),
    ],
    proposedOperations: [
      proposedOp({
        id: "v2op-own",
        sourceFindingId: "find-own",
        operation: "NO_CHANGE",
        entityType: "stakeholder",
        targetTitle: "UAT may be shared or replaced",
        confidence: 0,
        requiresClarification: true,
        proposedValues: {
          ownershipSemantics: "ambiguous",
          scope: "UAT lead",
          personName: "Fizz Caramel",
        },
        projectId: "proj-candy",
      }),
      proposedOp({
        id: "v2op-known",
        sourceFindingId: "find-known",
        operation: "NO_CHANGE",
        entityType: "stakeholder",
        targetTitle: "Pippa Gumdrop",
        confidence: 0,
        requiresClarification: false,
        projectId: "proj-candy",
      }),
    ],
  });
  const items = buildSuggestions(result);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.ownershipSemantics, "ambiguous");
  assert.equal(items[0]!.responsibilityScope, "UAT lead");
  assert.equal(items[0]!.personName, "Fizz Caramel");
  assert.equal(items[0]!.legalDomain, "responsibility");
}

// --- 10. Ownership copy + legal apply path; sibling stays ready ---
{
  const labels = ownershipChoiceCopy({
    currentOwnerNames: ["Pippa Gumdrop"],
    scope: "UAT lead",
    incomingPersonName: "Fizz Caramel",
  });
  assert.match(labels.question, /Pippa Gumdrop already owns UAT lead/);
  assert.equal(labels.shareLabel, "Share with Fizz Caramel");
  assert.equal(labels.replaceLabel, "Replace Pippa Gumdrop with Fizz Caramel");
  assert.equal(labels.keepLabel, "Keep Pippa Gumdrop only");

  const world = experimentalApplyWorld();
  const shareDecision = planCaptureApply({
    item: suggestion({
      id: "own-share",
      kind: "stakeholder",
      op: "update",
      content: "Share UAT lead with Fizz Caramel",
      projectId: CANDYLAND_ID,
      legalDomain: "responsibility",
      personName: "Fizz Caramel",
      ownershipSemantics: "share",
      responsibilityScope: "UAT lead",
    }),
    text: "Share UAT lead with Fizz Caramel",
    world,
    captureEntryProjectId: CANDYLAND_ID,
  });
  assert.equal(shareDecision.kind, "write");
  if (shareDecision.kind === "write") {
    assert.equal(shareDecision.operation.type, "confirm_responsibility");
    if (shareDecision.operation.type === "confirm_responsibility") {
      assert.equal(shareDecision.operation.personName, "Fizz Caramel");
      assert.equal(shareDecision.operation.scope, "UAT lead");
      assert.equal(shareDecision.operation.replacePersonId, null);
    }
  }

  const replaceDecision = planCaptureApply({
    item: suggestion({
      id: "own-replace",
      kind: "stakeholder",
      op: "update",
      content: "Replace Pippa with Fizz on UAT lead",
      projectId: CANDYLAND_ID,
      legalDomain: "responsibility",
      personName: "Fizz Caramel",
      ownershipSemantics: "replace",
      responsibilityScope: "UAT lead",
      replacePersonId: "person-gumdrop",
    }),
    text: "Replace Pippa with Fizz on UAT lead",
    world,
    captureEntryProjectId: CANDYLAND_ID,
  });
  assert.equal(replaceDecision.kind, "write");
  if (replaceDecision.kind === "write") {
    assert.equal(replaceDecision.operation.type, "confirm_responsibility");
    if (replaceDecision.operation.type === "confirm_responsibility") {
      assert.equal(replaceDecision.operation.replacePersonId, "person-gumdrop");
    }
  }

  const siblingModels = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("v2op-ready"),
        kind: "risk",
        op: "complete",
        content: "Gumdrop Bridge icing is resolved",
        targetEntityId: "risk-bridge",
        projectId: CANDYLAND_ID,
      }),
      suggestion({
        id: suggestionIdFor("v2op-own"),
        kind: "stakeholder",
        op: "update",
        content: "UAT may be shared or replaced",
        ownershipSemantics: "ambiguous",
        responsibilityScope: "UAT lead",
        personName: "Fizz Caramel",
        legalDomain: "responsibility",
        projectId: CANDYLAND_ID,
      }),
    ],
    stubResult({
      capturePipeline: "v2",
      findings: [
        finding({
          id: "find-ready",
          fact: "Gumdrop Bridge icing is resolved",
          findingType: "ENTITY_COMPLETED",
          target: {
            entityType: "risk",
            entityId: "risk-bridge",
            title: "Gumdrop Bridge icing",
          },
          confidence: 0,
          requiresClarification: false,
        }),
        finding({
          id: "find-own",
          fact: "UAT may be shared or replaced",
          findingType: "AMBIGUOUS",
          confidence: 0,
          requiresClarification: true,
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "v2op-ready",
          sourceFindingId: "find-ready",
          operation: "COMPLETE",
          entityType: "risk",
          targetId: "risk-bridge",
          targetTitle: "Gumdrop Bridge icing",
          confidence: 0,
          projectId: CANDYLAND_ID,
        }),
        proposedOp({
          id: "v2op-own",
          sourceFindingId: "find-own",
          operation: "NO_CHANGE",
          entityType: "stakeholder",
          confidence: 0,
          requiresClarification: true,
          proposedValues: {
            ownershipSemantics: "ambiguous",
            scope: "UAT lead",
            personName: "Fizz Caramel",
          },
          projectId: CANDYLAND_ID,
        }),
      ],
    }),
    "Bridge is closed. Fizz may share or replace UAT.",
    {},
    reviewPreflight(),
  );
  const ready = siblingModels.find((m) => m.operation === "complete")!;
  const needsYou = siblingModels.find(
    (m) => m.suggestion.ownershipSemantics === "ambiguous",
  )!;
  assert.equal(ready.readiness, "ready");
  assert.equal(needsYou.readiness, "needs_review");
  const pendingReady = pendingReadyModels(siblingModels, {}, {});
  assert.equal(pendingReady.length, 1);
  assert.equal(pendingReady[0]!.id, ready.id);
}

// --- 11. Existing vs new copy only when a named target already exists ---
{
  const named = existingOrNewCopy({
    entityLabel: "Risk",
    recordName: "Security sign-off",
  });
  assert.equal(
    named.question,
    'Is this a new risk or the existing “Security sign-off” risk?',
  );
  assert.equal(named.updateLabel, "Update Security sign-off");
  assert.equal(named.createLabel, "Create a new risk");

  const unnamed = existingOrNewCopy({ entityLabel: "Risk" });
  assert.match(unnamed.question, /couldn'?t confidently identify/i);

  const models = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("v2op-exist"),
        kind: "risk",
        op: "update",
        content: "Packaging delay is getting worse",
        targetEntityId: "risk-packaging",
        projectId: "proj-toy",
      }),
    ],
    stubResult({
      capturePipeline: "v2",
      findings: [
        finding({
          id: "find-exist",
          fact: "Packaging delay is getting worse",
          findingType: "ENTITY_UPDATED",
          target: {
            entityType: "risk",
            entityId: "risk-packaging",
            title: "Packaging delay",
          },
          confidence: 0,
          requiresClarification: false,
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "v2op-exist",
          sourceFindingId: "find-exist",
          operation: "UPDATE",
          entityType: "risk",
          targetId: "risk-packaging",
          targetTitle: "Packaging delay",
          confidence: 0,
          projectId: "proj-toy",
        }),
      ],
      findingCoverage: {
        items: [
          {
            findingId: "find-exist",
            fact: "Packaging delay is getting worse",
            disposition: "unmatched",
            reason: "Could not confidently identify which existing risk this refers to.",
          },
        ],
        actionableCount: 1,
        readyCount: 0,
        needsReviewCount: 0,
        unmatchedCount: 1,
        noChangeCount: 0,
        ignoredCount: 0,
        silentDropCount: 0,
      },
    }),
    "Packaging delay is getting worse after the mill flooded.",
  );
  assert.equal(models[0]!.readiness, "unmatched");
  assert.equal(models[0]!.reviewReason, "TARGET_UNCERTAIN");
  assert.match(models[0]!.needsReviewReason ?? "", /existing “Packaging delay” risk/);
}

// --- 12. Missing required date on milestone update; create does not invent a date ---
{
  assert.equal(missingDateCopy("UAT"), "What date should I use for UAT?");
  const missing = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("v2op-date"),
        kind: "milestone",
        op: "update",
        content: "Parade day",
        targetEntityId: "ms-parade",
        projectId: CANDYLAND_ID,
      }),
    ],
    stubResult({
      capturePipeline: "v2",
      findings: [
        finding({
          id: "find-date",
          fact: "Parade day moved",
          findingType: "ENTITY_UPDATED",
          target: {
            entityType: "milestone",
            entityId: "ms-parade",
            title: "Parade day",
          },
          confidence: 0,
          requiresClarification: false,
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "v2op-date",
          sourceFindingId: "find-date",
          operation: "UPDATE",
          entityType: "milestone",
          targetId: "ms-parade",
          targetTitle: "Parade day",
          confidence: 0,
          proposedValues: {},
          projectId: CANDYLAND_ID,
        }),
      ],
    }),
    "Move Parade day.",
  );
  assert.equal(missing[0]!.readiness, "needs_review");
  assert.equal(missing[0]!.missingRequiredField, "date");
  assert.match(missing[0]!.needsReviewReason ?? "", /What date should I use/);

  const createMile = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("v2op-create-date"),
        kind: "milestone",
        op: "create",
        content: "Float rehearsal",
        projectId: CANDYLAND_ID,
      }),
    ],
    stubResult({
      capturePipeline: "v2",
      findings: [
        finding({
          id: "find-create-date",
          fact: "Float rehearsal",
          findingType: "NEW_INFORMATION",
          target: { entityType: "milestone", title: "Float rehearsal" },
          confidence: 0,
          requiresClarification: false,
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "v2op-create-date",
          sourceFindingId: "find-create-date",
          operation: "CREATE",
          entityType: "milestone",
          targetTitle: "Float rehearsal",
          confidence: 0,
          projectId: CANDYLAND_ID,
        }),
      ],
    }),
    "Add a float rehearsal date.",
    {},
    reviewPreflight(),
  );
  assert.equal(createMile[0]!.readiness, "needs_review");
  assert.equal(createMile[0]!.missingRequiredField, "date");
}

// --- 13. Identity-gate copy is human; no invented Person candidate list ---
{
  assert.equal(
    friendlierNeedsYouCopy(
      "This name is not a confirmed existing Person identity, so Lume will not create a stakeholder.",
    ),
    "I need a full name before adding someone new.",
  );
  const identity = buildReviewChangeViewModels(
    [
      suggestion({
        id: suggestionIdFor("v2op-sam"),
        kind: "stakeholder",
        op: "update",
        content: "Sam should join the parade",
        projectId: CANDYLAND_ID,
        personName: "Sam",
      }),
    ],
    stubResult({
      capturePipeline: "v2",
      findings: [
        finding({
          id: "find-sam",
          fact: "Sam should join the parade",
          findingType: "AMBIGUOUS",
          confidence: 0,
          requiresClarification: true,
          clarificationQuestion:
            "This name is not a confirmed existing Person identity, so Lume will not create a stakeholder.",
        }),
      ],
      proposedOperations: [
        proposedOp({
          id: "v2op-sam",
          sourceFindingId: "find-sam",
          operation: "NO_CHANGE",
          entityType: "stakeholder",
          confidence: 0,
          requiresClarification: true,
          proposedValues: { name: "Sam" },
          projectId: CANDYLAND_ID,
        }),
      ],
    }),
    "Sam should join the parade.",
    {},
    reviewPreflight(),
  );
  assert.equal(identity[0]!.readiness, "needs_review");
  assert.match(
    identity[0]!.needsReviewReason ?? "",
    /cannot represent this as a stakeholder change|full name before adding someone new|needs clarification/i,
  );
  assert.equal(identity[0]!.suggestion.proposedValues?.candidates, undefined);
}

// --- 14. Review visual language (presentation only) ---
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
  assert.equal(reviewOpWord("update", "complete"), "Update");
  assert.equal(reviewOpWord("create", "create"), "Create");
  assert.equal(reviewOpWord("needs_you", "create"), "Needs You");
  assert.equal(reviewOpWord("remove", "remove"), "Remove");
  assert.equal(reviewOpIcon("create"), "circle-plus");
  assert.equal(reviewOpIcon("update"), "pencil");
  assert.equal(reviewOpIcon("remove"), "circle-minus");
  assert.equal(reviewOpIcon("needs_you"), "circle-help");
  assert.equal(reviewFamilyClass("needs_you"), "is-needs-you");
  assert.equal(reviewDomainLabel("action"), "To Do");
  assert.equal(reviewDomainLabel("nudge"), "Reminder");
  assert.equal(reviewDomainLabel("meeting"), "Date");
  assert.equal(reviewDomainLabel("risk"), "Risk");
  assert.equal(reviewDomainLabel("stakeholder"), "Stakeholder");
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

  const actions = readFileSync(
    join(import.meta.dirname, "../src/components/capture/review/CorrectionActions.tsx"),
    "utf8",
  );
  assert.match(actions, /hidePrompt/);
  assert.match(actions, /const prompt = /);
  assert.match(actions, /prompt\(missingDateCopy/);
  assert.match(actions, /prompt\(namedTarget \? labels\.question : copy\)/);
  const card = readFileSync(
    join(import.meta.dirname, "../src/components/capture/review/SuggestedChangeCard.tsx"),
    "utf8",
  );
  assert.match(card, /ownershipChoiceCopy/);
  assert.match(card, /ownershipQuestion/);
  assert.equal(
    (actions.match(/compact-change-review-copy/g) || []).length,
    1,
  );
}

console.log("verify-capture-review: all checks passed");
