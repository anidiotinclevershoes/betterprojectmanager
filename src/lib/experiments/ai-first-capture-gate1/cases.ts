/**
 * Five Gate 1 cases. Reuses existing corpus / holdout fixtures.
 * Harbour rows are a mechanical reconstruction of the frozen H6 seed notes.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { CAPTURE_V2_EVAL_CORPUS } from "@/lib/eval-capture-v2/corpus";
import { experimentalApplyWorld } from "@/lib/experiments/worlds";
import type { CaseKind, ExpectedFact } from "./types";

/** Frozen H6 paste from e2e-hosted-holdout/frozen-spec.ts. Copied so this spike does not import e2e. */
const HOLDOUT_H6_CAPTURE = [
  "From: housing ops",
  "Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.",
  "",
  "22/10/2026 is the new mobilisation workshop date (was 8 Oct).",
  "",
  "Parking: the office plants need watering; not a control.",
  "",
  "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
  "",
  "Kwame Boateng is the contractor lead for Harbour.",
  "",
  "Void keys still need collecting from the depot on 16 Oct 2026.",
  "",
  "Elena said the repairs policy v3 remains current.",
].join("\n");

const HOLDOUT_H6_EXPECTED_REVIEW =
  "Workshop date 2026-10-22 is Apply-ready update/create. Void keys 2026-10-16 is Apply-ready create if not already present. Kwame Boateng present as create or Needs You. Policy v3 already-known. Biscuits / office plants must not become Review truth. Priya/DHP speculation stays Needs You or is omitted; it must not write a guessed DHP owner.";

const HOLDOUT_H6_EXPECTED_NEEDS_YOU =
  "Required or omitted-without-write for speculative DHP ownership. Acceptable for Kwame. Not required for the clear workshop move or the clear depot date.";

export const HARBOUR_ID = "proj-harbour-holdout-seed";

export type Gate1Case = {
  id: string;
  title: string;
  kind: CaseKind;
  source: string;
  captureText: string;
  projectId: string;
  world: CaptureApplyWorld;
  expectedFacts: ExpectedFact[];
  expectedInterpretationNotes: string;
  expectedSource: "corpus" | "holdout" | "manual-for-experiment";
};

function requireCorpus(id: string) {
  const found = CAPTURE_V2_EVAL_CORPUS.find((row) => row.id === id);
  if (!found) throw new Error(`Missing corpus case ${id}`);
  return found;
}

/**
 * Reconstruct H6 seed as current canonical truth.
 * IDs are experiment-stable labels, not hosted holdout UUIDs.
 * Source: e2e-hosted-holdout/frozen-spec.ts H6 seed notes.
 */
export function harbourHoldoutSeedWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([HARBOUR_ID]),
    projects: [
      {
        id: HARBOUR_ID,
        name: "Harbour repairs mobilisation",
        code: "HARBOUR",
        stakeholders: [
          { id: "person-priya", name: "Priya Nair", role: "contractor liaison" },
          { id: "person-tomos", name: "Tomos Reed", role: "voids" },
          { id: "person-elena", name: "Elena Voss", role: "resident liaison" },
        ],
      },
    ],
    risks: [],
    todos: [],
    timeline: [
      {
        id: "ms-workshop",
        projectId: HARBOUR_ID,
        label: "Mobilisation workshop",
        startAt: "2026-10-08T12:00:00.000Z",
      },
    ],
    knowledge: [
      {
        projectId: HARBOUR_ID,
        sections: {
          people: [
            "Priya Nair owns contractor liaison.",
            "Tomos Reed owns voids.",
            "Elena Voss owns resident liaison.",
          ],
        },
        structured: [
          {
            id: "know-policy-v3",
            kind: "fact",
            lifecycle: "current",
            body: "Repairs policy v3 is the current working version.",
          },
          {
            id: "resp-priya",
            kind: "responsibility",
            lifecycle: "current",
            body: "Priya Nair owns contractor liaison.",
            meta: {
              personId: "person-priya",
              responsibility: {
                personId: "person-priya",
                personName: "Priya Nair",
                scope: "contractor liaison",
                ownerConfirmed: true,
              },
            },
          },
          {
            id: "resp-tomos",
            kind: "responsibility",
            lifecycle: "current",
            body: "Tomos Reed owns voids.",
            meta: {
              personId: "person-tomos",
              responsibility: {
                personId: "person-tomos",
                personName: "Tomos Reed",
                scope: "voids",
                ownerConfirmed: true,
              },
            },
          },
          {
            id: "resp-elena",
            kind: "responsibility",
            lifecycle: "current",
            body: "Elena Voss owns resident liaison.",
            meta: {
              personId: "person-elena",
              responsibility: {
                personId: "person-elena",
                personName: "Elena Voss",
                scope: "resident liaison",
                ownerConfirmed: true,
              },
            },
          },
        ],
      },
    ],
  };
}

export function gate1Cases(): Gate1Case[] {
  const world = experimentalApplyWorld();
  const newPerson = requireCorpus("new-person");
  const riskUpdate = requireCorpus("existing-risk-update");
  const mixed = requireCorpus("mixed-domains");
  const ambiguous = requireCorpus("ambiguous-same-first-name");
  return [
    {
      id: "gate1-create-new-person",
      title: "Straightforward new truth — Velvet Sprocket",
      kind: "create_new",
      source: `eval corpus ${newPerson.id}`,
      captureText: newPerson.transcript,
      projectId: newPerson.projectId,
      world,
      expectedSource: "corpus",
      expectedInterpretationNotes: newPerson.material
        .map((m) => m.meaning)
        .join(" "),
      expectedFacts: [
        {
          id: "velvet-new",
          meaning: "Velvet Sprocket is a new person / paint lead.",
          tokens: ["velvet", "sprocket"],
          expectedCanonicalId: null,
          expectedReferenceKind: "new",
        },
      ],
    },
    {
      id: "gate1-change-existing-risk",
      title: "Change to existing truth — Packaging delay worse",
      kind: "change_existing",
      source: `eval corpus ${riskUpdate.id}`,
      captureText: riskUpdate.transcript,
      projectId: riskUpdate.projectId,
      world,
      expectedSource: "corpus",
      expectedInterpretationNotes: riskUpdate.material
        .map((m) => m.meaning)
        .join(" "),
      expectedFacts: [
        {
          id: "packaging-worse",
          meaning: "Existing Packaging delay risk is worsening and still open.",
          tokens: ["packaging", "delay"],
          expectedCanonicalId: "risk-packaging",
          expectedReferenceKind: "existing",
          unsafeIfPresent: ["resolved", "todo"],
        },
      ],
    },
    {
      id: "gate1-messy-mixed-domains",
      title: "Messy multi-fact — Pippa + parade date + fountain risk",
      kind: "messy_multi_fact",
      source: `eval corpus ${mixed.id}`,
      captureText: mixed.transcript,
      projectId: mixed.projectId,
      world,
      expectedSource: "corpus",
      expectedInterpretationNotes: mixed.material.map((m) => m.meaning).join(" "),
      expectedFacts: [
        {
          id: "pippa-still",
          meaning: "Pippa remains UAT lead (existing person / responsibility).",
          tokens: ["pippa", "uat"],
          expectedCanonicalId: "person-gumdrop",
          expectedReferenceKind: "existing",
        },
        {
          id: "parade-22",
          meaning: "Parade day moves to 22 October 2026.",
          tokens: ["parade", "22", "october"],
          expectedCanonicalId: "ms-parade",
          expectedReferenceKind: "existing",
        },
        {
          id: "fountain-new",
          meaning: "New risk: chocolate fountain pump overheating.",
          tokens: ["fountain", "pump"],
          expectedCanonicalId: null,
          expectedReferenceKind: "new",
        },
      ],
    },
    {
      id: "gate1-ambiguous-brick",
      title: "Ambiguous identity — Brick from the warehouse",
      kind: "ambiguous_identity",
      source: `eval corpus ${ambiguous.id}`,
      captureText: ambiguous.transcript,
      projectId: ambiguous.projectId,
      world,
      expectedSource: "corpus",
      expectedInterpretationNotes: ambiguous.material
        .map((m) => m.meaning)
        .join(" "),
      expectedFacts: [
        {
          id: "which-brick",
          meaning:
            "A Brick was mentioned who may not be Brick Oakley — preserve ambiguity.",
          tokens: ["brick", "warehouse"],
          expectedReferenceKind: "ambiguous",
          mustSurfaceAmbiguity: true,
        },
      ],
    },
    {
      id: "gate1-holdout-h6-messy",
      title: "Long-haul regression — hosted holdout H6 messy ops paste",
      kind: "longhaul_regression",
      source: "e2e-hosted-holdout H6_MESSY_OPS_PASTE",
      captureText: HOLDOUT_H6_CAPTURE,
      projectId: HARBOUR_ID,
      world: harbourHoldoutSeedWorld(),
      expectedSource: "holdout",
      expectedInterpretationNotes: [
        HOLDOUT_H6_EXPECTED_REVIEW,
        HOLDOUT_H6_EXPECTED_NEEDS_YOU,
        "Harbour snapshot IDs are reconstructed from the frozen H6 seed notes (manual-for-experiment IDs), not hosted UUIDs.",
      ].join(" "),
      expectedFacts: [
        {
          id: "workshop-22",
          meaning: "Mobilisation workshop date moves to 22 October 2026.",
          tokens: ["workshop", "22"],
          expectedCanonicalId: "ms-workshop",
          expectedReferenceKind: "existing",
        },
        {
          id: "void-keys",
          meaning: "Collect void keys from the depot on 16 October 2026 — new dated action.",
          tokens: ["void", "keys", "depot"],
          expectedCanonicalId: null,
          expectedReferenceKind: "new",
        },
        {
          id: "kwame-new",
          meaning: "Kwame Boateng is a new contractor lead.",
          tokens: ["kwame", "boateng"],
          expectedCanonicalId: null,
          expectedReferenceKind: "new",
        },
        {
          id: "policy-v3",
          meaning: "Repairs policy v3 remains current already-known knowledge.",
          tokens: ["policy", "v3"],
          expectedCanonicalId: "know-policy-v3",
          expectedReferenceKind: "existing",
        },
        {
          id: "dhp-speculation",
          meaning: "Priya/DHP ownership is speculation — must not be asserted as decided.",
          tokens: ["dhp"],
          expectedReferenceKind: "ambiguous",
          mustSurfaceAmbiguity: true,
        },
      ],
    },
  ];
}
