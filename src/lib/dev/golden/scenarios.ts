import type { MissionState, Project, ProjectKnowledge, TodoItem } from "@/lib/types";
import type { GoldenScenarioFixture } from "./types";

export const WEBSITE_REFRESH_SCENARIO: GoldenScenarioFixture = {
  id: "website-refresh",
  name: "Website Refresh",
  description:
    "CAB approval arrives, release date moves, and a CDN risk is cleared.",
  available: true,
  defaultCapture: [
    "CAB approval has now been received.",
    "Sarah has agreed to move the release to 19 August.",
    "The CDN issue has been resolved.",
  ].join("\n\n"),
  project: {
    id: "golden-proj-website-refresh",
    name: "Website Refresh",
    code: "WEB",
    summary: "Public website refresh programme",
    status: "watch",
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
  stakeholders: [
    { id: "golden-stake-sarah", name: "Sarah", role: "Release Lead" },
  ],
  knowledge: ["Release planned for 12 August"],
  expected: [
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
  ],
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

export function listGoldenScenarios(): GoldenScenarioFixture[] {
  return [WEBSITE_REFRESH_SCENARIO, ...FUTURE_SCENARIO_STUBS];
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
