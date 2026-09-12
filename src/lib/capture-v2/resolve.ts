import {
  planCaptureApply,
  type CaptureApplyDecision,
  type CaptureApplyWorld,
  type CaptureLegalDomain,
  type CaptureLegalOperation,
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
  const resolved = args.observations.map((observation) =>
    resolveOne(observation, args),
  );
  return applyContradictorySiblingNeedsYou(resolved);
}

function conflictingWritePayload(
  op: CaptureLegalOperation,
): { group: string; payload: string } | null {
  switch (op.type) {
    case "update_risk_status":
      return {
        group: `risk:${op.projectId}:${op.riskId}`,
        payload: `status:${op.status}`,
      };
    case "update_milestone":
      return {
        group: `milestone:${op.projectId}:${op.milestoneId}`,
        payload: `date:${op.startAt ?? ""}|end:${op.endAt ?? ""}|label:${op.label ?? ""}`,
      };
    default:
      return null;
  }
}

/**
 * Same-record sibling writes with incompatible payloads stay Needs You.
 * Independent observations are unchanged. Duplicates of the same payload
 * are not a contradiction.
 */
function applyContradictorySiblingNeedsYou(
  rows: ResolvedObservation[],
): ResolvedObservation[] {
  const groups = new Map<string, { payloads: Set<string>; indexes: number[] }>();
  rows.forEach((row, index) => {
    if (row.decision.kind !== "write") return;
    const ident = conflictingWritePayload(row.decision.operation);
    if (!ident) return;
    const cur = groups.get(ident.group) ?? { payloads: new Set(), indexes: [] };
    cur.payloads.add(ident.payload);
    cur.indexes.push(index);
    groups.set(ident.group, cur);
  });

  const blocked = new Set<number>();
  for (const cur of groups.values()) {
    if (cur.payloads.size > 1) {
      for (const i of cur.indexes) blocked.add(i);
    }
  }
  if (blocked.size === 0) return rows;

  return rows.map((row, index) => {
    if (!blocked.has(index)) return row;
    return {
      observation: row.observation,
      suggestion: null,
      decision: {
        kind: "needs_you",
        domain: row.decision.domain,
        reason:
          "This Capture contains contradictory updates to the same record. Choose which is current.",
      },
    };
  });
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
    const rematerialized = rematerializeIndependentDatedCreate(
      observation,
      args.world,
      projectId,
    );
    if (rematerialized !== observation) {
      return resolveOne(rematerialized, args);
    }
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
    if (PERSON_LINKED_DOMAINS.has(observation.domain)) {
      const ownership = observation.proposedValues?.ownershipSemantics;
      if (ownership === "ambiguous") {
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
      const identityGate = personLinkedIdentityGate(
        observation,
        args.world,
        projectId,
        args.transcript,
      );
      if (identityGate?.kind === "block" && identityGate.decision.kind === "needs_you") {
        return { observation, suggestion: null, decision: identityGate.decision };
      }
    }
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
    const rematerialized = rematerializeIndependentDatedCreate(
      observation,
      args.world,
      projectId,
    );
    if (rematerialized !== observation) {
      return resolveOne(rematerialized, args);
    }
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

  const entityIdentity = scopedEntityIdentityGate(
    observation,
    args.world,
    projectId,
    args.transcript,
  );
  if (entityIdentity) {
    return { observation, suggestion: null, decision: entityIdentity };
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

function uniqueTitledRecord(
  world: CaptureApplyWorld,
  projectId: string | null,
  domain: ObservationDomain,
  title: string,
): { id: string; title: string } | null {
  const needle = title.trim().toLowerCase();
  if (!needle) return null;
  if (domain === "todo") {
    const hits = world.todos.filter(
      (todo) =>
        (!projectId || !todo.projectId || todo.projectId === projectId) &&
        !todo.done &&
        todo.title.trim().toLowerCase() === needle,
    );
    return hits.length === 1 ? { id: hits[0]!.id, title: hits[0]!.title } : null;
  }
  if (domain === "milestone") {
    const hits = world.timeline.filter(
      (item) =>
        (!projectId || item.projectId === projectId) &&
        item.label.trim().toLowerCase() === needle,
    );
    return hits.length === 1 ? { id: hits[0]!.id, title: hits[0]!.label } : null;
  }
  if (domain === "risk") {
    const hits = world.risks.filter(
      (risk) =>
        (!projectId || risk.projectId === projectId) &&
        risk.title.trim().toLowerCase() === needle,
    );
    return hits.length === 1 ? { id: hits[0]!.id, title: hits[0]!.title } : null;
  }
  return null;
}

function rematerializeTitle(observation: CaptureObservationV2): string | undefined {
  const values = observation.proposedValues ?? {};
  return (
    asString(values.title) ||
    asString(values.label) ||
    observation.candidateTargetTitle?.trim() ||
    undefined
  );
}

function isResolveOrComplete(observation: CaptureObservationV2): boolean {
  const values = observation.proposedValues ?? {};
  const status = String(values.status ?? values.proposedStatus ?? "").toLowerCase();
  return status === "resolved" || status === "complete" || status === "completed";
}

/**
 * A titled To Do / milestone / risk is independently actionable when no
 * in-project record matches. Model uncertainty or a missing target id must
 * not hide a legal create. A unique title match becomes an update only when
 * truthIntent is already current. Resolve/complete of a missing row stays
 * fail-closed — never substitute a different same-domain entity.
 */
function rematerializeIndependentDatedCreate(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
): CaptureObservationV2 {
  if (
    observation.domain !== "todo" &&
    observation.domain !== "milestone" &&
    observation.domain !== "risk"
  ) {
    return observation;
  }
  const title = rematerializeTitle(observation);
  const date = asIso(observation.proposedValues?.date) ||
    asIso(observation.proposedValues?.startAt) ||
    asIso(observation.proposedValues?.dueAt);
  if (!title) return observation;
  if (observation.domain === "milestone" && !date) return observation;
  if (isResolveOrComplete(observation)) return observation;

  const match = uniqueTitledRecord(world, projectId, observation.domain, title);

  if (observation.candidateTargetId) {
    if (
      observation.disposition === "create_new" &&
      observation.truthIntent === "uncertain"
    ) {
      return {
        ...observation,
        truthIntent: "current",
        candidateTargetId: null,
        candidateTargetTitle: title,
      };
    }
    return observation;
  }

  if (match) {
    if (observation.truthIntent === "uncertain") return observation;
    if (observation.disposition === "update_existing") {
      return {
        ...observation,
        candidateTargetId: match.id,
        candidateTargetTitle: match.title,
      };
    }
    return observation;
  }

  if (
    observation.disposition === "create_new" ||
    observation.disposition === "update_existing"
  ) {
    return {
      ...observation,
      disposition: "create_new",
      truthIntent: "current",
      candidateTargetId: null,
      candidateTargetTitle: title,
    };
  }
  return observation;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Recorded title as a whole phrase in observation-local evidence. Exact phrase only. */
function recordedTitleAppearsInText(text: string, recordedTitle: string): boolean {
  const title = recordedTitle.trim().replace(/\s+/g, " ");
  if (!title || !text.trim()) return false;
  const re = new RegExp(`\\b${escapeRegExp(title)}\\b`, "i");
  return re.test(text);
}

const TITLE_EVIDENCE_STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "to",
  "for",
  "on",
  "in",
  "at",
  "is",
  "risk",
  "detail",
  "outstanding",
]);

function recordedTitleEvidencedInText(text: string, recordedTitle: string): boolean {
  if (recordedTitleAppearsInText(text, recordedTitle)) return true;
  const words = recordedTitle
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word && !TITLE_EVIDENCE_STOP.has(word));
  if (words.length === 0) return false;
  const hay = text.toLowerCase();
  const hits = words.filter((word) => hay.includes(word));
  return hits.length >= Math.min(2, words.length);
}

function findScopedEntity(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
  id: string,
): { id: string; title: string } | null {
  if (observation.domain === "risk") {
    const hit = world.risks.find(
      (risk) => risk.id === id && (!projectId || risk.projectId === projectId),
    );
    return hit ? { id: hit.id, title: hit.title } : null;
  }
  if (observation.domain === "todo") {
    const hit = world.todos.find(
      (todo) => todo.id === id && (!projectId || !todo.projectId || todo.projectId === projectId),
    );
    return hit ? { id: hit.id, title: hit.title } : null;
  }
  if (observation.domain === "milestone") {
    const hit = world.timeline.find(
      (item) => item.id === id && (!projectId || item.projectId === projectId),
    );
    return hit ? { id: hit.id, title: hit.label } : null;
  }
  return null;
}

/**
 * Model-supplied Risk / To Do / milestone UUIDs are not identity.
 * Observation-local quoted evidence must contain the recorded title.
 * Otherwise fail closed — never substitute an unrelated same-domain row.
 */
function titlesCompatible(proposed: string, recorded: string): boolean {
  const a = proposed.trim().replace(/\s+/g, " ").toLowerCase();
  const b = recorded.trim().replace(/\s+/g, " ").toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function scopedEntityIdentityGate(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
  transcript: string,
): CaptureApplyDecision | null {
  if (
    observation.domain !== "risk" &&
    observation.domain !== "todo" &&
    observation.domain !== "milestone"
  ) {
    return null;
  }
  const id = observation.candidateTargetId?.trim();
  if (!id) return null;
  const entity = findScopedEntity(observation, world, projectId, id);
  if (!entity) return null;
  const values = observation.proposedValues ?? {};
  const proposedTitle = asString(values.title) || asString(values.label);
  if (proposedTitle && !titlesCompatible(proposedTitle, entity.title)) {
    return {
      kind: "needs_you",
      domain: DOMAIN_TO_LEGAL[observation.domain],
      reason:
        "This does not identify that existing record. Lume will not apply the change to a different item.",
    };
  }
  if (!isResolveOrComplete(observation)) return null;
  const evidence = identityEvidenceText(observation, transcript);
  if (recordedTitleEvidencedInText(evidence, entity.title)) return null;
  return {
    kind: "needs_you",
    domain: DOMAIN_TO_LEGAL[observation.domain],
    reason:
      "This does not identify that existing record. Lume will not apply the change to a different item.",
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

function evidenceQuotedInCapture(transcript: string, evidence: string): boolean {
  const source = transcript.replace(/\s+/g, " ").trim().toLowerCase();
  const quote = evidence.replace(/\s+/g, " ").trim().toLowerCase();
  if (!source || !quote) return false;
  if (source.includes(quote)) return true;
  const loosened = quote.replace(/[.,;:!?]+$/g, "").trim();
  return Boolean(loosened && source.includes(loosened));
}

function identityEvidenceText(
  observation: CaptureObservationV2,
  transcript: string,
): string {
  // Observation-local quote only. The whole Capture must not contribute
  // sibling names (D-051 / convergence cross-observation contamination).
  // The model statement is not identity proof — it can echo a UUID's
  // recorded name that the transcript never established.
  // If evidence is missing or not a quote from the user Capture, fail closed
  // (empty) rather than scanning the rest of the paste.
  const evidence =
    typeof observation.evidence === "string" ? observation.evidence.trim() : "";
  if (!evidence) return "";
  if (evidenceQuotedInCapture(transcript, evidence)) return evidence;
  return "";
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
    if (!recordedPersonNameAppearsInText(text, name)) {
      return uncertain(
        "This Person identity is not established in the Capture, so Lume will not create a stakeholder.",
      );
    }
    if (tokens.length < 2 && people.length > 0) {
      const first = tokens[0]!.toLowerCase();
      const firstMatches = people.filter((person) => {
        const recordedFirst = person.name.trim().split(/\s+/)[0]?.toLowerCase();
        return recordedFirst === first;
      });
      if (firstMatches.length > 0) {
        return uncertain(
          "This name is not a confirmed existing Person identity, so Lume will not create a stakeholder.",
        );
      }
      // No existing first-name collision: a name-only Person is complete.
      return null;
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
