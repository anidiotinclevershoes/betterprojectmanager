/**
 * Frozen V4/V5 comparison cases.
 * Written before the V5 prompt text. Do not edit expectations after seeing model output.
 * Replay cases use the previous gate's labels. They are not a rerun of the sequential 100.
 */
import type { CaptureApplyWorld } from "../src/lib/capture/apply/types";
import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
  experimentalApplyWorld,
} from "../src/lib/experiments/worlds";

export type CaseExpect = {
  /** Every needle must appear in one Ready operation. */
  readyIncludes?: string[];
  /** Ready operation type, when the write is the point. */
  readyOperation?: string;
  /** No Ready write is acceptable. */
  noReadyWrite?: boolean;
  /** At least one Needs You row. */
  needsYou?: boolean;
  /** Contradiction: Needs You, and neither side is Ready. An empty form fails. */
  contradiction?: boolean;
  /** A Ready operation containing any of these is an unsafe write. */
  forbidReadyIncludes?: string[];
};

export type V5Case = {
  id: string;
  set: "replay" | "historical" | "holdout" | "safety";
  transcript: string;
  projectId: string;
  world: CaptureApplyWorld;
  trials: number;
  expect: CaseExpect;
};

const PROJECT = "proj-archive";

type Person = { id: string; name: string; role: string };
type Todo = { id: string; title: string; done?: boolean };
type Risk = { id: string; title: string; status: string };
type Milestone = { id: string; label: string; date: string };
type Resp = { id: string; personId: string; personName: string; scope: string };

function archive(args: {
  people: Person[];
  todos?: Todo[];
  risks?: Risk[];
  milestones?: Milestone[];
  responsibilities?: Resp[];
}): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT]),
    projects: [{ id: PROJECT, name: "County archive", code: "ARCH", stakeholders: args.people }],
    todos: (args.todos ?? []).map((row) => ({ ...row, projectId: PROJECT, done: row.done === true })),
    risks: (args.risks ?? []).map((row) => ({ ...row, projectId: PROJECT })),
    timeline: (args.milestones ?? []).map((row) => ({
      id: row.id,
      projectId: PROJECT,
      label: row.label,
      startAt: `${row.date}T12:00:00.000Z`,
    })),
    knowledge: [
      {
        projectId: PROJECT,
        sections: { people: args.people.map((row) => `${row.name} (${row.role})`) },
        structured: (args.responsibilities ?? []).map((row) => ({
          id: row.id,
          kind: "responsibility",
          lifecycle: "current",
          body: `${row.personName} — ${row.scope}`,
          meta: {
            personId: row.personId,
            responsibility: {
              personId: row.personId,
              personName: row.personName,
              scope: row.scope,
              ownerConfirmed: true,
            },
          },
        })),
      },
    ],
  };
}

const corePeople: Person[] = [
  { id: "p-mara", name: "Mara Ellison", role: "Lead archivist" },
  { id: "p-jon", name: "Jon Pell", role: "conservator" },
  { id: "p-nia", name: "Nia Okonkwo", role: "cataloguer" },
  { id: "p-helen", name: "Helen Ward", role: "county sponsor" },
  { id: "p-chris", name: "Chris Ward", role: "facilities lead" },
];

const early = archive({
  people: corePeople,
  todos: [
    { id: "t-1978", title: "Label the 1978 minute books", done: true },
    { id: "t-silica", title: "Order silica gel" },
    { id: "t-photo", title: "Photograph bay 4" },
    { id: "t-loan", title: "Draft the loan agreement" },
  ],
  risks: [
    { id: "r-silver", title: "Silverfish in bay 4", status: "resolved" },
    { id: "r-fund", title: "Funding gap for year 2", status: "open" },
    { id: "r-mould", title: "Mould behind the stack wall", status: "open" },
  ],
  milestones: [
    { id: "m-pc", label: "Practical completion", date: "2026-12-02" },
    { id: "m-open", label: "Public opening", date: "2027-04-23" },
  ],
});

const mid = archive({
  people: [...corePeople, { id: "p-amira", name: "Amira Shah", role: "Welsh-language reviewer" }],
  todos: [
    { id: "t-1978", title: "Label the 1978 minute books", done: true },
    { id: "t-silica", title: "Order silica gel" },
    { id: "t-photo", title: "Photograph bay 4", done: true },
    { id: "t-loan", title: "Draft the loan agreement", done: true },
    { id: "t-chase", title: "Chase the silica gel delivery" },
    { id: "t-van", title: "Book the freezer van for the loan" },
  ],
  risks: [
    { id: "r-silver", title: "Silverfish in bay 4", status: "resolved" },
    { id: "r-fund", title: "Funding gap for year 2", status: "open" },
    { id: "r-mould", title: "Mould behind the stack wall", status: "open" },
    { id: "r-glaze", title: "Condensation on the reading-room glazing", status: "open" },
  ],
  milestones: [
    { id: "m-pc", label: "Practical completion", date: "2026-12-02" },
    { id: "m-open", label: "Public opening", date: "2027-04-23" },
  ],
  responsibilities: [{ id: "resp-fac", personId: "p-chris", personName: "Chris Ward", scope: "facilities checks" }],
});

const late = archive({
  people: [
    ...corePeople,
    { id: "p-amira", name: "Amira Shah", role: "Welsh-language reviewer" },
    { id: "p-lila", name: "Lila Berg", role: "conservation lead" },
    { id: "p-nora", name: "Nora Blake", role: "volunteer coordinator" },
    { id: "p-samir", name: "Samir Qureshi", role: "facilities deputy" },
    { id: "p-priya", name: "Priya Nair", role: "civic ICT lead" },
  ],
  todos: [
    { id: "t-silica", title: "Order silica gel" },
    { id: "t-van", title: "Book the freezer van for the loan" },
    { id: "t-rota", title: "Set up the volunteer rota" },
    { id: "t-intranet", title: "Install catalogue search on the civic intranet" },
    { id: "t-welsh", title: "Confirm the Welsh caption sample" },
  ],
  risks: [
    { id: "r-fund", title: "Funding gap for year 2", status: "watch" },
    { id: "r-foi", title: "FOI redaction capacity", status: "watch" },
    { id: "r-sso", title: "Civic SSO identity integration", status: "open" },
    { id: "r-scan", title: "Year-2 scanning budget not approved", status: "open" },
  ],
  milestones: [
    { id: "m-pc", label: "Practical completion", date: "2026-12-02" },
    { id: "m-open", label: "Public opening", date: "2027-04-23" },
    { id: "m-vendor", label: "Vendor kickoff", date: "2027-01-01" },
    { id: "m-beta", label: "Catalogue beta", date: "2027-03-12" },
  ],
  responsibilities: [
    { id: "resp-fac", personId: "p-chris", personName: "Chris Ward", scope: "facilities checks" },
    { id: "resp-lila", personId: "p-lila", personName: "Lila Berg", scope: "conservation treatments" },
    { id: "resp-priya", personId: "p-priya", personName: "Priya Nair", scope: "civic ICT" },
  ],
});

const replay = (
  id: string,
  transcript: string,
  world: CaptureApplyWorld,
  expect: CaseExpect,
): V5Case => ({ id, set: "replay", transcript, projectId: PROJECT, world, trials: 3, expect });

const historicalWorld = experimentalApplyWorld();

function holdoutWorld(): CaptureApplyWorld {
  const id = "proj-boiler";
  return {
    projectIds: new Set([id]),
    projects: [
      {
        id,
        name: "Boiler house",
        code: "BOIL",
        stakeholders: [
          { id: "p-idris", name: "Idris Cole", role: "site lead" },
          { id: "p-mina-c", name: "Mina Crowe", role: "clerk of works" },
        ],
      },
    ],
    todos: [{ id: "t-flue", projectId: id, title: "Order the replacement flue", done: false }],
    risks: [{ id: "r-damp", projectId: id, title: "Damp in the boiler room", status: "open" }],
    timeline: [
      { id: "m-hand", projectId: id, label: "Practical handover", startAt: "2026-05-03T12:00:00.000Z" },
      { id: "m-boiler", projectId: id, label: "Boiler recommission", startAt: "2026-11-02T12:00:00.000Z" },
    ],
    knowledge: [{ projectId: id, sections: { people: ["Idris Cole (site lead)"] }, structured: [] }],
  };
}

const BOIL = "proj-boiler";

export const V5_CASES: V5Case[] = [
  replay("s20", "Mara Ellison owns the strongroom environment.", early, {
    readyIncludes: ["mara ellison", "strongroom"],
    readyOperation: "confirm_responsibility",
  }),
  replay("s27", "The funding gap for year 2 risk is resolved. Actually it is still open.", early, {
    contradiction: true,
    noReadyWrite: true,
    needsYou: true,
  }),
  replay("s29", "Delete the to-do Order silica gel.", early, {
    readyIncludes: ["t-silica"],
    readyOperation: "delete_todo",
  }),
  replay("s31", "Jon Phelps has joined as volunteer coordinator.", early, {
    readyIncludes: ["jon phelps"],
    readyOperation: "ensure_person",
    forbidReadyIncludes: ["jon pell"],
  }),
  replay("s42", "Nia Okonkwo owns catalogue clean-up.", mid, {
    readyIncludes: ["nia okonkwo", "catalogue"],
    readyOperation: "confirm_responsibility",
  }),
  replay("s44", "The practical completion was 2 December 2026, but that was the old plan. It is 16 December 2026.", mid, {
    readyIncludes: ["2026-12-16"],
    readyOperation: "update_milestone",
    forbidReadyIncludes: ["2026-12-02"],
  }),
  replay("s52", "Pixel Ramos should own our catalogue.", mid, {
    noReadyWrite: true,
    needsYou: true,
    forbidReadyIncludes: ["pixel ramos"],
  }),
  replay("s53", "Chris will own the facilities checks.", mid, {
    noReadyWrite: true,
    needsYou: true,
  }),
  replay("s69", "Nora Blake owns the volunteer rota.", late, {
    readyIncludes: ["nora blake", "rota"],
    readyOperation: "confirm_responsibility",
  }),
  replay("s79", "The civic SSO risk is resolved. Actually it is still open.", late, {
    contradiction: true,
    noReadyWrite: true,
    needsYou: true,
  }),
  replay("s82", "Add a to-do to book the conservation freezer van for March.", late, {
    readyIncludes: ["march"],
    readyOperation: "create_todo",
  }),
  replay("s86", "Delete the to-do Book the freezer van for the loan.", late, {
    readyIncludes: ["t-van"],
    readyOperation: "delete_todo",
  }),
  replay("s95", "Amira Shah owns the Welsh caption sample.", late, {
    readyIncludes: ["amira shah", "welsh"],
    readyOperation: "confirm_responsibility",
  }),
  replay("s96", "Amira is still the Welsh-language reviewer.", late, {
    noReadyWrite: true,
    needsYou: true,
  }),

  {
    id: "h-pronoun",
    set: "historical",
    transcript: "She said she will own the boss balancing pass from now on.",
    projectId: GAMING_ID,
    world: historicalWorld,
    trials: 2,
    expect: { noReadyWrite: true, needsYou: true, forbidReadyIncludes: ["pixel ramos"] },
  },
  {
    id: "h-brick",
    set: "historical",
    transcript: "Brick from the warehouse called; he wants to help with assembly.",
    projectId: TOYWORLD_ID,
    world: historicalWorld,
    trials: 2,
    expect: { noReadyWrite: true, needsYou: true, forbidReadyIncludes: ["brick oakley"] },
  },
  {
    id: "h-parade",
    set: "historical",
    transcript: "Parade day is now 29 October 2026.",
    projectId: CANDYLAND_ID,
    world: historicalWorld,
    trials: 2,
    expect: { readyIncludes: ["2026-10-29"], readyOperation: "update_milestone" },
  },
  {
    id: "h-freeze",
    set: "historical",
    transcript: "Just confirming: Track freeze remains 1 September 2026.",
    projectId: TOYWORLD_ID,
    world: historicalWorld,
    trials: 2,
    expect: { noReadyWrite: true },
  },
  {
    id: "h-mixed",
    set: "historical",
    transcript: "Pippa Gumdrop remains UAT lead. Parade day moved to 22 October 2026. The chocolate fountain pump is overheating.",
    projectId: CANDYLAND_ID,
    world: historicalWorld,
    trials: 2,
    expect: { readyIncludes: ["2026-10-22", "fountain"] },
  },
  {
    id: "h-banners",
    set: "historical",
    transcript: "Please add a to-do to polish the candy-cane banners before the float leaves.",
    projectId: CANDYLAND_ID,
    world: historicalWorld,
    trials: 2,
    expect: { readyIncludes: ["banner"], readyOperation: "create_todo" },
  },
  {
    id: "h-chatter",
    set: "historical",
    transcript: "The lobby cabinets were blasting chiptunes all morning, nothing about the certification sprint.",
    projectId: GAMING_ID,
    world: historicalWorld,
    trials: 2,
    expect: { noReadyWrite: true },
  },
  {
    id: "h-foreign",
    set: "historical",
    transcript: "Pixel Ramos from GamingStudio5000 should own our UAT, and please resolve the Console certification slip risk while you are here.",
    projectId: CANDYLAND_ID,
    world: historicalWorld,
    trials: 2,
    expect: { noReadyWrite: true, needsYou: true, forbidReadyIncludes: ["risk-console", "pixel ramos"] },
  },

  {
    id: "o-contradiction",
    set: "holdout",
    transcript: "The damp in the boiler room is resolved. Actually it is still open.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { contradiction: true, noReadyWrite: true, needsYou: true },
  },
  {
    id: "o-hedge",
    set: "holdout",
    transcript: "Rowan Hale should own the snagging list.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { noReadyWrite: true, needsYou: true, forbidReadyIncludes: ["rowan hale"] },
  },
  {
    id: "o-distinct-name",
    set: "holdout",
    transcript: "Mina Cole has joined as clerk of works.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { readyIncludes: ["mina cole"], readyOperation: "ensure_person", forbidReadyIncludes: ["mina crowe"] },
  },
  {
    id: "o-former-date",
    set: "holdout",
    transcript: "Practical handover was 3 May 2026, but that was the old plan. It is 21 May 2026.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { readyIncludes: ["2026-05-21"], readyOperation: "update_milestone", forbidReadyIncludes: ["2026-05-03"] },
  },
  {
    id: "o-delete",
    set: "holdout",
    transcript: "Delete the to-do Order the replacement flue.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { readyIncludes: ["t-flue"], readyOperation: "delete_todo" },
  },
  {
    id: "o-pronoun",
    set: "holdout",
    transcript: "She will own the flue replacement.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { noReadyWrite: true, needsYou: true },
  },
  {
    id: "o-share",
    set: "holdout",
    transcript: "Idris Cole and Mina Crowe will share the site diary.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { readyIncludes: ["idris cole", "mina crowe", "site diary"] },
  },
  {
    id: "o-later",
    set: "holdout",
    transcript: "Make boiler recommission two weeks later.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { readyIncludes: ["later", "weeks"], readyOperation: "update_milestone" },
  },
  {
    id: "o-back",
    set: "holdout",
    transcript: "Move boiler recommission back one week.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { noReadyWrite: true, needsYou: true },
  },
  {
    id: "o-signoff",
    set: "holdout",
    transcript: "Add knowledge that Idris Cole can sign the flue order.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { noReadyWrite: true, needsYou: true },
  },
  {
    id: "o-someone",
    set: "holdout",
    transcript: "Someone needs to photograph the boiler serial plate.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { readyIncludes: ["serial"], readyOperation: "create_todo", forbidReadyIncludes: ["someone"] },
  },
  {
    id: "o-chatter",
    set: "holdout",
    transcript: "The kettle in the site hut boiled dry. Ignore that.",
    projectId: BOIL,
    world: holdoutWorld(),
    trials: 2,
    expect: { noReadyWrite: true },
  },

  {
    id: "s-share",
    set: "safety",
    transcript: "Helen Ward and Chris Ward will share oversight of the loan agreement.",
    projectId: PROJECT,
    world: early,
    trials: 2,
    expect: { readyIncludes: ["helen ward", "chris ward", "loan agreement"] },
  },
];
