import type {
  Meeting,
  MemoryEntry,
  MissionState,
  Project,
  ProjectKnowledge,
  Recommendation,
  Release,
  TimelineItem,
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
    kind: "delivery",
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
    kind: "delivery",
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
  {
    id: "proj-relops",
    name: "Monthly Release Operations",
    code: "RELOPS",
    kind: "release_ops",
    isTemplate: true,
    releaseMonth: "March 2026",
    mergeDate: daysFromNow(0),
    releaseDate: daysFromNow(8),
    summary:
      "Repeatable monthly release train: collect evidence, chase artefacts, run the process forums, and submit a complete CAB pack. Success is preparedness and clean handoffs — not feature delivery.",
    status: "watch",
    currentFocus: "March release train — CAB pack completeness and evidence chase",
    nextMilestone: "CAB board submission",
    nextMilestoneAt: daysFromNow(5),
    stakeholders: [
      {
        id: "st-cab",
        name: "CAB Secretariat",
        role: "Change Advisory Board",
        preferences: [
          "Pack must be complete 24h before board",
          "No verbal-only risk statements",
        ],
        concerns: ["Late artefact submissions"],
        lastContactAt: daysAgo(8),
      },
      {
        id: "st-qa",
        name: "Sam Okonkwo",
        role: "QA Lead",
        preferences: ["Wants evidence logged in the shared tracker"],
        concerns: ["Regression sign-off owners still unclear on two modules"],
        lastContactAt: daysAgo(2),
      },
      {
        id: "st-rm",
        name: "Nina Patel",
        role: "Release Manager peer",
        preferences: ["Prefers checklist updates in the release channel"],
        concerns: ["Rollback plan still in draft"],
        lastContactAt: daysAgo(1),
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
  {
    id: "rec-relops-tracker",
    kind: "release",
    urgency: "now",
    title: "Close unsigned modules in the evidence tracker",
    action:
      "Chase Sam for the two unsigned modules and require tracker links — not verbal confirmation — before CAB pack walkthrough.",
    why: "RELOPS succeeds on pack completeness. Verbal sign-off is how submissions get rejected.",
    leadershipImpact:
      "You look process-tight and dependable in front of CAB Secretariat.",
    projectId: "proj-relops",
    createdAt: daysAgo(0),
    status: "active",
  },
  {
    id: "rec-relops-rollback",
    kind: "risk",
    urgency: "today",
    title: "Convert rollback plan from draft to CAB-ready",
    action:
      "Sit with Nina, close draft gaps, and attach the final rollback plan to the pack today.",
    why: "A draft rollback plan is one of the fastest CAB rejection reasons on a monthly train.",
    leadershipImpact:
      "You remove a predictable board embarrassment before it happens.",
    projectId: "proj-relops",
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
  {
    id: "mtg-rel-freeze",
    projectId: "proj-relops",
    title: "Merge freeze / change window kickoff",
    startsAt: daysFromNow(0.5),
    attendees: ["Nina Patel", "Sam Okonkwo", "Dev leads", "You"],
    phase: "upcoming",
    prep: {
      objectives: [
        "Confirm what is in / deferred for this month's train",
        "Publish freeze rules and late-change escalation path",
      ],
      openingScript:
        "Purpose: lock the March release contents. I need a clear in/out list, owners for late-change pressure, and confirmation freeze communications go out today.",
      talkingPoints: [
        "Candidate change list vs deferred items",
        "Freeze notice and channel for exceptions",
        "Evidence tracker owners by module",
      ],
      questionsToAsk: [
        "Which changes are still lobbying to get in — and who is asking?",
        "Who owns updating the shared evidence tracker after freeze?",
      ],
      decisionsToObtain: [
        "Final in-scope change list",
        "Exception approval path for post-freeze requests",
      ],
      risksToDiscuss: ["Late merges that break the evidence timeline"],
      peopleToEngage: ["Nina on freeze comms", "Sam on evidence expectations"],
      leadershipOpportunities: [
        "State the freeze as a leadership decision, not a technical preference",
      ],
      stakeholderConcerns: ["Teams surprised by deferred items"],
      ownershipMoments: ["You own the published freeze notice"],
    },
    duringPrompts: [
      {
        id: "dp-rf1",
        prompt: "Confirm the decision",
        context: "Restate the in/out list and get verbal agreement.",
      },
      {
        id: "dp-rf2",
        prompt: "Capture an action",
        context: "Name the evidence tracker owner per module.",
      },
    ],
  },
  {
    id: "mtg-rel-build",
    projectId: "proj-relops",
    title: "Build validation review",
    startsAt: daysFromNow(2),
    attendees: ["Dev leads", "Nina Patel", "You"],
    phase: "upcoming",
    prep: {
      objectives: [
        "Confirm green-build evidence exists for CAB",
        "Surface flaky gates with owners and dates",
      ],
      openingScript:
        "We're here to validate build health for the March train. I need consecutive green evidence we can put in the CAB pack — not optimism.",
      talkingPoints: [
        "Gate results since freeze",
        "Known flake list and fix dates",
        "What CAB will see as proof",
      ],
      questionsToAsk: [
        "Which builds are CAB-ready today?",
        "What is still red and who owns the fix date?",
      ],
      decisionsToObtain: ["Whether build evidence is sufficient to proceed"],
      risksToDiscuss: ["Hidden flake debt discovered late"],
      peopleToEngage: ["Dev leads with specific gate results"],
      leadershipOpportunities: [
        "Refuse vague 'looking better' language — ask for artefacts",
      ],
      stakeholderConcerns: ["CAB rejecting incomplete build proof"],
      ownershipMoments: ["You own what goes into the pack as build evidence"],
    },
    duringPrompts: [
      {
        id: "dp-rb1",
        prompt: "Challenge the timeline",
        context: "Can fix dates land before CAB pack submission?",
      },
    ],
  },
  {
    id: "mtg-rel-regression",
    projectId: "proj-relops",
    title: "Regression & evidence sync",
    startsAt: daysFromNow(3),
    attendees: ["Sam Okonkwo", "Module owners", "You"],
    phase: "upcoming",
    prep: {
      objectives: [
        "Close missing regression sign-offs",
        "Confirm evidence is filed in the shared tracker",
      ],
      openingScript:
        "This is an evidence chase, not a status tour. I need named sign-offs and tracker links for every critical module before CAB pack freeze.",
      talkingPoints: [
        "Modules still unsigned",
        "Tracker gaps",
        "Business-critical paths CAB cares about",
      ],
      questionsToAsk: [
        "Sam — which two modules are still blocking sign-off?",
        "Where is the evidence link if I open the tracker now?",
      ],
      decisionsToObtain: ["Deadline for remaining sign-offs"],
      risksToDiscuss: ["Verbal sign-off without artefacts"],
      peopleToEngage: ["Sam and unsigned module owners"],
      leadershipOpportunities: [
        "Make the tracker the source of truth in the room",
      ],
      stakeholderConcerns: ["CAB Secretariat rejecting incomplete packs"],
      ownershipMoments: ["You own pack completeness, not just chasing"],
    },
    duringPrompts: [
      {
        id: "dp-rr1",
        prompt: "Clarify ownership",
        context: "Each unsigned module needs a name and time.",
      },
    ],
  },
  {
    id: "mtg-rel-cab-pack",
    projectId: "proj-relops",
    title: "CAB pack walkthrough",
    startsAt: daysFromNow(4),
    attendees: ["Nina Patel", "Sam Okonkwo", "You"],
    phase: "upcoming",
    prep: {
      objectives: [
        "Walk the full CAB pack end-to-end",
        "List residual gaps before submission",
      ],
      openingScript:
        "We'll walk the pack page by page. Goal: leave with a gap list and owners — not a hope that it's 'mostly done'.",
      talkingPoints: [
        "Change record",
        "Regression evidence",
        "Rollback plan",
        "Hypercare roster",
        "Residual risks",
      ],
      questionsToAsk: [
        "What is still draft?",
        "What would CAB Secretariat reject tomorrow morning?",
      ],
      decisionsToObtain: ["Go/no-go to submit the pack"],
      risksToDiscuss: ["Draft rollback plan", "Missing hypercare names"],
      peopleToEngage: ["Nina on rollback", "Sam on evidence annex"],
      leadershipOpportunities: [
        "Be the person who finds gaps before CAB does",
      ],
      stakeholderConcerns: ["Incomplete submission embarrassing the train"],
      ownershipMoments: ["You own the submission decision"],
    },
    duringPrompts: [
      {
        id: "dp-rcp1",
        prompt: "Capture an action",
        context: "Every gap needs owner + time before board.",
      },
    ],
  },
  {
    id: "mtg-rel-cab-board",
    projectId: "proj-relops",
    title: "CAB board",
    startsAt: daysFromNow(5),
    attendees: ["CAB Secretariat", "Approvers", "You"],
    phase: "upcoming",
    prep: {
      objectives: [
        "Present a complete, calm release narrative",
        "Answer conditions without scrambling",
      ],
      openingScript:
        "Thank you. March release train: scope frozen, build evidence attached, regression sign-offs logged, residual risks with owners. Happy to take conditions.",
      talkingPoints: [
        "What changed since last month",
        "Evidence highlights",
        "Residual risks and mitigations",
        "Rollback and hypercare readiness",
      ],
      questionsToAsk: [
        "Any conditions we should capture explicitly before leaving?",
      ],
      decisionsToObtain: ["CAB approval or conditional approval"],
      risksToDiscuss: ["Known residual risks already in the pack"],
      peopleToEngage: ["CAB Secretariat on process completeness"],
      leadershipOpportunities: [
        "Lead with evidence, not reassurance",
      ],
      stakeholderConcerns: ["Surprise gaps in the pack"],
      ownershipMoments: ["You own the board narrative"],
    },
    duringPrompts: [
      {
        id: "dp-rcb1",
        prompt: "Confirm the decision",
        context: "Restate approval/conditions before the meeting closes.",
      },
    ],
  },
  {
    id: "mtg-rel-golive",
    projectId: "proj-relops",
    title: "Go-live & hypercare readiness",
    startsAt: daysFromNow(7),
    attendees: ["Nina Patel", "Ops", "You"],
    phase: "upcoming",
    prep: {
      objectives: [
        "Confirm go/no-go criteria and named hypercare cover",
        "Agree rollback triggers before deployment",
      ],
      openingScript:
        "Final readiness check: named hypercare roster, rollback triggers, and the go/no-go call. If anything is still assumed, we surface it now.",
      talkingPoints: [
        "Hypercare roster",
        "Rollback triggers",
        "Comms plan",
        "Smoke paths",
      ],
      questionsToAsk: [
        "Is every hypercare shift named in writing?",
        "Who makes the rollback call and at what threshold?",
      ],
      decisionsToObtain: ["Go/no-go for production"],
      risksToDiscuss: ["Unnamed cover", "Unclear rollback authority"],
      peopleToEngage: ["Ops leads on cover", "Nina on runbook"],
      leadershipOpportunities: [
        "Prefer an early no-go you own over a late incident narrative",
      ],
      stakeholderConcerns: ["Production surprises after CAB approval"],
      ownershipMoments: ["You own the go/no-go recommendation"],
    },
    duringPrompts: [
      {
        id: "dp-rg1",
        prompt: "Ask about release readiness",
        context: "Roster, rollback, smoke — say each aloud.",
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
    dueAt: daysFromNow(3),
  },
  {
    id: "todo-billing-signoff",
    projectId: "proj-atlas",
    title: "Chase billing regression sign-off",
    done: false,
    createdAt: daysAgo(1),
    dueAt: daysFromNow(2),
  },
  {
    id: "todo-horizon-tradeoffs",
    projectId: "proj-horizon",
    title: "Draft brand-date trade-off options for Jordan",
    detail: "2–3 options with a clear recommendation",
    done: false,
    createdAt: daysAgo(0),
    dueAt: daysFromNow(5),
  },
  {
    id: "todo-rel-freeze-notice",
    projectId: "proj-relops",
    title: "Publish March merge freeze notice",
    detail: "In/out list + exception path in release channel",
    done: false,
    createdAt: daysAgo(0),
    dueAt: daysFromNow(0),
  },
  {
    id: "todo-rel-tracker",
    projectId: "proj-relops",
    title: "Chase two unsigned modules into evidence tracker",
    detail: "Require links from Sam — no verbal sign-off",
    done: false,
    createdAt: daysAgo(0),
    dueAt: daysFromNow(2),
  },
  {
    id: "todo-rel-rollback",
    projectId: "proj-relops",
    title: "Finalise rollback plan with Nina",
    detail: "Move from draft to CAB-ready attachment",
    done: false,
    createdAt: daysAgo(0),
    dueAt: daysFromNow(3),
  },
  {
    id: "todo-rel-hypercare",
    projectId: "proj-relops",
    title: "Collect named hypercare roster",
    detail: "Every shift named in writing before go-live forum",
    done: false,
    createdAt: daysAgo(0),
    dueAt: daysFromNow(6),
  },
  {
    id: "todo-rel-pack-submit",
    projectId: "proj-relops",
    title: "Submit complete CAB pack 24h before board",
    detail: "Change record, evidence, rollback, roster, residual risks",
    done: false,
    createdAt: daysAgo(0),
    dueAt: daysFromNow(4),
  },
  {
    id: "todo-rel-smoke",
    projectId: "proj-relops",
    title: "Confirm smoke checklist owners for go-live",
    done: false,
    createdAt: daysAgo(1),
    dueAt: daysFromNow(7),
  },
  {
    id: "todo-generic-timesheet",
    projectId: null,
    title: "Update timesheet",
    detail: "Log hours before Friday cut-off",
    done: false,
    createdAt: daysAgo(0),
    dueAt: daysFromNow(1),
  },
  {
    id: "todo-generic-onetrust",
    projectId: null,
    title: "Contact OneTrust",
    detail: "Confirm privacy assessment status for portal changes",
    done: false,
    createdAt: daysAgo(0),
    dueAt: daysFromNow(3),
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
  {
    projectId: "proj-relops",
    updatedAt: daysAgo(0),
    sections: {
      now: [
        "March release train in evidence-collection mode; CAB pack submission in 5 days",
        "Process success = complete artefacts in the tracker, not feature narratives",
      ],
      decisions: [
        "CAB pack must be complete 24h before board — no verbal-only risks",
        "Evidence tracker is the source of truth for regression sign-off",
      ],
      risks: [
        "Two modules still unsigned in the tracker",
        "Rollback plan still draft",
      ],
      people: [
        "CAB Secretariat: rejects incomplete packs",
        "Sam Okonkwo: needs owners logged in the shared tracker",
      ],
      openLoops: [
        "Named hypercare roster not yet complete",
        "Unsigned module chase still open with Sam",
      ],
    },
  },
];

export const DEMO_TIMELINE: TimelineItem[] = [
  // ATLAS
  {
    id: "tl-atlas-merge",
    projectId: "proj-atlas",
    label: "Merge window closed",
    type: "phase",
    startAt: daysAgo(10),
    endAt: daysAgo(7),
    source: "seed",
  },
  {
    id: "tl-atlas-cab",
    projectId: "proj-atlas",
    label: "CAB approval",
    type: "milestone",
    startAt: daysFromNow(4),
    source: "seed",
  },
  {
    id: "tl-atlas-prod",
    projectId: "proj-atlas",
    label: "Production deployment",
    type: "deadline",
    startAt: daysFromNow(8),
    source: "seed",
  },
  // HORIZON
  {
    id: "tl-hor-workshop",
    projectId: "proj-horizon",
    label: "Roadmap workshop",
    type: "meeting",
    startAt: daysAgo(30),
    source: "seed",
  },
  {
    id: "tl-hor-review",
    projectId: "proj-horizon",
    label: "Roadmap Review with Jordan",
    type: "meeting",
    startAt: daysFromNow(7),
    source: "seed",
  },
  {
    id: "tl-hor-brand",
    projectId: "proj-horizon",
    label: "Public brand launch date",
    type: "deadline",
    startAt: daysFromNow(45),
    notes: "Fixed publicly — protect with trade-offs",
    source: "seed",
  },
  // RELOPS monthly train
  {
    id: "tl-rel-freeze",
    projectId: "proj-relops",
    label: "Merge freeze",
    type: "phase",
    startAt: daysFromNow(0),
    endAt: daysFromNow(1),
    source: "seed",
  },
  {
    id: "tl-rel-build",
    projectId: "proj-relops",
    label: "Build validation window",
    type: "phase",
    startAt: daysFromNow(1),
    endAt: daysFromNow(3),
    source: "seed",
  },
  {
    id: "tl-rel-regression",
    projectId: "proj-relops",
    label: "Regression evidence collection",
    type: "phase",
    startAt: daysFromNow(2),
    endAt: daysFromNow(4),
    source: "seed",
  },
  {
    id: "tl-rel-pack-due",
    projectId: "proj-relops",
    label: "CAB pack submission due",
    type: "submission",
    startAt: daysFromNow(4),
    notes: "24h before board",
    source: "seed",
  },
  {
    id: "tl-rel-cab",
    projectId: "proj-relops",
    label: "CAB board",
    type: "meeting",
    startAt: daysFromNow(5),
    source: "seed",
  },
  {
    id: "tl-rel-golive",
    projectId: "proj-relops",
    label: "Production go-live",
    type: "deadline",
    startAt: daysFromNow(8),
    source: "seed",
  },
  {
    id: "tl-rel-hypercare",
    projectId: "proj-relops",
    label: "Hypercare",
    type: "phase",
    startAt: daysFromNow(8),
    endAt: daysFromNow(15),
    source: "seed",
  },
];

export function createSeedState(): MissionState {
  const now = Date.now();
  return {
    projects: DEMO_PROJECTS,
    memories: DEMO_MEMORIES,
    recommendations: DEMO_RECOMMENDATIONS,
    meetings: DEMO_MEETINGS,
    releases: DEMO_RELEASES,
    todos: DEMO_TODOS,
    knowledge: DEMO_KNOWLEDGE,
    timeline: DEMO_TIMELINE,
    history: [
      {
        id: "hist-seed-1",
        type: "capture_analysed",
        title: "Capture analysed",
        detail: "Release 9 CAB notes reviewed",
        projectId: "proj-atlas",
        createdAt: new Date(now - 2 * 3600000).toISOString(),
        source: "ai",
      },
      {
        id: "hist-seed-2",
        type: "task_added",
        title: "Task added",
        detail: "Chase regression sign-off evidence",
        projectId: "proj-atlas",
        createdAt: new Date(now - 5 * 3600000).toISOString(),
        source: "user",
      },
      {
        id: "hist-seed-3",
        type: "coach_accepted",
        title: "Coach recommendation accepted",
        detail: "Proactively align stakeholders ahead of CAB",
        projectId: "proj-atlas",
        createdAt: new Date(now - 86400000).toISOString(),
        source: "ai",
      },
      {
        id: "hist-seed-4",
        type: "knowledge_updated",
        title: "Knowledge updated",
        detail: "SSO vendor lead time preference recorded",
        projectId: "proj-horizon",
        createdAt: new Date(now - 2 * 86400000).toISOString(),
        source: "user",
      },
      {
        id: "hist-seed-5",
        type: "risk_added",
        title: "Risk added",
        detail: "Merge window evidence still incomplete",
        projectId: "proj-relops",
        createdAt: new Date(now - 3 * 86400000).toISOString(),
        source: "ai",
      },
    ],
    lastAnalyzedAt: new Date().toISOString(),
    analysesThisMonth: 22,
    analysesMonthKey: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`,
  };
}
