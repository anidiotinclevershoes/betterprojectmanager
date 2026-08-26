/**
 * Explicit, dated benchmark price metadata.
 * Update this file when provider prices change. Do not silently invent prices.
 *
 * Units: USD per 1 million tokens. Approximate; not a billing invoice.
 * Source snapshot: public list prices as of 2026-08-26 (manual record).
 */

export type BenchmarkPrice = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cachedInputUsdPerMillion?: number;
  notes?: string;
};

export const BENCHMARK_PRICE_TABLE_VERSION = "2026-08-26";

export const BENCHMARK_PRICES_USD: Record<string, BenchmarkPrice> = {
  "gpt-4o-mini-2024-07-18": {
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
    notes: "OpenAI gpt-4o-mini snapshot list price at freeze.",
  },
  "gpt-4o-mini": {
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
    notes: "Floating alias; same family as the pinned snapshot.",
  },
  "gpt-4.1-mini": {
    inputUsdPerMillion: 0.4,
    outputUsdPerMillion: 1.6,
    notes: "Challenger candidate — update if OpenAI revises.",
  },
  "claude-sonnet-4-5": {
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    notes: "Anthropic Sonnet 4.5 public list at freeze.",
  },
  "claude-3-5-sonnet-latest": {
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
  },
  "gemini-2.0-flash": {
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
    notes: "Gemini 2.0 Flash approximate public list at freeze.",
  },
};

export function lookupBenchmarkPrice(model: string): BenchmarkPrice | null {
  if (BENCHMARK_PRICES_USD[model]) return BENCHMARK_PRICES_USD[model];
  const stem = model.split("-").slice(0, 4).join("-");
  return BENCHMARK_PRICES_USD[stem] ?? null;
}

export function approximateCostUsd(args: {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens?: number | null;
}): { usd: number | null; note: string } {
  const price = lookupBenchmarkPrice(args.model);
  if (!price) {
    return {
      usd: null,
      note: `No benchmark price metadata for ${args.model}; cost not estimated.`,
    };
  }
  if (args.inputTokens == null || args.outputTokens == null) {
    return {
      usd: null,
      note: "Token counts unavailable; cost not estimated as if exact.",
    };
  }
  const cached = args.cacheReadTokens ?? 0;
  const uncachedInput = Math.max(0, args.inputTokens - cached);
  const cachedRate = price.cachedInputUsdPerMillion ?? price.inputUsdPerMillion;
  const usd =
    (uncachedInput / 1_000_000) * price.inputUsdPerMillion +
    (cached / 1_000_000) * cachedRate +
    (args.outputTokens / 1_000_000) * price.outputUsdPerMillion;
  return {
    usd,
    note: `Approximate using ${BENCHMARK_PRICE_TABLE_VERSION} table for ${args.model}.`,
  };
}
