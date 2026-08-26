/**
 * Frozen Capture V2 evaluation corpus.
 * Fictional worlds only. Fresh wording — no Niamh / CAB / ATLAS phrases.
 *
 * Meaning-based expectations. Do not treat this as training data.
 */

import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
} from "@/lib/experiments/worlds";
import type { BenchmarkCase } from "./types";

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
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Marzipan Cole is joining as float marshal next Monday.",
    material: [
      {
        id: "marzipan-new",
        meaning: "Marzipan Cole is a new person on Candyland.",
        meaningTokens: ["marzipan", "cole"],
        allowedDomains: ["person"],
        existingVsNew: "new",
        expectedDisposition: "create_new",
      },
    ],
    allowedDomains: ["person"],
    prohibitedInterpretations: [
      "Treat Marzipan Cole as Pippa Gumdrop or Fizz Caramel",
    ],
    prohibitedWrites: [
      { reason: "Must not retarget an existing person", targetId: "person-gumdrop" },
      { reason: "Must not retarget Fizz", targetId: "person-fizz" },
    ],
  },
  {
    id: "ambiguous-same-first-name",
    title: "Same first name / ambiguous Person",
    category: "person-ambiguous",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Pippa from the marshmallow stall called; she wants to help with UAT.",
    material: [
      {
        id: "which-pippa",
        meaning: "A Pippa was mentioned who may not be Pippa Gumdrop — preserve ambiguity.",
        meaningTokens: ["pippa", "marshmallow"],
        allowedDomains: ["person", "responsibility", "unknown"],
        existingVsNew: "ambiguous",
        expectedDisposition: ["ambiguous", "commentary"],
        expectedNeedsYou: true,
      },
    ],
    allowedDomains: ["person", "responsibility", "unknown", "commentary"],
    expectedNeedsYou: true,
    prohibitedInterpretations: [
      "Assert this is definitely Pippa Gumdrop",
      "Create a second Pippa Gumdrop without flagging ambiguity",
    ],
    prohibitedWrites: [
      { reason: "Must not silently CREATE another Pippa", createTitleIncludes: "Pippa" },
      { reason: "Must not overwrite Gumdrop identity", targetId: "person-gumdrop" },
    ],
  },
  {
    id: "responsibility-continues",
    title: "Responsibility continues",
    category: "responsibility-continue",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Fizz Caramel continues as Designer on the parade float. No change there.",
    material: [
      {
        id: "fizz-continues",
        meaning: "Fizz Caramel still holds Designer; this is continuity, not replacement.",
        meaningTokens: ["fizz", "caramel", "designer"],
        allowedDomains: ["responsibility", "person"],
        existingTargetId: "person-fizz",
        existingVsNew: "existing",
        expectedDisposition: ["no_change", "update_existing"],
        expectedNoChange: true,
      },
    ],
    allowedDomains: ["responsibility", "person"],
    expectedNoChange: true,
    prohibitedInterpretations: [
      "Replace Pippa Gumdrop",
      "Treat Designer as vacant",
    ],
    prohibitedWrites: [
      { reason: "Must not replace UAT lead", targetId: "person-gumdrop" },
    ],
  },
  {
    id: "responsibility-replacement",
    title: "Responsibility replacement",
    category: "responsibility-replace",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Marzipan Cole will replace Pippa Gumdrop as UAT lead from next week.",
    material: [
      {
        id: "uat-replace",
        meaning: "UAT lead moves from Pippa Gumdrop to Marzipan Cole (replace, not share).",
        meaningTokens: ["replace", "uat"],
        allowedDomains: ["responsibility", "person"],
        existingVsNew: "ambiguous",
        expectedDisposition: ["update_existing", "create_new", "ambiguous"],
      },
      {
        id: "marzipan-mentioned",
        meaning: "Marzipan Cole is introduced in this ownership change.",
        meaningTokens: ["marzipan", "cole"],
        allowedDomains: ["person", "responsibility"],
        existingVsNew: "new",
      },
    ],
    allowedDomains: ["responsibility", "person"],
    prohibitedInterpretations: [
      "Treat this as share rather than replace",
      "Leave Pippa as sole UAT lead with no change noted",
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
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Gumdrop Bridge icing is getting worse after last night's frost.",
    material: [
      {
        id: "bridge-worse",
        meaning: "Existing Gumdrop Bridge icing risk is worsening, still open.",
        meaningTokens: ["gumdrop", "bridge", "icing"],
        allowedDomains: ["risk"],
        existingTargetId: "risk-bridge",
        existingVsNew: "existing",
        expectedDisposition: "update_existing",
      },
    ],
    allowedDomains: ["risk"],
    prohibitedInterpretations: [
      "Create a second icing risk",
      "Mark the risk resolved",
      "Turn this into a To Do",
    ],
    prohibitedWrites: [
      { reason: "Must not CREATE a duplicate bridge risk", createTitleIncludes: "Gumdrop Bridge" },
      { reason: "Must not create a To Do for an existing risk", operationType: "create_todo" },
    ],
  },
  {
    id: "new-risk",
    title: "New Risk",
    category: "risk-new",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "The chocolate fountain pump is overheating and could stall the float.",
    material: [
      {
        id: "fountain-pump",
        meaning: "A new risk about the chocolate fountain pump overheating.",
        meaningTokens: ["fountain", "pump"],
        allowedDomains: ["risk"],
        existingVsNew: "new",
        expectedDisposition: "create_new",
      },
    ],
    allowedDomains: ["risk"],
    prohibitedInterpretations: [
      "Update Gumdrop Bridge icing instead",
    ],
    prohibitedWrites: [
      { reason: "Must not retarget the bridge risk", targetId: "risk-bridge" },
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
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript: "Just confirming: Parade day remains 15 October 2026.",
    material: [
      {
        id: "parade-same",
        meaning: "Parade day is unchanged at 15 October 2026.",
        meaningTokens: ["parade", "15", "october"],
        allowedDomains: ["milestone"],
        existingTargetId: "ms-parade",
        existingVsNew: "existing",
        expectedDisposition: "no_change",
        expectedNoChange: true,
      },
    ],
    allowedDomains: ["milestone", "commentary"],
    expectedNoChange: true,
    prohibitedInterpretations: [
      "Move Parade day to a new date",
    ],
    prohibitedWrites: [
      { reason: "Must not UPDATE the milestone date", targetId: "ms-parade" },
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
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Gumdrop Bridge icing is resolved. Also, the Gumdrop Bridge icing issue is resolved.",
    material: [
      {
        id: "bridge-once",
        meaning: "Bridge icing resolved — one durable intent, not two writes.",
        meaningTokens: ["gumdrop", "bridge", "resolved"],
        allowedDomains: ["risk"],
        existingTargetId: "risk-bridge",
        existingVsNew: "existing",
        expectedDisposition: ["update_existing", "merge"],
      },
    ],
    allowedDomains: ["risk"],
    prohibitedInterpretations: [
      "Emit two independent resolve writes",
    ],
    prohibitedWrites: [
      { reason: "Must not CREATE a second risk", createTitleIncludes: "Gumdrop Bridge" },
    ],
    notes: "A merge disposition on the restatement is acceptable.",
  },
  {
    id: "correction-of-wording",
    title: "Correction of earlier wording",
    category: "correction",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "The chocolate fountain pump is overheating. Wait — I meant the taffy mixer, not the fountain.",
    material: [
      {
        id: "taffy-mixer",
        meaning: "The intended new risk is the taffy mixer, after a spoken correction.",
        meaningTokens: ["taffy", "mixer"],
        allowedDomains: ["risk"],
        existingVsNew: "new",
        expectedDisposition: "create_new",
      },
    ],
    allowedDomains: ["risk", "commentary"],
    prohibitedInterpretations: [
      "Keep the fountain pump as a current risk alongside the mixer",
      "Ignore the correction",
    ],
    prohibitedWrites: [
      { reason: "Must not write the retracted fountain pump as a durable current risk", createTitleIncludes: "fountain" },
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
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript: "She said she will own the UAT pack from now on.",
    material: [
      {
        id: "who-she",
        meaning: "The speaker did not name who 'she' is.",
        meaningTokens: ["she", "uat"],
        allowedDomains: ["person", "responsibility", "unknown", "commentary"],
        existingVsNew: "ambiguous",
        expectedDisposition: "ambiguous",
        expectedNeedsYou: true,
      },
    ],
    allowedDomains: ["person", "responsibility", "unknown", "commentary"],
    expectedNeedsYou: true,
    prohibitedInterpretations: [
      "Assign UAT to Pippa Gumdrop without evidence",
      "Assign UAT to Fizz Caramel without evidence",
    ],
    prohibitedWrites: [
      { reason: "Must not write UAT onto Pippa from a pronoun", targetId: "person-gumdrop" },
      { reason: "Must not write UAT onto Fizz from a pronoun", targetId: "person-fizz" },
    ],
  },
  {
    id: "irrelevant-commentary",
    title: "Irrelevant commentary",
    category: "commentary",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "The fudge in the break room was excellent today, nothing about the parade.",
    material: [],
    allowedDomains: ["commentary", "unknown"],
    expectedCommentary: true,
    expectedNoChange: true,
    prohibitedInterpretations: [
      "Invent a parade risk or to-do from snack talk",
    ],
    prohibitedWrites: [
      { reason: "Must not write anything from snack commentary", domain: "todo" },
      { reason: "Must not write a risk from snack commentary", domain: "risk" },
    ],
  },
  {
    id: "explicit-no-change",
    title: "Explicit no-change",
    category: "no-change",
    world: "candyland",
    projectId: CANDYLAND_ID,
    evaluationMode: "live",
    transcript:
      "Nothing has changed on Candyland this week. Leave the records as they are.",
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
