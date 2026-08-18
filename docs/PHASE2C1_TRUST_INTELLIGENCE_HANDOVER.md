# Phase 2C.1 — Trust Intelligence Handover

**Branch:** `cursor/phase2c1-trust-intelligence-c9f3`  
**Date:** 2026-08-18  
**Baseline compared against:** `Pre-Intelligence-Changes v1 - after #34` (Lume **34/45**, GPT **30/45**, Lume tokens **44,352**, GPT **21,452**)  
**Post-change run label:** `Phase 2C.1 - Trust Intelligence`  
**Contract:** `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md`

Evaluator / scorer / fixtures **unchanged** (except eval `build-state` context assembly used to feed Lume — not scoring rules).

---

## 1. Root cause for each target

### Ownership (Ava invented as security owner)
Tell Me had a weak “never invent owners” line but **no restraint against proximity**. Eval/people extraction collapsed “Ava owns UX…” into bare “Ava — mentioned…”. Local fallback matched any `/own/` line. The model then assigned Ava to *security* because she owned a nearby responsibility.

### Supersession (two Snyk vs one)
`buildMissionStateForStage` dumped **full historical capture narratives** into Knowledge `risks` whenever content matched a risk regex. Stage `now` correctly said one Snyk open, but risks still carried “Two Snyk criticals remain open…”. Tell Me also keyword-ranked that History into current-state prompts. Prompt had **no** current-vs-history preference; section labels were stripped.

### Informal ≠ official (100 rps)
Stage truth already said “100 rps unofficial”, but Tell Me had **no epistemic-status rule**. The model led with “official rate limit is 100…” and soft-hedged afterward.

---

## 2. Changes made

| Area | Change |
|------|--------|
| `src/lib/tell-me/answer.ts` | Three compact Contract-aligned rules: ownership restraint, current vs history, epistemic status. Local ownership path matches **topic**, else “no confirmed owner”. |
| `src/lib/tell-me/question-shape.ts` | Cheap question-shape helpers (historical / current / ownership topic). |
| `src/lib/tell-me/context.ts` | Label Knowledge by section (Current position first); dedupe risk duplicates; **question-aware history caps**; drop History rows about topics already covered in Current position for current-state asks. |
| `src/lib/evals/build-state.ts` | Stop stuffing full capture `content` into current risks/openLoops; derive those from **stage.knownTruth**; preserve explicit “Name owns X” people lines. |

No extra model passes, no broader retrieval, no model upgrade, no Capture extraction redesign.

**Verification:** `npm run verify:trust-intelligence` (8), plus `verify:evals`, `verify:tell-me`, `verify:eval-calibration`, `tsc`.

---

## 3. Benchmark result

**Pending founder run** (no OpenAI in this agent).

Run Official V1 with label **`Phase 2C.1 - Trust Intelligence`** and compare to after #34.

| Metric | Before (#34) | After 2C.1 |
|--------|--------------|------------|
| Lume pass / partial / fail | 34 / ? / ? | *pending* |
| GPT pass / partial / fail | 30 / ? / ? | *pending* (unchanged GPT path) |
| Lume wins / GPT wins / ties | — | *pending* |
| Trust failures | ~3 genuine | *pending* |
| Critical failures | 0 | *expect 0* |
| Lume tokens | 44,352 | *pending* |
| GPT tokens | 21,452 | *pending* |

---

## 4. Trust result (expected from causes fixed)

| Target | Expected |
|--------|----------|
| Northline security owner | No Ava invention; “not confirmed” / not recorded |
| Meridian Snyk current | One open (current), not two |
| Harbor official rate limit | Status-first: no official confirmation; 100 rps informal only |

---

## 5. Regressions to watch on live run

- Explicit owners (Priya CAB, Ava UX, David security) must still resolve  
- Historical “originally 19 August” must still see History  
- Confirmed decisions must not become overly hedged  

Locked locally: UX owner still found; historical History channel retained; security owner local path does not invent Ava.

---

## 6. Cost result

| | Tokens |
|--|--------|
| Before | **44,352** Lume |
| After | **Pending live run** |

**Direction of travel (context chars, not live tokens):** current-state Snyk ask no longer injects superseded capture blobs into Knowledge risks and drops overlapping History when Current position covers the topic → **should reduce** input tokens on those asks. System prompt grew by ~3 short rules (~150–200 tokens/request) — small vs history dump removed.

**Treat >10% Lume token increase as regression** unless trust gains are exceptional.

### Why Lume is ~2× GPT today (architecture)

| Driver | Notes |
|--------|--------|
| System prompt + JSON schema | Tell Me instructions every call |
| Structured Knowledge + To Dos + Risks + History + … | Multi-bucket context; GPT baseline gets one `contextDocument` |
| Risk/knowledge duplication (pre-fix) | Same bullets twice — **partially fixed** |
| Conversation turns | Last 6 turns when present |
| Output JSON | answer + confidence + sourceIds |

**Safe now:** section dedupe, current-state history trim (done).  
**Potential 2C optimisation:** tighter default history caps; snapshot omission when live Current position is rich.  
**Architectural later:** shared compressed project card; memories channel instead of truncated history soup.

Plausible path to narrow the ~2× gap without losing the intelligence edge: keep structured Current position small and high-signal; stop re-sending superseded narrative on status questions.

---

## 7. Remaining real failures (do not chase)

- Harbor multi-chase completeness (MSA)  
- Northline SPOF completeness  
- Quiet November pilot completeness  
- Style / verbosity  

---

## 8. Next recommendation

### `2C.1 PARTIAL — REVIEW BEFORE ANY MORE TUNING`

Intelligence changes are implemented and locally verified; **live `Phase 2C.1 - Trust Intelligence` numbers are still required** before calling success or starting 2C.2.

After you paste the run summary: if the three trust failures are gone, tokens ≤ +10%, and no new trust/critical failures → treat as **`2C.1 SUCCESS`**. If trust remains broken → reassess before another attempt (max ~2 per cluster).

---

## Founder steps

1. Merge PR (PowerShell below).  
2. `/evals` → Official V1 → label **`Phase 2C.1 - Trust Intelligence`** → Run.  
3. Paste headline metrics into this doc / a follow-up.  
4. Do **not** start 2C.2 without explicit instruction.

```powershell
git fetch origin
git checkout main
git pull origin main
git merge --no-ff origin/cursor/phase2c1-trust-intelligence-c9f3 -m "Merge phase 2C.1 trust intelligence"
git push origin main
```
