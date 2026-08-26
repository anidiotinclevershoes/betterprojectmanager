import type { Entity, EntityMap } from "../types/knowledge";

export const project = {
  name: "Atlas Platform Modernisation",
  subtitle: "Release 9 CAB preparation and regression sign-off",
  today: "2026-08-21",
  knownCount: 31,
  riskCount: 3,
  actionsLeft: 36,
};

const list: Entity[] = [
  /* ----------------------------------------------------- current position */
  {
    id: "pos-build",
    kind: "position",
    name: "Release 9 is in CAB preparation",
    meta: "Build evidence is the critical path",
    trust: "known",
    now: [
      { label: "Status", value: "On track" },
      { label: "Requires", value: "Final CAB pack", ref: "t-cabpack" },
      { label: "Blocked by", value: "Build stability", ref: "r-build" },
    ],
    connected: [{ label: "Related to", targetId: "d-cab" }],
    source: { name: "CAB readiness forum", when: "19 Aug" },
    actions: ["Edit"],
  },
  {
    id: "pos-payments",
    kind: "position",
    name: "Payments pipeline is still the main technical watch item",
    meta: "Watching since Release 8",
    trust: "known",
    now: [
      { label: "Status", value: "Watching" },
      { label: "Owner", value: "Elena Rostova", ref: "p-elena" },
      { label: "Missing", value: "Two consecutive green builds" },
    ],
    connected: [{ label: "Part of", targetId: "a-payments" }],
    source: { name: "Build pipeline digest", when: "21 Aug" },
    actions: ["Edit"],
  },

  /* ---------------------------------------------------------------- people */
  {
    id: "p-elena",
    kind: "person",
    name: "Elena Rostova",
    initials: "ER",
    role: "Development Lead",
    meta: "Development Lead · owns build stability",
    trust: "known",
    now: [
      { label: "Owns", value: "Build stability", ref: "r-build" },
      { label: "Responsible for", value: "Payments pipeline", ref: "a-payments" },
      { label: "Missing", value: "Dated remediation plan" },
    ],
    moreNow: [
      { label: "Responsible for", value: "Code freeze", ref: "d-freeze" },
      { label: "Away", value: "No leave booked" },
    ],
    connected: [{ label: "Decided", targetId: "dec-gates" }],
    moreConnected: [{ label: "Waiting on", targetId: "w-greenbuilds" }],
    evidence: [
      {
        source: "Release 9 stand-up",
        when: "20 Aug",
        quote: "Two clean payments builds and I'm comfortable signing the gate.",
      },
      { source: "Capture — voice note", when: "12 Aug" },
    ],
    source: { name: "Release 9 stand-up", when: "20 Aug" },
    history: [{ when: "4 Aug", text: "Owns Payments pipeline", was: "Daniel Okafor" }],
    actions: ["Edit"],
  },
  {
    id: "p-marcus",
    kind: "person",
    name: "Marcus Webb",
    initials: "MW",
    role: "Operations Lead",
    meta: "Operations Lead · away 24 Aug",
    trust: "needs-you",
    needsYou: {
      statement: "Marcus is away 24 Aug–1 Sep. Hypercare starts 31 Aug and no cover is named.",
      question: "Who will cover hypercare?",
    },
    now: [
      { label: "Responsible for", value: "Hypercare roster" },
      { label: "Away", value: "24 Aug–1 Sep", ref: "d-marcusleave" },
      { label: "Missing", value: "Named cover" },
    ],
    moreNow: [{ label: "Responsible for", value: "On-call escalation" }],
    connected: [
      { label: "Owns", targetId: "r-hypercare" },
      { label: "Related to", targetId: "d-hypercare" },
    ],
    source: { name: "Ops planning thread", when: "18 Aug" },
    evidence: [
      {
        source: "Ops planning thread",
        when: "18 Aug",
        quote: "I'll be out from the 24th, will confirm cover before I go.",
      },
      { source: "Shared team calendar", when: "21 Aug" },
    ],
    history: [{ when: "18 Aug", text: "Away 24 Aug–1 Sep", was: "No leave recorded" }],
    actions: ["Resolve", "Edit"],
  },
  {
    id: "p-priya",
    kind: "person",
    name: "Priya Shah",
    initials: "PS",
    role: "Finance Sponsor",
    meta: "Finance Sponsor · approves billing evidence",
    trust: "known",
    now: [
      { label: "Approves", value: "Billing regression draft", ref: "t-billing" },
      { label: "Responsible for", value: "Billing evidence sign-off" },
    ],
    moreNow: [{ label: "Away", value: "No leave booked" }],
    connected: [
      { label: "Decided", targetId: "dec-evidence" },
      { label: "Related to", targetId: "r-billing" },
    ],
    source: { name: "Release 8 retro", when: "5 Aug" },
    evidence: [
      {
        source: "Release 8 retro",
        when: "5 Aug",
        quote: "I need the billing numbers in the format we agreed, not a screenshot.",
      },
    ],
    actions: ["Edit"],
  },
  {
    id: "p-sarah",
    kind: "person",
    name: "Sarah Chen",
    initials: "SC",
    role: "Change Manager",
    meta: "Change Manager · chairs CAB",
    trust: "known",
    now: [
      { label: "Chairs", value: "CAB approval", ref: "d-cab" },
      { label: "Waiting on", value: "Final CAB pack", ref: "t-cabpack" },
      { label: "Needs", value: "Pack by 25 Aug" },
    ],
    connected: [
      { label: "Chairs", targetId: "m-forum" },
      { label: "Related to", targetId: "r-build" },
    ],
    source: { name: "CAB readiness forum", when: "19 Aug" },
    evidence: [
      {
        source: "CAB readiness forum",
        when: "19 Aug",
        quote: "Anything flagged three times needs a date next to it before I'll table it.",
      },
    ],
    actions: ["Edit"],
  },

  /* ----------------------------------------------------------------- risks */
  {
    id: "r-build",
    kind: "risk",
    name: "Build stability has no dated remediation plan",
    meta: "Elena Rostova · blocks CAB approval",
    severity: "high",
    trust: "noticed",
    noticedBecause:
      "Raised in three consecutive meetings — 7, 14 and 19 Aug — with no owner and no date recorded.",
    now: [
      { label: "Status", value: "Open" },
      { label: "Owner", value: "Elena Rostova", ref: "p-elena" },
      { label: "Missing", value: "Dated remediation plan" },
      { label: "Blocks", value: "CAB approval", ref: "d-cab" },
    ],
    moreNow: [
      { label: "Raised", value: "7, 14 and 19 Aug" },
      { label: "Waiting on", value: "Two consecutive green builds", ref: "w-greenbuilds" },
    ],
    connected: [{ label: "Part of", targetId: "a-payments" }],
    moreConnected: [
      { label: "Related to", targetId: "dec-gates" },
      { label: "Related to", targetId: "t-plan" },
      { label: "Blocks", targetId: "t-cabpack" },
    ],
    source: { name: "Release 9 stand-up", when: "19 Aug" },
    evidence: [
      {
        source: "Release 9 stand-up",
        when: "19 Aug",
        quote: "Third time we've talked about the flaky payments build. Still no plan.",
      },
      { source: "Release 9 stand-up", when: "14 Aug" },
      { source: "Capture — meeting recording", when: "7 Aug" },
    ],
    history: [
      { when: "19 Aug", text: "Priority high", was: "Medium" },
      { when: "14 Aug", text: "Three mentions joined into one risk" },
    ],
    actions: ["Mark resolved", "Edit"],
  },
  {
    id: "r-hypercare",
    kind: "risk",
    name: "Hypercare cover is not named",
    meta: "Marcus Webb · 31 Aug–1 Sep",
    severity: "medium",
    trust: "needs-you",
    needsYou: {
      statement: "Marcus is away 24 Aug–1 Sep. Hypercare starts 31 Aug and no cover is named.",
      question: "Who will cover hypercare?",
    },
    now: [
      { label: "Status", value: "Open" },
      { label: "Owner", value: "Marcus Webb", ref: "p-marcus" },
      { label: "Missing", value: "Named cover" },
      { label: "Starts", value: "31 Aug", ref: "d-hypercare" },
    ],
    connected: [{ label: "Related to", targetId: "t-roster" }],
    source: { name: "Ops planning thread", when: "18 Aug" },
    evidence: [
      {
        source: "Ops planning thread",
        when: "18 Aug",
        quote: "I'll be out from the 24th, will confirm cover before I go.",
      },
    ],
    actions: ["Resolve", "Edit"],
  },
  {
    id: "r-billing",
    kind: "risk",
    name: "Billing evidence may not meet Finance's format",
    meta: "Reviewed by Priya Shah",
    severity: "medium",
    trust: "known",
    now: [
      { label: "Status", value: "Open" },
      { label: "Owner", value: "You" },
      { label: "Missing", value: "Draft to Priya Shah", ref: "t-billing" },
    ],
    connected: [
      { label: "Reviewed by", targetId: "p-priya" },
      { label: "Related to", targetId: "dec-evidence" },
    ],
    source: { name: "Release 8 retro", when: "5 Aug" },
    actions: ["Mark resolved", "Edit"],
  },

  /* ----------------------------------------------------------------- to do */
  {
    id: "t-roster",
    kind: "task",
    name: "Get named hypercare cover in writing",
    meta: "Waiting on Marcus Webb",
    trust: "known",
    dateISO: "2026-08-22",
    dateSemantic: "Due",
    now: [
      { label: "Status", value: "Not started" },
      { label: "Owner", value: "You" },
      { label: "Due", value: "22 Aug" },
      { label: "Waiting on", value: "Marcus Webb", ref: "p-marcus" },
    ],
    connected: [{ label: "Related to", targetId: "r-hypercare" }],
    source: { name: "Ops planning thread", when: "18 Aug" },
    actions: ["Mark done", "Edit"],
  },
  {
    id: "t-plan",
    kind: "task",
    name: "Agree a dated build-gate plan with Elena",
    meta: "No owner yet",
    trust: "noticed",
    noticedBecause:
      "Build stability has been raised three times with no owner and no date. Lume drafted this to do from that pattern.",
    now: [
      { label: "Status", value: "Suggested" },
      { label: "Owner", value: "Unassigned" },
      { label: "Missing", value: "Agreed date" },
    ],
    connected: [
      { label: "Related to", targetId: "r-build" },
      { label: "Related to", targetId: "p-elena" },
    ],
    source: { name: "Release 9 stand-up", when: "19 Aug" },
    evidence: [
      { source: "Release 9 stand-up", when: "19 Aug" },
      { source: "CAB readiness forum", when: "19 Aug" },
    ],
    actions: ["Assign ownership", "Edit"],
  },
  {
    id: "t-billing",
    kind: "task",
    name: "Send billing regression draft to Priya",
    meta: "Approved by Priya Shah",
    trust: "known",
    dateISO: "2026-08-24",
    dateSemantic: "Due",
    now: [
      { label: "Status", value: "Not started" },
      { label: "Owner", value: "You" },
      { label: "Due", value: "24 Aug" },
      { label: "Approved by", value: "Priya Shah", ref: "p-priya" },
    ],
    connected: [
      { label: "Required for", targetId: "t-cabpack" },
      { label: "Related to", targetId: "r-billing" },
    ],
    source: { name: "Release 8 retro", when: "5 Aug" },
    actions: ["Mark done", "Edit"],
  },
  {
    id: "t-cabpack",
    kind: "task",
    name: "Finalise the Release 9 CAB pack",
    meta: "Due 25 Aug · 1 item missing",
    trust: "known",
    dateISO: "2026-08-25",
    dateSemantic: "Due",
    now: [
      { label: "Status", value: "In progress" },
      { label: "Owner", value: "You" },
      { label: "Due", value: "25 Aug" },
      { label: "Missing", value: "Billing evidence", ref: "t-billing" },
    ],
    moreNow: [{ label: "Blocked by", value: "Build stability", ref: "r-build" }],
    connected: [
      { label: "Required for", targetId: "d-cab" },
      { label: "Reviewed by", targetId: "p-sarah" },
    ],
    source: { name: "CAB readiness forum", when: "19 Aug" },
    history: [{ when: "19 Aug", text: "Due 25 Aug", was: "26 Aug" }],
    actions: ["Mark done", "Edit"],
  },
  {
    id: "t-cabapproval",
    kind: "task",
    name: "Obtain CAB approval",
    meta: "Blocked by the CAB pack",
    trust: "known",
    dateISO: "2026-08-26",
    dateSemantic: "Due",
    now: [
      { label: "Status", value: "Blocked" },
      { label: "Owner", value: "You" },
      { label: "Due", value: "26 Aug" },
      { label: "Blocked by", value: "Final CAB pack", ref: "t-cabpack" },
    ],
    connected: [{ label: "Related to", targetId: "d-cab" }],
    source: { name: "Release calendar", when: "21 Aug" },
    actions: ["Mark done", "Edit"],
  },

  /* ------------------------------------------------------ dates/milestones */
  {
    id: "d-freeze",
    kind: "milestone",
    name: "Code freeze",
    meta: "Freeze · 24 Aug",
    trust: "known",
    dateISO: "2026-08-24",
    dateSemantic: "Freeze",
    now: [
      { label: "Freeze", value: "24 Aug" },
      { label: "Owner", value: "Elena Rostova", ref: "p-elena" },
      { label: "Required for", value: "CAB approval", ref: "d-cab" },
    ],
    source: { name: "Release calendar", when: "21 Aug" },
    actions: ["Edit"],
  },
  {
    id: "d-marcusleave",
    kind: "date",
    name: "Marcus away",
    meta: "Away · 24 Aug–1 Sep",
    trust: "needs-you",
    dateISO: "2026-08-24",
    dateEndISO: "2026-09-01",
    dateSemantic: "Away",
    needsYou: {
      statement: "Hypercare starts 31 Aug, while Marcus is away. No cover is named.",
      question: "Who will cover hypercare?",
    },
    now: [
      { label: "Away", value: "24 Aug–1 Sep" },
      { label: "Missing", value: "Named hypercare cover" },
    ],
    connected: [
      { label: "Related to", targetId: "p-marcus" },
      { label: "Related to", targetId: "d-hypercare" },
    ],
    source: { name: "Shared team calendar", when: "21 Aug" },
    history: [{ when: "18 Aug", text: "Away 24 Aug–1 Sep", was: "No leave recorded" }],
    actions: ["Resolve", "Edit"],
  },
  {
    id: "d-cab",
    kind: "milestone",
    name: "CAB approval",
    meta: "CAB · 26 Aug",
    trust: "known",
    dateISO: "2026-08-26",
    dateSemantic: "CAB",
    now: [
      { label: "CAB", value: "26 Aug" },
      { label: "Chaired by", value: "Sarah Chen", ref: "p-sarah" },
      { label: "Requires", value: "Final CAB pack", ref: "t-cabpack" },
      { label: "Blocked by", value: "Build stability", ref: "r-build" },
    ],
    connected: [{ label: "Required for", targetId: "d-deploy" }],
    moreConnected: [{ label: "Related to", targetId: "m-forum" }],
    source: { name: "Release calendar", when: "21 Aug" },
    history: [{ when: "11 Aug", text: "CAB 26 Aug", was: "2 Sep" }],
    actions: ["Edit"],
  },
  {
    id: "d-deploy",
    kind: "milestone",
    name: "Production deployment",
    meta: "Release · 31 Aug",
    trust: "known",
    dateISO: "2026-08-31",
    dateSemantic: "Release",
    now: [
      { label: "Release", value: "31 Aug" },
      { label: "Status", value: "Provisional" },
      { label: "Depends on", value: "CAB approval", ref: "d-cab" },
    ],
    connected: [{ label: "Related to", targetId: "d-hypercare" }],
    source: { name: "Release calendar", when: "21 Aug" },
    actions: ["Edit"],
  },
  {
    id: "d-hypercare",
    kind: "date",
    name: "Hypercare window",
    meta: "Starts · 31 Aug",
    trust: "known",
    dateISO: "2026-08-31",
    dateEndISO: "2026-09-04",
    dateSemantic: "Starts",
    now: [
      { label: "Starts", value: "31 Aug" },
      { label: "Ends", value: "4 Sep" },
      { label: "Owner", value: "Marcus Webb", ref: "p-marcus" },
      { label: "Missing", value: "Named cover" },
    ],
    connected: [{ label: "Related to", targetId: "r-hypercare" }],
    source: { name: "Ops planning thread", when: "18 Aug" },
    actions: ["Edit"],
  },

  /* ------------------------------------------------------------- decisions */
  {
    id: "dec-gates",
    kind: "decision",
    name: "Require two consecutive green payment builds",
    meta: "Agreed 11 Aug",
    trust: "known",
    now: [
      { label: "Status", value: "Agreed" },
      { label: "Decided", value: "11 Aug" },
      { label: "Decided by", value: "Elena Rostova", ref: "p-elena" },
      { label: "Applies to", value: "Payments pipeline", ref: "a-payments" },
    ],
    connected: [{ label: "Related to", targetId: "r-build" }],
    source: { name: "Release 8 retro", when: "11 Aug" },
    evidence: [
      {
        source: "Release 8 retro",
        when: "11 Aug",
        quote: "We're not repeating Release 8. Gates get hardened before the window closes.",
      },
    ],
    actions: ["Edit"],
  },
  {
    id: "dec-evidence",
    kind: "decision",
    name: "CAB pack must include billing evidence Finance recognises",
    meta: "Agreed 5 Aug",
    trust: "known",
    now: [
      { label: "Status", value: "Agreed" },
      { label: "Decided", value: "5 Aug" },
      { label: "Decided by", value: "Priya Shah", ref: "p-priya" },
    ],
    connected: [{ label: "Related to", targetId: "r-billing" }],
    source: { name: "Release 8 retro", when: "5 Aug" },
    actions: ["Edit"],
  },

  /* --------------------------------------------------------------- waiting */
  {
    id: "w-roster",
    kind: "waiting",
    name: "Named hypercare cover",
    meta: "Waiting on Marcus Webb",
    trust: "known",
    now: [
      { label: "Waiting on", value: "Marcus Webb", ref: "p-marcus" },
      { label: "Asked", value: "18 Aug" },
    ],
    connected: [{ label: "Related to", targetId: "r-hypercare" }],
    source: { name: "Ops planning thread", when: "18 Aug" },
    actions: ["Mark resolved"],
  },
  {
    id: "w-greenbuilds",
    kind: "waiting",
    name: "Two consecutive green payment builds",
    meta: "1 of 2",
    trust: "known",
    now: [
      { label: "Green builds", value: "1 of 2" },
      { label: "Owner", value: "Elena Rostova", ref: "p-elena" },
    ],
    connected: [{ label: "Related to", targetId: "dec-gates" }],
    source: { name: "Build pipeline digest", when: "21 Aug" },
    actions: ["Mark resolved"],
  },

  /* ----------------------------------------------------------------- areas */
  {
    id: "a-payments",
    kind: "area",
    name: "Payments pipeline",
    meta: "Elena Rostova · 2 open",
    trust: "known",
    now: [
      { label: "Open items", value: "2" },
      { label: "Owner", value: "Elena Rostova", ref: "p-elena" },
    ],
    connected: [
      { label: "Related to", targetId: "r-build" },
      { label: "Related to", targetId: "dec-gates" },
    ],
    source: { name: "Release 9 stand-up", when: "19 Aug" },
    actions: ["Edit"],
  },
  {
    id: "a-finance",
    kind: "area",
    name: "Billing & finance evidence",
    meta: "Priya Shah · 1 open",
    trust: "known",
    now: [
      { label: "Open items", value: "1" },
      { label: "Reviewed by", value: "Priya Shah", ref: "p-priya" },
    ],
    connected: [{ label: "Related to", targetId: "r-billing" }],
    source: { name: "Release 8 retro", when: "5 Aug" },
    actions: ["Edit"],
  },

  /* --------------------------------------------------------------- meeting */
  {
    id: "m-forum",
    kind: "meeting",
    name: "Release 9 CAB readiness forum",
    meta: "ATLAS · in 2 days",
    trust: "known",
    dateISO: "2026-08-23",
    dateSemantic: "Starts",
    now: [
      { label: "Starts", value: "23 Aug" },
      { label: "Status", value: "Needs preparation" },
      { label: "Requires", value: "Draft CAB pack", ref: "t-cabpack" },
    ],
    connected: [
      { label: "Chaired by", targetId: "p-sarah" },
      { label: "Required for", targetId: "d-cab" },
    ],
    source: { name: "Calendar invite", when: "21 Aug" },
    actions: ["Edit"],
  },
];

export const entities: EntityMap = Object.fromEntries(list.map((e) => [e.id, e]));

/* Ocean frame contents — one list per approved frame. */
export const positionIds = ["pos-build", "pos-payments"];
export const riskIds = ["r-build", "r-hypercare", "r-billing"];
export const todoIds = ["t-roster", "t-plan", "t-billing", "t-cabpack", "t-cabapproval"];
export const peopleIds = ["p-elena", "p-marcus", "p-priya", "p-sarah"];
export const decisionIds = ["dec-gates", "dec-evidence"];
export const dateIds = ["d-freeze", "d-marcusleave", "d-cab", "d-deploy", "d-hypercare"];
export const waitingIds = ["w-roster", "w-greenbuilds"];
export const timelineIds = ["d-freeze", "d-cab", "d-deploy"];

export const askSuggestions = [
  "What are the open risks for Release 9?",
  "Who owns the CAB pack?",
  "What is waiting on Marcus?",
];
