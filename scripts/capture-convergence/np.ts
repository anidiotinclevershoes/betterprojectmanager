/**
 * New Project adapter path — extract then diverges. Not Capture resolve/plan.
 */

import {
  draftFromProvisional,
  parseNewProjectV2Envelope,
} from "../../src/lib/new-project-v2";
import { mergeOrganisedDraft } from "../../src/lib/new-project/merge-organised";
import { needsYouFromDraft } from "../../src/lib/new-project/needs-you";
import type { CreateProjectInput } from "../../src/lib/create-project";
import type { SemanticAtom, SemanticSnapshot, StageTrace } from "./types";

function emptyCompose(): CreateProjectInput {
  return {
    name: "Aurora Migration",
    code: "AM",
    summary: "",
    kind: "delivery",
    currentFocus: "",
    sourceMode: "paste",
    stakeholders: [],
  };
}

export type NpRun = {
  needsYouCount: number;
  responsibilitiesByName: Record<string, string[]>;
  names: string[];
  envelopeMalformed: boolean;
  snapshot: SemanticSnapshot;
  trace: StageTrace;
};

export function runNewProjectAdapter(args: {
  transcript: string;
  rawModelJson: unknown;
}): NpRun {
  const parsed = parseNewProjectV2Envelope(args.rawModelJson);
  const draft = draftFromProvisional({
    sourceNarrative: args.transcript,
    sourceMode: "paste",
    project: parsed.project,
    items: parsed.items,
  });
  const merged = mergeOrganisedDraft(emptyCompose(), draft);
  const questions = needsYouFromDraft(merged);
  const responsibilitiesByName: Record<string, string[]> = {};
  const atoms: SemanticAtom[] = [];
  for (const person of merged.stakeholders ?? []) {
    const name = person.name ?? "";
    const scopes = [...(person.responsibilities ?? [])];
    if (name) responsibilitiesByName[name] = scopes;
    atoms.push({
      observationId: person.clientKey ?? name,
      domain: "person",
      disposition: person.needsReview ? "ambiguous" : "create_new",
      truthIntent: "current",
      decisionKind: person.needsReview ? "needs_you" : "write",
      writeType: "create_person",
      legalDomain: "person",
      targetId: null,
      personName: name || null,
      scope: scopes.join("|") || null,
      date: null,
      rejected: false,
      reviewReadiness: person.needsReview ? "needs_review" : "ready",
      reasonClass: person.needsReview ? "needs_you_missing_scope" : "write",
    });
  }
  return {
    needsYouCount: questions.length,
    responsibilitiesByName,
    names: (merged.stakeholders ?? []).map((s) => s.name ?? ""),
    envelopeMalformed: parsed.envelopeMalformed,
    snapshot: {
      atoms,
      rejectedCodes: parsed.envelopeMalformed ? ["malformed"] : [],
      parseMalformed: parsed.envelopeMalformed,
    },
    trace: {
      parseMalformed: parsed.envelopeMalformed,
      parseIssueCodes: parsed.envelopeMalformed ? ["malformed"] : [],
      keptIds: atoms.map((a) => a.observationId),
      rejectedIds: [],
      rejectedCodes: [],
      preserved: atoms.map((a) => ({
        id: a.observationId,
        statement: true,
        evidence: true,
        name: Boolean(a.personName),
        scope: Boolean(a.scope),
        date: true,
      })),
      identity: atoms.map((a) => ({
        id: a.observationId,
        targetId: null,
        personName: a.personName,
        bound: Boolean(a.personName),
      })),
      plan: atoms.map((a) => ({
        id: a.observationId,
        kind: a.decisionKind,
        writeType: a.writeType,
        reason: null,
      })),
      review: atoms.map((a) => ({
        id: a.observationId,
        readiness: a.reviewReadiness,
      })),
    },
  };
}
