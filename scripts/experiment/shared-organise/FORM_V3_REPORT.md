# Shared Organise form v3 — date contract

Experiment only. Do not merge. Production was not changed. Apply was not called.

```text
Working branch: cursor/shared-organise-engine-5508
Contract commit: 8ab1066f94b582068bb2039f25dfee36b8940772
Contains current main?: YES (merge-base 71219584972d8d65a11296187a090ecef56a5db0)
Model: gpt-6-luna (response model gpt-6-luna; temperature omitted; store false)
Prompt: shared-organise-form-v3
Reference date: 2026-10-03
Canonical practical completion in the date world: 2026-12-12
Corpus: 120 cases, 500 calls, 0 API errors
Wall clock: 597022 ms
Tokens: prompt 842078, completion 221920, reasoning 139657
```

Safety-critical cases ran 5 times. Ordinary cases ran 3 times. The v2 corpus was rerun with its previous expectations left as they were.

## A. Date contract

`values.dateIntent` is `set_explicit`, `move_relative`, `historical`, or `uncertain`.

- `set_explicit`: Luna supplies the civil ISO date. Lume accepts it when the month and day in that ISO are the month and day written in the evidence. A stated year must match. If the year is absent, the only accepted year is the next occurrence of that month and day on or after the reference date.
- `move_relative`: Luna supplies `direction` (`earlier` or `later`), `amount`, and `unit` (`days` or `weeks`). Lume adds or subtracts that many days from the canonical milestone date. Any ISO date on the same change is ignored.
- `historical`: No change. It cannot become a Ready current milestone write.
- `uncertain`, or a milestone date with no intent: Needs You.
- A relative move with no canonical date: Needs You.

Lume does not read “was”, “back”, “forward”, or “delay”.

## B. Targeted date results

| Group | Runs | Ready | Needs You | No change | Unsafe Ready runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Explicit, year stated | 15 | 15 | 0 | 0 | 0 |
| Explicit, month and day only | 15 | 15 | 0 | 0 | 0 |
| Historical | 40 | 0 | 0 | 40 | 0 |
| Relative later | 20 | 20 | 0 | 0 | 1 |
| Relative earlier | 15 | 15 | 0 | 0 | 4 |
| Ambiguous | 25 | 0 | 20 | 5 | 0 |
| No canonical baseline | 5 | 0 | 5 | 0 | 0 |
| Mixed | 15 | 21 | 9 | 10 | 0 |

Every explicit case, including “18 December” without a year, was Ready `2026-12-18`.

Every historical case was No change. None wrote `2025-09-01`.

“Practical completion was 1 September, but it is now 18 December.” Luna split this correctly on 5/5: historical, plus `set_explicit` `2026-12-18`. The current update was Needs You on 5/5 because the evidence quote was “it is now 18 December.” and did not name the milestone. The September date was not applied.

The longer mixed note kept Sarah’s UAT responsibility and the fire-cert to-do on 5/5, kept September off the milestone on 5/5, and applied 18 December on 2/5. The other three quotes again omitted the milestone title. No Person named Someone.

## C. Unsafe Ready

Six runs.

1. “Move practical completion back two weeks.” Run 5. Luna said `earlier` / 2 / weeks. Lume calculated `2026-11-28`. The other four runs said `later` and calculated `2026-12-26`.
2. “Move practical completion forward two weeks.” Runs 1, 2, 3, and 5. Luna said `later` / 2 / weeks. Lume calculated `2026-12-26`. Run 4 said `earlier` and calculated `2026-11-28`.
3. “Sarah Kim, or maybe Sarah K, will own UAT.” Run 3 of the regression case. Ready `confirm_responsibility` for Sarah Kim, scope “Own UAT”. The other four runs were Needs You.

No historical sentence produced an unsafe Ready current-date write.

## D. Relative arithmetic

Canonical date `2026-12-12`. Luna did not supply the ISO date. Lume did.

| Input | Luna | Lume |
| --- | --- | --- |
| Move … back two weeks | later, 2, weeks on 4/5; earlier on 1/5 | `2026-12-26`; `2026-11-28` |
| Push … back two weeks | later, 2, weeks on 5/5 | `2026-12-26` |
| Delay … by two weeks | later, 2, weeks on 5/5 | `2026-12-26` |
| Move … later by two weeks | later, 2, weeks on 5/5 | `2026-12-26` |
| Bring … forward two weeks | earlier, 2, weeks on 5/5 | `2026-11-28` |
| Move … forward two weeks | later on 4/5; earlier on 1/5 | `2026-12-26`; `2026-11-28` |
| Pull … in by two weeks | earlier, 2, weeks on 5/5 | `2026-11-28` |

Push, delay, move later, bring forward, and pull in did not disagree with themselves. “Back” missed once. “Move forward” was not stable.

No baseline: 5/5 Needs You. On three of those runs Luna still proposed `move_relative` / later / 2 / weeks, and the validator refused to invent a date.

## E. Regression

Three full passes of the previous 34 cases:

| Pass | Ready | Needs You | Left untouched | No change |
| --- | ---: | ---: | ---: | ---: |
| Form v2 run 1–3 | 42–44 | 12–14 | 1 | 6 |
| Form v3 run 1 | 44 | 12 | 1 | 5 |
| Form v3 run 2 | 40 | 14 | 2 | 6 |
| Form v3 run 3 | 43 | 13 | 1 | 5 |

The v2 historical case is No change on 5/5. The v2 “back two weeks” case is Ready `2026-12-26` on 3/3. The old scorer still hoped for `2026-11-28`, so it marks omission. That hope was a lexical reading of “back”. It was not rewritten.

Generic-person to-dos, Sarah K, two Sarahs, pronouns, knowledge authority, foreign and context-only ids, corrections, negation, and hypotheticals did not produce an unsafe Ready. The one identity leak is the hedged Sarah Kim / Sarah K case above, 1 of 5.

Role and responsibility behaviour was not retuned. “Handles valuations” and the QS split were in this rerun and did not add an unsafe Ready.

## F. Complexity

Added in the experiment only:

- A four-value date intent.
- Day arithmetic: canonical date plus or minus 7 days per week, using the direction Luna named.
- A check that a proposed explicit ISO uses the month and day written in the evidence, and either the stated year or the next occurrence after the reference date.
- Historical, uncertain, missing intent, and a missing canonical date cannot become a Ready current milestone date.

Not added: a tense list, a “back means later” rule, or a correction when Luna’s direction looks surprising.

## G. Verdict

**2. ONE BOUNDED ISSUE REMAINS**

The v2 historical-date hole is closed: 40 of 40 former-date runs made no current milestone write. Explicit dates, including a missing year resolved as the next occurrence, were stable. Relative dates are calculated by Lume from canonical truth. A missing baseline does not become an invented Ready date. The clarification rate on the 34-case corpus stayed in the same band as form v2.

The remaining issue is relative direction. Lume will Ready whichever direction Luna names. “Move back” was later on 4 of 5 runs and earlier on 1. “Move forward” was later on 4 and earlier on 1. Those wrong or unstable directions survived as Ready. Closing that in Lume would mean reading the wording, which this contract does not do.

One regression run also Ready-bound “Sarah Kim, or maybe Sarah K” to Sarah Kim. That is the existing identity boundary, not a new date class. It is listed because the unsafe-Ready count is not zero.

Do not migrate yet. No feature flag was added.
