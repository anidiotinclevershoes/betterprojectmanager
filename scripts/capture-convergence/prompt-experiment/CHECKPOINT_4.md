# Checkpoint 4 — Recommendation

**Recommended production prompt: A (current).** Do not promote B, C, or D.

## Why keep A

Live holdout (10 frozen cases, `gpt-4o-mini-2024-07-18`, temperature 0.2) does **not** give a variant that is safer *and* executable.

| Floor | A | B | C | D |
| --- | --- | --- | --- | --- |
| Needs You not collapsed | 6 | **0 — fail** | 2 | 3 |
| Pronoun / ambiguity preserved | no (2 unsafe, Needs You still present) | no | **yes** | no (2 unsafe) |
| Invented / foreign target ids | 5 (worst) | 3 | 2 (on clear creates) | **0** |
| Clear new-person writes | 2 | 2 | **0** (ids invented, rejected) | 1 |
| Identity contamination | 0 | 0 | 0 | 0 |

- **B** weakens Needs You to zero and still fails the pronoun case. Disqualified.
- **C** is the only prompt that meets the ambiguity floor (the reason C was drafted). It also cleaned mixed-domain and cross-project id use versus A. It fails the create path: Nova/Remy survived as names but VALIDATE rejected invented `candidateTargetId`s. Promoting C would trade A’s foreign-id mess on updates for a new-person write black hole. That is not a safety win.
- **D** is the best id hygiene and the most writes. It does **not** fix unsafe pronoun resolution. Promoting D would optimise observation/write count — the opposite of this experiment’s preference.

Prefer slightly fewer cleaner observations over unsafe certainty. C is cleaner on pronouns; it is not cleaner on invented create ids. Neither C nor D should replace production A from this holdout alone.

Deterministic defects (identity contamination, NP name drop, contradictory writes) were already fixed on this line without a prompt change. Those floors stay in resolve/parse, not in a prompt swap.

## What a later prompt trial may take

If a follow-up prompt is written, start from **A** and steal only:

1. C’s reference discipline (do not bind `they`/`she`/`he` to a nearby full name; omit invented ids).
2. D’s “copy id only from current records; omit on create_new” behaviour.

Do not enlarge or retune `holdout.ts` to make a winner. Do not weaken Needs You or person-identity gates to raise write counts.

## Other evidence (unchanged / not reclaimed here)

**Frozen holdout:** `holdout.ts` — 10 cases, frozen `2026-09-11T23:30:00.000Z`.

**Hosted 6/6:** original on `origin/main` is 6/6. This live-eval slice did not re-run hosted verticals (no Preview URL / bypass / disposable account in this VM). Do not claim a new hosted 6/6.

**Second hosted holdout:** not available on current main.

**Live production Prompt A sample:** `LUME_CAPTURE_LIVE=1 npm run eval:capture-live` — provenance only, see `test-results/capture-live-held-out.json` when present.

Production `src/lib/capture-v2/prompt.ts` and `extract.ts` remain Prompt A.
