/**
 * Thin OpenAI eval transport. Same prompt/schema/temperature as production V2.
 * Candidate models may be passed through the same key; this is not product selection.
 */

import { PINNED_OPENAI_CHAT_MODEL } from "@/lib/openai-model";
import { getOpenAIKey } from "@/lib/openai";
import { FROZEN_RESPONSE_FORMAT, FROZEN_TEMPERATURE } from "../baseline";
import {
  emptyUsage,
  missingKeyError,
  parseJsonObject,
  type ProviderAdapter,
} from "./types";

export const openaiEvalAdapter: ProviderAdapter = {
  provider: "openai",
  defaultModel: PINNED_OPENAI_CHAT_MODEL,
  envKeyName: "OPENAI_API_KEY",
  async complete(request) {
    const key = getOpenAIKey();
    if (!key) throw missingKeyError("OPENAI_API_KEY");
    const started = Date.now();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        temperature: request.temperature ?? FROZEN_TEMPERATURE,
        response_format: FROZEN_RESPONSE_FORMAT,
        messages: [
          { role: "system", content: request.systemMessage },
          { role: "user", content: request.userPrompt },
        ],
      }),
    });
    const latencyMs = Date.now() - started;
    const detail = await response.text();
    if (!response.ok) {
      return {
        responseText: "",
        rawJson: null,
        responseModel: null,
        usage: emptyUsage(null),
        retries: 0,
        error: `OpenAI failed (${response.status}): ${detail.slice(0, 800)}`,
        latencyMs,
      };
    }
    const data = JSON.parse(detail) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
        prompt_tokens_details?: { cached_tokens?: number };
      };
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const usageRaw = data.usage ?? null;
    return {
      responseText: content,
      rawJson: parseJsonObject(content),
      responseModel: data.model ?? null,
      usage: {
        inputTokens: usageRaw?.prompt_tokens ?? null,
        outputTokens: usageRaw?.completion_tokens ?? null,
        totalTokens: usageRaw?.total_tokens ?? null,
        reasoningTokens: usageRaw?.completion_tokens_details?.reasoning_tokens ?? null,
        cacheReadTokens: usageRaw?.prompt_tokens_details?.cached_tokens ?? null,
        cacheWriteTokens: null,
        raw: usageRaw,
      },
      retries: 0,
      error: content ? null : "OpenAI returned an empty observation response",
      latencyMs,
    };
  },
};
