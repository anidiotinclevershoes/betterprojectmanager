# Capture three-way bake-off

Non-mergeable experiment. `LUME_EXPERIMENT=1`.

Compares three **pinned** Capture approaches without merging them, transferring code, or retuning after seeing outputs.

| Contender | SHA | Role |
| --- | --- | --- |
| Current | `920d65d9c0f6e49efca8e26fc8906dbbd11e8f25` | Production Prompt A + full resolve |
| Simplification | `bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0` | Approved simplification comparison candidate |
| AI-first | `707b704bbf820fcc4492c86155889d6afe5d5bae` | Gate 1 v2 accepted comparison candidate |

Worktrees:

- `/tmp/lume-bakeoff/current`
- `/tmp/lume-bakeoff/simplification`
- `/tmp/lume-bakeoff/ai-first`

## Commands

```bash
LUME_EXPERIMENT=1 npx --yes tsx experiments/capture-three-way-bakeoff/freeze.ts
LUME_EXPERIMENT=1 npx --yes tsx experiments/capture-three-way-bakeoff/run.ts
LUME_EXPERIMENT=1 npx --yes tsx experiments/capture-three-way-bakeoff/run.ts --stage2 --repeats=3
LUME_EXPERIMENT=1 npx --yes tsx experiments/capture-three-way-bakeoff/run.ts --stage3
LUME_EXPERIMENT=1 npx --yes tsx experiments/capture-three-way-bakeoff/summarize.ts
LUME_EXPERIMENT=1 npx --yes tsx experiments/capture-three-way-bakeoff/blind.ts
```

Do not merge this branch to `main`.
Do not modify the three contender checkouts.
Do not start Gate 2 from this experiment.
