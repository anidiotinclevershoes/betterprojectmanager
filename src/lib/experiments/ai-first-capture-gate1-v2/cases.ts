/**
 * Representative corpus + holdout cases, plus two labeled experiment cases.
 * Does not import Simplified Capture or Gate 1 v1.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { CAPTURE_V2_EVAL_CORPUS } from "@/lib/eval-capture-v2/corpus";
import { experimentalApplyWorld } from "@/lib/experiments/worlds";
import type { ExpectedFact } from "./types";

export const HARBOUR_ID = "proj-harbour-holdout-seed";

export type CaseFamily =
  | "create"
  | "update"
  | "already_current"
  | "identity"
  | "pronoun"
  | "date"
  | "correction"
  | "contradiction"
  | "ambiguous"
  | "unsupported"
  | "mixed"
  | "chatter"
  | "known_challenge";

export type Gate1V2Case = {
  id: string;
  title: string;
  family: CaseFamily;
  source: string;
  expectedSource: "corpus" | "holdout" | "manual-for-experiment";
  captureText: string;
  projectId: string;
  world: CaptureApplyWorld;
  expectedFacts: ExpectedFact[];
  notes: string;
};

function corpus(id: string) {
  const found = CAPTURE_V2_EVAL_CORPUS.find((row) => row.id === id);
  if (!found) throw new Error(`Missing corpus ${id}`);
  return found;
}

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
        sections: { people: [] },
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

const HOLDOUT_H6 = [
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

export function gate1V2Cases(): Gate1V2Case[] {
  const world = experimentalApplyWorld();
  const newPerson = corpus("new-person");
  const riskUpdate = corpus("existing-risk-update");
  const existingPerson = corpus("existing-person");
  const pronoun = corpus("pronoun-ambiguity");
  const dateMove = corpus("milestone-move");
  const correction = corpus("correction-of-wording");
  const share = corpus("share-vs-replace-ambiguous");
  const mixed = corpus("mixed-domains");
  const chatter = corpus("irrelevant-commentary");

  return [
    {
      id: "create-velvet",
      title: "Obvious create — new person",
      family: "create",
      source: `corpus ${newPerson.id}`,
      expectedSource: "corpus",
      captureText: newPerson.transcript,
      projectId: newPerson.projectId,
      world,
      notes: newPerson.material.map((m) => m.meaning).join(" "),
      expectedFacts: [
        {
          id: "velvet",
          meaning: "Velvet Sprocket is a new paint lead.",
          tokens: ["velvet", "sprocket"],
          expectedOperation: "create",
          expectedDomain: "person",
          expectedTargetId: null,
          forbiddenTargetIds: ["person-brick", "person-buttons"],
        },
      ],
    },
    {
      id: "update-packaging",
      title: "Obvious update — existing risk worse",
      family: "update",
      source: `corpus ${riskUpdate.id}`,
      expectedSource: "corpus",
      captureText: riskUpdate.transcript,
      projectId: riskUpdate.projectId,
      world,
      notes: riskUpdate.material.map((m) => m.meaning).join(" "),
      expectedFacts: [
        {
          id: "packaging",
          meaning: "Packaging delay is worsening and still open.",
          tokens: ["packaging", "delay"],
          expectedOperation: "update",
          expectedDomain: "risk",
          expectedTargetId: "risk-packaging",
          forbiddenTargetIds: ["risk-bridge", "todo-track"],
        },
      ],
    },
    {
      id: "nochange-pippa",
      title: "Already-current truth / named identity",
      family: "already_current",
      source: `corpus ${existingPerson.id}`,
      expectedSource: "corpus",
      captureText: existingPerson.transcript,
      projectId: existingPerson.projectId,
      world,
      notes: existingPerson.material.map((m) => m.meaning).join(" "),
      expectedFacts: [
        {
          id: "pippa-same",
          meaning: "Pippa remains UAT lead — no second person.",
          tokens: ["pippa", "gumdrop"],
          expectedOperation: ["no_change", "update"],
          expectedDomain: ["person", "responsibility"],
          expectedTargetId: "person-gumdrop",
          acceptedTargetIds: ["person-gumdrop", "resp-uat"],
        },
      ],
    },
    {
      id: "pronoun-she",
      title: "Pronoun with no named subject",
      family: "pronoun",
      source: `corpus ${pronoun.id}`,
      expectedSource: "corpus",
      captureText: pronoun.transcript,
      projectId: pronoun.projectId,
      world,
      notes: pronoun.material.map((m) => m.meaning).join(" "),
      expectedFacts: [
        {
          id: "who-she",
          meaning: "'She' is unnamed — must not assign Pixel Ramos.",
          tokens: ["she", "boss"],
          expectedOperation: ["needs_you", "left_untouched"],
          forbiddenTargetIds: ["person-pixel"],
        },
      ],
    },
    {
      id: "date-parade",
      title: "Explicit date move",
      family: "date",
      source: `corpus ${dateMove.id}`,
      expectedSource: "corpus",
      captureText: dateMove.transcript,
      projectId: dateMove.projectId,
      world,
      notes: dateMove.material.map((m) => m.meaning).join(" "),
      expectedFacts: [
        {
          id: "parade-29",
          meaning: "Parade day moves to 29 October 2026.",
          tokens: ["parade", "29"],
          expectedOperation: "update",
          expectedDomain: "milestone",
          expectedTargetId: "ms-parade",
          forbiddenTargetIds: ["todo-pack"],
        },
      ],
    },
    {
      id: "correction-audio",
      title: "Spoken correction",
      family: "correction",
      source: `corpus ${correction.id}`,
      expectedSource: "corpus",
      captureText: correction.transcript,
      projectId: correction.projectId,
      world,
      notes: correction.material.map((m) => m.meaning).join(" "),
      expectedFacts: [
        {
          id: "audio-bus",
          meaning: "Intended new risk is the audio bus mixer.",
          tokens: ["audio", "bus"],
          expectedOperation: "create",
          expectedDomain: "risk",
          expectedTargetId: null,
          forbiddenTargetIds: ["risk-console"],
        },
      ],
    },
    {
      id: "contradict-parade",
      title: "Contradictory dates for the same milestone",
      family: "contradiction",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText:
        "Parade day is now 29 October 2026. Also, keep Parade day on 15 October 2026.",
      projectId: "proj-candy",
      world,
      notes:
        "Experiment-inferred: two incompatible dates for ms-parade. Must Needs You or Left untouched, not pick a date.",
      expectedFacts: [
        {
          id: "parade-conflict",
          meaning: "Parade day dates contradict — do not write a chosen date.",
          tokens: ["parade"],
          expectedOperation: ["needs_you", "left_untouched"],
          expectedTargetId: "ms-parade",
        },
      ],
    },
    {
      id: "ambiguous-share",
      title: "Ambiguous share vs replace",
      family: "ambiguous",
      source: `corpus ${share.id}`,
      expectedSource: "corpus",
      captureText: share.transcript,
      projectId: share.projectId,
      world,
      notes: share.material.map((m) => m.meaning).join(" "),
      expectedFacts: [
        {
          id: "uat-unclear",
          meaning: "UAT share vs replace is undecided.",
          tokens: ["uat"],
          expectedOperation: ["needs_you", "left_untouched"],
        },
      ],
    },
    {
      id: "unsupported-remove",
      title: "Unsupported milestone removal",
      family: "unsupported",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Please delete Parade day from the plan.",
      projectId: "proj-candy",
      world,
      notes:
        "Experiment-inferred from Capture status product-model gap: milestone cancel/remove is not a legal write. Left untouched or Needs You. A remove proposal is recorded but must not be treated as an Apply-ready success.",
      expectedFacts: [
        {
          id: "delete-parade",
          meaning: "Milestone delete is unsupported — fallback, do not silently write.",
          tokens: ["delete", "parade"],
          expectedOperation: ["left_untouched", "needs_you"],
          expectedDomain: ["milestone", "unsupported"],
          expectedTargetId: "ms-parade",
        },
      ],
    },
    {
      id: "mixed-three",
      title: "Mixed independent facts",
      family: "mixed",
      source: `corpus ${mixed.id}`,
      expectedSource: "corpus",
      captureText: mixed.transcript,
      projectId: mixed.projectId,
      world,
      notes: mixed.material.map((m) => m.meaning).join(" "),
      expectedFacts: [
        {
          id: "pippa-still",
          meaning: "Pippa remains UAT lead.",
          tokens: ["pippa", "uat"],
          expectedOperation: ["no_change", "update"],
          expectedTargetId: "person-gumdrop",
          acceptedTargetIds: ["person-gumdrop", "resp-uat"],
        },
        {
          id: "parade-22",
          meaning: "Parade day moves to 22 October 2026.",
          tokens: ["parade", "22"],
          expectedOperation: "update",
          expectedDomain: "milestone",
          expectedTargetId: "ms-parade",
        },
        {
          id: "fountain",
          meaning: "New fountain-pump overheating risk.",
          tokens: ["fountain", "pump"],
          expectedOperation: "create",
          expectedDomain: "risk",
          expectedTargetId: null,
        },
      ],
    },
    {
      id: "chatter",
      title: "Vague / irrelevant chatter",
      family: "chatter",
      source: `corpus ${chatter.id}`,
      expectedSource: "corpus",
      captureText: chatter.transcript,
      projectId: chatter.projectId,
      world,
      notes: "Lobby chiptunes are not certification work.",
      expectedFacts: [
        {
          id: "chiptune",
          meaning: "Irrelevant chatter must not become a write.",
          tokens: ["chiptune"],
          expectedOperation: ["left_untouched", "no_change"],
          forbiddenTargetIds: ["risk-console", "todo-balance", "ms-cert"],
        },
      ],
    },
    {
      id: "holdout-h6",
      title: "Known challenge — holdout H6 messy paste",
      family: "known_challenge",
      source: "e2e-hosted-holdout H6_MESSY_OPS_PASTE",
      expectedSource: "holdout",
      captureText: HOLDOUT_H6,
      projectId: HARBOUR_ID,
      world: harbourHoldoutSeedWorld(),
      notes:
        "Holdout expected: workshop 22 Oct update; void keys create; Kwame create or Needs You; policy already-known; plants/biscuits not truth; DHP speculation Needs You / omitted.",
      expectedFacts: [
        {
          id: "workshop",
          meaning: "Workshop moves to 22 October 2026.",
          tokens: ["workshop", "22"],
          expectedOperation: "update",
          expectedTargetId: "ms-workshop",
        },
        {
          id: "void-keys",
          meaning: "Collect void keys 16 Oct — new dated action.",
          tokens: ["void", "keys"],
          expectedOperation: "create",
          expectedDomain: ["todo", "milestone"],
        },
        {
          id: "kwame",
          meaning: "Kwame Boateng is a new contractor lead.",
          tokens: ["kwame", "boateng"],
          expectedOperation: ["create", "needs_you"],
          expectedDomain: ["person", "responsibility"],
        },
        {
          id: "policy",
          meaning: "Policy v3 remains current.",
          tokens: ["policy", "v3"],
          expectedOperation: "no_change",
          expectedTargetId: "know-policy-v3",
        },
        {
          id: "dhp",
          meaning: "DHP ownership is speculation.",
          tokens: ["dhp"],
          expectedOperation: ["needs_you", "left_untouched"],
        },
      ],
    },
  ];
}
