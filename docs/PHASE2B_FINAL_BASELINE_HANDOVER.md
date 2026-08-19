# Phase 2B — Final Evaluator Baseline Handover

**Branch:** `cursor/phase2b-final-baseline-c9f3`  
**Date:** 2026-08-18  
**Authority:** `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md`  
**Prior calibrated run:** `Pre-Intelligence-Changes v1 - after #33`  
**Target freeze label:** `Pre-Intelligence-Changes v1 - FINAL BASELINE`

**Lume intelligence unchanged.** Capture / Tell Me / Advise / Coach / retrieval / prompts / models / project knowledge untouched.

---

## Final baseline

| Metric | Value |
|--------|--------|
| Lume pass / partial / fail | **Pending live re-run** (no `OPENAI_API_KEY` in this agent) |
| GPT pass / partial / fail | **Pending live re-run** |
| Lume wins / GPT wins / ties | **Pending live re-run** |
| Trust failures | **Pending** — scorer now flags inventing ownership / stale Snyk count / officialising informal limits |
| Critical failures | **Pending** — unchanged policy (material blocked-path affirmation only) |
| Token usage | **Pending live re-run** |

**How to freeze:** after merge, `/evals` → Official V1 → label **`Pre-Intelligence-Changes v1 - FINAL BASELINE`** → Run  
(or `npm run evals:pre-baseline` with label override + `OPENAI_API_KEY`).

---

## Changes from previous run (expected score/severity moves)

Reconstructed from founder-reported answers + fixture ground truth. Live numbers require the FINAL BASELINE run.

| Case | Was (after #33) | After this pass | Why |
|------|-----------------|-----------------|-----|
| `v1-meridian-q8-original-date` | partial | **pass** | `26 August` moved to `supportingFacts`; question only needs original `19 August` (Contract §1) |
| `v1-meridian-q9-ops-slack` | fail | **pass** | Required `not ready` + `no security`; firm No allowed (`expectUncertainty: false`); Ops/UX informal detail supporting |
| `v1-northline-q2-jordan-snyk` | partial | **pass** | Only `does not own` required; “discussed Snyk” supporting |
| `v1-northline-q4-riley-scope` | partial | **pass** | `cannot approve` ≡ `not authorised` synonym; role detail supporting |
| `v1-cascade-q3-finance-only` | partial | **pass** | Only `HR` required; “invalidated” supporting |
| `v1-cascade-q7-hr-owner` | fail | **pass** | `both own` ≡ `joint`; contradiction heuristic accepts joint/both/overlapping |
| `v1-quiet-q8-budget` | fail (false forbidden £) | **pass** | Currency forbidden claims require a digit; generic post-£ token match blocked; TBC synonyms include can’t find |
| `v1-northline-q9-security-owner` | fail (soft) | **fail + trust_failure** | Inventing Ava as security owner is unsupported ownership → **trust**, not critical |
| `v1-meridian-q7-snyk-status` | pass (wrong “two open”) | **fail + trust_failure** | Stage truth = **one** open; “two remain open” is stale/wrong; bare answer “No” no longer masks the positive count claim |
| `v1-harbor-q4-rate-limit` | (inspect) | **fail** when framed as official | Informal-as-official framing hits forbidden / trust patterns |

Negation fix detail: sentence-initial **No** is answer polarity and must not suppress a later positive claim (`No — two Snyk…`). Determiner **no** still negates (`no official rate limit…`).

---

## Remaining genuine Lume weaknesses

Do **not** fix in this pass. Ranked for Phase 2C.

### High priority — potentially misleading / trust damaging

1. **Ownership invention** — When security owner is unrecorded, Lume names a nearby person (Ava) with confidence instead of “not recorded”.
2. **Current-state / supersession** — Meridian Snyk: answers with historical “two open” when stage truth is one open.
3. **Confirmed vs informal truth** — Harbor rate limit: “official … is unofficially 100 rps” instead of “no official confirmation; 100 rps informal only”.

### Medium priority — PM reasoning / actionability

4. **Prioritisation completeness** — Harbor “who should I chase”: Elena/credentials may omit unsigned MSA; fixture marks MSA as supporting + `manual_review_required` for completeness disputes.
5. **Restraint under sparse evidence** — Quiet Harbor: tendency to over-conclude where records are thin (watch after live re-run).

### Low priority — completeness / style

6. Extra explanatory context (current date when asked original; who *does* own when asked only whether Jordan owns) — optional under Contract §1; not scoring failures after this pass.

---

## Evaluator residual limitations

Automatic judge still cannot reliably:

- Rank multi-chase priorities when several dependencies are valid
- Judge prose quality / “usefulness” beyond fact coverage
- Resolve borderline synonymy outside curated pairs
- Decide every informal-vs-official nuance without forbidden/expected anchors

For those: prefer **`manual_review_required`** (Harbor chase already noted) over brittle mega-rules.

Locked checks: `npm run verify:eval-calibration` (**23** cases) + `npm run verify:evals`.

---

## Phase 2C recommendation

At most **three** initial intelligence targets (do not implement here):

1. **Unknown ownership restraint** — Prefer “not recorded” over inferring owner from nearby roles (Northline security).
2. **Stage-current supersession** — Prefer latest stage truth over earlier capture counts (Meridian Snyk).
3. **Informal ≠ official** — Surface informal mentions without promoting them to confirmed project facts (Harbor rate limit).

Constraint: ~2 attempts per cluster, 2–4 Phase 2C iterations total; if Lume reliably flags uncertainty but cannot resolve ambiguity, ship UI for fast human confirmation (reliable 80% / UI 20%).

---

## Founder merge (PowerShell)

```powershell
git fetch origin
git checkout main
git pull origin main
git merge --no-ff origin/cursor/phase2b-final-baseline-c9f3 -m "Merge phase2b final evaluator baseline"
git push origin main
```

Then run **`Pre-Intelligence-Changes v1 - FINAL BASELINE`** on Production/Preview with OpenAI. Paste summary metrics into this doc before starting Phase 2C work.

---

### `FINAL BASELINE STILL UNTRUSTWORTHY`

**Smallest blocker:** live 45-case run labelled `Pre-Intelligence-Changes v1 - FINAL BASELINE` has not been executed (no OpenAI in this agent). Evaluator defects for the listed false negatives/positives are fixed and verified; freeze numbers after that one run, then proceed to Phase 2C.
