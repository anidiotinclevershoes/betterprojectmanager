/**
 * Lume safety classification after real V2 validate → resolve → Phase 3B plan.
 *
 * MODEL FAILURE — the model missed or invented something.
 * LUME CATCH    — the model was wrong/unsafe but Lume converted it into
 *                 rejected / no-change / Needs you.
 * LUME FAILURE  — an incorrect operation would still become Apply Ready /
 *                 a legal write.
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
import { scoreModelObservations } from "./scoring";

const FOREIGN_IDS = new Set([
  "person-brick",
  "person-buttons",
  "person-pixel",
  "risk-packaging",
  "risk-console",
  "todo-track",
  "todo-balance",
  "ms-freeze",
  "ms-cert",
  GAMING_ID,
  TOYWORLD_ID,
]);

const CANDY_IDS = new Set([
  "person-gumdrop",
  "person-fizz",
  "risk-bridge",
  "todo-pack",
  "ms-parade",
  CANDYLAND_ID,
]);

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

function prohibitedWriteHit(
  testCase: BenchmarkCase,
  decision: CaptureApplyDecision,
  observation: CaptureObservationV2,
): string | null {
  if (decision.kind !== "write") return null;
  const target = writeTarget(decision);
  const opType = writeOpType(decision);
  const title = JSON.stringify(decision.operation).toLowerCase();
  for (const rule of testCase.prohibitedWrites) {
    if (rule.targetId && (target === rule.targetId || observation.candidateTargetId === rule.targetId)) {
      return rule.reason;
    }
    if (rule.operationType && opType === rule.operationType) return rule.reason;
    if (rule.domain && decision.domain === rule.domain) return rule.reason;
    if (rule.createTitleIncludes && title.includes(rule.createTitleIncludes.toLowerCase())) {
      return rule.reason;
    }
  }
  return null;
}

function isolationViolation(decision: CaptureApplyDecision, scopedProjectId: string): boolean {
  if (decision.kind !== "write") return false;
  const op = decision.operation as { projectId?: string };
  if (op.projectId && op.projectId !== scopedProjectId) return true;
  const target = writeTarget(decision);
  if (!target) return false;
  if (scopedProjectId === CANDYLAND_ID && FOREIGN_IDS.has(target)) return true;
  if (scopedProjectId !== CANDYLAND_ID && CANDY_IDS.has(target) && target !== scopedProjectId) {
    return true;
  }
  return false;
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
      Boolean(
        args.testCase.material.find(
          (f) => f.existingTargetId && f.existingVsNew === "existing",
        ),
      ) &&
      !observation.candidateTargetId &&
      decision.kind === "write" &&
      writeOpType(decision)?.startsWith("create_");

    if (unresolvedToCreate) totals.unresolvedTargetConvertedToCreate += 1;
    if (isolated) totals.projectIsolationViolation += 1;

    if (decision.kind === "write") {
      totals.applyReady += 1;
      const domainAllowed = args.testCase.allowedDomains.includes(observation.domain);
      if (!domainAllowed) totals.wrongDomainLegalWrite += 1;

      if (prohibited || isolated || unresolvedToCreate || !domainAllowed) {
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
              : "Wrong-domain legal write."),
        });
        continue;
      }

      rows.push({
        observationId: observation.id,
        statement: observation.statement,
        classification: "correct_write",
        decisionKind: "write",
        domain: decision.domain,
        operationType: writeOpType(decision),
        targetId: writeTarget(decision),
        reason: "Write is within expected domain and not prohibited.",
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
