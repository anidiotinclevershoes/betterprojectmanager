/**
 * GPT-6 Luna call for the Project Change Form.
 * Temperature is omitted: this model rejects a non-default temperature.
 */
import { getOpenAIKey, withOpenAiChatPrivacy } from "@/lib/openai";
import {
  SHARED_ORGANISE_SYSTEM_MESSAGE,
  SHARED_ORGANISE_PROMPT_VERSION,
  buildProjectChangePrompt,
} from "./prompt";

export const SHARED_ORGANISE_MODEL = "gpt-6-luna";
export const SHARED_ORGANISE_EXTRACT_PATH = "shared-organise/extractProjectChanges";

export type SharedOrganiseExtraction = {
  rawModelJson: unknown;
  responseText: string;
  requestedModel: string;
  responseModel: string;
  provider: "openai";
  promptId: string;
  promptVersion: string;
  path: string;
  fallback: false;
  changeCount: number;
  providerUsage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
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

export async function extractProjectChangesWithLuna(args: {
  transcript: string;
  projectBlock: string;
}): Promise<SharedOrganiseExtraction> {
  const key = getOpenAIKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const prompt = buildProjectChangePrompt({
    source: args.transcript,
    projectBlock: args.projectBlock,
  });
  const body = withOpenAiChatPrivacy({
    model: SHARED_ORGANISE_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SHARED_ORGANISE_SYSTEM_MESSAGE },
      { role: "user", content: prompt },
    ],
  });
  let lastError = "OpenAI shared organise failed";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.status === 429 || response.status >= 500) {
      const detail = await response.text();
      lastError = `OpenAI shared organise failed (${response.status}): ${detail.slice(0, 300)}`;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      continue;
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI shared organise failed (${response.status}): ${detail.slice(0, 500)}`);
    }
    const data = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("OpenAI returned an empty project-change response");
    const rawModelJson = parseJsonObject(content);
    const changes =
      rawModelJson &&
      typeof rawModelJson === "object" &&
      Array.isArray((rawModelJson as { changes?: unknown }).changes)
        ? (rawModelJson as { changes: unknown[] }).changes.length
        : 0;
    return {
      rawModelJson,
      responseText: content,
      requestedModel: SHARED_ORGANISE_MODEL,
      responseModel:
        typeof data.model === "string" && data.model.trim()
          ? data.model.trim()
          : SHARED_ORGANISE_MODEL,
      provider: "openai",
      promptId: "shared-organise-form",
      promptVersion: SHARED_ORGANISE_PROMPT_VERSION,
      path: SHARED_ORGANISE_EXTRACT_PATH,
      fallback: false,
      changeCount: changes,
      providerUsage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
            reasoning_tokens: data.usage.completion_tokens_details?.reasoning_tokens ?? 0,
          }
        : null,
    };
  }
  throw new Error(lastError);
}
