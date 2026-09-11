/**
 * Canonical well-formed observations used as composition atoms.
 * Not live model output. Ids are stable so failures reproduce.
 */

import type { CaptureObservationV2 } from "../../src/lib/capture-v2/types";
import { frozenEnvelopeFor } from "../../src/lib/eval-capture-v2/frozen-model-outputs";
import { CANDYLAND_ID, GAMING_ID, TOYWORLD_ID } from "../../src/lib/experiments/worlds";
import { obs, observationsOf } from "./obs";
import { AURORA_ID, MS_CAB, MS_RELEASE, OLGA_ID, SARAH_ID } from "./worlds";
import type { EnvelopeRow } from "./perturb";
import { transcriptFromRows } from "./perturb";
import type { ConvergenceCase, FamilyId, WorldKind } from "./types";

export function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pack(
  rows: EnvelopeRow[],
  extraTranscript = "",
): { rawModelJson: { observations: EnvelopeRow[] }; transcript: string } {
  return {
    rawModelJson: { observations: rows },
    transcript: transcriptFromRows(rows, extraTranscript),
  };
}

export function makeCase(
  args: Omit<ConvergenceCase, "seed"> & { seed?: number },
): ConvergenceCase {
  return { seed: args.seed ?? seedFrom(args.id), ...args };
}

export const ANDRIS: CaptureObservationV2 = obs({
  id: "obs-andris",
  statement: "Andris will take ownership of Legacy.",
  evidence: "Andris will take ownership of Legacy.",
  domain: "responsibility",
  disposition: "create_new",
  truthIntent: "current",
  proposedValues: {
    personName: "Andris",
    scope: "Legacy",
    ownershipSemantics: "replace",
  },
});

export const DATE_MOVE: CaptureObservationV2 = obs({
  id: "obs-date",
  statement: "Production release has moved from 12 September to 19 September.",
  evidence: "Production release has moved from 12 September to 19 September.",
  domain: "milestone",
  disposition: "update_existing",
  truthIntent: "current",
  projectId: AURORA_ID,
  candidateTargetId: MS_RELEASE,
  candidateTargetTitle: "Production release",
  proposedValues: { label: "Production release", date: "2026-09-19" },
});

export const CAB_CANCEL: CaptureObservationV2 = obs({
  id: "obs-cab",
  statement: "The CAB preparation session is cancelled and is no longer required.",
  evidence: "The CAB preparation session is cancelled and is no longer required.",
  domain: "milestone",
  disposition: "update_existing",
  truthIntent: "current",
  projectId: AURORA_ID,
  candidateTargetId: MS_CAB,
  candidateTargetTitle: "CAB preparation session",
  proposedValues: { status: "complete" },
});

export const SHE_UAT: CaptureObservationV2 = obs({
  id: "obs-she",
  statement: "She will own UAT going forward.",
  evidence:
    "Olga Petrov and Sarah Kim discussed the UAT handover. She will own UAT going forward.",
  domain: "responsibility",
  disposition: "ambiguous",
  truthIntent: "current",
  proposedValues: {
    personName: "She",
    scope: "UAT",
    ownershipSemantics: "replace",
  },
});

export const RUNBOOK_V3: CaptureObservationV2 = obs({
  id: "obs-runbook",
  statement: "Cutover runbook v3 is now the working runbook.",
  evidence: "Cutover runbook v3 is now the working runbook.",
  domain: "knowledge",
  disposition: "create_new",
  truthIntent: "current",
  proposedValues: { text: "Cutover runbook v3 is now the working runbook." },
});

export const OLGA_UAT: CaptureObservationV2 = obs({
  id: "obs-olga-uat",
  statement: "Olga Petrov is responsible for UAT.",
  evidence: "Olga Petrov is responsible for UAT.",
  domain: "responsibility",
  disposition: "create_new",
  truthIntent: "current",
  proposedValues: {
    personName: "Olga Petrov",
    scope: "UAT",
    ownershipSemantics: "share",
  },
});

export const SARAH_RELEASE: CaptureObservationV2 = obs({
  id: "obs-sarah-rel",
  statement: "Sarah Kim is responsible for Release.",
  evidence: "Sarah Kim is responsible for Release.",
  domain: "responsibility",
  disposition: "create_new",
  truthIntent: "current",
  proposedValues: {
    personName: "Sarah Kim",
    scope: "Release",
    ownershipSemantics: "share",
  },
});

export const OLGA_PERSON: CaptureObservationV2 = obs({
  id: "obs-olga-person",
  statement: "Olga Petrov remains on the project.",
  evidence: "Olga Petrov remains on the project.",
  domain: "person",
  disposition: "no_change",
  truthIntent: "current",
  projectId: AURORA_ID,
  candidateTargetId: OLGA_ID,
  candidateTargetTitle: "Olga Petrov",
});

export const SARAH_PERSON: CaptureObservationV2 = obs({
  id: "obs-sarah-person",
  statement: "Sarah Kim remains on the project.",
  evidence: "Sarah Kim remains on the project.",
  domain: "person",
  disposition: "no_change",
  truthIntent: "current",
  projectId: AURORA_ID,
  candidateTargetId: SARAH_ID,
  candidateTargetTitle: "Sarah Kim",
});

export const AURORA_TODO: CaptureObservationV2 = obs({
  id: "obs-aurora-todo",
  statement: "Send the CAB minutes to finance.",
  evidence: "Send the CAB minutes to finance.",
  domain: "todo",
  disposition: "create_new",
  truthIntent: "current",
  proposedValues: { title: "Send the CAB minutes to finance" },
});

export const AURORA_COMMENTARY: CaptureObservationV2 = obs({
  id: "obs-aurora-coffee",
  statement: "The coffee machine is broken again.",
  evidence: "The coffee machine is broken again.",
  domain: "commentary",
  disposition: "commentary",
  truthIntent: "current",
});

export const PARADE_MOVE: CaptureObservationV2 = observationsOf(
  frozenEnvelopeFor("milestone-move"),
)[0]!;

export const FIZZ_AWAY: CaptureObservationV2 = observationsOf(
  frozenEnvelopeFor("availability"),
)[0]!;

export const BANNERS: CaptureObservationV2 = observationsOf(
  frozenEnvelopeFor("todo-create"),
)[0]!;

export const BRIDGE: CaptureObservationV2 = observationsOf(
  frozenEnvelopeFor("risk-resolution"),
)[0]!;

export const PIPPA: CaptureObservationV2 = observationsOf(
  frozenEnvelopeFor("existing-person"),
)[0]!;

export const SHARE_REPLACE: CaptureObservationV2 = observationsOf(
  frozenEnvelopeFor("share-vs-replace-ambiguous"),
)[0]!;

export const VELVET: CaptureObservationV2 = observationsOf(
  frozenEnvelopeFor("new-person"),
)[0]!;

export const PACKAGING: CaptureObservationV2 = observationsOf(
  frozenEnvelopeFor("existing-risk-update"),
)[0]!;

export const OLGA_SARAH_PASTE =
  "Olga Petrov and Sarah Kim discussed the UAT handover.";

export type NamedBase = {
  key: string;
  world: WorldKind;
  projectId: string;
  rows: EnvelopeRow[];
  focusIds: string[];
  familyHint?: FamilyId;
};

export const SOLO_BASES: NamedBase[] = [
  {
    key: "andris",
    world: "aurora",
    projectId: AURORA_ID,
    rows: [ANDRIS],
    focusIds: ["obs-andris"],
  },
  {
    key: "date-move",
    world: "aurora",
    projectId: AURORA_ID,
    rows: [DATE_MOVE],
    focusIds: ["obs-date"],
  },
  {
    key: "cab-cancel",
    world: "aurora",
    projectId: AURORA_ID,
    rows: [CAB_CANCEL],
    focusIds: ["obs-cab"],
  },
  {
    key: "olga-uat",
    world: "aurora",
    projectId: AURORA_ID,
    rows: [OLGA_UAT],
    focusIds: ["obs-olga-uat"],
  },
  {
    key: "sarah-release",
    world: "aurora",
    projectId: AURORA_ID,
    rows: [SARAH_RELEASE],
    focusIds: ["obs-sarah-rel"],
  },
  {
    key: "runbook",
    world: "aurora",
    projectId: AURORA_ID,
    rows: [RUNBOOK_V3],
    focusIds: ["obs-runbook"],
  },
  {
    key: "aurora-todo",
    world: "aurora",
    projectId: AURORA_ID,
    rows: [AURORA_TODO],
    focusIds: ["obs-aurora-todo"],
  },
  {
    key: "parade",
    world: "experimental",
    projectId: CANDYLAND_ID,
    rows: [PARADE_MOVE],
    focusIds: [PARADE_MOVE.id],
  },
  {
    key: "fizz-away",
    world: "experimental",
    projectId: CANDYLAND_ID,
    rows: [FIZZ_AWAY],
    focusIds: [FIZZ_AWAY.id],
  },
  {
    key: "banners",
    world: "experimental",
    projectId: CANDYLAND_ID,
    rows: [BANNERS],
    focusIds: [BANNERS.id],
  },
  {
    key: "bridge",
    world: "experimental",
    projectId: CANDYLAND_ID,
    rows: [BRIDGE],
    focusIds: [BRIDGE.id],
  },
  {
    key: "pippa",
    world: "experimental",
    projectId: CANDYLAND_ID,
    rows: [PIPPA],
    focusIds: [PIPPA.id],
  },
  {
    key: "velvet",
    world: "experimental",
    projectId: TOYWORLD_ID,
    rows: [VELVET],
    focusIds: [VELVET.id],
  },
  {
    key: "packaging",
    world: "experimental",
    projectId: TOYWORLD_ID,
    rows: [PACKAGING],
    focusIds: [PACKAGING.id],
  },
];

export { CANDYLAND_ID, TOYWORLD_ID, GAMING_ID };
