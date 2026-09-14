# AI-first Capture Gate 2 final audition

Non-mergeable. `LUME_EXPERIMENT=1`.

Question: can Astra Gate 1 output be turned into safe executable proposals by a **thin** deterministic boundary over existing `planCaptureApply`?

```bash
LUME_EXPERIMENT=1 npx --yes tsx experiments/ai-first-capture-gate2/run.ts --replay
LUME_EXPERIMENT=1 npx --yes tsx experiments/ai-first-capture-gate2/run.ts --concurrency=3
LUME_EXPERIMENT=1 npx --yes tsx experiments/ai-first-capture-gate2/run.ts --stage2 --repeats=3 --concurrency=3
LUME_EXPERIMENT=1 npx --yes tsx experiments/ai-first-capture-gate2/run.ts --stage3 --concurrency=2
LUME_EXPERIMENT=1 npx --yes tsx experiments/ai-first-capture-gate2/compare.ts
```

`--replay` materialises frozen bake-off Gate 1 envelopes (no new Astra). Live runs use one `gpt-6-astra` call plus Gate 2.

Do not merge. Do not retune Astra. Do not modify Simplification or Current.
