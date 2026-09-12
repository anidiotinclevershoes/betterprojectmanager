import {
  parseObservationEnvelope,
  validateObservations,
  contextRecordsFromWorld,
} from "../../src/lib/capture-v2";
import { resolveObservations } from "../../src/lib/capture-v2/resolve";
import { captureResultFromResolved } from "../../src/lib/capture-v2/toResult";
import { buildSuggestions } from "../../src/lib/capture/suggestions";
import { buildReviewChangeViewModels } from "../../src/lib/capture/review/viewModel";
import type { CaptureApplyWorld } from "../../src/lib/capture/apply";
import { asUsableString } from "../../src/lib/capture-v2/contract";
import type { CaptureObservationV2 } from "../../src/lib/capture-v2/types";
import type { SemanticAtom, SemanticSnapshot, StageTrace } from "./types";
import { observationsOf } from "./obs";

export type PipelineRun = {
  trace: StageTrace;
  snapshot: SemanticSnapshot;
};

function usable(value: unknown): string | null {
  return asUsableString(value) ?? null;
}

export function reasonClass(kind: string, reason: string | null): string {
  if (kind === "write") return "write";
  if (kind === "no_change") return "no_change";
  if (kind === "rejected") return "rejected";
  if (kind !== "needs_you") return kind;
  const text = (reason ?? "").toLowerCase();
  if (/more than one existing person/.test(text)) return "needs_you_identity_multiple";
  if (
    /person identity is not established|cannot tell which person|needs a name|not a recorded/.test(
      text,
    )
  ) {
    return "needs_you_identity_incomplete";
  }
  if (/not on this project/.test(text)) return "needs_you_identity_mismatch";
  if (/not supported|not specific enough|completing a date/.test(text)) {
    return "needs_you_unsupported_transition";
  }
  if (/responsibility/.test(text)) return "needs_you_missing_scope";
  return "needs_you_other";
}

function fieldsOf(row: CaptureObservationV2) {
  const values = row.proposedValues ?? {};
  return {
    name:
      usable(values.name) ||
      usable(values.personName) ||
      usable(row.candidateTargetTitle),
    scope: usable(values.scope),
    date:
      usable(values.date) ||
      usable(values.startAt) ||
      usable(values.awayFromIso),
    statement: row.statement?.trim() || "",
    evidence: row.evidence?.trim() || "",
  };
}

export function runPipeline(args: {
  transcript: string;
  rawModelJson: unknown;
  world: CaptureApplyWorld;
  projectId: string;
}): PipelineRun {
  const parsed = parseObservationEnvelope(args.rawModelJson);
  const records = contextRecordsFromWorld(args.world, args.projectId);
  const validation = validateObservations(
    parsed.observations,
    records,
    args.projectId,
  );
  const resolved = resolveObservations({
    observations: validation.observations,
    world: args.world,
    transcript: args.transcript,
    captureEntryProjectId: args.projectId,
  });
  const result = captureResultFromResolved({
    transcript: args.transcript,
    projectId: args.projectId,
    resolved,
    rejected: validation.rejected,
  });
  const suggestions = buildSuggestions(result, []);
  const reviewModels = buildReviewChangeViewModels(
    suggestions,
    result,
    args.transcript,
    {},
    {
      world: args.world,
      captureEntryProjectId: args.projectId,
    },
  );

  const inputRows = observationsOf(args.rawModelJson);
  const keptById = new Map(validation.observations.map((row) => [row.id, row]));
  const rejectedById = new Map(validation.rejected.map((row) => [row.id, row]));
  const resolvedById = new Map(
    resolved.map((row) => [row.observation.id, row]),
  );
  const reviewByModelObs = new Map<string, string>();
  for (const model of reviewModels) {
    const mid = model.suggestion.modelObservationId;
    if (mid) reviewByModelObs.set(mid, model.readiness);
  }

  const atoms: SemanticAtom[] = [];
  const preserved: StageTrace["preserved"] = [];
  const identity: StageTrace["identity"] = [];
  const plan: StageTrace["plan"] = [];
  const review: StageTrace["review"] = [];

  for (const input of inputRows) {
    const kept = keptById.get(input.id);
    const rejected = rejectedById.get(input.id);
    const row = resolvedById.get(input.id);
    const before = fieldsOf(input);
    const after = fieldsOf(kept ?? rejected ?? input);
    preserved.push({
      id: input.id,
      statement: Boolean(after.statement) || !before.statement,
      evidence: Boolean(after.evidence) || !before.evidence,
      name: Boolean(after.name) || !before.name,
      scope: Boolean(after.scope) || !before.scope,
      date: Boolean(after.date) || !before.date,
    });

    const decision = row?.decision;
    const suggestion = row?.suggestion ?? null;
    const writeType =
      decision?.kind === "write" ? decision.operation.type : null;
    const reason =
      decision && "reason" in decision ? (decision.reason as string) : null;
    identity.push({
      id: input.id,
      targetId:
        suggestion?.personId ??
        suggestion?.targetEntityId ??
        kept?.candidateTargetId ??
        null,
      personName: suggestion?.personName ?? after.name,
      bound: Boolean(suggestion?.personId || suggestion?.targetEntityId),
    });
    plan.push({
      id: input.id,
      kind: decision?.kind ?? (rejected ? "rejected" : "missing"),
      writeType,
      reason,
    });
    const readiness = reviewByModelObs.get(input.id) ?? null;
    review.push({ id: input.id, readiness });

    atoms.push({
      observationId: input.id,
      domain: (kept ?? rejected ?? input).domain,
      disposition: (kept ?? rejected ?? input).disposition,
      truthIntent: (kept ?? rejected ?? input).truthIntent,
      decisionKind: decision?.kind ?? (rejected ? "rejected" : "missing"),
      writeType,
      legalDomain: decision?.domain ?? null,
      targetId:
        suggestion?.personId ??
        suggestion?.targetEntityId ??
        kept?.candidateTargetId ??
        null,
      personName: suggestion?.personName ?? after.name,
      scope: suggestion?.responsibilityScope ?? after.scope,
      date: suggestion?.date ?? after.date,
      rejected: Boolean(rejected),
      reviewReadiness: readiness,
      reasonClass: reasonClass(
        decision?.kind ?? (rejected ? "rejected" : "missing"),
        reason,
      ),
    });
  }

  const parseMalformed = parsed.issues.some((issue) => issue.code === "malformed");
  return {
    trace: {
      parseMalformed,
      parseIssueCodes: parsed.issues.map((issue) => issue.code),
      keptIds: validation.observations.map((row) => row.id),
      rejectedIds: validation.rejected.map((row) => row.id),
      rejectedCodes: validation.issues.map((issue) => issue.code),
      preserved,
      identity,
      plan,
      review,
    },
    snapshot: {
      atoms,
      rejectedCodes: validation.issues.map((issue) => issue.code).sort(),
      parseMalformed,
    },
  };
}

export function focusAtoms(
  snapshot: SemanticSnapshot,
  focusIds: string[],
): SemanticAtom[] {
  const wanted = new Set(focusIds);
  return snapshot.atoms
    .filter((atom) => wanted.has(atom.observationId))
    .sort((a, b) => a.observationId.localeCompare(b.observationId));
}

export function comparableAtom(atom: SemanticAtom): Omit<SemanticAtom, "observationId"> {
  const { observationId: _id, ...rest } = atom;
  return rest;
}
