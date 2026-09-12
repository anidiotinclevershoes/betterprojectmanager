# Hosted production long-run dogfood

Opt-in Playwright programme that challenges Lume as a customer would over one evolving project:

browser → **production** Lume → production auth → real UI → live OpenAI → deterministic processing → Review (including edit / exclude / Needs You) → Apply → production Supabase → hard reload / new session → authoritative projection.

This is **not** `npm test`. It is **not** the frozen local `e2e/` suite. It is **not** the 6+6 hosted vertical / holdout suites.

It is expensive, slow, stateful, and production-dependent. Invoke it deliberately.

## Frozen authority

| Asset | Role |
| --- | --- |
| [`SPEC.md`](./SPEC.md) | Product contracts and first-run rules |
| [`frozen-manifest.ts`](./frozen-manifest.ts) | 50 source captures, expected semantics, Review plan |
| [`new-project.ts`](./new-project.ts) | State 0 paste |
| [`ATTACK-MATRIX.md`](./ATTACK-MATRIX.md) | Historical weakness → probe map |
| [`ledger.ts`](./ledger.ts) | Before / allowed delta / after accounting |

**Do not edit the frozen manifest after seeing Lume's answers.** Flag `TEST_EXPECTATION` instead.

Suite id: `hosted-longrun-v1`  
Seed: `lume-longrun-v1-20260912-a3db`

## Safety

- Default host is production `https://betterprojectmanager.vercel.app` (`LUME_LONGRUN_BASE_URL` overrides).
- Uses the dedicated disposable identity (`LUME_E2E_EMAIL` / `LUME_E2E_PASSWORD`).
- Creates `E2E-LONGRUN-Riverside Civic Hall Fit-Out <run-id>` only.
- Isolation preflight refuses known customer-dogfood names and watches sibling-project fingerprints after every Apply.
- All writes go through the real New Project / Capture / Review / Apply UI. No SQL canonical writes.
- Do not run two captures against the same project at once.

## Commands

```bash
npx playwright install chromium   # once
npm run verify:hosted-longrun-precommit
npm run audit:hosted-longrun-db -- --prove-env
LUME_E2E_RUN_ID=lr-$(date -u +%Y%m%dT%H%M%SZ) npm run e2e:hosted-longrun
npm run audit:hosted-longrun-db -- --first-run
```

Required secrets (environment only — never commit or paste into chat):

- `LUME_E2E_EMAIL`
- `LUME_E2E_PASSWORD`
- `LUME_E2E_VERCEL_BYPASS_SECRET` (harmless on open production; required if the host is protected)

Optional: `LUME_LONGRUN_BASE_URL` if you must point at a non-production host. That is not the first-run programme.

## Evidence

`test-results/hosted-longrun/`

- `matrix.md` / `run-report.json`
- `isolation-proof.json`
- `state-0.json` / `state-final.json`
- `captures/NN-before.json` / `NN-review.json` / `NN-after.json` / `NN-delta.json`
- `screens/`

The dedicated project is left in place until investigation no longer needs it. Cleanup is ordinary Delete Project on that project only.

Independent read-only production SQL (never canonical writes) is mandatory at programme checkpoints. See `SPEC.md` § Canonical database verification. Official first-run post-hoc audit: [`baselines/first-complete-run/FIRST-RUN.md`](./baselines/first-complete-run/FIRST-RUN.md).
