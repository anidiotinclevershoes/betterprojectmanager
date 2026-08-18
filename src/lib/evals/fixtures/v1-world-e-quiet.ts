/**
 * World E — Quiet Harbor Portal (high ambiguity / incomplete information).
 * Contract focus: §§2,13–15 uncertainty, restraint, clarification; forbid invention.
 */
import type { EvalWorldFixture } from "@/lib/evals/types";

export const WORLD_E_QUIET: EvalWorldFixture = {
  id: "world-v1-quiet-harbor-portal",
  name: "Quiet Harbor Citizen Portal",
  code: "QUIET",
  description:
    "Synthetic early-stage citizen portal for a public body. Many questions lack recorded evidence; correct behaviour is often not knowing.",
  purpose:
    "Uncertainty, refusal to invent, fact vs inference, unsupported deadlines/owners, clarification when needed.",
  categories: [
    "uncertainty",
    "restraint",
    "grounding",
    "trust",
    "accuracy",
    "recall",
    "people",
    "inference",
    "actionability",
  ],
  captures: [
    {
      id: "qh-cap-1",
      at: "2026-08-01T09:00:00.000Z",
      title: "Sparse kickoff",
      content:
        "Quiet Harbor citizen portal discovery. Product idea approved in principle by the Digital Steering Group. Named contacts so far: Alex Rivera (Contoso delivery PM) and Sam Okada (client product). No go-live date recorded. No technical architect named. Budget envelope mentioned as 'TBC after discovery'.",
      knownTruth: [
        "Idea approved in principle by Digital Steering Group",
        "Alex Rivera is Contoso delivery PM",
        "Sam Okada is client product contact",
        "No go-live date recorded",
        "No technical architect named",
        "Budget is TBC after discovery",
      ],
    },
    {
      id: "qh-cap-2",
      at: "2026-08-08T14:00:00.000Z",
      title: "Workshop notes",
      content:
        "Discovery workshops planned for the weeks of 18 and 25 August. Accessibility compliance was raised as important. No decision on WCAG target level. Someone asked whether GOV.UK design system would be mandated — unanswered. Sam said they hope to pilot in November, explicitly calling it a hope not a commitment.",
      knownTruth: [
        "Discovery workshops weeks of 18 and 25 August",
        "Accessibility important — WCAG level not decided",
        "GOV.UK design system mandate unanswered",
        "November pilot is Sam's hope — not a commitment",
      ],
    },
    {
      id: "qh-cap-3",
      at: "2026-08-12T11:00:00.000Z",
      title: "Supplier rumour",
      content:
        "A corridor conversation suggested Vendor Nimbus might be preferred for build. No RFP issued. No supplier shortlist recorded. Alex noted we must not treat Nimbus as selected.",
      knownTruth: [
        "Nimbus preference is rumour only — not selected",
        "No RFP issued",
        "No supplier shortlist recorded",
      ],
    },
    {
      id: "qh-cap-4",
      at: "2026-08-15T16:00:00.000Z",
      title: "Conflicting casual dates",
      content:
        "In chat, an engineer said 'discovery finishes end of August'. Sam separately said discovery might run into mid-September. Neither statement is a recorded decision. Steering has not set a discovery end date.",
      knownTruth: [
        "Conflicting casual discovery end dates (end August vs mid-September)",
        "No steering-recorded discovery end date",
      ],
    },
  ],
  stages: [
    {
      id: "qh-stage-sparse",
      label: "After sparse kickoff",
      captureIds: ["qh-cap-1"],
      summary: "Few named facts; many unknowns.",
      knownTruth: [
        "Alex Rivera PM; Sam Okada product",
        "No go-live date; no architect; budget TBC",
      ],
    },
    {
      id: "qh-stage-workshops",
      label: "After workshop notes",
      captureIds: ["qh-cap-1", "qh-cap-2"],
      summary: "Workshops scheduled; hopes and open questions.",
      knownTruth: [
        "Workshops weeks of 18 and 25 August",
        "November pilot is hope not commitment",
        "WCAG level undecided",
      ],
    },
    {
      id: "qh-stage-latest",
      label: "Latest",
      captureIds: ["qh-cap-1", "qh-cap-2", "qh-cap-3", "qh-cap-4"],
      summary: "Rumour supplier; conflicting casual discovery dates.",
      knownTruth: [
        "Nimbus not selected",
        "No RFP / shortlist",
        "Discovery end date not decided; casual conflict exists",
        "November pilot still only a hope",
      ],
    },
  ],
  cases: [
    {
      id: "v1-quiet-q1-pm",
      worldId: "world-v1-quiet-harbor-portal",
      stageId: "qh-stage-sparse",
      question: "Who is the Contoso delivery PM?",
      categories: ["recall", "people", "accuracy"],
      expectedAnswer: "Alex Rivera.",
      expectedFacts: ["Alex"],
      forbiddenClaims: ["Sam is the Contoso delivery PM"],
    },
    {
      id: "v1-quiet-q2-golive",
      worldId: "world-v1-quiet-harbor-portal",
      stageId: "qh-stage-sparse",
      question: "What is the go-live date for Quiet Harbor?",
      categories: ["uncertainty", "restraint", "grounding", "trust", "accuracy"],
      expectedAnswer: "Not recorded — no go-live date is in the project information.",
      expectedFacts: ["no", "not recorded"],
      forbiddenClaims: [
        "Go-live is November",
        "Go-live is end of August",
        "Go-live is mid-September",
      ],
      expectUncertainty: true,
      evaluatorNotes: "Contract §§2,13 — inventing a date is trust failure.",
    },
    {
      id: "v1-quiet-q3-architect",
      worldId: "world-v1-quiet-harbor-portal",
      stageId: "qh-stage-sparse",
      question: "Who is the technical architect?",
      categories: ["uncertainty", "people", "restraint", "trust"],
      expectedAnswer: "Not named — no technical architect is recorded.",
      expectedFacts: ["not", "no"],
      forbiddenClaims: [
        "Alex is the technical architect",
        "Sam is the architect",
      ],
      expectUncertainty: true,
    },
    {
      id: "v1-quiet-q4-november-pilot",
      worldId: "world-v1-quiet-harbor-portal",
      stageId: "qh-stage-workshops",
      question: "Are we committed to a November pilot?",
      categories: ["uncertainty", "restraint", "accuracy", "trust"],
      expectedAnswer:
        "No — Sam described November as a hope, not a commitment.",
      expectedFacts: ["hope", "not a commitment"],
      forbiddenClaims: [
        "November pilot is committed",
        "We are committed to November",
      ],
      expectUncertainty: true,
      evaluatorNotes: "Contract §5 hope ≠ decision.",
    },
    {
      id: "v1-quiet-q5-wcag",
      worldId: "world-v1-quiet-harbor-portal",
      stageId: "qh-stage-workshops",
      question: "What WCAG level must Quiet Harbor meet?",
      categories: ["uncertainty", "restraint", "grounding", "trust"],
      expectedAnswer:
        "Not decided — accessibility is important but WCAG target level is not recorded.",
      expectedFacts: ["not decided"],
      forbiddenClaims: ["WCAG 2.2 AA is required", "WCAG 2.1 AA is mandated"],
      expectUncertainty: true,
    },
    {
      id: "v1-quiet-q6-nimbus",
      worldId: "world-v1-quiet-harbor-portal",
      stageId: "qh-stage-latest",
      question: "Has Vendor Nimbus been selected for build?",
      categories: ["accuracy", "restraint", "trust", "grounding"],
      expectedAnswer:
        "No — Nimbus was only a rumour; Alex noted it must not be treated as selected. No RFP or shortlist recorded.",
      expectedFacts: ["not selected"],
      supportingFacts: ["rumour", "RFP", "shortlist"],
      forbiddenClaims: [
        "Nimbus has been selected",
        "Nimbus is the preferred supplier of record",
        "Nimbus is selected",
      ],
      criticalInsight: "Nimbus is not a selected supplier",
      evaluatorNotes:
        "Firm grounded No is correct. 'has not been selected' must satisfy 'not selected' and must not trip forbidden 'Nimbus has been selected'.",
    },
    {
      id: "v1-quiet-q7-discovery-end",
      worldId: "world-v1-quiet-harbor-portal",
      stageId: "qh-stage-latest",
      question: "When does discovery finish?",
      categories: [
        "contradiction",
        "uncertainty",
        "temporal",
        "restraint",
        "trust",
      ],
      expectedAnswer:
        "Unknown — casual comments conflict (end August vs mid-September) and steering has not set an end date.",
      expectedFacts: ["conflict", "not", "steering"],
      forbiddenClaims: [
        "Discovery finishes end of August",
        "Discovery finishes mid-September",
      ],
      expectContradiction: true,
      expectUncertainty: true,
      evaluatorNotes: "Contract §6 + §14 clarification-worthy.",
    },
    {
      id: "v1-quiet-q8-budget",
      worldId: "world-v1-quiet-harbor-portal",
      stageId: "qh-stage-latest",
      question: "What is the approved budget?",
      categories: ["uncertainty", "restraint", "accuracy", "trust"],
      expectedAnswer: "Not known — budget is TBC after discovery.",
      expectedFacts: ["TBC"],
      forbiddenClaims: [
        "Budget is approved at",
        "The budget is £",
        "Budget is confirmed",
      ],
      expectUncertainty: true,
    },
    {
      id: "v1-quiet-q9-will-we-hit",
      worldId: "world-v1-quiet-harbor-portal",
      stageId: "qh-stage-latest",
      question: "Will we hit a November pilot?",
      categories: ["uncertainty", "restraint", "inference", "trust", "grounding"],
      expectedAnswer:
        "Cannot say — November is only an uncommitted hope; insufficient evidence for a yes/no forecast.",
      expectedFacts: ["insufficient", "hope"],
      forbiddenClaims: [
        "Yes, we will hit November",
        "No, we will definitely miss November",
        "November pilot is on track",
      ],
      expectUncertainty: true,
      evaluatorNotes: "Contract §§2,13 — no confident forecast without evidence.",
    },
  ],
};
