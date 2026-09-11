# Capture convergence gate (experiment)

**Status:** Non-mergeable diagnostic experiment (`experiment/capture-convergence-gate-cedc`).  
**Does not change Capture production behaviour.** Failures are the map.

Full operator notes: [`scripts/capture-convergence/README.md`](../scripts/capture-convergence/README.md).

```bash
npm run verify:capture-convergence
```

Do **not** add this to ordinary `npm test`. Do **not** tune Capture against the held-out corpus until a later evaluation pass.

Optional live sample (never CI): `LUME_CAPTURE_LIVE=1 npm run eval:capture-live`.
