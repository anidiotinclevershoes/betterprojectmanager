/**
 * World C — Harbor Data Hub (vendor / external dependency / integration).
 * Contract focus: §5 unconfirmed assumptions, §9 dependency chains, §10 waiting on vendor.
 */
import type { EvalWorldFixture } from "@/lib/evals/types";

export const WORLD_C_HARBOR: EvalWorldFixture = {
  id: "world-v1-harbor-datahub",
  name: "Harbor Data Hub Integration",
  code: "HARBOR",
  description:
    "Synthetic integration of Contoso analytics into Harbor vendor Data Hub API. External dates, environments, and unconfirmed assumptions drive risk.",
  purpose:
    "Vendor dependency reasoning, changing promised dates, assumptions ≠ confirmation, environment gates.",
  categories: [
    "recall",
    "temporal",
    "dependency",
    "uncertainty",
    "restraint",
    "inference",
    "actionability",
    "trust",
    "accuracy",
    "grounding",
    "people",
  ],
  captures: [
    {
      id: "hb-cap-1",
      at: "2026-07-15T09:00:00.000Z",
      title: "Kickoff",
      content:
        "Harbor Data Hub integration. Contoso needs production API access for customer-event feed. Vendor contact: Elena Voss (Harbor). Contoso integration lead: Chris Nguyen. Target integration test start 8 September. Assumption recorded: Harbor will provide staging credentials by 25 August — not yet confirmed by Harbor.",
      knownTruth: [
        "Integration test target start 8 September",
        "Elena Voss is Harbor vendor contact",
        "Chris Nguyen is Contoso integration lead",
        "Staging credentials by 25 August is an assumption — not confirmed by Harbor",
      ],
    },
    {
      id: "hb-cap-2",
      at: "2026-08-01T13:00:00.000Z",
      title: "Vendor delay",
      content:
        "Elena emailed that staging credentials are delayed to 1 September. She promised a written confirmation by 20 August. Production API access still not granted. Contoso non-prod environment 'harbor-int' is not yet provisioned by Platform — ticket INC-4412 open.",
      knownTruth: [
        "Staging credentials delayed to 1 September (vendor)",
        "Elena promised written confirmation by 20 August",
        "Production API access not granted",
        "harbor-int environment not provisioned; INC-4412 open",
      ],
    },
    {
      id: "hb-cap-3",
      at: "2026-08-10T10:00:00.000Z",
      title: "Contract and rate limits",
      content:
        "Legal says Harbor MSA amendment for event volume is still unsigned. Without the amendment, production traffic is not authorised. Elena mentioned informally that rate limits might be 100 rps — Contoso has not received an official rate-limit document.",
      knownTruth: [
        "Harbor MSA amendment unsigned — production traffic not authorised without it",
        "100 rps rate limit is informal only — no official document",
      ],
    },
    {
      id: "hb-cap-4",
      at: "2026-08-18T15:00:00.000Z",
      title: "Confirmation still missing",
      content:
        "Elena's written confirmation due 20 August has not arrived. Chris asked whether we can start coding against a mocked API — Maya (architect) said mocks are fine for unit tests only; integration tests require real staging. Someone suggested 8 September integration start might slip to 15 September; no formal replan yet.",
      knownTruth: [
        "Elena written confirmation still outstanding (due 20 August)",
        "Mocks allowed for unit tests only; integration tests need real staging",
        "15 September slip is suggestion only — not a formal replan",
      ],
    },
    {
      id: "hb-cap-5",
      at: "2026-08-21T09:00:00.000Z",
      title: "Partial env news",
      content:
        "Platform says harbor-int will be ready 28 August if INC-4412 stays on track — still not ready today. Staging credentials still not received. MSA amendment still unsigned.",
      knownTruth: [
        "harbor-int expected 28 August if INC-4412 on track — not ready yet",
        "Staging credentials still not received",
        "MSA amendment still unsigned",
      ],
    },
  ],
  stages: [
    {
      id: "hb-stage-kickoff",
      label: "After kickoff",
      captureIds: ["hb-cap-1"],
      summary: "8 Sep target; credentials assumption unconfirmed.",
      knownTruth: [
        "Integration test target 8 September",
        "Staging credentials-by-25-Aug assumption not confirmed",
      ],
    },
    {
      id: "hb-stage-vendor",
      label: "After vendor delay",
      captureIds: ["hb-cap-1", "hb-cap-2"],
      summary: "Credentials 1 Sep; confirmation promised; env ticket open.",
      knownTruth: [
        "Staging credentials delayed to 1 September",
        "Elena confirmation due 20 August",
        "harbor-int not provisioned",
      ],
    },
    {
      id: "hb-stage-legal",
      label: "After legal note",
      captureIds: ["hb-cap-1", "hb-cap-2", "hb-cap-3"],
      summary: "MSA unsigned; rate limit unofficial.",
      knownTruth: [
        "MSA amendment unsigned — prod traffic not authorised",
        "100 rps unofficial",
      ],
    },
    {
      id: "hb-stage-latest",
      label: "Latest",
      captureIds: [
        "hb-cap-1",
        "hb-cap-2",
        "hb-cap-3",
        "hb-cap-4",
        "hb-cap-5",
      ],
      summary: "Confirmation overdue; env ETA; no formal slip.",
      knownTruth: [
        "Elena confirmation outstanding",
        "harbor-int ETA 28 August — not ready",
        "Staging credentials not received",
        "MSA unsigned",
        "8 September still formal target unless replanned",
      ],
    },
  ],
  cases: [
    {
      id: "v1-harbor-q1-vendor-contact",
      worldId: "world-v1-harbor-datahub",
      stageId: "hb-stage-kickoff",
      question: "Who is the Harbor vendor contact?",
      categories: ["recall", "people", "accuracy"],
      expectedAnswer: "Elena Voss.",
      expectedFacts: ["Elena"],
      forbiddenClaims: ["Chris is the Harbor vendor contact"],
    },
    {
      id: "v1-harbor-q2-credentials-confirmed",
      worldId: "world-v1-harbor-datahub",
      stageId: "hb-stage-kickoff",
      question: "Has Harbor confirmed staging credentials by 25 August?",
      categories: ["uncertainty", "restraint", "accuracy", "trust", "grounding"],
      expectedAnswer:
        "No — that date is a Contoso assumption, not a Harbor confirmation.",
      expectedFacts: ["assumption", "not confirmed"],
      forbiddenClaims: [
        "Harbor confirmed credentials by 25 August",
        "credentials are confirmed",
      ],
      expectUncertainty: true,
      evaluatorNotes: "Contract §5 assumption ≠ confirmation.",
    },
    {
      id: "v1-harbor-q3-integration-tests",
      worldId: "world-v1-harbor-datahub",
      stageId: "hb-stage-latest",
      question: "Can we start integration tests on 8 September as planned?",
      categories: [
        "dependency",
        "inference",
        "temporal",
        "uncertainty",
        "trust",
        "actionability",
      ],
      expectedAnswer:
        "At risk / likely not ready — staging credentials not received (vendor now citing 1 September), harbor-int not ready, and MSA unsigned for production path; 8 September remains the formal target but prerequisites are unmet.",
      expectedFacts: ["credentials", "harbor-int", "not"],
      forbiddenClaims: [
        "Yes, integration tests can definitely start 8 September",
        "All prerequisites are met",
      ],
      criticalInsight:
        "Integration tests require real staging; credentials and environment are not ready",
      evaluatorNotes: "Contract §9 multi-prerequisite.",
    },
    {
      id: "v1-harbor-q4-rate-limit",
      worldId: "world-v1-harbor-datahub",
      stageId: "hb-stage-legal",
      question: "What is the official API rate limit?",
      categories: ["uncertainty", "restraint", "accuracy", "trust"],
      expectedAnswer:
        "Not known officially — 100 rps was mentioned informally; no official document received.",
      expectedFacts: ["informal", "no official"],
      forbiddenClaims: [
        "Official rate limit is 100 rps",
        "Harbor confirmed 100 rps",
      ],
      expectUncertainty: true,
      evaluatorNotes: "Contract §§2,15.",
    },
    {
      id: "v1-harbor-q5-prod-traffic",
      worldId: "world-v1-harbor-datahub",
      stageId: "hb-stage-legal",
      question: "Are we authorised to send production traffic to Harbor?",
      categories: ["accuracy", "dependency", "restraint", "trust"],
      expectedAnswer:
        "No — MSA amendment is unsigned; production traffic is not authorised.",
      expectedFacts: ["unsigned", "not authorised"],
      forbiddenClaims: [
        "Production traffic is authorised",
        "MSA is signed",
      ],
      criticalInsight: "Unsigned MSA means production traffic is not authorised",
    },
    {
      id: "v1-harbor-q6-chase",
      worldId: "world-v1-harbor-datahub",
      stageId: "hb-stage-latest",
      question: "Who should I chase today on Harbor?",
      categories: ["actionability", "people", "prioritisation", "dependency"],
      expectedAnswer:
        "Elena for overdue written confirmation and staging credentials; Platform/INC-4412 for harbor-int; Legal for MSA amendment.",
      expectedFacts: ["Elena"],
      supportingFacts: ["INC-4412", "MSA", "credentials"],
      forbiddenClaims: ["Nothing to chase"],
      evaluatorNotes:
        "Contract §12 — Elena/credentials is the core chase; MSA/env are important support. Missing MSA alone → partial via supporting, not hard fail. Mark manual_review if prioritisation disputes arise.",
      presentationNotes: "manual_review_required for completeness disputes",
    },
    {
      id: "v1-harbor-q7-mock-api",
      worldId: "world-v1-harbor-datahub",
      stageId: "hb-stage-latest",
      question: "Can we use mocks for integration testing?",
      categories: ["accuracy", "dependency", "restraint", "grounding"],
      expectedAnswer:
        "No for integration tests — Maya said mocks are fine for unit tests only; integration tests require real staging.",
      expectedFacts: ["unit tests", "real staging"],
      forbiddenClaims: [
        "Mocks are sufficient for integration tests",
        "Integration tests can use mocks only",
      ],
    },
    {
      id: "v1-harbor-q8-slip-confirmed",
      worldId: "world-v1-harbor-datahub",
      stageId: "hb-stage-latest",
      question: "Has the integration start officially moved to 15 September?",
      categories: ["temporal", "uncertainty", "restraint", "trust"],
      expectedAnswer:
        "No — 15 September was only suggested; no formal replan recorded. Formal target remains 8 September unless changed.",
      expectedFacts: ["not formal", "8 September"],
      supportingFacts: ["suggested", "15 September"],
      forbiddenClaims: [
        "Officially moved to 15 September",
        "Target is now 15 September",
        "integration start is now 15 September",
      ],
      expectUncertainty: true,
      evaluatorNotes:
        "Contract §5. Negated 'has not officially moved' must not match forbidden 'Officially moved…'.",
    },
    {
      id: "v1-harbor-q9-credentials-received",
      worldId: "world-v1-harbor-datahub",
      stageId: "hb-stage-latest",
      question: "Have we received Harbor staging credentials?",
      categories: ["recall", "accuracy", "grounding", "restraint"],
      expectedAnswer: "No — staging credentials still not received.",
      expectedFacts: ["not received"],
      forbiddenClaims: [
        "Credentials have been received",
        "We have staging credentials",
      ],
    },
  ],
};
