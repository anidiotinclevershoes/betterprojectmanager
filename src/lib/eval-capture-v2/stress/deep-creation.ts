/**
 * Frozen Deep Project Creation scenario — Harbourline Civic Archive.
 * Exercises the real New Project V2 path (not Capture V2).
 * Fixture envelope only. No provider calls.
 */

import { buildNewProject } from "@/lib/create-project";
import {
  draftFromProvisional,
  parseNewProjectV2Envelope,
  recategoriseItem,
  type ProvisionalItem,
} from "@/lib/new-project-v2";
import { experimentalMissionState } from "../mission-state";
import type { MissionState } from "@/lib/types";
import { CANDYLAND_ID, GAMING_ID, TOYWORLD_ID } from "@/lib/experiments/worlds";
import { HARBOURLINE_NAME } from "./harbourline";

export const DEEP_CREATION_ID = "harbourline-deep-creation-v1";

/** Frozen 5–10 minute PM brain-dump. Do not rewrite to make production pass. */
export const DEEP_CREATION_NARRATIVE = `Right — this is the Harbourline Civic Archive Refresh. I'm Owen, archives delivery, dumping everything I know so Lume can organise it.

We're digitising about forty years of civic minutes and planning files, emptying the wet-store before winter, and putting a public catalogue online. Wave 1 is Minutes and Planning files only. Museum object photography is explicitly out of scope. School outreach is next financial year, not this one.

Sponsor is Miriam Cole, City Clerk. I, Owen Hart, am delivery lead for Archives. Priya Nair leads Civic ICT. Daniel Okonkwo is vendor lead at Helix Imaging — that's the scan vendor, already selected, that's a confirmed decision. Lila Berg is conservation. Tomas Rezek covers legal and FOI. Hannah Wells is comms. Samir Qureshi is facilities. Elena Voss is the public catalogue UX contractor. Chris Lang is finance business partner. Nora Blake coordinates volunteers. Owen Hart — that's me — also chairs the weekly archive stand-up, same person, don't add me twice.

Dates I actually have: cabinet paper 12 September 2026, vendor kickoff 18 September, scan specification freeze 2 October, wet-store empty 31 October, public catalogue alpha 20 November, FOI policy workshop 4 December, volunteer training 15 January 2027, conservation hold review 28 January, catalogue beta 12 March, public launch 9 April 2027. Hypercare is meant to run to 30 April. If the wet-store dries by November, Lila wants a December public preview — that is not decided. Don't treat it as a date.

To-dos that are real work: issue the scan specification to Helix, book the wet-store dehumidifier, draft FOI redaction rules, confirm the cabinet paper annex, set up the volunteer rota, map the analogue series list, run public catalogue UX sessions, finance gate for year-2 scanning, install catalogue search on the civic intranet, photograph the mould-affected boxes, and chase ICT for identity integration. One thing that's already done: the series inventory of Minutes 1985 to 1995 was completed in June. That is finished, not new work.

Risks: mould in the wet-store, Helix scanning queue overrunning autumn, FOI redaction capacity, civic SSO identity integration, volunteer DBS delays, public catalogue accessibility failing, and year-2 scanning budget not approved.

Decisions already made: Helix Imaging is the scan vendor. Public catalogue will be English-only for Wave 1. Wave 1 scope is Minutes and Planning files only. Not decided: whether photographs of the civic silver are in scope. Not decided: the December public preview.

Lila Berg is away from 3 November to 14 November 2026. Daniel will be on-site the weeks of 21 September and 5 October.

Open questions, please don't turn these into facts: who owns the SSO ticket — Priya or Daniel? Will cabinet want a public comms embargo until March?

Someone brought excellent cinnamon buns to the archives tea on Friday. The lift has been making a grinding noise; that's a building thing, not this project.

Current focus is the scan specification freeze and getting the wet-store under control.`;

type FrozenObs = {
  id: string;
  statement: string;
  evidence: string;
  domain: string;
  disposition?: string;
  proposedValues?: Record<string, unknown>;
};

const OBS: FrozenObs[] = [
  { id: "np-project", statement: "Harbourline Civic Archive Refresh digitises civic minutes and planning files", evidence: "this is the Harbourline Civic Archive Refresh", domain: "knowledge", proposedValues: { title: HARBOURLINE_NAME } },
  { id: "np-miriam", statement: "Miriam Cole is programme sponsor / City Clerk", evidence: "Sponsor is Miriam Cole, City Clerk", domain: "person", proposedValues: { name: "Miriam Cole", role: "Programme sponsor / City Clerk" } },
  { id: "np-owen", statement: "Owen Hart is Archives delivery lead", evidence: "I, Owen Hart, am delivery lead for Archives", domain: "person", proposedValues: { name: "Owen Hart", role: "Archives delivery lead" } },
  { id: "np-priya", statement: "Priya Nair leads Civic ICT", evidence: "Priya Nair leads Civic ICT", domain: "person", proposedValues: { name: "Priya Nair", role: "Civic ICT lead" } },
  { id: "np-daniel", statement: "Daniel Okonkwo is Helix Imaging vendor lead", evidence: "Daniel Okonkwo is vendor lead at Helix Imaging", domain: "person", proposedValues: { name: "Daniel Okonkwo", role: "Helix Imaging vendor lead" } },
  { id: "np-lila", statement: "Lila Berg is conservation lead", evidence: "Lila Berg is conservation", domain: "person", proposedValues: { name: "Lila Berg", role: "Conservation lead" } },
  { id: "np-tomas", statement: "Tomas Rezek covers legal and FOI", evidence: "Tomas Rezek covers legal and FOI", domain: "person", proposedValues: { name: "Tomas Rezek", role: "Legal / FOI" } },
  { id: "np-hannah", statement: "Hannah Wells is comms", evidence: "Hannah Wells is comms", domain: "person", proposedValues: { name: "Hannah Wells", role: "Comms" } },
  { id: "np-samir", statement: "Samir Qureshi is facilities", evidence: "Samir Qureshi is facilities", domain: "person", proposedValues: { name: "Samir Qureshi", role: "Facilities" } },
  { id: "np-elena", statement: "Elena Voss is public catalogue UX contractor", evidence: "Elena Voss is the public catalogue UX contractor", domain: "person", proposedValues: { name: "Elena Voss", role: "Public catalogue UX contractor" } },
  { id: "np-chris", statement: "Chris Lang is finance business partner", evidence: "Chris Lang is finance business partner", domain: "person", proposedValues: { name: "Chris Lang", role: "Finance business partner" } },
  { id: "np-nora", statement: "Nora Blake coordinates volunteers", evidence: "Nora Blake coordinates volunteers", domain: "person", proposedValues: { name: "Nora Blake", role: "Volunteer coordinator" } },
  { id: "np-owen-repeat", statement: "Owen Hart chairs the weekly archive stand-up — same person", evidence: "Owen Hart — that's me — also chairs the weekly archive stand-up, same person, don't add me twice", domain: "person", proposedValues: { name: "Owen Hart", role: "Archives delivery lead" } },
  { id: "np-d-helix", statement: "Helix Imaging is the selected scan vendor", evidence: "Helix Imaging — that's the scan vendor, already selected, that's a confirmed decision", domain: "decision" },
  { id: "np-d-english", statement: "Public catalogue will be English-only for Wave 1", evidence: "Public catalogue will be English-only for Wave 1", domain: "decision" },
  { id: "np-d-scope", statement: "Wave 1 scope is Minutes and Planning files only", evidence: "Wave 1 is Minutes and Planning files only", domain: "decision" },
  { id: "np-not-silver", statement: "Photographs of the civic silver are not decided", evidence: "Not decided: whether photographs of the civic silver are in scope", domain: "commentary" },
  { id: "np-not-preview", statement: "December public preview is not decided", evidence: "If the wet-store dries by November, Lila wants a December public preview — that is not decided", domain: "commentary" },
  { id: "np-out-museum", statement: "Museum object photography is out of scope", evidence: "Museum object photography is explicitly out of scope", domain: "commentary" },
  { id: "np-out-school", statement: "School outreach is next financial year, not this one", evidence: "School outreach is next financial year, not this one", domain: "commentary" },
  { id: "np-ms-cabinet", statement: "Cabinet paper is 12 September 2026", evidence: "cabinet paper 12 September 2026", domain: "milestone", proposedValues: { label: "Cabinet paper", date: "2026-09-12" } },
  { id: "np-ms-kickoff", statement: "Vendor kickoff is 18 September 2026", evidence: "vendor kickoff 18 September", domain: "milestone", proposedValues: { label: "Vendor kickoff", date: "2026-09-18" } },
  { id: "np-ms-spec", statement: "Scan specification freeze is 2 October 2026", evidence: "scan specification freeze 2 October", domain: "milestone", proposedValues: { label: "Scan specification freeze", date: "2026-10-02" } },
  { id: "np-ms-wet", statement: "Wet-store empty is 31 October 2026", evidence: "wet-store empty 31 October", domain: "milestone", proposedValues: { label: "Wet-store empty", date: "2026-10-31" } },
  { id: "np-ms-alpha", statement: "Public catalogue alpha is 20 November 2026", evidence: "public catalogue alpha 20 November", domain: "milestone", proposedValues: { label: "Public catalogue alpha", date: "2026-11-20" } },
  { id: "np-ms-foi", statement: "FOI policy workshop is 4 December 2026", evidence: "FOI policy workshop 4 December", domain: "milestone", proposedValues: { label: "FOI policy workshop", date: "2026-12-04" } },
  { id: "np-ms-vol", statement: "Volunteer training is 15 January 2027", evidence: "volunteer training 15 January 2027", domain: "milestone", proposedValues: { label: "Volunteer training", date: "2027-01-15" } },
  { id: "np-ms-cons", statement: "Conservation hold review is 28 January 2027", evidence: "conservation hold review 28 January", domain: "milestone", proposedValues: { label: "Conservation hold review", date: "2027-01-28" } },
  { id: "np-ms-beta", statement: "Catalogue beta is 12 March 2027", evidence: "catalogue beta 12 March", domain: "milestone", proposedValues: { label: "Catalogue beta", date: "2027-03-12" } },
  { id: "np-ms-launch", statement: "Public launch is 9 April 2027", evidence: "public launch 9 April 2027", domain: "milestone", proposedValues: { label: "Public launch", date: "2027-04-09" } },
  { id: "np-ms-hypercare", statement: "Hypercare runs to 30 April 2027", evidence: "Hypercare is meant to run to 30 April", domain: "milestone", proposedValues: { label: "Hypercare end", date: "2027-04-30" } },
  { id: "np-todo-spec", statement: "Issue the scan specification to Helix", evidence: "issue the scan specification to Helix", domain: "todo", proposedValues: { title: "Issue scan specification to Helix" } },
  { id: "np-todo-dehumid", statement: "Book the wet-store dehumidifier", evidence: "book the wet-store dehumidifier", domain: "todo", proposedValues: { title: "Book wet-store dehumidifier" } },
  { id: "np-todo-foi", statement: "Draft FOI redaction rules", evidence: "draft FOI redaction rules", domain: "todo", proposedValues: { title: "Draft FOI redaction rules" } },
  { id: "np-todo-cabinet", statement: "Confirm the cabinet paper annex", evidence: "confirm the cabinet paper annex", domain: "todo", proposedValues: { title: "Confirm cabinet paper annex" } },
  { id: "np-todo-rota", statement: "Set up the volunteer rota", evidence: "set up the volunteer rota", domain: "todo", proposedValues: { title: "Set up volunteer rota" } },
  { id: "np-todo-series", statement: "Map the analogue series list", evidence: "map the analogue series list", domain: "todo", proposedValues: { title: "Map analogue series list" } },
  { id: "np-todo-ux", statement: "Run public catalogue UX sessions", evidence: "run public catalogue UX sessions", domain: "todo", proposedValues: { title: "Run public catalogue UX sessions" } },
  { id: "np-todo-finance", statement: "Finance gate for year-2 scanning", evidence: "finance gate for year-2 scanning", domain: "todo", proposedValues: { title: "Finance gate for year-2 scanning" } },
  { id: "np-todo-intranet", statement: "Install catalogue search on the civic intranet", evidence: "install catalogue search on the civic intranet", domain: "todo", proposedValues: { title: "Install catalogue search on civic intranet" } },
  { id: "np-todo-photo", statement: "Photograph the mould-affected boxes", evidence: "photograph the mould-affected boxes", domain: "todo", proposedValues: { title: "Photograph the mould-affected boxes" } },
  { id: "np-todo-sso", statement: "Chase ICT for identity integration", evidence: "chase ICT for identity integration", domain: "todo", proposedValues: { title: "Chase ICT for identity integration" } },
  { id: "np-done-inventory", statement: "Series inventory of Minutes 1985–1995 was completed in June", evidence: "the series inventory of Minutes 1985 to 1995 was completed in June. That is finished, not new work", domain: "knowledge" },
  { id: "np-risk-mould", statement: "Mould in the wet-store", evidence: "mould in the wet-store", domain: "risk", proposedValues: { title: "Mould in the wet-store" } },
  { id: "np-risk-helix", statement: "Helix scanning queue overrunning autumn", evidence: "Helix scanning queue overrunning autumn", domain: "risk", proposedValues: { title: "Helix scanning queue overruns autumn" } },
  { id: "np-risk-foi", statement: "FOI redaction capacity", evidence: "FOI redaction capacity", domain: "risk", proposedValues: { title: "FOI redaction capacity" } },
  { id: "np-risk-sso", statement: "Civic SSO identity integration", evidence: "civic SSO identity integration", domain: "risk", proposedValues: { title: "Civic SSO identity integration" } },
  { id: "np-risk-dbs", statement: "Volunteer DBS delays", evidence: "volunteer DBS delays", domain: "risk", proposedValues: { title: "Volunteer DBS delays" } },
  { id: "np-risk-a11y", statement: "Public catalogue accessibility failing", evidence: "public catalogue accessibility failing", domain: "risk", proposedValues: { title: "Public catalogue accessibility fail" } },
  { id: "np-risk-year2", statement: "Year-2 scanning budget not approved", evidence: "year-2 scanning budget not approved", domain: "risk", proposedValues: { title: "Year-2 scanning budget not approved" } },
  { id: "np-avail-lila", statement: "Lila Berg is away 3–14 November 2026", evidence: "Lila Berg is away from 3 November to 14 November 2026", domain: "availability" },
  { id: "np-q-sso", statement: "Who owns the SSO ticket — Priya or Daniel?", evidence: "who owns the SSO ticket — Priya or Daniel?", domain: "commentary" },
  { id: "np-q-embargo", statement: "Will cabinet want a public comms embargo until March?", evidence: "Will cabinet want a public comms embargo until March?", domain: "commentary" },
  { id: "np-chat-buns", statement: "Someone brought cinnamon buns to the archives tea", evidence: "Someone brought excellent cinnamon buns to the archives tea on Friday", domain: "commentary" },
  { id: "np-chat-lift", statement: "The lift has been making a grinding noise — not this project", evidence: "The lift has been making a grinding noise; that's a building thing, not this project", domain: "commentary" },
];

export const DEEP_CREATION_ENVELOPE = {
  project: {
    name: HARBOURLINE_NAME,
    summary:
      "Digitise forty years of civic minutes and planning files, recover the wet-store, and launch a public catalogue.",
    currentFocus: "Scan specification freeze and wet-store recovery",
  },
  observations: OBS.map((row) => ({
    ...row,
    disposition: row.disposition ?? "create_new",
    projectId: null,
  })),
};

export const DEEP_CREATION_EXPECTED = {
  people: [
    "Miriam Cole",
    "Owen Hart",
    "Priya Nair",
    "Daniel Okonkwo",
    "Lila Berg",
    "Tomas Rezek",
    "Hannah Wells",
    "Samir Qureshi",
    "Elena Voss",
    "Chris Lang",
    "Nora Blake",
  ],
  todoTitles: [
    "Issue scan specification to Helix",
    "Book wet-store dehumidifier",
    "Draft FOI redaction rules",
    "Confirm cabinet paper annex",
    "Set up volunteer rota",
    "Map analogue series list",
    "Run public catalogue UX sessions",
    "Finance gate for year-2 scanning",
    "Install catalogue search on civic intranet",
    "Photograph the mould-affected boxes",
    "Chase ICT for identity integration",
  ],
  riskTitles: [
    "Mould in the wet-store",
    "Helix scanning queue overruns autumn",
    "FOI redaction capacity",
    "Civic SSO identity integration",
    "Volunteer DBS delays",
    "Public catalogue accessibility fail",
    "Year-2 scanning budget not approved",
  ],
  dateLabels: [
    "Cabinet paper",
    "Vendor kickoff",
    "Scan specification freeze",
    "Wet-store empty",
    "Public catalogue alpha",
    "FOI policy workshop",
    "Volunteer training",
    "Conservation hold review",
    "Catalogue beta",
    "Public launch",
    "Hypercare end",
  ],
  commentaryIds: [
    "np-not-silver",
    "np-not-preview",
    "np-out-museum",
    "np-out-school",
    "np-q-sso",
    "np-q-embargo",
    "np-chat-buns",
    "np-chat-lift",
  ],
};

export function runDeepCreation(args?: { recategorise?: Array<[string, ProvisionalItem["category"]]> }) {
  const parsed = parseNewProjectV2Envelope(DEEP_CREATION_ENVELOPE);
  let items = parsed.items;
  for (const [id, category] of args?.recategorise ?? []) {
    items = recategoriseItem(items, id, category);
  }
  const draft = draftFromProvisional({
    sourceNarrative: DEEP_CREATION_NARRATIVE,
    sourceMode: "talk",
    // Envelope `project` is ignored (shared Capture has no project object).
    // Name is the categorisation-form step the user supplies; Objective stays empty.
    project: { name: HARBOURLINE_NAME, summary: "", currentFocus: "" },
    items,
  });
  const bundle = buildNewProject(draft);
  const neighbours = experimentalMissionState();
  const state: MissionState = {
    ...neighbours,
    projects: [...neighbours.projects, bundle.project],
    knowledge: [...(neighbours.knowledge ?? []), bundle.knowledge],
    recommendations: [...bundle.recommendations, ...neighbours.recommendations],
    todos: [...bundle.todos, ...(neighbours.todos ?? [])],
    timeline: [...(neighbours.timeline ?? []), ...(bundle.timeline ?? [])],
  };
  const reloaded: MissionState = JSON.parse(JSON.stringify(state)) as MissionState;
  return { parsed, items, draft, bundle, state, reloaded, neighbours };
}

export function neighbourUnchanged(state: MissionState, seed: MissionState) {
  const ids = [CANDYLAND_ID, TOYWORLD_ID, GAMING_ID];
  return ids.every((id) => {
    const before = seed.projects.find((p) => p.id === id);
    const after = state.projects.find((p) => p.id === id);
    return JSON.stringify(before?.stakeholders) === JSON.stringify(after?.stakeholders);
  });
}
