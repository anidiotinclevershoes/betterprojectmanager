# First-live Capture V2 eval archive

Offline copies used to rescore the **first live benchmark** through scorer v2.

This is not a second corpus. Corpus remains `capture-v2-eval-corpus-v1-hulk`.

| File | Role |
|---|---|
| `first-live-benchmark-envelopes-v1.json` | Compact envelopes (`rawJson` + original v1 totals). Copied from GitHub Actions run `32979257452` artifact `capture-v2-eval-evidence`. |
| `first-live-rescore-scorer-v2.json` | Scorer v2 comparison. Derived. Do not treat as the original result. |

The original GitHub artifact is immutable historical evidence. Do not overwrite it.

Rescore:

```bash
npm run eval:capture-v2-rescore
```
