import { COACHING_SYSTEM_PROMPT, MEMORY_TYPES } from "./mission";
import type {
  CaptureInput,
  CaptureResult,
  MissionState,
  Project,
  Recommendation,
  RecommendationKind,
  RecommendationUrgency,
} from "./types";
import { analyseCapture } from "./coach";

export function getOpenAIKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

export function isOpenAIConfigured() {
  return Boolean(getOpenAIKey());
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
  }>;
  suggestedProjectId?: string | null;
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
      "suggestedScript": "optional short script"
    }
  ],
  "suggestedProjectId": "project id if clear, else null"
}`;

export async function tidyAndCoachWithOpenAI(args: {
  rawText: string;
  projectId?: string;
  sourceType?: CaptureInput["sourceType"];
  projects: Project[];
}): Promise<AiCapturePayload> {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const projectContext = args.projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    status: p.status,
    currentFocus: p.currentFocus,
    stakeholders: p.stakeholders.map((s) => `${s.name} (${s.role})`),
  }));

  const userPrompt = `The user captured a raw note (possibly a voice ramble). Tidy it into institutional memory and produce proactive coaching recommendations.

Source type: ${args.sourceType ?? "note"}
Preferred project id (may be empty): ${args.projectId ?? ""}
Projects:
${JSON.stringify(projectContext, null, 2)}

Raw capture:
"""
${args.rawText}
"""

Return ONLY valid JSON matching this shape:
${CAPTURE_JSON_SCHEMA_HINT}

Rules:
- Preserve all factual content; do not invent meetings, dates or approvals.
- If uncertain, put uncertainty in assumptions.
- Produce 1–4 high-signal recommendations, not a task dump.
- Prefer leadership moves over administrative chores.`;

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
        { role: "user", content: userPrompt },
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

  return JSON.parse(content) as AiCapturePayload;
}

export async function transcribeWithWhisper(file: File | Blob, filename: string) {
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
  const memoryType = (MEMORY_TYPES as readonly string[]).includes(args.ai.memoryType)
    ? (args.ai.memoryType as CaptureResult["memory"]["type"])
    : args.sourceType === "voice_note"
      ? "voice_note"
      : "conversation";

  const memoryId = id("mem");
  const now = new Date().toISOString();

  const recommendations: Recommendation[] = (args.ai.recommendations ?? []).map(
    (rec) => ({
      id: id("rec"),
      kind: rec.kind,
      urgency: rec.urgency,
      title: rec.title,
      action: rec.action,
      why: rec.why,
      leadershipImpact: rec.leadershipImpact,
      suggestedScript: rec.suggestedScript,
      projectId: args.ai.suggestedProjectId || args.projectId || undefined,
      relatedMemoryIds: [memoryId],
      createdAt: now,
      status: "active",
    }),
  );

  return {
    memory: {
      id: memoryId,
      type: memoryType,
      projectId: args.ai.suggestedProjectId || args.projectId || undefined,
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
  };
}

export function localCaptureFallback(
  input: CaptureInput,
  state: MissionState,
): CaptureResult {
  const result = analyseCapture(input, state);
  return {
    ...result,
    rawContent: input.content,
    tidied: false,
    provider: "local",
  };
}
