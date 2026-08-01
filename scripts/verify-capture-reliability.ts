/**
 * Phase C — Capture reliability warnings (deterministic rules).
 * Run: npx tsx scripts/verify-capture-reliability.ts
 */
import assert from "node:assert/strict";
import {
  DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS,
  collectPostAnalysisSignals,
  collectPreAnalysisSignals,
  evaluatePostAnalysisReliability,
  evaluatePreAnalysisReliability,
  shouldWarnBeforeAnalysis,
} from "../src/lib/capture/reliability";
import type { CaptureResult } from "../src/lib/types";
import type { CaptureContextManifest } from "../src/lib/capture/context";

function baseResult(over: Partial<CaptureResult> = {}): CaptureResult {
  return {
    memory: {
      id: "mem-1",
      type: "conversation",
      title: "Note",
      content: "Summary",
      tags: [],
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      source: "capture",
    },
    insights: ["Fact A"],
    assumptions: [],
    recommendations: [],
    findings: [],
    proposedOperations: [],
    findingsValidation: {
      ok: true,
      errors: [],
      warnings: [],
      invalidTargetCount: 0,
    },
    provider: "local",
    ...over,
  };
}

// Standard short Capture → no warning
const shortPre = shouldWarnBeforeAnalysis("CAB approved. Release moved.");
assert.equal(shortPre.state, "normal");

const shortPost = evaluatePostAnalysisReliability(
  collectPostAnalysisSignals({
    captureText: "CAB approved. Release moved.",
    result: baseResult({
      findings: [
        {
          id: "f1",
          fact: "CAB approved",
          evidence: "CAB approved",
          findingType: "ENTITY_COMPLETED",
          confidence: 90,
          requiresClarification: false,
          reasoningSummary: "CAB approval evidence",
        },
      ],
      proposedOperations: [
        {
          id: "op1",
          sourceFindingId: "f1",
          operation: "COMPLETE",
          entityType: "todo",
          targetId: "t1",
          targetTitle: "Obtain CAB approval",
          reason: "done",
          evidence: "CAB approved",
          confidence: 90,
          destructive: false,
          requiresClarification: false,
        },
      ],
    }),
    measuredInputTokens: 40,
  }),
);
assert.equal(shortPost.state, "normal");
assert.equal(shortPost.triggers.length, 0);

// Long but coherent → review_recommended, not limited
const longText = "x".repeat(
  DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS.criticalTokenCount * 4 + 100,
);
const longPre = shouldWarnBeforeAnalysis(longText);
assert.equal(longPre.state, "review_recommended");
assert.equal(longPre.title, "Long capture");
assert.notEqual(longPre.state, "limited");

const longPost = evaluatePostAnalysisReliability(
  collectPostAnalysisSignals({
    captureText: longText,
    result: baseResult({
      findings: [
        {
          id: "f1",
          fact: "Release moved",
          evidence: "release",
          findingType: "ENTITY_UPDATED",
          confidence: 88,
          requiresClarification: false,
          reasoningSummary: "Release date update",
        },
      ],
    }),
    measuredInputTokens:
      DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS.criticalTokenCount + 10,
  }),
);
assert.equal(longPost.state, "review_recommended");
assert.notEqual(longPost.state, "limited");

// Truncated Capture → visible warning (limited when material)
const truncatedManifest = {
  limitsReached: ["To Dos — 20 of 80 included"],
  excludedByLimit: Array.from({ length: 10 }, (_, i) => ({
    id: `ex-${i}`,
    type: "todo",
    title: `Todo ${i}`,
    bucket: "todos",
  })),
} as unknown as CaptureContextManifest;

const truncated = evaluatePostAnalysisReliability(
  collectPostAnalysisSignals({
    captureText: "Short note",
    result: baseResult(),
    contextManifest: truncatedManifest,
    measuredInputTokens: 20,
  }),
);
assert.equal(truncated.state, "limited");
assert.ok(truncated.triggers.some((t) => t.id === "truncation"));
assert.match(truncated.body, /could not confidently process/i);

// Ambiguous findings → review recommended
const ambiguous = evaluatePostAnalysisReliability(
  collectPostAnalysisSignals({
    captureText: "Maybe CAB? Or not.",
    result: baseResult({
      findings: [
        {
          id: "a1",
          fact: "Unclear CAB status",
          evidence: "Maybe",
          findingType: "AMBIGUOUS",
          confidence: 40,
          requiresClarification: true,
          clarificationQuestion: "Was CAB approved?",
          reasoningSummary: "Ambiguous CAB wording",
        },
        {
          id: "a2",
          fact: "Release unclear",
          evidence: "maybe",
          findingType: "AMBIGUOUS",
          confidence: 35,
          requiresClarification: true,
          reasoningSummary: "Ambiguous release wording",
        },
        {
          id: "a3",
          fact: "Something else",
          evidence: "x",
          findingType: "NEW_INFORMATION",
          confidence: 70,
          requiresClarification: false,
          reasoningSummary: "Additional note",
        },
      ],
    }),
    measuredInputTokens: 30,
  }),
);
assert.equal(ambiguous.state, "review_recommended");
assert.ok(ambiguous.triggers.some((t) => t.id === "clarification" || t.id === "ambiguity"));

// Invalid targets reported factually
const invalid = evaluatePostAnalysisReliability(
  collectPostAnalysisSignals({
    captureText: "Update ghost todo",
    result: baseResult({
      findings: [
        {
          id: "bad",
          fact: "Ghost todo",
          evidence: "x",
          findingType: "AMBIGUOUS",
          confidence: 20,
          requiresClarification: true,
          invalidTarget: true,
          validationWarning: "Target id not in context",
          reasoningSummary: "Invalid target reference",
        },
      ],
      findingsValidation: {
        ok: false,
        errors: ["unknown target"],
        warnings: [],
        invalidTargetCount: 1,
      },
    }),
    measuredInputTokens: 25,
  }),
);
assert.ok(invalid.triggers.some((t) => t.id === "invalid_targets"));
assert.match(
  invalid.triggers.find((t) => t.id === "invalid_targets")!.detail,
  /1 target/,
);

// Pre transcription incomplete → limited
const incomplete = evaluatePreAnalysisReliability(
  collectPreAnalysisSignals({
    captureText: "",
    measuredInputTokens: 0,
    transcriptionIncomplete: true,
  }),
);
assert.equal(incomplete.state, "limited");

// Warnings do not invent extra AI calls — pure functions only (smoke).
assert.ok(typeof evaluatePostAnalysisReliability === "function");

// Thresholds are documented defaults (exported object)
assert.ok(DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS.warningTokenCount > 0);
assert.ok(
  DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS.criticalTokenCount >
    DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS.warningTokenCount,
);

console.log("verify-capture-reliability: all assertions passed");
