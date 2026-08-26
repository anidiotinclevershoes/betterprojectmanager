# Existing test-debt assessment (Workstream B)

Inventory only. **No rewrite** of the 47 verify scripts.

Recorded against frozen V2 HEAD `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4`.

## What exists

| Tool | Role | Keep? |
| --- | --- | --- |
| `scripts/verify-*.ts` + `node:assert` + `tsx` | Deterministic product regression | **Yes** — documented prior decision |
| `scripts/run-regression-suite.ts` | `npm test` aggregator, strips `OPENAI_API_KEY` | **Yes** |
| `scripts/run-pre-intelligence-baseline.ts` | Live Tell Me / GPT evals | Keep; separate from Capture V2 eval |
| `src/lib/evals/` | Intelligence benchmark worlds (Meridian etc.) | Keep; do not mix with Candyland |
| `tsc --noEmit` | Types | **Yes** |
| GitHub Actions `regression.yml` | typecheck + `npm test` | **Yes** — e2e job added beside it |
| vitest / jest | Absent by decision | Do not introduce as a migration |

## Giant scripts (scaling debt, not this PR)

These are large one-off verifiers. Leave them until the code they protect is deleted.

| Script | Approx. size class | Protects |
| --- | --- | --- |
| `verify-phase3b-capture-boundary.ts` | very large | Phase 3B planner — **keep** (V1 mutation boundary) |
| `verify-capture-v2.ts` | large | V2 validate/resolve — **keep** |
| `verify-canonical-truth.ts` | large | canonical assembler — keep |
| `verify-new-project-onboarding.ts` | large | New Project persist |
| `verify-ocean-knowledge-centre.ts` | large | KC frames |
| `verify-capture-workspace-refinement.ts` | medium-large | Capture UI review |
| `verify-findings.ts` / `verify-golden-test.ts` | medium-large | **legacy Capture findings** — likely to shrink when legacy Capture is deleted |

## Duplicated helpers / fixture construction

- Local `check()` + `node:assert` copied per script (intentional, no shared runner).
- Candyland / Toyworld / GamingStudio5000 reconstructed in `verify-phase3b`, `verify-capture-v2`, `verify-phase6-worlds`, `verify-phase0-capture-baseline`. Canonical source is now `src/lib/experiments/worlds.ts`. New tests must import that, not mint a fourth world.
- `scripts/lib/fake-supabase-workspace.ts` is the shared Supabase fake — keep using it.

## Scripts likely to disappear with legacy Capture

When the legacy findings / regex / local fallback Capture path is deleted:

- `verify-capture-prompt-path.ts`
- `verify-findings.ts` (legacy extraction)
- `verify-golden-test.ts` (legacy golden)
- `verify-capture-reliability.ts` (partially; reliability UI may remain)
- `verify-phase0-capture-baseline.ts` once V2 is the only path (after Architecture says so)

Do **not** delete them in this branch.

## Tests protecting paths we intend to delete

- Legacy OpenAI findings mapping tests inside capture-review / findings scripts.
- ATLAS / HORIZON / RELOPS seed-specific Capture phrases in older scripts (Niamh / CAB). V2 eval corpus deliberately uses candy/toy/game vocabulary instead.

## Gradual standardisation (future tests only)

1. Keep `tsx` + `node:assert` for product regression.
2. New architectural tests import `experimentalApplyWorld` and `runCaptureV2FromModelJson`.
3. New invariant-shaped tests may use `fast-check` **only** for fail-closed ID/envelope properties (`scripts/verify-capture-v2-invariants.ts`).
4. UI journeys go through Playwright frozen fixtures, not live AI.
5. Live model quality stays behind `npm run eval:capture-v2`, never `npm test`.

Do not migrate the existing 47 scripts onto Playwright, fast-check, or vitest.
