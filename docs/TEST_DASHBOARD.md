# Lume Test Dashboard

Operational guide for the engineering evidence dashboard. This is **not** a Lume product feature and does not change Capture, scoring, or production behaviour.

## Where it lives

Persistent comparison page: a GitHub Issue titled

**Lume Test Dashboard — Regression & Model Benchmarks**

Search the repository issues for that exact title. Bookmark it.

Each relevant GitHub Actions run also writes a Markdown **Job Summary** with the same evidence for that run.

## How it is updated

```
test / benchmark jobs
        ↓
existing JSON / outcome files in test-results/
        ↓
scripts/test-dashboard/publish.ts
        ↓
GitHub Actions Job Summary
        ↓
create or update the persistent Issue (summarised history)
        ↓
detailed payloads stay in Actions artifacts
```

Deterministic regression jobs remain the authority. The dashboard job is `continue-on-error: true`. If tests pass and the Issue update fails, the product is still green; the dashboard job shows as a warning/failure.

Fork pull requests write a Job Summary only. They do not update the Issue.

## What each metric means

The reporter **displays** values the Hulk harness and stacked Capture scripts already emit. It does not invent a second score.

| Field | Source | If missing |
|---|---|---|
| Recall | mean of `modelMetrics.materialRecall` | — |
| False positives | sum of `modelMetrics.unsupportedCount` | — |
| Domain / existing-vs-new / target-ID | means of the corresponding harness fields | — |
| Ambiguity / no-change / commentary | share of non-null boolean harness fields | — |
| Stability | not emitted by the harness | always — |
| MODEL FAILURE / LUME CATCH / LUME FAILURE | `lumeSafety.totals` and per-row `classification` | 0 or — |
| Tokens / latency / cost | summed `call.usage`, `latencyMs`, `approximateCostUsd` (USD) | — |
| Corpus version | harness `corpusVersion`, else frozen `capture-v2-eval-corpus-v1-hulk` (not `baselineVersion`) | shown when present |
| Scorer version | harness `scorerVersion`, else implicit `capture-v2-eval-scorer-v1` for historical files | shown as a Scorer column |
| Stacked worlds | `test-results/stacked-{world}.json` | — |

PASS / FAIL for a live model row:

- ❌ if `lumeFailures > 0` or the harness recorded call errors (same fail-closed rule as `scripts/eval-capture-v2.ts`)
- ⚠️ if there were Lume catches and no Lume failures
- ✅ otherwise

This is presentation of existing fields, not a new correctness algorithm.

## MODEL FAILURE vs LUME CATCH vs LUME FAILURE

These stay separate on purpose.

- **MODEL FAILURE** — the model was wrong (missed or invented something).
- **LUME CATCH** — the model was wrong or unsafe, and Lume converted that into rejected / no-change / Needs you, so it did not become truth.
- **LUME FAILURE** — Lume allowed a wrong output to become a legal write / Apply Ready path.

A caught model mistake is not the same as Lume corrupting truth. Do not collapse them into one fail score.

## How to run it locally

```bash
npm run verify:test-dashboard     # reporter tests (no provider calls)
npm test                          # includes the reporter tests
npm run dashboard:preview         # print Markdown from test-results/
```

Preview reads `test-results/` in the working tree. After `npm run verify:stacked-capture` that folder contains stacked JSON. It will not contain live model rows unless you have previously written a harness JSON there.

Do **not** point preview at `scripts/test-dashboard/fixtures/` and then publish that output to the real Issue. Fixtures are fake.

## How to trigger a benchmark

Live eval is opt-in and paid. It does **not** run on every PR.

```bash
npm run eval:capture-v2 -- --provider openai --out test-results/capture-v2-eval.json
npm run eval:capture-v2 -- --provider all --runs 3 --out test-results/capture-v2-eval.json
```

Or GitHub → Actions → **Capture V2 live eval** → Run workflow.

Missing keys: the eval script exits 2 and does not invent a pass. The dashboard then shows no live benchmark for that run.

## Where detailed artifacts live

| Run | Artifact |
|---|---|
| Deterministic regression | `regression-evidence` (`test-results/`, including stacked JSON) |
| Frozen Playwright | `e2e-evidence` |
| Stacked Capture workflow | `stacked-capture-evidence` |
| Live eval | `capture-v2-eval-evidence` (includes the full harness JSON) |
| Dashboard job | `lume-test-dashboard` (normalised summary JSON only) |

The Issue never stores raw model payloads, prompts, or credentials. Drill into the workflow run artifacts for case-level JSON.

## What is and is not persisted

Persisted in the Issue (summarised, capped):

- recent regression rows (PR / SHA / pass-fail)
- recent model rows (provider + model as data fields)
- recent classified failures (case id, world, expected, actual, classification, link)

Not persisted:

- raw provider JSON
- transcripts
- API keys, tokens, headers
- fixture files
- production application data

History is stored as a hidden HTML comment in the Issue body (`lume-test-dashboard-state:v1`). Re-running the same GitHub `run_id` updates that row in place instead of duplicating it.

Issue #73 already contains historical **scorer v1** labelled live-eval rows. Those bodies are evidence. Do not edit them to pretend the original scorer used v2 rules.

A later dashboard publish that ingests `test-results/capture-v2-eval-scorer-v2.json` (or any harness JSON with `scorerVersion: capture-v2-eval-scorer-v2`) appends a new model row. Latest-per-model is keyed by provider + model + scorer version, so v1 and v2 can both show. This reporter does not rewrite previous Issue comments.

## Workflow semantics

- `regression` and `e2e` jobs are authoritative for product safety.
- `dashboard` needs those jobs, runs `if: always()`, and uses `continue-on-error: true`.
- Issue write uses `issues: write` on that job only. Default workflow permission is `contents: read`.
- Fork PRs: summary only.

## How to recover the Issue if it is deleted

1. Re-create an issue with the exact title `Lume Test Dashboard — Regression & Model Benchmarks`.
2. Leave the body empty or paste any previous Markdown you still have.
3. Re-run **Deterministic regression** (and, if you need model rows, **Capture V2 live eval**).
4. The next successful dashboard step will find or create the Issue and append new summarised rows.

Older history is only in previous Issue bodies and workflow artifacts. This dashboard is not a database. If the Issue is gone and artifacts have expired, those summarised rows cannot be reconstructed automatically.

If the hidden state comment is corrupted, publishing **refuses to overwrite** rather than wiping history. Fix or restore the comment, then re-run.

## Schema

Test-only record: `scripts/test-dashboard/schema.ts`, version `1`.

It is a normalisation layer over existing outputs. It is not authority over Capture semantics.
