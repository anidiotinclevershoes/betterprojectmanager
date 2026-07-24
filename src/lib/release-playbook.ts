import type { ReleaseStage } from "./types";

export interface PlaybookStageDefinition {
  stage: ReleaseStage;
  label: string;
  coachingFocus: string;
  typicalArtefacts: string[];
  leadershipQuestions: string[];
}

/**
 * Monthly release lifecycle Mission Control understands and coaches through.
 */
export const RELEASE_PLAYBOOK: PlaybookStageDefinition[] = [
  {
    stage: "merge_window",
    label: "Merge window",
    coachingFocus:
      "Protect the release train. Know what is in, what is deferred, and who owns late merge pressure.",
    typicalArtefacts: ["Merge freeze notice", "Change list", "Deferred items log"],
    leadershipQuestions: [
      "What is still trying to squeeze in, and who is asking?",
      "Have deferred items been communicated to sponsors?",
    ],
  },
  {
    stage: "build_validation",
    label: "Build validation",
    coachingFocus:
      "Treat build instability as a leadership risk, not only a technical inconvenience — especially if it recurred last release.",
    typicalArtefacts: ["Green build evidence", "Known defect list", "Gate criteria"],
    leadershipQuestions: [
      "Do we have consecutive green runs we can show CAB?",
      "Is flakiness owned with a dated fix plan?",
    ],
  },
  {
    stage: "regression_testing",
    label: "Regression testing",
    coachingFocus:
      "Connect regression evidence to stakeholder concerns from previous releases.",
    typicalArtefacts: [
      "Regression pack",
      "Module sign-offs",
      "Billing / critical path evidence",
    ],
    leadershipQuestions: [
      "Which areas worried sponsors last time — are they covered?",
      "What would make Finance comfortable?",
    ],
  },
  {
    stage: "cab_preparation",
    label: "CAB preparation",
    coachingFocus:
      "Arrive at CAB with narrative, evidence, residual risks and named owners — never scramble in the room.",
    typicalArtefacts: [
      "CAB pack",
      "Rollback plan",
      "Risk summary",
      "Hypercare roster",
    ],
    leadershipQuestions: [
      "What question will surprise me in CAB?",
      "Which residual risk still lacks an owner?",
    ],
  },
  {
    stage: "cab_approval",
    label: "CAB approval",
    coachingFocus:
      "Own the story. Answer conditions calmly. Capture any approval conditions as explicit follow-ups.",
    typicalArtefacts: ["Approval record", "Conditions log"],
    leadershipQuestions: [
      "What conditions were attached, and who owns closing them?",
    ],
  },
  {
    stage: "release_readiness",
    label: "Release readiness",
    coachingFocus:
      "Run a hard go/no-go. Prefer an early no-go you own over a late incident you explain.",
    typicalArtefacts: ["Go/no-go checklist", "Comms plan", "Support brief"],
    leadershipQuestions: [
      "If we released tonight, what would keep me awake?",
    ],
  },
  {
    stage: "production_deployment",
    label: "Production deployment",
    coachingFocus:
      "Be visible, calm and available. Know rollback triggers before you need them.",
    typicalArtefacts: ["Deployment runbook", "Rollback triggers", "War-room channel"],
    leadershipQuestions: [
      "Who makes the rollback call, and at what threshold?",
    ],
  },
  {
    stage: "smoke_testing",
    label: "Smoke testing",
    coachingFocus:
      "Verify critical paths that matter to sponsors — not only technical health checks.",
    typicalArtefacts: ["Smoke checklist", "Business path results"],
    leadershipQuestions: [
      "Have we proven the paths Finance and Operations care about?",
    ],
  },
  {
    stage: "hypercare",
    label: "Hypercare",
    coachingFocus:
      "Confirm named coverage. Silent staffing gaps become production narratives.",
    typicalArtefacts: ["Named roster", "Escalation path", "Defect triage rhythm"],
    leadershipQuestions: [
      "Is coverage named for every shift — in writing?",
    ],
  },
  {
    stage: "release_closure",
    label: "Release closure",
    coachingFocus:
      "Capture lessons into institutional memory while they are fresh — especially delays, surprises and stakeholder reactions.",
    typicalArtefacts: [
      "Closure report",
      "Lessons learned",
      "Release history note",
    ],
    leadershipQuestions: [
      "What should future-me remember about this release in six months?",
    ],
  },
];

export function getPlaybookStage(stage: ReleaseStage) {
  return RELEASE_PLAYBOOK.find((s) => s.stage === stage);
}
