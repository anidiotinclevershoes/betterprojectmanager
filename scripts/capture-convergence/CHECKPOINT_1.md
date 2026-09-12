# Checkpoint 1 — Fresh unchanged baseline on current main

**Status:** Complete. Corpus and scoring unchanged. Production Capture unchanged.  
**Source SHA:** `90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b` (`origin/main`, hosted Slice 2 / PR #162)  
**Experiment SHA:** recorded in `baseline.md`  
**Hosted vertical floor:** 6/6 on `origin/main` (`e2e-hosted-vertical/baselines/pr-155-hv-slice2-20260911T220927Z.md`)

## Recovered harness

Ported observe-only from PR #156 / `experiment/capture-convergence-gate-cedc`. Not a wholesale merge.

| Layer | What it is |
| --- | --- |
| Catalogue | 35 historical behaviours (27 Capture, 8 New Project) locked as `historical_regression` |
| Generated | Seedable metamorphic / pair / order / identity-matrix / composition / duplication / contradiction / gap cases |
| Held-out | 39 realistic PM Captures in `held-out.ts` — process-isolated, still executed and labelled |
| Live | `LUME_CAPTURE_LIVE=1 npm run eval:capture-live` — opt-in OpenAI, never CI |

**534 vs 538:** first #156 commit was 534 cases / 9 fail. Second #156 commit added the D-052 New Project adapter trio plus one historical lock → **538 / 12 fail**. This recovery uses the latest unchanged corpus (538).

## Deterministic vs model-dependent

This gate is **deterministic**. Each case supplies a frozen `rawModelJson` envelope and runs Parse → Validate → Resolve → Plan → Review (or the New Project adapter). It does **not** call OpenAI. Live extract quality is a later prompt experiment.

## Pass/fail criteria (unchanged)

- Absolute expects: `decisionById`, `writeTypeById`, `reasonClassById`, field `preserve`, NP names / Needs You counts, contradiction locality (`needsYouLocal`)
- Relative expects: focus-atom equality vs `compareToId` (solo / unperturbed sibling)
- Earliest bad stage: PARSE → VALIDATE → PRESERVE → IDENTITY → PLANNER → REVIEW → WRITE_ELIGIBILITY
- Observe-only: runner exits 0 even with failures

## Fresh result (corpus unchanged)

| | Count |
| --- | --- |
| Total | 538 |
| Pass | 526 |
| Fail | 12 |
| Unique families | 6 |

Identical to the #156 map on `58b15c8`. Current main did not change these deterministic outcomes.

## Failure families (structural)

| Family | n | Stage | Bucket (Phase 2) | Notes |
| --- | --- | --- | --- | --- |
| Transcript-wide identity gate | 5 | IDENTITY | **B** deterministic | `identityEvidenceText` uses the whole Capture. Sibling names change Andris/Olga/Sarah bind/reasonClass |
| NP adapter drops schema-rejected people | 3 | PRESERVE | **B** deterministic | D-052. Unscoped Organise maps only VALIDATE-accepted rows |
| Contradictory sibling writes both Apply-eligible | 1 | PLANNER | **B** deterministic | Same risk open + resolved; no local Needs You |
| CAB cancel/remove | 1 | PLANNER | **C** product-model | No legal cancel/remove write |
| Runbook v3 retire v2 | 1 | PLANNER | **C** product-model | Create-another-fact, no retire/replace |
| Cancel-as-knowledge | 1 | PLANNER | **C** product-model | Cancelled date as knowledge leaves the date standing |

No A (extractor) or D (test-expectation) families on this **frozen-envelope** run. Extractor quality is out of scope until Phase 5.

Passing lock worth keeping: `hist-np-informal-name-only` — schema-valid name-only Bob/Mike survive Organise.
