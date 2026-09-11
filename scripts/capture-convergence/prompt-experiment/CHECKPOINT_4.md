# Checkpoint 4 — Recommendation

**Recommended production prompt: A (current).**

Reasons:

- Deterministic defects (identity contamination, NP name drop, contradictory writes) were the material quality holes. They are fixed without a prompt change.
- Live A/B/C/D was not run (no OpenAI key in this environment). Changing production prompt without holdout + hosted 6/6 evidence would violate the regression floors.
- Prompt C/D are the next *trials*, not a silent production swap.

**Frozen holdout:** `holdout.ts` — 10 cases covering two people, pronouns, sibling names, status language, dates, foreign-project mention, mixed domains, optional responsibility, messy prose, clear creates.

**Hosted 6/6:** original on `origin/main` is 6/6. This branch changes Resolve + NP adapter. Hosted re-run was not possible here (no Preview URL / bypass / disposable account). Do not claim a new hosted 6/6.

**Second hosted holdout:** not available on current main.

**npm test:** 80/80 after the quote-match Ready.2 fix.  
**typecheck:** pass.

Do not weaken Needs You or canonical-truth safety to improve a later benchmark.
