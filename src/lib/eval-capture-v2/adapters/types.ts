import type { EvalProviderId, TokenUsageRecord } from "../types";

export type StructuredObservationRequest = {
  systemMessage: string;
  userPrompt: string;
  model: string;
  temperature: number;
};

export type ProviderAdapter = {
  provider: EvalProviderId;
  defaultModel: string;
  envKeyName: string;
  complete: (
    request: StructuredObservationRequest,
  ) => Promise<{
    responseText: string;
    rawJson: unknown;
    responseModel: string | null;
    usage: TokenUsageRecord;
    retries: number;
    error: string | null;
    latencyMs: number;
  }>;
};

export function parseJsonObject(text: string): unknown {
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

export function emptyUsage(raw: unknown = null): TokenUsageRecord {
  return {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    reasoningTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    raw,
  };
}

export function missingKeyError(envName: string): Error {
  return new Error(
    `Live Capture V2 eval skipped: ${envName} is not configured. No results were invented.`,
  );
}
