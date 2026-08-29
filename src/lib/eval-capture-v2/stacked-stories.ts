/**
 * Named sequential Capture story packs.
 * Reuses the frozen 22-case corpus transcripts/envelopes where practical.
 * Does not alter the corpus. Extra envelopes are stacked-only fixtures.
 */

import {
  CANDYLAND_ID,
  GAMING_ID,
  TOYWORLD_ID,
} from "@/lib/experiments/worlds";
import { CAPTURE_V2_EVAL_CORPUS } from "./corpus";
import { frozenEnvelopeFor, FROZEN_MODEL_OUTPUTS } from "./frozen-model-outputs";
import type { EvalWorldId } from "./types";

export type StackedReview =
  | "no_change"
  | "apply"
  | "needs_you"
  | "apply_or_no_change"
  | "mixed";

export type StackedBindTarget = {
  domain: "todo" | "person" | "risk" | "milestone";
  titleIncludes: string;
};

export type StackedStep = {
  id: string;
  title: string;
  transcript: string;
  rawModelJson: unknown;
  expectedReview: StackedReview;
  /** When set, fill candidateTargetId from current world before V2 resolve. */
  bindTarget?: StackedBindTarget;
  corpusCaseId?: string;
};

export type StackedStory = {
  id: string;
  title: string;
  world: EvalWorldId;
  projectId: string;
  steps: StackedStep[];
};

function corpusTranscript(caseId: string): string {
  const hit = CAPTURE_V2_EVAL_CORPUS.find((c) => c.id === caseId);
  if (!hit) throw new Error(`Unknown corpus case ${caseId}`);
  return hit.transcript;
}

function corpusEnvelope(caseId: string): unknown {
  if (FROZEN_MODEL_OUTPUTS.some((row) => row.caseId === caseId)) {
    return frozenEnvelopeFor(caseId);
  }
  return STACKED_ONLY_ENVELOPES[caseId];
}

function fromCorpus(
  caseId: string,
  expectedReview: StackedReview,
  title?: string,
): StackedStep {
  const envelope = corpusEnvelope(caseId);
  if (!envelope) {
    throw new Error(`No frozen/stacked envelope for ${caseId}`);
  }
  return {
    id: caseId,
    title: title ?? corpusTranscript(caseId).slice(0, 48),
    transcript: corpusTranscript(caseId),
    rawModelJson: envelope,
    expectedReview,
    corpusCaseId: caseId,
  };
}

/** Envelopes for corpus cases that isolated Playwright did not need. */
const STACKED_ONLY_ENVELOPES: Record<string, unknown> = {
  "explicit-no-change": {
    observations: [
      {
        id: "obs-no-change",
        statement: "Nothing has changed on Toyworld this week",
        evidence:
          "Nothing has changed on Toyworld this week. Leave the records as they are.",
        domain: "commentary",
        disposition: "commentary",
        truthIntent: "current",
        projectId: TOYWORLD_ID,
      },
    ],
  },
  "responsibility-continues": {
    observations: [
      {
        id: "obs-pixel-continues",
        statement: "Pixel Ramos remains Producer",
        evidence:
          "Pixel Ramos continues as Producer on the console sprint. No change there.",
        domain: "person",
        disposition: "no_change",
        truthIntent: "current",
        projectId: GAMING_ID,
        candidateTargetId: "person-pixel",
        candidateTargetTitle: "Pixel Ramos",
      },
    ],
  },
  "responsibility-replacement": {
    observations: [
      {
        id: "obs-producer-replace",
        statement: "Nova Quill may replace Pixel Ramos as Producer",
        evidence: "Nova Quill will replace Pixel Ramos as Producer from next week.",
        domain: "responsibility",
        disposition: "ambiguous",
        truthIntent: "current",
        projectId: GAMING_ID,
        proposedValues: { ownershipSemantics: "replace", scope: "Producer" },
        commentary: "Replacement is stated; Confirm Owner is still required.",
      },
    ],
  },
  "correction-of-wording": {
    observations: [
      {
        id: "obs-audio-bus",
        statement: "New risk: audio bus mixer stalling the cert build",
        evidence: "Wait — I meant the audio bus mixer, not the shader.",
        domain: "risk",
        disposition: "create_new",
        truthIntent: "current",
        projectId: GAMING_ID,
        proposedValues: { title: "Audio bus mixer stall" },
      },
    ],
  },
  "pronoun-ambiguity": {
    observations: [
      {
        id: "obs-who-she",
        statement: "Unnamed person may own the boss balancing pass",
        evidence: "She said she will own the boss balancing pass from now on.",
        domain: "responsibility",
        disposition: "ambiguous",
        truthIntent: "current",
        projectId: GAMING_ID,
        commentary: "The speaker did not name who she is.",
      },
    ],
  },
  "new-risk": {
    observations: [
      {
        id: "obs-shader",
        statement: "Shader compile is stalling the cert build",
        evidence:
          "The shader compile is stalling the cert build and could miss the nightlies.",
        domain: "risk",
        disposition: "create_new",
        truthIntent: "current",
        projectId: GAMING_ID,
        proposedValues: { title: "Shader compile stall" },
      },
    ],
  },
  "irrelevant-commentary": {
    observations: [
      {
        id: "obs-chiptune",
        statement: "Lobby cabinets were blasting chiptunes",
        evidence:
          "The lobby cabinets were blasting chiptunes all morning, nothing about the certification sprint.",
        domain: "commentary",
        disposition: "commentary",
        truthIntent: "current",
        projectId: GAMING_ID,
      },
    ],
  },
};

const VELVET_STILL: unknown = {
  observations: [
    {
      id: "obs-velvet-again",
      statement: "Velvet Sprocket is joining as paint lead",
      evidence: "Velvet Sprocket is still the paint lead on the wooden-track refresh.",
      domain: "person",
      disposition: "create_new",
      truthIntent: "current",
      projectId: TOYWORLD_ID,
      candidateTargetTitle: "Velvet Sprocket",
      proposedValues: { name: "Velvet Sprocket", role: "paint lead" },
    },
  ],
};

const BANNERS_DONE: unknown = {
  observations: [
    {
      id: "obs-banners-done",
      statement: "Candy-cane banners to-do is finished",
      evidence: "The candy-cane banners to-do is finished.",
      domain: "todo",
      disposition: "update_existing",
      truthIntent: "current",
      projectId: CANDYLAND_ID,
      candidateTargetTitle: "Polish the candy-cane banners",
      proposedValues: { status: "complete", done: true },
    },
  ],
};

export const STACKED_STORIES: StackedStory[] = [
  {
    id: "candyland",
    title: "Candyland long-run sequential Capture",
    world: "candyland",
    projectId: CANDYLAND_ID,
    steps: [
      fromCorpus("existing-person", "no_change", "Existing Person remains responsible"),
      fromCorpus("risk-resolution", "apply", "Existing Risk resolves"),
      fromCorpus("milestone-move", "apply", "Milestone date moves"),
      fromCorpus("availability", "apply", "Person availability changes"),
      fromCorpus(
        "share-vs-replace-ambiguous",
        "needs_you",
        "Ambiguous share-vs-replace",
      ),
      fromCorpus("todo-create", "apply", "Genuine new Todo"),
      {
        ...fromCorpus("existing-person", "no_change", "Repeated / no-change Person"),
        id: "existing-person-repeat",
      },
      {
        id: "todo-complete-from-earlier",
        title: "Complete Todo created earlier in the journey",
        transcript: "The candy-cane banners to-do is finished.",
        rawModelJson: BANNERS_DONE,
        expectedReview: "apply",
        bindTarget: { domain: "todo", titleIncludes: "candy-cane banners" },
      },
    ],
  },
  {
    id: "toyworld",
    title: "Toyworld identity / isolation",
    world: "toyworld",
    projectId: TOYWORLD_ID,
    steps: [
      fromCorpus("new-person", "apply", "Genuinely new Person"),
      {
        id: "velvet-later-reference",
        title: "Later reference must not create a duplicate Person",
        transcript:
          "Velvet Sprocket is still the paint lead on the wooden-track refresh.",
        rawModelJson: VELVET_STILL,
        expectedReview: "no_change",
      },
      fromCorpus("existing-risk-update", "apply_or_no_change", "Existing Risk update"),
      fromCorpus("explicit-no-change", "no_change", "Explicit no-change"),
    ],
  },
  {
    id: "gamingstudio5000",
    title: "GamingStudio5000 correction / ambiguity",
    world: "gamingstudio5000",
    projectId: GAMING_ID,
    steps: [
      fromCorpus("responsibility-continues", "no_change", "Responsibility continuation"),
      fromCorpus("responsibility-replacement", "needs_you", "Replacement stays Needs you"),
      fromCorpus("correction-of-wording", "apply", "Spoken correction → audio bus risk"),
      fromCorpus("pronoun-ambiguity", "needs_you", "Pronoun ambiguity"),
      fromCorpus("new-risk", "apply", "New shader compile Risk"),
      fromCorpus("irrelevant-commentary", "no_change", "Irrelevant commentary"),
    ],
  },
];

export function stackedStoryById(id: string): StackedStory {
  const hit = STACKED_STORIES.find((s) => s.id === id);
  if (!hit) throw new Error(`Unknown stacked story ${id}`);
  return hit;
}
