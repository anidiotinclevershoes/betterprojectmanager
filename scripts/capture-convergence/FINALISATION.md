# Capture convergence finalisation (reconstruction)

Not a wholesale merge. Holdout PR #164 was still open when this was built.

## 1. latest origin/main SHA

`90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b` (PR #162). Unchanged.

## 2. convergence integration branch / SHA

`cursor/capture-convergence-finalise-30ae` — see branch HEAD. PR #165 (draft).

Base: holdout `b354f6a` (contains current main).

## 3. overlap with independent holdout

Holdout owns: dated-create rematerialize, foreign-target create accept, ambiguous ownership Needs You, persist-before-hydrate, `hydrated` gate, hosted holdout harness.

Convergence still needed: observation-local identity, contradiction sibling Needs You, D-052 parse recovery.

`resolve.ts` was composed, not ff-merged. Holdout `no_change` identity gate + local evidence makes first-name-only Pippa Needs You (no write).

## 4. fresh 538-case result

534 pass / 4 fail / 538.

## 5. remaining failure families

- identity_matrix: `id-pippa-first-on-candy` (expect `no_change`, actual `needs_you`)
- product_model_gap × 3

## 6. confirmed product-model gaps

- milestone cancellation/removal (`gap-cab-cancel-remove`)
- knowledge supersede/retire (`gap-runbook-v3-retire-v2`)
- cancellation represented only as knowledge (`gap-cab-as-knowledge`)

Not implemented in this task.

## 7–12. Prompt A vs E live

Frozen 10-case holdout, `gpt-4o-mini-2024-07-18`, temperature `0.2`, **3 trials**, no discarded runs. Record: `prompt-experiment/CHECKPOINT_5.md`.

Median-ish last-trial totals (trial 3 also in table):

| Trial | A recall | A fid | A pronoun | A writes | A Needs You | E recall | E fid | E pronoun | E writes | E Needs You |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 18/18 | 5 | 2 | 8 | 7 | 18/18 | 0 | 2 | 10 | 12 |
| 2 | 18/18 | 1 | 2 | 10 | 8 | 18/18 | 0 | 2 | 9 | 10 |
| 3 | 18/18 | 5 | 2 | 8 | 8 | 18/18 | 0 | 2 | 9 | 11 |

- **E beats A:** mixed-domain foreign ids; cross-project mention ids (`fid=0` every trial).
- **A beats E:** extra Needs You on named-person cases; E never wrote Captain Buttons on T1.
- **New E modes:** pronoun case unchanged (`unsafe=2`); more false Needs You; ID hygiene only.
- Errors: 0/0/0 both variants.

## 13. recommended production prompt

**Prompt A.** E fails the promote rule (reference handling not improved; Needs You up).

## 14–15. hosted

Run on this PR Preview with production Prompt A (E not in `prompt.ts`):

- Original hosted six: **6/6** (`hosted-finalise/original-six.md`)
- Independent holdout six: **6/6** (`hosted-finalise/holdout-six.md`)

## 16. npm test

82/82

## 17. typecheck

pass

## 18. production commits/files to merge

After #164: cherry-pick `4553def` (and D-052 test alignment hunk if needed). Files listed in `INTEGRATION_PLAN.md` §A/C.

## 19. experiment-only excluded

`scripts/capture-convergence/**`, `scripts/verify-capture-convergence.ts`, `scripts/eval-capture-live.ts`, `docs/CAPTURE_CONVERGENCE_GATE.md`, prompt-experiment runner, 538 corpus.

## 20. Product Owner

Capture routing is converged enough for V1 on frozen envelopes plus holdout structural rules. Prompt E does not yet earn production. Remaining misses are product-model verbs, not silent wrong writes.
