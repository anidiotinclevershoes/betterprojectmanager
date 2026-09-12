# Capture convergence gate

Diagnostic map of Capture analysis / resolution / planning. **Not a product fix.** **Not part of `npm test`.**

Recovered from PR #156 / `experiment/capture-convergence-gate-cedc` onto current `main` (`90dfb6c`). Production Capture files are unchanged. Do not merge #156 wholesale.

Do not retune prompts, validation, identity, planner, or Review to make this suite green.

Prior #156 map (538 cases on `58b15c8`): `prior-pr156-baseline.md`. Fresh current-main map: `baseline.md`.

## Commands

```bash
npm run verify:capture-convergence
npx tsx scripts/verify-capture-convergence.ts --id cross-andris-olga-uat
npx tsx scripts/verify-capture-convergence.ts --family identity_matrix
npx tsx scripts/verify-capture-convergence.ts --smoke          # historical locks only
npx tsx scripts/verify-capture-convergence.ts --held-out-only
npx tsx scripts/verify-capture-convergence.ts --no-held-out
npx tsx scripts/verify-capture-convergence.ts --list
```

Observe-only: the runner **exits 0** even when cases fail. `--fail-on-error` exits 1 (not for ordinary CI).

Optional live OpenAI sample (never CI, never automatic):

```bash
LUME_CAPTURE_LIVE=1 npm run eval:capture-live
```

Requires `OPENAI_API_KEY`. Uses the current production extract prompt/model unchanged. Writes provenance only (no raw transcripts, no secrets) to `test-results/capture-live-held-out.json`.

## CI recommendation

| Job | What | Why |
| --- | --- | --- |
| Ordinary local / `npm test` | **Do not include** this suite | Hundreds of generated cases; failures are currently expected |
| Optional smoke | `npm run verify:capture-convergence:smoke` | Historical frozen locks only; still observe-only |
| Heavy convergence job | `npm run verify:capture-convergence` | Full diagnostic map after Capture-adjacent changes |
| Live eval | `LUME_CAPTURE_LIVE=1 npm run eval:capture-live` | Human/opt-in only |

Do not add `verify:capture-convergence` to `scripts/run-regression-suite.ts`.

## Held-out set

`held-out.ts` is a locked out-of-sample corpus (~30–50 realistic PM Captures).

**Do not tune against the held-out set until evaluation.**

That is process isolation, not cryptographic secrecy. The deterministic runner still executes it and records a baseline, clearly labelled `family=held_out`.

## What this does not do

- Does not call Apply
- Does not bypass `capture_apply_receipts`
- Does not change hosted schema
- Does not change Capture production files

Baseline artifacts: `scripts/capture-convergence/baseline.md` and `baseline.json`.
