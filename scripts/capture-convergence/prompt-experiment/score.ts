/**
 * Holdout scoring for the prompt experiment. See SCORING.md.
 * Does not change production Capture behaviour.
 */
import { asUsableString } from "../../../src/lib/capture-v2/contract";
import type { ObservationContextRecord } from "../../../src/lib/capture-v2/types";
import { observationsOf } from "../obs";
import type { SemanticSnapshot } from "../types";
import type { HoldoutExpected } from "./holdout";

const KNOWN_PEOPLE = [
  "Pippa Gumdrop",
  "Fizz Caramel",
  "Captain Buttons",
  "Brick Oakley",
  "Pixel Ramos",
  "Olga Petrov",
  "Sarah Kim",
  "Nova Quill",
  "Remy Volt",
  "Velvet Sprocket",
  "Jordan Hale",
];

const PRONOUN = /\b(they|she|he|them|her|him)\b/i;

export type HoldoutCaseScore = {
  recallHits: number;
  recallPossible: number;
  inventions: number;
  foreignId: number;
  identityContamination: number;
  wrongAttachment: number;
  unsafePronounResolution: number;
  ambiguityPreserved: boolean | null;
  createSuitable: boolean | null;
  updateSuitable: boolean | null;
  contradictionPreserved: boolean | null;
  nameOnlySurvived: boolean | null;
  writes: number;
  needsYou: number;
  noChange: number;
  rejected: number;
  observationCount: number;
  parseMalformed: boolean;
};

function blobOf(raw: unknown): string {
  return JSON.stringify(raw ?? {}).toLowerCase();
}

function mentionedPeople(transcript: string): string[] {
  const lower = transcript.toLowerCase();
  return KNOWN_PEOPLE.filter((name) => lower.includes(name.toLowerCase()));
}

function obsName(row: ReturnType<typeof observationsOf>[number]): string | null {
  const values = row.proposedValues ?? {};
  return (
    asUsableString(values.name) ||
    asUsableString(values.personName) ||
    asUsableString(row.candidateTargetTitle)
  );
}

function evidenceQuote(row: ReturnType<typeof observationsOf>[number]): string {
  return (row.evidence ?? "").toLowerCase();
}

function includesName(haystack: string, name: string): boolean {
  return haystack.toLowerCase().includes(name.toLowerCase());
}

export function scoreHoldoutCase(args: {
  holdout: HoldoutExpected;
  transcript: string;
  raw: unknown;
  snapshot: SemanticSnapshot;
  records: ObservationContextRecord[];
  projectId: string;
}): HoldoutCaseScore {
  const rows = observationsOf(args.raw);
  const blob = blobOf(args.raw);
  const transcriptLower = args.transcript.toLowerCase();
  const validIds = new Set(args.records.map((row) => row.id));
  validIds.add(args.projectId);
  const byId = new Map(args.records.map((row) => [row.id, row]));
  const mentioned = mentionedPeople(args.transcript);

  let recallHits = 0;
  for (const needle of args.holdout.mustRecall) {
    if (blob.includes(needle.toLowerCase())) recallHits += 1;
  }

  let inventions = 0;
  for (const needle of args.holdout.mustNotInvent) {
    if (
      needle &&
      blob.includes(needle.toLowerCase()) &&
      !transcriptLower.includes(needle.toLowerCase())
    ) {
      inventions += 1;
    }
  }

  let foreignId = 0;
  for (const row of rows) {
    const id = typeof row.candidateTargetId === "string" ? row.candidateTargetId.trim() : "";
    if (id && !validIds.has(id)) foreignId += 1;
  }
  const validatedForeign = args.snapshot.rejectedCodes.filter((code) => code === "foreign_id").length;
  foreignId = Math.max(foreignId, validatedForeign);

  let identityContamination = 0;
  let unsafePronounResolution = 0;
  for (const row of rows) {
    const bound = obsName(row);
    if (!bound) continue;
    const evidence = evidenceQuote(row);
    const boundKnown = mentioned.find(
      (name) =>
        bound.toLowerCase() === name.toLowerCase() || includesName(bound, name),
    );
    if (!boundKnown) continue;
    if (evidence && includesName(evidence, boundKnown)) continue;
    const otherInEvidence = mentioned.some(
      (name) => name !== boundKnown && includesName(evidence, name),
    );
    if (otherInEvidence) {
      identityContamination += 1;
      continue;
    }
    if (PRONOUN.test(evidence)) {
      unsafePronounResolution += 1;
      continue;
    }
    if (mentioned.length > 1) identityContamination += 1;
  }

  let wrongAttachment = 0;
  for (const row of rows) {
    const id = typeof row.candidateTargetId === "string" ? row.candidateTargetId.trim() : "";
    if (!id) continue;
    const record = byId.get(id);
    if (!record) continue;
    const evidence = evidenceQuote(row);
    if (record.entityType === "person") {
      const other = mentioned.find(
        (name) =>
          name.toLowerCase() !== record.title.toLowerCase() &&
          includesName(evidence, name) &&
          !includesName(evidence, record.title),
      );
      if (other) wrongAttachment += 1;
    }
    if (row.domain === "person" && record.entityType !== "person") wrongAttachment += 1;
    if (row.domain === "milestone" && record.entityType !== "milestone") wrongAttachment += 1;
    if (row.domain === "risk" && record.entityType !== "risk") wrongAttachment += 1;
    if (row.domain === "todo" && record.entityType !== "todo") wrongAttachment += 1;
  }

  const needsYou = args.snapshot.atoms.filter((atom) => atom.decisionKind === "needs_you").length;
  const writes = args.snapshot.atoms.filter((atom) => atom.decisionKind === "write").length;
  const noChange = args.snapshot.atoms.filter((atom) => atom.decisionKind === "no_change").length;
  const rejected = args.snapshot.atoms.filter((atom) => atom.decisionKind === "rejected").length;

  let ambiguityPreserved: boolean | null = null;
  if ((args.holdout.mustPreserveAmbiguity ?? []).length) {
    const pronounWrite = args.snapshot.atoms.some((atom) => {
      if (atom.decisionKind !== "write") return false;
      const name = (atom.personName ?? "").toLowerCase();
      return mentioned.some((person) => name.includes(person.toLowerCase()));
    });
    ambiguityPreserved = needsYou > 0 && !pronounWrite ? true : needsYou > 0;
    if (unsafePronounResolution > 0) ambiguityPreserved = false;
  }

  let createSuitable: boolean | null = null;
  if ((args.holdout.mustAllowCreate ?? []).length) {
    createSuitable = args.holdout.mustAllowCreate!.every((name) => {
      const hits = rows.filter((row) => includesName(blobOf(row), name));
      if (!hits.length) return false;
      return hits.some((row) => {
        const target = typeof row.candidateTargetId === "string" ? row.candidateTargetId.trim() : "";
        const targetRecord = target ? byId.get(target) : undefined;
        if (targetRecord?.entityType === "person") {
          return targetRecord.title.toLowerCase() === name.toLowerCase();
        }
        return row.disposition === "create_new";
      });
    });
  }

  let updateSuitable: boolean | null = null;
  if ((args.holdout.mustNotDuplicate ?? []).length) {
    updateSuitable = args.holdout.mustNotDuplicate!.every((name) => {
      const existing = args.records.find(
        (row) =>
          row.entityType === "person" && row.title.toLowerCase() === name.toLowerCase(),
      );
      if (!existing) return true;
      return !rows.some(
        (row) =>
          row.domain === "person" &&
          row.disposition === "create_new" &&
          includesName(`${obsName(row) ?? ""} ${row.statement ?? ""}`, name),
      );
    });
  }

  let contradictionPreserved: boolean | null = null;
  if (args.holdout.mustPreserveContradiction === true) {
    contradictionPreserved = rows.length >= 2 && needsYou + writes >= 2;
  }

  let nameOnlySurvived: boolean | null = null;
  if (args.holdout.optionalResponsibilityOk || (args.holdout.mustAllowCreate ?? []).length) {
    const names = [
      ...args.holdout.mustRecall.filter((needle) =>
        KNOWN_PEOPLE.some((person) => person.toLowerCase() === needle.toLowerCase()),
      ),
      ...(args.holdout.mustAllowCreate ?? []),
    ];
    nameOnlySurvived = names.length
      ? names.every((name) => blob.includes(name.toLowerCase()))
      : null;
  }

  return {
    recallHits,
    recallPossible: args.holdout.mustRecall.length,
    inventions,
    foreignId,
    identityContamination,
    wrongAttachment,
    unsafePronounResolution,
    ambiguityPreserved,
    createSuitable,
    updateSuitable,
    contradictionPreserved,
    nameOnlySurvived,
    writes,
    needsYou,
    noChange,
    rejected,
    observationCount: args.snapshot.atoms.length,
    parseMalformed: args.snapshot.parseMalformed,
  };
}

export function emptyTotals() {
  return {
    cases: 0,
    recallHits: 0,
    recallPossible: 0,
    inventions: 0,
    foreignId: 0,
    identityContamination: 0,
    wrongAttachment: 0,
    unsafePronounResolution: 0,
    ambiguityOk: 0,
    ambiguityCases: 0,
    createOk: 0,
    createCases: 0,
    updateOk: 0,
    updateCases: 0,
    nameOnlyOk: 0,
    nameOnlyCases: 0,
    writes: 0,
    needsYou: 0,
    observationCount: 0,
    parseMalformed: 0,
    errors: 0,
  };
}

export function addToTotals(
  totals: ReturnType<typeof emptyTotals>,
  score: HoldoutCaseScore,
) {
  totals.cases += 1;
  totals.recallHits += score.recallHits;
  totals.recallPossible += score.recallPossible;
  totals.inventions += score.inventions;
  totals.foreignId += score.foreignId;
  totals.identityContamination += score.identityContamination;
  totals.wrongAttachment += score.wrongAttachment;
  totals.unsafePronounResolution += score.unsafePronounResolution;
  totals.writes += score.writes;
  totals.needsYou += score.needsYou;
  totals.observationCount += score.observationCount;
  if (score.parseMalformed) totals.parseMalformed += 1;
  if (score.ambiguityPreserved !== null) {
    totals.ambiguityCases += 1;
    if (score.ambiguityPreserved) totals.ambiguityOk += 1;
  }
  if (score.createSuitable !== null) {
    totals.createCases += 1;
    if (score.createSuitable) totals.createOk += 1;
  }
  if (score.updateSuitable !== null) {
    totals.updateCases += 1;
    if (score.updateSuitable) totals.updateOk += 1;
  }
  if (score.nameOnlySurvived !== null) {
    totals.nameOnlyCases += 1;
    if (score.nameOnlySurvived) totals.nameOnlyOk += 1;
  }
}
