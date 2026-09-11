# Checkpoint 3 — Prompt A/B/C/D

**Status:** Holdout frozen. Variants drafted. **Live comparison not run** — this environment has no `OPENAI_API_KEY`.

Fixed (when a later authorised live run happens):

- model: production pinned `gpt-4o-mini-2024-07-18`
- temperature: 0.2
- corpus transcripts: frozen holdout in `holdout.ts` (`PROMPT_HOLDOUT_FROZEN_AT`)
- downstream deterministic code: this branch
- scoring: `SCORING.md`

| Variant | Status |
| --- | --- |
| A current production | Drafted = live `prompt.ts`. Not live-scored here. |
| B typed schema | Drafted in `prompts.ts`. Not applied to production. |
| C uncertainty/reference discipline | Drafted. Not applied. |
| D example-guided | Drafted. Not applied. |

Do not treat a missing live table as a win for any variant.
