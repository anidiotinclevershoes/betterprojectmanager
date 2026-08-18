/**
 * World D — Cascade Transformation (messy multi-stream / contradictions / stale facts).
 * Contract focus: §6 contradictions, §4–5 supersession vs stale, overlapping ownership.
 */
import type { EvalWorldFixture } from "@/lib/evals/types";

export const WORLD_D_CASCADE: EvalWorldFixture = {
  id: "world-v1-cascade-transform",
  name: "Cascade Operating Model Transformation",
  code: "CASCADE",
  description:
    "Synthetic multi-stream operating-model change for Contoso Shared Services. Workstreams publish conflicting updates asynchronously.",
  purpose:
    "Contradiction handling, stale stream updates, overlapping responsibilities, decision invalidating earlier assumptions.",
  categories: [
    "recall",
    "temporal",
    "contradiction",
    "uncertainty",
    "people",
    "dependency",
    "inference",
    "prioritisation",
    "restraint",
    "trust",
    "accuracy",
    "grounding",
    "actionability",
  ],
  captures: [
    {
      id: "cs-cap-1",
      at: "2026-07-10T09:00:00.000Z",
      title: "Programme kickoff",
      content:
        "Cascade transformation has three streams: Org Design (lead: Helen Cho), Process (lead: Omar Farouk), Technology (lead: Vikram Singh). Executive sponsor: Nadia Rahman. Wave 1 go-live target 30 September. Shared assumption: Wave 1 includes Finance Shared Services only.",
      knownTruth: [
        "Three streams: Helen Org Design, Omar Process, Vikram Technology",
        "Nadia Rahman executive sponsor",
        "Wave 1 go-live target 30 September",
        "Wave 1 scope assumption: Finance Shared Services only",
      ],
    },
    {
      id: "cs-cap-2",
      at: "2026-08-02T11:00:00.000Z",
      title: "Org Design update",
      content:
        "Helen reports org charts for Finance are baselined. She also wrote that Wave 1 go-live is 24 September — this conflicts with the 30 September programme target and was not confirmed by Nadia. Omar says process workshops for Finance finish 5 September.",
      knownTruth: [
        "Finance org charts baselined (Helen)",
        "Helen stated Wave 1 go-live 24 September — conflicts with 30 September; not confirmed by Nadia",
        "Omar: Finance process workshops finish 5 September",
      ],
    },
    {
      id: "cs-cap-3",
      at: "2026-08-08T16:00:00.000Z",
      title: "Technology and scope shock",
      content:
        "Vikram says the identity platform cutover dependency means Technology cannot be ready before 10 October unless scope is cut. Separately, Nadia decided in steering that Wave 1 now also includes HR Shared Services — this invalidates the Finance-only assumption. Helen has not updated org design for HR yet.",
      knownTruth: [
        "Technology readiness before 10 October blocked without scope cut (Vikram)",
        "Nadia decided Wave 1 includes HR Shared Services — Finance-only assumption invalidated",
        "Helen has not updated org design for HR",
      ],
    },
    {
      id: "cs-cap-4",
      at: "2026-08-14T10:00:00.000Z",
      title: "Stale process update",
      content:
        "Omar reposted an older status email saying Wave 1 remains Finance-only and on track for 30 September. That email is dated 28 July and does not reflect Nadia's HR scope decision. Vikram and Helen both flagged Omar's note as stale.",
      knownTruth: [
        "Omar's Finance-only / 30 Sep on-track note is stale (28 July) and does not reflect HR scope decision",
        "Vikram and Helen flagged Omar's note as stale",
      ],
    },
    {
      id: "cs-cap-5",
      at: "2026-08-19T13:00:00.000Z",
      title: "Steering clarification",
      content:
        "Nadia confirmed in writing: Wave 1 includes Finance and HR; go-live remains 30 September as a target but Technology risk to 10 October is acknowledged and needs a mitigation plan from Vikram by 25 August. Helen and Omar both own HR onboarding process design jointly — ownership is overlapping and not split.",
      knownTruth: [
        "Nadia confirmed Wave 1 = Finance + HR",
        "Go-live target still 30 September; Technology risk to 10 October acknowledged",
        "Vikram mitigation plan due 25 August",
        "Helen and Omar jointly own HR onboarding process design — overlapping, not split",
      ],
    },
  ],
  stages: [
    {
      id: "cs-stage-kickoff",
      label: "After kickoff",
      captureIds: ["cs-cap-1"],
      summary: "Streams and Finance-only Wave 1 assumption.",
      knownTruth: [
        "Wave 1 target 30 September",
        "Finance-only scope assumption",
        "Helen/Omar/Vikram stream leads; Nadia sponsor",
      ],
    },
    {
      id: "cs-stage-conflict-dates",
      label: "After Org Design date conflict",
      captureIds: ["cs-cap-1", "cs-cap-2"],
      summary: "24 vs 30 September conflict appears.",
      knownTruth: [
        "Conflicting go-live claims: Helen 24 Sep vs programme 30 Sep",
        "Helen date not confirmed by Nadia",
      ],
    },
    {
      id: "cs-stage-scope",
      label: "After scope + tech risk",
      captureIds: ["cs-cap-1", "cs-cap-2", "cs-cap-3"],
      summary: "HR added; tech October risk; Helen HR lag.",
      knownTruth: [
        "Wave 1 includes HR — Finance-only invalidated",
        "Technology may need until 10 October without scope cut",
        "Helen HR org design not updated",
      ],
    },
    {
      id: "cs-stage-latest",
      label: "Latest after steering",
      captureIds: [
        "cs-cap-1",
        "cs-cap-2",
        "cs-cap-3",
        "cs-cap-4",
        "cs-cap-5",
      ],
      summary: "Scope confirmed; stale Omar note; joint HR ownership; mitigation due.",
      knownTruth: [
        "Wave 1 = Finance + HR (Nadia confirmed)",
        "Target 30 September with acknowledged Technology risk",
        "Omar Finance-only note is stale",
        "Helen+Omar joint HR process ownership overlapping",
        "Vikram mitigation due 25 August",
      ],
    },
  ],
  cases: [
    {
      id: "v1-cascade-q1-sponsor",
      worldId: "world-v1-cascade-transform",
      stageId: "cs-stage-kickoff",
      question: "Who is the executive sponsor?",
      categories: ["recall", "people", "accuracy"],
      expectedAnswer: "Nadia Rahman.",
      expectedFacts: ["Nadia"],
      forbiddenClaims: ["Helen is the executive sponsor"],
    },
    {
      id: "v1-cascade-q2-go-live-conflict",
      worldId: "world-v1-cascade-transform",
      stageId: "cs-stage-conflict-dates",
      question: "What is the Wave 1 go-live date?",
      categories: [
        "contradiction",
        "temporal",
        "uncertainty",
        "restraint",
        "trust",
        "accuracy",
      ],
      expectedAnswer:
        "Conflicted — programme target is 30 September; Helen stated 24 September without Nadia confirmation. Do not silently pick one.",
      expectedFacts: ["30 September", "24 September", "conflict"],
      forbiddenClaims: [
        "Go-live is definitely 24 September",
        "Helen confirmed the official go-live is 24 September",
      ],
      expectContradiction: true,
      expectUncertainty: true,
      evaluatorNotes: "Contract §6 expose contradiction.",
    },
    {
      id: "v1-cascade-q3-finance-only",
      worldId: "world-v1-cascade-transform",
      stageId: "cs-stage-scope",
      question: "Is Wave 1 still Finance Shared Services only?",
      categories: ["temporal", "accuracy", "restraint", "trust"],
      expectedAnswer:
        "No — Nadia decided Wave 1 also includes HR Shared Services; Finance-only is invalidated.",
      expectedFacts: ["HR"],
      supportingFacts: ["invalidated", "Nadia", "Finance"],
      forbiddenClaims: [
        "Wave 1 is still Finance only",
        "Scope remains Finance Shared Services only",
      ],
      criticalInsight: "Finance-only Wave 1 assumption was invalidated by Nadia's HR decision",
      evaluatorNotes:
        "Contract §1 — naming HR expansion answers the question; 'invalidated' is supporting.",
    },
    {
      id: "v1-cascade-q4-omar-stale",
      worldId: "world-v1-cascade-transform",
      stageId: "cs-stage-latest",
      question: "Omar says Wave 1 is Finance-only and on track — is that current?",
      categories: ["temporal", "contradiction", "accuracy", "restraint", "trust"],
      expectedAnswer:
        "No — that note is stale (28 July) and does not reflect Nadia's HR scope decision.",
      expectedFacts: ["stale", "HR"],
      forbiddenClaims: [
        "Omar's Finance-only status is current",
        "Omar is correct that Wave 1 is Finance-only",
      ],
      evaluatorNotes: "Contract §§4–5 stale information.",
    },
    {
      id: "v1-cascade-q5-hr-org",
      worldId: "world-v1-cascade-transform",
      stageId: "cs-stage-latest",
      question: "Has Helen completed org design for HR Shared Services?",
      categories: ["recall", "accuracy", "people", "grounding"],
      expectedAnswer: "No — Helen has not updated org design for HR yet.",
      expectedFacts: ["not", "HR"],
      forbiddenClaims: ["Helen completed HR org design"],
    },
    {
      id: "v1-cascade-q6-tech-risk",
      worldId: "world-v1-cascade-transform",
      stageId: "cs-stage-latest",
      question: "What puts the 30 September Wave 1 target at risk?",
      categories: ["inference", "dependency", "prioritisation", "actionability"],
      expectedAnswer:
        "Technology may not be ready before 10 October without a scope cut; Vikram owes a mitigation plan by 25 August. HR scope expansion also increases Org Design/Process load.",
      expectedFacts: ["Technology", "10 October", "mitigation"],
      forbiddenClaims: ["There is no delivery risk"],
      evaluatorNotes: "Contract §§11–12 evidence-tied risk.",
    },
    {
      id: "v1-cascade-q7-hr-owner",
      worldId: "world-v1-cascade-transform",
      stageId: "cs-stage-latest",
      question: "Who owns HR onboarding process design?",
      categories: ["people", "contradiction", "uncertainty", "accuracy"],
      expectedAnswer:
        "Overlapping — Helen and Omar jointly own it; ownership is not cleanly split.",
      expectedFacts: ["Helen", "Omar", "joint"],
      supportingFacts: ["overlapping"],
      forbiddenClaims: [
        "Only Helen owns HR onboarding process design",
        "Only Omar owns HR onboarding process design",
      ],
      expectContradiction: true,
      evaluatorNotes:
        "Contract §7 — 'both own' ≡ joint. Naming both without exclusive claim is correct.",
    },
    {
      id: "v1-cascade-q8-chase-vikram",
      worldId: "world-v1-cascade-transform",
      stageId: "cs-stage-latest",
      question: "What am I waiting on from Vikram?",
      categories: ["actionability", "people", "recall", "dependency"],
      expectedAnswer: "A Technology mitigation plan due 25 August.",
      expectedFacts: ["mitigation", "25 August"],
      forbiddenClaims: ["Vikram has already delivered the mitigation plan"],
    },
    {
      id: "v1-cascade-q9-scope-cut-decided",
      worldId: "world-v1-cascade-transform",
      stageId: "cs-stage-latest",
      question: "Has the programme decided to cut Technology scope?",
      categories: ["uncertainty", "restraint", "accuracy", "trust", "grounding"],
      expectedAnswer:
        "No decision recorded — Vikram said readiness before 10 October needs a scope cut unless mitigated; no cut has been decided.",
      expectedFacts: ["no decision", "mitigation"],
      forbiddenClaims: [
        "Scope has been cut",
        "Technology scope cut is approved",
      ],
      expectUncertainty: true,
      evaluatorNotes: "Contract §§2,15 — conditional statement ≠ decision.",
    },
  ],
};
