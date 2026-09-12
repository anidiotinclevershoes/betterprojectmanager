# Prompt E — experiment only

**Baseline:** new `origin/main` `91fabf8d1627e89538f26e00b9b3343b9d577cdb` after clean production integration `#167`.  
**Production Prompt A:** unchanged (`src/lib/capture-v2/prompt.ts`).  
**Holdout:** frozen `2026-09-11T23:30:00.000Z` — do not edit after observing results.

Prompt E is a **minimal derivative of A**. It keeps A's contract and adds only:

1. Reference discipline from the useful part of C (do not guess pronouns; do not import sibling names; keep contradictions separate).
2. Create-ID discipline from the useful part of D (no invented Create IDs; project UUID is not an entity id; legal Creates may omit `candidateTargetId`).

No few-shot library. Not wired into `/api/capture`.

```bash
LUME_CAPTURE_LIVE=1 npx tsx scripts/capture-convergence/prompt-experiment/run.ts --variant A,E --trials 3
```
