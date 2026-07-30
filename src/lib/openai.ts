import { analyseCapture } from "./coach";
import {
  parseSuggestionKind,
  parseSuggestionOp,
  type SuggestionKind,
  type SuggestionOp,
} from "./capture/suggestions";
import {
  buildCaptureAssembledPrompt,
  logPromptAssemblyDiagnostic,
  type AssembledPrompt,
} from "@/ai/domain";
import type { CaptureProjectContext } from "./capture/context";
import { extractKnowledgePatchFromText } from "./knowledge";
import { COACHING_SYSTEM_PROMPT, MEMORY_TYPES } from "./mission";
import { extractTimelinePatchFromText } from "./timeline";
import type {
  CaptureInput,
  CaptureResult,
  MissionState,
  Project,
  ProjectKnowledge,
  Recommendation,
  RecommendationKind,
  RecommendationUrgency,
  TimelineItem,
  TimelineItemInput,
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
  recommendations: Array<{
    kind: RecommendationKind;
    urgency: RecommendationUrgency;
    title: string;
    action: string;
    why: string;
    leadershipImpact: string;
    suggestedScript?: string;
    operation?: string;
    itemType?: string;
    targetTitle?: string;
  }>;
  suggestedProjectId?: string | null;
  knowledgePatch?: Partial<ProjectKnowledge["sections"]>;
  timelinePatch?: TimelineItemInput[];
};

const CAPTURE_JSON_SCHEMA_HINT = `{
  "title": "short memory title",
  "tidiedContent": "clear, structured note preserving facts, names, dates and decisions — no fluff",
  "memoryType": one of ${JSON.stringify(MEMORY_TYPES)},
  "tags": ["short", "tags"],
  "people": ["Full Names if known"],
  "insights": ["what changed / what this means"],
  "assumptions": ["explicit assumptions when info is missing"],
  "recommendations": [
    {
      "kind": "stakeholder_update|escalation|conversation|meeting|decision|risk|dependency|release|meeting_prep|leadership|assumption",
      "urgency": "now|today|this_week|watch",
      "title": "leadership move title",
      "action": "what the PM should do",
      "why": "why this matters",
      "leadershipImpact": "how this makes them look calm, prepared, proactive and trusted",
      "suggestedScript": "optional short script",
      "operation": "create|update|complete|remove|archive|delete",
      "itemType": "todo|milestone|knowledge|stakeholder|nudge|meeting|decision|risk|memory",
      "targetTitle": "optional exact title of an existing todo/meeting/stakeholder when updating/completing/removing"
    }
  ],
  "suggestedProjectId": "project id if clear, else null",
  "knowledgePatch": {
    "now": ["0-3 short bullets: what is newly true"],
    "decisions": ["0-2 short bullets: decisions / trade-offs only if stated"],
    "risks": ["0-3 short bullets: risks / blockers only if relevant"],
    "people": ["0-2 short bullets: stakeholder prefs/concerns only if relevant"],
    "openLoops": ["0-3 short bullets: waiting on / unconfirmed only if relevant"]
  },
  "timelinePatch": [
    {
      "label": "short milestone/meeting/deadline label",
      "type": "phase|milestone|meeting|deadline|submission",
      "startAt": "ISO date if explicitly stated or clearly implied",
      "endAt": "optional ISO end for phases",
      "notes": "optional short note"
    }
  ]
}`;

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
}> {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const promptAssembly = buildCapturePromptAssembly(args);
  logPromptAssemblyDiagnostic(promptAssembly);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
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
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty capture response");
  }

  return {
    ai: JSON.parse(content) as AiCapturePayload,
    promptAssembly,
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

  const recommendations: Recommendation[] = (
    args.ai.recommendations ?? []
  ).map((rec) => {
    const operation = parseSuggestionOp(
      rec.operation,
      rec.title || "recommendation",
    ) as SuggestionOp;
    const itemType = parseSuggestionKind(
      rec.itemType,
      "action",
      rec.title || "recommendation",
    ) as SuggestionKind;
    return {
      id: id("rec"),
      kind: rec.kind,
      urgency: rec.urgency,
      title: rec.title,
      action: rec.action,
      why: rec.why,
      leadershipImpact: rec.leadershipImpact,
      suggestedScript: rec.suggestedScript,
      projectId,
      relatedMemoryIds: [memoryId],
      createdAt: now,
      status: "active" as const,
      operation,
      itemType,
      targetTitle: rec.targetTitle,
    };
  });

  return {
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
    insights: [
      ...(args.ai.insights ?? []),
      "Tidied from raw capture with OpenAI.",
    ],
    assumptions: args.ai.assumptions ?? [],
    recommendations,
    rawContent: args.rawText,
    tidied: true,
    provider: "openai",
    knowledgePatch: args.ai.knowledgePatch,
    knowledgeProjectId: projectId,
    timelinePatch: args.ai.timelinePatch,
  };
}

export function localCaptureFallback(
  input: CaptureInput,
  state: MissionState,
): CaptureResult {
  const result = analyseCapture(input, state);
  const projectId = result.memory.projectId || input.projectId;
  return {
    ...result,
    rawContent: input.content,
    tidied: false,
    provider: "local",
    knowledgePatch: projectId
      ? extractKnowledgePatchFromText(input.content)
      : undefined,
    knowledgeProjectId: projectId,
    timelinePatch: projectId
      ? extractTimelinePatchFromText(input.content)
      : undefined,
  };
}
