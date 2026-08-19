import type { MissionState, Project, ProjectKnowledge, TodoItem } from "@/lib/types";
import type { GoldenScenarioFixture } from "./types";

const WEBSITE_REFRESH_BASELINE = {
  project: {
    id: "golden-proj-website-refresh",
    name: "Website Refresh",
    code: "WEB",
    summary: "Public website refresh programme",
    status: "watch" as const,
    currentFocus: "CAB approval and release readiness",
  },
  todos: [
    {
      id: "golden-todo-cab",
      title: "Obtain CAB approval",
      detail: "Owner: Jordan. Waiting on Change Advisory Board.",
      done: false,
      statusLabel: "Open",
    },
    {
      id: "golden-todo-window",
      title: "Confirm release window",
      detail: "Owner: Sarah. Align stakeholders on go-live.",
      done: false,
      statusLabel: "Open",
    },
  ],
  risks: ["CDN deployment delayed"],
  knowledge: ["Release planned for 12 August"],
};

/** Standard scenario — unchanged Knowledge-based release date expectation. */
const WEBSITE_REFRESH_EXPECTED: GoldenScenarioFixture["expected"] = [
  {
    id: "complete-cab",
    operation: "complete",
    entity: "todo",
    targetTitle: "Obtain CAB approval",
    targetId: "golden-todo-cab",
    minConfidence: 80,
    reasoningHint: {
      foundLabel: "Found existing To Do",
      foundTitle: "Obtain CAB approval",
      captureStates: "Capture states approval received",
      recommend: "COMPLETE existing To Do",
    },
  },
  {
    id: "update-release-date",
    operation: "update",
    entity: "knowledge",
    targetTitle: "Release planned for 12 August",
    targetId: "know-golden-proj-website-refresh-now-0",
    minConfidence: 75,
    reasoningHint: {
      foundLabel: "Found Knowledge",
      foundTitle: "Release planned for 12 August",
      captureStates: "Capture changes date to 19 August",
      recommend: "UPDATE existing Knowledge",
    },
  },
  {
    id: "resolve-cdn",
    operation: "complete",
    entity: "risk",
    targetTitle: "CDN deployment delayed",
    targetId: "golden-risk-0",
    minConfidence: 75,
    reasoningHint: {
      foundLabel: "Found Risk",
      foundTitle: "CDN deployment delayed",
      captureStates: "Capture states the CDN issue is resolved",
      recommend: "COMPLETE existing Risk",
    },
  },
];

/**
 * Hard scenario — Milestone date update + canonical Risk resolve.
 * COMPLETE is preferred for Risk; UPDATE with resolved status is a valid alternative.
 */
const WEBSITE_REFRESH_HARD_EXPECTED: GoldenScenarioFixture["expected"] = [
  {
    id: "complete-cab",
    operation: "complete",
    entity: "todo",
    targetTitle: "Obtain CAB approval",
    targetId: "golden-todo-cab",
    minConfidence: 80,
    reasoningHint: {
      foundLabel: "Found existing To Do",
      foundTitle: "Obtain CAB approval",
      captureStates: "Capture states approval received",
      recommend: "COMPLETE existing To Do",
    },
  },
  {
    id: "update-release-milestone",
    operation: "update",
    entity: "milestone",
    targetTitle: "Release",
    targetId: "golden-tl-release",
    expectedChanges: {
      date: ["19 August", "2026-08-19"],
      startAt: ["2026-08-19", "19 August"],
    },
    minConfidence: 75,
    reasoningHint: {
      foundLabel: "Found Milestone",
      foundTitle: "Release",
      captureStates: "Capture moves release from 12 August to 19 August",
      recommend: "UPDATE existing Milestone date",
    },
  },
  {
    id: "resolve-cdn",
    operation: "complete",
    entity: "risk",
    targetTitle: "CDN deployment delayed",
    targetId: "golden-risk-0",
    /** Canonical resolve is COMPLETE; UPDATE+RESOLVED is a narrow semantic equivalent. */
    acceptedOperations: ["complete", "update"],
    expectedChanges: {
      status: ["COMPLETED", "RESOLVED", "done", "DONE"],
    },
    minConfidence: 75,
    reasoningHint: {
      foundLabel: "Found Risk",
      foundTitle: "CDN deployment delayed",
      captureStates: "Capture states the CDN issue is resolved",
      recommend: "COMPLETE (resolve) existing Risk",
    },
  },
];

const WEBSITE_REFRESH_PROHIBITED: NonNullable<
  GoldenScenarioFixture["prohibited"]
> = [
  {
    id: "no-milk",
    label: "Personal errand (milk) must not become project work",
    titleIncludes: ["milk"],
  },
  {
    id: "no-new-cdn-risk",
    label: "Do not create a new CDN monitoring risk",
    operation: "create",
    entity: "risk",
    titleIncludes: ["cdn"],
  },
  {
    id: "no-remove-sarah",
    label: "Do not remove Sarah",
    operation: ["delete", "remove", "archive"],
    entity: "stakeholder",
    titleIncludes: ["sarah"],
  },
  {
    id: "no-marcus-owner",
    label: "Do not transfer project ownership to Marcus",
    operation: ["create", "update"],
    entity: "stakeholder",
    titleIncludesAll: ["marcus"],
    titleIncludes: ["owner", "business owner", "taking over", "replace"],
  },
  {
    id: "no-duplicate-cab",
    label: "Do not create a duplicate CAB To Do",
    operation: "create",
    entity: "todo",
    titleIncludes: ["cab"],
  },
  {
    id: "no-duplicate-release-knowledge",
    label: "Do not create duplicate release-date Knowledge",
    operation: "create",
    entity: "knowledge",
    titleIncludes: ["release", "august"],
  },
];

export const WEBSITE_REFRESH_SCENARIO: GoldenScenarioFixture = {
  id: "website-refresh",
  name: "Website Refresh — Standard",
  description:
    "CAB approval arrives, release date moves, and a CDN risk is cleared.",
  available: true,
  scoringMode: "standard",
  defaultCapture: [
    "CAB approval has now been received.",
    "Sarah has agreed to move the release to 19 August.",
    "The CDN issue has been resolved.",
  ].join("\n\n"),
  project: WEBSITE_REFRESH_BASELINE.project,
  todos: WEBSITE_REFRESH_BASELINE.todos,
  risks: WEBSITE_REFRESH_BASELINE.risks,
  stakeholders: [
    { id: "golden-stake-sarah", name: "Sarah", role: "Release Lead" },
  ],
  knowledge: WEBSITE_REFRESH_BASELINE.knowledge,
  expected: WEBSITE_REFRESH_EXPECTED,
};

/**
 * Deliberately difficult voice dump: corrections, repetition, irrelevant
 * content, negated instructions, and a clarifying summary at the end.
 * Not designed for a perfect score.
 */
export const WEBSITE_REFRESH_HARD_SCENARIO: GoldenScenarioFixture = {
  id: "website-refresh-hard",
  name: "Website Refresh — Hard Capture",
  description:
    "Rambling brain dump with corrections, filler, irrelevant content, and role ambiguity.",
  available: true,
  scoringMode: "hard",
  defaultCapture: [
    "Okay, so, right, just dumping this before I forget.",
    "",
    "The CAB thing — I think we're good there. Well, actually, yes, Sarah confirmed it after the call, so CAB is approved now. I mentioned that already, didn't I? Anyway, the approval task shouldn't still be hanging around.",
    "",
    "The release date... we said the nineteenth, I think. Wait, no, that was the workshop. The release is definitely moving from the twelfth to the nineteenth of August. Sarah agreed to that, but I don't think everyone has been told yet.",
    "",
    "The CDN issue was causing the delay, although there was another little problem with images loading slowly. Ignore that bit for now — the actual deployment blocker is resolved. We should probably keep an eye on it, but I don't want a brand-new risk created just because I said that.",
    "",
    "Marcus was mentioned, but he isn't taking over the project. He's only helping with the release notes. Don't replace Sarah.",
    "",
    "I also need to remember milk on the way home — obviously not project related.",
    "",
    "So, summary: CAB approved, release is the nineteenth, CDN blocker resolved, Sarah is still the owner, Marcus only owns release notes. I think that's everything.",
  ].join("\n"),
  project: WEBSITE_REFRESH_BASELINE.project,
  todos: WEBSITE_REFRESH_BASELINE.todos,
  risks: WEBSITE_REFRESH_BASELINE.risks,
  stakeholders: [
    { id: "golden-stake-sarah", name: "Sarah", role: "Business Owner" },
  ],
  knowledge: WEBSITE_REFRESH_BASELINE.knowledge,
  expected: WEBSITE_REFRESH_HARD_EXPECTED,
  prohibited: WEBSITE_REFRESH_PROHIBITED,
};

/** Placeholder scenarios for the dropdown — not runnable yet. */
export const FUTURE_SCENARIO_STUBS: GoldenScenarioFixture[] = [
  {
    id: "release-delay",
    name: "Release Delay",
    description: "Coming soon",
    available: false,
    defaultCapture: "",
    project: {
      id: "stub",
      name: "Release Delay",
      code: "REL",
      summary: "",
      status: "watch",
      currentFocus: "",
    },
    todos: [],
    risks: [],
    stakeholders: [],
    knowledge: [],
    expected: [],
  },
  {
    id: "production-incident",
    name: "Production Incident",
    description: "Coming soon",
    available: false,
    defaultCapture: "",
    project: {
      id: "stub",
      name: "Production Incident",
      code: "INC",
      summary: "",
      status: "at_risk",
      currentFocus: "",
    },
    todos: [],
    risks: [],
    stakeholders: [],
    knowledge: [],
    expected: [],
  },
  {
    id: "steering-committee",
    name: "Steering Committee",
    description: "Coming soon",
    available: false,
    defaultCapture: "",
    project: {
      id: "stub",
      name: "Steering Committee",
      code: "STEER",
      summary: "",
      status: "healthy",
      currentFocus: "",
    },
    todos: [],
    risks: [],
    stakeholders: [],
    knowledge: [],
    expected: [],
  },
  {
    id: "sprint-planning",
    name: "Sprint Planning",
    description: "Coming soon",
    available: false,
    defaultCapture: "",
    project: {
      id: "stub",
      name: "Sprint Planning",
      code: "SPR",
      summary: "",
      status: "healthy",
      currentFocus: "",
    },
    todos: [],
    risks: [],
    stakeholders: [],
    knowledge: [],
    expected: [],
  },
];

/**
 * Mixed 3/3/3 — creates, updates, completions against seeded RelOps-style state.
 * Conversational but not as hard as the rambling Hard Capture.
 */
export const MIXED_OPERATIONS_SCENARIO: GoldenScenarioFixture = {
  id: "mixed-operations",
  name: "Mixed Operations — 3/3/3",
  description:
    "Three creates, three updates, three completions/resolutions with light conversational noise.",
  available: true,
  scoringMode: "mixed",
  defaultCapture: [
    "Okay quick dump before I forget.",
    "",
    "Merge freeze notice is done — that went out this morning, we can close Publish March merge freeze notice off. The two unsigned modules are both in the evidence tracker now with proper links from Sam, so Chase two unsigned modules into evidence tracker is complete as well. And the Hypercare staffing gap for Release 9 risk is resolved — Nina confirmed the full roster in writing, every shift named, so we can clear that risk.",
    "",
    "On the open stuff that still needs changing: Submit complete CAB pack 24h before board is no longer Thursday — move that due date to Friday close of play. Finalise rollback plan with Nina — she’s owning it through to CAB-ready, and the due date should move out by two days. Also Confirm smoke checklist owners for go-live — push that due date to next Tuesday; we don’t need it this week.",
    "",
    "Three new things we don’t have tracked yet. Create a to-do to book the go-live bridge call for Friday 14:00 with CAB Secretariat and Nina. Raise a new risk: intermittent payment gateway timeouts in UAT after the last build — not blocking CAB yet but needs watching. And add an action to send Priya the written Release 9 brief plus residual risk summary by end of day Wednesday.",
    "",
    "Don’t invent anything else. Timesheet and OneTrust can wait.",
  ].join("\n"),
  project: {
    id: "golden-proj-mixed-ops",
    name: "Release 9 Operations",
    code: "R9",
    summary: "Mixed operations Capture coverage fixture",
    status: "watch",
    currentFocus: "CAB pack and go-live readiness",
  },
  todos: [
    {
      id: "golden-mixed-freeze",
      title: "Publish March merge freeze notice",
      detail: "In/out list + exception path in release channel",
      done: false,
      statusLabel: "Open",
    },
    {
      id: "golden-mixed-unsigned",
      title: "Chase two unsigned modules into evidence tracker",
      detail: "Require links from Sam — no verbal sign-off",
      done: false,
      statusLabel: "Open",
    },
    {
      id: "golden-mixed-rollback",
      title: "Finalise rollback plan with Nina",
      detail: "Move from draft to CAB-ready attachment",
      done: false,
      statusLabel: "Open",
    },
    {
      id: "golden-mixed-cab-pack",
      title: "Submit complete CAB pack 24h before board",
      detail: "Change record, evidence, rollback, roster, residual risks",
      done: false,
      statusLabel: "Open",
    },
    {
      id: "golden-mixed-smoke",
      title: "Confirm smoke checklist owners for go-live",
      done: false,
      statusLabel: "Open",
    },
  ],
  risks: ["Hypercare staffing gap for Release 9"],
  stakeholders: [
    { id: "golden-mixed-nina", name: "Nina", role: "Release Engineer" },
    { id: "golden-mixed-priya", name: "Priya", role: "Sponsor" },
  ],
  knowledge: ["Release 9 CAB board is Thursday"],
  expected: [
    {
      id: "complete-freeze",
      operation: "complete",
      entity: "todo",
      targetTitle: "Publish March merge freeze notice",
      targetId: "golden-mixed-freeze",
      minConfidence: 70,
    },
    {
      id: "complete-unsigned",
      operation: "complete",
      entity: "todo",
      targetTitle: "Chase two unsigned modules into evidence tracker",
      targetId: "golden-mixed-unsigned",
      minConfidence: 70,
    },
    {
      id: "resolve-hypercare",
      operation: "complete",
      entity: "risk",
      targetTitle: "Hypercare staffing gap for Release 9",
      targetId: "golden-risk-0",
      acceptedOperations: ["complete", "update"],
      expectedChanges: {
        status: ["COMPLETED", "RESOLVED", "done", "DONE"],
      },
      minConfidence: 70,
    },
    {
      id: "update-cab-pack",
      operation: "update",
      entity: "todo",
      targetTitle: "Submit complete CAB pack 24h before board",
      targetId: "golden-mixed-cab-pack",
      minConfidence: 65,
    },
    {
      id: "update-rollback",
      operation: "update",
      entity: "todo",
      targetTitle: "Finalise rollback plan with Nina",
      targetId: "golden-mixed-rollback",
      minConfidence: 65,
    },
    {
      id: "update-smoke",
      operation: "update",
      entity: "todo",
      targetTitle: "Confirm smoke checklist owners for go-live",
      targetId: "golden-mixed-smoke",
      minConfidence: 65,
    },
    {
      id: "create-bridge",
      operation: "create",
      entity: "todo",
      targetTitle: "book the go-live bridge call",
      minConfidence: 65,
    },
    {
      id: "create-gateway-risk",
      operation: "create",
      entity: "risk",
      targetTitle: "payment gateway timeouts",
      minConfidence: 65,
    },
    {
      id: "create-priya-brief",
      operation: "create",
      entity: "todo",
      targetTitle: "send Priya the written Release 9 brief",
      minConfidence: 65,
    },
  ],
  prohibited: [
    {
      id: "no-timesheet",
      label: "Timesheet must not become project work",
      titleIncludes: ["timesheet"],
    },
    {
      id: "no-onetrust",
      label: "OneTrust deferral must not become an operation",
      titleIncludes: ["onetrust"],
    },
  ],
};

export function listGoldenScenarios(): GoldenScenarioFixture[] {
  return [
    WEBSITE_REFRESH_SCENARIO,
    WEBSITE_REFRESH_HARD_SCENARIO,
    MIXED_OPERATIONS_SCENARIO,
    ...FUTURE_SCENARIO_STUBS,
  ];
}

export function getGoldenScenario(id: string): GoldenScenarioFixture | null {
  return listGoldenScenarios().find((s) => s.id === id) ?? null;
}

/** In-memory MissionState slice for the Capture API — never persisted. */
export function fixtureToMissionState(
  scenario: GoldenScenarioFixture,
): Pick<
  MissionState,
  | "projects"
  | "todos"
  | "meetings"
  | "releases"
  | "knowledge"
  | "timeline"
  | "recommendations"
  | "history"
  | "memories"
> {
  const now = new Date().toISOString();
  const project: Project = {
    id: scenario.project.id,
    name: scenario.project.name,
    code: scenario.project.code,
    summary: scenario.project.summary,
    status: scenario.project.status,
    currentFocus: scenario.project.currentFocus,
    stakeholders: scenario.stakeholders.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      concerns: [],
    })),
  };

  const todos: TodoItem[] = scenario.todos.map((t) => ({
    id: t.id,
    projectId: project.id,
    title: t.title,
    detail: t.detail,
    done: t.done,
    createdAt: now,
  }));

  const knowledge: ProjectKnowledge = {
    projectId: project.id,
    updatedAt: now,
    sections: {
      now: [...scenario.knowledge],
      decisions: [],
      risks: [], // Risks live as recommendation records so IDs stay stable
      people: scenario.stakeholders.map((s) => `${s.name} (${s.role})`),
      openLoops: scenario.todos
        .filter((t) => !t.done)
        .map((t) => t.title),
    },
  };

  const recommendations = scenario.risks.map((risk, i) => ({
    id: `golden-risk-${i}`,
    kind: "risk" as const,
    urgency: "today" as const,
    title: risk,
    action: `Track mitigation for: ${risk}`,
    why: "Fixture risk for Golden Test",
    leadershipImpact: "Stay ahead of delivery risk",
    projectId: project.id,
    createdAt: now,
    status: "active" as const,
    operation: "update" as const,
    itemType: "risk" as const,
    targetTitle: risk,
  }));

  return {
    projects: [project],
    todos,
    meetings: [],
    releases: [],
    knowledge: [knowledge],
    timeline: [
      {
        id: "golden-tl-release",
        projectId: project.id,
        label: "Release",
        type: "milestone",
        startAt: "2026-08-12T00:00:00.000Z",
        notes: "Release planned for 12 August",
      },
    ],
    recommendations,
    history: [],
    memories: [],
  };
}
