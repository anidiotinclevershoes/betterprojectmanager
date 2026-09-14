import {
  planCaptureApply,
  type CaptureApplyDecision,
  type CaptureApplyWorld,
  type CaptureLegalDomain,
  type CaptureLegalOperation,
} from "@/lib/capture/apply";
import { fingerprintExpectedTarget } from "@/lib/capture/apply/expected-target";
import {
  recordedTitleEvidencedInText,
  titlesCompatible,
} from "@/lib/capture/apply/recorded-title-evidence";
import type { PendingSuggestion, SuggestionKind, SuggestionOp } from "@/lib/capture/suggestions";
import {
  namesMatchExact,
  peopleEvidencedByRecordedNameInText,
  recordedPersonNameAppearsInText,
} from "@/lib/people/identity";
import { scopeFromResponsiblePhrase } from "@/lib/people/responsibility-scope";
import { missingReadySemantics, newReviewOperationId } from "./contract";
import {
  LEFT_UNTOUCHED_GENERIC_REASON,
  LEFT_UNTOUCHED_MODEL_FALLBACK_REASON,
} from "./left-untouched";
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

  if (observation.disposition === "left_untouched") {
    return {
      observation,
      suggestion: null,
      decision: {
        kind: "no_change",
        domain: "unsupported",
        reason:
          observation.commentary?.trim() ||
          LEFT_UNTOUCHED_MODEL_FALLBACK_REASON,
      },
    };
  }

  if (observation.domain === "unknown") {
    const reason =
      observation.commentary?.trim() || LEFT_UNTOUCHED_GENERIC_REASON;
    return {
      observation: {
        ...observation,
        disposition: "left_untouched",
        commentary: reason,
      },
      suggestion: null,
      decision: {
        kind: "no_change",
        domain: "unsupported",
        reason,
      },
    };
  }

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
    const hydrated = hydrateFromLocalEvidence(
      observation,
      args.world,
      projectId,
      args.transcript,
    );
    const rematerialized = rematerializeTrustedNoChange(
      hydrated,
      args.world,
      projectId,
      args.transcript,
    );
    if (rematerialized !== hydrated) {
      return resolveOne(rematerialized, args);
    }
    if (PERSON_LINKED_DOMAINS.has(hydrated.domain)) {
      const ownership = hydrated.proposedValues?.ownershipSemantics;
      if (ownership === "ambiguous") {
        return {
          observation: hydrated,
          suggestion: null,
          decision: {
            kind: "needs_you",
            domain: DOMAIN_TO_LEGAL[hydrated.domain],
            reason:
              hydrated.commentary?.trim() ||
              "Lume cannot safely choose between competing interpretations.",
          },
        };
      }
      const identityGate = personLinkedIdentityGate(
        hydrated,
        args.world,
        projectId,
        args.transcript,
      );
      if (identityGate?.kind === "block" && identityGate.decision.kind === "needs_you") {
        return { observation: hydrated, suggestion: null, decision: identityGate.decision };
      }
    }
    if (
      isProvenAlreadyCurrent(hydrated, args.world, projectId, args.transcript)
    ) {
      return {
        observation: hydrated,
        suggestion: null,
        decision: {
          kind: "no_change",
          domain: DOMAIN_TO_LEGAL[hydrated.domain],
          reason: "Already known — no mutation.",
        },
      };
    }
    return {
      observation: hydrated,
      suggestion: null,
      decision: {
        kind: "needs_you",
        domain: DOMAIN_TO_LEGAL[hydrated.domain],
        reason: unexplainedCurrentNoChangeReason(hydrated),
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

  const ownershipAsResponsibility = rematerializeOwnershipAsResponsibility(
    observation,
    args.world,
    projectId,
  );
  if (ownershipAsResponsibility !== observation) {
    return resolveOne(ownershipAsResponsibility, args);
  }

  const kind = DOMAIN_TO_KIND[observation.domain];
  if (!kind) {
    const reason =
      observation.commentary?.trim() || LEFT_UNTOUCHED_GENERIC_REASON;
    return {
      observation: {
        ...observation,
        disposition: "left_untouched",
        commentary: reason,
      },
      suggestion: null,
      decision: {
        kind: "no_change",
        domain: "unsupported",
        reason,
      },
    };
  }

  if (
    observation.disposition === "update_existing" ||
    observation.disposition === "create_new"
  ) {
    const rematerialized = rematerializeIndependentDatedCreate(
      observation,
      args.world,
      projectId,
    );
    if (rematerialized !== observation) {
      return resolveOne(rematerialized, args);
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

/**
 * A Person observation that states explicit ownership is a responsibility
 * write, not a new stakeholder. Role-only lines ("is the QS") stay Person.
 */
function rematerializeOwnershipAsResponsibility(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
): CaptureObservationV2 {
  if (observation.domain !== "person") return observation;
  const values = observation.proposedValues ?? {};
  const name =
    asString(values.personName) ||
    asString(values.name) ||
    observation.candidateTargetTitle?.trim() ||
    "";
  const scope =
    asString(values.scope) || scopeFromResponsiblePhrase(observation.statement);
  if (!name || !scope || namesMatchExact(name, scope)) return observation;
  if (
    !asString(values.scope) &&
    !/\b(responsible for|owns|will own)\b/i.test(observation.statement)
  ) {
    return observation;
  }
  // Existing person: ownership is a responsibility write, not a duplicate
  // stakeholder. New named person: same canonical confirm_responsibility
  // path — Apply ensures the person. Role-only lines never reach here.
  const ownership = values.ownershipSemantics;
  return {
    ...observation,
    domain: "responsibility",
    disposition:
      observation.disposition === "no_change"
        ? "create_new"
        : observation.disposition,
    truthIntent: "current",
    proposedValues: {
      ...values,
      personName: name,
      name,
      scope,
      ownershipSemantics:
        ownership === "share" ||
        ownership === "replace" ||
        ownership === "continue" ||
        ownership === "ambiguous"
          ? ownership
          : "share",
    },
  };
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
const MONTH_TO_ISO: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

const NAME_EXTRACT_STOP = new Set([
  "add",
  "create",
  "update",
  "move",
  "book",
  "send",
  "issue",
  "the",
  "this",
  "that",
  "hall",
  "cafe",
  "site",
  "client",
  "practical",
  "name",
  "from",
  "with",
  "after",
  "before",
  "january",
  "february",
  "march",
  "april",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

function isoDateFromLocalText(text: string): string | null {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso?.[1]) return iso[1];
  const named = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i,
  );
  if (!named) return null;
  const month = MONTH_TO_ISO[named[2]!.toLowerCase()];
  if (!month) return null;
  return `${named[3]}-${month}-${named[1]!.padStart(2, "0")}`;
}

function looksLikeRestatement(text: string): boolean {
  return /\b(remains?|still|continues?|already|unchanged|no change)\b/i.test(text);
}

function looksLikeNewAssignment(text: string): boolean {
  if (looksLikeRestatement(text)) return false;
  return /\b(owns?|owning|will own|is responsible|responsible for|assign(?:ed|s)?)\b/i.test(
    text,
  );
}

function existingEvidencedPerson(
  world: CaptureApplyWorld,
  projectId: string | null,
  evidence: string,
  identity: string | null,
): boolean {
  const project = projectId
    ? world.projects.find((row) => row.id === projectId)
    : undefined;
  const people = project?.stakeholders ?? [];
  const evidenced = peopleEvidencedByRecordedNameInText(people, evidence);
  if (evidenced.length === 1) return true;
  if (!identity) return false;
  const byId = people.find((person) => person.id === identity);
  return Boolean(
    byId && recordedPersonNameAppearsInText(evidence, byId.name),
  );
}

function twoTokenNameFromLocalText(text: string): string | undefined {
  const matches = text.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g) ?? [];
  for (const raw of matches) {
    const [first, second] = raw.split(/\s+/);
    if (!first || !second) continue;
    if (NAME_EXTRACT_STOP.has(first.toLowerCase())) continue;
    if (NAME_EXTRACT_STOP.has(second.toLowerCase())) continue;
    return `${first} ${second}`;
  }
  return undefined;
}

function statusTokenFromLocalText(text: string): string | undefined {
  if (/\b(resolved|complete|completed)\b/i.test(text)) return "resolved";
  if (/\bdone\b/i.test(text)) return "complete";
  return undefined;
}

/**
 * Live Prompt A often marks real updates `no_change` and omits structured
 * fields. Fill missing values from observation-local quoted evidence and
 * canonical world only. The model envelope is not authority.
 */
function hydrateFromLocalEvidence(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
  transcript: string,
): CaptureObservationV2 {
  const evidence = identityEvidenceText(observation, transcript);
  if (!evidence.trim()) return observation;
  const values = { ...(observation.proposedValues ?? {}) };
  let title =
    asString(values.title) ||
    asString(values.label) ||
    observation.candidateTargetTitle?.trim() ||
    "";
  let name =
    asString(values.personName) ||
    asString(values.name) ||
    (observation.domain === "person" || observation.domain === "responsibility"
      ? observation.candidateTargetTitle?.trim() || ""
      : "");
  let scope = asString(values.scope) || "";
  let date = asIso(values.date) || asIso(values.startAt) || asIso(values.dueAt);
  let status = asString(values.status) || asString(values.proposedStatus) || "";

  if (!date) date = isoDateFromLocalText(evidence);
  if (!status && (observation.domain === "risk" || observation.domain === "todo")) {
    status = statusTokenFromLocalText(evidence) ?? "";
  }
  if (!scope) scope = scopeFromResponsiblePhrase(evidence) ?? "";

  if (!title) {
    const hits = uniquelyEvidencedRecords(observation, world, projectId, evidence);
    if (hits.length === 1) title = hits[0]!.title;
  }

  if (
    !name &&
    (observation.domain === "person" ||
      observation.domain === "responsibility" ||
      observation.domain === "availability")
  ) {
    const project = projectId
      ? world.projects.find((row) => row.id === projectId)
      : undefined;
    const evidenced = peopleEvidencedByRecordedNameInText(
      project?.stakeholders ?? [],
      evidence,
    );
    if (evidenced.length === 1) name = evidenced[0]!.name;
    else if (evidenced.length === 0 && observation.domain === "person") {
      name = twoTokenNameFromLocalText(evidence) ?? "";
    }
  }

  const nextTitle = title || observation.candidateTargetTitle || null;
  const changed =
    (title && title !== (observation.candidateTargetTitle ?? "")) ||
    (name && name !== asString(values.personName) && name !== asString(values.name)) ||
    (scope && scope !== asString(values.scope)) ||
    (date && date !== asIso(values.date) && date !== asIso(values.startAt)) ||
    (status && status !== asString(values.status));
  if (!changed) return observation;

  return {
    ...observation,
    candidateTargetTitle: nextTitle,
    proposedValues: {
      ...values,
      ...(title ? { title, label: asString(values.label) || title } : {}),
      ...(name ? { name, personName: name } : {}),
      ...(scope ? { scope } : {}),
      ...(date ? { date, startAt: asIso(values.startAt) || date } : {}),
      ...(status ? { status } : {}),
    },
  };
}

function isProvenAlreadyCurrent(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
  transcript: string,
): boolean {
  const evidence = identityEvidenceText(observation, transcript);
  if (!evidence.trim()) return false;
  const values = observation.proposedValues ?? {};
  const date = asIso(values.date) || asIso(values.startAt) || isoDateFromLocalText(evidence);
  const status = (
    asString(values.status) ||
    asString(values.proposedStatus) ||
    statusTokenFromLocalText(evidence) ||
    ""
  ).toLowerCase();

  if (observation.domain === "milestone") {
    const hits = uniquelyEvidencedRecords(observation, world, projectId, evidence);
    if (hits.length !== 1) return false;
    const row = world.timeline.find((item) => item.id === hits[0]!.id);
    if (!row) return false;
    if (date) return (row.startAt ?? "").slice(0, 10) === date.slice(0, 10);
    return !status;
  }
  if (observation.domain === "risk") {
    const hits = uniquelyEvidencedRecords(observation, world, projectId, evidence);
    if (hits.length !== 1) return false;
    const row = world.risks.find((item) => item.id === hits[0]!.id);
    if (!row) return false;
    if (status === "resolved" || status === "complete" || status === "completed") {
      return row.status === "resolved" || row.status === "accepted";
    }
    return true;
  }
  if (observation.domain === "todo") {
    const hits = uniquelyEvidencedRecords(observation, world, projectId, evidence);
    if (hits.length !== 1) return false;
    const row = world.todos.find((item) => item.id === hits[0]!.id);
    if (!row) return false;
    if (status === "complete" || status === "completed" || status === "resolved") {
      return Boolean(row.done);
    }
    return true;
  }
  if (observation.domain === "person") {
    const project = projectId
      ? world.projects.find((row) => row.id === projectId)
      : undefined;
    const evidenced = peopleEvidencedByRecordedNameInText(
      project?.stakeholders ?? [],
      evidence,
    );
    if (evidenced.length !== 1) return false;
    return !scopeFromResponsiblePhrase(evidence);
  }
  if (observation.domain === "responsibility") {
    if (
      looksLikeRestatement(evidence) &&
      existingEvidencedPerson(
        world,
        projectId,
        evidence,
        observation.candidateTargetId ?? null,
      )
    ) {
      return true;
    }
    const name =
      asString(values.personName) ||
      asString(values.name) ||
      observation.candidateTargetTitle?.trim() ||
      "";
    const scope =
      asString(values.scope) || scopeFromResponsiblePhrase(evidence) || "";
    if (!name || !scope) return false;
    return world.knowledge.some((entry) => {
      if (projectId && entry.projectId !== projectId) return false;
      return (entry.structured ?? []).some((row) => {
        const responsibility = row.meta?.responsibility;
        if (row.kind !== "responsibility" || !responsibility) return false;
        return (
          namesMatchExact(responsibility.personName ?? "", name) &&
          String(responsibility.scope ?? "").trim().toLowerCase() ===
            scope.toLowerCase()
        );
      });
    });
  }
  return false;
}

function unexplainedCurrentNoChangeReason(
  observation: CaptureObservationV2,
): string {
  switch (observation.domain) {
    case "todo":
      return "Lume understood a to-do here, but needs you to confirm whether to add it or update an existing one.";
    case "risk":
      return "Lume understood a risk change here, but needs you to confirm which risk it refers to.";
    case "milestone":
      return "Lume understood a date change here, but needs you to confirm which date to update.";
    case "person":
      return "Lume understood a person here, but needs you to confirm who it refers to.";
    case "responsibility":
      return "Lume understood an ownership change, but needs you to confirm who owns what.";
    default:
      return "Lume understood this, but cannot safely decide what to change without a small confirmation.";
  }
}

/**
 * Model `no_change` is an opinion, not authority. If proposed values
 * disagree with canonical truth and bind safely, rematerialize. If they
 * describe a clear absent entity, rematerialize as Create. Otherwise keep
 * no_change — do not invent a write from the statement alone.
 */
function rematerializeTrustedNoChange(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
  transcript: string,
): CaptureObservationV2 {
  const ownership = rematerializeOwnershipAsResponsibility(
    observation,
    world,
    projectId,
  );
  if (ownership !== observation) return ownership;

  if (observation.domain === "responsibility") {
    const values = observation.proposedValues ?? {};
    const localText = identityEvidenceText(observation, transcript) || observation.statement;
    const name =
      asString(values.personName) ||
      asString(values.name) ||
      observation.candidateTargetTitle?.trim() ||
      "";
    const scope =
      asString(values.scope) || scopeFromResponsiblePhrase(observation.statement);
    if (name && scope && looksLikeNewAssignment(localText)) {
      return {
        ...observation,
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { ...values, personName: name, name, scope },
      };
    }
  }

  const titled = rematerializeIndependentDatedCreate(
    observation,
    world,
    projectId,
  );
  if (titled !== observation) return titled;

  const values = observation.proposedValues ?? {};
  const status = String(values.status ?? values.proposedStatus ?? "").toLowerCase();
  const date = asIso(values.date) || asIso(values.startAt) || asIso(values.dueAt);
  const evidence = identityEvidenceText(observation, transcript);

  if (
    (observation.domain === "risk" || observation.domain === "todo") &&
    (status === "resolved" || status === "complete" || status === "completed")
  ) {
    const hits = uniquelyEvidencedRecords(observation, world, projectId, evidence);
    if (hits.length === 1) {
      const hit = hits[0]!;
      if (observation.domain === "risk") {
        const row = world.risks.find((r) => r.id === hit.id);
        if (row && row.status !== "resolved" && row.status !== "accepted") {
          return {
            ...observation,
            disposition: "update_existing",
            truthIntent: "current",
            candidateTargetId: hit.id,
            candidateTargetTitle: hit.title,
            proposedValues: { ...values, status: "resolved" },
          };
        }
      }
      if (observation.domain === "todo") {
        const row = world.todos.find((t) => t.id === hit.id);
        if (row && !row.done) {
          return {
            ...observation,
            disposition: "update_existing",
            truthIntent: "current",
            candidateTargetId: hit.id,
            candidateTargetTitle: hit.title,
            proposedValues: { ...values, status: "complete" },
          };
        }
      }
    }
    if (hits.length > 1) {
      return {
        ...observation,
        disposition: "ambiguous",
        commentary:
          observation.commentary?.trim() ||
          "More than one existing record matches this Capture. Lume will not guess.",
      };
    }
    return observation;
  }

  if (observation.domain === "milestone" && date) {
    const hits = uniquelyEvidencedRecords(observation, world, projectId, evidence);
    if (hits.length === 1) {
      const row = world.timeline.find((item) => item.id === hits[0]!.id);
      const current = row?.startAt?.slice(0, 10);
      if (row && current && current !== date.slice(0, 10)) {
        return {
          ...observation,
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: row.id,
          candidateTargetTitle: row.label,
          proposedValues: { ...values, date, startAt: date },
        };
      }
    }
    // A no_change date restatement is not a licence to mint a milestone
    // when no evidenced row exists. Uncertain/update_existing Creates
    // still rematerialize through rematerializeIndependentDatedCreate.
  }

  if (observation.domain === "availability") {
    const from = asIso(values.awayFromIso) || asIso(values.date);
    if (from) {
      return {
        ...observation,
        disposition: "create_new",
        truthIntent: "current",
      };
    }
  }

  const title = rematerializeTitle(observation);
  if (
    title &&
    (observation.domain === "todo" || observation.domain === "risk") &&
    !isResolveOrComplete(observation)
  ) {
    const evidenced = uniquelyEvidencedRecords(
      observation,
      world,
      projectId,
      evidence,
    );
    if (evidenced.length === 0 && !uniqueTitledRecord(world, projectId, observation.domain, title)) {
      return {
        ...observation,
        disposition: "create_new",
        truthIntent: "current",
        candidateTargetId: null,
        candidateTargetTitle: title,
      };
    }
  }

  return rematerializeAbsentPerson(observation, world, projectId, transcript);
}

/**
 * Model `no_change` on a named Person is an opinion. A two-token name
 * evidenced in observation-local text, with no exact-name collision, is a
 * legal Create. First-name collisions stay closed (Pippa-class).
 */
function rematerializeAbsentPerson(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
  transcript: string,
): CaptureObservationV2 {
  if (observation.domain !== "person") return observation;
  const values = observation.proposedValues ?? {};
  const name =
    asString(values.name) ||
    asString(values.personName) ||
    observation.candidateTargetTitle?.trim() ||
    "";
  if (!name) return observation;
  const project = projectId
    ? world.projects.find((row) => row.id === projectId)
    : undefined;
  const people = project?.stakeholders ?? [];
  if (people.some((person) => namesMatchExact(person.name, name))) {
    return observation;
  }
  const evidence = identityEvidenceText(observation, transcript);
  if (!recordedPersonNameAppearsInText(evidence, name)) return observation;
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 && people.length > 0) {
    const first = tokens[0]!.toLowerCase();
    const firstMatches = people.filter((person) => {
      const recordedFirst = person.name.trim().split(/\s+/)[0]?.toLowerCase();
      return recordedFirst === first;
    });
    if (firstMatches.length > 0) return observation;
  }
  return {
    ...observation,
    disposition: "create_new",
    truthIntent: "current",
    candidateTargetId: null,
    candidateTargetTitle: name,
    proposedValues: { ...values, name },
  };
}

function uniquelyEvidencedRecords(
  observation: CaptureObservationV2,
  world: CaptureApplyWorld,
  projectId: string | null,
  evidence: string,
): Array<{ id: string; title: string }> {
  if (!evidence.trim()) return [];
  if (observation.domain === "risk") {
    return world.risks
      .filter((risk) => !projectId || risk.projectId === projectId)
      .filter((risk) => recordedTitleEvidencedInText(evidence, risk.title))
      .map((risk) => ({ id: risk.id, title: risk.title }));
  }
  if (observation.domain === "todo") {
    return world.todos
      .filter((todo) => !projectId || !todo.projectId || todo.projectId === projectId)
      .filter((todo) => recordedTitleEvidencedInText(evidence, todo.title))
      .map((todo) => ({ id: todo.id, title: todo.title }));
  }
  if (observation.domain === "milestone") {
    return world.timeline
      .filter((item) => !projectId || item.projectId === projectId)
      .filter((item) => recordedTitleEvidencedInText(evidence, item.label))
      .map((item) => ({ id: item.id, title: item.label }));
  }
  return [];
}

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
  const boundId = observation.candidateTargetId?.trim();
  const bound = boundId
    ? findScopedEntity(observation, world, projectId, boundId)
    : null;
  const proposedTitle = rematerializeTitle(observation);
  const boundTitleCompatible =
    !bound ||
    !proposedTitle ||
    titlesCompatible(proposedTitle, bound.title) ||
    recordedTitleEvidencedInText(
      identityEvidenceText(observation, observation.statement),
      bound.title,
    );

  if (boundId) {
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
    // A model UUID is not identity. Wrong-type / missing / title-incompatible
    // ids must not block a clear titled Create. Resolve/complete stays
    // fail-closed — never substitute a different same-domain row.
    if (!isResolveOrComplete(observation) && (!bound || !boundTitleCompatible)) {
      if (match) {
        return {
          ...observation,
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: match.id,
          candidateTargetTitle: match.title,
        };
      }
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

  if (observation.disposition === "create_new" && !boundId) {
    if (observation.truthIntent === "uncertain") {
      return {
        ...observation,
        truthIntent: "current",
        candidateTargetTitle: title,
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
    if (byId) {
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
    // Wrong-type or unknown id is not proof the person is absent.
    // Fall through to evidenced-name bind. Do not write to a substitute.
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

  if (observation.domain === "responsibility") {
    const name =
      asString(observation.proposedValues?.personName) ||
      asString(observation.proposedValues?.name) ||
      observation.candidateTargetTitle?.trim() ||
      "";
    const tokens = name.split(/\s+/).filter(Boolean);
    if (
      tokens.length >= 2 &&
      recordedPersonNameAppearsInText(text, name) &&
      !people.some((person) => namesMatchExact(person.name, name))
    ) {
      return null;
    }
  }

  return uncertain(
    "This Person identity is not established in the Capture. A supplied record id is not enough.",
  );
}
