/**
 * Frozen Harbourline Civic Archive project — test-only.
 * Distinct from Candyland / Toyworld / GamingStudio5000.
 * Does not change experimental production worlds.
 */

import { emptyKnowledge } from "@/lib/knowledge";
import type { MissionState, ProjectRisk, TodoItem, TimelineItem } from "@/lib/types";
import { experimentalMissionState } from "../mission-state";
import { CANDYLAND_ID, GAMING_ID, TOYWORLD_ID } from "@/lib/experiments/worlds";

export const HARBOURLINE_ID = "proj-harbourline";
export const HARBOURLINE_NAME = "Harbourline Civic Archive Refresh";
export const HARBOURLINE_CODE = "HCA";
export const STRESS_NOW = "2026-08-26T12:00:00.000Z";

export const HCA_PEOPLE = {
  miriam: { id: "person-hca-miriam", name: "Miriam Cole", role: "Programme sponsor / City Clerk" },
  owen: { id: "person-hca-owen", name: "Owen Hart", role: "Archives delivery lead" },
  priya: { id: "person-hca-priya", name: "Priya Nair", role: "Civic ICT lead" },
  daniel: { id: "person-hca-daniel", name: "Daniel Okonkwo", role: "Helix Imaging vendor lead" },
  lila: { id: "person-hca-lila", name: "Lila Berg", role: "Conservation lead" },
  tomas: { id: "person-hca-tomas", name: "Tomas Rezek", role: "Legal / FOI" },
  hannah: { id: "person-hca-hannah", name: "Hannah Wells", role: "Comms" },
  samir: { id: "person-hca-samir", name: "Samir Qureshi", role: "Facilities" },
  elena: { id: "person-hca-elena", name: "Elena Voss", role: "Public catalogue UX contractor" },
  chris: { id: "person-hca-chris", name: "Chris Lang", role: "Finance business partner" },
  nora: { id: "person-hca-nora", name: "Nora Blake", role: "Volunteer coordinator" },
} as const;

export const HCA_RISKS = {
  mould: { id: "risk-hca-mould", title: "Mould in the wet-store", status: "open" as const },
  helix: { id: "risk-hca-helix", title: "Helix scanning queue overruns autumn", status: "open" as const },
  foi: { id: "risk-hca-foi", title: "FOI redaction capacity", status: "watch" as const },
  sso: { id: "risk-hca-sso", title: "Civic SSO identity integration", status: "open" as const },
  dbs: { id: "risk-hca-dbs", title: "Volunteer DBS delays", status: "watch" as const },
  a11y: { id: "risk-hca-a11y", title: "Public catalogue accessibility fail", status: "open" as const },
  year2: { id: "risk-hca-year2", title: "Year-2 scanning budget not approved", status: "open" as const },
} as const;

export const HCA_TODOS = {
  spec: { id: "todo-hca-spec", title: "Issue scan specification to Helix", done: false },
  dehumidifier: { id: "todo-hca-dehumid", title: "Book wet-store dehumidifier", done: false },
  foiRules: { id: "todo-hca-foi-rules", title: "Draft FOI redaction rules", done: false },
  cabinet: { id: "todo-hca-cabinet", title: "Confirm cabinet paper annex", done: false },
  rota: { id: "todo-hca-rota", title: "Set up volunteer rota", done: false },
  series: { id: "todo-hca-series", title: "Map analogue series list", done: false },
  ux: { id: "todo-hca-ux", title: "Run public catalogue UX sessions", done: false },
  finance: { id: "todo-hca-finance", title: "Finance gate for year-2 scanning", done: false },
  intranet: { id: "todo-hca-intranet", title: "Install catalogue search on civic intranet", done: false },
  mouldPhoto: { id: "todo-hca-mould-photo", title: "Photograph the mould-affected boxes", done: false },
  inventory: {
    id: "todo-hca-inventory",
    title: "Series inventory of Minutes 1985–1995",
    done: true,
  },
} as const;

export const HCA_DATES = {
  cabinet: { id: "ms-hca-cabinet", label: "Cabinet paper", startAt: "2026-09-12T09:00:00.000Z" },
  kickoff: { id: "ms-hca-kickoff", label: "Vendor kickoff", startAt: "2026-09-18T09:00:00.000Z" },
  specFreeze: { id: "ms-hca-spec", label: "Scan specification freeze", startAt: "2026-10-02T09:00:00.000Z" },
  wetEmpty: { id: "ms-hca-wet", label: "Wet-store empty", startAt: "2026-10-31T09:00:00.000Z" },
  alpha: { id: "ms-hca-alpha", label: "Public catalogue alpha", startAt: "2026-11-20T09:00:00.000Z" },
  foiWorkshop: { id: "ms-hca-foi", label: "FOI policy workshop", startAt: "2026-12-04T09:00:00.000Z" },
  volunteer: { id: "ms-hca-vol", label: "Volunteer training", startAt: "2027-01-15T09:00:00.000Z" },
  conservation: { id: "ms-hca-cons", label: "Conservation hold review", startAt: "2027-01-28T09:00:00.000Z" },
  beta: { id: "ms-hca-beta", label: "Catalogue beta", startAt: "2027-03-12T09:00:00.000Z" },
  launch: { id: "ms-hca-launch", label: "Public launch", startAt: "2027-04-09T09:00:00.000Z" },
} as const;

export type HarbourlineSnapshot = {
  projectId: string;
  projectCount: number;
  people: string[];
  peopleIds: string[];
  todos: Array<{ title: string; done: boolean }>;
  risks: Array<{ title: string; status: string }>;
  dates: Array<{ label: string; startAt?: string }>;
  knowledgeNow: string[];
  knowledgeDecisions: string[];
  knowledgeRisks: string[];
  availability: string[];
};

export function snapshotHarbourline(state: MissionState): HarbourlineSnapshot {
  const project = state.projects.find((p) => p.id === HARBOURLINE_ID);
  const knowledge = state.knowledge.find((k) => k.projectId === HARBOURLINE_ID);
  const availability = (knowledge?.structured ?? [])
    .filter((row) => row.kind === "availability" && row.lifecycle === "current")
    .map((row) => row.body);
  return {
    projectId: HARBOURLINE_ID,
    projectCount: state.projects.filter((p) => p.id === HARBOURLINE_ID).length,
    people: (project?.stakeholders ?? []).map((s) => s.name).sort(),
    peopleIds: (project?.stakeholders ?? []).map((s) => s.id).sort(),
    todos: (state.todos ?? [])
      .filter((t) => t.projectId === HARBOURLINE_ID)
      .map((t) => ({ title: t.title, done: Boolean(t.done) }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    risks: (state.risks ?? [])
      .filter((r) => r.projectId === HARBOURLINE_ID)
      .map((r) => ({ title: r.title, status: r.status }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    dates: (state.timeline ?? [])
      .filter((t) => t.projectId === HARBOURLINE_ID)
      .map((t) => ({ label: t.label, startAt: t.startAt }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    knowledgeNow: [...(knowledge?.sections.now ?? [])].sort(),
    knowledgeDecisions: [...(knowledge?.sections.decisions ?? [])].sort(),
    knowledgeRisks: [...(knowledge?.sections.risks ?? [])].sort(),
    availability,
  };
}

function todo(row: { id: string; title: string; done: boolean }): TodoItem {
  return {
    id: row.id,
    projectId: HARBOURLINE_ID,
    title: row.title,
    done: row.done,
    createdAt: STRESS_NOW,
  };
}

function risk(row: { id: string; title: string; status: ProjectRisk["status"] }): ProjectRisk {
  return {
    id: row.id,
    projectId: HARBOURLINE_ID,
    title: row.title,
    status: row.status,
    source: "seed",
    createdAt: STRESS_NOW,
    updatedAt: STRESS_NOW,
  };
}

function date(row: { id: string; label: string; startAt: string }): TimelineItem {
  return {
    id: row.id,
    projectId: HARBOURLINE_ID,
    label: row.label,
    type: "milestone",
    startAt: row.startAt,
    source: "seed",
  };
}

function people(...keys: Array<keyof typeof HCA_PEOPLE>) {
  return keys.map((key) => ({
    id: HCA_PEOPLE[key].id,
    name: HCA_PEOPLE[key].name,
    role: HCA_PEOPLE[key].role,
  }));
}

function withHarbourline(
  base: MissionState,
  extras: {
    stakeholders: ReturnType<typeof people>;
    todos: TodoItem[];
    risks: ProjectRisk[];
    dates: TimelineItem[];
    now?: string[];
    decisions?: string[];
    riskBullets?: string[];
    openLoops?: string[];
    availability?: Array<{ id: string; body: string; personId: string }>;
  },
): MissionState {
  const knowledge = emptyKnowledge(HARBOURLINE_ID);
  knowledge.updatedAt = STRESS_NOW;
  knowledge.sections.now = extras.now ?? [
    "Wave 1 scope is Minutes and Planning files only.",
    "Current focus: scan specification freeze and wet-store recovery.",
  ];
  knowledge.sections.decisions = extras.decisions ?? [
    "Helix Imaging is the selected scan vendor.",
    "Public catalogue will be English-only for Wave 1.",
  ];
  knowledge.sections.risks = extras.riskBullets ?? extras.risks.map((r) => r.title);
  knowledge.sections.people = extras.stakeholders.map((s) => `${s.name} — ${s.role}`);
  knowledge.sections.openLoops = extras.openLoops ?? [
    "SSO ticket ownership between Priya Nair and Daniel Okonkwo is not settled.",
  ];
  knowledge.structured = (extras.availability ?? []).map((row) => ({
    id: row.id,
    projectId: HARBOURLINE_ID,
    body: row.body,
    kind: "availability" as const,
    epistemic: "confirmed" as const,
    lifecycle: "current" as const,
    meta: {
      personId: row.personId,
      availability: {
        personId: row.personId,
        awayFromIso: "2026-11-03",
        awayToIso: "2026-11-14",
      },
    },
  }));

  return {
    ...base,
    projects: [
      ...base.projects,
      {
        id: HARBOURLINE_ID,
        name: HARBOURLINE_NAME,
        code: HARBOURLINE_CODE,
        summary:
          "Digitise forty years of civic minutes and planning files, recover the wet-store, and launch a public catalogue.",
        status: "watch",
        kind: "delivery",
        currentFocus: "Scan specification freeze and wet-store recovery",
        nextMilestone: "Scan specification freeze",
        nextMilestoneAt: HCA_DATES.specFreeze.startAt,
        stakeholders: extras.stakeholders,
      },
    ],
    todos: [...(base.todos ?? []), ...extras.todos],
    risks: [...(base.risks ?? []), ...extras.risks],
    timeline: [...(base.timeline ?? []), ...extras.dates],
    knowledge: [...(base.knowledge ?? []), knowledge],
  };
}

/** Young project: enough identity to start a long Capture marathon. */
export function seedEarlyHarbourline(base = experimentalMissionState()): MissionState {
  return withHarbourline(base, {
    stakeholders: people("miriam", "owen", "priya", "lila"),
    todos: [todo(HCA_TODOS.spec), todo(HCA_TODOS.dehumidifier), todo(HCA_TODOS.inventory)],
    risks: [risk(HCA_RISKS.mould), risk(HCA_RISKS.helix)],
    dates: [date(HCA_DATES.cabinet), date(HCA_DATES.specFreeze), date(HCA_DATES.launch)],
    availability: [
      {
        id: "avail-hca-lila",
        personId: HCA_PEOPLE.lila.id,
        body: "Lila Berg is away 3–14 November 2026.",
      },
    ],
  });
}

/** Mature project: history already exists before a new PM arrives. */
export function seedMatureHarbourline(base = experimentalMissionState()): MissionState {
  return withHarbourline(base, {
    stakeholders: people(
      "miriam",
      "owen",
      "priya",
      "daniel",
      "lila",
      "tomas",
      "hannah",
      "samir",
      "elena",
      "chris",
    ),
    todos: [
      todo({ ...HCA_TODOS.spec, done: true }),
      todo({ ...HCA_TODOS.dehumidifier, done: true }),
      todo(HCA_TODOS.foiRules),
      todo(HCA_TODOS.cabinet),
      todo(HCA_TODOS.rota),
      todo(HCA_TODOS.series),
      todo(HCA_TODOS.ux),
      todo(HCA_TODOS.finance),
      todo({ ...HCA_TODOS.intranet, done: false }),
      todo({ ...HCA_TODOS.mouldPhoto, done: true }),
      todo(HCA_TODOS.inventory),
    ],
    risks: [
      risk({ ...HCA_RISKS.mould, status: "watch" }),
      risk({ ...HCA_RISKS.helix, status: "open" }),
      risk(HCA_RISKS.foi),
      risk({ ...HCA_RISKS.sso, status: "open" }),
      risk({ ...HCA_RISKS.dbs, status: "resolved" }),
      risk(HCA_RISKS.a11y),
      risk(HCA_RISKS.year2),
    ],
    dates: [
      date(HCA_DATES.cabinet),
      date(HCA_DATES.kickoff),
      date({ ...HCA_DATES.specFreeze, startAt: "2026-10-09T09:00:00.000Z" }),
      date(HCA_DATES.wetEmpty),
      date(HCA_DATES.alpha),
      date(HCA_DATES.foiWorkshop),
      date(HCA_DATES.volunteer),
      date(HCA_DATES.launch),
    ],
    now: [
      "Wave 1 scope is Minutes and Planning files only.",
      "Scan specification was issued to Helix Imaging.",
      "Wet-store dehumidifier is booked.",
      "Public catalogue alpha is still 20 November 2026.",
    ],
    decisions: [
      "Helix Imaging is the selected scan vendor.",
      "Public catalogue will be English-only for Wave 1.",
      "Museum object photography is out of scope.",
    ],
    openLoops: [
      "SSO ticket ownership between Priya Nair and Daniel Okonkwo is not settled.",
      "December public preview is not decided.",
    ],
    availability: [
      {
        id: "avail-hca-lila",
        personId: HCA_PEOPLE.lila.id,
        body: "Lila Berg is away 3–14 November 2026.",
      },
    ],
  });
}

export function neighbourNames(state: MissionState) {
  return {
    candyland: (state.projects.find((p) => p.id === CANDYLAND_ID)?.stakeholders ?? []).map(
      (s) => s.name,
    ),
    toyworld: (state.projects.find((p) => p.id === TOYWORLD_ID)?.stakeholders ?? []).map(
      (s) => s.name,
    ),
    gaming: (state.projects.find((p) => p.id === GAMING_ID)?.stakeholders ?? []).map((s) => s.name),
  };
}
