# AI-first Capture Gate 2

Non-mergeable architectural experiment. Continuation of
`experiment/ai-first-capture-gate1-v2` @ `707b704`.

Question: can AI-first stay

raw Capture + compact current canonical truth
→ one Astra semantic call
→ thin deterministic legality/safety check
→ Review-shaped outcomes

without recreating Lume’s resolver/recovery stack?

```bash
LUME_EXPERIMENT=1 npx --yes tsx scripts/experiment-ai-first-capture-gate2.ts
```

Default model: `gpt-6-astra` (`GATE1_V2_MODEL`). No silent substitution.

Does not write project truth. Does not change production Capture.
Does not import Simplified Capture / PR #175.
