# Capture V2 evaluation foundation

Opt-in measuring instrument for Capture V2. **Do not train against these tests.** Production prompt, schema, resolver, and Phase 3B planner are not retuned from benchmark failures.

## Commands

```bash
npm test                          # existing regression + new deterministic foundation
npm run eval:capture-v2           # live providers (needs keys; never fakes success)
npm run eval:capture-v2 -- --provider all --runs 3
npm run test:e2e                  # Playwright frozen journeys (no API keys)
```

Live harness env (server-only, never `NEXT_PUBLIC_`):

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

Optional: `--model <id>` for OpenAI candidates on the same key.

Missing keys: explicit skip, exit 2, no invented pass.

## Frozen baseline

See `src/lib/eval-capture-v2/baseline.ts`. Frozen against SHA `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4`.
