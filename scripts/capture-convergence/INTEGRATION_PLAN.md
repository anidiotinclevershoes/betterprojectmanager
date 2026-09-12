# Minimal integration plan

Do **not** merge `cursor/capture-convergence-finalise-30ae` or `cursor/experiment-capture-convergence-30ae` wholesale.

`origin/main` (`90dfb6c`) still lacks PR #164. Final product merge waits until holdout is on `main`, then cherry-pick only the production slice.

## A. Production deterministic fixes

Cherry-pick after #164 merges:

- Commit `4553def` — Port non-overlapping Capture convergence fixes onto holdout baseline

Files:

- `src/lib/capture-v2/resolve.ts` — observation-local identity + contradictory sibling Needs You only. Keep holdout rematerialize / ownership / no_change identity gate.
- `src/lib/new-project-v2/parse.ts` — D-052 name-only Person recovery from VALIDATE rejects
- `scripts/verify-person-identity-safety.ts`
- `scripts/verify-capture-v2-invariants.ts`
- `scripts/verify-np-organise-observation-loss.ts`
- `scripts/verify-capture-intelligence-diagnostic.ts`
- `scripts/run-regression-suite.ts` (add np-organise)
- `package.json` (`verify:np-organise-observation-loss`)
- `docs/LUME_V1_KNOWN_DISCOVERIES.md` (D-052 + identity note)

Follow-up type/test-only if needed: D-052 test alignment that holdout rematerializes `create_new` foreign ids (from `54d614d`, only the `verify-np-organise-observation-loss.ts` hunk).

## B. Prompt change

**Keep Prompt A.** Prompt E is experiment-only until a live A vs E holdout shows a clear net win.

- Production: `src/lib/capture-v2/prompt.ts` — do not change
- Experiment: `scripts/capture-convergence/prompt-experiment/prompts.ts` (`buildPromptE`)

## C. Permanent regression tests

Keep with A:

- person-identity-safety (observation-local)
- capture-v2-invariants (contradiction siblings)
- np-organise-observation-loss (D-052 + holdout create rematerialize)
- intelligence-diagnostic lock update (Andris incomplete-name)

## D. Experiment-only — exclude from product merge

- `scripts/capture-convergence/**` (538 corpus, generators, checkpoints, RECONCILE, INTEGRATION_PLAN)
- `scripts/verify-capture-convergence.ts`
- `scripts/eval-capture-live.ts`
- `docs/CAPTURE_CONVERGENCE_GATE.md`
- `docs/README.md` convergence pointer
- package.json scripts: `verify:capture-convergence`, `verify:capture-convergence:smoke`, `eval:capture-live`, `eval:capture-prompt-holdout`

## Floor after product cherry-pick

- Original hosted six: 6/6 on this reconstruction Preview
- Independent holdout six: 6/6 on this reconstruction Preview
- Deterministic corpus: 534/538 on this reconstruction (3 product-model gaps + first-name `no_change` → Needs You from holdout identity gate)
- `npm test` 82/82
- `npm run typecheck` pass
