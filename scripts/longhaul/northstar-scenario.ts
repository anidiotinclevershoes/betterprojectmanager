/**
 * Curated 100-capture story: Northstar Member Portal Renewal.
 * Conversational PM language. Oracle writes are semantic, not model wording.
 */
import type { CaptureSpec, ExpectedWrite } from "./types";
import type { ObservationDomain } from "../../src/lib/capture-v2/types";

function w(
  key: string,
  op: ExpectedWrite["op"],
  domain: ObservationDomain,
  title: string,
  values?: Record<string, unknown>,
  scope?: string,
): ExpectedWrite {
  return { key, op, domain, title, values, scope };
}

function cap(
  n: number,
  phase: CaptureSpec["phase"],
  input: string,
  rest: Omit<CaptureSpec, "n" | "phase" | "input">,
): CaptureSpec {
  return {
    n,
    phase,
    input,
    expectedWrites: rest.expectedWrites ?? [],
    expectedNeedsYou: rest.expectedNeedsYou ?? [],
    expectedNoChange: rest.expectedNoChange ?? [],
    curveBalls: rest.curveBalls,
    analyseOnly: rest.analyseOnly,
  };
}

export const NORTHSTAR_NAME = "Northstar Member Portal Renewal";
export const NORTHSTAR_CODE = "NSTAR";
export const ATLAS_NAME = "Atlas Billing Cutover";
export const CHECKPOINTS = [1, 10, 25, 50, 75, 100] as const;
export const UI_CHECKPOINTS = [1, 25, 50, 75, 100] as const;

/** Analyse-only restatements. Never Applied. Run at checkpoints ≥ fromCheckpoint. */
export const ANALYSE_PROBES = [
  {
    id: "reaffirm-priya",
    fromCheckpoint: 1,
    input: "Just confirming: Priya Shah is still the delivery PM. No change to ownership.",
    kind: "reaffirm" as const,
    domain: "person" as const,
    title: "Priya Shah",
    key: "person:priya-shah",
    proposedValues: { name: "Priya Shah", role: "Delivery PM" },
  },
  {
    id: "repeat-release",
    fromCheckpoint: 25,
    input: "The target release is still 27 October 2026. I am restating that date, not moving it.",
    kind: "repeat-date" as const,
    domain: "milestone" as const,
    title: "Release",
    key: "milestone:release",
    proposedValues: { label: "Release", date: "2026-10-27" },
  },
  {
    id: "resolved-cab-historical",
    fromCheckpoint: 75,
    input: "We used to worry about CAB rejection. That risk is already resolved — historical mention only. Do not reopen it.",
    kind: "resolved-historical" as const,
    domain: "risk" as const,
    title: "CAB rejection",
    key: "risk:cab-rejection",
    proposedValues: { title: "CAB rejection", status: "open" },
  },
];

export const ASK_PROBES = [
  {
    id: "release-date",
    question: "What is the current target release date?",
    kind: "current" as const,
    look: "milestone:release",
  },
  {
    id: "open-risks",
    question: "What are the main open risks right now?",
    kind: "current" as const,
    look: "risks:open",
  },
  {
    id: "uat-owner",
    question: "Who currently owns UAT?",
    kind: "current" as const,
    look: "responsibility:UAT",
  },
  {
    id: "open-actions",
    question: "What are the most important open actions?",
    kind: "current" as const,
    look: "todos:open",
  },
  {
    id: "why-dates-moved",
    question: "Why did the CAB or release date move?",
    kind: "historical" as const,
    look: "history:dates",
  },
];

export function buildNorthstarCaptures(): CaptureSpec[] {
  const captures: CaptureSpec[] = [
    cap(1, "settle",
      "Kickoff. Priya Shah is the delivery PM for Northstar Member Portal Renewal. We'll take it week by week.",
      {
        expectedWrites: [
          w("person:priya-shah", "create", "person", "Priya Shah", { role: "Delivery PM" }),
        ],
      }),
    cap(2, "settle",
      "Liam Brooks is the business sponsor. He's the one who asked for the portal renewal.",
      {
        expectedWrites: [
          w("person:liam-brooks", "create", "person", "Liam Brooks", { role: "Sponsor" }),
        ],
      }),
    cap(3, "settle",
      "Sarah Okonkwo is the product owner. Please add Sarah Okonkwo to the project.",
      {
        expectedWrites: [
          w("person:sarah-okonkwo", "create", "person", "Sarah Okonkwo", { role: "Product owner" }),
        ],
      }),
    cap(4, "settle",
      "Marcus Chen is leading the React front-end. That's Marcus Chen, front-end lead.",
      {
        expectedWrites: [
          w("person:marcus-chen", "create", "person", "Marcus Chen", { role: "Front-end lead" }),
        ],
      }),
    cap(5, "settle",
      "Elena Voss owns the legacy back-end session service. Add Elena Voss.",
      {
        expectedWrites: [
          w("person:elena-voss", "create", "person", "Elena Voss", { role: "Legacy back-end" }),
        ],
      }),
    cap(6, "settle",
      "Jordan Hale is test lead and the starting UAT coordinator. Please add Jordan Hale.",
      {
        expectedWrites: [
          w("person:jordan-hale", "create", "person", "Jordan Hale", { role: "QA lead" }),
        ],
      }),
    cap(7, "settle",
      "Dev Patel at NimbusPay is our payments integration contact. They're supplying the wallet widget; we're not swapping processors on this release.",
      {
        expectedWrites: [
          w("person:dev-patel", "create", "person", "Dev Patel", { role: "NimbusPay vendor" }),
          w("knowledge:nimbus-wallet", "create", "knowledge", "NimbusPay supplies the wallet widget; processor stays"),
        ],
      }),
    cap(8, "settle",
      "Amira Rahman chairs CAB. Working rule: CAB packs must be ready 24 hours before the CAB slot. No exceptions because the last renewal got bounced.",
      {
        expectedWrites: [
          w("person:amira-rahman", "create", "person", "Amira Rahman", { role: "CAB chair" }),
          w("knowledge:cab-24h", "create", "knowledge", "CAB packs must be ready 24 hours before CAB"),
        ],
      }),
    cap(9, "settle",
      "Please add a to-do for login error handling.",
      {
        expectedWrites: [
          w("todo:login-error-handling", "create", "todo", "Login error handling"),
        ],
      }),
    cap(10, "settle",
      "Please add a to-do for analytics event changes.",
      {
        expectedWrites: [
          w("todo:analytics-events", "create", "todo", "Analytics event changes"),
        ],
      }),
    cap(11, "delivery",
      "Dates, finally. UAT starts 14 October 2026, CAB is 18 October, and the target release is 27 October 2026. That's the working plan, not a wish.",
      {
        expectedWrites: [
          w("milestone:uat-start", "create", "milestone", "UAT start", { date: "2026-10-14" }),
          w("milestone:cab", "create", "milestone", "CAB", { date: "2026-10-18" }),
          w("milestone:release", "create", "milestone", "Release", { date: "2026-10-27" }),
        ],
      }),
    cap(12, "delivery",
      "Jordan Hale needs a proper UAT script. Please add that as a to-do — UAT script — and Jordan Hale owns UAT.",
      {
        expectedWrites: [
          w("todo:uat-script", "create", "todo", "UAT script"),
          w("person:jordan-hale", "update", "responsibility", "Jordan Hale", { ownershipSemantics: "replace" }, "UAT"),
        ],
      }),
    cap(13, "delivery",
      "Two risks I want on the board. The API timeout on the legacy session call is a real risk, and NimbusPay have already flagged a possible vendor delay on the wallet sandbox.",
      {
        expectedWrites: [
          w("risk:api-timeout", "create", "risk", "API timeout on legacy session"),
          w("risk:vendor-delay", "create", "risk", "NimbusPay wallet sandbox delay"),
        ],
      }),
    cap(14, "delivery",
      "Dev Patel pinged — NimbusPay sandbox is slipping about a week. Update the vendor delay risk, still open, just worse.",
      {
        expectedWrites: [
          w("risk:vendor-delay", "update", "risk", "NimbusPay wallet sandbox delay", { status: "open" }),
        ],
      }),
    cap(15, "delivery",
      "Decision from Sarah Okonkwo: we will cut over behind feature flags, not a big-bang DNS flip. Please remember that.",
      {
        expectedWrites: [
          w("knowledge:feature-flags", "create", "decision", "Cut over behind feature flags, not a DNS flip"),
        ],
      }),
    cap(16, "delivery",
      "Tomiko Sato is joining for analytics. Please add Tomiko Sato.",
      {
        expectedWrites: [
          w("person:tomiko-sato", "create", "person", "Tomiko Sato", { role: "Analytics" }),
        ],
      }),
    cap(17, "delivery",
      "Elena Voss is away 8 to 9 October — school thing. Not leaving the project, just those two days.",
      {
        expectedWrites: [
          w("person:elena-voss", "update", "availability", "Elena Voss", { label: "away 2026-10-08 to 2026-10-09" }),
        ],
        curveBalls: ["owner-unavailable"],
      }),
    cap(18, "delivery",
      "Amira wants a CAB pack to-do. Please add CAB pack as an action for her.",
      {
        expectedWrites: [w("todo:cab-pack", "create", "todo", "CAB pack")],
      }),
    cap(19, "delivery",
      "New risk: legacy session cookies might not map cleanly onto the React app. Call it legacy session mapping.",
      {
        expectedWrites: [w("risk:legacy-session", "create", "risk", "Legacy session mapping")],
      }),
    cap(20, "delivery",
      "Export: NimbusPay currently supplies the member CSV export. That's the current arrangement — I'll write it down even if it might change later.",
      {
        expectedWrites: [
          w("todo:export-csv", "create", "todo", "Member CSV export"),
          w("knowledge:nimbus-export", "create", "knowledge", "NimbusPay supplies the member CSV export"),
        ],
      }),
    cap(21, "delivery",
      "Marcus wants a performance budget to-do — keep the member home under 2 seconds on mid-range Android. Also Elena has started SSO migration — add a to-do for SSO migration.",
      {
        expectedWrites: [
          w("todo:perf-budget", "create", "todo", "Performance budget for member home"),
          w("todo:sso-migration", "create", "todo", "SSO migration"),
        ],
      }),
    cap(22, "delivery",
      "Sarah Okonkwo asked for an accessibility pass before UAT. Add that as a to-do.",
      {
        expectedWrites: [w("todo:accessibility-pass", "create", "todo", "Accessibility pass")],
      }),
    cap(23, "delivery",
      "Chris Bell is DevOps for cutover. Please add Chris Bell, and add cutover runbook as an action.",
      {
        expectedWrites: [
          w("person:chris-bell", "create", "person", "Chris Bell", { role: "DevOps" }),
          w("todo:cutover-runbook", "create", "todo", "Cutover runbook"),
        ],
      }),
    cap(24, "delivery",
      "We also need a rollback plan. Separate to-do from the runbook — rollback plan.",
      {
        expectedWrites: [w("todo:rollback-plan", "create", "todo", "Rollback plan")],
      }),
    cap(25, "delivery",
      "We never store PII in application logs on Northstar. Please remember that. Also add member comms as a to-do for Sarah Okonkwo. UAT is still the 14th — no change there.",
      {
        expectedWrites: [
          w("knowledge:no-pii-logs", "create", "knowledge", "Never store PII in application logs"),
          w("todo:member-comms", "create", "todo", "Member comms"),
        ],
        expectedNoChange: [{ key: "milestone:uat-start", note: "UAT still 14 October" }],
      }),
    cap(26, "change",
      "UAT can't start on the 14th anymore — SSO is tight. Move UAT start to 16 October 2026.",
      {
        expectedWrites: [
          w("milestone:uat-start", "update", "milestone", "UAT start", { date: "2026-10-16" }),
        ],
        curveBalls: ["date-moves"],
      }),
    cap(27, "change",
      "Owner change: Marcus is taking analytics events from Tomiko. Tomiko stays on the project for dashboards, but Marcus owns the event work now.",
      {
        expectedWrites: [
          w("person:marcus-chen", "update", "responsibility", "Marcus Chen", { ownershipSemantics: "replace" }, "analytics-events"),
        ],
        curveBalls: ["responsibility-transfer"],
      }),
    cap(28, "change",
      "Vendor delay is still the main worry. NimbusPay now say the sandbox might slip into the week of the 13th. Keep the risk open.",
      {
        expectedWrites: [
          w("risk:vendor-delay", "update", "risk", "NimbusPay wallet sandbox delay", { status: "open" }),
        ],
      }),
    cap(29, "change",
      "Scope clarification from Liam: SSO is in. Marketing widgets are out of this release. Please remember that — we keep getting asked.",
      {
        expectedWrites: [
          w("knowledge:scope-sso-in", "create", "decision", "SSO is in; marketing widgets are out of this release"),
        ],
      }),
    cap(30, "change",
      "API timeout is still open. I'm not changing it. Just mentioning it so nobody thinks it went away.",
      {
        expectedNoChange: [{ key: "risk:api-timeout", note: "API timeout still open, no change" }],
        curveBalls: ["explicit-no-change"],
      }),
    cap(31, "change",
      "Correction: NimbusPay does NOT supply the member CSV export. That's old. We build the export ourselves. Please replace that fact.",
      {
        expectedWrites: [
          w("knowledge:nimbus-export", "resolve", "knowledge", "NimbusPay supplies the member CSV export"),
          w("knowledge:we-build-export", "create", "knowledge", "We build the member CSV export ourselves"),
        ],
        curveBalls: ["decision-supersedes", "explicit-correction"],
      }),
    cap(32, "change",
      "Jordan's UAT script should be ready by 15 October. Update that to-do due date.",
      {
        expectedWrites: [
          w("todo:uat-script", "update", "todo", "UAT script", { date: "2026-10-15" }),
        ],
      }),
    cap(33, "change",
      "Sarah Kim is security — different Sarah from Sarah Okonkwo on product. Please add Sarah Kim. She raised pen-test findings we need to close before CAB; add a to-do for pen-test findings.",
      {
        expectedWrites: [
          w("person:sarah-kim", "create", "person", "Sarah Kim", { role: "Security" }),
          w("todo:pen-test-findings", "create", "todo", "Pen-test findings"),
        ],
        curveBalls: ["same-first-name"],
      }),
    cap(34, "change",
      "Elena wants a rate-limit to-do on the session service. Please add rate limit on session API.",
      {
        expectedWrites: [w("todo:rate-limit", "create", "todo", "Rate limit on session API")],
      }),
    cap(35, "change",
      "Marcus finished the login error handling. Mark login error handling done.",
      {
        expectedWrites: [
          w("todo:login-error-handling", "complete", "todo", "Login error handling"),
        ],
      }),
    cap(36, "change",
      "Add session timeout as a to-do — members get dumped after 20 minutes on legacy and we should match that.",
      {
        expectedWrites: [w("todo:session-timeout", "create", "todo", "Session timeout parity")],
      }),
    cap(37, "change",
      "Vendor delay still open. No status change. Dev is chasing internally.",
      {
        expectedNoChange: [{ key: "risk:vendor-delay", note: "Vendor delay still open" }],
      }),
    cap(38, "change",
      "Amira has started the CAB pack — it's in progress, not done. Don't complete it yet.",
      {
        expectedNoChange: [{ key: "todo:cab-pack", note: "CAB pack in progress, not complete" }],
      }),
    cap(39, "change",
      "Liam confirmed release is still 27 October. Don't move it.",
      {
        expectedNoChange: [{ key: "milestone:release", note: "Release still 27 October" }],
      }),
    cap(40, "change",
      "Decision update: feature flags stay on for 48 hours after cutover, not 24. That supersedes the informal 24-hour chatter.",
      {
        expectedWrites: [
          w("knowledge:flags-48h", "create", "decision", "Feature flags stay on 48 hours after cutover"),
        ],
        curveBalls: ["decision-supersedes"],
      }),
    cap(41, "messy",
      "Marcus finished the analytics events and Elena finished the rate limit in the same breath at standup — both done.",
      {
        expectedWrites: [
          w("todo:analytics-events", "complete", "todo", "Analytics event changes"),
          w("todo:rate-limit", "complete", "todo", "Rate limit on session API"),
        ],
        curveBalls: ["two-facts", "multiple-people"],
      }),
    cap(42, "messy",
      "Sarah said the CAB pack needs a threat model before she'll sign it. Can you update that?",
      {
        expectedNeedsYou: [
          { about: "Sarah said the CAB pack needs a threat model", note: "Two Sarahs — product vs security" },
        ],
        curveBalls: ["same-first-name", "unclear-ownership"],
      }),
    cap(43, "messy",
      "Sorry — Sarah Okonkwo meant the threat model is product's job, not Sarah Kim's. Add a to-do for threat model, owned as product work.",
      {
        expectedWrites: [w("todo:threat-model", "create", "todo", "Threat model")],
        curveBalls: ["self-correction"],
      }),
    cap(44, "messy",
      "Markus Chen will pick up the accessibility pass. Wait — that's Marcus Chen, spelling was wrong. Accessibility pass still open, Marcus taking it.",
      {
        expectedWrites: [
          w("person:marcus-chen", "update", "responsibility", "Marcus Chen", { ownershipSemantics: "continue" }, "accessibility-pass"),
        ],
        expectedNoChange: [{ key: "person:marcus-chen", note: "Do not create Markus Chen" }],
        curveBalls: ["corrected-misspelling", "self-correction"],
      }),
    cap(45, "messy",
      "SSO IdP MFA SLO needs to land before UAT or the IdP regression will blow up CAB. That's the same SSO migration to-do — just acronym soup.",
      {
        expectedNoChange: [{ key: "todo:sso-migration", note: "Same SSO migration work, acronym restatement" }],
        curveBalls: ["acronym"],
      }),
    cap(46, "messy",
      "Priya, Marcus and Jordan are all in the 11am working session tomorrow — no project change, just heads up. Chris is still on the runbook.",
      {
        expectedNoChange: [{ key: "todo:cutover-runbook", note: "Chris still on runbook; meeting chatter" }],
        curveBalls: ["multiple-people", "irrelevant-chatter"],
      }),
    cap(47, "messy",
      "yeah so basically after the stand I think we should just get the rollback plan drafted this week because if CAB bounce us we have nothing and Chris said he'd do it but I didn't hear a date so just keep it open ok thanks",
      {
        expectedNoChange: [{ key: "todo:rollback-plan", note: "Rollback plan still open, speech-like restatement" }],
        curveBalls: ["run-on"],
      }),
    cap(48, "messy",
      "Catch-up dump: session timeout still open, member comms still open, perf budget still open, accessibility still open, and please add vendor contract check as a new to-do for Liam. Also Jordan is still UAT.",
      {
        expectedWrites: [w("todo:vendor-contract-check", "create", "todo", "Vendor contract check")],
        expectedNoChange: [
          { key: "todo:session-timeout", note: "session timeout still open" },
          { key: "todo:member-comms", note: "member comms still open" },
          { key: "todo:perf-budget", note: "perf budget still open" },
          { key: "todo:accessibility-pass", note: "accessibility still open" },
        ],
        curveBalls: ["5-plus-facts"],
      }),
    cap(49, "messy",
      "Analytics due Friday — sorry, Monday the 14th. That's already on the analytics to-do which Marcus finished, so this is leftover chatter. Don't resurrect it.",
      {
        expectedNoChange: [{ key: "todo:analytics-events", note: "Analytics already complete; leftover due-date chatter" }],
        curveBalls: ["self-correction", "no-resurrection"],
      }),
    cap(50, "messy",
      "Someone should own hypercare. Not sure who. Can we flag that?",
      {
        expectedNeedsYou: [
          { about: "Someone should own hypercare", note: "Unclear ownership" },
        ],
        curveBalls: ["unclear-ownership"],
      }),
    cap(51, "messy",
      "Sarah said the member comms can go out the day before release. That's it.",
      {
        expectedNeedsYou: [
          { about: "Sarah said the member comms can go out the day before release", note: "Two Sarahs still on the project" },
        ],
        curveBalls: ["same-first-name"],
      }),
    cap(52, "messy",
      "Clarifying capture 51: Sarah Okonkwo on product — member comms the day before release. Update that to-do note/due to 26 October.",
      {
        expectedWrites: [
          w("todo:member-comms", "update", "todo", "Member comms", { date: "2026-10-26" }),
        ],
        curveBalls: ["self-correction"],
      }),
    cap(53, "messy",
      "Marcus is NOT doing UAT. Jordan is. If anyone's notes say Marcus owns UAT, that's wrong.",
      {
        expectedNoChange: [{ key: "person:jordan-hale", note: "Jordan still owns UAT; Marcus is not UAT" }],
        curveBalls: ["negation"],
      }),
    cap(54, "messy",
      "Side chat about biscuits and the printer jam, and also Elena finished SSO migration. That's the useful bit.",
      {
        expectedWrites: [w("todo:sso-migration", "complete", "todo", "SSO migration")],
        curveBalls: ["irrelevant-chatter"],
      }),
    cap(55, "messy",
      "Priya Shah, Marcus Chen, Elena Voss and Jordan Hale were all on the call — no new owners. Accessibility pass still with Marcus.",
      {
        expectedNoChange: [{ key: "todo:accessibility-pass", note: "Accessibility still with Marcus" }],
        curveBalls: ["multiple-people"],
      }),
    cap(56, "lifecycle",
      "New defect from Jordan: login loop on password reset. Please add that to-do — login loop on password reset.",
      {
        expectedWrites: [w("todo:defect-login-loop", "create", "todo", "Login loop on password reset")],
      }),
    cap(57, "lifecycle",
      "That login loop defect needs to be done by 17 October. Same item, just a date.",
      {
        expectedWrites: [
          w("todo:defect-login-loop", "update", "todo", "Login loop on password reset", { date: "2026-10-17" }),
        ],
        curveBalls: ["same-object-update"],
      }),
    cap(58, "lifecycle",
      "Marcus fixed the login loop. Mark it done.",
      {
        expectedWrites: [w("todo:defect-login-loop", "complete", "todo", "Login loop on password reset")],
      }),
    cap(59, "lifecycle",
      "Follow-up: add a to-do to regression-test password reset on staging.",
      {
        expectedWrites: [w("todo:password-reset-regression", "create", "todo", "Regression-test password reset on staging")],
      }),
    cap(60, "lifecycle",
      "New risk: CAB rejection if the threat model is thin. Call it CAB rejection.",
      {
        expectedWrites: [w("risk:cab-rejection", "create", "risk", "CAB rejection")],
      }),
    cap(61, "lifecycle",
      "CAB rejection risk is watch, not panic. Update status to watch.",
      {
        expectedWrites: [w("risk:cab-rejection", "update", "risk", "CAB rejection", { status: "watch" })],
      }),
    cap(62, "lifecycle",
      "Threat model landed and Amira is happier. Resolve the CAB rejection risk.",
      {
        expectedWrites: [
          w("todo:threat-model", "complete", "todo", "Threat model"),
          w("risk:cab-rejection", "resolve", "risk", "CAB rejection"),
        ],
      }),
    cap(63, "lifecycle",
      "UAT start moves again — 20 October 2026. Jordan asked for two more days after SSO.",
      {
        expectedWrites: [
          w("milestone:uat-start", "update", "milestone", "UAT start", { date: "2026-10-20" }),
        ],
        curveBalls: ["date-moves-twice"],
      }),
    cap(64, "lifecycle",
      "Actually CAB is the 18th and UAT sitting after CAB is backwards. Move UAT start to 18 October so it runs into CAB week, not after.",
      {
        expectedWrites: [
          w("milestone:uat-start", "update", "milestone", "UAT start", { date: "2026-10-18" }),
        ],
        curveBalls: ["date-moves-twice"],
      }),
    cap(65, "lifecycle",
      "UAT ownership: Priya Shah is taking UAT from Jordan Hale this week so Jordan can stay in defect triage.",
      {
        expectedWrites: [
          w("person:priya-shah", "update", "responsibility", "Priya Shah", { ownershipSemantics: "replace" }, "UAT"),
        ],
        curveBalls: ["responsibility-transfer"],
      }),
    cap(66, "lifecycle",
      "Change of plan: Jordan Hale takes UAT back. Priya is covering steering. Jordan owns UAT again.",
      {
        expectedWrites: [
          w("person:jordan-hale", "update", "responsibility", "Jordan Hale", { ownershipSemantics: "replace" }, "UAT"),
        ],
        curveBalls: ["responsibility-moves-back"],
      }),
    cap(67, "lifecycle",
      "Tomiko Sato is away 21 October for a conference. One day.",
      {
        expectedWrites: [
          w("person:tomiko-sato", "update", "availability", "Tomiko Sato", { label: "away 2026-10-21" }),
        ],
      }),
    cap(68, "lifecycle",
      "Working rule update: CAB packs still 24 hours before, but they now also need the rollback plan attached. Don't drop the 24-hour rule.",
      {
        expectedWrites: [
          w("knowledge:cab-rollback-attached", "create", "knowledge", "CAB packs must include the rollback plan"),
        ],
        expectedNoChange: [{ key: "knowledge:cab-24h", note: "24-hour CAB rule remains" }],
      }),
    cap(69, "lifecycle",
      "Please update the UAT checklist — that's the UAT script to-do, we're just calling it the checklist now. Due date still 15 October.",
      {
        expectedWrites: [
          w("todo:uat-script", "update", "todo", "UAT script", { date: "2026-10-15" }),
        ],
        curveBalls: ["todo-renamed-same-object"],
      }),
    cap(70, "lifecycle",
      "UAT script is done. Add a follow-up: UAT evidence pack.",
      {
        expectedWrites: [
          w("todo:uat-script", "complete", "todo", "UAT script"),
          w("todo:uat-evidence-pack", "create", "todo", "UAT evidence pack"),
        ],
      }),
    cap(71, "stale",
      "Ignore the date in yesterday's steering notes — CAB is still the 18th. Someone typed the 22nd in the pack by mistake.",
      {
        expectedNoChange: [{ key: "milestone:cab", note: "CAB still 18 October; ignore 22nd" }],
        curveBalls: ["quoted-stale-note"],
      }),
    cap(72, "stale",
      "The handover says Marcus owns UAT but that's old. Jordan Hale still owns UAT. Don't switch it.",
      {
        expectedNoChange: [{ key: "person:jordan-hale", note: "Jordan still owns UAT; handover is stale" }],
        curveBalls: ["quoted-stale-note"],
      }),
    cap(73, "stale",
      "We discussed moving release to the 30th but didn't agree it. It's still the 27th.",
      {
        expectedNoChange: [{ key: "milestone:release", note: "Release still 27 October; 30th was discussed not agreed" }],
        curveBalls: ["discussed-not-agreed"],
      }),
    cap(74, "stale",
      "Don't reopen the API timeout risk — I'm just mentioning that it was the reason we delayed testing last week.",
      {
        expectedNoChange: [{ key: "risk:api-timeout", note: "API timeout remains as-is; historical mention" }],
        curveBalls: ["historical-risk-mention"],
      }),
    cap(75, "stale",
      "Old notes say NimbusPay supplies the export but that's no longer true. We already corrected this. Don't put the vendor back on export.",
      {
        expectedNoChange: [{ key: "knowledge:we-build-export", note: "We still build the export; old vendor note is stale" }],
        curveBalls: ["quoted-stale-note", "no-resurrection"],
      }),
    cap(76, "stale",
      "We considered a weekend cutover but decided against it. Stay on the Tuesday 27th release.",
      {
        expectedNoChange: [{ key: "milestone:release", note: "Weekend cutover rejected; release 27th" }],
        curveBalls: ["considered-but-decided-against"],
      }),
    cap(77, "stale",
      "No change on release. Still 27 October 2026.",
      {
        expectedNoChange: [{ key: "milestone:release", note: "Explicit no change — release 27th" }],
        curveBalls: ["explicit-no-change"],
      }),
    cap(78, "stale",
      "Quoted from last month's RAID: 'UAT 14 October'. That's outdated. Current UAT start is the 18th. Don't roll the date back.",
      {
        expectedNoChange: [{ key: "milestone:uat-start", note: "UAT remains 18 October; 14th is quoted stale" }],
        curveBalls: ["quoted-stale-note"],
      }),
    cap(79, "stale",
      "The CAB rejection risk we closed after the threat model — just mentioning it in the weekly. It stays resolved.",
      {
        expectedNoChange: [{ key: "risk:cab-rejection", note: "CAB rejection stays resolved" }],
        curveBalls: ["historical-resolved-risk"],
      }),
    cap(80, "stale",
      "Don't touch Atlas Billing Cutover. Someone pasted their ledger to-do into our chat by mistake. Close the billing ledger is not a Northstar action.",
      {
        expectedNoChange: [{ note: "Atlas Billing reference — do not mutate the other project" }],
        curveBalls: ["another-project-reference"],
      }),
    cap(81, "stale",
      "Marcus is NOT covering security. Sarah Kim is. Don't reassign pen-test findings.",
      {
        expectedNoChange: [{ key: "todo:pen-test-findings", note: "Pen-test stays with security / Sarah Kim" }],
        curveBalls: ["negation"],
      }),
    cap(82, "stale",
      "Steering PDF still shows CAB on the 12th in the header. That's a copied template. CAB is the 18th.",
      {
        expectedNoChange: [{ key: "milestone:cab", note: "CAB still 18th; 12th is template cruft" }],
        curveBalls: ["quoted-stale-note"],
      }),
    cap(83, "stale",
      "NimbusPay sandbox arrived. Vendor delay is not a risk anymore — resolve it.",
      {
        expectedWrites: [w("risk:vendor-delay", "resolve", "risk", "NimbusPay wallet sandbox delay")],
        curveBalls: ["not-a-risk-anymore"],
      }),
    cap(84, "stale",
      "Tomiko Sato's last day on Northstar is Friday. She's leaving the project after the conference. Dashboards go with her handover notes. Record that Tomiko Sato has left — do not invent a replacement yet.",
      {
        expectedWrites: [
          w("knowledge:tomiko-left", "create", "knowledge", "Tomiko Sato has left the project"),
        ],
        curveBalls: ["person-leaves"],
      }),
    cap(85, "stale",
      "Nadia Qureshi is joining as analytics replacement from next week. Please add her.",
      {
        expectedWrites: [
          w("person:nadia-qureshi", "create", "person", "Nadia Qureshi", { role: "Analytics" }),
        ],
        curveBalls: ["replacement-joins"],
      }),
    cap(86, "release",
      "Jordan found a defect: export encoding is mangling names. Add export encoding defect.",
      {
        expectedWrites: [w("todo:defect-export-encoding", "create", "todo", "Export encoding defect")],
      }),
    cap(87, "release",
      "Another defect: login loop is back on Safari 16. New to-do, not the old completed one — Safari login loop.",
      {
        expectedWrites: [w("todo:defect-safari-login-loop", "create", "todo", "Safari login loop")],
      }),
    cap(88, "release",
      "UAT is in progress as of today. Jordan still owns it. Evidence pack still open.",
      {
        expectedNoChange: [
          { key: "person:jordan-hale", note: "Jordan still owns UAT" },
          { key: "todo:uat-evidence-pack", note: "Evidence pack still open" },
        ],
      }),
    cap(89, "release",
      "Amira submitted the CAB pack. Mark CAB pack done.",
      {
        expectedWrites: [w("todo:cab-pack", "complete", "todo", "CAB pack")],
      }),
    cap(90, "release",
      "Elena Voss is out sick 22 to 23 October. Temporary. Chris Bell covers cutover questions while she's out.",
      {
        expectedWrites: [
          w("person:elena-voss", "update", "availability", "Elena Voss", { label: "away 2026-10-22 to 2026-10-23" }),
          w("person:chris-bell", "update", "responsibility", "Chris Bell", { ownershipSemantics: "continue" }, "cutover"),
        ],
        curveBalls: ["owner-unavailable", "late-owner-change"],
      }),
    cap(91, "release",
      "Late change: Chris Bell owns cutover execution, not Elena. Elena stays on the session service.",
      {
        expectedWrites: [
          w("person:chris-bell", "update", "responsibility", "Chris Bell", { ownershipSemantics: "replace" }, "cutover"),
        ],
        curveBalls: ["late-owner-change"],
      }),
    cap(92, "release",
      "Rollback plan and cutover runbook are both done. Mark them complete.",
      {
        expectedWrites: [
          w("todo:rollback-plan", "complete", "todo", "Rollback plan"),
          w("todo:cutover-runbook", "complete", "todo", "Cutover runbook"),
        ],
      }),
    cap(93, "release",
      "Pen-test findings closed. Accessibility pass done. Perf budget accepted. Mark those three complete.",
      {
        expectedWrites: [
          w("todo:pen-test-findings", "complete", "todo", "Pen-test findings"),
          w("todo:accessibility-pass", "complete", "todo", "Accessibility pass"),
          w("todo:perf-budget", "complete", "todo", "Performance budget for member home"),
        ],
        curveBalls: ["5-plus-facts"],
      }),
    cap(94, "release",
      "Deployment decision: we go on 27 October. CAB approved. Release date does not move.",
      {
        expectedWrites: [
          w("knowledge:go-27", "create", "decision", "CAB approved go-live on 27 October"),
        ],
        expectedNoChange: [{ key: "milestone:release", note: "Release remains 27 October" }],
      }),
    cap(95, "release",
      `Steering notes 24 Oct. Attendees Priya Shah, Liam Brooks, Sarah Okonkwo, Amira Rahman.
UAT evidence pack still outstanding. Safari login loop still open. Export encoding still open.
Vendor delay is closed. API timeout remains open until after hypercare.
Chris Bell confirmed cutover window 06:00–08:00. Member comms still due 26 Oct.
Do not reopen CAB rejection. Do not move CAB off the 18th (it's already happened / on track).`,
      {
        expectedNoChange: [
          { key: "todo:uat-evidence-pack", note: "still outstanding" },
          { key: "todo:defect-safari-login-loop", note: "still open" },
          { key: "todo:defect-export-encoding", note: "still open" },
          { key: "risk:api-timeout", note: "still open until hypercare" },
          { key: "risk:cab-rejection", note: "do not reopen" },
        ],
        curveBalls: ["dense-meeting-notes"],
      }),
    cap(96, "release",
      `Standup dump. Marcus fixed Safari login loop — mark it done. Elena is back, sick leave over.
Nadia Qureshi is shadowing dashboards. Password-reset regression is done.
Session timeout parity still open. Feature-flag cleanup should be added as a post-release to-do.`,
      {
        expectedWrites: [
          w("todo:defect-safari-login-loop", "complete", "todo", "Safari login loop"),
          w("todo:password-reset-regression", "complete", "todo", "Regression-test password reset on staging"),
          w("todo:feature-flag-cleanup", "create", "todo", "Feature-flag cleanup"),
        ],
        curveBalls: ["dense-meeting-notes"],
      }),
    cap(97, "release",
      "Export encoding is fixed. Member comms went out. UAT evidence pack filed. Mark those complete.",
      {
        expectedWrites: [
          w("todo:defect-export-encoding", "complete", "todo", "Export encoding defect"),
          w("todo:member-comms", "complete", "todo", "Member comms"),
          w("todo:uat-evidence-pack", "complete", "todo", "UAT evidence pack"),
        ],
      }),
    cap(98, "release",
      "Legacy session mapping we can live with — accept that risk. API timeout stays open for hypercare. Vendor delay stays resolved.",
      {
        expectedWrites: [
          w("risk:legacy-session", "update", "risk", "Legacy session mapping", { status: "accepted" }),
        ],
        expectedNoChange: [
          { key: "risk:api-timeout", note: "API timeout stays open" },
          { key: "risk:vendor-delay", note: "vendor delay stays resolved" },
        ],
      }),
    cap(99, "release",
      "Post-release: add hypercare rota as a to-do for Priya. Session timeout parity can wait until after go-live — leave it open.",
      {
        expectedWrites: [w("todo:hypercare-rota", "create", "todo", "Hypercare rota")],
        expectedNoChange: [{ key: "todo:session-timeout", note: "Session timeout remains open" }],
      }),
    cap(100, "release",
      "We're live. Release happened 27 October. Project status is hypercare, not closed. Open work is feature-flag cleanup, hypercare rota, and session timeout parity. API timeout still the residual risk. Jordan still owns UAT wrap-up. Don't invent a new release date.",
      {
        expectedWrites: [
          w("knowledge:live-hypercare", "create", "decision", "Live; project in hypercare after 27 October release"),
        ],
        expectedNoChange: [
          { key: "milestone:release", note: "Release remains 27 October" },
          { key: "todo:feature-flag-cleanup", note: "still open" },
          { key: "todo:hypercare-rota", note: "still open" },
          { key: "todo:session-timeout", note: "still open" },
          { key: "risk:api-timeout", note: "residual open risk" },
        ],
      }),
  ];

  if (captures.length !== 100) {
    throw new Error(`Northstar scenario must have 100 captures, got ${captures.length}`);
  }
  for (let i = 0; i < captures.length; i++) {
    if (captures[i]!.n !== i + 1) {
      throw new Error(`Capture numbering gap at index ${i}: n=${captures[i]!.n}`);
    }
  }
  return captures;
}
