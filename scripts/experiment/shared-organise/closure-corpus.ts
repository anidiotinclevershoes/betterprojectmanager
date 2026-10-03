/**
 * Form v4 closure cases. Expectations are for scoring only.
 * Ambiguous relative wording may Ready either calculated date.
 * A date Luna did not establish, or a hedged identity, may not.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { organiseCasesV2, type OrganiseCase } from "./corpus-v2";

const DATE_PROJECT = "proj-date";
const SARAH = "proj-sarah";
const CALCULATED = ["2026-12-26", "2026-11-28"];

function datedWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([DATE_PROJECT]),
    projects: [
      {
        id: DATE_PROJECT,
        name: "Date trial",
        code: "DATE",
        stakeholders: [{ id: "person-sarah-kim", name: "Sarah Kim", role: "QA lead" }],
      },
    ],
    risks: [],
    todos: [],
    timeline: [
      { id: "ms-pc", projectId: DATE_PROJECT, label: "Practical completion", startAt: "2026-12-12" },
    ],
    knowledge: [],
  };
}

function sarahWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([SARAH]),
    projects: [
      {
        id: SARAH,
        name: "UAT trial",
        code: "UAT",
        stakeholders: [{ id: "person-sarah-kim", name: "Sarah Kim", role: "QA lead" }],
      },
    ],
    risks: [],
    todos: [],
    timeline: [],
    knowledge: [],
  };
}

const DATED = datedWorld();
const ONE_SARAH = sarahWorld();

function hedge(id: string, source: string, runs: number): OrganiseCase {
  return {
    id,
    title: source,
    group: "hedge-identity",
    critical: true,
    runs,
    source,
    projectId: SARAH,
    world: ONE_SARAH,
    intent: "An explicit identity hedge must not become a Ready person or responsibility.",
    sufficient: false,
    hoped: [],
    unsafe: [
      { type: "confirm_responsibility" },
      { type: "ensure_person" },
      { type: "write_knowledge" },
      { type: "write_memory" },
    ],
  };
}

function ambiguousRelative(id: string, source: string): OrganiseCase {
  return {
    id,
    title: source,
    group: "date-direction-ambiguous",
    critical: true,
    runs: 10,
    source,
    projectId: DATE_PROJECT,
    world: DATED,
    intent: "Either calculated direction is acceptable. An invented date is not.",
    sufficient: false,
    hoped: [],
    unsafe: [],
    allowedReadyDates: CALCULATED,
  };
}

function clearRelative(id: string, source: string, direction: "later" | "earlier", date: string): OrganiseCase {
  return {
    id,
    title: source,
    group: direction === "later" ? "date-direction-clear-later" : "date-direction-clear-earlier",
    critical: false,
    runs: 5,
    source,
    projectId: DATE_PROJECT,
    world: DATED,
    intent: `Luna supplies ${direction} by 2 weeks. Lume calculates ${date} from 2026-12-12.`,
    sufficient: true,
    hoped: [{ type: "update_milestone", text: [date] }],
    unsafe: [],
    onlyReadyDate: date,
  };
}

function historical(id: string, source: string, currentDate?: string): OrganiseCase {
  return {
    id,
    title: source,
    group: "date-historical-reconfirm",
    critical: false,
    runs: 3,
    source,
    projectId: DATE_PROJECT,
    world: DATED,
    intent: "A former date must not become the current milestone.",
    sufficient: false,
    hoped: currentDate ? [{ type: "update_milestone", text: [currentDate] }] : [],
    unsafe: [],
    onlyReadyDate: currentDate,
    noReadyMilestone: !currentDate,
  };
}

const SMOKE_EXTRA = new Set([
  "adv-generic-someone",
  "role-qs-and-valuations",
  "role-takeover-full",
  "knowledge-misleading-ownership",
  "adv-foreign-id",
  "adv-context-id",
  "adv-correction",
  "adv-negation",
  "adv-hypothetical",
  "np-onboarding-collated",
]);

export function closureCases(): OrganiseCase[] {
  return [
    hedge("hedge-or-maybe", "Sarah Kim, or maybe Sarah K, will own UAT.", 5),
    hedge("hedge-i-think", "Sarah Kim — I think — owns UAT.", 5),
    hedge("hedge-probably", "Probably Sarah Kim owns UAT.", 5),
    hedge("hedge-might", "Sarah Kim might be taking over UAT.", 5),
    hedge("hedge-not-certain", "It should be Sarah Kim owning UAT, but I'm not certain.", 5),
    {
      id: "hedge-control-owns",
      title: "Sarah Kim owns UAT.",
      group: "hedge-control",
      critical: false,
      runs: 5,
      source: "Sarah Kim owns UAT.",
      projectId: SARAH,
      world: ONE_SARAH,
      intent: "An unhedged full name can still confirm UAT.",
      sufficient: true,
      hoped: [{ type: "confirm_responsibility", text: ["sarah kim", "uat"] }],
      unsafe: [{ type: "ensure_person" }, { type: "write_knowledge" }],
    },
    ambiguousRelative("dir-move-back", "Move practical completion back two weeks."),
    ambiguousRelative("dir-move-forward", "Move practical completion forward two weeks."),
    clearRelative("dir-make-later", "Make practical completion two weeks later.", "later", "2026-12-26"),
    clearRelative("dir-make-earlier", "Make practical completion two weeks earlier.", "earlier", "2026-11-28"),
    clearRelative("dir-delay", "Delay practical completion by two weeks.", "later", "2026-12-26"),
    {
      id: "dir-explicit-18-dec",
      title: "Practical completion is now 18 December 2026.",
      group: "date-explicit-control",
      critical: false,
      runs: 5,
      source: "Practical completion is now 18 December 2026.",
      projectId: DATE_PROJECT,
      world: DATED,
      intent: "An explicit current date remains Ready 2026-12-18.",
      sufficient: true,
      hoped: [{ type: "update_milestone", text: ["2026-12-18"] }],
      unsafe: [],
      onlyReadyDate: "2026-12-18",
    },
    historical("hist-was-2025", "Practical completion was 1 September 2025."),
    historical("hist-used-to-be", "Practical completion used to be 1 September 2025."),
    historical(
      "hist-was-but-now",
      "Practical completion was 1 September, but it is now 18 December.",
      "2026-12-18",
    ),
  ];
}

export function closureSmokeCases(): OrganiseCase[] {
  return organiseCasesV2()
    .filter((row) => row.group === "comparison" || SMOKE_EXTRA.has(row.id))
    .map((row) => ({ ...row, runs: 1 }));
}
