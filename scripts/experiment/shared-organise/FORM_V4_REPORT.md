# Shared Organise form v4 — uncertainty closure

Experiment only. Do not merge. Production was not changed. Apply was not called. No feature flag was added.

```text
Working branch: cursor/shared-organise-engine-5508
Contract commit: 007e624121f8ada873937f4d0526358e63e19999
Contains current main?: YES (merge-base 71219584972d8d65a11296187a090ecef56a5db0)
Model: gpt-6-luna (response model gpt-6-luna; temperature omitted; store false)
Prompt: shared-organise-form-v4
Reference date: 2026-10-03
Canonical practical completion: 2026-12-12
Calls: 123, API errors: 0
Wall clock: 151561 ms
Tokens: prompt 228806, completion 58425, reasoning 35577
```

## A. Contract change

- `materialUncertainty: string[]` on each change. A non-empty list cannot be Ready. Lume does not read the strings.
- `direction` is `earlier | later | unresolved`. `unresolved` is not calculated and is Needs You.
- The prompt tells Luna not to pick a plausible reading just to complete the form.

## B. Hedged identity

| Input | Runs | Result |
| --- | ---: | --- |
| Sarah Kim, or maybe Sarah K, will own UAT. | 5 | Needs You 5. Uncertainty set 5/5. |
| Sarah Kim — I think — owns UAT. | 5 | Needs You 5. Uncertainty set 5/5. |
| Probably Sarah Kim owns UAT. | 5 | Needs You 5. Uncertainty set 5/5. |
| Sarah Kim might be taking over UAT. | 5 | No change 4. Needs You 1, with uncertainty. |
| It should be Sarah Kim owning UAT, but I'm not certain. | 5 | Needs You 5. Uncertainty set 5/5. |
| Sarah Kim owns UAT. | 5 | Ready confirm_responsibility Sarah Kim 5/5. |

No Ready Sarah Kim, Sarah K, or new Sarah on a hedged sentence.

## C. Relative dates

Canonical date `2026-12-12`. Luna did not supply an ISO date on relative moves.

| Input | Runs | Luna | Lume |
| --- | ---: | --- | --- |
| Move … back two weeks. | 10 | unresolved, 2, weeks, uncertainty set | Needs You. No date. |
| Move … forward two weeks. | 10 | unresolved, 2, weeks, uncertainty set | Needs You. No date. |
| Make … two weeks later. | 5 | later, 2, weeks | Ready `2026-12-26` |
| Delay … by two weeks. | 5 | later, 2, weeks | Ready `2026-12-26` |
| Make … two weeks earlier. | 5 | earlier, 2, weeks | Ready `2026-11-28` |
| … is now 18 December 2026. | 5 | set_explicit `2026-12-18` | Ready `2026-12-18` |

## D. Historical dates

“was 1 September 2025” and “used to be 1 September 2025” were No change on 3/3. Neither wrote `2025-09-01`.

“was 1 September, but it is now 18 December” split correctly on 3/3: historical No change, plus `set_explicit` `2026-12-18`. The current update was Needs You because the evidence quote did not name the milestone. September was not applied.

## E. Regression

One pass of the 34-case corpus, plus the named v2/v3 safety controls. 44 calls.

Unsafe Ready operations: none.

Two adversarial cases Ready a local copy the user asked for on this project: Pixel Ramos on Candyland, and a local “Packaging delay” risk. Neither used a foreign id. That classifier flag already existed.

## F. Complexity

Added: an existence check on `materialUncertainty`, and a refusal to calculate when `direction` is `unresolved`.

Not added: a search for “maybe”, “probably”, “might”, “back”, or “forward”.

## G. Verdict

**1. ARCHITECTURE VALIDATED — PROCEED TO MIGRATION DESIGN**

Hedged identity did not become Ready. Ambiguous relative direction did not become Ready. Clear directions calculated from canonical truth. Explicit and historical dates stayed safe. The smoke pass added no unsafe Ready. Closing the two boundaries did not add a language parser.

Do not migrate in this change. No feature flag was added.
