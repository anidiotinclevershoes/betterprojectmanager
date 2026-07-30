import { analyseCapture } from "./coach";
import {
  buildCaptureAssembledPrompt,
  logPromptAssemblyDiagnostic,
  type AssembledPrompt,
} from "@/ai/domain";
import type { CaptureProjectContext } from "./capture/context";
import {
  attachFindingsToResult,
  knowledgePatchFromOperations,
  recommendationsFromOperations,
  runFindingsPipeline,
} from "./capture/findings";
import { COACHING_SYSTEM_PROMPT, MEMORY_TYPES } from "./mission";
import type {
  CaptureInput,
  CaptureResult,
  MissionState,
  Project,
  ProjectKnowledge,
  TimelineItem,
} from "./types";

/**
 * Normalise API keys copied from dashboards/password managers.
 * Strips BOM, wrapping quotes, and accidental whitespace/newlines that cause 401s.
 */
export function getOpenAIKey() {
  const raw = process.env.OPENAI_API_KEY ?? "";
  let key = raw.replace(/^\uFEFF/, "").trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\s+/g, "");
  return key;
}

export function isOpenAIConfigured() {
  const key = getOpenAIKey();
  return key.startsWith("sk-") && key.length > 20;
}

export function getOpenAIKeyDiagnostics() {
  const key = getOpenAIKey();
  if (!key) {
    return {
      openaiConfigured: false,
      reason: "OPENAI_API_KEY is missing from .env.local",
      prefix: null as string | null,
      length: 0,
    };
  }
  if (!key.startsWith("sk-")) {
    return {
      openaiConfigured: false,
      reason:
        "Key does not start with sk- — use an API key from platform.openai.com/api-keys",
      prefix: key.slice(0, 6),
      length: key.length,
    };
  }
  if (
    key === "sk-..." ||
    key.includes("your-real-key") ||
    key.endsWith("...")
  ) {
    return {
      openaiConfigured: false,
      reason:
        "Placeholder key detected — replace sk-... with your real secret key",
      prefix: key.slice(0, 7),
      length: key.length,
    };
  }
  return {
    openaiConfigured: true,
    reason: null as string | null,
    prefix: key.startsWith("sk-proj-") ? "sk-proj-…" : "sk-…",
    length: key.length,
  };
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export type AiCapturePayload = {
  title: string;
  tidiedContent: string;
  memoryType: string;
  tags: string[];
  people: string[];
  insights: string[];
  assumptions: string[];
  /** Phase 1.6: structured findings — not final operations. */
  findings?: unknown[];
  suggestedProjectId?: string | null;
};

const CAPTURE_JSON_SCHEMA_HINT = `{
  "title": "short memory title",
  "tidiedContent": "clear, structured note preserving facts, names, dates and decisions — no fluff",
  "memoryType": one of ${JSON.stringify(MEMORY_TYPES)},
  "tags": ["short", "tags"],
  "people": ["Full Names if known"],
  "insights": ["short factual bullets of what happened"],
  "assumptions": ["explicit assumptions when info is missing"],
  "findings": [
    {
      "fact": "one concrete fact from the Capture",
      "evidence": "short quote or paraphrase from Capture supporting the fact",
      "findingType": "ENTITY_COMPLETED|ENTITY_UPDATED|ENTITY_BLOCKED|ENTITY_REOPENED|NEW_INFORMATION|NO_CHANGE|AMBIGUOUS",
      "target": {
        "entityType": "todo|risk|knowledge|stakeholder|meeting|milestone|nudge|release",
        "entityId": "exact id from the supplied Existing records list — never invent",
        "title": "exact title from that record"
      },
      "changes": {
        "fieldName": { "previous": "optional prior value", "proposed": "new value" }
      },
      "confidence": 0-100,
      "requiresClarification": false,
      "clarificationQuestion": "only when ambiguous",
      "reasoningSummary": "one or two sentences linking evidence to the finding"
    }
  ],
  "suggestedProjectId": "project id if clear, else null"
}

Important:
- Do NOT return recommendations, operations, knowledgePatch, or timelinePatch.
- Do NOT invent record IDs. If no record matches, omit target or use AMBIGUOUS / NEW_INFORMATION.
- Prefer matching an existing record over creating duplicate Knowledge.
- Do not create Knowledge merely to record a transient status update (e.g. a To Do completed).
- Mark uncertainty as AMBIGUOUS rather than guessing.`;


export type CapturePromptBuildArgs = {
  rawText: string;
  projectId?: string;
  sourceType?: CaptureInput["sourceType"];
  projects: Project[];
  existingKnowledge?: ProjectKnowledge | null;
  existingTimeline?: TimelineItem[];
  openTodos?: Array<{
    id: string;
    title: string;
    projectId?: string | null;
    dueAt?: string;
  }>;
  captureContext?: CaptureProjectContext | null;
};

export type CapturePromptAssembly = AssembledPrompt;

/**
 * Modular Capture prompt assembly (Role → Domain → Dictionary → Context → Capture → Schema).
 * Response JSON schema is unchanged from Phase 1.
 */
export function buildCapturePromptAssembly(
  args: CapturePromptBuildArgs,
): AssembledPrompt {
  return buildCaptureAssembledPrompt({
    ...args,
    schemaHint: CAPTURE_JSON_SCHEMA_HINT,
  });
}

/**
 * Pure prompt construction for Capture analysis.
 * Used by the OpenAI caller and by path tests that assert context inclusion.
 */
export function buildCaptureUserPrompt(args: CapturePromptBuildArgs): string {
  return buildCapturePromptAssembly(args).text;
}

export async function tidyAndCoachWithOpenAI(
  args: CapturePromptBuildArgs,
): Promise<{
  ai: AiCapturePayload;
  promptAssembly: AssembledPrompt;
  providerUsage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  responseText: string;
  model: string;
}> {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const promptAssembly = buildCapturePromptAssembly(args);
  logPromptAssemblyDiagnostic(promptAssembly);
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: COACHING_SYSTEM_PROMPT },
        { role: "user", content: promptAssembly.text },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI capture failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty capture response");
  }

  return {
    ai: JSON.parse(content) as AiCapturePayload,
    promptAssembly,
    providerUsage: data.usage ?? null,
    responseText: content,
    model,
  };
}

export async function transcribeWithWhisper(
  file: File | Blob,
  filename: string,
) {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", "whisper-1");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: form,
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 401) {
      throw new Error(
        "Whisper failed (401): OpenAI rejected your API key. Create a new key at platform.openai.com/api-keys, put it in .env.local as OPENAI_API_KEY=sk-... with no quotes, then fully restart npm run dev.",
      );
    }
    throw new Error(`Whisper failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { text?: string };
  if (!data.text?.trim()) {
    throw new Error("Whisper returned empty transcript");
  }
  return data.text.trim();
}

export function buildCaptureResultFromAi(args: {
  rawText: string;
  projectId?: string;
  sourceType?: CaptureInput["sourceType"];
  ai: AiCapturePayload;
  captureContext?: CaptureProjectContext | null;
}): CaptureResult {
  const memoryType = (MEMORY_TYPES as readonly string[]).includes(
    args.ai.memoryType,
  )
    ? (args.ai.memoryType as CaptureResult["memory"]["type"])
    : args.sourceType === "voice_note"
      ? "voice_note"
      : "conversation";

  const memoryId = id("mem");
  const now = new Date().toISOString();
  const projectId = args.ai.suggestedProjectId || args.projectId || undefined;

  const pipeline = runFindingsPipeline({
    rawFindings: args.ai.findings,
    captureText: args.rawText,
    captureContext: args.captureContext,
    allowLocalFallback: false,
  });

  const recommendations = recommendationsFromOperations(
    pipeline.operations,
    projectId,
    memoryId,
  );
  const knowledgePatch = knowledgePatchFromOperations(
    pipeline.operations,
    pipeline.findings,
  );

  const base: CaptureResult = {
    memory: {
      id: memoryId,
      type: memoryType,
      projectId,
      title: args.ai.title || args.ai.tidiedContent.slice(0, 72),
      content: args.ai.tidiedContent,
      tags: args.ai.tags ?? [],
      people: args.ai.people ?? [],
      occurredAt: now,
      createdAt: now,
      source: "capture",
    },
    insights: [...(args.ai.insights ?? [])],
    assumptions: args.ai.assumptions ?? [],
    recommendations,
    rawContent: args.rawText,
    tidied: true,
    provider: "openai",
    knowledgePatch,
    knowledgeProjectId: projectId,
    timelinePatch: undefined,
    findingsValidation: {
      ok: pipeline.validation.ok,
      errors: pipeline.validation.errors,
      warnings: pipeline.validation.warnings,
      invalidTargetCount: pipeline.validation.invalidTargetCount,
    },
  };

  return attachFindingsToResult(
    base,
    pipeline.findings,
    pipeline.operations,
  );
}

export function localCaptureFallback(
  input: CaptureInput,
  state: MissionState,
  captureContext?: CaptureProjectContext | null,
): CaptureResult {
  const analysed = analyseCapture(input, state);
  const projectId = analysed.memory.projectId || input.projectId;

  const pipeline = runFindingsPipeline({
    rawFindings: null,
    captureText: input.content,
    captureContext: captureContext ?? null,
    allowLocalFallback: true,
  });

  const memoryId = analysed.memory.id;
  const recommendations = recommendationsFromOperations(
    pipeline.operations,
    projectId,
    memoryId,
  );
  const knowledgePatch = knowledgePatchFromOperations(
    pipeline.operations,
    pipeline.findings,
  );

  const base: CaptureResult = {
    ...analysed,
    recommendations,
    rawContent: input.content,
    tidied: false,
    provider: "local",
    knowledgePatch,
    knowledgeProjectId: projectId,
    timelinePatch: undefined,
    insights: [
      ...pipeline.findings.map((f) => f.fact),
      ...(analysed.insights ?? []).slice(0, 2),
    ],
    findingsValidation: {
      ok: pipeline.validation.ok,
      errors: pipeline.validation.errors,
      warnings: pipeline.validation.warnings,
      invalidTargetCount: pipeline.validation.invalidTargetCount,
    },
  };

  return attachFindingsToResult(
    base,
    pipeline.findings,
    pipeline.operations,
  );
}

