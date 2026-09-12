# Capture convergence gate (experiment)

**Status:** Reconstructed on post-holdout `main` (`17a3e413282b6c7014c3bada09527c22426654c0`) as `cursor/capture-convergence-reconstruct-73de`.  
Salvage source: `cursor/experiment-capture-convergence-30ae` / PR #156. **Do not merge that experiment branch wholesale.**

The 538-case corpus is observe-only. Failures are the map. Do **not** add `verify:capture-convergence` to ordinary `npm test`. Do **not** retune Prompt A against the corpus.

This reconstruction **does** carry unique production rules that were not superseded by the hosted holdout:

- observation-local identity evidence;
- contradictory same-record sibling writes stay Needs You;
- New Project Organise recovers name-only people from VALIDATE rejects (D-052).

Holdout identity/dated-create/persist rules on `main` stay authoritative where they overlap.

```bash
npm run verify:capture-convergence
```

Optional live sample (never CI): `LUME_CAPTURE_LIVE=1 npm run eval:capture-live`.
Prompt-experiment tooling is present and **off**. Production still uses Prompt A.
