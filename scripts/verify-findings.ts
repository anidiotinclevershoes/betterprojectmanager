/**
 * Phase 1.6 — Finding validation + deterministic mapping tests.
 * Run: npx tsx scripts/verify-findings.ts
 */
import assert from "node:assert/strict";
import {
  buildContextRecordIndex,
  classifyFindingDisposition,
  dedupeProposedOperations,
  mapFindingToOperation,
  mapFindingsToOperations,
  reconcileFindingCoverage,
  validateCaptureFindings,
  type CaptureFinding,
  type IndexedContextRecord,
} from "../src/lib/capture/findings";
import type { CaptureProjectContext } from "../src/lib/capture/context";
import {
  WEBSITE_REFRESH_SCENARIO,
  fixtureToMissionState,
  presentGoldenResult,
  scoreGoldenResult,
} from "../src/lib/dev/golden";
import { buildCaptureContext } from "../src/lib/capture/context";
import { buildCaptureResultFromAi, localCaptureFallback } from "../src/lib/openai";
import type { MissionState } from "../src/lib/types";

function indexFromPairs(
  rows: Array<Partial<IndexedContextRecord> & { id: string; title: string; entityType: IndexedContextRecord["entityType"] }>,
) {
  const map = new Map<string, IndexedContextRecord>();
  for (const r of rows) {
    map.set(r.id, {
      entityType: r.entityType,
      id: r.id,
      title: r.title,
      status: r.status,
      summary: r.summary,
      rawType: r.rawType ?? r.entityType,
    });
  }
  return map;
}

const index = indexFromPairs([
  {
    id: "todo-cab",
    entityType: "todo",
    title: "Obtain CAB approval",
    status: "open",
  },
  {
    id: "know-release",
    entityType: "knowledge",
    title: "Release planned for 12 August",
  },
  {
    id: "risk-cdn",
    entityType: "risk",
    title: "CDN deployment delayed",
  },
]);

// --- validation: accepts valid target IDs ---
{
  const report = validateCaptureFindings(
    [
      {
        fact: "CAB approved",
        evidence: "CAB approval received",
        findingType: "ENTITY_COMPLETED",
        target: {
          entityType: "todo",
          entityId: "todo-cab",
          title: "Obtain CAB approval",
        },
        confidence: 96,
        requiresClarification: false,
        reasoningSummary: "Matches open To Do",
      },
    ],
    index,
  );
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]?.invalidTarget, undefined);
  assert.equal(report.invalidTargetCount, 0);
}

// --- rejects unknown target IDs ---
{
  const report = validateCaptureFindings(
    [
      {
        fact: "Something",
        evidence: "Evidence",
        findingType: "ENTITY_COMPLETED",
        target: {
          entityType: "todo",
          entityId: "invented-id",
          title: "Fake",
        },
        confidence: 90,
        requiresClarification: false,
        reasoningSummary: "Bad id",
      },
    ],
    index,
  );
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]?.findingType, "AMBIGUOUS");
  assert.equal(report.findings[0]?.invalidTarget, true);
  assert.equal(report.invalidTargetCount, 1);
  assert.equal(mapFindingToOperation(report.findings[0]!), null);
}

// --- rejects unsupported finding types ---
{
  const report = validateCaptureFindings(
    [
      {
        fact: "x",
        evidence: "y",
        findingType: "MADE_UP",
        confidence: 80,
        requiresClarification: false,
        reasoningSummary: "nope",
      },
    ],
    index,
  );
  assert.equal(report.findings.length, 0);
  assert.ok(report.warnings.some((w) => /unsupported findingType/i.test(w)));
}

// --- rejects missing evidence or reasoning ---
{
  const report = validateCaptureFindings(
    [
      {
        fact: "x",
        findingType: "NO_CHANGE",
        confidence: 80,
        requiresClarification: false,
        reasoningSummary: "has reasoning",
      },
      {
        fact: "y",
        evidence: "ev",
        findingType: "NO_CHANGE",
        confidence: 80,
        requiresClarification: false,
      },
    ],
    index,
  );
  assert.equal(report.findings.length, 0);
}

// --- clamps confidence ---
{
  const report = validateCaptureFindings(
    [
      {
        fact: "x",
        evidence: "y",
        findingType: "NO_CHANGE",
        confidence: 100.4,
        requiresClarification: false,
        reasoningSummary: "ok",
      },
    ],
    index,
  );
  assert.equal(report.findings[0]?.confidence, 100);
}

{
  const report = validateCaptureFindings(
    [
      {
        fact: "x",
        evidence: "y",
        findingType: "NO_CHANGE",
        confidence: 999,
        requiresClarification: false,
        reasoningSummary: "ok",
      },
    ],
    index,
  );
  assert.equal(report.findings.length, 0);
}

// --- mapping rules ---
{
  const completedTodo: CaptureFinding = {
    id: "f1",
    fact: "CAB done",
    evidence: "received",
    findingType: "ENTITY_COMPLETED",
    target: {
      entityType: "todo",
      entityId: "todo-cab",
      title: "Obtain CAB approval",
    },
    confidence: 96,
    requiresClarification: false,
    reasoningSummary: "Complete the To Do",
  };
  const op = mapFindingToOperation(completedTodo, index.get("todo-cab"));
  assert.ok(op);
  assert.equal(op!.operation, "COMPLETE");
  assert.equal(op!.entityType, "todo");
  assert.equal(op!.sourceFindingId, "f1");
  assert.equal(op!.targetId, "todo-cab");
}

{
  const updatedKnow: CaptureFinding = {
    id: "f2",
    fact: "Date moved",
    evidence: "19 August",
    findingType: "ENTITY_UPDATED",
    target: {
      entityType: "knowledge",
      entityId: "know-release",
      title: "Release planned for 12 August",
    },
    changes: {
      text: {
        previous: "Release planned for 12 August",
        proposed: "Release planned for 19 August",
      },
    },
    confidence: 93,
    requiresClarification: false,
    reasoningSummary: "Update knowledge date",
  };
  const op = mapFindingToOperation(updatedKnow, index.get("know-release"));
  assert.ok(op);
  assert.equal(op!.operation, "UPDATE");
  assert.equal(op!.entityType, "knowledge");
  assert.equal(op!.proposedValues?.text, "Release planned for 19 August");
}

{
  const resolvedRisk: CaptureFinding = {
    id: "f3",
    fact: "CDN resolved",
    evidence: "issue resolved",
    findingType: "ENTITY_COMPLETED",
    target: {
      entityType: "risk",
      entityId: "risk-cdn",
      title: "CDN deployment delayed",
    },
    confidence: 90,
    requiresClarification: false,
    reasoningSummary: "Complete risk",
  };
  const op = mapFindingToOperation(resolvedRisk, index.get("risk-cdn"));
  assert.ok(op);
  assert.equal(op!.operation, "COMPLETE"); // canonical resolved Risk action
  assert.equal(op!.entityType, "risk");
}

{
  const ambiguous: CaptureFinding = {
    id: "f4",
    fact: "unclear",
    evidence: "maybe",
    findingType: "AMBIGUOUS",
    confidence: 40,
    requiresClarification: true,
    clarificationQuestion: "Which record?",
    reasoningSummary: "Ambiguous",
  };
  assert.equal(mapFindingToOperation(ambiguous), null);
}

{
  const invalid: CaptureFinding = {
    id: "f5",
    fact: "bad",
    evidence: "ev",
    findingType: "ENTITY_COMPLETED",
    confidence: 80,
    requiresClarification: true,
    invalidTarget: true,
    reasoningSummary: "bad id",
  };
  assert.equal(mapFindingToOperation(invalid), null);
}

{
  const transient: CaptureFinding = {
    id: "f6",
    fact: "CAB approval completed",
    evidence: "todo completed",
    findingType: "NEW_INFORMATION",
    changes: {
      entityType: { proposed: "knowledge" },
    },
    confidence: 70,
    requiresClarification: false,
    reasoningSummary: "Should not become Knowledge",
  };
  assert.equal(mapFindingToOperation(transient), null);
}

// --- Golden mocked structured findings (no API) ---
{
  const scenario = WEBSITE_REFRESH_SCENARIO;
  const fixture = fixtureToMissionState(scenario);
  const state: MissionState = {
    ...fixture,
    memories: [],
  };
  const captureContext = buildCaptureContext({
    projectId: scenario.project.id,
    captureText: scenario.defaultCapture,
    state,
  });
  const ctxIndex = buildContextRecordIndex(captureContext);
  assert.ok(ctxIndex.has("golden-todo-cab"));
  assert.ok(ctxIndex.has("know-golden-proj-website-refresh-now-0"));
  assert.ok(ctxIndex.has("golden-risk-0"));

  const mockedFindings = [
    {
      fact: "CAB approval received",
      evidence: "CAB approval has now been received.",
      findingType: "ENTITY_COMPLETED",
      target: {
        entityType: "todo",
        entityId: "golden-todo-cab",
        title: "Obtain CAB approval",
      },
      confidence: 96,
      requiresClarification: false,
      reasoningSummary: "Existing To Do completed",
    },
    {
      fact: "Release moved to 19 August",
      evidence: "Sarah has agreed to move the release to 19 August.",
      findingType: "ENTITY_UPDATED",
      target: {
        entityType: "knowledge",
        entityId: "know-golden-proj-website-refresh-now-0",
        title: "Release planned for 12 August",
      },
      changes: {
        text: {
          previous: "Release planned for 12 August",
          proposed: "Release planned for 19 August",
        },
      },
      confidence: 93,
      requiresClarification: false,
      reasoningSummary: "Update existing Knowledge date",
    },
    {
      fact: "CDN issue resolved",
      evidence: "The CDN issue has been resolved.",
      findingType: "ENTITY_COMPLETED",
      target: {
        entityType: "risk",
        entityId: "golden-risk-0",
        title: "CDN deployment delayed",
      },
      confidence: 91,
      requiresClarification: false,
      reasoningSummary: "Existing Risk resolved",
    },
  ];

  const result = buildCaptureResultFromAi({
    rawText: scenario.defaultCapture,
    projectId: scenario.project.id,
    ai: {
      title: "Website refresh updates",
      tidiedContent:
        "CAB approval received. Release moved to 19 August. CDN issue resolved.",
      memoryType: "conversation",
      tags: [],
      people: ["Sarah"],
      insights: [
        "CAB approval received",
        "Release moved to 19 August",
        "CDN issue resolved",
      ],
      assumptions: [],
      findings: mockedFindings,
      suggestedProjectId: scenario.project.id,
    },
    captureContext,
  });

  assert.equal(result.proposedOperations?.length, 3);
  assert.equal(
    result.proposedOperations?.every((o) => Boolean(o.sourceFindingId)),
    true,
  );
  assert.equal(
    result.proposedOperations?.some(
      (o) => o.operation === "CREATE" && o.entityType === "knowledge",
    ),
    false,
  );

  const score = scoreGoldenResult(scenario, result);
  assert.equal(score.passed, true, JSON.stringify(score.outcomes, null, 2));
  assert.equal(score.matched, 3);
  assert.equal(score.unexpectedCount, 0);
  assert.equal(score.invalidTargetCount, 0);
  assert.equal(score.contradictions, 0);
  assert.equal(score.gradeLabel, "Passed");

  const presented = presentGoldenResult(
    scenario,
    result,
    scenario.defaultCapture,
  );
  assert.ok((presented.findingCards?.length ?? 0) >= 3);
  assert.equal(presented.reasoning.length, 3);
  assert.ok(
    presented.reasoning.every((r) => Boolean(r.sourceFindingId)),
  );
}

// --- Local fallback path also produces deterministic ops ---
{
  const scenario = WEBSITE_REFRESH_SCENARIO;
  const fixture = fixtureToMissionState(scenario);
  const state: MissionState = { ...fixture, memories: [] };
  const captureContext = buildCaptureContext({
    projectId: scenario.project.id,
    captureText: scenario.defaultCapture,
    state,
  });
  const result = localCaptureFallback(
    {
      content: scenario.defaultCapture,
      projectId: scenario.project.id,
      sourceType: "note",
    },
    state,
    captureContext,
  );
  const score = scoreGoldenResult(scenario, result);
  assert.equal(
    score.passed,
    true,
    `local fallback should pass golden: ${JSON.stringify(score, null, 2)}`,
  );
}

// --- Sprint 2.1.5 coverage + duplicate-op guard ---
{
  const ambiguous: CaptureFinding = {
    id: "f-amb",
    fact: "CDN maybe resolved but another issue remains",
    evidence: "CDN looks resolved; hosting issue mentioned",
    findingType: "AMBIGUOUS",
    target: {
      entityType: "risk",
      entityId: "risk-cdn",
      title: "CDN deployment delayed",
    },
    confidence: 64,
    requiresClarification: true,
    clarificationQuestion: "Confirm which CDN issue is resolved?",
    reasoningSummary: "Ambiguous",
  };
  assert.equal(
    classifyFindingDisposition(ambiguous, null).disposition,
    "needs_review",
  );

  const unmatched: CaptureFinding = {
    id: "f-um",
    fact: "Move CAB pack submission to Friday",
    evidence: "submission moved to Friday",
    findingType: "ENTITY_UPDATED",
    invalidTarget: true,
    validationWarning: "Unknown target",
    confidence: 80,
    requiresClarification: false,
    reasoningSummary: "Date move",
  };
  assert.equal(
    classifyFindingDisposition(unmatched, null).disposition,
    "unmatched",
  );

  const createReady: CaptureFinding = {
    id: "f-new",
    fact: "New to-do: book the go-live bridge",
    evidence: "Create a to-do to book the go-live bridge",
    findingType: "NEW_INFORMATION",
    changes: {
      entityType: { proposed: "todo" },
      title: { proposed: "book the go-live bridge" },
    },
    confidence: 88,
    requiresClarification: false,
    reasoningSummary: "Explicit create",
  };
  const createOp = {
    id: "op-new",
    sourceFindingId: "f-new",
    operation: "CREATE" as const,
    entityType: "todo" as const,
    targetTitle: "book the go-live bridge",
    reason: "create",
    evidence: "create",
    confidence: 88,
    destructive: false,
    requiresClarification: false,
  };
  assert.equal(
    classifyFindingDisposition(createReady, createOp).disposition,
    "ready",
  );

  const dupOps = dedupeProposedOperations([
    {
      id: "op-a",
      sourceFindingId: "f1",
      operation: "UPDATE",
      entityType: "todo",
      targetId: "todo-1",
      targetTitle: "CAB pack",
      proposedValues: { date: "Friday" },
      reason: "due Friday",
      evidence: "Friday",
      confidence: 80,
      destructive: false,
      requiresClarification: false,
    },
    {
      id: "op-b",
      sourceFindingId: "f2",
      operation: "UPDATE",
      entityType: "todo",
      targetId: "todo-1",
      targetTitle: "CAB pack",
      proposedValues: { date: "Friday" },
      reason: "due Friday again",
      evidence: "Friday",
      confidence: 90,
      destructive: false,
      requiresClarification: false,
    },
    {
      id: "op-c",
      sourceFindingId: "f3",
      operation: "UPDATE",
      entityType: "todo",
      targetId: "todo-1",
      targetTitle: "CAB pack",
      proposedValues: { owner: "Nina" },
      reason: "owner Nina",
      evidence: "Nina",
      confidence: 85,
      destructive: false,
      requiresClarification: false,
    },
  ]);
  assert.equal(dupOps.length, 1, "compatible UPDATEs on same target merge");
  assert.equal(dupOps[0].proposedValues?.date, "Friday");
  assert.equal(dupOps[0].proposedValues?.owner, "Nina");

  const coverage = reconcileFindingCoverage(
    [ambiguous, unmatched, createReady],
    [createOp],
  );
  assert.equal(coverage.actionableCount, 3);
  assert.equal(coverage.readyCount, 1);
  assert.equal(coverage.needsReviewCount, 1);
  assert.equal(coverage.unmatchedCount, 1);
  assert.equal(coverage.silentDropCount, 0);
}

console.log("verify-findings: all checks passed");
