# Simplification + Astra control

Non-mergeable model-control experiment. `LUME_EXPERIMENT=1`.

Question: does pinned Simplification (`bd76bbf`) perform better when its **existing** Prompt A extraction call uses `gpt-6-astra` instead of `gpt-4o-mini-2024-07-18`?

This is **not** AI-first + Simplification write spine. It is Simplification + a different model.

```bash
LUME_EXPERIMENT=1 npx --yes tsx experiments/simplification-astra-control/run.ts
LUME_EXPERIMENT=1 npx --yes tsx experiments/simplification-astra-control/run.ts --stage2 --repeats=3
LUME_EXPERIMENT=1 npx --yes tsx experiments/simplification-astra-control/run.ts --stage3
LUME_EXPERIMENT=1 npx --yes tsx experiments/simplification-astra-control/compare.ts
```

Do not merge. Do not retune Prompt A. Do not modify the Simplification pin.
