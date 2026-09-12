# Independent hosted holdout harness

Second hosted vertical suite. It does **not** replace `e2e-hosted-vertical/`.

The original six already pass 6/6. This holdout asks whether ordinary but **different** project language travels through the same hosted Lume machine.

```text
browser → protected Preview → Lume auth → real UI → hosted API →
live OpenAI → deterministic processing → Review → Apply →
canonical Supabase → hard reload → authoritative UI
```

Frozen before first execution: [`SPEC.md`](./SPEC.md), [`frozen-spec.ts`](./frozen-spec.ts), [`baselines/PRECOMMIT.md`](./baselines/PRECOMMIT.md).

This folder is **not** part of `npm test`. It does **not** stub OpenAI.

## Commands

```bash
npm run e2e:hosted-holdout
```

Same secrets as the original hosted vertical suite (`LUME_E2E_BASE_URL`, disposable `LUME_E2E_EMAIL` / `LUME_E2E_PASSWORD`, `LUME_E2E_VERCEL_BYPASS_SECRET`). See `e2e-hosted-vertical/README.md`.

Optional:

```bash
export LUME_E2E_RUN_ID="ho-baseline-1"
```

One journey:

```bash
npm run e2e:hosted-holdout -- --grep "New Project issues and dated todos"
npm run e2e:hosted-holdout -- --grep "Capture create dated action"
npm run e2e:hosted-holdout -- --grep "Capture ISO date update"
npm run e2e:hosted-holdout -- --grep "Multi-person identity isolation"
npm run e2e:hosted-holdout -- --grep "Ambiguous they plus safe date"
npm run e2e:hosted-holdout -- --grep "Messy ops paste"
```

Artifacts: `test-results/hosted-holdout/` (`matrix.md`, `matrix.json`, HTML report, per-test diagnostics).

## First-run policy

Do not fix production code on the first frozen execution. Preserve `baselines/first-run-untouched.md`. Do not weaken expectations, add sleeps, or alter the frozen inputs.
