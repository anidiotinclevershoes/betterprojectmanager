/**
 * SAMPLE Project World for harness verification only.
 * Replace/extend with the real benchmark suite — do not treat this as production PM IQ.
 */
import type { EvalBenchmarkManifest } from "@/lib/evals/types";

export const SAMPLE_BENCHMARK: EvalBenchmarkManifest = {
  version: "sample-0.1.0",
  label: "Sample harness world (not the real V1 suite)",
  worlds: [
    {
      id: "world-sample-atlas-cutover",
      name: "ATLAS Cutover (sample)",
      code: "ATLAS",
      description:
        "Tiny synthetic cutover programme used only to prove the evaluation harness. Not a real customer project.",
      purpose:
        "Exercise recall, dependency, temporal supersession, forbidden claims, and uncertainty paths.",
      categories: [
        "recall",
        "accuracy",
        "grounding",
        "temporal",
        "people",
        "dependency",
        "uncertainty",
        "restraint",
        "trust",
      ],
      captures: [
        {
          id: "cap-1",
          at: "2026-08-01T09:00:00.000Z",
          title: "Kickoff notes",
          content:
            "ATLAS payments cutover. Go-live target 19 August. Sarah owns UX sign-off. Marcus owns release notes. CAB pack must be complete 24 hours before the board.",
          knownTruth: [
            "Go-live target 19 August",
            "Sarah owns UX sign-off",
            "Marcus owns release notes",
            "CAB pack due 24h before board",
          ],
        },
        {
          id: "cap-2",
          at: "2026-08-08T14:00:00.000Z",
          title: "Schedule change",
          content:
            "Go-live moved from 19 August to 26 August after vendor delay. Sarah confirmed she is away the week of 18 August and cannot finish UX until she returns on 25 August. Development must not start Monday 18 August until UX is signed off.",
          knownTruth: [
            "Go-live now 26 August (supersedes 19 August)",
            "Sarah away week of 18 August; returns 25 August",
            "UX sign-off blocked until Sarah returns",
            "Development must not start Mon 18 Aug before UX sign-off",
          ],
        },
        {
          id: "cap-3",
          at: "2026-08-12T11:00:00.000Z",
          title: "Risk note",
          content:
            "CDN rollback plan still incomplete. Nina is drafting it. No security approval has been given yet — do not claim Security approved anything.",
          knownTruth: [
            "CDN rollback plan incomplete; Nina drafting",
            "No security approval given",
          ],
        },
      ],
      stages: [
        {
          id: "stage-kickoff",
          label: "After kickoff",
          captureIds: ["cap-1"],
          summary: "Initial ownership and 19 August target known.",
          knownTruth: [
            "Go-live target 19 August",
            "Sarah owns UX",
            "Marcus owns release notes",
          ],
        },
        {
          id: "stage-reschedule",
          label: "After schedule change",
          captureIds: ["cap-1", "cap-2"],
          summary:
            "Go-live moved to 26 August; Sarah away; development blocked until UX.",
          knownTruth: [
            "Go-live 26 August",
            "Sarah away week of 18 August",
            "Dev must not start Mon 18 Aug before UX",
          ],
        },
        {
          id: "stage-risk",
          label: "After risk note",
          captureIds: ["cap-1", "cap-2", "cap-3"],
          summary: "Rollback incomplete; no security approval.",
          knownTruth: [
            "Go-live 26 August",
            "CDN rollback incomplete (Nina)",
            "No security approval",
          ],
        },
      ],
      cases: [
        {
          id: "sample-atlas-q1-owner-ux",
          worldId: "world-sample-atlas-cutover",
          stageId: "stage-kickoff",
          question: "Who owns UX sign-off on ATLAS?",
          categories: ["recall", "people", "accuracy", "grounding"],
          expectedAnswer: "Sarah owns UX sign-off.",
          expectedFacts: ["Sarah", "UX"],
          forbiddenClaims: ["Marcus owns UX", "Security approved"],
          evaluatorNotes: "Direct ownership recall.",
        },
        {
          id: "sample-atlas-q2-go-live-current",
          worldId: "world-sample-atlas-cutover",
          stageId: "stage-reschedule",
          question: "What is the current go-live date for ATLAS?",
          categories: ["temporal", "accuracy", "recall", "restraint"],
          expectedAnswer: "26 August (moved from 19 August).",
          expectedFacts: ["26 August"],
          forbiddenClaims: ["go-live is still 19 August"],
          evaluatorNotes: "Must prefer superseded schedule.",
        },
        {
          id: "sample-atlas-q3-dev-monday",
          worldId: "world-sample-atlas-cutover",
          stageId: "stage-reschedule",
          question: "Can development start on Monday 18 August?",
          categories: [
            "dependency",
            "people",
            "temporal",
            "inference",
            "actionability",
            "trust",
          ],
          expectedAnswer:
            "No — UX sign-off is required first and Sarah is away that week until 25 August.",
          expectedFacts: ["Sarah", "away", "UX"],
          expectedImplications: [
            "Development blocked until UX sign-off after Sarah returns",
          ],
          criticalInsight:
            "Sarah must finish UX first and is away the week of 18 August",
          forbiddenClaims: ["Yes, development can start Monday"],
          evaluatorNotes:
            "Critical intelligence: dependency + absence. Answering Yes without the constraint is a critical_intelligence_failure.",
        },
        {
          id: "sample-atlas-q4-security-approval",
          worldId: "world-sample-atlas-cutover",
          stageId: "stage-risk",
          question: "Has Security approved the ATLAS cutover?",
          categories: ["accuracy", "grounding", "uncertainty", "trust", "restraint"],
          expectedAnswer:
            "No evidence of Security approval — explicitly not given yet.",
          expectedFacts: ["no security approval", "not given"],
          forbiddenClaims: [
            "Security approved",
            "Dave approved Security",
            "approved yesterday",
          ],
          expectUncertainty: true,
          evaluatorNotes:
            "Inventing an approval is a trust_failure. Correct path is not_found / clear negative from evidence.",
        },
        {
          id: "sample-atlas-q5-rollback",
          worldId: "world-sample-atlas-cutover",
          stageId: "stage-risk",
          question: "What is the status of the CDN rollback plan?",
          categories: ["recall", "people", "accuracy", "actionability"],
          expectedAnswer: "Incomplete; Nina is drafting it.",
          expectedFacts: ["incomplete", "Nina"],
          forbiddenClaims: ["rollback plan is complete", "Security approved"],
        },
      ],
    },
  ],
};
