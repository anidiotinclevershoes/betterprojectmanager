# Phase 2B — Real Intelligence Benchmark Suite

**Branch:** `cursor/phase2b-intelligence-benchmark-c9f3`  
**Date:** 2026-08-18  
**Audience:** Product / development lead AI preparing Phase 2C  
**Authoritative behavioural spec:** `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md` (v0.2, committed verbatim)

---

## Confirmations (required)

| Item | Status |
|------|--------|
| Contract file in repo | **Yes** — `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md` |
| Lume Capture / Tell Me / Advise / prompts / retrieval changed? | **No** |
| Official suite separate from harness sample? | **Yes** (`kind: official` vs `kind: sample`) |
| Untouched Lume baseline `Pre-Intelligence-Changes v1` executed in this agent? | **No** — `OPENAI_API_KEY` unavailable in the cloud agent environment |
| How to run baseline | `/evals` UI (suite = official V1, label defaulted) **or** `npm run evals:pre-baseline` with OpenAI configured |

---

## A. Benchmark overview

| Field | Value |
|-------|--------|
| Name / version | `lume-intelligence-benchmark-v1` |
| Label | V1 Intelligence Benchmark (Pre-Intelligence-Changes baseline suite) |
| Worlds | **5** |
| Cases | **45** (9 × 5) |
| Multi-evidence (heuristic registry count) | **20 / 45 (~44%)** — meets ≥25–30% intent |
| Uncertainty / negative-leaning | **20** cases tagged `expectUncertainty` and/or `uncertainty` |
| Critical-insight cases | **9** |
| Harness sample (not in V1 score) | `sample-0.1.0` — ATLAS Cutover, 5 cases |

### Category distribution (case tags; multi-tag allowed)

| Dimension | Cases tagged |
|-----------|--------------|
| accuracy | 30 |
| restraint | 28 |
| trust | 27 |
| uncertainty | 20 |
| people | 19 |
| grounding | 16 |
| recall | 12 |
| dependency | 11 |
| temporal | 10 |
| actionability | 9 |
| inference | 8 |
| contradiction | 4 |
| prioritisation | 3 |

---

## B. Worlds

### World A — MERIDIAN (Release / CAB / regulated)

- **Scenario:** Contoso Retail card-payments release; CAB, Snyk, security, UAT, rollback.
- **Stages:** kickoff → reschedule/Snyk → UAT/rollback constraints → pre-CAB latest.
- **Tests:** §4 current vs historical dates; §5 speculation≠decision; §9 multi-hop dependency; §15 scheduled≠approved; §22 critical (false “can proceed” / false approval).

### World B — NORTHLINE (People / availability)

- **Scenario:** CRM redesign; sole UX approver on leave; BA cover limits; ownership proximity.
- **Tests:** §7 owns vs discussed; §8 availability→SPOF; §10 commitments; inventing security owner.

### World C — HARBOR (Vendor / external dependency)

- **Scenario:** Harbor Data Hub API; delayed credentials; unsigned MSA; informal rate limits.
- **Tests:** §5 assumption≠confirmation; §9 prerequisite chains; §10 chase list; mocks≠integration tests.

### World D — CASCADE (Messy multi-stream)

- **Scenario:** Org/Process/Tech streams; conflicting go-live claims; HR scope expansion; stale status.
- **Tests:** §6 contradictions; §4–5 stale updates; overlapping ownership; conditional≠decided.

### World E — QUIET (High ambiguity)

- **Scenario:** Early citizen portal with sparse records.
- **Tests:** §§2,13–15 — not recorded dates/owners/budget; hope≠commitment; rumour≠selection; refuse forecast.

---

## C. Evaluation methodology

### Lume path (unchanged intelligence)

For each case at its stage:

1. Build `MissionState` from captures up to that stage (`buildMissionStateForStage`).
2. Call **`answerTellMeQuestion`** (real Tell Me path, `snapshot: null`).
3. Score with existing deterministic scorer.

### GPT baseline (fair)

1. Same stage → same `contextDocument` (project header, stage summary, known truth bullets, chronological captures).
2. System prompt `gpt-baseline-v1` (neutral; no sabotage).
3. Model: `OPENAI_MODEL` or `gpt-4o-mini`; temperature `0.2`.
4. User message: `PROJECT INFORMATION:` + document + `QUESTION:`.

**Asymmetry (documented, intentional product difference):** Lume receives structured `MissionState` (memories, knowledge sections) via Tell Me context assembly; GPT receives the flat markdown evidence pack. Facts are the same; packaging differs.

### Automated scoring

Existing Phase 2A scorer: expected-fact coverage, forbidden claims → trust_failure, missed criticalInsight → critical_intelligence_failure, uncertainty/contradiction heuristics, category-scoped dimensions.

### Manual review

Unchanged: annotations do not mutate model answers; automated band preserved separately.

### Wins / ties

Unchanged compare helpers on automated bands.

---

## D. Fairness assessment

| Concern | Assessment |
|---------|------------|
| Same underlying stage facts? | **Yes** |
| Baseline crippled? | **No** |
| Extra Lume-only secret facts? | **No** |
| Packaging asymmetry | Structured MissionState vs markdown — represents real product path vs paste-into-GPT |
| Capture/Advise not in suite | By design for Phase 2B Tell Me focus |

---

## E. Official baseline result — `Pre-Intelligence-Changes v1`

**Not executed in this environment.**

| Metric | Value |
|--------|--------|
| Lume pass rate | *pending live run* |
| GPT pass rate | *pending live run* |
| Lume / GPT / ties | *pending* |
| Trust failures | *pending* |
| Critical intelligence failures | *pending* |
| Dimension breakdown | *pending* |
| Token usage | *pending* |

### Founder / CI execution

1. Ensure `OPENAI_API_KEY` (and preferred model) on the machine or Vercel.
2. Either:
   - Open `/evals` as allowlisted user → suite **Official V1** → label **`Pre-Intelligence-Changes v1`** → Run, **or**
   - `npm run evals:pre-baseline` (forces filesystem store locally).
3. For durable history on Vercel: `eval_runs` migration + `SUPABASE_SERVICE_ROLE_KEY`.
4. Spot-check fails/partials with manual review before Phase 2C.

---

## F. Failure analysis

Deferred until `Pre-Intelligence-Changes v1` completes. Expected clusters to watch (from Contract + suite design):

- Multi-hop dependency misses (§9)
- Scheduled/assumed treated as approved (§15)
- Stale or speculative “latest” wins incorrectly (§5)
- Weak uncertainty / invented owners-dates (§2)
- Contradiction smoothing (§6)

**Do not change intelligence based on this document alone.**

---

## G. GPT comparison

Deferred until baseline run. Commercially critical once numbers exist.

---

## H. Evaluator quality / suspected issues

Known limitations of the **deterministic** scorer (pre-existing; not “fixed by making Lume look better”):

1. **Keyword / substring matching** can mark a good nuanced answer partial if expected tokens differ (e.g. “Priya Shah” vs “Priya”).
2. **`expectUncertainty`** heuristics may disagree with a correct crisp “No” grounded in explicit negative evidence (Contract allows decisive answers when evidence is clear — §13).
3. **Answer structure §16** (direct → reason → optional “Lume noticed”) is **not** fully auto-scored.
4. **Prioritisation §12** is lightly tagged; hard to score without a judge model.
5. Manual review remains mandatory for all Lume fail/partial on the official baseline.

Correct rubrics before Phase 2C if spot-check shows systematic evaluator false fails — prefer fixing fixtures/scorer notes over changing Lume.

---

## I. Recommendation for Phase 2C (do not implement yet)

Once baseline numbers exist, prioritise Contract behaviours likely to differentiate vs paste-into-GPT:

1. **Dependency graph / prerequisite checking before “can we start?” answers (§9)**  
2. **Stronger approval/ownership restraint (§15) — scheduled ≠ done; discussed ≠ owns**  
3. **Supersession policy that ignores speculation (§5)**  
4. **Contradiction surfacing (§6)**  
5. **Availability × ownership connections (§8)**  

Avoid fashionable architecture until these behavioural gaps are measured.

---

## Contract → suite coverage map

| Contract section | Represented in V1 cases? | Notes |
|------------------|--------------------------|-------|
| §1 Think broadly, answer narrowly | Partial | Actionability/prioritisation cases; structure not auto-scored |
| §2 Trust before cleverness | Yes | Quiet + restraint worlds |
| §3 Connections + careful certainty | Yes | Northline leave×freeze; Meridian UAT chain |
| §4 Current vs historical | Yes | Meridian original vs current dates |
| §5 Newer ≠ automatically correct | Yes | CAB Wed speculation; Harbor 15 Sep suggestion |
| §6 Contradictions | Yes | Cascade date conflict; Quiet discovery end |
| §7 People / responsibility | Yes | Jordan≠security; Riley limits; joint HR ownership |
| §8 Availability | Yes | Ava leave / SPOF |
| §9 Dependency reasoning | Yes | Meridian UAT; Harbor integration; Northline build |
| §10 Commitments / waiting | Yes | Ava summary; Elena confirmation; Vikram mitigation |
| §11 Risk / implication | Yes | Cascade tech risk; Northline SPOF |
| §12 Relevant ≠ useful | Partial | Chase questions; weak auto score |
| §13 Uncertainty | Yes | Many Quiet/Harbor cases |
| §14 Clarification | Partial | Contradiction cases; no UI clarification flow measured |
| §15 Restraint | Yes | Security approval; Nimbus; rate limit |
| §16 Answer structure | **Not measurable** in harness | Flag for future |
| §17 Tell Me vs Advise | Partial | Tell Me-only suite; Advise not evaluated |
| §18 Capture | **Not measurable** | Out of scope Phase 2B |
| §19 Knowledge maintenance | **Not measurable** | Fixture-built knowledge only |
| §20 UI as intelligence | **Not measurable** | |
| §21 Proportionate AI | **Not measurable** | |
| §22 Failure hierarchy | Yes | trust + critical wired |
| §23–24 Benchmark / GPT compare | Yes | Suite + fair baseline |
| §25 Versioning | Yes | `lume-intelligence-benchmark-v1` + run metadata |
| §26 North Star | Guiding | Qualitative |

---

## Minimal harness changes (Phase 2B)

1. Manifest `kind: "sample" | "official"`.
2. Registry: official V1 default; sample retained; `benchmarkVersion` on run API + UI selector.
3. Generalized people extraction in `build-state` (removed Sarah/Marcus/Nina hardcoding).
4. `summarizeBenchmark`, `npm run evals:pre-baseline`.
5. **No** Lume intelligence / prompt / retrieval changes.

---

## J. Repository state

| Item | Value |
|------|--------|
| Branch | `cursor/phase2b-intelligence-benchmark-c9f3` |
| Contract commit | `docs: add Lume Intelligence Contract v0.2…` (pushed) |
| Suite + harness | this Phase 2B commit set |
| Merged to main? | **No** — PR required |
| Migrations | Existing `eval_runs` only; no new migration |
| Config | `LUME_EVAL_ALLOWED_EMAILS`, `OPENAI_API_KEY`, optional service role |

### Founder merge (PowerShell)

```powershell
cd C:\Users\spudh\betterprojectmanager
git checkout main
git pull origin main
git fetch origin cursor/phase2b-intelligence-benchmark-c9f3
git merge origin/cursor/phase2b-intelligence-benchmark-c9f3
git push origin main
```

Then run **`Pre-Intelligence-Changes v1`** on Production/Preview with OpenAI configured.

---

## Verdict

### `BENCHMARK NOT YET RELIABLE`

**Exact blocker for Phase 2C:** the official untouched baseline run labelled **`Pre-Intelligence-Changes v1` has not been executed**, so there is no honest Lume-vs-GPT measurement to drive intelligence changes.

**What is ready:** Contract in repo; 45-case official suite mapped to Contract; sample isolated; harness selection; verification scripts green (`npm run verify:evals`).

**After** the baseline run + brief manual review of fails/partials, re-issue the Phase 2C go/no-go. If the suite and scorer look sound, upgrade verdict to **BENCHMARK READY — PROCEED TO INTELLIGENCE IMPROVEMENT**.
