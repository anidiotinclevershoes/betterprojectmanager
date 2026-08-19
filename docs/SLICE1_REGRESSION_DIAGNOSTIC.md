# Canonical Truth Slice 1 — Regression Diagnostic

**Status:** Read-only investigation (no implementation, no prompt tuning)  
**Branch:** `cursor/canonical-slice1-regression-diagnostic-c9f3`  
**Runs compared:**

| | MODEL TIDY PR37 (legacy) | PR38 Canonical Truth Slice 1 |
| --- | --- | --- |
| Lume pass | **30/45** | **23/45** (−7) |
| GPT pass | 32/45 | 30/45 |
| Trust / critical | 0 / 0 | 0 / 0 |
| Lume tokens | 49,157 | **37,404** (−23.9%) |
| GPT tokens | 21,470 | 21,452 |
| Ratio | ~2.29× | **~1.74×** |
| Model | `gpt-4o-mini-2024-07-18` | same |

Offline reproduction: `npx tsx scripts/diagnose-slice1-regressions.ts`

---

## Executive diagnosis

**30/45 → 23/45 is not a trust regression** (still 0/0). It is a **recall / completeness regression** caused by Slice 1’s canonical path reading a **thinner truth surface** than legacy Tell Me.

Root causes cluster into four mechanisms:

1. **Stage `knownTruth` compression** drops earlier capture specifics (10 Oct, budget TBC, discovery candidates, Elena not on kickoff stage).
2. **`extractPeopleLines` only recognises `Name owns / does not own / leave / Name —`** — so vendor contact, delivery PM, and joint ownership never become people/responsibility items (and “No record that Tom owns…” falsely extracts “Tom owns…”).
3. **Canonical serializer omits History/memories by default** — facts that survived only in capture narrative disappear even when still in `MissionState.memories` / `history`.
4. **False `needsConfirmation` / KNOWN GAPS** for ownership questions when facts exist as prose `fact`/`decision` but not as `kind=responsibility` — can override correct bullets (Cascade HR).

**Architecture direction remains correct.** The cost win (~24%, ~1.74×) is real. Do **not** restore multi-channel dumping. Fix by **richer canonical coverage + conflict handling + relationship-aware selection**, then re-instrument token buckets.

---

## Genuine regressions vs evaluator artefacts

### Evaluator artefacts (do not drive architecture)

| Case | Why it’s E |
| --- | --- |
| Harbor credentials by 25 Aug | Negation/forbidden-match false positive on correct “not confirmed” |
| Harbor 15 Sep | Semantically correct “suggestion only / not formal replan” |
| Cascade Helen org design | Negation false positive on “no evidence Helen has completed…” |
| Quiet WCAG | Known “undecided” scorer issue |

### Genuine material regressions (drive next slice)

Harbor Elena · Quiet Alex (model underuse of compressed fact) · Cascade HR owner · Cascade Technology risk · Quiet budget · Quiet discovery candidates · Quiet November pilot connected reasoning · Meridian CAB chase completeness (partial) · Northline Tom contradictory sources (data quality).

---

## Regression classification table

Codes: **A** never in canonical knowledge · **B** in state, serializer omitted · **C** in prompt, selection removed · **D** model received but failed · **E** evaluator FN · **F** other (poisoned instructions / extraction artifact)

| Case | Class | Exact root cause |
| --- | --- | --- |
| `v1-harbor-q1-vendor-contact` | **A** (+ legacy History rescue) | Kickoff `knownTruth` omits Elena; capture `"Elena Voss is Harbor vendor contact"` fails `extractPeopleLines` (`is` ≠ `owns`); memories/history hold Elena but canonical omits History → CURRENT FACTS have no Elena. PR37 recovered via History/memories channel. |
| `v1-quiet-q1-pm` | **D** (+ partial A) | `"Alex Rivera PM; Sam Okada product"` **is** in CURRENT FACTS. Full `"Alex Rivera is Contoso delivery PM"` never enters people. Model answered “not specified” despite present fact → primarily **D**; role typing is under-structured. |
| `v1-cascade-q7-hr-owner` | **F** (poison) / **D** | Joint ownership **present** in `now` + `decisions` (`Helen and Omar jointly own…`). `findUnknownOwnerHints` still emits “Onboarding Process Design owner is not recorded” because no `responsibility` item → model follows KNOWN GAPS over the decision bullet. |
| `v1-cascade-q6-tech-risk` | **A** + **B** | Latest stage compresses to “acknowledged Technology risk”; capture `"…10 October…unless scope cut"` + identity cutover **not promoted**; detail lives in History; canonical does not attach History for this Q. Legacy prompt still contained “identity platform”. |
| `v1-quiet-q8-budget` | **A** | Latest stage dropped sparse-stage “budget TBC”; `"Budget is TBC after discovery"` not promoted to decisions/now; History truncated/unused. |
| `v1-quiet-q7-discovery-end` | **A** (intentional compression gone too far) | Current answer “not decided” retained; candidate claims “end August / mid-September” only in capture truth, not represented as conflicting evidence facts. |
| `v1-quiet-q9-will-we-hit` | **A** / selection | Hope line present; connected current facts (discovery conflict, no vendor, budget TBC) absent from latest stage / not linked → thin inference. |
| `v1-meridian-q6-what-blocks-cab` | **A** (partial) / **D** | Stage packs blockers into one open-loop; UAT→build→UX freeze chain not promoted from captures. Core CAB blockers present; completeness of chase chain incomplete. |
| `v1-meridian-q9-ops-slack` | **D** (mild) | Ops informal decision + unmet prereqs present in canonical; under-synthesis more than total loss. |
| `v1-northline-q5-tom-freeze` | **F** | Both `"Tom does not own UX sign-off in records"` and false `"Tom owns UX sign-off"` in `people` — extraction from `"No record that Tom owns UX sign-off."` |

---

## Case deep-dives (A–H)

### A. Harbor vendor contact — Elena

| Layer | Content |
| --- | --- |
| Capture knownTruth | `"Elena Voss is Harbor vendor contact"` |
| Kickoff stage knownTruth | Only integration target + credentials assumption — **no Elena** |
| `sections.people` | `[]` |
| Canonical CURRENT FACTS | No Elena |
| Baseline / legacy | Elena present (capture body in context document / History) |

**Class:** derivation loss at eval people extraction + stage omission + History exclusion = **A** for canonical knowledge; PR37 succeeded via multi-channel History.

### B. Quiet delivery PM — Alex

| Layer | Content |
| --- | --- |
| Stage sparse now | `"Alex Rivera PM; Sam Okada product"` — **present in canonical** |
| Capture role line | `"Alex Rivera is Contoso delivery PM"` — not extracted to people |
| PR38 answer | “not specified” despite Alex in CURRENT FACTS |

**Class:** **D** (model miss) with under-structured role representation.

### C. Cascade HR joint ownership — Helen + Omar

| Layer | Content |
| --- | --- |
| now | `"Helen+Omar joint HR process ownership overlapping"` |
| decisions | `"Helen and Omar jointly own HR onboarding process design — overlapping, not split"` |
| people | Nadia false positives from `confirmed` leave-regex — **not** Helen/Omar |
| needsConfirmation | `"Onboarding Process Design owner is not recorded."` ← poison |

**Class:** **F** — truth present; ownership gap machinery ignores joint prose and asserts unknown.

### D. Cascade Technology risk

Lost from canonical knowledge vs captures:

- identity platform cutover dependency  
- Technology cannot be ready before **10 October** unless scope cut  
- (Vikram mitigation **25 August** survives as open_loop)

Stage latest keeps only `"acknowledged Technology risk"`. Compound capture fact not promoted (`shouldPromoteQualifiedDecision` / stage blob rules). History has identity text; serializer leaves it out.

**Class:** **A** + **B** — over-compressed summary, not multi-fact risk graph.

### E. Quiet budget

Useful `"Budget is TBC after discovery"` exists on early capture / sparse stage but **not** on `qh-stage-latest` now. Not promoted. Canonical has no budget envelope fact → model says “approved budget not provided” without the useful TBC qualifier.

**Class:** **A** — need epistemic split: `approved budget = unknown` vs `budget envelope = TBC after discovery` as separate facts.

### F. Quiet discovery end

Current: `"Discovery end date not decided; casual conflict exists"` — good for “not decided”.  
Candidates `"end August"` / `"mid-September"` never become conflicting evidence facts.

**Recommendation (design only):** current fact `discovery_end = unresolved` + linked `candidate` facts (`epistemic=informal|conflicting`, `lifecycle=current`) without dumping full History.

### G. Quiet November pilot

`"November pilot still only a hope"` present. Connected facts for risk reasoning absent from latest stage / not one-hop selected.

**Class:** **A** + multi-hop selection gap.

### H. Meridian CAB / Ops

Core blockers present (no security approval, Snyk, UX freeze unsigned, rollback, Ops informal). Missing multi-hop chase detail (UAT blocked → build → UX freeze) from captures. Completeness regression more than total amnesia.

---

## Contradictory canonical input — Tom freeze

**Fixture intentionally traps speculation**, with capture knownTruth:

- `"Tom does not own UX sign-off in records"`

and narrative:

- `"No record that Tom owns UX sign-off."`

**Bug:** `extractPeopleLines` ownership regex matches `Tom owns UX sign-off` inside the denial sentence → invents positive ownership line.

**Canonical CURRENT FACTS therefore contain both polarities as `lifecycle=current` facts.** Exact-string dedupe cannot help (strings differ). No supersession/epistemic link.

**General architecture needed (not Tom-specific):**

1. Polarity-aware extraction (negation scope) **or** stop extracting ownership from free capture prose into current truth without Capture review.
2. When both assert and deny same `(person, scope)` → mark `epistemic=conflicting` / open Needs confirmation — do not ship both as confirmed current facts.
3. Prefer structured responsibility rows over regex mining of narrative.

---

## Legacy → canonical coverage map

| Kind | Source today | Transform | Names | Relationships | Qualifications | Compound | Contradictions | Provenance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people | `extractPeopleLines` on truth+content | Allowlist verbs only | Partial | Only `owns` | Weak | Collapsed | Broken (Tom) | None |
| responsibilities | Almost never until Confirm owner | — | — | Scoped only post-UI | — | — | — | user_confirmation only |
| dates/milestones | Stage prose; `timeline=[]` always in evals | Fact lines only | N/A | Weak | Often lost | Collapsed | No | None |
| decisions | Stage now + qualified capture promotion | Qualifier regex | Yes if in string | Weak | Better | Sometimes | No | None |
| risks | Heuristic copy of risk-like now lines | Same string | — | Lost | Often lost | **Collapsed** | No | None |
| dependencies | Rarely explicit | — | — | **Hole** | — | — | — | — |
| waiting/commitments | openLoops heuristics + todos (empty in evals) | Thin | Partial | Weak | Partial | Collapsed | No | None |
| unknowns | False KNOWN GAPS from ownership Q | Heuristic | — | Wrong | — | — | Creates false unknowns | — |
| conflicts | Stage one-liners | Compressed | — | — | Candidates dropped | Collapsed | **Not first-class** | None |

**Coverage holes:** contact/role people · joint responsibility · compound risk graphs · candidate/conflicting claims · capture truth not in latest stage · History-as-evidence never linked · eval stakeholders always `[]`.

---

## People / responsibility diagnosis

Preserved when fixture uses **`Name owns <scope>`** (Priya CAB, Ava UX).

Lost when fixture uses:

| Phrase type | Example | Needed structure |
| --- | --- | --- |
| Contact | Elena is Harbor vendor contact | `contact` relationship, not owner |
| Project role | Alex is Contoso delivery PM | `role` (delivery_pm), not owner |
| Joint responsibility | Helen and Omar jointly own HR onboarding… | `responsibility` with `joint: [Helen, Omar]`, scope |
| Mention | Jordan discussed Snyk | `mentioned` / non-authority |

**Do not** expand keyword lists as truth engine. Prefer Capture-proposed structured relationships + fixture/`knownTruth` typed hints for evals; legacy prose → provisional facts with `epistemic=legacy` until confirmed.

---

## Multi-hop retrieval

Canonical dump is compact but **flat**. Questions like “what puts the target at risk?” need **deterministic one-hop expansion**:

```
target 30 Sep
  → linked risk (Technology)
    → dependency (identity cutover)
    → earliest readiness 10 Oct
    → commitment (Vikram mitigation due 25 Aug)
```

Feasible in V1 with relationship edges / shared topic ids — **no extra AI pass**. Token impact: small (few extra compact facts), far cheaper than restoring History dumps.

Current strategy: send all current facts for the project (no real question selection beyond History gate + ownership gaps). So for present cases, loss is mostly **missing facts**, not over-aggressive selection — except ownership KNOWN GAPS acting as a harmful filter on interpretation.

---

## Token telemetry issue

`estimateLumeTokenBreakdown` still parses **legacy headers** (`Current position`, `Decisions`, `People & context`, …).

Canonical prompt uses **`CURRENT FACTS:` / `MILESTONES:` / `WAITING / OPEN:`**.

Result in PR38:

- `systemInstructions` ≈ 19,080 (= 45 × ~424) — **accurate**
- now/history/people/risks/decisions/todos = **0** — **false**
- Actual canonical prompt tokens (~12k suite) are **sent but unbucketed**
- **API `usage.total_tokens` (37,404) remains the reliable total**

Required buckets (design): `canonicalTruth`, `selectedEvidence`, `historicalEvidence`, `conversation`, `system`, `output`. Do not optimise from empty legacy buckets.

---

## Smallest corrective architecture (do not implement)

Prefer, in order:

1. **Coverage into canonical knowledge**
   - Carry capture `knownTruth` that is still current into structured facts (not only stage compression).
   - Represent people as typed relationships (role / contact / responsibility / joint), not `owns`-regex only.
   - Split compound risks into linked compact facts (min granularity below).

2. **Conflict handling**
   - Negation-safe extraction; conflicting pair → `epistemic=conflicting` + Needs confirmation.
   - Stop emitting unknown_owner KNOWN GAPS when matching prose/decision already asserts ownership (including joint).

3. **Evidence without History dump**
   - Attach **small selected evidence** for conflicts / historical Q / missing current fact lookups (cite ids), not full capture transcripts every time.

4. **One-hop structural retrieval** for risk/dependency questions.

5. **Fix token breakdown** for canonical headers.

Avoid: prompt-tuning cycle · keyword sprawl · restoring full History/stakeholder dumps · ontology explosion.

### Minimum granularity for compound risks

One legacy bullet → linked facts, e.g.:

- Technology readiness earliest: 10 Oct (`date`/`constraint`)  
- Dependency: identity platform cutover (`dependency`)  
- Exception: unless Technology scope reduced (`constraint`, informal until decided)  
- Commitment: Vikram mitigation due 25 Aug (`commitment`)

Enough for multi-hop; not a full PM schema.

---

## Expected token consequence

| Change | Directional impact |
| --- | --- |
| Carry missing current capture truths + typed people | **+ modest** (hundreds–low thousands suite) |
| Linked risk facts / one-hop edges | **+ small** |
| Selected evidence for conflicts only | **+ small**, bounded |
| Restore full History | **− cost win** — reject |
| Net vs PR37 49k | Likely stay near **~38–42k** if disciplined → ratio **~1.6–1.9×** GPT |

Preserving most of the **23.9%** reduction while recovering recall is realistic.

---

## Product direction (unchanged)

Capture = WRITE/PROPOSE · Knowledge Centre = READ/INSPECT/CORRECT · Advise = JUDGE.  
Deterministic suggestions from canonical Knowledge remain. No Knowledge Centre UI in this diagnostic.

---

## Recommendation

### `FIX CANONICAL COVERAGE — ARCHITECTURE STILL STRONG`

Trust held; cost win is real; regressions are explained by thin derivation + History exclusion + false ownership gaps + one extraction polarity bug — not by a failed architectural thesis. Next work: coverage/conflict/one-hop selection + telemetry — **not** rollback and **not** prompt tuning.
