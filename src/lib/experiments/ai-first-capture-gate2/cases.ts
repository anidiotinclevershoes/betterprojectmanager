/**
 * Frozen Gate 2 evaluation corpus.
 *
 * Gate 1 v2's 12 cases are retained bit-for-bit via gate1V2Cases().
 * Additional cases are taken from the existing live Capture V2 corpus
 * plus realistic fixtures. Expectations were written from corpus
 * material / product-model gaps BEFORE any Gate 2 live run.
 *
 * Do not retune this list in response to model output.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { CAPTURE_V2_EVAL_CORPUS } from "@/lib/eval-capture-v2/corpus";
import {
  gate1V2Cases,
  type CaseFamily,
  type Gate1V2Case,
} from "@/lib/experiments/ai-first-capture-gate1-v2/cases";
import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
  experimentalApplyWorld,
} from "@/lib/experiments/worlds";
import type { ExpectedFact } from "@/lib/experiments/ai-first-capture-gate1-v2/types";

export type Gate2Case = Gate1V2Case;
export type { CaseFamily };

function corpus(id: string) {
  const found = CAPTURE_V2_EVAL_CORPUS.find((row) => row.id === id);
  if (!found) throw new Error(`Missing corpus ${id}`);
  return found;
}

function cloneWorld(world: CaptureApplyWorld): CaptureApplyWorld {
  return structuredClone(world);
}

/** Toyworld plus two near-name people. Used only by similar-name cases. */
export function similarNameWorld(): CaptureApplyWorld {
  const world = cloneWorld(experimentalApplyWorld());
  const toy = world.projects.find((p) => p.id === TOYWORLD_ID);
  if (!toy) throw new Error("Toyworld missing");
  toy.stakeholders = [
    ...toy.stakeholders,
    { id: "person-brick-willow", name: "Brick Willow", role: "Warehouse" },
    { id: "person-brook-oakley", name: "Brook Oakley", role: "Painter" },
  ];
  return world;
}

function fromCorpus(
  id: string,
  family: CaseFamily,
  expectedFacts: ExpectedFact[],
  notes?: string,
): Gate2Case {
  const row = corpus(id);
  return {
    id,
    title: row.title,
    family,
    source: `corpus ${row.id}`,
    expectedSource: "corpus",
    captureText: row.transcript,
    projectId: row.projectId,
    world: experimentalApplyWorld(),
    notes: notes ?? row.material.map((m) => m.meaning).join(" "),
    expectedFacts,
  };
}

const GATE1_IDS = [
  "create-velvet",
  "update-packaging",
  "nochange-pippa",
  "pronoun-she",
  "date-parade",
  "correction-audio",
  "contradict-parade",
  "ambiguous-share",
  "unsupported-remove",
  "mixed-three",
  "chatter",
  "holdout-h6",
] as const;

function expandedCases(): Gate2Case[] {
  const world = experimentalApplyWorld();
  const names = similarNameWorld();

  return [
    fromCorpus("ambiguous-same-first-name", "identity", [
      {
        id: "which-brick",
        meaning: "Warehouse Brick is not silently Brick Oakley.",
        tokens: ["brick", "warehouse"],
        expectedOperation: ["needs_you", "left_untouched"],
        forbiddenTargetIds: ["person-brick"],
      },
    ]),
    fromCorpus("responsibility-continues", "already_current", [
      {
        id: "pixel-continues",
        meaning: "Pixel remains Producer — continuity, not replacement.",
        tokens: ["pixel", "ramos", "producer"],
        expectedOperation: ["no_change", "update"],
        expectedDomain: ["person", "responsibility"],
        acceptedTargetIds: ["person-pixel"],
        forbiddenTargetIds: ["person-gumdrop"],
      },
    ]),
    fromCorpus("responsibility-replacement", "update", [
      {
        id: "producer-replace",
        meaning: "Producer moves from Pixel to Nova (replace).",
        tokens: ["replace", "producer"],
        expectedOperation: ["update", "create", "needs_you"],
        expectedDomain: ["responsibility", "person"],
        forbiddenTargetIds: ["person-brick"],
      },
      {
        id: "nova-mentioned",
        meaning: "Nova Quill is introduced.",
        tokens: ["nova", "quill"],
        expectedOperation: ["create", "update", "needs_you"],
        expectedDomain: ["person", "responsibility"],
        expectedTargetId: null,
      },
    ]),
    fromCorpus("new-risk", "create", [
      {
        id: "shader-compile",
        meaning: "New shader-compile risk — not the console cert issue.",
        tokens: ["shader", "compile"],
        expectedOperation: "create",
        expectedDomain: "risk",
        expectedTargetId: null,
        forbiddenTargetIds: ["risk-console"],
      },
    ]),
    fromCorpus("risk-resolution", "update", [
      {
        id: "bridge-closed",
        meaning: "Gumdrop Bridge icing is resolved.",
        tokens: ["gumdrop", "bridge"],
        expectedOperation: "update",
        expectedDomain: "risk",
        expectedTargetId: "risk-bridge",
      },
    ]),
    fromCorpus("unchanged-date", "already_current", [
      {
        id: "freeze-same",
        meaning: "Track freeze remains 1 September 2026.",
        tokens: ["track", "freeze"],
        expectedOperation: ["no_change", "update"],
        expectedDomain: "milestone",
        expectedTargetId: "ms-freeze",
      },
    ]),
    fromCorpus("todo-create", "create", [
      {
        id: "banners-todo",
        meaning: "New to-do for candy-cane banners.",
        tokens: ["banners"],
        expectedOperation: "create",
        expectedDomain: "todo",
        expectedTargetId: null,
        forbiddenTargetIds: ["todo-pack"],
      },
    ]),
    fromCorpus("availability", "update", [
      {
        id: "fizz-away",
        meaning: "Fizz Caramel away 5–12 October 2026.",
        tokens: ["fizz", "away"],
        expectedOperation: ["create", "update"],
        expectedDomain: "availability",
        acceptedTargetIds: ["person-fizz"],
        forbiddenTargetIds: ["todo-pack"],
      },
    ]),
    fromCorpus("duplicate-observation", "update", [
      {
        id: "packaging-once",
        meaning: "Packaging delay resolved once, not two writes.",
        tokens: ["packaging", "delay"],
        expectedOperation: "update",
        expectedDomain: "risk",
        expectedTargetId: "risk-packaging",
      },
    ]),
    fromCorpus("explicit-no-change", "already_current", [
      {
        id: "nothing-changed",
        meaning: "Explicit leave-records-as-they-are.",
        tokens: ["nothing"],
        expectedOperation: ["no_change", "left_untouched"],
      },
    ]),
    fromCorpus("cross-project-bait", "unsupported", [
      {
        id: "foreign-people-risk",
        meaning: "GamingStudio5000 people/risks inside Candyland Capture.",
        tokens: ["pixel", "console"],
        expectedOperation: ["needs_you", "left_untouched"],
        forbiddenTargetIds: ["risk-console", "ms-cert"],
      },
    ]),
    fromCorpus("toyworld-vocabulary-bait", "unsupported", [
      {
        id: "packaging-bait",
        meaning: "Toyworld person/risk offered as Candyland writes.",
        tokens: ["brick", "packaging"],
        expectedOperation: ["needs_you", "left_untouched"],
        forbiddenTargetIds: ["risk-packaging", "person-brick"],
      },
    ]),

    {
      id: "todo-remove-supported",
      title: "Genuine supported To Do remove",
      family: "update",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Please delete the To Do titled Prepare the jelly pack.",
      projectId: CANDYLAND_ID,
      world,
      notes: "To Do delete/remove is a legal write.",
      expectedFacts: [
        {
          id: "delete-jelly",
          meaning: "Remove Prepare the jelly pack.",
          tokens: ["jelly", "pack"],
          expectedOperation: "remove",
          expectedDomain: "todo",
          expectedTargetId: "todo-pack",
        },
      ],
    },
    {
      id: "unsupported-remove-person",
      title: "Unsupported person removal",
      family: "unsupported",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Please delete Pippa Gumdrop from the project.",
      projectId: CANDYLAND_ID,
      world,
      notes: "Person remove is not a legal write. Left untouched, not rewritten.",
      expectedFacts: [
        {
          id: "delete-pippa",
          meaning: "Person delete is unsupported.",
          tokens: ["delete", "pippa"],
          expectedOperation: ["left_untouched", "needs_you"],
          expectedDomain: ["person", "unsupported"],
        },
      ],
    },
    {
      id: "unsupported-remove-risk",
      title: "Unsupported issue/risk removal",
      family: "unsupported",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Please delete the Packaging delay risk.",
      projectId: TOYWORLD_ID,
      world,
      notes: "Risk delete/remove is not in the Apply matrix.",
      expectedFacts: [
        {
          id: "delete-packaging-risk",
          meaning: "Risk delete is unsupported.",
          tokens: ["delete", "packaging"],
          expectedOperation: ["left_untouched", "needs_you"],
          expectedDomain: ["risk", "unsupported"],
        },
      ],
    },
    {
      id: "knowledge-water-based",
      title: "Knowledge remember",
      family: "create",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText:
        "Remember: the wooden-track paint must stay water-based.",
      projectId: TOYWORLD_ID,
      world,
      notes: "Explicit remember → knowledge create.",
      expectedFacts: [
        {
          id: "water-based",
          meaning: "Remember water-based paint as knowledge.",
          tokens: ["water-based"],
          expectedOperation: "create",
          expectedDomain: ["knowledge", "decision"],
          expectedTargetId: null,
        },
      ],
    },
    {
      id: "vague-parade",
      title: "Vague concern",
      family: "chatter",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "I'm a bit worried about the parade.",
      projectId: CANDYLAND_ID,
      world,
      notes: "Vague worry is Left untouched, not a new risk.",
      expectedFacts: [
        {
          id: "worried-parade",
          meaning: "Vague parade worry is not a write.",
          tokens: ["worried"],
          expectedOperation: ["left_untouched", "no_change", "needs_you"],
          forbiddenTargetIds: ["ms-parade", "risk-bridge"],
        },
      ],
    },
    {
      id: "relative-date-parade",
      title: "Relative / ambiguous date",
      family: "date",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Parade day is next Friday.",
      projectId: CANDYLAND_ID,
      world,
      notes: "Relative date is unsafe to pin. Do not infer an ISO day.",
      expectedFacts: [
        {
          id: "next-friday",
          meaning: "Next Friday is not a safe explicit date write.",
          tokens: ["friday"],
          expectedOperation: ["needs_you", "left_untouched"],
          expectedDomain: ["milestone", "unsupported"],
        },
      ],
    },
    {
      id: "historic-parade",
      title: "Historic / non-current statement",
      family: "already_current",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText:
        "Last June we moved Parade day to the 15th, which is why it is still 15 October.",
      projectId: CANDYLAND_ID,
      world,
      notes: "Historic explanation of current date — no mutation.",
      expectedFacts: [
        {
          id: "historic-why",
          meaning: "Historic account of Parade day — no date write.",
          tokens: ["june"],
          expectedOperation: ["no_change", "left_untouched"],
          expectedDomain: ["milestone", "unsupported"],
          acceptedTargetIds: ["ms-parade"],
        },
      ],
    },
    {
      id: "similar-name-exact",
      title: "Exact identity restatement",
      family: "identity",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Brick Oakley remains the Toyworld sponsor.",
      projectId: TOYWORLD_ID,
      world: names,
      notes: "Exact existing name. Must not bind Brick Willow or Brook Oakley.",
      expectedFacts: [
        {
          id: "brick-oakley-same",
          meaning: "Brick Oakley already exists.",
          tokens: ["brick", "oakley"],
          expectedOperation: ["no_change", "update"],
          expectedDomain: ["person", "responsibility"],
          acceptedTargetIds: ["person-brick"],
          forbiddenTargetIds: ["person-brick-willow", "person-brook-oakley"],
        },
      ],
    },
    {
      id: "similar-name-other-brick",
      title: "Similar-name distinct person",
      family: "identity",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Brick Willow will help with warehouse packing this week.",
      projectId: TOYWORLD_ID,
      world: names,
      notes: "Named Brick Willow — not Brick Oakley.",
      expectedFacts: [
        {
          id: "brick-willow",
          meaning: "Brick Willow is the named person.",
          tokens: ["brick", "willow"],
          expectedOperation: ["update", "create", "no_change"],
          expectedDomain: ["person", "responsibility"],
          forbiddenTargetIds: ["person-brick"],
        },
      ],
    },
    {
      id: "similar-name-ambiguous-brick",
      title: "Similar-name ambiguous first name",
      family: "identity",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Brick called about the track map.",
      projectId: TOYWORLD_ID,
      world: names,
      notes: "Bare 'Brick' with two Bricks on the project.",
      expectedFacts: [
        {
          id: "which-brick-track",
          meaning: "Bare Brick is ambiguous between Oakley and Willow.",
          tokens: ["brick", "track"],
          expectedOperation: ["needs_you", "left_untouched"],
          forbiddenTargetIds: ["person-brick", "person-brick-willow"],
        },
      ],
    },
    {
      id: "similar-name-spelling",
      title: "Similar-name spelling variant",
      family: "identity",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Brikk Oakley is still the sponsor.",
      projectId: TOYWORLD_ID,
      world: names,
      notes: "Spelling variant of Brick Oakley. Do not create Brikk; do not take Brook.",
      expectedFacts: [
        {
          id: "brikk",
          meaning: "Brikk Oakley should not become a new person or Brook.",
          tokens: ["brikk"],
          expectedOperation: ["no_change", "update", "needs_you", "left_untouched"],
          forbiddenTargetIds: ["person-brook-oakley", "person-brick-willow"],
        },
      ],
    },
    {
      id: "email-unsupported",
      title: "Unsupported outbound request",
      family: "unsupported",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Please email the whole parade committee about the new date.",
      projectId: CANDYLAND_ID,
      world,
      notes: "Lume cannot send email. Left untouched.",
      expectedFacts: [
        {
          id: "email-committee",
          meaning: "Email request is unsupported capability.",
          tokens: ["email"],
          expectedOperation: ["left_untouched", "needs_you"],
        },
      ],
    },
    {
      id: "todo-complete-jelly",
      title: "Supported To Do completion phrased as done",
      family: "update",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Mark Prepare the jelly pack as done.",
      projectId: CANDYLAND_ID,
      world,
      notes: "To Do complete/update is legal. Residual if model uses remove.",
      expectedFacts: [
        {
          id: "jelly-done",
          meaning: "Prepare the jelly pack is done.",
          tokens: ["jelly", "pack"],
          expectedOperation: "update",
          expectedDomain: "todo",
          expectedTargetId: "todo-pack",
        },
      ],
    },
    {
      id: "person-rename-unsupported",
      title: "Unsupported person rename",
      family: "unsupported",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Pippa Gumdrop is now called Pippa Sugarplum.",
      projectId: CANDYLAND_ID,
      world,
      notes: "Person update/rename is not a legal write. Left untouched, not a new person.",
      expectedFacts: [
        {
          id: "rename-pippa",
          meaning: "Rename is unsupported. Do not create Sugarplum.",
          tokens: ["sugarplum"],
          expectedOperation: ["left_untouched", "needs_you"],
          forbiddenTargetIds: ["person-fizz"],
        },
      ],
    },
    {
      id: "contradict-packaging",
      title: "Contradictory sibling facts on one issue",
      family: "contradiction",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText:
        "Packaging delay is getting worse. Packaging delay is resolved.",
      projectId: TOYWORLD_ID,
      world,
      notes: "Worse vs resolved — do not pick a side.",
      expectedFacts: [
        {
          id: "packaging-conflict",
          meaning: "Packaging delay statements contradict.",
          tokens: ["packaging"],
          expectedOperation: ["needs_you", "left_untouched"],
          expectedTargetId: "risk-packaging",
        },
      ],
    },
    {
      id: "todo-dated-canes",
      title: "To Do with explicit date",
      family: "create",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Please add a to-do to collect the candy canes on 18 October 2026.",
      projectId: CANDYLAND_ID,
      world,
      notes: "Explicit dated To Do create.",
      expectedFacts: [
        {
          id: "candy-canes",
          meaning: "Create dated to-do for candy canes.",
          tokens: ["candy", "canes"],
          expectedOperation: "create",
          expectedDomain: "todo",
          expectedTargetId: null,
          forbiddenTargetIds: ["todo-pack", "ms-parade"],
        },
      ],
    },
    {
      id: "issue-cert-worse",
      title: "Existing issue/risk worsening (GamingStudio)",
      family: "update",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText:
        "The Console certification slip issue is worse after last night's build failed.",
      projectId: GAMING_ID,
      world,
      notes: "Issues are the risk records in this world.",
      expectedFacts: [
        {
          id: "cert-worse",
          meaning: "Console certification slip is worse, still open.",
          tokens: ["certification", "slip"],
          expectedOperation: "update",
          expectedDomain: "risk",
          expectedTargetId: "risk-console",
        },
      ],
    },
    {
      id: "chatter-weather",
      title: "Irrelevant weather chatter",
      family: "chatter",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText:
        "I think the weather will be nice on Friday, nothing project related.",
      projectId: CANDYLAND_ID,
      world,
      notes: "Baseline commentary paste.",
      expectedFacts: [
        {
          id: "weather",
          meaning: "Weather chatter is not a write.",
          tokens: ["weather"],
          expectedOperation: ["left_untouched", "no_change"],
          forbiddenTargetIds: ["ms-parade", "risk-bridge", "todo-pack"],
        },
      ],
    },
    {
      id: "availability-relative",
      title: "Relative availability window",
      family: "date",
      source: "manual-for-experiment",
      expectedSource: "manual-for-experiment",
      captureText: "Fizz is off next week.",
      projectId: CANDYLAND_ID,
      world,
      notes: "Relative leave window — unsafe to pin ISO bounds.",
      expectedFacts: [
        {
          id: "fizz-next-week",
          meaning: "Next week leave is not a safe dated write.",
          tokens: ["fizz", "week"],
          expectedOperation: ["needs_you", "left_untouched"],
          expectedDomain: ["availability", "person", "unsupported"],
          forbiddenTargetIds: ["todo-pack"],
        },
      ],
    },
  ];
}

export const FROZEN_GATE1_CASE_IDS: readonly string[] = GATE1_IDS;

export function gate2Cases(): Gate2Case[] {
  const gate1 = gate1V2Cases();
  if (gate1.length !== GATE1_IDS.length) {
    throw new Error(`Gate 1 case count drifted: ${gate1.length}`);
  }
  for (let i = 0; i < GATE1_IDS.length; i += 1) {
    if (gate1[i].id !== GATE1_IDS[i]) {
      throw new Error(`Gate 1 case order drifted at ${i}: ${gate1[i].id}`);
    }
  }
  return [...gate1, ...expandedCases()];
}

export function frozenCorpusStats(cases: Gate2Case[] = gate2Cases()) {
  return {
    cases: cases.length,
    gate1Cases: GATE1_IDS.length,
    expandedCases: cases.length - GATE1_IDS.length,
    atomicFacts: cases.reduce((n, row) => n + row.expectedFacts.length, 0),
    ids: cases.map((row) => row.id),
  };
}
