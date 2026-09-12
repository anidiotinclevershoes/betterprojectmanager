# Checkpoint 5 — Prompt E vs A (live, 3 trials)

**Status:** Live A vs E on this VM. Holdout frozen. Production `src/lib/capture-v2/prompt.ts` unchanged (Prompt A).

**Run:** `2026-09-12T03:52:40.909Z`  
**Holdout frozen at:** `2026-09-11T23:30:00.000Z` (`holdout.ts`, 10 cases, not edited)  
**Model:** `gpt-4o-mini-2024-07-18` (pinned; `OPENAI_MODEL` unset)  
**Temperature:** `0.2`  
**Repeats:** 3 (every trial kept; no discarded/bad-run filter)  
**Machine record:** `scripts/capture-convergence/prompt-experiment/holdout-results-ae.json`

Prompt E = production A plus C’s reference discipline and D’s create-ID discipline. Called from the experiment runner only.

## Per-trial totals

| Trial | Variant | Recall | Invent | foreign_id | Pronoun | Writes | Needs You | Errors |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | A | 18/18 | 0 | 5 | 2 | 8 | 7 | 0 |
| 1 | E | 18/18 | 0 | **0** | 2 | 10 | 12 | 0 |
| 2 | A | 18/18 | 0 | 1 | 2 | 10 | 8 | 0 |
| 2 | E | 18/18 | 0 | **0** | 2 | 9 | 10 | 0 |
| 3 | A | 18/18 | 0 | 5 | 2 | 8 | 8 | 0 |
| 3 | E | 18/18 | 0 | **0** | 2 | 9 | 11 | 0 |

Create / update / name-only / ambiguity (all three trials): both A and E `create 1/1`, `update 2/2`, `name-only 2/2`, `ambiguity 0/1`. No parse errors. No 401/429/network failures.

## Cases

**E beats A (majority):**

- `held-mixed-people-dates-risk` — A invented/foreign ids on T1 and T3 (`fid=4`, 3 rejects, 1 write). E stayed `fid=0` with 2 writes every trial.
- `held-cross-project-mention` — A `fid=1` every trial; E `fid=0`. Same write (1).

**A beats E (majority):**

- `held-two-names-update` — same 0 writes / update-suitable; E adds a second Needs You every trial.
- `held-person-role-not-scope` — E is 0 writes + 3 Needs You every trial. A wrote once (T1) and always had fewer Needs You (1 / 2 / 1).

**Tie / no material winner:**

- `held-they-pronoun-two-people` — both `pronoun=2`, `ambig=false`, `writes=0`, `needs_you=2` all three trials. E did not move the frozen pronoun case.
- `held-two-new-people` — both `create=true`, 2 writes, 0 foreign ids (E did not invent create ids).
- `held-irrelevant-weather`, `held-fizz-and-pippa-independent` — identical.
- `held-unsupported-complete-todo` — E recovered 2 writes on T1 only; T2/T3 tie at 1 write.
- `held-busy-aurora-ops` — T1/T3 tie; T2 A had one extra write.

## New E failure modes

1. Reference addendum did not stop unsafe pronoun binding. Same 2 binds as A on the only ambiguity case.
2. Extra Needs You on already-named people (`held-two-names-update`, `held-person-role-not-scope`) without fixing the pronoun hold.
3. Lost the T1 Captain Buttons write; E never produced that write.

E’s real win is target-ID hygiene (`foreign_id=0` all trials), not reference handling.

## Promote E?

**No.** The rule was: E must materially improve reference handling, not invent create IDs, not increase false Needs You, not reduce safe executable Creates.

- Reference handling: not improved (pronoun case unchanged).
- Invent create IDs: no (Nova/Remy stay 2 executable creates).
- False Needs You: increased (7/8/8 → 12/10/11), mostly on named-person cases.
- Safe Creates: not reduced.

Keep production Prompt A. Do not edit `holdout.ts` or `src/lib/capture-v2/prompt.ts` from this result.
