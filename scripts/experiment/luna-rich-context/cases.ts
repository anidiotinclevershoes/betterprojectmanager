/**
 * Experiment corpus.
 * Live semantic cases are the frozen Capture V2 eval corpus.
 * Extra rows reuse existing long-run / New Project text. They are not new puzzles.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { LIVE_EVAL_CASES } from "@/lib/eval-capture-v2/corpus";
import { experimentalApplyWorld } from "@/lib/experiments/worlds";
import { NEW_PROJECT_NOTES } from "../../../e2e-hosted-longrun/new-project";
import type { BenchmarkCase } from "@/lib/eval-capture-v2/types";

export type ExperimentCase = {
  id: string;
  title: string;
  category: string;
  transcript: string;
  projectId: string;
  world: CaptureApplyWorld;
  /** Frozen eval case, when this row is one. */
  benchmark?: BenchmarkCase;
};

const SARAH_KIM = "person-sarah-kim";
const SARAH_OKONKWO = "person-sarah-okonkwo";
const JAMES = "person-james-murphy";
const HELEN = "person-helen";
const SARAH_PROJECT = "proj-sarah";

function sarahWorld(
  people: Array<{ id: string; name: string; role: string }>,
  owners: Array<{ personId: string; personName: string; scope: string }> = [],
): CaptureApplyWorld {
  return {
    projectIds: new Set([SARAH_PROJECT]),
    projects: [
      {
        id: SARAH_PROJECT,
        name: "UAT trial",
        code: "UAT",
        stakeholders: people,
      },
    ],
    risks: [],
    todos: [],
    timeline: [],
    knowledge: [
      {
        projectId: SARAH_PROJECT,
        sections: {},
        structured: owners.map((owner, index) => ({
          id: `resp-${index + 1}`,
          kind: "responsibility",
          lifecycle: "current",
          body: `${owner.personName} — ${owner.scope}`,
          meta: {
            personId: owner.personId,
            responsibility: {
              personId: owner.personId,
              personName: owner.personName,
              scope: owner.scope,
              ownerConfirmed: true,
            },
          },
        })),
      },
    ],
  };
}

const RIVERSIDE = "proj-riverside";
const riversideWorld = (): CaptureApplyWorld => ({
  projectIds: new Set([RIVERSIDE]),
  projects: [
    {
      id: RIVERSIDE,
      name: "Riverside Civic Hall",
      code: "RCH",
      stakeholders: [
        { id: "person-helen", name: "Helen Ward", role: "PM" },
        { id: "person-tomos", name: "Tomos Ellis", role: "Architect" },
      ],
    },
  ],
  risks: [
    {
      id: "fb74aa0f-dc7f-4fba-a5c5-838a1dd7acf3",
      projectId: RIVERSIDE,
      title: "Outstanding DDA access ramp detail",
      status: "open",
    },
    {
      id: "1c682215-ef53-4c94-8e0a-1979b002a433",
      projectId: RIVERSIDE,
      title: "M&E first-fix coordination risk",
      status: "open",
    },
  ],
  todos: [
    {
      id: "todo-asbestos",
      projectId: RIVERSIDE,
      title: "Chase asbestos survey addendum",
      done: false,
    },
    {
      id: "todo-ffe",
      projectId: RIVERSIDE,
      title: "Book FF&E sample review",
      done: false,
    },
  ],
  timeline: [
    {
      id: "ms-pc",
      projectId: RIVERSIDE,
      label: "Practical completion",
      startAt: "2026-12-12",
    },
  ],
  knowledge: [],
});

const emptyNewProject = (): CaptureApplyWorld => ({
  projectIds: new Set(["proj-new"]),
  projects: [
    {
      id: "proj-new",
      name: "Riverside Civic Hall Fit-Out",
      code: "RCH",
      stakeholders: [],
    },
  ],
  risks: [],
  todos: [],
  timeline: [],
  knowledge: [],
});

export function experimentCases(): ExperimentCase[] {
  const evalWorld = experimentalApplyWorld();
  const fromCorpus: ExperimentCase[] = LIVE_EVAL_CASES.map((benchmark) => ({
    id: benchmark.id,
    title: benchmark.title,
    category: benchmark.category,
    transcript: benchmark.transcript,
    projectId: benchmark.projectId,
    world: evalWorld,
    benchmark,
  }));

  const sarah: ExperimentCase[] = [
    {
      id: "sarah-1-two-first-name",
      title: "Two Sarahs, first name will own UAT",
      category: "sarah-identity",
      transcript: "Sarah will own UAT.",
      projectId: SARAH_PROJECT,
      world: sarahWorld([
        { id: SARAH_KIM, name: "Sarah Kim", role: "QA lead" },
        { id: SARAH_OKONKWO, name: "Sarah Okonkwo", role: "Site engineer" },
      ]),
    },
    {
      id: "sarah-2-one-first-name",
      title: "One Sarah Kim, first name will own UAT",
      category: "sarah-identity",
      transcript: "Sarah will own UAT.",
      projectId: SARAH_PROJECT,
      world: sarahWorld([{ id: SARAH_KIM, name: "Sarah Kim", role: "QA lead" }]),
    },
    {
      id: "sarah-3-no-sarah",
      title: "No Sarah, first name will own UAT",
      category: "sarah-identity",
      transcript: "Sarah will own UAT.",
      projectId: SARAH_PROJECT,
      world: sarahWorld([{ id: HELEN, name: "Helen Ward", role: "PM" }]),
    },
    {
      id: "sarah-4-full-name",
      title: "Sarah Kim full name will own UAT",
      category: "sarah-identity",
      transcript: "Sarah Kim will own UAT.",
      projectId: SARAH_PROJECT,
      world: sarahWorld([{ id: SARAH_KIM, name: "Sarah Kim", role: "QA lead" }]),
    },
    {
      id: "sarah-5-initial",
      title: "Sarah K near-name will own UAT",
      category: "sarah-identity",
      transcript: "Sarah K will own UAT.",
      projectId: SARAH_PROJECT,
      world: sarahWorld([{ id: SARAH_KIM, name: "Sarah Kim", role: "QA lead" }]),
    },
    {
      id: "sarah-6-takeover-full",
      title: "Sarah Kim taking over UAT from James",
      category: "sarah-identity",
      transcript: "Sarah Kim is taking over UAT from James.",
      projectId: SARAH_PROJECT,
      world: sarahWorld(
        [
          { id: SARAH_KIM, name: "Sarah Kim", role: "QA lead" },
          { id: JAMES, name: "James Murphy", role: "Test manager" },
        ],
        [{ personId: JAMES, personName: "James Murphy", scope: "UAT" }],
      ),
    },
    {
      id: "sarah-7-takeover-first",
      title: "Sarah taking over UAT from James",
      category: "sarah-identity",
      transcript: "Sarah is taking over UAT from James.",
      projectId: SARAH_PROJECT,
      world: sarahWorld(
        [
          { id: SARAH_KIM, name: "Sarah Kim", role: "QA lead" },
          { id: JAMES, name: "James Murphy", role: "Test manager" },
        ],
        [{ personId: JAMES, personName: "James Murphy", scope: "UAT" }],
      ),
    },
  ];

  const riverside = riversideWorld();
  const trouble: ExperimentCase[] = [
    {
      id: "lr-02-cadence-todo",
      title: "Weekly dashboard cadence to-do",
      category: "cadence",
      transcript: "Add a to-do to send Helen Ward the weekly dashboard every Friday.",
      projectId: RIVERSIDE,
      world: riverside,
    },
    {
      id: "lr-03-pc-date",
      title: "Practical completion date move",
      category: "date",
      transcript: "Practical completion has moved to 18 December 2026.",
      projectId: RIVERSIDE,
      world: riverside,
    },
    {
      id: "lr-05-asbestos-timber",
      title: "Close asbestos chase and raise timber-floor risk",
      category: "todo-and-risk",
      transcript:
        "The asbestos survey addendum came back clean. Close that chase. Raise a risk that the hall timber floor may still hide services.",
      projectId: RIVERSIDE,
      world: riverside,
    },
    {
      id: "lr-11-chris-firstname",
      title: "First name Chris joining",
      category: "identity",
      transcript: "Chris is joining next month as client comms.",
      projectId: RIVERSIDE,
      world: riverside,
    },
    {
      id: "lr-29-helen-firstname",
      title: "First-name Helen variation sign-off",
      category: "identity",
      transcript: "Helen can sign the variation for the extra containment.",
      projectId: RIVERSIDE,
      world: riverside,
    },
    {
      id: "np-mobilisation-notes",
      title: "New Project mobilisation notes",
      category: "new-project",
      transcript: NEW_PROJECT_NOTES,
      projectId: "proj-new",
      world: emptyNewProject(),
    },
  ];

  return [...fromCorpus, ...sarah, ...trouble];
}
