# Phase 2B — Evaluator Calibration Handover

**Branch:** `cursor/phase2b-evaluator-calibration-c9f3`  
**Date:** 2026-08-18  
**Authority:** `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md`  
**Prior run:** `Pre-Intelligence-Changes v1` — Lume 21/45, GPT 20/45, Trust 0, Critical 1  

**Lume intelligence unchanged.** Capture / Tell Me / Advise / retrieval / prompts untouched.

---

## A. Evaluator defects found

### A1. Negation-blind forbidden-claim matching
**Defect:** `haystack.includes(forbidden)` treated  
`has not officially moved to 15 September` as containing  
`Officially moved to 15 September`.

**Fix:** `claimPresentPositively()` — contiguous and ordered-token matches with local negation windows (`not` / `has not` / `never` inside or immediately before the claim). Leading answer polarity (`No, …`) is not allowed to cancel an internal negation.

### A2. Brittle expected-fact substrings
**Defect:** `not selected` failed against `not been selected`; `no security approval` failed against `has not approved`.

**Fix:** `factMatched()` with synonym groups and ordered tokens allowing short fillers (`been`, etc.).

### A3. Uncertainty required when evidence is explicit
**Defect:** `expectUncertainty: true` + heuristic demanded hedge language; firm grounded  
`No, Security has not approved…` failed uncertainty (Contract §13 violation by the scorer).

**Fix:** Firm grounded negatives that hit required facts and avoid forbidden claims **pass** uncertainty without hedges. Fixtures with explicit negatives (e.g. Meridian security) set `expectUncertainty: false`.

### A4. Critical failure on lexical miss / synonym miss
**Defect:** Quiet Nimbus criticalInsight / expectedFacts miss when answer correctly said `has not been selected` → false `critical_intelligence_failure`.

**Fix:** Critical only when answer **affirms a forbidden path** or covers **no** required facts / insight. Synonym fact match prevents false criticals. Positive “Nimbus has been selected” still fails hard.

### A5. Required vs optional context (Contract §1)
**Defect:** Extra expected tokens (`scheduled`, `rumour`, `one`) demoted concise correct answers to partial/fail.

**Fix:** New optional `supportingFacts[]`. Only `expectedFacts` drive required coverage; supporting misses do not demote a full required hit.

### A6. Ambiguous Meridian Snyk “current” knowledge
**Defect:** `build-state` flattened **every** capture `knownTruth` into Knowledge `now`, so “two Snyk open” and “one Snyk open” co-existed as current truth.

**Fix:** Knowledge `now` uses **only `stage.knownTruth`** (Contract §4). Chronological captures remain in memories / context document. Meridian capture/stage wording clarified for supersession.

---

## B. Case-by-case review (reported non-passes + methodology)

The production run JSON was not available in the agent environment. The three founder-reported failures were reconstructed and re-scored:

| Case | Lume answer (reported) | Old auto | Classification | After calibration |
|------|------------------------|----------|----------------|-------------------|
| `v1-meridian-q3-security-approved` | “No, Security has not approved…” | FAIL (+ uncertainty) | **EVALUATOR_FALSE_NEGATIVE** | **PASS** |
| `v1-harbor-q8-slip-confirmed` | “has not officially moved to 15 September…” | FAIL (forbidden substring) | **EVALUATOR_FALSE_NEGATIVE** | **PASS** |
| `v1-quiet-q6-nimbus` | “Vendor Nimbus has not been selected…” | CRITICAL | **EVALUATOR_FALSE_NEGATIVE** | **PASS** (no critical) |

### Classification guide for remaining original non-passes

Re-open the old run in `/evals` and apply:

| Class | When |
|-------|------|
| `REAL_LUME_FAILURE` | Answer wrong / invents / misses material constraint under Contract |
| `LEGITIMATE_PARTIAL` | Correct core conclusion; missing useful but non-essential support |
| `EVALUATOR_FALSE_NEGATIVE` | Answer semantically correct; old scorer wrong (esp. negation / uncertainty) |
| `AMBIGUOUS_FIXTURE` | Stage truth unclear — fix fixture (Snyk accumulation was this class; fixed) |

**Regression suite:** `npm run verify:eval-calibration` (9 checks) locks the three false negatives and keeps true positives failing.

---

## C. Calibrated baseline

| Metric | Old (`Pre-Intelligence-Changes v1`) | Calibrated (`Pre-Intelligence-Changes v1 - calibrated`) |
|--------|--------------------------------------|--------------------------------------------------------|
| Lume pass | **21/45** | **Pending live re-run** |
| GPT pass | **20/45** | **Pending live re-run** |
| Trust failures | 0 | Pending |
| Critical failures | 1 (at least one was false) | Pending |

### How to produce the candidate true baseline

Same unchanged Lume; new scorer/fixtures only:

1. Merge this branch / deploy  
2. `/evals` → Official V1 → label **`Pre-Intelligence-Changes v1 - calibrated`** → Run  
   or `npm run evals:pre-baseline` (adjust label) with `OPENAI_API_KEY`  
3. Compare against the old run in `/evals/compare`

**Expected direction (not a guarantee):** Lume score should rise by roughly the corrected false negatives (≥3) if those answers still look like the reported ones; GPT may also rise slightly where it was similarly negation-penalised. A higher Lume score is only valid if those lifts are from scoring fixes, not intelligence changes.

Agent environment: **no `OPENAI_API_KEY`** — live calibrated run could not be executed here.

---

## D. Remaining real Lume failures (pending calibrated numbers)

Until the calibrated run lands, treat these as **likely** real weakness clusters to inspect first (from suite design + Contract, not from inflated fails):

1. **Multi-hop dependency** (Meridian UAT chain, Harbor integration readiness) — §9  
2. **Contradiction surfacing** (Cascade 24 vs 30 Sep) — §6  
3. **Ownership / proximity** and **availability×date** (Northline) — §§7–8  
4. **Prioritisation / chase lists** completeness — §§10–12  
5. **Over-narrow answers** that miss a material second fact when it *is* required  

Do **not** implement Phase 2C fixes until the calibrated run confirms which of these remain.

---

## E. Commercial interpretation

Old headline (21 vs 20) is **not commercially trustworthy** while ≥3 clear false negatives exist.

After calibration + re-run:

- Recompute Lume vs GPT wins/ties on **official V1 only**  
- Expect closer-to-truth gap; paste-into-GPT may still win on some multi-hop or contradiction cases — that is useful signal  

---

## F. Phase 2C recommendation (do not implement yet)

Smallest high-value intelligence changes **after** calibrated baseline confirms real fails:

1. **Prerequisite / dependency checking** before yes/no “can we start?” (§9)  
2. **Approval & ownership restraint** — scheduled ≠ approved; discussed ≠ owns (§15, §7)  
3. **Supersession policy** that ignores speculation (§5)  
4. **Contradiction exposure** when two dates/scopes conflict (§6)  

Avoid new agent architectures until these behavioural gaps are measured on the calibrated scorer.

---

## Verification

- `npm run verify:eval-calibration` — 9 passed  
- `npm run verify:evals` — 13 passed  
- `npx tsc --noEmit` — clean  
- Lume product paths — **unchanged**

---

## Repository state

| Item | Value |
|------|--------|
| Branch | `cursor/phase2b-evaluator-calibration-c9f3` |
| Merged to main? | Pending PR |
| Migrations | None |
| Founder step | Run **`Pre-Intelligence-Changes v1 - calibrated`** then compare |

```powershell
cd C:\Users\spudh\betterprojectmanager
git checkout main
git pull origin main
git fetch origin cursor/phase2b-evaluator-calibration-c9f3
git merge origin/cursor/phase2b-evaluator-calibration-c9f3
git push origin main
```

---

## Verdict

### `EVALUATOR CALIBRATED — PROCEED TO PHASE 2C`

**Condition:** Execute **`Pre-Intelligence-Changes v1 - calibrated`** on Production/local with OpenAI, spot-check remaining fails with manual review, then start Phase 2C against **those** failure clusters — not the pre-calibration 21/45 headline.
