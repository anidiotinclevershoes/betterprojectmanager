/**
 * Thin Anthropic eval transport. Same intellectual prompt as OpenAI V2.
 * Structured-output syntax is Anthropic-specific; business rules are not.
 */

import { emptyUsage, missingKeyError, parseJsonObject, type ProviderAdapter } from "./types";

function anthropicKey(): string {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim();
}

export const anthropicEvalAdapter: ProviderAdapter = {
  provider: "anthropic",
  defaultModel: "claude-sonnet-4-5",
  envKeyName: "ANTHROPIC_API_KEY",
  async complete(request) {
    const key = anthropicKey();
    if (!key) throw missingKeyError("ANTHROPIC_API_KEY");
    const started = Date.now();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 4096,
        temperature: request.temperature,
        system: request.systemMessage,
        messages: [{ role: "user", content: request.userPrompt }],
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
        error: `Anthropic failed (${response.status}): ${detail.slice(0, 800)}`,
        latencyMs,
      };
    }
    const data = JSON.parse(detail) as {
      model?: string;
      content?: Array<{ type?: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    const content = (data.content ?? [])
      .map((part) => (part.type === "text" ? part.text ?? "" : ""))
      .join("\n");
    const usageRaw = data.usage ?? null;
    const input = usageRaw?.input_tokens ?? null;
    const output = usageRaw?.output_tokens ?? null;
    return {
      responseText: content,
      rawJson: parseJsonObject(content),
      responseModel: data.model ?? null,
      usage: {
        inputTokens: input,
        outputTokens: output,
        totalTokens:
          input != null && output != null ? input + output : null,
        reasoningTokens: null,
        cacheReadTokens: usageRaw?.cache_read_input_tokens ?? null,
        cacheWriteTokens: usageRaw?.cache_creation_input_tokens ?? null,
        raw: usageRaw,
      },
      retries: 0,
      error: content ? null : "Anthropic returned an empty observation response",
      latencyMs,
    };
  },
};
