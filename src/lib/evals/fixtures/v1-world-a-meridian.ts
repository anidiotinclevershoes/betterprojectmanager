/**
 * World A — Meridian Card Payments Release (regulated / CAB / security).
 * Contract focus: §§4–5 temporal, §9 dependency, §15 restraint, §22 critical failures.
 */
import type { EvalWorldFixture } from "@/lib/evals/types";

export const WORLD_A_MERIDIAN: EvalWorldFixture = {
  id: "world-v1-meridian-payments",
  name: "Meridian Card Payments Release",
  code: "MERIDIAN",
  description:
    "Synthetic regulated card-payments release for retail bank Contoso Retail. CAB, security, Snyk, test sign-off, and rollback evidence interact under moving dates.",
  purpose:
    "Release readiness, approval restraint, supersession vs speculation, dependency chains before CAB.",
  categories: [
    "recall",
    "accuracy",
    "grounding",
    "temporal",
    "people",
    "dependency",
    "inference",
    "uncertainty",
    "restraint",
    "trust",
    "actionability",
  ],
  captures: [
    {
      id: "mer-cap-1",
      at: "2026-07-20T09:00:00.000Z",
      title: "Release kickoff",
      content:
        "Meridian card payments release for Contoso Retail. Target go-live 19 August. Priya Shah owns CAB pack. David Okonkwo owns security review. Lena Brooks owns UAT sign-off. Snyk critical findings must be cleared before CAB. Rollback plan required in the CAB pack.",
      knownTruth: [
        "Go-live target 19 August",
        "Priya Shah owns CAB pack",
        "David Okonkwo owns security review",
        "Lena Brooks owns UAT sign-off",
        "Snyk criticals must be cleared before CAB",
        "Rollback plan required in CAB pack",
      ],
    },
    {
      id: "mer-cap-2",
      at: "2026-08-04T15:30:00.000Z",
      title: "Schedule and Snyk update",
      content:
        "Go-live moved to 26 August after penetration-test slot slipped. CAB now targeted for Thursday 21 August. Two Snyk criticals remain open on the payments service — not cleared. David has scheduled the security review for Thursday 14 August; no security approval has been given.",
      knownTruth: [
        "Go-live now 26 August (supersedes 19 August)",
        "CAB targeted Thursday 21 August",
        "Snyk criticals open as of this capture (two reported)",
        "Security review scheduled Thursday 14 August",
        "No security approval given",
      ],
    },
    {
      id: "mer-cap-3",
      at: "2026-08-11T10:00:00.000Z",
      title: "UAT and rollback",
      content:
        "UAT cannot start until build is complete. Build cannot complete until UX copy freeze is signed by Lena. Rollback runbook is still incomplete — Priya is drafting sections but evidence pack is not ready. Someone in stand-up said maybe we could move CAB to Wednesday 20 August.",
      knownTruth: [
        "UAT blocked until build complete",
        "Build blocked until UX copy freeze signed by Lena",
        "Rollback runbook incomplete; Priya drafting",
        "CAB move to Wednesday 20 August is speculation only — not confirmed",
      ],
    },
    {
      id: "mer-cap-4",
      at: "2026-08-13T16:00:00.000Z",
      title: "Security ask + informal optimism",
      content:
        "David asked for rollback evidence before he will sign security. Still no security approval. Lena has not signed UX copy freeze. A Slack note from Ops said CAB should be fine Thursday — treat as informal optimism, not a recorded decision.",
      knownTruth: [
        "Security requires rollback evidence before sign-off",
        "Still no security approval",
        "UX copy freeze not signed by Lena",
        "Ops CAB-fine comment is unconfirmed optimism — does not confirm CAB readiness",
      ],
    },
    {
      id: "mer-cap-5",
      at: "2026-08-14T09:30:00.000Z",
      title: "One Snyk cleared",
      content:
        "One of the two Snyk criticals is now closed. One Snyk critical remains open. Go-live remains 26 August. CAB remains Thursday 21 August unless formally changed.",
      knownTruth: [
        "One Snyk critical still open (one cleared)",
        "Go-live still 26 August",
        "CAB still Thursday 21 August",
      ],
    },
  ],
  stages: [
    {
      id: "mer-stage-kickoff",
      label: "After kickoff",
      captureIds: ["mer-cap-1"],
      summary: "19 August target; CAB/security/UAT owners known.",
      knownTruth: [
        "Go-live target 19 August",
        "Priya owns CAB pack",
        "David owns security review",
        "Lena owns UAT sign-off",
      ],
    },
    {
      id: "mer-stage-reschedule",
      label: "After reschedule + Snyk",
      captureIds: ["mer-cap-1", "mer-cap-2"],
      summary: "26 August go-live; CAB 21 Aug; Snyk open; security scheduled not approved.",
      knownTruth: [
        "Go-live 26 August",
        "CAB Thursday 21 August",
        "Snyk criticals were open after reschedule (later reduced)",
        "Security review scheduled — not approved",
      ],
    },
    {
      id: "mer-stage-blocked",
      label: "After UAT/rollback constraints",
      captureIds: ["mer-cap-1", "mer-cap-2", "mer-cap-3"],
      summary: "UAT/build/UX chain; rollback incomplete; CAB Wed speculation.",
      knownTruth: [
        "Go-live 26 August",
        "UAT blocked on build; build blocked on Lena UX freeze",
        "Rollback incomplete",
        "CAB Wed 20 Aug not confirmed",
      ],
    },
    {
      id: "mer-stage-pre-cab",
      label: "Pre-CAB latest",
      captureIds: [
        "mer-cap-1",
        "mer-cap-2",
        "mer-cap-3",
        "mer-cap-4",
        "mer-cap-5",
      ],
      summary: "Rollback evidence required; one Snyk left; no approvals.",
      knownTruth: [
        "Go-live 26 August",
        "CAB Thursday 21 August",
        "No security approval",
        "One Snyk critical still open",
        "UX freeze unsigned; rollback evidence outstanding",
      ],
    },
  ],
  cases: [
    {
      id: "v1-meridian-q1-owner-cab",
      worldId: "world-v1-meridian-payments",
      stageId: "mer-stage-kickoff",
      question: "Who owns the CAB pack for Meridian?",
      categories: ["recall", "people", "accuracy", "grounding"],
      expectedAnswer: "Priya Shah owns the CAB pack.",
      expectedFacts: ["Priya"],
      forbiddenClaims: ["David owns CAB", "Lena owns CAB"],
      evaluatorNotes: "Contract §7 ownership recall.",
    },
    {
      id: "v1-meridian-q2-current-golive",
      worldId: "world-v1-meridian-payments",
      stageId: "mer-stage-reschedule",
      question: "What is the current go-live date?",
      categories: ["temporal", "accuracy", "recall", "restraint"],
      expectedAnswer: "26 August (moved from 19 August).",
      expectedFacts: ["26 August"],
      forbiddenClaims: ["go-live is still 19 August", "go-live remains 19"],
      criticalInsight: "Current go-live is 26 August, not 19 August",
      evaluatorNotes: "Contract §4 current vs historical; §22 critical if uses superseded date.",
    },
    {
      id: "v1-meridian-q3-security-approved",
      worldId: "world-v1-meridian-payments",
      stageId: "mer-stage-reschedule",
      question: "Has Security approved the Meridian release?",
      categories: ["accuracy", "grounding", "uncertainty", "restraint", "trust"],
      expectedAnswer:
        "No — security review is scheduled, but no approval has been given.",
      expectedFacts: ["not approved", "no security approval"],
      supportingFacts: ["scheduled", "David"],
      forbiddenClaims: [
        "Security has approved",
        "David approved",
        "security approval is complete",
      ],
      // Explicit negative evidence — firm "No" is correct (Contract §13).
      expectUncertainty: false,
      evaluatorNotes:
        "Contract §15 restraint — scheduled ≠ approved. Firm grounded No is correct; do not require uncertainty hedges.",
    },
    {
      id: "v1-meridian-q4-uat-monday",
      worldId: "world-v1-meridian-payments",
      stageId: "mer-stage-blocked",
      question: "Can UAT start on Monday?",
      categories: [
        "dependency",
        "inference",
        "people",
        "actionability",
        "trust",
      ],
      expectedAnswer:
        "No — UAT requires build complete, which requires Lena's UX copy freeze, which is not signed.",
      expectedFacts: ["Lena", "UX", "build"],
      expectedImplications: ["UAT blocked by unmet prerequisites"],
      forbiddenClaims: ["Yes, UAT can start Monday", "UAT is ready to start"],
      criticalInsight:
        "UAT cannot start while UX freeze and build prerequisites are unmet",
      evaluatorNotes: "Contract §9 multi-hop dependency. Yes without prerequisites = critical.",
    },
    {
      id: "v1-meridian-q5-cab-wednesday",
      worldId: "world-v1-meridian-payments",
      stageId: "mer-stage-blocked",
      question: "Is CAB moving to Wednesday 20 August?",
      categories: ["temporal", "uncertainty", "restraint", "accuracy", "trust"],
      expectedAnswer:
        "Not confirmed — only informal speculation; CAB remains targeted for Thursday 21 August unless formally changed.",
      expectedFacts: ["not confirmed", "Thursday"],
      supportingFacts: ["21", "speculation"],
      forbiddenClaims: [
        "CAB is now Wednesday",
        "CAB has moved to 20 August",
        "confirmed CAB on Wednesday",
      ],
      expectUncertainty: true,
      evaluatorNotes: "Contract §5 newer speculation does not supersede.",
    },
    {
      id: "v1-meridian-q6-what-blocks-cab",
      worldId: "world-v1-meridian-payments",
      stageId: "mer-stage-pre-cab",
      question: "What should I chase before Thursday's CAB?",
      categories: [
        "actionability",
        "dependency",
        "prioritisation",
        "people",
        "inference",
      ],
      expectedAnswer:
        "Outstanding items include: remaining Snyk critical, rollback evidence for David, Lena's UX freeze / build path, and incomplete rollback runbook (Priya).",
      expectedFacts: ["Snyk", "rollback", "Lena"],
      forbiddenClaims: ["Everything is ready for CAB", "Security has approved"],
      evaluatorNotes: "Contract §§10–12 waiting + prioritisation + useful connections.",
    },
    {
      id: "v1-meridian-q7-snyk-status",
      worldId: "world-v1-meridian-payments",
      stageId: "mer-stage-pre-cab",
      question: "Are Snyk critical findings cleared for CAB?",
      categories: ["recall", "accuracy", "dependency", "restraint", "trust"],
      expectedAnswer: "No — one Snyk critical remains open (one was cleared).",
      expectedFacts: ["open", "Snyk", "one"],
      supportingFacts: ["cleared"],
      forbiddenClaims: [
        "all Snyk criticals are cleared",
        "Snyk is fully clear",
        "two Snyk critical",
        "two critical findings remain",
        "two Snyk critical findings remain open",
      ],
      criticalInsight: "At least one Snyk critical remains open before CAB",
      evaluatorNotes:
        "Ground truth at pre-CAB: exactly one critical remains open. Saying two is stale/wrong (trust).",
    },
    {
      id: "v1-meridian-q8-original-date",
      worldId: "world-v1-meridian-payments",
      stageId: "mer-stage-pre-cab",
      question: "Was Meridian originally planned for 19 August?",
      categories: ["temporal", "recall", "accuracy"],
      expectedAnswer: "Yes — original target was 19 August; current is 26 August.",
      expectedFacts: ["19 August"],
      supportingFacts: ["26 August"],
      forbiddenClaims: ["never planned for 19 August"],
      evaluatorNotes:
        "Contract §1/§4 — question asks original date; current date is helpful support only.",
    },
    {
      id: "v1-meridian-q9-ops-slack",
      worldId: "world-v1-meridian-payments",
      stageId: "mer-stage-pre-cab",
      question: "Is CAB ready based on the Ops Slack note?",
      categories: ["uncertainty", "restraint", "trust", "grounding", "accuracy"],
      expectedAnswer:
        "No — Ops optimism is not confirmation; CAB prerequisites remain open.",
      expectedFacts: ["not ready", "no security"],
      supportingFacts: ["informal", "UX", "unsigned", "Ops"],
      forbiddenClaims: [
        "CAB is ready",
        "Ops confirmed CAB readiness",
        "Security has approved",
      ],
      expectUncertainty: false,
      evaluatorNotes:
        "Contract §2/§5 — firm No is correct when prerequisites are explicitly unmet; Ops Slack is informal.",
    },
  ],
};
