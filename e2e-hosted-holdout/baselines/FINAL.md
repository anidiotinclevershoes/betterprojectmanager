# Independent hosted holdout — completion record

## 1. Baseline

- Integration line: `origin/main` `90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b`
- Working branch: `cursor/hosted-holdout-harness-73de`
- Contains current main?: YES
- Safe to merge?: YES from an integration-line view (product PR targeting `main`)

## 2–3. Frozen spec (before first execution)

- Freeze commit: `1d22aa07d4326667617659ac1a1c72d1f022c190` (`SPEC.md`, `frozen-spec.ts`, `PRECOMMIT.md` only)
- Suite id: `hosted-holdout-v1`
- Frozen spec diff after all remediation: **empty**

## 4. Untouched first-run

- Run: `ho-baseline-1` at harness `704d5d8` (no product change)
- Result: **4/6**
- Record: `baselines/first-run-untouched.md`

## 5–6. Failure families and fixes

1. Identity binding (H5/H6 first-run): foreign/project id rejected legal creates; workspace-wide todo title match. Fixed in validate/suggestions/toResult.
2. Persist race (H5 later): compose-UI Create before supabase hydrate. Fixed: boot cookie persist; Create disabled until hydrate.
3. Isolation (H5): ambiguous ownership discarded as silent `no_change`. Fixed in resolve.
4. Independently complete dated create (H5/H6): `truthIntent=uncertain` or missing target id hid title+date creates. Fixed in resolve rematerialize.

No Capture prompt changes. No expectation weakening. No sleeps.

## 7. Deterministic tests

- `verify-hosted-holdout-precommit`
- `verify-hydrate-session` / `verify-first-run-journey` persist-ready Create
- `verify-capture-v2` identity rematerialize, ambiguous chair staging, uncertain dated create

## 8–9. Local gates

- `npm test`: 81/81
- `npm run typecheck`: pass

## 10. Final holdout

- `ho-fix5-1`: **6/6** (`holdout-6of6-a/`)
- `ho-fix5-2` repeat: **6/6** (`holdout-6of6-b/`)

## 11. Original hosted six

- After identity fix: 6/6
- After holdout 6/6: **6/6** (`original-six-after-holdout-6of6/`)
