/**
 * Frozen Capture V2 evaluation corpus.
 * Fictional worlds only. Fresh wording — no Niamh / CAB / ATLAS phrases.
 *
 * Meaning-based expectations. Do not treat this as training data.
 *
 * Hulk amendment: composition was redistributed across Candyland,
 * Toyworld, and GamingStudio5000 BEFORE any live provider result was seen.
 * After the first live run, do not alter this semantic corpus in response
 * to model output.
 */

import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
} from "@/lib/experiments/worlds";
import type { BenchmarkCase, EvalWorldId } from "./types";

export const CORPUS_WORLD_PROJECT_ID: Record<EvalWorldId, string> = {
  candyland: CANDYLAND_ID,
  toyworld: TOYWORLD_ID,
  gamingstudio5000: GAMING_ID,
};

export const CAPTURE_V2_EVAL_CORPUS: BenchmarkCase[] = [
  {
    id: "existing-person",
    title: "Existing Person mentioned again",
    category: "person-existing",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Pippa Gumdrop is still the UAT lead for the licorice stands.",
    material: [
      {
        id: "pippa-exists",
        meaning: "Pippa Gumdrop is already on Candyland; do not create a second person.",
        meaningTokens: ["pippa", "gumdrop"],
        allowedDomains: ["person", "responsibility"],
        existingTargetId: "person-gumdrop",
        existingVsNew: "existing",
        expectedDisposition: ["no_change", "update_existing"],
        expectedNoChange: true,
      },
    ],
    allowedDomains: ["person", "responsibility"],
    expectedNoChange: true,
    prohibitedInterpretations: [
      "Treat Pippa Gumdrop as a new stakeholder",
      "Invent a second Pippa",
    ],
    prohibitedWrites: [
      { reason: "Must not CREATE a duplicate Pippa", createTitleIncludes: "Pippa Gumdrop" },
    ],
  },
  {
    id: "new-person",
    title: "Genuinely new Person",
    category: "person-new",
    world: "toyworld",
    projectId: TOYWORLD_ID,
    evaluationMode: "live",
    transcript:
      "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    material: [
      {
        id: "velvet-new",
        meaning: "Velvet Sprocket is a new person on Toyworld.",
        meaningTokens: ["velvet", "sprocket"],
        allowedDomains: ["person"],
        existingVsNew: "new",
        expectedDisposition: "create_new",
      },
    ],
    allowedDomains: ["person"],
    prohibitedInterpretations: [
      "Treat Velvet Sprocket as Brick Oakley or Captain Buttons",
    ],
    prohibitedWrites: [
      { reason: "Must not retarget Brick Oakley", targetId: "person-brick" },
      { reason: "Must not retarget Captain Buttons", targetId: "person-buttons" },
    ],
  },
  {
    id: "ambiguous-same-first-name",
    title: "Same first name / ambiguous Person",
    category: "person-ambiguous",
    world: "toyworld",
    projectId: TOYWORLD_ID,
    evaluationMode: "live",
    transcript:
      "Brick from the warehouse called; he wants to help with assembly.",
    material: [
      {
        id: "which-brick",
        meaning: "A Brick was mentioned who may not be Brick Oakley — preserve ambiguity.",
        meaningTokens: ["brick", "warehouse"],
        allowedDomains: ["person", "responsibility", "unknown"],
        existingVsNew: "ambiguous",
        expectedDisposition: ["ambiguous", "commentary"],
        expectedNeedsYou: true,
      },
    ],
    allowedDomains: ["person", "responsibility", "unknown", "commentary"],
    expectedNeedsYou: true,
    prohibitedInterpretations: [
      "Assert this is definitely Brick Oakley",
      "Create a second Brick Oakley without flagging ambiguity",
    ],
    prohibitedWrites: [
      { reason: "Must not silently CREATE another Brick", createTitleIncludes: "Brick" },
      { reason: "Must not overwrite Oakley identity", targetId: "person-brick" },
    ],
  },
  {
    id: "responsibility-continues",
    title: "Responsibility continues",
    category: "responsibility-continue",
    world: "gamingstudio5000",
    projectId: GAMING_ID,
    evaluationMode: "live",
    transcript:
      "Pixel Ramos continues as Producer on the console sprint. No change there.",
    material: [
      {
        id: "pixel-continues",
        meaning: "Pixel Ramos still holds Producer; this is continuity, not replacement.",
        meaningTokens: ["pixel", "ramos", "producer"],
        allowedDomains: ["responsibility", "person"],
        existingTargetId: "person-pixel",
        existingVsNew: "existing",
        expectedDisposition: ["no_change", "update_existing"],
        expectedNoChange: true,
      },
    ],
    allowedDomains: ["responsibility", "person"],
    expectedNoChange: true,
    prohibitedInterpretations: [
      "Replace Pixel Ramos",
      "Treat Producer as vacant",
    ],
    prohibitedWrites: [
      { reason: "Must not retarget Candyland people", targetId: "person-gumdrop" },
    ],
  },
  {
    id: "responsibility-replacement",
    title: "Responsibility replacement",
    category: "responsibility-replace",
    world: "gamingstudio5000",
    projectId: GAMING_ID,
    evaluationMode: "live",
    transcript:
      "Nova Quill will replace Pixel Ramos as Producer from next week.",
    material: [
      {
        id: "producer-replace",
        meaning: "Producer moves from Pixel Ramos to Nova Quill (replace, not share).",
        meaningTokens: ["replace", "producer"],
        allowedDomains: ["responsibility", "person"],
        existingVsNew: "ambiguous",
        expectedDisposition: ["update_existing", "create_new", "ambiguous"],
      },
      {
        id: "nova-mentioned",
        meaning: "Nova Quill is introduced in this ownership change.",
        meaningTokens: ["nova", "quill"],
        allowedDomains: ["person", "responsibility"],
        existingVsNew: "new",
      },
    ],
    allowedDomains: ["responsibility", "person"],
    prohibitedInterpretations: [
      "Treat this as share rather than replace",
      "Leave Pixel as sole Producer with no change noted",
    ],
    prohibitedWrites: [
      { reason: "Must not retarget Toyworld people", targetId: "person-brick" },
    ],
    notes: "Replace is stated; Lume may still Needs-you on Confirm Owner. That is a catch, not a model miss, if the model marked replace.",
  },
  {
    id: "share-vs-replace-ambiguous",
    title: "Share vs replace ambiguity",
    category: "responsibility-ambiguous",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it — the parade committee was unclear.",
    material: [
      {
        id: "share-or-replace",
        meaning: "UAT ownership between Fizz and Pippa is genuinely ambiguous.",
        meaningTokens: ["uat", "share"],
        allowedDomains: ["responsibility", "person", "unknown"],
        existingVsNew: "ambiguous",
        expectedDisposition: "ambiguous",
        expectedNeedsYou: true,
      },
    ],
    allowedDomains: ["responsibility", "person", "unknown"],
    expectedNeedsYou: true,
    prohibitedInterpretations: [
      "Assert share as decided",
      "Assert replace as decided",
    ],
    prohibitedWrites: [
      { reason: "Must not write a decided ownership change", domain: "responsibility" },
    ],
  },
  {
    id: "existing-risk-update",
    title: "Existing Risk update",
    category: "risk-update",
    world: "toyworld",
    projectId: TOYWORLD_ID,
    evaluationMode: "live",
    transcript:
      "Packaging delay is getting worse after the cardboard mill flooded.",
    material: [
      {
        id: "packaging-worse",
        meaning: "Existing Packaging delay risk is worsening, still open.",
        meaningTokens: ["packaging", "delay"],
        allowedDomains: ["risk"],
        existingTargetId: "risk-packaging",
        existingVsNew: "existing",
        expectedDisposition: "update_existing",
      },
    ],
    allowedDomains: ["risk"],
    prohibitedInterpretations: [
      "Create a second packaging risk",
      "Mark the risk resolved",
      "Turn this into a To Do",
    ],
    prohibitedWrites: [
      { reason: "Must not CREATE a duplicate packaging risk", createTitleIncludes: "Packaging delay" },
      { reason: "Must not create a To Do for an existing risk", operationType: "create_todo" },
      { reason: "Must not retarget Candyland bridge risk", targetId: "risk-bridge" },
    ],
  },
  {
    id: "new-risk",
    title: "New Risk",
    category: "risk-new",
    world: "gamingstudio5000",
    projectId: GAMING_ID,
    evaluationMode: "live",
    transcript:
      "The shader compile is stalling the cert build and could miss the nightlies.",
    material: [
      {
        id: "shader-compile",
        meaning: "A new risk about the shader compile stalling the cert build.",
        meaningTokens: ["shader", "compile"],
        allowedDomains: ["risk"],
        existingVsNew: "new",
        expectedDisposition: "create_new",
      },
    ],
    allowedDomains: ["risk"],
    prohibitedInterpretations: [
      "Update Console certification slip instead",
    ],
    prohibitedWrites: [
      { reason: "Must not retarget the console cert risk", targetId: "risk-console" },
    ],
  },
  {
    id: "risk-resolution",
    title: "Risk resolution",
    category: "risk-resolve",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "The icing on Gumdrop Bridge has melted; that risk is closed.",
    material: [
      {
        id: "bridge-closed",
        meaning: "Gumdrop Bridge icing is resolved.",
        meaningTokens: ["gumdrop", "bridge", "closed"],
        allowedDomains: ["risk"],
        existingTargetId: "risk-bridge",
        existingVsNew: "existing",
        expectedDisposition: "update_existing",
      },
    ],
    allowedDomains: ["risk"],
    prohibitedInterpretations: [
      "Create a To Do to close the risk",
      "Create a new resolved-risk record",
    ],
    prohibitedWrites: [
      { reason: "Must not CREATE a todo for risk resolution", operationType: "create_todo" },
    ],
  },
  {
    id: "milestone-move",
    title: "Existing milestone / date move",
    category: "milestone-move",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript: "Parade day is now 29 October 2026.",
    material: [
      {
        id: "parade-moved",
        meaning: "Parade day moves to 29 October 2026.",
        meaningTokens: ["parade", "29", "october"],
        allowedDomains: ["milestone"],
        existingTargetId: "ms-parade",
        existingVsNew: "existing",
        expectedDisposition: "update_existing",
      },
    ],
    allowedDomains: ["milestone"],
    prohibitedInterpretations: [
      "Create a To Do instead of moving the date",
      "Create a second Parade day milestone",
    ],
    prohibitedWrites: [
      { reason: "Must not CREATE a todo for a date move", operationType: "create_todo" },
    ],
  },
  {
    id: "unchanged-date",
    title: "Unchanged date confirmation",
    category: "milestone-unchanged",
    world: "toyworld",
    projectId: TOYWORLD_ID,
    evaluationMode: "live",
    transcript: "Just confirming: Track freeze remains 1 September 2026.",
    material: [
      {
        id: "freeze-same",
        meaning: "Track freeze is unchanged at 1 September 2026.",
        meaningTokens: ["track", "freeze", "september"],
        allowedDomains: ["milestone"],
        existingTargetId: "ms-freeze",
        existingVsNew: "existing",
        expectedDisposition: "no_change",
        expectedNoChange: true,
      },
    ],
    allowedDomains: ["milestone", "commentary"],
    expectedNoChange: true,
    prohibitedInterpretations: [
      "Move Track freeze to a new date",
    ],
    prohibitedWrites: [
      { reason: "Must not UPDATE the milestone date", targetId: "ms-freeze" },
      { reason: "Must not CREATE a todo", operationType: "create_todo" },
    ],
  },
  {
    id: "todo-create",
    title: "Genuine To Do",
    category: "todo",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Please add a to-do to polish the candy-cane banners before the float leaves.",
    material: [
      {
        id: "banners-todo",
        meaning: "Create a to-do about polishing candy-cane banners.",
        meaningTokens: ["candy-cane", "banners"],
        allowedDomains: ["todo"],
        existingVsNew: "new",
        expectedDisposition: "create_new",
      },
    ],
    allowedDomains: ["todo"],
    prohibitedInterpretations: [
      "Treat this as an update to Prepare the jelly pack",
    ],
    prohibitedWrites: [
      { reason: "Must not retarget the jelly-pack todo", targetId: "todo-pack" },
    ],
  },
  {
    id: "availability",
    title: "Availability on existing Person",
    category: "availability",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Fizz Caramel is away from 5 October 2026 until 12 October 2026.",
    material: [
      {
        id: "fizz-away",
        meaning: "Fizz Caramel availability 5–12 October 2026.",
        meaningTokens: ["fizz", "away", "october"],
        allowedDomains: ["availability"],
        existingTargetId: "person-fizz",
        existingVsNew: "existing",
        expectedDisposition: ["update_existing", "create_new"],
      },
    ],
    allowedDomains: ["availability", "person"],
    prohibitedInterpretations: [
      "Create a new person named Fizz",
      "Turn leave into a To Do",
    ],
    prohibitedWrites: [
      { reason: "Must not CREATE a todo for leave", operationType: "create_todo" },
      { reason: "Must not CREATE a duplicate Fizz", createTitleIncludes: "Fizz Caramel" },
    ],
  },
  {
    id: "duplicate-observation",
    title: "Duplicate / repeated observation",
    category: "duplicate",
    world: "toyworld",
    projectId: TOYWORLD_ID,
    evaluationMode: "live",
    transcript:
      "Packaging delay is resolved. Also, the packaging delay issue is resolved.",
    material: [
      {
        id: "packaging-once",
        meaning: "Packaging delay resolved — one durable intent, not two writes.",
        meaningTokens: ["packaging", "delay", "resolved"],
        allowedDomains: ["risk"],
        existingTargetId: "risk-packaging",
        existingVsNew: "existing",
        expectedDisposition: ["update_existing", "merge"],
      },
    ],
    allowedDomains: ["risk"],
    prohibitedInterpretations: [
      "Emit two independent resolve writes",
    ],
    prohibitedWrites: [
      { reason: "Must not CREATE a second risk", createTitleIncludes: "Packaging delay" },
    ],
    notes: "A merge disposition on the restatement is acceptable.",
  },
  {
    id: "correction-of-wording",
    title: "Correction of earlier wording",
    category: "correction",
    world: "gamingstudio5000",
    projectId: GAMING_ID,
    evaluationMode: "live",
    transcript:
      "The shader compile is stalling the cert build. Wait — I meant the audio bus mixer, not the shader.",
    material: [
      {
        id: "audio-bus",
        meaning: "The intended new risk is the audio bus mixer, after a spoken correction.",
        meaningTokens: ["audio", "bus"],
        allowedDomains: ["risk"],
        existingVsNew: "new",
        expectedDisposition: "create_new",
      },
    ],
    allowedDomains: ["risk", "commentary"],
    prohibitedInterpretations: [
      "Keep the shader compile as a current risk alongside the mixer",
      "Ignore the correction",
    ],
    prohibitedWrites: [
      { reason: "Must not write the retracted shader compile as a durable current risk", createTitleIncludes: "shader" },
    ],
  },
  {
    id: "mixed-domains",
    title: "Mixed domains in one transcript",
    category: "mixed",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Pippa Gumdrop remains UAT lead. Parade day moved to 22 October 2026. The chocolate fountain pump is overheating.",
    material: [
      {
        id: "pippa-still",
        meaning: "Pippa remains UAT lead.",
        meaningTokens: ["pippa", "uat"],
        allowedDomains: ["person", "responsibility"],
        existingTargetId: "person-gumdrop",
        existingVsNew: "existing",
        expectedNoChange: true,
      },
      {
        id: "parade-22",
        meaning: "Parade day moves to 22 October 2026.",
        meaningTokens: ["parade", "22", "october"],
        allowedDomains: ["milestone"],
        existingTargetId: "ms-parade",
        existingVsNew: "existing",
      },
      {
        id: "fountain-new",
        meaning: "New risk: chocolate fountain pump overheating.",
        meaningTokens: ["fountain", "pump"],
        allowedDomains: ["risk"],
        existingVsNew: "new",
      },
    ],
    allowedDomains: ["person", "responsibility", "milestone", "risk"],
    prohibitedInterpretations: [
      "Collapse everything into a single To Do",
      "Miss the date move or the new risk",
    ],
    prohibitedWrites: [
      { reason: "Must not CREATE a todo for the date", operationType: "create_todo" },
    ],
  },
  {
    id: "pronoun-ambiguity",
    title: "Pronoun / reference ambiguity",
    category: "pronoun",
    world: "gamingstudio5000",
    projectId: GAMING_ID,
    evaluationMode: "live",
    transcript: "She said she will own the boss balancing pass from now on.",
    material: [
      {
        id: "who-she",
        meaning: "The speaker did not name who 'she' is.",
        meaningTokens: ["she", "boss"],
        allowedDomains: ["person", "responsibility", "unknown", "commentary"],
        existingVsNew: "ambiguous",
        expectedDisposition: "ambiguous",
        expectedNeedsYou: true,
      },
    ],
    allowedDomains: ["person", "responsibility", "unknown", "commentary"],
    expectedNeedsYou: true,
    prohibitedInterpretations: [
      "Assign boss balancing to Pixel Ramos without evidence",
    ],
    prohibitedWrites: [
      { reason: "Must not write ownership onto Pixel from a pronoun", targetId: "person-pixel" },
    ],
  },
  {
    id: "irrelevant-commentary",
    title: "Irrelevant commentary",
    category: "commentary",
    world: "gamingstudio5000",
    projectId: GAMING_ID,
    evaluationMode: "live",
    transcript:
      "The lobby cabinets were blasting chiptunes all morning, nothing about the certification sprint.",
    material: [],
    allowedDomains: ["commentary", "unknown"],
    expectedCommentary: true,
    expectedNoChange: true,
    prohibitedInterpretations: [
      "Invent a certification risk or to-do from lobby chatter",
    ],
    prohibitedWrites: [
      { reason: "Must not write anything from lobby commentary", domain: "todo" },
      { reason: "Must not write a risk from lobby commentary", domain: "risk" },
    ],
  },
  {
    id: "explicit-no-change",
    title: "Explicit no-change",
    category: "no-change",
    world: "toyworld",
    projectId: TOYWORLD_ID,
    evaluationMode: "live",
    transcript:
      "Nothing has changed on Toyworld this week. Leave the records as they are.",
    material: [],
    allowedDomains: ["commentary", "unknown"],
    expectedNoChange: true,
    prohibitedInterpretations: [
      "Invent updates because the project was named",
    ],
    prohibitedWrites: [
      { reason: "Explicit no-change must not become a write", domain: "risk" },
      { reason: "Explicit no-change must not create todos", operationType: "create_todo" },
    ],
  },
  {
    id: "cross-project-bait",
    title: "Cross-project bait",
    category: "isolation",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Pixel Ramos from GamingStudio5000 should own our UAT, and please resolve the Console certification slip risk while you are here.",
    material: [
      {
        id: "foreign-people-risk",
        meaning: "GamingStudio5000 people and risks were mentioned inside Candyland Capture.",
        meaningTokens: ["pixel", "console"],
        allowedDomains: ["person", "responsibility", "risk", "commentary", "unknown"],
        existingVsNew: "ambiguous",
        expectedNeedsYou: true,
      },
    ],
    allowedDomains: ["person", "responsibility", "risk", "commentary", "unknown"],
    expectedNeedsYou: true,
    prohibitedInterpretations: [
      "Resolve GamingStudio5000 console certification from Candyland",
      "Silently add Pixel Ramos as a Candyland stakeholder as if transferred",
    ],
    prohibitedWrites: [
      { reason: "Must not mutate the console risk", targetId: "risk-console" },
      { reason: "Must not complete console cert", targetId: "ms-cert" },
    ],
  },
  {
    id: "toyworld-vocabulary-bait",
    title: "Toyworld vocabulary bait on Candyland",
    category: "isolation",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Brick Oakley says Toyworld's packaging delay should be copied onto Candyland as well.",
    material: [
      {
        id: "packaging-bait",
        meaning: "A Toyworld person and risk were offered as Candyland writes.",
        meaningTokens: ["brick", "packaging"],
        allowedDomains: ["person", "risk", "commentary", "unknown"],
        existingVsNew: "ambiguous",
        expectedNeedsYou: true,
      },
    ],
    allowedDomains: ["person", "risk", "commentary", "unknown"],
    expectedNeedsYou: true,
    prohibitedInterpretations: [
      "Update Toyworld packaging delay from Candyland Capture",
      "Reuse person-brick or risk-packaging IDs on Candyland",
    ],
    prohibitedWrites: [
      { reason: "Must not mutate Toyworld packaging risk", targetId: "risk-packaging" },
      { reason: "Must not mutate Brick Oakley via foreign id", targetId: "person-brick" },
    ],
  },
  {
    id: "foreign-ids-malformed-envelope",
    title: "Malformed / foreign IDs fail closed",
    category: "fail-closed",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "fixture-only",
    transcript:
      "Please attach this update to the console certification risk.",
    material: [],
    allowedDomains: ["risk", "unknown", "commentary"],
    expectedNeedsYou: true,
    prohibitedInterpretations: [
      "Accept a GamingStudio5000 id inside Candyland",
    ],
    prohibitedWrites: [
      { reason: "Foreign id risk-console must not write", targetId: "risk-console" },
      { reason: "Unknown id must not become CREATE", operationType: "create_risk" },
    ],
    notes: "Live models are not asked to emit foreign IDs. This case injects an adversarial envelope.",
  },
];

export const LIVE_EVAL_CASES = CAPTURE_V2_EVAL_CORPUS.filter(
  (c) => c.evaluationMode === "live",
);

export const FIXTURE_ONLY_CASES = CAPTURE_V2_EVAL_CORPUS.filter(
  (c) => c.evaluationMode === "fixture-only",
);

export function corpusWorldCounts(): Record<EvalWorldId, number> {
  const counts: Record<EvalWorldId, number> = {
    candyland: 0,
    toyworld: 0,
    gamingstudio5000: 0,
  };
  for (const row of CAPTURE_V2_EVAL_CORPUS) {
    counts[row.world] += 1;
  }
  return counts;
}

export const REQUIRED_CORPUS_CATEGORIES = [
  "person-existing",
  "person-new",
  "person-ambiguous",
  "responsibility-continue",
  "responsibility-replace",
  "responsibility-ambiguous",
  "risk-update",
  "risk-new",
  "risk-resolve",
  "milestone-move",
  "milestone-unchanged",
  "todo",
  "availability",
  "duplicate",
  "correction",
  "mixed",
  "pronoun",
  "commentary",
  "no-change",
  "isolation",
  "fail-closed",
] as const;
