# Phase 19 — Specialist challenge vs untouched first run

Specialists returned **after** `lr-20260912T2212Z` was frozen and executed. Frozen `frozen-manifest.ts` is **not** rewritten. This file records the lead decision: which surprise probes were already in the 50, which first-run evidence confirmed them, and which belong on a later run.

Sources:

- [Historical weakness audit](bc-3a8f61b3-2702-5b34-bdb7-3d799129bf36)
- [Surprise weakness probes](bc-172232d1-9e56-56cb-9ab4-9d04ca05d4c9)

## Lead verdict

The specialists and the first-run evidence agree on the earliest remaining hosted family:

**Review looks Ready or empty → Apply / persist writes the wrong thing, nothing, or a leftover projection.**

C18 is the integrity instance (wrong-target Ready). C32–C50 are the omission instance (empty Review, SQL hash frozen after C30). D-030 leftover DDA Knowledge is the projection instance.

Do not treat the 6+6 suites as having covered this. They never accumulate.

## Surprise probes vs what actually ran

| # | Specialist probe | In frozen 50? | First-run evidence | Next run? |
| --- | --- | --- | --- | --- |
| 1 | Responsibility replace after months of share | C42 planned NY replace | Empty Review; 0 responsibility rows — Confirm Owner never appeared | **Yes** — only after creates rematerialize so ownership has a target |
| 2 | Waiting narrative → chased todo (D-008) | C40 / C50 intended | Snag lists never created; empty Review | **Yes** — seed a real waiting todo first |
| 3 | Contradictory sibling dates in one paste | C38 banquettes + dates | Empty Review; gate not hosted-proven | **Yes** — keep as a mid-lifecycle inject, not close-out |
| 4 | Stale Apply after manual KC date edit (D-034) | No | Not exercised | **Yes — highest miss** |
| 5 | Milestone “complete / cancel” (D-029) | C32, C50 | Empty Review, Saturday row still present — fail-closed write, **not** voiced Needs You | Already answered; next run must assert a NY **card**, not vacuous PASS |
| 6 | Person departure in prose | Partial (C6 person-update gap) | No cessation write; Mei not duplicated | Optional; product gap already fail-closed |
| 7 | Exclude speculative line, later “as agreed” | No sequential pair | C7 biscuits never proposed; C22 tape excluded and stayed out | **Yes** |
| 8 | New Capture transcript carryover (D-013) | Harness clicks New Capture | Compose-input wall on first attempt; not forensically asserted | **Yes** — assert old cards do not re-Apply |
| 9 | Two stakeholders, same recorded name | No | Chris Ward created once; no duplicate-name gate | **Yes** |
| 10 | Cross-project parked Review (D-047) | Sibling fingerprint only | Fingerprint unchanged; never switched mid-Review | **Yes — highest miss** |
| 11 | Risk resolve + leftover Knowledge (D-030) | C18 | SQL risk `resolved`; Knowledge body still `current` | Confirmed; keep as regression sentinel |
| 12 | Optimistic persist failure (D-005) | No | Not throttled | Forensic-only; do not manufacture unsafe traffic |

Historical-audit extras not in the frozen 50: interleaved Ocean edit before Apply (same as #4); Catch Me Up / Ask dual-truth read; context-limit observability on a *larger* world; project-delete mid-session (do not add — destructive, not needed after C18).

## What the first run already surprised us with

These were not in the specialist “must add” list as primary, and showed up anyway:

- False Needs You on **unscoped creates** (C5, C16) then a later Ready write against a *different* same-kind row (C18).
- Known full-name people rejected (`UUID not enough` / “not on this project”) — C8, C24.
- **Zero** `kind=responsibility` rows from Organise and Capture (D-051 class, stronger than Preview anecdotes).
- Late-cycle empty Review cluster (C31–C50) with SQL hash frozen — worse than “Needs You not voiced.”
- Updates of existing State 0 rows leave `history_events` but no `capture_apply_receipts`.

## Next-run candidates (do not fold into `longrun-v1`)

If a second production run is authorised, add a **small appendix** (not a rewritten first-run):

1. After a landed date create: edit that milestone in Knowledge Centre, then Apply the still-open Review (probe 4).
2. Analyse on the long-run project, switch Ocean to a leftover E2E sibling, return, Apply (probe 10).
3. Manually add a second “Chris Ward” (or a realistic duplicate) then Capture the first name only (probe 9).
4. Exclude a speculative ownership line; several captures later state it as agreed (probe 7).
5. Seed one waiting todo, later “chase by date” (probe 2).
6. Assert New Capture does not resurrect applied cards (probe 8).

Still forbidden: Harbour / Priya / void-keys language; inventing milestone delete success; SQL repair of the C18 DDA row.

## Integrity closed — still do not reopen as unfixed

D-045–D-048, D-R40–D-R45, holdout Family A/B, D-052 name recovery. First-run isolation and stable IDs behaved. The open work is C18 + rematerialize + responsibilities + empty Review, not those closed gates.
