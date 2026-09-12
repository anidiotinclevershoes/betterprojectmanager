## Preflight (required)

```text
Working branch:
Branch HEAD:
origin/main HEAD:
Merge-base:
Ahead:
Behind:
Contains current main?:
Working tree clean?:
PR base: main
Dependencies:
Shared/global files expected:
Branch classification:
```

Run `npm run git:preflight` and paste the output.

Product PRs **must** target `main`.

`MATERIALLY STALE` work must not be merged. Recreate from current `main`.

`experiment/` and desert-era branches are reference-only / non-mergeable.

## What changed

-

## Tests

-

## Migration / RLS

- [ ] None
- [ ] Additive / backwards-safe (describe)
- [ ] Explicit deterministic migration (link old-project regression evidence)

## Data-model preflight (required if schema / domain / persistence / readers / projections change)

Answer before implementing. Full contract: `docs/LUME_DURABLE_PROJECT_TRUTH.md`.

1. Existing persisted project data affected:
2. Additive / backwards-compatible?:
3. If migration is required, is it deterministic?:
4. Stable IDs preserved?:
5. Relationships preserved?:
6. History / audit preserved?:
7. Semantic meaning preserved?:
8. Uncertainty preserved correctly?:
9. Old-project regression evidence:
10. Could a real user lose data, need to recreate a project, or have truth silently reinterpreted?:

If **#10 is YES or UNCERTAIN: STOP AND ESCALATE TO PRODUCT OWNER.** Do not implement a destructive path autonomously.

## Merge safety

- [ ] Branch contains current `main` (or drift is MINOR and reviewed)
- [ ] Ready → Apply and other safety contracts are unchanged or explicitly extended
- [ ] No parallel truth store / stale extractor restored
- [ ] Existing persisted project truth is not stranded, silently reinterpreted, or deleted
