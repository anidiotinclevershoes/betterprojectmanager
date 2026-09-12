# Phase 2 — 538-case corpus on holdout + convergence ports

Unchanged cases. `npm run verify:capture-convergence` at `dd655d8`.

| | n |
| --- | --- |
| Total | 538 |
| Pass | 534 |
| Fail | 4 |

Previous experiment-on-main (no holdout): 535/538.

## Families that previously failed and now pass

- Transcript-wide identity / sibling-name contamination — pass
- D-052 / name-only Person adapter drop — pass
- Contradiction sibling writes — pass
- Foreign-target / dated-create (holdout) — pass (held-out 39/39)

## Remaining failures

1. `id-pippa-first-on-candy` — first-name `no_change` now Needs You because holdout runs the person identity gate on `no_change`, and observation-local evidence is only “Pippa”. No write. Expect still says `no_change` (pre-holdout short-circuit). Not recoded.
2. `gap-cab-cancel-remove` — product-model: no cancel/remove milestone write
3. `gap-runbook-v3-retire-v2` — product-model: no knowledge supersede/retire
4. `gap-cab-as-knowledge` — product-model: cancel represented only as knowledge

Do not implement milestone cancellation or knowledge supersede here.
