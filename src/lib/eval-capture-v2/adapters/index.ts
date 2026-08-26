import type { EvalProviderId } from "../types";
import { openaiEvalAdapter } from "./openai";
import { anthropicEvalAdapter } from "./anthropic";
import { geminiEvalAdapter } from "./gemini";
import type { ProviderAdapter } from "./types";

const ADAPTERS: Record<EvalProviderId, ProviderAdapter> = {
  openai: openaiEvalAdapter,
  anthropic: anthropicEvalAdapter,
  gemini: geminiEvalAdapter,
};

export function getEvalAdapter(provider: EvalProviderId): ProviderAdapter {
  return ADAPTERS[provider];
}

export function adapterHasKey(provider: EvalProviderId): boolean {
  const name = ADAPTERS[provider].envKeyName;
  if (provider === "gemini") {
    return Boolean(
      (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim(),
    );
  }
  return Boolean((process.env[name] ?? "").trim());
}

export { openaiEvalAdapter, anthropicEvalAdapter, geminiEvalAdapter };
export type { ProviderAdapter, StructuredObservationRequest } from "./types";
