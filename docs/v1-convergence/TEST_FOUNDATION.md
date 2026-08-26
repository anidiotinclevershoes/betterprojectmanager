# PLAIN-ENGLISH CHECKPOINT — FOR THE PRODUCT OWNER

Workstream B (Test, Regression & Model Evaluation Foundation) of Lume V1 Architectural Convergence.

This branch **adds tests and measuring instruments**. It does **not** change how Capture V2 thinks, writes, or looks in production.

---

## 1. What was built

- A frozen Capture V2 **benchmark corpus** (22 fictional Candyland cases).
- A **live eval harness** (`npm run eval:capture-v2`) that can call OpenAI, Anthropic, and Gemini with the **same** V2 prompt/schema.
- **Model metrics kept separate** (recall, false positives, domain, existing-vs-new, stable IDs, ambiguity, no-change, commentary, stability, cost). No single score.
- **Lume safety metrics** after the real V2 validate → resolve → Phase 3B plan path: MODEL FAILURE / LUME CATCH / LUME FAILURE.
- Narrow **fast-check** invariants (foreign IDs, malformed envelopes, Needs you never CREATE, etc.).
- A **small Playwright** foundation (7 frozen journeys: Person, Risk, date, availability, To Do, Needs you, isolation/reload).
- An existing-suite **inventory** (do not rewrite the 44 verify scripts).

## 2. What was deliberately not changed

Production V2 prompt, observation schema, resolver, Capture mutation behaviour, 3B planner, database schema, production UI, Magic Patterns, canonical truth, and production provider selection.

No prompt/resolver tuning from benchmark failures (none were available — live keys were not present in this environment).

## 3. Frozen baseline model / prompt / schema

| Item | Value |
| --- | --- |
| Programme SHA | `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4` |
| Default model | `gpt-4o-mini-2024-07-18` (`PINNED_OPENAI_CHAT_MODEL`) |
| Override | `OPENAI_MODEL` (alias `gpt-4o-mini` pins to snapshot). Capture V2 extract does **not** use `OPENAI_EVAL_MODEL`. |
| Flag | `LUME_CAPTURE_V2=1` / `true`; unset/`0` = legacy |
| Temperature | 0.2 |
| Structured output | OpenAI `response_format: json_object` |
| Reasoning | none |
| Schema | `CAPTURE_V2_OBSERVATION_SCHEMA` in `src/lib/capture-v2/prompt.ts` |
| Project context | `formatAuthoritativeStateForPrompt` — current project + `id=… domain=… title=…` records only |

Record: `src/lib/eval-capture-v2/baseline.ts`. If production prompt/schema/model drift, `verify-eval-capture-v2` fails.

## 4. Benchmark corpus summary

22 cases on Candyland, with Toyworld / GamingStudio5000 used as contamination bait. Fresh wording (no Niamh/CAB).

Includes: existing Person, new Person, same-first-name ambiguity, responsibility continue/replace, share-vs-replace, existing/new/resolved Risk, date move, unchanged date, To Do, availability, duplicate restatement, spoken correction, mixed domains, pronoun ambiguity, commentary, explicit no-change, cross-project bait, Toyworld bait, foreign-ID envelope (fixture-only).

## 5. New test tooling added and why

| Tool | Why |
| --- | --- |
| `tsx` + `node:assert` scripts | Stay on the existing runner for deterministic foundation tests |
| `fast-check` (narrow) | Infinite foreign-ID / malformed-envelope space; not a framework migration |
| Playwright Chromium | Small functional Capture → Review → board/KC journeys with **frozen** model JSON |
| Thin eval adapters | Provider-neutral contract; provider-specific JSON syntax only |

## 6. Existing test tooling retained

All existing `scripts/verify-*.ts` and `npm test` aggregation. Live Tell Me evals (`src/lib/evals/`) untouched. No vitest/jest migration.

## 7. Playwright status

Implemented: 7 frozen journeys in `e2e/capture-v2-journeys.spec.ts`. No visual screenshot regression. Optional live smoke is skipped unless `EVAL_CAPTURE_V2_LIVE_SMOKE=1` and `OPENAI_API_KEY` are set.

## 8. Property-testing status

Adopted **narrowly** in `scripts/verify-capture-v2-invariants.ts` only. Justification: fail-closed identity properties are cheaper as properties than as more one-off examples. Not applied to UI or legacy scripts.

## 9. Provider adapter status

Thin adapters for OpenAI (frozen V2 call shape + candidate model override), Anthropic, Gemini. Same prompt. Pricing table is a dated, editable metadata file — missing tokens ⇒ cost `null`, never a fake 0.

## 10. Live model runs actually completed

**None.** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` were unset in this environment. The harness was proven to **skip truthfully** (exit 2, “No results were invented”).

## 11. Model failures observed

Not applicable — no live model calls.

## 12. Lume catches observed

On **frozen/adversarial fixtures** (not live models):

- Foreign / invented IDs → rejected (Lume catch)
- Duplicate `create_new` of Pippa Gumdrop → no-change / Needs you (identity gate)
- Share vs replace ambiguous envelope → Needs you, never Apply Ready

## 13. Lume failures observed

None on the frozen fixtures. Live path not executed.

## 14. Token / cost / latency instrumentation

Adapters record requested vs response model, raw usage, input/output/reasoning/cache tokens when the provider reports them, latency, retries, and approximate USD from `src/lib/eval-capture-v2/pricing.ts`. Unavailable metrics stay `null`.

## 15. Vercel AI SDK spike verdict

**Reject** for this workstream. See `docs/v1-convergence/VERCEL_AI_SDK_SPIKE.md`. It would wrap transport without deleting production OpenAI fetch, and would risk drifting off the frozen `json_object` call.

## 16. Existing test debt discovered

See `docs/v1-convergence/TEST_DEBT.md`. 44 `verify-*.ts` scripts remain. Largest: `verify-phase3b-capture-boundary.ts` (~1431 lines). Duplicated world construction should converge on `src/lib/experiments/worlds.ts` for **new** tests only.

## 17. Cross-workstream dependencies

- Assumes Capture V2 + Phase 3B as on the frozen SHA. If Architecture changes observation semantics or 3B, this eval freeze must be **explicitly** revised — do not silently adapt.
- Playwright assumes Ocean project Capture/KC testids already present.
- Does not merge PR #66 or sibling PRs.

## 18. Tech debt created

- Eval adapters are a second (test-only) transport beside production extract.
- Playwright depends on committed JSON fixtures; regenerate with `npm run fixtures:e2e`.
- Price table will go stale; that is intentional and visible.
- fast-check is a new devDependency used in one script.

## 19. Exact files changed

See the pull request diff. Principal additions: `src/lib/eval-capture-v2/**`, `scripts/eval-capture-v2.ts`, `scripts/verify-eval-capture-v2.ts`, `scripts/verify-capture-v2-invariants.ts`, `e2e/**`, `playwright.config.ts`, `docs/v1-convergence/**`.

## 20. Test results

Filled after CI-equivalent local runs (typecheck, `npm test`, Playwright). Live eval: skipped, not faked.

## 21. Recommendation

**Changes first (do not merge).** Architecture PR is authority. This branch is executable evidence for the programme. Rebase only after architectural review, via the lead workflow.

Do not merge. Do not tune the AI from this report.
