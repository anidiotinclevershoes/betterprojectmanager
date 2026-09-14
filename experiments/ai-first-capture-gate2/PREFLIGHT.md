# Gate 2 final audition — preflight

Non-mergeable. Branched from accepted AI-first Gate 1 v2 / existing Gate 2 line.

```text
Working branch: experiment/ai-first-capture-gate2
Gate 1 accepted base: 707b704bbf820fcc4492c86155889d6afe5d5bae
Existing Gate 2 HEAD before this audition: 9e04a4d0b289279ec09f0aa2fd7c88cfe6bc6ab1
origin/main: 920d65d9c0f6e49efca8e26fc8906dbbd11e8f25
Contains current main?: NO (intentional — Gate 1/2 isolation; would pull later Capture)
Simplification pin (comparison only): bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0
Current pin (comparison only): 920d65d9c0f6e49efca8e26fc8906dbbd11e8f25
Shared/global files expected: none
Branch classification: EXPERIMENT
```

## Isolation

- Does not modify Current, Simplification, bake-off results, or Simplification+Astra.
- Does not alter production Capture routes.
- Previous Gate 2 `legal-boundary.ts` is left unchanged (it consulted the planner but did not adopt its outcomes).
- This audition adds `experiments/ai-first-capture-gate2/materialise.ts`, which **adopts** `planCaptureApply` plus typed ID proof.

## Corpus

Frozen bake-off SHA `925b3395268d56482b1ce8e0f6fde82a1c4a87f473432fcb73919f809a66cd14` read-only from `/tmp/lume-bakeoff/bakeoff`.
