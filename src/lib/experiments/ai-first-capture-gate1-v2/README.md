# AI-first Capture Gate 1 v2

Non-mergeable architectural spike from current `origin/main`.

Question: can one frontier-model call, given raw Capture plus a compact
dump of *current* canonical project truth, understand explicit project
information without Lume’s rematerialise / hydrate / regex rescue pipeline?

```bash
LUME_EXPERIMENT=1 npx --yes tsx scripts/experiment-ai-first-capture-gate1-v2.ts
```

Optional: `GATE1_V2_MODEL=gpt-6-astra` (default). If that model is
unavailable the runner stops. It does not substitute another model
unless you set the env var yourself.

Does not write project truth. Does not change production Capture.
