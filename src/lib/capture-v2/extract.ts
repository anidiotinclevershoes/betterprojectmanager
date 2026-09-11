import { getOpenAIKey } from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import {
  buildObservationExtractionPrompt,
  CAPTURE_V2_EXTRACT_PATH,
  CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
  CAPTURE_V2_PROMPT_ID,
  CAPTURE_V2_PROMPT_VERSION,
} from "./prompt";
import { observationCountFromRaw } from "./provenance";

export type ObservationExtractionCall = {
  rawModelJson: unknown;
  responseText: string;
  /** Requested chat model id. */
  model: string;
  requestedModel: string;
  /** Provider-reported model id when present. */
  responseModel: string;
  provider: "openai";
  promptId: string;
  promptVersion: string;
  path: string;
  fallback: false;
  observationCount: number;
  providerUsage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
};

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

export async function extractObservationsWithOpenAI(args: {
  transcript: string;
  projectBlock: string;
}): Promise<ObservationExtractionCall> {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const requestedModel = resolveOpenAIChatModel();
  const prompt = buildObservationExtractionPrompt({
    transcript: args.transcript,
    projectBlock: args.projectBlock,
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: requestedModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI capture V2 failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty observation response");
  }

  const rawModelJson = parseJsonObject(content);
  const responseModel =
    typeof data.model === "string" && data.model.trim()
      ? data.model.trim()
      : requestedModel;

  return {
    rawModelJson,
    responseText: content,
    model: requestedModel,
    requestedModel,
    responseModel,
    provider: "openai",
    promptId: CAPTURE_V2_PROMPT_ID,
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    path: CAPTURE_V2_EXTRACT_PATH,
    fallback: false,
    observationCount: observationCountFromRaw(rawModelJson),
    providerUsage: data.usage ?? null,
  };
}
