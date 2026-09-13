# AI-first Capture — Gate 1 disposable spike

**Status:** non-mergeable experiment  
**Branch:** `experiment/ai-first-capture-gate1`  
**Classification:** `LUME_EXPERIMENT` / `experiment/` — reference only. Do not merge.

This folder is a read-only architectural spike. It answers one question:

> Can one frontier-model call, given raw Capture input plus a simple
> serialization of current canonical project truth, correctly understand
> the project information/change without Lume's existing interpretation
> pipeline?

It does **not**:

- change production Capture, Review, or Apply
- write canonical truth
- add UI, feature flags, migrations, embeddings, retrieval, or a second pipeline
- build an AI-first resolver / candidate materialiser (that is Gate 2)

Run:

```bash
LUME_EXPERIMENT=1 npx --yes tsx scripts/experiment-ai-first-capture-gate1.ts
```

Requires `OPENAI_API_KEY`. Requests model `gpt-6-astra` exactly. If Astra
is unavailable, the script stops. It does not substitute another model.
