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

## Merge safety

- [ ] Branch contains current `main` (or drift is MINOR and reviewed)
- [ ] Ready → Apply and other safety contracts are unchanged or explicitly extended
- [ ] No parallel truth store / stale extractor restored
