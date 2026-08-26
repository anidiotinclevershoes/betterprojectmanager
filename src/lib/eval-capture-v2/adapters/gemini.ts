/**
 * Thin Gemini eval transport. Same intellectual prompt as OpenAI V2.
 * JSON MIME type is provider-specific syntax, not a Gemini-specific example set.
 */

import { emptyUsage, missingKeyError, parseJsonObject, type ProviderAdapter } from "./types";

function geminiKey(): string {
  return (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim();
}

export const geminiEvalAdapter: ProviderAdapter = {
  provider: "gemini",
  defaultModel: "gemini-2.0-flash",
  envKeyName: "GEMINI_API_KEY",
  async complete(request) {
    const key = geminiKey();
    if (!key) throw missingKeyError("GEMINI_API_KEY");
    const started = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemMessage }] },
        contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
        generationConfig: {
          temperature: request.temperature,
          responseMimeType: "application/json",
        },
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
        error: `Gemini failed (${response.status}): ${detail.slice(0, 800)}`,
        latencyMs,
      };
    }
    const data = JSON.parse(detail) as {
      modelVersion?: string;
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
        cachedContentTokenCount?: number;
        thoughtsTokenCount?: number;
      };
    };
    const content =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ??
      "";
    const usageRaw = data.usageMetadata ?? null;
    return {
      responseText: content,
      rawJson: parseJsonObject(content),
      responseModel: data.modelVersion ?? request.model,
      usage: {
        inputTokens: usageRaw?.promptTokenCount ?? null,
        outputTokens: usageRaw?.candidatesTokenCount ?? null,
        totalTokens: usageRaw?.totalTokenCount ?? null,
        reasoningTokens: usageRaw?.thoughtsTokenCount ?? null,
        cacheReadTokens: usageRaw?.cachedContentTokenCount ?? null,
        cacheWriteTokens: null,
        raw: usageRaw,
      },
      retries: 0,
      error: content ? null : "Gemini returned an empty observation response",
      latencyMs,
    };
  },
};
