/**
 * Frozen Capture V2 model baseline.
 *
 * Recorded against HEAD 3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4
 * (cursor/capture-v2-desert-new-project-56c9). Do not retune the prompt
 * or schema from benchmark failures. If production prompt/schema/model
 * drift, the foundation verify script must fail until the freeze is
 * deliberately revised.
 */

import {
  CAPTURE_V2_OBSERVATION_SCHEMA,
  buildObservationExtractionPrompt,
} from "@/lib/capture-v2/prompt";
import { PINNED_OPENAI_CHAT_MODEL } from "@/lib/openai-model";

export const FROZEN_V2_BASELINE_VERSION = "capture-v2-eval-baseline-v1";

/**
 * Corpus composition freeze (Hulk amendment).
 * Independent of the V2 prompt/schema/model freeze above.
 * Finalised before any live provider result was seen.
 */
export const FROZEN_CORPUS_COMPOSITION = {
  version: "capture-v2-eval-corpus-v1-hulk",
  finalisedAt: "2026-08-26",
  liveProviderResultsSeen: false,
  note: "Corpus composition was finalised BEFORE any live provider result was seen. Do not alter cases in response to later model output.",
  worlds: {
    candyland: "largest share; Playwright journeys and cross-project bait remain here",
    toyworld: "several genuine semantic cases (not bait-only)",
    gamingstudio5000: "several genuine semantic cases (not bait-only)",
  },
} as const;

export const FROZEN_PROGRAMME_BASE = {
  branch: "cursor/capture-v2-desert-new-project-56c9",
  headSha: "3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4",
  phase3bAncestor: "cursor/phase-3b-capture-boundary-bfd3",
  pr64Title: "Phase 3B: Conservative Capture mutation boundary",
} as const;

/** Copied from src/lib/capture-v2/extract.ts at freeze time. */
export const FROZEN_SYSTEM_MESSAGE =
  "You extract atomic project observations as JSON. You do not mutate a database. You never invent record IDs.";

export const FROZEN_TEMPERATURE = 0.2;
export const FROZEN_RESPONSE_FORMAT = { type: "json_object" } as const;

export const FROZEN_FLAG = {
  name: "LUME_CAPTURE_V2",
  enabledValues: ["1", "true"],
  unsetMeans: "legacy Capture (OpenAI findings path)",
} as const;

export const FROZEN_DEFAULT_OPENAI_MODEL = PINNED_OPENAI_CHAT_MODEL;

export const FROZEN_OPENAI_MODEL_OVERRIDE = {
  production: "OPENAI_MODEL — used when set; floating alias gpt-4o-mini pins to snapshot",
  evalOnly: "OPENAI_EVAL_MODEL — wins only when resolveOpenAIChatModel({ forEval: true })",
  captureV2Extract: "uses resolveOpenAIChatModel() without forEval, so OPENAI_MODEL then pin",
} as const;

export const FROZEN_SCHEMA = CAPTURE_V2_OBSERVATION_SCHEMA;

export const FROZEN_PROMPT_RULES = `Rules:
- Split the transcript into the smallest project-relevant facts (multiple observations per sentence are expected).
- Every observation needs a verbatim evidence quote from the transcript.
- candidateTargetId MUST be copied from the supplied current records. Never invent IDs.
- If a person/risk/date/todo already exists, prefer update_existing or no_change over create_new.
- If share vs replace (or two plausible targets) cannot be decided from the transcript, disposition=ambiguous.
- truthIntent=current only when the user is asserting this as current authoritative project truth (including explicit corrections, agreed dates/ownership, and agreed future milestones). truthIntent=non_current for historical, quoted, superseded, considered-but-not-agreed, or rejected alternatives. truthIntent=uncertain when it is unclear whether current truth should change.
- Project-irrelevant chatter is domain=commentary and disposition=commentary.
- Duplicate restatements: keep one observation and mark others disposition=merge.
- Do not output operations, SQL, or Apply Ready. Confidence is informational only.`;

export const FROZEN_PROJECT_CONTEXT_SHAPE = [
  "Current project: {name} ({code}) id={id}",
  "Authoritative current records (use these IDs only; never invent IDs):",
  '- id={id} domain={entityType} title="{title}"',
  "Scoped to the Capture entry project. Foreign-project IDs are not supplied.",
].join("\n");

export const FROZEN_REASONING_SETTINGS = {
  openai: "none — chat completions temperature 0.2, json_object; no reasoning.effort",
  anthropicEvalAdapter: "none — temperature 0.2; no thinking budget in this baseline",
  geminiEvalAdapter: "none — temperature 0.2, responseMimeType application/json",
} as const;

/**
 * Suggested challengers for the live harness only.
 * Not product model-selection logic.
 */
export const SUGGESTED_EVAL_CHALLENGERS = {
  openai: [PINNED_OPENAI_CHAT_MODEL, "gpt-4.1-mini"],
  anthropic: ["claude-sonnet-4-5"],
  gemini: ["gemini-2.0-flash"],
} as const;

export const FROZEN_V2_BASELINE = {
  version: FROZEN_V2_BASELINE_VERSION,
  frozenAt: "2026-08-26",
  programme: FROZEN_PROGRAMME_BASE,
  defaultProvider: "openai" as const,
  defaultModel: FROZEN_DEFAULT_OPENAI_MODEL,
  modelOverride: FROZEN_OPENAI_MODEL_OVERRIDE,
  flag: FROZEN_FLAG,
  temperature: FROZEN_TEMPERATURE,
  responseFormat: FROZEN_RESPONSE_FORMAT,
  systemMessage: FROZEN_SYSTEM_MESSAGE,
  schema: FROZEN_SCHEMA,
  promptRules: FROZEN_PROMPT_RULES,
  projectContextShape: FROZEN_PROJECT_CONTEXT_SHAPE,
  reasoning: FROZEN_REASONING_SETTINGS,
  suggestedChallengers: SUGGESTED_EVAL_CHALLENGERS,
  corpusComposition: FROZEN_CORPUS_COMPOSITION,
  note: "Benchmark is a measuring instrument. Do not train against the test.",
} as const;

export function livePromptSnapshot(args?: {
  transcript?: string;
  projectBlock?: string;
}): string {
  return buildObservationExtractionPrompt({
    transcript: args?.transcript ?? "{{TRANSCRIPT}}",
    projectBlock: args?.projectBlock ?? "{{PROJECT_BLOCK}}",
  });
}

export function baselineStillMatchesProduction(): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (CAPTURE_V2_OBSERVATION_SCHEMA !== FROZEN_SCHEMA) {
    issues.push("Observation schema drifted from frozen baseline.");
  }
  const live = livePromptSnapshot();
  if (!live.includes(FROZEN_PROMPT_RULES)) {
    issues.push("V2 prompt rules drifted from frozen baseline.");
  }
  if (!live.includes(FROZEN_SCHEMA)) {
    issues.push("V2 prompt no longer embeds the frozen schema.");
  }
  if (PINNED_OPENAI_CHAT_MODEL !== "gpt-4o-mini-2024-07-18") {
    issues.push(
      `Default OpenAI model drifted (${PINNED_OPENAI_CHAT_MODEL}); baseline is gpt-4o-mini-2024-07-18.`,
    );
  }
  return { ok: issues.length === 0, issues };
}
