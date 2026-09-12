# Checkpoint 5 — Prompt A vs Prompt E

**Recommended production prompt: A (current).** Do not promote E.

**Baseline:** `origin/main` `91fabf8d1627e89538f26e00b9b3343b9d577cdb`  
**Experiment SHA:** `4fe7a4e138210e666852f81ea5f88d93f3343e94`  
**Holdout frozen at:** `2026-09-11T23:30:00.000Z` (unchanged)  
**Model:** `gpt-4o-mini-2024-07-18`  
**Temperature:** `0.2`  
**Trials:** A × 3, E × 3 (all generations kept)  
**API key:** present. No 401/429/network failures.  
**Machine record:** `holdout-results-ae.json`

## Aggregates (30 scored cases each = 10 × 3)

| Floor | A | E |
| --- | ---: | ---: |
| Recall | 54/54 | 54/54 |
| Inventions | 0 | 0 |
| Identity contamination | 0 | 0 |
| Wrong attachment | 0 | 0 |
| Foreign / invented IDs | **15** | **1** |
| Unsafe pronoun binds | 6 | 6 |
| Ambiguity preserved | 0/3 | 0/3 |
| Create suitable | 3/3 | 3/3 |
| Update suitable | 6/6 | 6/6 |
| Name-only survived | 6/6 | 6/6 |
| Writes | 24 | 28 |
| Needs You | **22** | **28** |
| Parse / errors | 0 | 0 |

## Why E does not earn production

E must particularly improve unresolved pronoun/reference behaviour without a material new failure mode.

- Pronoun case `held-they-pronoun-two-people`: **2 unsafe binds and `ambiguityPreserved=false` on every A trial and every E trial.** E did not fix the reason it was written.
- Needs You rose from 22 to 28. Material inflation on `held-person-role-not-scope` (2→3) and `held-mixed-people-dates-risk` (0→1).
- ID hygiene improved (15→1) and Creates/name-only stayed intact. That is not enough. The incumbent stays A when pronoun behaviour is unchanged and Needs You rises.

Decision rule: mixed or no pronoun improvement → **RETAIN A**. Hosted Prompt E proof was not run.

Production `src/lib/capture-v2/prompt.ts` remains Prompt A.
