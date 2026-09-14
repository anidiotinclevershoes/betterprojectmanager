# Gate 2 preflight

Non-mergeable continuation of Gate 1 v2. Not a production branch.

```text
Working branch: experiment/ai-first-capture-gate2
Branch from: experiment/ai-first-capture-gate1-v2 HEAD 707b704bbf820fcc4492c86155889d6afe5d5bae
Gate 1 v2 main baseline: 92d61d13c4407d04a8e20960e7eb38efa0b103c3
origin/main at branch creation: 920d65d9c0f6e49efca8e26fc8906dbbd11e8f25 (PR #175 merged — not imported)
Contains Gate 1 v2?: YES
Contains current origin/main?: NO (intentional — would pull Simplified Capture)
Contains unmerged Simplified Capture Phase 1 / PR #175 code?: NO
Working tree: experiment-only files under src/lib/experiments/ai-first-capture-gate2/ plus runner script
Branch classification: EXPERIMENT (LUME_EXPERIMENT=1)
PR base: none — do not open a production PR
Dependencies: Gate 1 v2 interpreter/inspect/contract/snapshot/score/production (reuse)
Shared/global files expected: none owned
```

## Isolation

- Branched from Gate 1 v2 experimental HEAD, not from post-#175 main.
- Production Capture / Review / Apply / persist / store / migrations are not modified.
- Simplified Capture / PR #175 prompt behaviour is not imported.
- No production Apply in this gate.

## Boundary

- Reuses `applySupportsOperation` + read-only `planCaptureApply`.
- Does not create a second legal-operation matrix.
- Does not semantically repair failed operations.
