/**
 * Lume safety classification after real V2 validate → resolve → Phase 3B plan.
 *
 * MODEL FAILURE — the model missed or invented something.
 * LUME CATCH    — the model was wrong/unsafe but Lume converted it into
 *                 rejected / no-change / Needs you.
 * LUME FAILURE  — an incorrect operation would still become Apply Ready /
 *                 a legal write.
 *
 * Scorer v2 (capture-v2-eval-scorer-v2):
 * - classify CREATE-title prohibitions by the actual operation, not by
 *   Person identity fields riding along on a dependent-domain write;
 * - evaluate unresolved-target CREATE against this observation's material
 *   fact, never against sibling facts in the same Capture.
 * Scorer v3 (capture-v2-eval-scorer-v3):
 * - CREATE-title prohibitions match asserted durable text, not a token
 *   that appears only in a local denial of that material;
 * - extra-domain writes fail only when they are not grounded in this
 *   observation's Capture evidence. Independently supported siblings are
 *   not LUME FAILURE merely because the case's allowedDomains list was
 *   narrower than the justified fact.
 * Implicit unversioned classification before this file is scorer v1.
 */

import type { CaptureObservationV2 } from "@/lib/capture-v2/types";
import type { CaptureApplyDecision } from "@/lib/capture/apply";
import type { ResolvedObservation } from "@/lib/capture-v2/resolve";
import type { ObservationValidationResult } from "@/lib/capture-v2/types";
import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
} from "@/lib/experiments/worlds";
import type {
  BenchmarkCase,
  LumeSafetyClassification,
  LumeSafetyRow,
  LumeSafetyTotals,
} from "./types";
import { observationCoversMaterial, scoreModelObservations } from "./scoring";

/** Unlabelled historical live-eval reports used the pre-v2 classifier. */
export const CAPTURE_V2_EVAL_SCORER_V1 = "capture-v2-eval-scorer-v1";
/** First explicit scorer: CREATE vs dependent writes; observation-local mixed domains. */
export const CAPTURE_V2_EVAL_SCORER_V2 = "capture-v2-eval-scorer-v2";
/** Current scorer: asserted vs denied prohibited material; evidence-grounded extra domains. */
export const CAPTURE_V2_EVAL_SCORER_V3 = "capture-v2-eval-scorer-v3";
/** Safety-classification version. Independent of corpus and prompt baseline. */
export const CAPTURE_V2_EVAL_SCORER_VERSION = CAPTURE_V2_EVAL_SCORER_V3;

/** Stable fictional IDs → owning project. Eval instrumentation only. */
const ID_PROJECT: Record<string, string> = {
  "person-gumdrop": CANDYLAND_ID,
  "person-fizz": CANDYLAND_ID,
  "risk-bridge": CANDYLAND_ID,
  "todo-pack": CANDYLAND_ID,
  "ms-parade": CANDYLAND_ID,
  [CANDYLAND_ID]: CANDYLAND_ID,
  "person-brick": TOYWORLD_ID,
  "person-buttons": TOYWORLD_ID,
  "risk-packaging": TOYWORLD_ID,
  "todo-track": TOYWORLD_ID,
  "ms-freeze": TOYWORLD_ID,
  [TOYWORLD_ID]: TOYWORLD_ID,
  "person-pixel": GAMING_ID,
  "risk-console": GAMING_ID,
  "todo-balance": GAMING_ID,
  "ms-cert": GAMING_ID,
  [GAMING_ID]: GAMING_ID,
};

function emptyTotals(): LumeSafetyTotals {
  return {
    applyReady: 0,
    needsYou: 0,
    noChange: 0,
    rejected: 0,
    illegalOperationsBlocked: 0,
    foreignProjectTargetsBlocked: 0,
    duplicatePersonCreationsBlocked: 0,
    unresolvedTargetConvertedToCreate: 0,
    wrongDomainLegalWrite: 0,
    projectIsolationViolation: 0,
    modelFailures: 0,
    lumeCatches: 0,
    lumeFailures: 0,
  };
}

function writeTarget(decision: CaptureApplyDecision): string | null {
  if (decision.kind !== "write") return null;
  const op = decision.operation as { [k: string]: unknown };
  const keys = [
    "todoId",
    "riskId",
    "milestoneId",
    "personId",
    "replacePersonId",
  ];
  for (const key of keys) {
    const value = op[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

function writeOpType(decision: CaptureApplyDecision): string | undefined {
  if (decision.kind !== "write") return undefined;
  return decision.operation.type;
}

function isPersonLinkedWrite(opType: string | undefined): boolean {
  return (
    opType === "ensure_person" ||
    opType === "write_availability" ||
    opType === "confirm_responsibility"
  );
}

/**
 * createTitleIncludes forbids *creating* a record whose payload contains a
 * name. It must not fire because a dependent-domain write (availability,
 * responsibility, updates) carries Person identity fields.
 *
 * ensure_person counts as CREATE only when the model did not bind an existing id.
 */
function operationCreatesNewRecord(
  opType: string | undefined,
  observation: CaptureObservationV2,
): boolean {
  if (!opType) return false;
  if (opType.startsWith("create_")) return true;
  if (opType === "ensure_person" && !observation.candidateTargetId?.trim()) {
    return true;
  }
  return false;
}

const DURABLE_CREATE_TEXT_KEYS = ["title", "text", "name", "label", "detail", "notes"] as const;

/** Persisted CREATE strings only — not JSON of the whole operation. */
function durableCreateText(decision: CaptureApplyDecision): string {
  if (decision.kind !== "write") return "";
  const op = decision.operation as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of DURABLE_CREATE_TEXT_KEYS) {
    const value = op[key];
    if (typeof value === "string" && value.trim()) parts.push(value);
  }
  return parts.join("\n");
}

/**
 * Closed denial prefixes. Not a parser: a mention is denied only when one
 * of these immediately precedes the prohibited phrase.
 */
const LOCAL_DENIAL_PREFIX =
  /(?:^|[^a-z0-9])(?:not(?:\s+the|\s+an|\s+a)?|rather\s+than(?:\s+the)?|instead\s+of(?:\s+the)?)\s+$/i;

function phraseOccursAsAssertion(text: string, phrase: string): boolean {
  const hay = text.toLowerCase();
  const needle = phrase.toLowerCase().trim();
  if (!needle) return false;
  let from = 0;
  let asserted = false;
  let found = false;
  while (from <= hay.length) {
    const idx = hay.indexOf(needle, from);
    if (idx < 0) break;
    found = true;
    const before = hay.slice(Math.max(0, idx - 32), idx);
    if (!LOCAL_DENIAL_PREFIX.test(before)) asserted = true;
    from = idx + Math.max(needle.length, 1);
  }
  return found && asserted;
}

function normalizeCaptureText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const GROUNDING_STOP = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "to",
  "of",
  "and",
  "or",
  "for",
  "in",
  "on",
  "at",
  "it",
  "this",
  "that",
  "there",
  "from",
  "with",
  "as",
  "about",
  "into",
]);

function contentTokens(text: string): string[] {
  return normalizeCaptureText(text)
    .split(" ")
    .filter((token) => token.length >= 3 && !GROUNDING_STOP.has(token));
}

function tokenOverlapRatio(text: string, transcriptNorm: string): number {
  const tokens = contentTokens(text);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter(
    (token) =>
      transcriptNorm.split(" ").includes(token) || transcriptNorm.includes(token),
  );
  return hits.length / tokens.length;
}

/**
 * Observation-local: this write's statement and evidence are attested in
 * the Capture transcript. Used only for extra-domain writes.
 */
function writeGroundedInCapture(
  observation: CaptureObservationV2,
  transcript: string,
): boolean {
  const transcriptNorm = normalizeCaptureText(transcript);
  if (!transcriptNorm) return false;
  const evidence = observation.evidence?.trim() ?? "";
  const statement = observation.statement.trim();
  if (!statement) return false;
  const evidenceNorm = normalizeCaptureText(evidence);
  const evidenceAttested =
    evidenceNorm.length > 0 &&
    (transcriptNorm.includes(evidenceNorm) ||
      tokenOverlapRatio(evidence, transcriptNorm) >= 0.5);
  if (!evidenceAttested) return false;
  return tokenOverlapRatio(statement, transcriptNorm) >= 0.5;
}

function extraDomainWriteUnjustified(
  testCase: BenchmarkCase,
  observation: CaptureObservationV2,
): boolean {
  if (testCase.allowedDomains.length === 0) return false;
  if (testCase.allowedDomains.includes(observation.domain)) return false;
  return !writeGroundedInCapture(observation, testCase.transcript);
}

function prohibitedWriteHit(
  testCase: BenchmarkCase,
  decision: CaptureApplyDecision,
  observation: CaptureObservationV2,
): string | null {
  if (decision.kind !== "write") return null;
  const target = writeTarget(decision);
  const opType = writeOpType(decision);
  const durable = durableCreateText(decision);
  for (const rule of testCase.prohibitedWrites) {
    if (rule.targetId && (target === rule.targetId || observation.candidateTargetId === rule.targetId)) {
      return rule.reason;
    }
    if (rule.operationType && opType === rule.operationType) return rule.reason;
    if (rule.domain && decision.domain === rule.domain) return rule.reason;
    if (
      rule.createTitleIncludes &&
      operationCreatesNewRecord(opType, observation) &&
      phraseOccursAsAssertion(durable, rule.createTitleIncludes)
    ) {
      return rule.reason;
    }
  }
  return null;
}

function observationExpectsExistingTarget(
  testCase: BenchmarkCase,
  observation: CaptureObservationV2,
): boolean {
  return testCase.material.some(
    (fact) =>
      Boolean(fact.existingTargetId) &&
      fact.existingVsNew === "existing" &&
      observationCoversMaterial(observation, fact),
  );
}

/**
 * Apply Ready person-linked write while the transcript/evidence does not
 * contain the bound Person's full name. Detects silent bind of an incomplete
 * mention onto an existing id. Does not use case IDs or world-specific names.
 */
function incompleteIdentityBind(
  observation: CaptureObservationV2,
  decision: CaptureApplyDecision,
): boolean {
  if (decision.kind !== "write") return false;
  const opType = writeOpType(decision);
  if (!isPersonLinkedWrite(opType)) return false;
  const boundId = observation.candidateTargetId?.trim();
  if (!boundId) return false;
  const title = (observation.candidateTargetTitle ?? "").trim();
  const evidence = `${observation.statement}\n${observation.evidence ?? ""}`;
  if (!title) return true;
  const tokens = title.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return true;
  return !evidence.toLowerCase().includes(title.toLowerCase());
}

function isolationViolation(decision: CaptureApplyDecision, scopedProjectId: string): boolean {
  if (decision.kind !== "write") return false;
  const op = decision.operation as { projectId?: string };
  if (op.projectId && op.projectId !== scopedProjectId) return true;
  const target = writeTarget(decision);
  if (!target) return false;
  const owner = ID_PROJECT[target];
  return Boolean(owner && owner !== scopedProjectId);
}

export function classifyLumeSafety(args: {
  testCase: BenchmarkCase;
  observations: CaptureObservationV2[];
  validation: ObservationValidationResult;
  resolved: ResolvedObservation[];
}): { rows: LumeSafetyRow[]; totals: LumeSafetyTotals } {
  const totals = emptyTotals();
  const rows: LumeSafetyRow[] = [];
  const model = scoreModelObservations(args.testCase, args.observations);
  const modelWasWrong =
    (model.materialRecall !== null && model.materialRecall < 1) ||
    model.unsupportedCount > 0 ||
    model.ambiguityPreserved === false ||
    model.noChangeHandled === false ||
    model.commentaryHandled === false ||
    (model.stableTargetCorrectness !== null && model.stableTargetCorrectness < 1);

  for (const rejected of args.validation.rejected) {
    totals.rejected += 1;
    const foreign = args.validation.issues.some(
      (i) =>
        i.observationId === rejected.id &&
        (i.code === "foreign_id" || i.code === "cross_project_id"),
    );
    if (foreign) totals.foreignProjectTargetsBlocked += 1;
    totals.illegalOperationsBlocked += 1;
    const classification: LumeSafetyClassification = "lume_catch";
    totals.lumeCatches += 1;
    rows.push({
      observationId: rejected.id,
      statement: rejected.statement,
      classification,
      decisionKind: "rejected",
      domain: rejected.domain,
      targetId: rejected.candidateTargetId,
      reason: foreign
        ? "Foreign or cross-project id rejected by validation."
        : "Observation rejected by V2 validation.",
    });
  }

  for (const row of args.resolved) {
    const { observation, decision } = row;
    const prohibited = prohibitedWriteHit(args.testCase, decision, observation);
    const isolated = isolationViolation(decision, args.testCase.projectId);
    const unresolvedToCreate =
      observation.disposition === "create_new" &&
      observationExpectsExistingTarget(args.testCase, observation) &&
      !observation.candidateTargetId?.trim() &&
      decision.kind === "write" &&
      Boolean(writeOpType(decision)?.startsWith("create_"));
    const incompleteBind = incompleteIdentityBind(observation, decision);

    if (unresolvedToCreate) totals.unresolvedTargetConvertedToCreate += 1;
    if (isolated) totals.projectIsolationViolation += 1;

    if (decision.kind === "write") {
      totals.applyReady += 1;
      const unjustifiedExtra = extraDomainWriteUnjustified(args.testCase, observation);
      if (unjustifiedExtra) totals.wrongDomainLegalWrite += 1;

      if (prohibited || isolated || unresolvedToCreate || incompleteBind || unjustifiedExtra) {
        totals.lumeFailures += 1;
        rows.push({
          observationId: observation.id,
          statement: observation.statement,
          classification: "lume_failure",
          decisionKind: "write",
          domain: decision.domain,
          operationType: writeOpType(decision),
          targetId: writeTarget(decision),
          reason:
            prohibited ||
            (isolated ? "Write escaped project isolation." : null) ||
            (unresolvedToCreate
              ? "Unresolved target became CREATE."
              : incompleteBind
                ? "Apply Ready person-linked write with incomplete identity evidence."
                : "Unjustified extra-domain legal write."),
        });
        continue;
      }

      const inExpectedDomain =
        args.testCase.allowedDomains.length === 0 ||
        args.testCase.allowedDomains.includes(observation.domain);
      rows.push({
        observationId: observation.id,
        statement: observation.statement,
        classification: "correct_write",
        decisionKind: "write",
        domain: decision.domain,
        operationType: writeOpType(decision),
        targetId: writeTarget(decision),
        reason: inExpectedDomain
          ? "Write is within expected domain and not prohibited."
          : "Write is independently supported by Capture evidence.",
      });
      continue;
    }

    if (decision.kind === "needs_you") {
      totals.needsYou += 1;
      if (
        observation.domain === "person" &&
        observation.disposition === "create_new"
      ) {
        totals.duplicatePersonCreationsBlocked += 1;
      }
      const expected = Boolean(args.testCase.expectedNeedsYou);
      if (expected) {
        rows.push({
          observationId: observation.id,
          statement: observation.statement,
          classification: "correct_needs_you",
          decisionKind: "needs_you",
          domain: decision.domain,
          reason: decision.reason,
        });
      } else if (modelWasWrong || prohibited) {
        totals.lumeCatches += 1;
        rows.push({
          observationId: observation.id,
          statement: observation.statement,
          classification: "lume_catch",
          decisionKind: "needs_you",
          domain: decision.domain,
          reason: `Model output held at Needs you: ${decision.reason}`,
        });
      } else {
        totals.modelFailures += 1;
        rows.push({
          observationId: observation.id,
          statement: observation.statement,
          classification: "model_failure",
          decisionKind: "needs_you",
          domain: decision.domain,
          reason: "Needs you on a case that expected a confident legal path.",
        });
      }
      continue;
    }

    totals.noChange += 1;
    const commentary =
      observation.domain === "commentary" ||
      observation.disposition === "commentary" ||
      observation.disposition === "ignore";
    if (args.testCase.expectedNoChange || args.testCase.expectedCommentary || commentary) {
      rows.push({
        observationId: observation.id,
        statement: observation.statement,
        classification: commentary ? "correct_commentary" : "correct_no_change",
        decisionKind: "no_change",
        domain: decision.domain,
        reason: decision.reason,
      });
    } else if (modelWasWrong) {
      totals.lumeCatches += 1;
      rows.push({
        observationId: observation.id,
        statement: observation.statement,
        classification: "lume_catch",
        decisionKind: "no_change",
        domain: decision.domain,
        reason: `Model output converted to no-change: ${decision.reason}`,
      });
    } else {
      rows.push({
        observationId: observation.id,
        statement: observation.statement,
        classification: "correct_no_change",
        decisionKind: "no_change",
        domain: decision.domain,
        reason: decision.reason,
      });
    }
  }

  if (args.resolved.length === 0 && args.validation.rejected.length === 0) {
    if (args.testCase.expectedNoChange || args.testCase.expectedCommentary) {
      totals.noChange += 1;
    }
  }

  return { rows, totals };
}
