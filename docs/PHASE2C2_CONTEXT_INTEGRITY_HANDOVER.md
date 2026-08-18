# Phase 2C.2 — Context Integrity Handover

**Branch:** `cursor/phase2c2-context-integrity-c9f3`  
**Authority:** `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md`  
**Compare:** `2C.1 - Trust Intelligence #1` (Lume **29/45**, **41,718** tokens) and frozen `#34` (**34/45**, **44,352**)

Evaluator / fixtures / scoring **unchanged**.

---

## Root causes

### Qualification loss (Harbor mocks)
2C.1 stopped dumping full captures into Knowledge risks (good for tokens/supersession) but History `detail` was hard-cut at **160 chars**, leaving:

> …Maya said mocks are fine

and dropping **for unit tests only; integration tests require real staging**. Stage `now` never held the mocks decision.

### Ownership expansion (Northline security)
Even after 2C.1 restraint, the model still saw **Ava owns UX** in People context and broadened UX → security. Topic matching existed for the local path but the **OpenAI prompt still contained adjacent ownership lines**.

### Conversation (production only)
Benchmark uses `conversation: []` (isolated). Production could send Project A turns into Project B and treated assistant prose as ambient context without an authority demotion.

---

## Changes

| File | Effect |
|------|--------|
| `src/lib/text/semantic-truncate.ts` | Soft truncation preferring sentence/clause boundaries; pulls short following qualifier clauses after `;` |
| `src/lib/evals/build-state.ts` | History uses semantic truncate (~220); promote concise non-superseded **qualified** capture `knownTruth` into Decisions |
| `src/lib/capture/context.ts` | History summaries use semantic truncate (no second hard 160 cut) |
| `src/lib/tell-me/ownership.ts` | Ownership match scoped to the **owned phrase** (UX ≠ security) |
| `src/lib/tell-me/context.ts` | Ownership questions **drop adjacent** “X owns Y” lines from context |
| `src/lib/tell-me/answer.ts` | Stronger ownership non-broadening + conversation non-authority + preserve qualifications |
| `TellMeSessionContext.tsx` | Clear thread on project change / open for another project |

**Verify:** `npm run verify:context-integrity` (10), plus trust-intelligence / evals / tell-me / tsc.

---

## Benchmark

**Pending founder run** — label: **`Phase 2C.2 - Context Integrity`**

| | #34 | 2C.1 | 2C.2 |
|--|-----|------|------|
| Lume pass | 34/45 | 29/45 | *pending* |
| Lume tokens | 44,352 | 41,718 | *pending* |
| GPT | 30→31 | 31/45 | *pending* |

Watch: Northline security owner, Harbor mocks, Meridian Snyk, Harbor rate limit, Meridian original date, explicit owners. Ignore Harbor q8 scorer FP if answer is semantically correct.

---

## Genuine trust failures (expected after 2C.2)

| Case | Expectation |
|------|-------------|
| Harbor mocks | Unit-tests-only + real staging preserved |
| Northline security owner | Not recorded / no Ava expansion |
| Meridian Snyk | Still one open |
| Harbor rate limit | Still non-official |
| Explicit UX/CAB owners | Still resolve |

If ownership still invents under OpenAI after this attempt → **UI confirm owner** (attempt 2 of 2 exhausted).

---

## Cost

Target: stay near **41,718**; acceptable up to **44,352** if needed for qualifications. Decisions promotion adds a few compact bullets; semantic truncate may add ~60 chars on some history rows vs hard 160 — should not restore broad dumps.

---

## Production conversation fix

- `conversationProjectRef` clears conversation + answer when `projectId` / route / open target changes.
- System rule: recent turns are continuity only; previous assistant answers are not project evidence.

---

## Remaining weaknesses (do not fix)

Harbor chase / SPOF / Quiet November / Cascade tech-risk completeness; style; known scorer FPs.

---

## Recommendation

### `2C.2 PARTIAL — OWNERSHIP MOVES TO UI REVIEW`

Local/deterministic ownership path and context filtering are fixed; live OpenAI confirmation requires your benchmark run. If Security owner still expands under the model after this second attempt, default next step is UI-assisted confirmation — not a third prompt cycle.

---

## Founder merge (PowerShell)

```powershell
git fetch origin
git checkout main
git pull origin main
git merge --no-ff origin/cursor/phase2c2-context-integrity-c9f3 -m "Merge phase 2C.2 context integrity"
git push origin main
```

Then `/evals` → **`Phase 2C.2 - Context Integrity`**.
