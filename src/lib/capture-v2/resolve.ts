import {
  planCaptureApply,
  type CaptureApplyDecision,
  type CaptureApplyWorld,
  type CaptureLegalDomain,
} from "@/lib/capture/apply";
import { fingerprintExpectedTarget } from "@/lib/capture/apply/expected-target";
import type { PendingSuggestion, SuggestionKind, SuggestionOp } from "@/lib/capture/suggestions";
import {
  namesMatchExact,
  peopleEvidencedByRecordedNameInText,
  recordedPersonNameAppearsInText,
} from "@/lib/people/identity";
import { missingReadySemantics, newReviewOperationId } from "./contract";
import {
  isTruthIntent,
  type CaptureObservationV2,
  type ObservationDomain,
} from "./types";

const PERSON_LINKED_DOMAINS = new Set<ObservationDomain>([
  "person",
  "availability",
  "responsibility",
]);

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

  if (!isTruthIntent(observation.truthIntent)) {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "needs_you",
        domain: DOMAIN_TO_LEGAL[observation.domain],
        reason:
          "It is unclear whether this should change current project truth.",
      },
    };
  }

  if (observation.truthIntent === "non_current") {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "no_change",
        domain: DOMAIN_TO_LEGAL[observation.domain],
        reason: "Not asserting current project truth — no mutation.",
      },
    };
  }

  if (observation.truthIntent === "uncertain") {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "needs_you",
        domain: DOMAIN_TO_LEGAL[observation.domain],
        reason:
          observation.commentary?.trim() ||
          "It is unclear whether this should change current project truth.",
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

  const readyGap = missingReadySemantics(observation);
  if (readyGap) {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "needs_you",
        domain: DOMAIN_TO_LEGAL[observation.domain],
        reason: readyGap,
      },
    };
  }

  const identityGate = personLinkedIdentityGate(
    observation,
    args.world,
    projectId,
    args.transcript,
  );
  if (identityGate?.kind === "block") {
    return { observation, suggestion: null, decision: identityGate.decision };
  }

  const op = operationFor(observation);
  const suggestion = suggestionFromObservation(observation, {
    kind,
    op,
    projectId,
  });
  if (identityGate?.kind === "bound") {
    suggestion.personId = identityGate.person.id;
    suggestion.personName = identityGate.person.name;
    suggestion.targetEntityId = identityGate.person.id;
  }
  suggestion.expectedTarget = fingerprintExpectedTarget(args.world, suggestion);

  // Plan against the reviewed atomic statement, not the full transcript.
  // Apply must consume the same reviewed fields — transcript is evidence only.
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
    id: newReviewOperationId(),
    modelObservationId: observation.id,
    kind: args.kind,
    op: args.op,
    content:
      asString(values.title) ||
      asString(values.label) ||
      asString(values.name) ||
      observation.statement,
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
      asString(values.personName) ||
      asString(values.name) ||
      (observation.domain === "person" ||
      observation.domain === "availability" ||
      observation.domain === "responsibility"
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
      modelObservationId: observation.id,
    },
    truthIntent: observation.truthIntent,
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

function identityEvidenceText(
  observation: CaptureObservationV2,
  transcript: string,
): string {
  // Capture text the user supplied, plus the observation's verbatim evidence
  // quote. The model statement is not identity proof — it can echo a UUID's
  // recorded name that the transcript never established.
  return [transcript, observation.evidence]
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n");
}

function uncertainPersonIdentity(
  domain: CaptureLegalDomain,
  reason: string,
): CaptureApplyDecision {
  return { kind: "needs_you", domain, reason };
}

/**
 * Person-linked identity certainty.
 *
 * A model-supplied Person UUID is evidence of model intent, not proof of
 * identity. Binding requires the Capture text to contain the recorded full
 * name (existing exact-name authority). Incomplete / competing references
 * are Needs you. Not a first-name heuristic. Not a second identity engine.
 */
type PersonIdentityGate =
  | { kind: "block"; decision: CaptureApplyDecision }
  | { kind: "bound"; person: { id: string; name: string } };

function personLinkedIdentityGate(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
  transcript: string,
): PersonIdentityGate | null {
  if (!PERSON_LINKED_DOMAINS.has(observation.domain)) {
    return null;
  }

  const legal = DOMAIN_TO_LEGAL[observation.domain];
  const project = projectId
    ? world.projects.find((p) => p.id === projectId)
    : undefined;
  const people = project?.stakeholders ?? [];
  const text = identityEvidenceText(observation, transcript);
  const uncertain = (reason: string): PersonIdentityGate => ({
    kind: "block",
    decision: uncertainPersonIdentity(legal, reason),
  });

  if (observation.domain === "person" && observation.disposition === "create_new") {
    const name =
      asString(observation.proposedValues?.name) ||
      observation.candidateTargetTitle?.trim() ||
      "";
    if (!name) {
      return uncertain(
        "A new person needs a name before Lume will write a stakeholder.",
      );
    }
    if (people.some((p) => namesMatchExact(p.name, name))) {
      return {
        kind: "block",
        decision: {
          kind: "no_change",
          domain: "person",
          reason: `${name} is already on this project.`,
        },
      };
    }
    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length < 2 && people.length > 0) {
      return uncertain(
        "This name is not a confirmed existing Person identity, so Lume will not create a stakeholder.",
      );
    }
    if (tokens.length >= 2 && !recordedPersonNameAppearsInText(text, name)) {
      return uncertain(
        "This Person identity is not established in the Capture, so Lume will not create a stakeholder.",
      );
    }
    return null;
  }

  const evidenced = peopleEvidencedByRecordedNameInText(people, text);
  const candidateId = observation.candidateTargetId?.trim() || "";

  if (candidateId) {
    const byId = people.find((p) => p.id === candidateId);
    if (!byId) {
      return uncertain(
        "This person is not on this project. Lume will not write.",
      );
    }
    const sameName = people.filter((p) => namesMatchExact(p.name, byId.name));
    if (sameName.length > 1) {
      return uncertain(
        "More than one existing person matches this Capture. Choose who it refers to.",
      );
    }
    if (!recordedPersonNameAppearsInText(text, byId.name)) {
      return uncertain(
        "This Person identity is not established in the Capture. A supplied record id is not enough.",
      );
    }
    return { kind: "bound", person: { id: byId.id, name: byId.name } };
  }

  if (evidenced.length > 1) {
    return uncertain(
      "More than one existing person matches this Capture. Choose who it refers to.",
    );
  }
  if (evidenced.length === 1) {
    return {
      kind: "bound",
      person: { id: evidenced[0]!.id, name: evidenced[0]!.name },
    };
  }

  return uncertain(
    "This Person identity is not established in the Capture. A supplied record id is not enough.",
  );
}
