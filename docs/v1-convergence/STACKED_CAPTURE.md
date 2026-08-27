# Stacked Capture regression

Sequential Capture journeys against the **same evolving fictional project**. Frozen model envelopes, real V2 validate → resolve → Phase 3B Review/apply.

This does **not** replace product-owner UX judgement.

## What automation covers

Routine data-integrity confidence after architecture changes:

- Capture routing into the correct domain
- Safe mutation (Phase 3B)
- Persistence / reload parity
- Board / Knowledge Centre population
- Existing-vs-new identity (no duplicate People)
- Ambiguity fail-closed (Needs you, no silent write)
- Sequential updates that see earlier approved truth
- Project isolation

## What the product owner should still test manually

- UX clarity and cognitive load
- Trust and wording
- Whether Needs you feels understandable
- Visual polish / Magic Patterns feel
- Whether the review flow feels calm

See also: Deep stress journeys (`DEEP_STRESS.md`) — Harbourline Civic Archive, 50-event marathon, New Project brain-dump, PM handover. Separate from these three-world packs.


## Commands

```bash
npm test                          # includes verify:stacked-capture (in-memory sequential path)
npm run verify:stacked-capture    # node sequential 3B path only
STACKED_STORY=candyland npm run verify:stacked-capture

npm run test:e2e                  # isolated frozen journeys + stacked Playwright
npm run test:stacked-capture      # Playwright stacked packs only
STACKED_STORY=toyworld npm run test:stacked-capture

npm run eval:stacked-capture      # live hook — skips truthfully; sequential live apply is not in this slice
```

`--story candyland` is the env form `STACKED_STORY=candyland` so it fits existing npm scripts.

## GitHub

- PR / push to `main`: deterministic isolated Playwright, then stacked Playwright (no API keys).
- Actions → **Stacked Capture Regression** (`workflow_dispatch`): full deterministic stack + artifacts. Optional live hook still does not invent sequential live-apply results.

## Frozen 22-case corpus

Unchanged. Stacked packs **reuse** those transcripts/envelopes. Extra stacked-only envelopes (later Todo complete, later Person reuse) are not corpus cases and must not be used to retune the V2 prompt.
