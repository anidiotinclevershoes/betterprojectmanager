# Vercel AI SDK — test-only spike (Workstream B)

**Question:** Would Vercel AI SDK materially simplify provider-neutral benchmark transport?

**Verdict: reject for this workstream.** Do not adopt into production. Do not add the `ai` package.

## What the benchmark transport must preserve

- Exact provider / requested model / response model identity
- Provider usage payload (not guessed)
- Input / output / reasoning / cache tokens when the provider reports them
- Raw response text for diagnostics
- Structured-output reliability comparable to production V2 (`json_object`)
- Error classification
- Wall-clock latency

## What the SDK would add

`generateObject` / `generateText` can return `usage` (including `reasoningTokens`, `cachedInputTokens`, and in AI SDK 6 `usage.raw`) plus `response.modelId`. That is enough *in principle* for comparison telemetry.

It would not delete production plumbing: Capture V2 extract remains a direct OpenAI `chat/completions` fetch in `src/lib/capture-v2/extract.ts`. An eval-only SDK layer would be a second transport next to that fetch.

Provider-specific structured-output would still exist (OpenAI `response_format`, Anthropic message JSON, Gemini `responseMimeType`). The SDK wraps those; it does not remove them.

## Why reject now

1. **Abstraction without deletion.** Production V2 stays on raw fetch. Eval adapters are already thin (`src/lib/eval-capture-v2/adapters/`).
2. **Baseline lock.** Frozen V2 uses temperature 0.2 and `response_format: json_object`. `generateObject` would change the structured-output path relative to the frozen production call.
3. **Telemetry honesty.** Some SDK versions normalise usage fields. This programme forbids silently treating unavailable metrics as exact. Thin adapters copy provider fields or leave `null`.
4. **No intellectual prompting divergence.** The SDK makes it easy to attach provider-specific tools/examples. That is exactly what this workstream forbids.

Revisit only if a later architecture change moves **production** Capture extract onto a provider-neutral SDK *and* the freeze is deliberately revised.
