/**
 * World B — Northline CRM Redesign (people / availability / ownership).
 * Contract focus: §§7–8 people+availability, §10 commitments, §15 restraint on ownership.
 */
import type { EvalWorldFixture } from "@/lib/evals/types";

export const WORLD_B_NORTHLINE: EvalWorldFixture = {
  id: "world-v1-northline-crm",
  name: "Northline CRM Redesign",
  code: "NORTHLINE",
  description:
    "Synthetic CRM UX redesign for Northline Insurance. People, leave, cover, and ownership ambiguity dominate delivery risk.",
  purpose:
    "Ownership vs proximity, leave as intelligence, SPOF, temporary cover, chase lists.",
  categories: [
    "recall",
    "people",
    "dependency",
    "inference",
    "uncertainty",
    "restraint",
    "actionability",
    "trust",
    "accuracy",
    "grounding",
    "temporal",
  ],
  captures: [
    {
      id: "nl-cap-1",
      at: "2026-07-28T09:00:00.000Z",
      title: "Kickoff ownership",
      content:
        "Northline CRM redesign. Milestone: design freeze 15 September for October pilot. Ava Chen owns UX design sign-off. Jordan Miles is lead BA. Samir Patel leads front-end build. Maya Ortiz is product sponsor.",
      knownTruth: [
        "Design freeze target 15 September",
        "Ava Chen owns UX design sign-off",
        "Jordan Miles is lead BA",
        "Samir Patel leads front-end build",
        "Maya Ortiz is product sponsor",
      ],
    },
    {
      id: "nl-cap-2",
      at: "2026-08-05T11:00:00.000Z",
      title: "Leave and capacity",
      content:
        "Ava Chen is on annual leave from 1–12 September and is the only person authorised to sign UX design freeze. Samir is also 50% allocated to the Claims Portal until 20 August. Jordan discussed Snyk findings in a meeting but does not own security sign-off.",
      knownTruth: [
        "Ava away 1–12 September; sole UX freeze approver",
        "Samir 50% on Claims Portal until 20 August",
        "Jordan discussed Snyk — does not own security sign-off",
      ],
    },
    {
      id: "nl-cap-3",
      at: "2026-08-12T14:00:00.000Z",
      title: "BA cover change",
      content:
        "Jordan Miles starts parental leave on 25 August. Temporary BA cover is Riley Quinn from 25 August — Riley can gather requirements but Maya has not authorised Riley to approve scope changes. Ava has not designated a UX deputy.",
      knownTruth: [
        "Jordan parental leave from 25 August",
        "Riley Quinn temporary BA cover from 25 August",
        "Riley not authorised to approve scope changes",
        "No UX deputy designated for Ava",
      ],
    },
    {
      id: "nl-cap-4",
      at: "2026-08-18T10:00:00.000Z",
      title: "Commitment and conflict",
      content:
        "Maya asked Ava to send the research summary by 22 August; Ava promised she would. A later chat says maybe Tom from Design Ops can sign the freeze if Ava is away — that is unconfirmed speculation, not a decision. No record that Tom owns UX sign-off.",
      knownTruth: [
        "Ava promised research summary by 22 August",
        "Tom Design Ops freeze cover is unconfirmed speculation",
        "Tom does not own UX sign-off in records",
      ],
    },
    {
      id: "nl-cap-5",
      at: "2026-08-20T16:00:00.000Z",
      title: "Research summary status",
      content:
        "Research summary from Ava has not arrived yet. Design freeze remains 15 September. Front-end build of journey screens cannot start until design freeze is signed.",
      knownTruth: [
        "Ava research summary still outstanding (promised 22 August)",
        "Design freeze still 15 September",
        "Front-end journey build blocked until design freeze signed",
      ],
    },
  ],
  stages: [
    {
      id: "nl-stage-kickoff",
      label: "After kickoff",
      captureIds: ["nl-cap-1"],
      summary: "Owners and 15 Sep freeze known.",
      knownTruth: [
        "Design freeze 15 September",
        "Ava owns UX sign-off",
        "Jordan lead BA; Samir front-end; Maya sponsor",
      ],
    },
    {
      id: "nl-stage-leave",
      label: "After leave note",
      captureIds: ["nl-cap-1", "nl-cap-2"],
      summary: "Ava leave over freeze window; Samir split; Jordan≠security.",
      knownTruth: [
        "Ava away 1–12 September; sole freeze approver",
        "Samir 50% Claims until 20 August",
        "Jordan does not own security sign-off",
      ],
    },
    {
      id: "nl-stage-cover",
      label: "After BA cover",
      captureIds: ["nl-cap-1", "nl-cap-2", "nl-cap-3"],
      summary: "Jordan leave; Riley limited cover; no UX deputy.",
      knownTruth: [
        "Jordan leave from 25 August; Riley cover without scope approval authority",
        "No UX deputy for Ava",
      ],
    },
    {
      id: "nl-stage-latest",
      label: "Latest",
      captureIds: [
        "nl-cap-1",
        "nl-cap-2",
        "nl-cap-3",
        "nl-cap-4",
        "nl-cap-5",
      ],
      summary: "Outstanding Ava promise; Tom cover unconfirmed; build blocked.",
      knownTruth: [
        "Ava research summary outstanding",
        "Tom freeze cover unconfirmed",
        "Journey build blocked on design freeze",
        "Ava sole recorded UX approver and away 1–12 Sep",
      ],
    },
  ],
  cases: [
    {
      id: "v1-northline-q1-ux-owner",
      worldId: "world-v1-northline-crm",
      stageId: "nl-stage-kickoff",
      question: "Who owns UX design sign-off?",
      categories: ["recall", "people", "accuracy", "grounding"],
      expectedAnswer: "Ava Chen owns UX design sign-off.",
      expectedFacts: ["Ava"],
      forbiddenClaims: ["Jordan owns UX", "Maya owns UX sign-off"],
      evaluatorNotes: "Contract §7.",
    },
    {
      id: "v1-northline-q2-jordan-snyk",
      worldId: "world-v1-northline-crm",
      stageId: "nl-stage-leave",
      question: "Does Jordan own security sign-off for Northline?",
      categories: ["people", "restraint", "accuracy", "trust", "grounding"],
      expectedAnswer:
        "No — Jordan discussed Snyk findings but does not own security sign-off.",
      expectedFacts: ["does not own", "discussed"],
      forbiddenClaims: [
        "Jordan owns security",
        "Jordan is the security approver",
      ],
      evaluatorNotes: "Contract §7 proximity ≠ ownership; §15 restraint.",
    },
    {
      id: "v1-northline-q3-freeze-risk",
      worldId: "world-v1-northline-crm",
      stageId: "nl-stage-leave",
      question:
        "Is there anything about Ava's leave that affects the 15 September design freeze?",
      categories: [
        "people",
        "inference",
        "dependency",
        "temporal",
        "actionability",
        "trust",
      ],
      expectedAnswer:
        "Yes — Ava is the sole UX freeze approver and is away 1–12 September, overlapping the freeze window, creating a single-point-of-failure risk.",
      expectedFacts: ["Ava", "away", "sole", "September"],
      expectedImplications: ["SPOF risk to design freeze"],
      forbiddenClaims: [
        "Design freeze is unaffected",
        "Ava designated a deputy",
      ],
      criticalInsight:
        "Sole approver Ava is away during the freeze window with no deputy",
      evaluatorNotes: "Contract §§3,8 — connect leave to ownership+date.",
    },
    {
      id: "v1-northline-q4-riley-scope",
      worldId: "world-v1-northline-crm",
      stageId: "nl-stage-cover",
      question: "Can Riley approve scope changes while Jordan is on leave?",
      categories: ["people", "accuracy", "restraint", "uncertainty", "trust"],
      expectedAnswer:
        "No — Riley is temporary BA cover and is not authorised to approve scope changes.",
      expectedFacts: ["not authorised", "Riley"],
      forbiddenClaims: [
        "Riley can approve scope",
        "Riley owns BA approval",
      ],
      evaluatorNotes: "Contract §7 temporary cover limits.",
    },
    {
      id: "v1-northline-q5-tom-freeze",
      worldId: "world-v1-northline-crm",
      stageId: "nl-stage-latest",
      question: "Who will sign the design freeze if Ava is away?",
      categories: ["people", "uncertainty", "restraint", "trust", "grounding"],
      expectedAnswer:
        "Unknown in records — Ava remains the sole recorded approver; Tom cover is unconfirmed speculation.",
      expectedFacts: ["unconfirmed", "Ava"],
      forbiddenClaims: [
        "Tom owns UX sign-off",
        "Tom will sign the freeze",
        "Tom is the designated deputy",
      ],
      expectUncertainty: true,
      evaluatorNotes: "Contract §§5,15 — speculation ≠ ownership transfer.",
    },
    {
      id: "v1-northline-q6-waiting",
      worldId: "world-v1-northline-crm",
      stageId: "nl-stage-latest",
      question: "What am I waiting on from Ava?",
      categories: ["actionability", "people", "recall", "accuracy"],
      expectedAnswer:
        "The research summary Ava promised by 22 August — still outstanding.",
      expectedFacts: ["research summary", "22 August"],
      forbiddenClaims: ["Ava has delivered the research summary"],
      evaluatorNotes: "Contract §10 commitments.",
    },
    {
      id: "v1-northline-q7-build-start",
      worldId: "world-v1-northline-crm",
      stageId: "nl-stage-latest",
      question: "Can front-end journey build start before design freeze?",
      categories: ["dependency", "inference", "restraint", "trust"],
      expectedAnswer:
        "No — journey screen build is blocked until design freeze is signed.",
      expectedFacts: ["blocked", "design freeze"],
      forbiddenClaims: [
        "Yes, build can start now",
        "Build does not need freeze",
      ],
      criticalInsight:
        "Front-end journey build must not start before design freeze is signed",
      evaluatorNotes: "Contract §9.",
    },
    {
      id: "v1-northline-q8-spof",
      worldId: "world-v1-northline-crm",
      stageId: "nl-stage-latest",
      question: "Is there a single point of failure on design freeze?",
      categories: ["people", "inference", "actionability", "accuracy"],
      expectedAnswer:
        "Yes — Ava is the sole recorded UX freeze approver with no deputy, and she is away 1–12 September.",
      expectedFacts: ["Ava", "sole", "no deputy"],
      forbiddenClaims: ["Multiple approvers are recorded for UX freeze"],
      evaluatorNotes: "Contract §§8,11 — SPOF implication from evidence.",
    },
    {
      id: "v1-northline-q9-security-owner",
      worldId: "world-v1-northline-crm",
      stageId: "nl-stage-latest",
      question: "Who owns security sign-off on Northline?",
      categories: ["uncertainty", "people", "grounding", "restraint", "trust"],
      expectedAnswer:
        "Not recorded — no security sign-off owner is stated in the project information.",
      expectedFacts: ["not recorded", "no"],
      forbiddenClaims: [
        "Jordan owns security",
        "Ava owns security",
        "Maya owns security sign-off",
      ],
      expectUncertainty: true,
      evaluatorNotes: "Contract §§2,15 — do not invent owner.",
    },
  ],
};
