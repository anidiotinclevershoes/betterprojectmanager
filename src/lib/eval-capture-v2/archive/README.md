# First-live Capture V2 eval archive

Offline copies used to rescore the **first live benchmark**. This is not a second corpus. Corpus remains `capture-v2-eval-corpus-v1-hulk`.

| File | Role |
|---|---|
| `first-live-benchmark-envelopes-v1.json` | Compact envelopes (`rawJson` + original v1 totals). Copied from GitHub Actions run `32979257452` artifact `capture-v2-eval-evidence`. Immutable. |
| `first-live-rescore-scorer-v2.json` | Historical scorer v2 comparison against **pre-#77** production. Immutable. |
| `capture-v2-eval-scorer-v3-replay.json` | Current-production replay of the same envelopes through scorer v3. Not a live benchmark. |

The original GitHub artifact is immutable historical evidence. Do not overwrite it.
Do not overwrite the historical scorer-v2 rescore.

Replay current production through scorer v3:

```bash
npm run eval:capture-v2-scorer-v3-replay
```
