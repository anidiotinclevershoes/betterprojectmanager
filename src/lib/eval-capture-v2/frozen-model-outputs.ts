/**
 * Human-authored frozen model envelopes for deterministic Lume-path tests
 * and Playwright journeys. These are fixtures, not live model output.
 */

import { CANDYLAND_ID, GAMING_ID, TOYWORLD_ID } from "@/lib/experiments/worlds";

export type FrozenEnvelope = {
  caseId: string;
  rawModelJson: unknown;
};

export const FROZEN_MODEL_OUTPUTS: FrozenEnvelope[] = [
  {
    caseId: "existing-person",
    rawModelJson: {
      observations: [
        {
          id: "obs-pippa",
          statement: "Pippa Gumdrop remains UAT lead for the licorice stands",
          evidence: "Pippa Gumdrop is still the UAT lead for the licorice stands.",
          domain: "person",
          disposition: "no_change",
          truthIntent: "current",
          projectId: CANDYLAND_ID,
          candidateTargetId: "person-gumdrop",
          candidateTargetTitle: "Pippa Gumdrop",
        },
      ],
    },
  },
  {
    caseId: "new-person",
    rawModelJson: {
      observations: [
        {
          id: "obs-velvet",
          statement: "Velvet Sprocket is joining as paint lead",
          evidence:
            "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          projectId: TOYWORLD_ID,
          candidateTargetTitle: "Velvet Sprocket",
          proposedValues: { name: "Velvet Sprocket", role: "paint lead" },
        },
      ],
    },
  },
  {
    caseId: "existing-risk-update",
    rawModelJson: {
      observations: [
        {
          id: "obs-packaging-worse",
          statement: "Packaging delay is getting worse",
          evidence: "Packaging delay is getting worse after the cardboard mill flooded.",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: TOYWORLD_ID,
          candidateTargetId: "risk-packaging",
          candidateTargetTitle: "Packaging delay",
          proposedValues: { status: "open" },
        },
      ],
    },
  },
  {
    caseId: "risk-resolution",
    rawModelJson: {
      observations: [
        {
          id: "obs-bridge-closed",
          statement: "Gumdrop Bridge icing is resolved",
          evidence: "The icing on Gumdrop Bridge has melted; that risk is closed.",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "risk-bridge",
          candidateTargetTitle: "Gumdrop Bridge icing",
          proposedValues: { status: "resolved" },
        },
      ],
    },
  },
  {
    caseId: "milestone-move",
    rawModelJson: {
      observations: [
        {
          id: "obs-parade",
          statement: "Parade day moved to 29 October 2026",
          evidence: "Parade day is now 29 October 2026.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "ms-parade",
          candidateTargetTitle: "Parade day",
          proposedValues: { date: "2026-10-29" },
        },
      ],
    },
  },
  {
    caseId: "todo-create",
    rawModelJson: {
      observations: [
        {
          id: "obs-banners",
          statement: "Polish the candy-cane banners",
          evidence:
            "Please add a to-do to polish the candy-cane banners before the float leaves.",
          domain: "todo",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { title: "Polish the candy-cane banners" },
        },
      ],
    },
  },
  {
    caseId: "availability",
    rawModelJson: {
      observations: [
        {
          id: "obs-fizz-away",
          statement: "Fizz Caramel is away 5–12 October 2026",
          evidence:
            "Fizz Caramel is away from 5 October 2026 until 12 October 2026.",
          domain: "availability",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "person-fizz",
          candidateTargetTitle: "Fizz Caramel",
          proposedValues: {
            awayFromIso: "2026-10-05",
            awayToIso: "2026-10-12",
          },
        },
      ],
    },
  },
  {
    caseId: "share-vs-replace-ambiguous",
    rawModelJson: {
      observations: [
        {
          id: "obs-share-replace",
          statement: "UAT may be shared or replaced between Fizz and Pippa",
          evidence:
            "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it — the parade committee was unclear.",
          domain: "responsibility",
          disposition: "ambiguous",
          truthIntent: "current",
          proposedValues: { ownershipSemantics: "ambiguous", scope: "UAT lead" },
          commentary: "Share versus replace is not decided.",
        },
      ],
    },
  },
  {
    caseId: "foreign-ids-malformed-envelope",
    rawModelJson: {
      observations: [
        {
          id: "obs-foreign",
          statement: "Resolve console certification slip",
          evidence: "Please attach this update to the console certification risk.",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: GAMING_ID,
          candidateTargetId: "risk-console",
          candidateTargetTitle: "Console certification slip",
          proposedValues: { status: "resolved" },
        },
        {
          id: "obs-invented",
          statement: "Update imaginary risk",
          evidence: "Please attach this update to the console certification risk.",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "risk-does-not-exist",
        },
      ],
    },
  },
  {
    caseId: "duplicate-observation",
    rawModelJson: {
      observations: [
        {
          id: "obs-a",
          statement: "Packaging delay is resolved",
          evidence: "Packaging delay is resolved.",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: TOYWORLD_ID,
          candidateTargetId: "risk-packaging",
          proposedValues: { status: "resolved" },
        },
        {
          id: "obs-b",
          statement: "Packaging delay issue is resolved",
          evidence: "the packaging delay issue is resolved.",
          domain: "risk",
          disposition: "merge",
          truthIntent: "current",
          mergeWithObservationId: "obs-a",
          projectId: TOYWORLD_ID,
          candidateTargetId: "risk-packaging",
        },
      ],
    },
  },
];

export function frozenEnvelopeFor(caseId: string): unknown {
  const hit = FROZEN_MODEL_OUTPUTS.find((row) => row.caseId === caseId);
  if (!hit) {
    throw new Error(`No frozen model output for case ${caseId}`);
  }
  return hit.rawModelJson;
}
