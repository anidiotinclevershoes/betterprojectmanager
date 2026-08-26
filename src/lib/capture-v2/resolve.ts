import {
  planCaptureApply,
  type CaptureApplyDecision,
  type CaptureApplyWorld,
  type CaptureLegalDomain,
} from "@/lib/capture/apply";
import { fingerprintExpectedTarget } from "@/lib/capture/apply/expected-target";
import type { PendingSuggestion, SuggestionKind, SuggestionOp } from "@/lib/capture/suggestions";
import { namesMatchExact } from "@/lib/people/identity";
import type { CaptureObservationV2, ObservationDomain } from "./types";

export type ResolvedObservation = {
  observation: CaptureObservationV2;
  suggestion: PendingSuggestion | null;
  decision: CaptureApplyDecision;
};

const DOMAIN_TO_KIND: Record<ObservationDomain, SuggestionKind | null> = {
  person: "stakeholder",
  responsibility: "stakeholder",
  risk: "risk",
  milestone: "milestone",
  todo: "action",
  availability: "availability",
  knowledge: "knowledge",
  decision: "decision",
  commentary: null,
  unknown: null,
};

const DOMAIN_TO_LEGAL: Record<ObservationDomain, CaptureLegalDomain> = {
  person: "person",
  responsibility: "responsibility",
  risk: "risk",
  milestone: "milestone",
  todo: "todo",
  availability: "availability",
  knowledge: "knowledge",
  decision: "knowledge",
  commentary: "unsupported",
  unknown: "unsupported",
};

/**
 * Smallest resolver: map observations to suggestions, then reuse Phase 3B.
 * No phrase/regex matching. Broad invariants only.
 */
export function resolveObservations(args: {
  observations: CaptureObservationV2[];
  world: CaptureApplyWorld;
  transcript: string;
  captureEntryProjectId?: string | null;
}): ResolvedObservation[] {
  return args.observations.map((observation) =>
    resolveOne(observation, args),
  );
}

function resolveOne(
  observation: CaptureObservationV2,
  args: {
    world: CaptureApplyWorld;
    transcript: string;
    captureEntryProjectId?: string | null;
  },
): ResolvedObservation {
  const projectId = args.captureEntryProjectId || null;

  if (
    observation.disposition === "commentary" ||
    observation.disposition === "ignore" ||
    observation.domain === "commentary"
  ) {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "no_change",
        domain: "unsupported",
        reason: "Treated as commentary / non-project.",
      },
    };
  }

  if (observation.disposition === "merge") {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "no_change",
        domain: DOMAIN_TO_LEGAL[observation.domain],
        reason: observation.mergeWithObservationId
          ? `Merged with ${observation.mergeWithObservationId}.`
          : "Merged duplicate statement.",
      },
    };
  }

  if (observation.disposition === "no_change") {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "no_change",
        domain: DOMAIN_TO_LEGAL[observation.domain],
        reason: "Already known — no mutation.",
      },
    };
  }

  if (observation.disposition === "ambiguous") {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "needs_you",
        domain: DOMAIN_TO_LEGAL[observation.domain],
        reason:
          observation.commentary?.trim() ||
          "Lume cannot safely choose between competing interpretations.",
      },
    };
  }

  const kind = DOMAIN_TO_KIND[observation.domain];
  if (!kind) {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "needs_you",
        domain: "unsupported",
        reason: "Unknown observation domain — no write.",
      },
    };
  }

  if (observation.disposition === "update_existing" && !observation.candidateTargetId) {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "needs_you",
        domain: DOMAIN_TO_LEGAL[observation.domain],
        reason: "Update requires a valid existing identity.",
      },
    };
  }

  const identityGate = personCreateIdentityGate(observation, args.world, projectId);
  if (identityGate) {
    return { observation, suggestion: null, decision: identityGate };
  }

  const op = operationFor(observation);
  const suggestion = suggestionFromObservation(observation, {
    kind,
    op,
    projectId,
  });
  suggestion.expectedTarget = fingerprintExpectedTarget(args.world, suggestion);

  const decision = planCaptureApply({
    item: suggestion,
    text: observation.statement,
    world: args.world,
    captureEntryProjectId: args.captureEntryProjectId,
  });

  return { observation, suggestion, decision };
}

function operationFor(observation: CaptureObservationV2): SuggestionOp {
  if (observation.disposition === "create_new") return "create";
  const proposed = observation.proposedValues ?? {};
  const status = String(proposed.status ?? proposed.proposedStatus ?? "").toLowerCase();
  if (status === "resolved" || status === "complete" || status === "completed") {
    return "complete";
  }
  return "update";
}

function suggestionFromObservation(
  observation: CaptureObservationV2,
  args: {
    kind: SuggestionKind;
    op: SuggestionOp;
    projectId: string | null;
  },
): PendingSuggestion {
  const values = { ...(observation.proposedValues ?? {}) };
  const date =
    asIso(values.date) ||
    asIso(values.startAt) ||
    asIso(values.awayFromIso);
  const ownership = values.ownershipSemantics;
  const scope =
    typeof values.scope === "string"
      ? values.scope
      : observation.domain === "responsibility"
        ? observation.candidateTargetTitle
        : undefined;

  return {
    id: `v2-${observation.id}`,
    kind: args.kind,
    op: args.op,
    content: observation.statement,
    destination: "project",
    projectId: args.projectId,
    date: date ?? undefined,
    legalDomain: DOMAIN_TO_LEGAL[observation.domain],
    targetEntityId: observation.candidateTargetId ?? undefined,
    targetTodoId:
      observation.domain === "todo"
        ? observation.candidateTargetId ?? undefined
        : undefined,
    personId:
      observation.domain === "person" ||
      observation.domain === "availability" ||
      observation.domain === "responsibility"
        ? observation.candidateTargetId ?? undefined
        : undefined,
    personName:
      asString(values.name) ||
      (observation.domain === "person" || observation.domain === "availability"
        ? observation.candidateTargetTitle ?? undefined
        : undefined),
    ownershipSemantics:
      ownership === "share" ||
      ownership === "replace" ||
      ownership === "continue" ||
      ownership === "ambiguous"
        ? ownership
        : observation.disposition === "ambiguous"
          ? "ambiguous"
          : undefined,
    responsibilityScope: typeof scope === "string" ? scope : undefined,
    proposedValues: {
      ...values,
      evidence: observation.evidence,
    },
  };
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Uses Lume's existing exact-name identity authority (`namesMatchExact`).
 * Incomplete single-token names in a populated project fail closed to Needs you.
 */
function personCreateIdentityGate(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
): CaptureApplyDecision | null {
  if (observation.domain !== "person" || observation.disposition !== "create_new") {
    return null;
  }
  const name =
    asString(observation.proposedValues?.name) ||
    observation.candidateTargetTitle?.trim() ||
    "";
  if (!name) {
    return {
      kind: "needs_you",
      domain: "person",
      reason: "A new person needs a name before Lume will write a stakeholder.",
    };
  }
  const project = projectId
    ? world.projects.find((p) => p.id === projectId)
    : undefined;
  const people = project?.stakeholders ?? [];
  if (people.some((p) => namesMatchExact(p.name, name))) {
    return {
      kind: "no_change",
      domain: "person",
      reason: `${name} is already on this project.`,
    };
  }
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 && people.length > 0) {
    return {
      kind: "needs_you",
      domain: "person",
      reason:
        "This name is not a confirmed existing Person identity, so Lume will not create a stakeholder.",
    };
  }
  return null;
}
