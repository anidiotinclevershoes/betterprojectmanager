/**
 * End-to-end validation gate: same inputs on this checkout.
 *
 * Pair with a worktree of origin/main replaying the saved envelopes.
 * Validation only. Does not change production Capture.
 *
 * Usage:
 *   npx tsx scripts/observe-capture-simplify-e2e-gate.ts
 *   npx tsx scripts/observe-capture-simplify-e2e-gate.ts --replay <envelopes.json>
 *   npx tsx scripts/observe-capture-simplify-e2e-gate.ts --compare <main.json> <simp.json>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getOpenAIKey, isOpenAIConfigured } from "../src/lib/openai";
import { resolveOpenAIChatModel } from "../src/lib/openai-model";
import {
  CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
  CAPTURE_V2_PROMPT_VERSION,
  buildObservationExtractionPrompt,
} from "../src/lib/capture-v2/prompt";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
  runCaptureV2FromModelJson,
} from "../src/lib/capture-v2";
import type { CaptureApplyWorld } from "../src/lib/capture/apply";
import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
  experimentalApplyWorld,
} from "../src/lib/experiments/worlds";
import { frozenEnvelopeFor } from "../src/lib/eval-capture-v2/frozen-model-outputs";

function loadDotEnvLocal() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const RIVERSIDE_ID = "proj-riverside";
const DDA = "fb74aa0f-dc7f-4fba-a5c5-838a1dd7acf3";
const HELEN = "person-helen";
const TOMOS = "person-tomos";
const MEI = "person-mei";

function riversideWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([RIVERSIDE_ID, "proj-other"]),
    projects: [
      {
        id: RIVERSIDE_ID,
        name: "Riverside Civic Hall",
        code: "RCH",
        stakeholders: [
          { id: HELEN, name: "Helen Ward", role: "PM" },
          { id: TOMOS, name: "Tomos Ellis", role: "Architect" },
          { id: MEI, name: "Mei Chen", role: "QS" },
        ],
      },
      {
        id: "proj-other",
        name: "Other",
        code: "OTH",
        stakeholders: [{ id: "person-foreign", name: "Morgan Vale", role: "Lead" }],
      },
    ],
    risks: [
      { id: DDA, projectId: RIVERSIDE_ID, title: "Outstanding DDA access ramp detail", status: "open" },
      {
        id: "1c682215-ef53-4c94-8e0a-1979b002a433",
        projectId: RIVERSIDE_ID,
        title: "M&E first-fix coordination risk",
        status: "open",
      },
    ],
    todos: [
      { id: "todo-asbestos", projectId: RIVERSIDE_ID, title: "Chase asbestos survey addendum", done: false },
    ],
    timeline: [
      { id: "ms-pc", projectId: RIVERSIDE_ID, label: "Practical completion", startAt: "2026-12-12" },
    ],
    knowledge: [],
  };
}

function worldFor(projectId: string): CaptureApplyWorld {
  if (projectId === RIVERSIDE_ID) return riversideWorld();
  return experimentalApplyWorld();
}

type Expect = {
  material: string;
  ordinary?: boolean;
  wantWrite?: boolean;
  wantNeedsYou?: boolean;
  wantNoChange?: boolean;
  wantLeftUntouched?: boolean;
  correctOps?: string[];
  allowedTargets?: string[];
  prohibitedTargets?: string[];
  prohibitedOps?: string[];
  noSilent?: boolean;
};

type CaseDef = {
  id: string;
  slot: string;
  family: string;
  source: string;
  projectId: string;
  transcript: string;
  live?: boolean;
  raw?: unknown;
  expect: Expect;
};

const LIVE: CaseDef[] = [
  {
    id: "live-todo-create",
    slot: "1 straightforward new To Do",
    family: "ordinary",
    source: "eval corpus todo-create",
    projectId: CANDYLAND_ID,
    live: true,
    transcript:
      "Please add a to-do to polish the candy-cane banners before the float leaves.",
    expect: {
      material: "Create polish candy-cane banners To Do",
      ordinary: true,
      wantWrite: true,
      correctOps: ["create_todo"],
      prohibitedTargets: ["todo-pack"],
      noSilent: true,
    },
  },
  {
    id: "live-risk-resolve",
    slot: "5 existing Issue update",
    family: "ordinary",
    source: "eval corpus risk-resolution",
    projectId: CANDYLAND_ID,
    live: true,
    transcript: "The icing on Gumdrop Bridge has melted; that risk is closed.",
    expect: {
      material: "Resolve Gumdrop Bridge icing",
      ordinary: true,
      wantWrite: true,
      correctOps: ["update_risk_status"],
      allowedTargets: ["risk-bridge"],
      prohibitedOps: ["create_todo", "create_risk"],
      noSilent: true,
    },
  },
  {
    id: "live-person-create",
    slot: "3 straightforward new Person",
    family: "ordinary",
    source: "eval corpus new-person (Candyland wording)",
    projectId: CANDYLAND_ID,
    live: true,
    transcript: "Please add Jordan Hale as the new lighting lead.",
    expect: {
      material: "Create Jordan Hale",
      ordinary: true,
      wantWrite: true,
      correctOps: ["ensure_person"],
      prohibitedTargets: ["person-gumdrop", "person-fizz"],
      noSilent: true,
    },
  },
  {
    id: "live-person-owns",
    slot: "4 Person + explicit responsibility",
    family: "ordinary",
    source: "explicit owns wording",
    projectId: CANDYLAND_ID,
    live: true,
    transcript: "Sarah Kim owns float safety.",
    expect: {
      material: "Sarah Kim owns float safety",
      ordinary: true,
      wantWrite: true,
      correctOps: ["confirm_responsibility", "ensure_person"],
      prohibitedTargets: ["person-gumdrop"],
      noSilent: true,
    },
  },
  {
    id: "live-ambiguous-brick",
    slot: "11 ambiguous first-name identity",
    family: "uncertain",
    source: "eval corpus ambiguous-same-first-name",
    projectId: TOYWORLD_ID,
    live: true,
    transcript: "Brick from the warehouse called; he wants to help with assembly.",
    expect: {
      material: "Ambiguous Brick — do not bind Oakley",
      wantNeedsYou: true,
      prohibitedTargets: ["person-brick"],
      prohibitedOps: ["ensure_person"],
      noSilent: true,
    },
  },
  {
    id: "live-vague",
    slot: "17 vague concern",
    family: "uncertain",
    source: "eval / previous observe",
    projectId: CANDYLAND_ID,
    live: true,
    transcript: "Security seem worried about it.",
    expect: {
      material: "Vague worry — no invented risk",
      wantLeftUntouched: true,
      prohibitedOps: ["create_risk", "create_todo"],
      noSilent: true,
    },
  },
  {
    id: "live-mixed",
    slot: "19 mixed Capture",
    family: "mixed",
    source: "clear write + vague leftover",
    projectId: CANDYLAND_ID,
    live: true,
    transcript:
      "Please add a to-do to order extra sprinkles, and I think Security might be worried.",
    expect: {
      material: "Sprinkles To Do plus leftover Security worry",
      ordinary: true,
      noSilent: true,
      prohibitedTargets: ["todo-pack"],
    },
  },
  {
    id: "live-noisy",
    slot: "20 noisy multi-fact",
    family: "mixed",
    source: "eval corpus mixed-domains",
    projectId: CANDYLAND_ID,
    live: true,
    transcript:
      "Pippa Gumdrop remains UAT lead. Parade day moved to 22 October 2026. The chocolate fountain pump is overheating.",
    expect: {
      material: "Pippa continuity + Parade move + new fountain risk",
      ordinary: true,
      wantWrite: true,
      correctOps: ["update_milestone", "create_risk"],
      prohibitedOps: ["create_todo"],
      noSilent: true,
    },
  },
];

const FIXTURES: CaseDef[] = [
  {
    id: "fx-todo-create",
    slot: "1 straightforward new To Do",
    family: "ordinary",
    source: "frozen todo-create",
    projectId: CANDYLAND_ID,
    transcript:
      "Please add a to-do to polish the candy-cane banners before the float leaves.",
    raw: frozenEnvelopeFor("todo-create"),
    expect: {
      material: "Create polish candy-cane banners To Do",
      ordinary: true,
      wantWrite: true,
      correctOps: ["create_todo"],
      prohibitedTargets: ["todo-pack"],
      noSilent: true,
    },
  },
  {
    id: "fx-new-risk",
    slot: "2 straightforward new Issue",
    family: "ordinary",
    source: "eval new-risk wording + explicit create",
    projectId: GAMING_ID,
    transcript:
      "The shader compile is stalling the cert build and could miss the nightlies.",
    raw: {
      observations: [
        {
          id: "obs-shader",
          statement: "Shader compile is stalling the cert build",
          evidence:
            "The shader compile is stalling the cert build and could miss the nightlies.",
          domain: "risk",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { title: "Shader compile stalling cert build" },
        },
      ],
    },
    expect: {
      material: "Create shader-compile risk",
      ordinary: true,
      wantWrite: true,
      correctOps: ["create_risk"],
      prohibitedTargets: ["risk-console"],
      noSilent: true,
    },
  },
  {
    id: "fx-new-person",
    slot: "3 straightforward new Person",
    family: "ordinary",
    source: "frozen new-person",
    projectId: TOYWORLD_ID,
    transcript:
      "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    raw: frozenEnvelopeFor("new-person"),
    expect: {
      material: "Create Velvet Sprocket",
      ordinary: true,
      wantWrite: true,
      correctOps: ["ensure_person"],
      prohibitedTargets: ["person-brick", "person-buttons"],
      noSilent: true,
    },
  },
  {
    id: "fx-person-owns",
    slot: "4 Person + explicit responsibility",
    family: "ordinary",
    source: "responsibility-canonical Leo Mensah",
    projectId: RIVERSIDE_ID,
    transcript: "Leo Mensah will own fire-door certificates.",
    raw: {
      observations: [
        {
          id: "obs-leo",
          statement: "Leo Mensah will own fire-door certificates",
          evidence: "Leo Mensah will own fire-door certificates.",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          candidateTargetTitle: "Leo Mensah",
          proposedValues: { name: "Leo Mensah" },
        },
      ],
    },
    expect: {
      material: "Leo Mensah owns fire-door certificates",
      ordinary: true,
      wantWrite: true,
      correctOps: ["confirm_responsibility"],
      noSilent: true,
    },
  },
  {
    id: "fx-risk-resolve",
    slot: "5 existing Issue update",
    family: "ordinary",
    source: "frozen risk-resolution",
    projectId: CANDYLAND_ID,
    transcript: "The icing on Gumdrop Bridge has melted; that risk is closed.",
    raw: frozenEnvelopeFor("risk-resolution"),
    expect: {
      material: "Resolve Gumdrop Bridge icing",
      ordinary: true,
      wantWrite: true,
      correctOps: ["update_risk_status"],
      allowedTargets: ["risk-bridge"],
      prohibitedOps: ["create_todo", "create_risk"],
      noSilent: true,
    },
  },
  {
    id: "fx-todo-complete",
    slot: "6 existing To Do update / 8 supported complete",
    family: "ordinary",
    source: "jelly pack done",
    projectId: CANDYLAND_ID,
    transcript: "Prepare the jelly pack is done.",
    raw: {
      observations: [
        {
          id: "obs-pack",
          statement: "Prepare the jelly pack is done",
          evidence: "Prepare the jelly pack is done.",
          domain: "todo",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "todo-pack",
          candidateTargetTitle: "Prepare the jelly pack",
          proposedValues: { status: "complete" },
        },
      ],
    },
    expect: {
      material: "Complete Prepare the jelly pack",
      ordinary: true,
      wantWrite: true,
      correctOps: ["complete_todo"],
      allowedTargets: ["todo-pack"],
      noSilent: true,
    },
  },
  {
    id: "fx-milestone-move",
    slot: "7 existing milestone/date update",
    family: "ordinary",
    source: "frozen milestone-move",
    projectId: CANDYLAND_ID,
    transcript: "Parade day is now 29 October 2026.",
    raw: frozenEnvelopeFor("milestone-move"),
    expect: {
      material: "Move Parade day to 29 October 2026",
      ordinary: true,
      wantWrite: true,
      correctOps: ["update_milestone"],
      allowedTargets: ["ms-parade"],
      prohibitedOps: ["create_todo", "create_milestone"],
      noSilent: true,
    },
  },
  {
    id: "fx-true-no-change",
    slot: "9 true No change",
    family: "no_change",
    source: "Parade day already 15 October with values",
    projectId: CANDYLAND_ID,
    transcript: "Parade day is still 15 October 2026. No change to that date.",
    raw: {
      observations: [
        {
          id: "obs-same",
          statement: "Parade day is still 15 October 2026",
          evidence: "Parade day is still 15 October 2026.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "ms-parade",
          candidateTargetTitle: "Parade day",
          proposedValues: { date: "2026-10-15" },
        },
      ],
    },
    expect: {
      material: "Parade day already 15 October — no mutation",
      ordinary: true,
      wantNoChange: true,
      prohibitedOps: ["update_milestone", "create_milestone"],
      noSilent: true,
    },
  },
  {
    id: "fx-restated-person",
    slot: "10 repeated/restated existing truth",
    family: "no_change",
    source: "frozen existing-person",
    projectId: CANDYLAND_ID,
    transcript: "Pippa Gumdrop is still the UAT lead for the licorice stands.",
    raw: frozenEnvelopeFor("existing-person"),
    expect: {
      material: "Pippa already on project — no duplicate person",
      ordinary: true,
      prohibitedOps: ["ensure_person"],
      prohibitedTargets: [],
      noSilent: true,
    },
  },
  {
    id: "fx-first-name",
    slot: "11 ambiguous first-name identity",
    family: "uncertain",
    source: "Pippa-class Helen first name",
    projectId: RIVERSIDE_ID,
    transcript: "Helen will own walk-through agenda.",
    raw: {
      observations: [
        {
          id: "obs-helen",
          statement: "Helen will own walk-through agenda",
          evidence: "Helen will own walk-through agenda.",
          domain: "responsibility",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: HELEN,
          candidateTargetTitle: "Helen Ward",
          proposedValues: {
            personName: "Helen Ward",
            scope: "walk-through agenda",
            ownershipSemantics: "share",
          },
        },
      ],
    },
    expect: {
      material: "First-name Helen is not identity",
      wantNeedsYou: true,
      prohibitedTargets: [HELEN],
      noSilent: true,
    },
  },
  {
    id: "fx-pronoun",
    slot: "12 pronoun/reference ambiguity",
    family: "uncertain",
    source: "eval pronoun-ambiguity",
    projectId: GAMING_ID,
    transcript: "She said she will own the boss balancing pass from now on.",
    raw: {
      observations: [
        {
          id: "obs-she",
          statement: "She will own the boss balancing pass",
          evidence: "She said she will own the boss balancing pass from now on.",
          domain: "responsibility",
          disposition: "ambiguous",
          truthIntent: "current",
          proposedValues: { scope: "boss balancing pass", ownershipSemantics: "ambiguous" },
          commentary: "The speaker did not name who she is.",
        },
      ],
    },
    expect: {
      material: "Unnamed she — do not bind Pixel",
      wantNeedsYou: true,
      prohibitedTargets: ["person-pixel"],
      noSilent: true,
    },
  },
  {
    id: "fx-contradictory",
    slot: "13 contradictory sibling changes",
    family: "safety",
    source: "left-untouched-safety check 12",
    projectId: CANDYLAND_ID,
    transcript:
      "Gumdrop Bridge icing is resolved. Gumdrop Bridge icing is still open.",
    raw: {
      observations: [
        {
          id: "obs-a",
          statement: "Gumdrop Bridge icing is resolved",
          evidence: "Gumdrop Bridge icing is resolved",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "risk-bridge",
          candidateTargetTitle: "Gumdrop Bridge icing",
          proposedValues: { status: "resolved" },
        },
        {
          id: "obs-b",
          statement: "Gumdrop Bridge icing is still open",
          evidence: "Gumdrop Bridge icing is still open",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "risk-bridge",
          candidateTargetTitle: "Gumdrop Bridge icing",
          proposedValues: { status: "open" },
        },
      ],
    },
    expect: {
      material: "Contradictory sibling statuses — no write",
      wantNeedsYou: true,
      prohibitedOps: ["update_risk_status"],
      noSilent: true,
    },
  },
  {
    id: "fx-foreign-id",
    slot: "14 foreign/invalid ID",
    family: "safety",
    source: "frozen foreign-ids-malformed-envelope",
    projectId: CANDYLAND_ID,
    transcript: "Please attach this update to the console certification risk.",
    raw: frozenEnvelopeFor("foreign-ids-malformed-envelope"),
    expect: {
      material: "Foreign GamingStudio IDs rejected",
      prohibitedTargets: ["risk-console"],
      prohibitedOps: ["update_risk_status", "create_risk"],
      noSilent: true,
    },
  },
  {
    id: "fx-title-only",
    slot: "15 unique-title but missing canonical ID",
    family: "identity",
    source: "3E title-only Parade day",
    projectId: CANDYLAND_ID,
    transcript: "Parade day moved to 22 October 2026.",
    raw: {
      observations: [
        {
          id: "obs-title-only",
          statement: "Parade day moved to 22 October 2026",
          evidence: "Parade day moved to 22 October 2026.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetTitle: "Parade day",
          proposedValues: { title: "Parade day", date: "2026-10-22" },
        },
      ],
    },
    expect: {
      material: "Title is not identity — Needs You, not silent write",
      wantNeedsYou: true,
      prohibitedOps: ["update_milestone"],
      noSilent: true,
    },
  },
  {
    id: "fx-missing-date",
    slot: "16 missing required date/value",
    family: "hydrate",
    source: "3D missing date",
    projectId: CANDYLAND_ID,
    transcript: "Parade day is still the fifteenth of October 2026.",
    raw: {
      observations: [
        {
          id: "obs-no-date",
          statement: "Parade day is still the fifteenth of October 2026",
          evidence: "Parade day is still the fifteenth of October 2026.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "ms-parade",
          candidateTargetTitle: "Parade day",
          proposedValues: { title: "Parade day" },
        },
      ],
    },
    expect: {
      material: "Missing ISO date — do not parse English",
      wantNeedsYou: true,
      prohibitedOps: ["update_milestone"],
      noSilent: true,
    },
  },
  {
    id: "fx-vague",
    slot: "17 vague concern",
    family: "uncertain",
    source: "left_untouched leftover",
    projectId: CANDYLAND_ID,
    transcript: "Security seem worried about it.",
    raw: {
      observations: [
        {
          id: "obs-sec",
          statement: "Security seem worried about it",
          evidence: "Security seem worried about it.",
          domain: "unknown",
          disposition: "left_untouched",
          truthIntent: "uncertain",
          commentary:
            "It isn't clear what Security is concerned about or what project information should change.",
        },
      ],
    },
    expect: {
      material: "Vague worry visible, not a risk write",
      wantLeftUntouched: true,
      prohibitedOps: ["create_risk", "create_todo"],
      noSilent: true,
    },
  },
  {
    id: "fx-unsupported",
    slot: "18 unsupported operation",
    family: "unsupported",
    source: "complete a date",
    projectId: CANDYLAND_ID,
    transcript: "Cancel the Parade day milestone — we are not holding the parade this year.",
    raw: {
      observations: [
        {
          id: "obs-cancel",
          statement: "Cancel the Parade day milestone",
          evidence:
            "Cancel the Parade day milestone — we are not holding the parade this year.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "ms-parade",
          candidateTargetTitle: "Parade day",
          proposedValues: { status: "complete" },
        },
      ],
    },
    expect: {
      material: "Completing a date is unsupported — not a To Do",
      wantNeedsYou: true,
      prohibitedOps: ["create_todo", "update_milestone"],
      noSilent: true,
    },
  },
  {
    id: "fx-mixed",
    slot: "19 mixed Capture",
    family: "mixed",
    source: "valid update + title-only sibling",
    projectId: CANDYLAND_ID,
    transcript:
      "Gumdrop Bridge icing is resolved. Parade day moved to 22 October 2026.",
    raw: {
      observations: [
        {
          id: "obs-risk",
          statement: "Gumdrop Bridge icing is resolved",
          evidence: "Gumdrop Bridge icing is resolved.",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "risk-bridge",
          candidateTargetTitle: "Gumdrop Bridge icing",
          proposedValues: { status: "resolved" },
        },
        {
          id: "obs-title-only",
          statement: "Parade day moved to 22 October 2026",
          evidence: "Parade day moved to 22 October 2026.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetTitle: "Parade day",
          proposedValues: { title: "Parade day", date: "2026-10-22" },
        },
      ],
    },
    expect: {
      material: "Bridge resolve writes; title-only Parade is not a silent bind",
      ordinary: true,
      wantWrite: true,
      correctOps: ["update_risk_status"],
      noSilent: true,
    },
  },
  {
    id: "fx-noisy",
    slot: "20 noisy multi-fact",
    family: "mixed",
    source: "eval mixed-domains frozen-style",
    projectId: CANDYLAND_ID,
    transcript:
      "Pippa Gumdrop remains UAT lead. Parade day moved to 22 October 2026. The chocolate fountain pump is overheating.",
    raw: {
      observations: [
        {
          id: "obs-pippa",
          statement: "Pippa Gumdrop remains UAT lead",
          evidence: "Pippa Gumdrop remains UAT lead.",
          domain: "person",
          disposition: "no_change",
          truthIntent: "current",
          candidateTargetId: "person-gumdrop",
          candidateTargetTitle: "Pippa Gumdrop",
        },
        {
          id: "obs-parade",
          statement: "Parade day moved to 22 October 2026",
          evidence: "Parade day moved to 22 October 2026.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "ms-parade",
          candidateTargetTitle: "Parade day",
          proposedValues: { date: "2026-10-22" },
        },
        {
          id: "obs-pump",
          statement: "Chocolate fountain pump is overheating",
          evidence: "The chocolate fountain pump is overheating.",
          domain: "risk",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { title: "Chocolate fountain pump overheating" },
        },
      ],
    },
    expect: {
      material: "No duplicate Pippa; Parade write; fountain risk write",
      ordinary: true,
      wantWrite: true,
      correctOps: ["update_milestone", "create_risk"],
      prohibitedOps: ["ensure_person", "create_todo"],
      noSilent: true,
    },
  },
  {
    id: "fx-harbourline-h1",
    slot: "21 historical long-haul (Harbourline h1)",
    family: "historical",
    source: "handover h1 Quinn Adler",
    projectId: CANDYLAND_ID,
    transcript:
      "New stakeholder: Quinn Adler, scanning QA lead, joining Helix on site.",
    raw: {
      observations: [
        {
          id: "h1-quinn",
          statement: "Quinn Adler is scanning QA lead joining Helix on site",
          evidence:
            "New stakeholder: Quinn Adler, scanning QA lead, joining Helix on site.",
          domain: "person",
          disposition: "create_new",
          truthIntent: "current",
          candidateTargetTitle: "Quinn Adler",
          proposedValues: { name: "Quinn Adler", role: "Scanning QA lead (Helix)" },
        },
      ],
    },
    expect: {
      material: "Create Quinn Adler from quoted evidence",
      ordinary: true,
      wantWrite: true,
      correctOps: ["ensure_person"],
      noSilent: true,
    },
  },
  {
    id: "fx-c5-timber",
    slot: "21 historical long-haul (C5 timber-floor)",
    family: "historical",
    source: "wrong-target C5",
    projectId: RIVERSIDE_ID,
    transcript:
      "The asbestos survey addendum came back clean. Close that chase. Raise a risk that the hall timber floor may still hide services.",
    raw: {
      observations: [
        {
          id: "c5-timber",
          statement: "Hall timber floor services risk",
          evidence: "Raise a risk that the hall timber floor may still hide services.",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetTitle: "Hall timber floor services risk",
          proposedValues: { title: "Hall timber floor services risk" },
        },
      ],
    },
    expect: {
      material: "Unmatched timber-floor risk is Needs You, not DDA write",
      wantNeedsYou: true,
      prohibitedTargets: [DDA],
      prohibitedOps: ["create_risk", "update_risk_status"],
      noSilent: true,
    },
  },
  {
    id: "fx-c18-wrong-target",
    slot: "21 historical long-haul (C18 wrong-target)",
    family: "historical",
    source: "wrong-target C18",
    projectId: RIVERSIDE_ID,
    transcript:
      "The hall timber floor services risk is resolved — they opened a trial panel and it is clear.",
    raw: {
      observations: [
        {
          id: "c18-wrong",
          statement: "The hall timber floor services risk is resolved",
          evidence:
            "The hall timber floor services risk is resolved — they opened a trial panel and it is clear.",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: DDA,
          candidateTargetTitle: "Outstanding DDA access ramp detail",
          proposedValues: {
            status: "resolved",
            title: "Hall timber floor services risk",
          },
        },
      ],
    },
    expect: {
      material: "DDA UUID + timber evidence must not resolve DDA",
      wantNeedsYou: true,
      prohibitedTargets: [DDA],
      noSilent: true,
    },
  },
  {
    id: "fx-empty-extraction",
    slot: "19 mixed / silent-loss",
    family: "coverage",
    source: "empty extraction leftover",
    projectId: CANDYLAND_ID,
    transcript:
      "Hall lighting scene plate is now the agreed fixture for the stage wash.",
    raw: { observations: [] },
    expect: {
      material: "Missed meaningful text stays visible",
      wantLeftUntouched: true,
      noSilent: true,
    },
  },
  {
    id: "fx-share-ambiguous",
    slot: "11/4 share vs replace",
    family: "uncertain",
    source: "frozen share-vs-replace-ambiguous",
    projectId: CANDYLAND_ID,
    transcript:
      "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it — the parade committee was unclear.",
    raw: frozenEnvelopeFor("share-vs-replace-ambiguous"),
    expect: {
      material: "Share vs replace stays Needs You",
      wantNeedsYou: true,
      prohibitedOps: ["confirm_responsibility"],
      noSilent: true,
    },
  },
];

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function complete(args: { system: string; user: string }) {
  const key = getOpenAIKey();
  const model = resolveOpenAIChatModel();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
  const detail = await response.text();
  if (!response.ok) {
    return { raw: null, text: "", error: `OpenAI ${response.status}: ${detail.slice(0, 400)}` };
  }
  const data = JSON.parse(detail) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { raw: parseJsonObject(text), text, error: text ? undefined : "empty response" };
}

function targetFromOp(op: { type: string } & Record<string, unknown>): string | undefined {
  const keys = [
    "riskId",
    "todoId",
    "milestoneId",
    "personId",
    "targetEntityId",
  ];
  for (const key of keys) {
    const value = op[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function summarise(def: CaseDef, raw: unknown) {
  const world = worldFor(def.projectId);
  const run = runCaptureV2FromModelJson({
    transcript: def.transcript,
    rawModelJson: raw ?? { observations: [] },
    world,
    projectId: def.projectId,
  });
  const writes = (run.resolved ?? []).filter((row) => row.decision.kind === "write");
  const needsYouRows = (run.resolved ?? []).filter((row) => row.decision.kind === "needs_you");
  const rejected = run.validation.rejected ?? [];
  const observations = (run.resolved ?? []).map((row) => {
    const op = row.decision.kind === "write" ? row.decision.operation : null;
    return {
      id: row.observation.id,
      domain: row.observation.domain,
      disposition: row.observation.disposition,
      decision: row.decision.kind,
      reason: "reason" in row.decision ? row.decision.reason : "",
      op: op?.type,
      target: op ? targetFromOp(op as { type: string } & Record<string, unknown>) : undefined,
      evidence: row.observation.evidence,
    };
  });
  const writeOps = observations.filter((row) => row.decision === "write");
  const prohibitedTargetHits = writeOps.filter(
    (row) => row.target && def.expect.prohibitedTargets?.includes(row.target),
  );
  const prohibitedOpHits = writeOps.filter(
    (row) => row.op && def.expect.prohibitedOps?.includes(row.op),
  );
  const correctWrites = writeOps.filter(
    (row) =>
      (!def.expect.correctOps || (row.op && def.expect.correctOps.includes(row.op))) &&
      (!def.expect.allowedTargets ||
        !row.target ||
        def.expect.allowedTargets.includes(row.target)) &&
      !prohibitedTargetHits.includes(row) &&
      !prohibitedOpHits.includes(row),
  );
  const incorrectWrites = writeOps.filter((row) => !correctWrites.includes(row));
  const needsYou = needsYouRows.length + rejected.length;
  const leftUntouched = observations.filter(
    (row) => row.disposition === "left_untouched",
  ).length;
  const noChange = observations.filter((row) => row.decision === "no_change").length;
  const silentEmpty =
    def.transcript.trim().split(/\s+/).length >= 3 &&
    (run.resolved ?? []).length === 0 &&
    rejected.length === 0 &&
    (run.result.observationAccount?.needsYou ?? 0) === 0 &&
    (run.result.observationAccount?.leftUntouched ?? 0) === 0;
  const evidenceGrounded = observations.every((row) => {
    if (!row.evidence) return row.disposition === "left_untouched" || row.decision === "no_change";
    return def.transcript.toLowerCase().includes(String(row.evidence).toLowerCase().replace(/[.,;:!?]+$/g, "").trim()) ||
      def.transcript.toLowerCase().includes(String(row.evidence).toLowerCase());
  });
  const boundedNeedsYou = needsYouRows.every((row) => {
    const reason = row.decision.kind === "needs_you" ? row.decision.reason : "";
    return /confirm|choose|identity|which|share or replace|could not be identified|valid existing/i.test(
      reason,
    );
  });
  const missed =
    Boolean(def.expect.wantWrite) &&
    correctWrites.length === 0 &&
    writes.length === 0;
  return {
    observations,
    rejected: rejected.map((row) => ({ id: row.id, statement: row.statement })),
    writes: writes.length,
    correctWrites: correctWrites.length,
    incorrectWrites: incorrectWrites.length,
    missedMaterial: missed,
    needsYou,
    noChange,
    leftUntouched,
    silentEmpty,
    wrongEntity: prohibitedTargetHits.length,
    duplicateCreate: 0,
    unsupportedWrites: prohibitedOpHits.length,
    evidenceGrounded,
    needsYouBounded: needsYou === 0 || boundedNeedsYou,
    writeOps: writeOps.map((row) => ({ op: row.op, target: row.target })),
  };
}

type Saved = CaseDef & { raw: unknown; live?: boolean };

function judge(def: CaseDef, summary: ReturnType<typeof summarise>) {
  const flags: string[] = [];
  if (def.expect.noSilent !== false && summary.silentEmpty) flags.push("SILENT");
  if (summary.incorrectWrites > 0) flags.push("FALSE_WRITE");
  if (summary.wrongEntity > 0) flags.push("WRONG_ENTITY");
  if (summary.unsupportedWrites > 0) flags.push("UNSUPPORTED_WRITE");
  if (def.expect.wantWrite && summary.correctWrites === 0) flags.push("MISSED_WRITE");
  if (def.expect.wantNeedsYou && summary.needsYou === 0 && summary.writes > 0)
    flags.push("SHOULD_NEED_YOU");
  if (def.expect.ordinary && def.expect.wantWrite && summary.correctWrites === 0)
    flags.push("ORDINARY_REGRESSION");
  return flags;
}

async function extractLive(def: CaseDef): Promise<unknown> {
  const world = worldFor(def.projectId);
  const project = world.projects.find((row) => row.id === def.projectId);
  if (!project) throw new Error(`Missing project ${def.projectId}`);
  const extracted = await complete({
    system: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
    user: buildObservationExtractionPrompt({
      transcript: def.transcript,
      projectBlock: formatAuthoritativeStateForPrompt(
        contextRecordsFromWorld(world, def.projectId),
        { id: project.id, name: project.name, code: project.code },
      ),
    }),
  });
  if (extracted.error) throw new Error(`${def.id}: ${extracted.error}`);
  return extracted.raw;
}

function writeArtifacts(name: string, value: unknown) {
  for (const dir of [join(process.cwd(), "test-results"), "/opt/cursor/artifacts"]) {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, name), JSON.stringify(value, null, 2));
    } catch {
      // Artifact dir may be unavailable.
    }
  }
}

function compact(summary: ReturnType<typeof summarise>) {
  return `w${summary.writes}/c${summary.correctWrites}/f${summary.incorrectWrites} ny${summary.needsYou} nc${summary.noChange} lu${summary.leftUntouched} sil${summary.silentEmpty ? 1 : 0}`;
}

async function runObserve(replayPath: string | null) {
  let saved: Saved[] = [];
  if (replayPath) {
    saved = JSON.parse(readFileSync(replayPath, "utf8")).envelopes as Saved[];
  } else {
    if (!isOpenAIConfigured()) {
      console.error("Live extract skipped: OPENAI_API_KEY is not configured.");
      process.exit(2);
    }
    for (const def of LIVE) {
      const raw = await extractLive(def);
      saved.push({ ...def, raw, live: true });
    }
    for (const def of FIXTURES) {
      saved.push({ ...def, raw: def.raw, live: false });
    }
  }

  const rows = saved.map((def) => {
    const result = summarise(def, def.raw);
    const flags = judge(def, result);
    console.log(
      `\n${def.id} [${def.slot}] (${def.live ? "live" : "fixture"}) ${compact(result)} ${flags.join(",") || "ok"}`,
    );
    if (result.writeOps.length) {
      console.log(`  writes: ${JSON.stringify(result.writeOps)}`);
    }
    if (flags.length) {
      console.log(`  flags: ${flags.join(", ")}`);
    }
    return { ...def, result, flags };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.writes += row.result.writes;
      acc.correctWrites += row.result.correctWrites;
      acc.falseWrites += row.result.incorrectWrites;
      acc.needsYou += row.result.needsYou;
      acc.noChange += row.result.noChange;
      acc.leftUntouched += row.result.leftUntouched;
      acc.silent += row.result.silentEmpty ? 1 : 0;
      acc.wrongEntity += row.result.wrongEntity;
      acc.missed += row.result.missedMaterial ? 1 : 0;
      acc.ordinaryRegressions += row.flags.includes("ORDINARY_REGRESSION") ? 1 : 0;
      return acc;
    },
    {
      writes: 0,
      correctWrites: 0,
      falseWrites: 0,
      needsYou: 0,
      noChange: 0,
      leftUntouched: 0,
      silent: 0,
      wrongEntity: 0,
      missed: 0,
      ordinaryRegressions: 0,
    },
  );

  const report = {
    label: replayPath ? "replay" : "head",
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    model: resolveOpenAIChatModel(),
    totals,
    journeys: rows.map((row) => ({
      id: row.id,
      slot: row.slot,
      family: row.family,
      source: row.source,
      live: row.live ?? false,
      material: row.expect.material,
      ordinary: Boolean(row.expect.ordinary),
      flags: row.flags,
      result: row.result,
    })),
  };

  writeArtifacts("capture-simplify-e2e-gate-observe.json", report);
  if (!replayPath) {
    writeArtifacts("capture-simplify-e2e-gate-envelopes.json", {
      envelopes: saved.map(({ id, slot, family, source, projectId, transcript, raw, live, expect }) => ({
        id,
        slot,
        family,
        source,
        projectId,
        transcript,
        raw,
        live,
        expect,
      })),
    });
  }

  console.log("\n=== E2E gate observe summary ===");
  console.log(JSON.stringify(totals, null, 2));
  return report;
}

function compareReports(mainPath: string, simpPath: string) {
  const main = JSON.parse(readFileSync(mainPath, "utf8")) as Awaited<ReturnType<typeof runObserve>>;
  const simp = JSON.parse(readFileSync(simpPath, "utf8")) as Awaited<ReturnType<typeof runObserve>>;
  const byId = new Map(main.journeys.map((row) => [row.id, row]));
  const lines = [
    "# Capture simplification e2e gate",
    "",
    `Main: ${mainPath}`,
    `Simplified: ${simpPath}`,
    "",
    `| Metric | Main | Simplified |`,
    `|---|---|---|`,
    `| Automatic writes | ${main.totals.writes} | ${simp.totals.writes} |`,
    `| Correct automatic writes | ${main.totals.correctWrites} | ${simp.totals.correctWrites} |`,
    `| False writes | ${main.totals.falseWrites} | ${simp.totals.falseWrites} |`,
    `| Needs You | ${main.totals.needsYou} | ${simp.totals.needsYou} |`,
    `| Left untouched | ${main.totals.leftUntouched} | ${simp.totals.leftUntouched} |`,
    `| No change | ${main.totals.noChange} | ${simp.totals.noChange} |`,
    `| Silent omissions | ${main.totals.silent} | ${simp.totals.silent} |`,
    `| Wrong-entity writes | ${main.totals.wrongEntity} | ${simp.totals.wrongEntity} |`,
    `| Missed material | ${main.totals.missed} | ${simp.totals.missed} |`,
    `| Ordinary regressions (vs expect) | ${main.totals.ordinaryRegressions} | ${simp.totals.ordinaryRegressions} |`,
    "",
    "| Case | Slot | Live | Main | Simplified | Flags main | Flags simp |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const row of simp.journeys) {
    const other = byId.get(row.id);
    const changed =
      other &&
      (other.result.writes !== row.result.writes ||
        other.result.needsYou !== row.result.needsYou ||
        other.result.incorrectWrites !== row.result.incorrectWrites ||
        other.result.silentEmpty !== row.result.silentEmpty);
    lines.push(
      `| ${row.id} | ${row.slot} | ${row.live ? "yes" : "fixture"} | ${other ? compact(other.result) : "—"} | ${compact(row.result)} | ${(other?.flags ?? []).join(",") || "ok"} | ${row.flags.join(",") || "ok"}${changed ? " **changed**" : ""} |`,
    );
  }
  const md = lines.join("\n");
  console.log(md);
  writeArtifacts("capture-simplify-e2e-gate-comparison.md", { markdown: md, main: main.totals, simplified: simp.totals });
  try {
    writeFileSync("/opt/cursor/artifacts/capture-simplify-e2e-gate-comparison.md", md);
  } catch {
    // ignore
  }
}

async function main() {
  loadDotEnvLocal();
  const compareIdx = process.argv.indexOf("--compare");
  if (compareIdx >= 0) {
    compareReports(process.argv[compareIdx + 1]!, process.argv[compareIdx + 2]!);
    return;
  }
  const replayIdx = process.argv.indexOf("--replay");
  const replayPath = replayIdx >= 0 ? process.argv[replayIdx + 1] : null;
  await runObserve(replayPath ?? null);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
