/**
 * Date-contract cases. Expectations are for scoring only.
 * Canonical practical completion is 2026-12-12 unless a case removes it.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type { OrganiseCase } from "./corpus-v2";

const PROJECT = "proj-date";

function world(startAt?: string): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT]),
    projects: [
      {
        id: PROJECT,
        name: "Date trial",
        code: "DATE",
        stakeholders: [{ id: "person-sarah-kim", name: "Sarah Kim", role: "QA lead" }],
      },
    ],
    risks: [],
    todos: [],
    timeline: [
      {
        id: "ms-pc",
        projectId: PROJECT,
        label: "Practical completion",
        ...(startAt ? { startAt } : {}),
      },
    ],
    knowledge: [],
  };
}

const DATED = world("2026-12-12");
const UNDATED = world();

function explicit(id: string, source: string): OrganiseCase {
  return {
    id,
    title: source,
    group: "date-explicit",
    critical: false,
    source,
    projectId: PROJECT,
    world: DATED,
    intent: "Current practical completion becomes 2026-12-18.",
    sufficient: true,
    hoped: [{ type: "update_milestone", text: ["2026-12-18"] }],
    unsafe: [],
    onlyReadyDate: "2026-12-18",
  };
}

function historical(id: string, source: string): OrganiseCase {
  return {
    id,
    title: source,
    group: "date-historical",
    critical: true,
    source,
    projectId: PROJECT,
    world: DATED,
    intent: "A former date must not change the current milestone.",
    sufficient: false,
    hoped: [],
    unsafe: [],
    noReadyMilestone: true,
  };
}

function relative(
  id: string,
  source: string,
  direction: "later" | "earlier",
  date: string,
): OrganiseCase {
  return {
    id,
    title: source,
    group: direction === "later" ? "date-relative-later" : "date-relative-earlier",
    critical: true,
    source,
    projectId: PROJECT,
    world: DATED,
    intent: `Luna supplies ${direction} by 2 weeks. Lume calculates ${date} from 2026-12-12.`,
    sufficient: true,
    hoped: [{ type: "update_milestone", text: [date] }],
    unsafe: [],
    onlyReadyDate: date,
  };
}

export function dateCases(): OrganiseCase[] {
  return [
    explicit("date-is-18-dec-2026", "Practical completion is 18 December 2026."),
    explicit("date-moved-to-18-dec-2026", "Practical completion has moved to 18 December 2026."),
    explicit("date-set-18-dec-2026", "Set practical completion to 18 December 2026."),
    explicit("date-will-now-18-dec-2026", "Practical completion will now be 18 December 2026."),
    explicit("date-new-date-18-dec-2026", "The new practical completion date is 18 December 2026."),
    {
      ...explicit("date-yearless-is", "Practical completion is 18 December."),
      critical: true,
      intent: "Month and day are stated. The safe year is the next occurrence, 2026.",
    },
    {
      ...explicit("date-yearless-moved", "Practical completion has moved to 18 December."),
      critical: true,
    },
    {
      ...explicit("date-yearless-set", "Set practical completion to 18 December."),
      critical: true,
    },
    historical("date-was-2025", "Practical completion was 1 September 2025."),
    historical("date-used-to-be", "Practical completion used to be 1 September 2025."),
    historical("date-old-date", "The old practical completion date was 1 September."),
    historical("date-previously", "We previously had practical completion down as 1 September."),
    historical("date-had-been", "Practical completion had been planned for 1 September."),
    historical("date-last-year", "Last year practical completion was 1 September."),
    historical("date-original", "The original practical completion date was 1 September."),
    historical("date-missed", "We missed the 1 September practical completion date."),
    {
      id: "date-was-but-now",
      title: "Former date and a new current date",
      group: "date-mixed",
      critical: true,
      source: "Practical completion was 1 September, but it is now 18 December.",
      projectId: PROJECT,
      world: DATED,
      intent: "Only the current 18 December survives, as 2026-12-18.",
      sufficient: true,
      hoped: [{ type: "update_milestone", text: ["2026-12-18"] }],
      unsafe: [],
      onlyReadyDate: "2026-12-18",
    },
    relative("date-move-back", "Move practical completion back two weeks.", "later", "2026-12-26"),
    relative("date-push-back", "Push practical completion back two weeks.", "later", "2026-12-26"),
    relative("date-delay", "Delay practical completion by two weeks.", "later", "2026-12-26"),
    relative("date-move-later", "Move practical completion later by two weeks.", "later", "2026-12-26"),
    relative("date-bring-forward", "Bring practical completion forward two weeks.", "earlier", "2026-11-28"),
    relative("date-move-forward", "Move practical completion forward two weeks.", "earlier", "2026-11-28"),
    relative("date-pull-in", "Pull practical completion in by two weeks.", "earlier", "2026-11-28"),
    {
      id: "date-no-baseline",
      title: "Relative move with no canonical date",
      group: "date-missing-baseline",
      critical: true,
      source: "Push practical completion back two weeks.",
      projectId: PROJECT,
      world: UNDATED,
      intent: "No baseline date, so this cannot become a Ready invented date.",
      sufficient: false,
      hoped: [],
      unsafe: [],
      noReadyMilestone: true,
    },
    ...[
      ["date-around-christmas", "Practical completion is around Christmas."],
      ["date-couple-of-weeks", "PC should probably move a couple of weeks."],
      ["date-maybe-back", "Maybe move practical completion back."],
      ["date-could-be-18th", "Practical completion could be the 18th."],
      ["date-december-sometime", "I think practical completion was December sometime."],
    ].map(
      ([id, source]): OrganiseCase => ({
        id: id!,
        title: source!,
        group: "date-ambiguous",
        critical: true,
        source: source!,
        projectId: PROJECT,
        world: DATED,
        intent: "The current date change is not established.",
        sufficient: false,
        hoped: [],
        unsafe: [],
        noReadyMilestone: true,
      }),
    ),
    {
      id: "date-mixed-owner-and-move",
      title: "Responsibility and an explicit current date",
      group: "date-mixed",
      critical: true,
      source: "Sarah Kim owns UAT now and practical completion has moved to 18 December.",
      projectId: PROJECT,
      world: DATED,
      intent: "Confirm UAT for Sarah Kim and set practical completion to 2026-12-18.",
      sufficient: true,
      hoped: [
        { type: "confirm_responsibility", text: ["sarah kim", "uat"] },
        { type: "update_milestone", text: ["2026-12-18"] },
      ],
      unsafe: [{ type: "write_knowledge" }],
      onlyReadyDate: "2026-12-18",
    },
    {
      id: "date-mixed-history-todo",
      title: "Responsibility, former date, current date, generic to-do",
      group: "date-mixed",
      critical: true,
      source:
        "Sarah Kim owns UAT. Practical completion was 1 September but is now 18 December. Someone needs to sort the fire cert.",
      projectId: PROJECT,
      world: DATED,
      intent: "UAT for Sarah Kim, current date 2026-12-18, fire-cert to-do, no Person named Someone, September does not become current.",
      sufficient: true,
      hoped: [
        { type: "confirm_responsibility", text: ["sarah kim", "uat"] },
        { type: "update_milestone", text: ["2026-12-18"] },
        { type: "create_todo", text: ["fire cert"] },
      ],
      unsafe: [{ type: "ensure_person" }, { type: "confirm_responsibility", text: ["someone"] }],
      onlyReadyDate: "2026-12-18",
    },
  ];
}
