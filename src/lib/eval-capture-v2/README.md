# Capture V2 evaluation foundation

Opt-in measuring instrument for Capture V2. **Do not train against these tests.** Production prompt, schema, resolver, and Phase 3B planner are not retuned from benchmark failures.

## Commands

```bash
npm test                          # existing regression + new deterministic foundation
npm run eval:capture-v2           # live providers (needs keys; never fakes success)
npm run eval:capture-v2-rescore              # historical comparison (does not overwrite committed v2 artifact)
npm run eval:capture-v2-scorer-v3-replay     # current-production replay through scorer v3
npm run eval:capture-v2 -- --provider all --runs 3
npm run test:e2e                  # isolated frozen journeys + stacked Playwright
npm run test:stacked-capture      # stacked Playwright only
npm run verify:stacked-capture    # sequential 3B path, no browser
npm run eval:stacked-capture      # live hook (skips; sequential live apply not in this slice)
```

Live harness env (server-only, never `NEXT_PUBLIC_`):

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

Optional: `--model <id>` for OpenAI candidates on the same key.

Missing keys: explicit skip, exit 2, no invented pass.

## Frozen baseline

See `src/lib/eval-capture-v2/baseline.ts`. Original eval-foundation freeze: SHA `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4`.

**Closed-alpha Capture freeze (28 August 2026):** qualified engine SHA `2131444c77c3b06b666df393362a50112d2de56f`, merged `main` `2e024d0bd04db87e7375a4c5b0106ccf4d4de31a` (PR #95). Live model `gpt-4o-mini-2024-07-18`, scorer **v3**, LUME FAILURE 0 / LUME CATCH 22. See `docs/v1-convergence/V09_QUALIFICATION.md` and `docs/LUME_V09_TO_V1_HANDOFF.md`. Historical scorer-v1 artifact rows are chronology, not current safety.

Corpus composition (`capture-v2-eval-corpus-v1-hulk`) was **finalised BEFORE any live provider result was seen**. 22 cases: Candyland remains the largest world; Toyworld and GamingStudio5000 each hold several genuine semantic cases (not bait-only). After the first live run, do not alter the semantic corpus in response to model output.

## Scorer versioning

Safety classification is versioned independently of corpus and prompt baseline:

| Kind | Identifier |
|---|---|
| Corpus | `capture-v2-eval-corpus-v1-hulk` |
| Baseline (prompt/schema/model freeze) | `capture-v2-eval-baseline-v1` |
| Scorer (current) | `capture-v2-eval-scorer-v3` |
| Scorer (v2) | `capture-v2-eval-scorer-v2` |
| Scorer (first live benchmark, implicit) | `capture-v2-eval-scorer-v1` |

Scorer v2 classifies CREATE-title prohibitions by the actual operation/domain, and evaluates unresolved-target CREATE per observation rather than against sibling facts in the same Capture. Historical v1 labels in the first-live artifact and Issue #73 stay as recorded.

Scorer v3 keeps those rules and additionally: (1) CREATE-title prohibitions match **asserted** durable text, not a prohibited token that appears only in a local denial; (2) extra-domain writes are LUME FAILURE only when they are not grounded in this observation's Capture evidence. Historical v1/v2 artifacts stay as recorded.

Offline rescore of those archived envelopes:

```bash
npm run eval:capture-v2-rescore
npm run eval:capture-v2-rescore -- --from /path/to/capture-v2-eval-evidence
npm run eval:capture-v2-scorer-v3-replay
```

No provider calls. The original GitHub artifact is not rewritten. Comparison output: `src/lib/eval-capture-v2/archive/first-live-rescore-scorer-v2.json` (immutable historical v2). Scorer v3 replay output: `src/lib/eval-capture-v2/archive/capture-v2-eval-scorer-v3-replay.json`.

Future dashboard runs distinguish scorer versions via the `scorerVersion` field on harness JSON / model rows. Dropping `capture-v2-eval-scorer-v3.json` into `test-results/` adds a new row; it does not replace historical v1 or v2 rows.
