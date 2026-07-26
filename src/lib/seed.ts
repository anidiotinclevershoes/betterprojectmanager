import type {
  Meeting,
  MemoryEntry,
  MissionState,
  Project,
  ProjectKnowledge,
  Recommendation,
  Release,
  TodoItem,
} from "./types";

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();
const daysFromNow = (d: number) => new Date(now + d * 86400000).toISOString();

export const DEMO_PROJECTS: Project[] = [
  {
    id: "proj-atlas",
    name: "Atlas Platform Modernisation",
    code: "ATLAS",
    summary:
      "Multi-year platform modernisation delivering monthly releases into production. Finance and Operations are the primary stakeholders; Development Lead owns build stability.",
    status: "watch",
    currentFocus: "Release 9 CAB preparation and regression sign-off",
    nextMilestone: "CAB approval for Release 9",
    nextMilestoneAt: daysFromNow(4),
    stakeholders: [
      {
        id: "st-finance",
        name: "Priya Shah",
        role: "Finance Sponsor",
        preferences: [
          "Wants concise written updates before verbal briefings",
          "Sensitive to cost overrun language — frame as investment vs delay",
        ],
        concerns: [
          "Release 8 delay impact on Q3 reporting timeline",
          "Whether regression coverage is adequate for billing modules",
        ],
        lastContactAt: daysAgo(16),
      },
      {
        id: "st-ops",
        name: "Marcus Webb",
        role: "Operations Lead",
        preferences: ["Prefers early escalation over late surprises"],
        concerns: ["Hypercare staffing for Release 9"],
        lastContactAt: daysAgo(5),
      },
      {
        id: "st-dev",
        name: "Elena Rostova",
        role: "Development Lead",
        preferences: ["Responds well to specific evidence, not vague pressure"],
        concerns: ["Build flakiness on the payments pipeline"],
        lastContactAt: daysAgo(1),
      },
    ],
  },
  {
    id: "proj-horizon",
    name: "Horizon Customer Portal",
    code: "HORIZON",
    summary:
      "Customer-facing portal rebrand and SSO migration. Roadmap priorities have shifted three times since the last stakeholder workshop.",
    status: "at_risk",
    currentFocus: "Re-baselining scope after SSO vendor delay",
    nextMilestone: "Roadmap Review with sponsors",
    nextMilestoneAt: daysFromNow(7),
    stakeholders: [
      {
        id: "st-cx",
        name: "Jordan Lee",
        role: "Customer Experience Director",
        preferences: ["Needs visual demos, not status slides"],
        concerns: ["Brand launch date is publicly committed"],
        lastContactAt: daysAgo(21),
      },
    ],
  },
];

export const DEMO_MEMORIES: MemoryEntry[] = [
  {
    id: "mem-r8-delay",
    type: "release_history",
    projectId: "proj-atlas",
    title: "Why Release 8 was delayed",
    content:
      "Release 8 delayed by 11 days. Root cause: payments pipeline build instability discovered late in regression. CAB deferred approval pending green build consecutive runs. Finance concerned about Q3 reporting cutover. Decision: harden build gates before Release 9 merge window closes.",
    tags: ["release-8", "delay", "payments", "CAB", "finance"],
    people: ["Priya Shah", "Elena Rostova"],
    occurredAt: daysAgo(45),
    createdAt: daysAgo(45),
    source: "release",
  },
  {
    id: "mem-finance-concern",
    type: "stakeholder_preference",
    projectId: "proj-atlas",
    title: "Finance concern on billing regression",
    content:
      "Priya Shah asked explicitly whether billing module regression coverage improved after Release 8. She wants evidence of consecutive green builds before CAB. Prefers a one-page written brief 24h before any verbal update.",
    tags: ["finance", "regression", "CAB", "billing"],
    people: ["Priya Shah"],
    occurredAt: daysAgo(12),
    createdAt: daysAgo(12),
    source: "meeting",
  },
  {
    id: "mem-cab-r7",
    type: "decision",
    projectId: "proj-atlas",
    title: "CAB approved Release 7",
    content:
      "CAB approved Release 7 on the scheduled board date with one condition: smoke tests must include billing reconciliation script. Condition met during hypercare day 1.",
    tags: ["CAB", "release-7", "approval"],
    people: ["CAB Board"],
    occurredAt: daysAgo(78),
    createdAt: daysAgo(78),
    source: "release",
  },
  {
    id: "mem-build-recurring",
    type: "recurring_issue",
    projectId: "proj-atlas",
    title: "Build stability raised in three consecutive meetings",
    content:
      "Build stability / payments pipeline flakiness appeared in stand-up notes three meetings running. Elena acknowledged intermittent failures. No formal escalation yet. Pattern suggests ownership clarification and a concrete stability plan are overdue.",
    tags: ["build", "stability", "recurring", "payments"],
    people: ["Elena Rostova"],
    occurredAt: daysAgo(2),
    createdAt: daysAgo(2),
    source: "meeting",
  },
  {
    id: "mem-roadmap-workshop",
    type: "decision",
    projectId: "proj-horizon",
    title: "Roadmap workshop decisions",
    content:
      "Workshop decided: (1) SSO migration is critical path, (2) self-serve password reset deprioritised, (3) brand launch remains fixed date, (4) vendor delay absorbs buffer — no further scope without sponsor trade-off.",
    tags: ["roadmap", "SSO", "workshop", "scope"],
    people: ["Jordan Lee"],
    occurredAt: daysAgo(30),
    createdAt: daysAgo(30),
    source: "meeting",
  },
  {
    id: "mem-priority-shifts",
    type: "roadmap_change",
    projectId: "proj-horizon",
    title: "Five priority changes since last stakeholder update",
    content:
      "Since last stakeholder update (21 days ago): SSO vendor delay, password reset deprioritised, help-centre content pulled forward, analytics dashboard slipped, mobile web polish added. Sponsors have not been formally walked through the new shape.",
    tags: ["roadmap", "priorities", "stakeholder-update"],
    people: ["Jordan Lee"],
    occurredAt: daysAgo(3),
    createdAt: daysAgo(3),
    source: "system",
  },
  {
    id: "mem-ops-hypercare",
    type: "risk",
    projectId: "proj-atlas",
    title: "Hypercare staffing gap for Release 9",
    content:
      "Marcus Webb flagged that two of four hypercare engineers are on leave the week of Release 9. Assumption: coverage plan exists — not confirmed in writing.",
    tags: ["hypercare", "staffing", "release-9", "assumption"],
    people: ["Marcus Webb"],
    occurredAt: daysAgo(5),
    createdAt: daysAgo(5),
    source: "capture",
  },
];

export const DEMO_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-finance-update",
    kind: "stakeholder_update",
    urgency: "today",
    title: "Send Priya a written Release 9 brief",
    action:
      "Send a one-page written update to Priya Shah covering consecutive green builds, billing regression evidence, and CAB timing.",
    why: "There has been significant progress toward Release 9 and no communication with Finance for over two weeks. She explicitly prefers written briefs before verbal updates — and still carries concern from the Release 8 delay.",
    leadershipImpact:
      "You look proactive and in control of the sponsor relationship, not reactive on CAB day.",
    projectId: "proj-atlas",
    relatedMemoryIds: ["mem-finance-concern", "mem-r8-delay"],
    suggestedScript:
      "Priya — ahead of CAB I've attached a one-page Release 9 readiness brief: build gate results, billing regression evidence since Release 8, and residual risks. Happy to walk through any questions before the board.",
    createdAt: daysAgo(0),
    status: "active",
  },
  {
    id: "rec-challenge-build",
    kind: "leadership",
    urgency: "now",
    title: "Challenge Elena on build stability with evidence",
    action:
      "In your next conversation with Elena, table the three consecutive meeting mentions of payments pipeline flakiness and ask for a dated stability plan before CAB.",
    why: "Build stability has appeared in three consecutive meetings. Leaving it unspoken risks another late CAB deferral like Release 8.",
    leadershipImpact:
      "You demonstrate ownership of delivery risk before stakeholders discover it.",
    projectId: "proj-atlas",
    relatedMemoryIds: ["mem-build-recurring", "mem-r8-delay"],
    suggestedScript:
      "Elena — build stability has now come up in three meetings running. Before CAB I need a concrete plan: what's failing, what's the fix, and when do we have consecutive green runs we can show Finance?",
    createdAt: daysAgo(0),
    status: "active",
  },
  {
    id: "rec-roadmap-review",
    kind: "meeting",
    urgency: "this_week",
    title: "Call a Roadmap Review for Horizon",
    action:
      "Arrange a Roadmap Review with Jordan Lee to walk through the five priority changes since the last stakeholder update.",
    why: "Five priorities have changed since the last stakeholder update, and Jordan has not been contacted in three weeks while a public brand date remains fixed.",
    leadershipImpact:
      "You lead the narrative on scope change instead of being surprised by it in a steering meeting.",
    projectId: "proj-horizon",
    relatedMemoryIds: ["mem-priority-shifts", "mem-roadmap-workshop"],
    suggestedScript:
      "Jordan — priorities have shifted materially since our last update. I'd like 45 minutes this week to walk you through the new shape against the brand launch date and agree trade-offs in writing.",
    createdAt: daysAgo(0),
    status: "active",
  },
  {
    id: "rec-hypercare",
    kind: "risk",
    urgency: "today",
    title: "Confirm Release 9 hypercare coverage in writing",
    action:
      "Ask Marcus for a named hypercare roster covering the leave gap, and log the assumption if coverage is still unconfirmed.",
    why: "A staffing gap was flagged five days ago. An unconfirmed assumption this close to release is a surprise waiting for CAB and go-live.",
    leadershipImpact:
      "You close a silent risk before it becomes a production incident narrative.",
    projectId: "proj-atlas",
    relatedMemoryIds: ["mem-ops-hypercare"],
    createdAt: daysAgo(0),
    status: "active",
  },
  {
    id: "rec-cab-prep",
    kind: "release",
    urgency: "today",
    title: "Complete CAB pack artefacts for Release 9",
    action:
      "Confirm CAB pack has: change record, regression evidence, rollback plan, and hypercare roster before the board date.",
    why: "CAB is four days out. Missing artefacts are the fastest way to look unprepared in front of the board.",
    leadershipImpact:
      "You walk into CAB as the person who already closed the gaps others would scramble on.",
    projectId: "proj-atlas",
    createdAt: daysAgo(0),
    status: "active",
  },
];

export const DEMO_MEETINGS: Meeting[] = [
  {
    id: "mtg-cab-prep",
    projectId: "proj-atlas",
    title: "Release 9 CAB Preparation",
    startsAt: daysFromNow(1),
    attendees: ["Priya Shah", "Marcus Webb", "Elena Rostova", "You"],
    phase: "upcoming",
    prep: {
      objectives: [
        "Confirm Release 9 readiness narrative before CAB",
        "Surface residual risks with owners and mitigation dates",
        "Obtain agreement on hypercare roster",
      ],
      openingScript:
        "Thanks everyone. Purpose of this session: walk the CAB narrative for Release 9, confirm evidence Finance will expect, and leave with named owners on every residual risk — especially build stability and hypercare coverage.",
      talkingPoints: [
        "What changed since Release 8 delay and how gates improved",
        "Billing regression evidence and consecutive green builds",
        "Hypercare staffing gap and proposed coverage",
        "Rollback plan and go/no-go criteria",
      ],
      questionsToAsk: [
        "Elena — when will we have consecutive green payments pipeline runs we can show CAB?",
        "Marcus — can we confirm named hypercare cover for the leave week today?",
        "Priya — what evidence would make you comfortable supporting approval?",
      ],
      decisionsToObtain: [
        "Go/no-go criteria for CAB submission",
        "Named hypercare roster",
        "Owner and date for build stability plan",
      ],
      risksToDiscuss: [
        "Payments pipeline flakiness recurring across meetings",
        "Hypercare staffing gap",
        "Finance confidence after Release 8 delay",
      ],
      peopleToEngage: [
        "Elena — challenge with evidence, not pressure",
        "Marcus — close staffing assumption",
        "Priya — invite her criteria into the room so CAB is not a surprise",
      ],
      leadershipOpportunities: [
        "Open by framing lessons from Release 8 — shows learning, not defensiveness",
        "Propose the go/no-go criteria yourself rather than waiting to be asked",
        "Offer to send Priya the written brief within 2 hours of the meeting",
      ],
      stakeholderConcerns: [
        "Priya: billing regression and late surprises",
        "Marcus: hypercare capacity",
        "Elena: being blamed for systemic pipeline flakiness without support",
      ],
      ownershipMoments: [
        "You own the CAB narrative end-to-end",
        "You own closing the hypercare assumption before board day",
        "You own translating technical build risk into sponsor language",
      ],
    },
    duringPrompts: [
      {
        id: "dp-1",
        prompt: "Clarify ownership",
        context: "Who owns the build stability plan and by when?",
      },
      {
        id: "dp-2",
        prompt: "Challenge the timeline",
        context: "Is consecutive green build evidence achievable before CAB?",
      },
      {
        id: "dp-3",
        prompt: "Confirm the decision",
        context: "Explicitly restate go/no-go criteria and get verbal agreement.",
      },
      {
        id: "dp-4",
        prompt: "Ask about release readiness",
        context: "Rollback plan, smoke tests, hypercare roster — say each aloud.",
      },
      {
        id: "dp-5",
        prompt: "Capture an action",
        context: "Name, date, artefact — especially for Priya's written brief.",
      },
    ],
  },
  {
    id: "mtg-horizon-sync",
    projectId: "proj-horizon",
    title: "Horizon weekly delivery sync",
    startsAt: daysFromNow(2),
    attendees: ["Jordan Lee", "Delivery team", "You"],
    phase: "upcoming",
    prep: {
      objectives: [
        "Align on the five priority shifts since last sponsor update",
        "Protect the public brand launch date with explicit trade-offs",
      ],
      openingScript:
        "Quick context: five priorities have moved since our last sponsor update. Today I want us aligned on the story we will tell Jordan — what slipped, what was pulled forward, and what trade-off protects the brand date.",
      talkingPoints: [
        "SSO vendor delay impact",
        "Deprioritised password reset",
        "Items pulled forward vs slipped",
      ],
      questionsToAsk: [
        "What must be true for brand launch to stay fixed?",
        "Which items are we prepared to formally descope?",
      ],
      decisionsToObtain: [
        "Agree the narrative for the Roadmap Review",
        "Confirm critical path after vendor delay",
      ],
      risksToDiscuss: [
        "Sponsor surprise if priorities land without a walkthrough",
        "Brand date risk if SSO slips further",
      ],
      peopleToEngage: ["Delivery leads on critical path clarity"],
      leadershipOpportunities: [
        "Propose the Roadmap Review agenda yourself",
        "Frame trade-offs as leadership decisions, not team failure",
      ],
      stakeholderConcerns: [
        "Jordan: public brand commitment and visual proof of progress",
      ],
      ownershipMoments: [
        "You own arranging the Roadmap Review this week",
      ],
    },
    duringPrompts: [
      {
        id: "dp-h1",
        prompt: "Identify the dependency",
        context: "SSO vendor — what is the next dated checkpoint?",
      },
      {
        id: "dp-h2",
        prompt: "Confirm the decision",
        context: "Capture any scope trade-off as an explicit decision.",
      },
    ],
  },
];

export const DEMO_RELEASES: Release[] = [
  {
    id: "rel-atlas-9",
    projectId: "proj-atlas",
    name: "Release 9",
    targetDate: daysFromNow(8),
    currentStage: "cab_preparation",
    risks: [
      "Payments pipeline build flakiness may block CAB confidence",
      "Hypercare roster not confirmed in writing",
    ],
    stages: [
      {
        stage: "merge_window",
        label: "Merge window",
        status: "complete",
        notes: "Closed on schedule",
      },
      {
        stage: "build_validation",
        label: "Build validation",
        status: "at_risk",
        notes: "Intermittent payments pipeline failures",
        missingArtefacts: ["Consecutive green build evidence"],
      },
      {
        stage: "regression_testing",
        label: "Regression testing",
        status: "current",
        dueAt: daysFromNow(2),
        notes: "Billing modules in progress",
        missingArtefacts: ["Billing regression sign-off"],
      },
      {
        stage: "cab_preparation",
        label: "CAB preparation",
        status: "current",
        dueAt: daysFromNow(3),
        missingArtefacts: [
          "CAB pack",
          "Rollback plan confirmation",
          "Hypercare roster",
        ],
      },
      {
        stage: "cab_approval",
        label: "CAB approval",
        status: "upcoming",
        dueAt: daysFromNow(4),
      },
      {
        stage: "release_readiness",
        label: "Release readiness",
        status: "upcoming",
        dueAt: daysFromNow(6),
      },
      {
        stage: "production_deployment",
        label: "Production deployment",
        status: "upcoming",
        dueAt: daysFromNow(8),
      },
      {
        stage: "smoke_testing",
        label: "Smoke testing",
        status: "upcoming",
        dueAt: daysFromNow(8),
      },
      {
        stage: "hypercare",
        label: "Hypercare",
        status: "at_risk",
        dueAt: daysFromNow(8),
        notes: "Staffing gap flagged",
        missingArtefacts: ["Named hypercare roster"],
      },
      {
        stage: "release_closure",
        label: "Release closure",
        status: "upcoming",
        dueAt: daysFromNow(15),
      },
    ],
  },
];

export const DEMO_TODOS: TodoItem[] = [
  {
    id: "todo-cab-pack",
    projectId: "proj-atlas",
    title: "Finalise Release 9 CAB pack artefacts",
    detail: "Change record, regression evidence, rollback plan, hypercare roster",
    done: false,
    createdAt: daysAgo(1),
  },
  {
    id: "todo-billing-signoff",
    projectId: "proj-atlas",
    title: "Chase billing regression sign-off",
    done: false,
    createdAt: daysAgo(1),
  },
  {
    id: "todo-horizon-tradeoffs",
    projectId: "proj-horizon",
    title: "Draft brand-date trade-off options for Jordan",
    detail: "2–3 options with a clear recommendation",
    done: false,
    createdAt: daysAgo(0),
  },
];

export const DEMO_KNOWLEDGE: ProjectKnowledge[] = [
  {
    projectId: "proj-atlas",
    updatedAt: daysAgo(0),
    sections: {
      now: [
        "Release 9 in CAB preparation; regression and build evidence still the critical path",
        "Payments pipeline flakiness remains the main technical watch item after Release 8",
      ],
      decisions: [
        "Harden build gates before Release 9 merge window closes (post Release 8 delay)",
        "CAB pack must include billing regression evidence Finance will recognise",
      ],
      risks: [
        "Build stability mentioned in three consecutive meetings without a dated plan",
        "Hypercare roster not confirmed in writing for leave week",
      ],
      people: [
        "Priya Shah (Finance): prefers written brief 24h before verbal; still sensitive after Release 8 delay",
        "Elena Rostova: responds to specific evidence, not vague pressure on pipeline flakiness",
      ],
      openLoops: [
        "Named hypercare cover from Marcus still unconfirmed",
        "Consecutive green payments builds needed before CAB narrative is safe",
      ],
    },
  },
  {
    projectId: "proj-horizon",
    updatedAt: daysAgo(1),
    sections: {
      now: [
        "SSO vendor delay is on the critical path; brand launch date remains fixed publicly",
        "Five priority shifts since last sponsor update have not been walked through with Jordan",
      ],
      decisions: [
        "SSO migration is critical path; password reset deprioritised",
        "No further scope without sponsor trade-off against brand date",
      ],
      risks: [
        "Sponsor surprise if priority changes land without a formal Roadmap Review",
      ],
      people: [
        "Jordan Lee: needs visual demos; brand launch date is publicly committed",
      ],
      openLoops: [
        "Roadmap Review with Jordan still to be arranged this week",
      ],
    },
  },
];

export function createSeedState(): MissionState {
  return {
    projects: DEMO_PROJECTS,
    memories: DEMO_MEMORIES,
    recommendations: DEMO_RECOMMENDATIONS,
    meetings: DEMO_MEETINGS,
    releases: DEMO_RELEASES,
    todos: DEMO_TODOS,
    knowledge: DEMO_KNOWLEDGE,
    lastAnalyzedAt: new Date().toISOString(),
  };
}
