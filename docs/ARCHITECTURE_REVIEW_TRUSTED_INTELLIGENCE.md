# Lume Architecture Review — Trusted Project Intelligence + Intelligent UI

**Status:** Read-only design investigation (no implementation)  
**Date:** 2026-08-18  
**Branch:** `cursor/architecture-review-c9f3`  
**Inputs:** Intelligence Contract v0.2 · Phase 2C.1/2C.2 · Model tidy (PR #37) · controlled run `MODEL TIDY COMPLETE PR37`

---

## Controlled benchmark context (same-model)

| Metric | Value |
| --- | --- |
| Lume / GPT model | `gpt-4o-mini-2024-07-18` / same |
| Same-model control | `true` |
| Lume pass | **30/45** |
| GPT pass | **32/45** |
| Trust / critical failures | **0 / 0** |
| Lume / GPT tokens | **49,157 / 21,470** (~**2.29×**) |

Estimated Lume input (suite sum): system **19,440** · history **8,483** · now **5,635** · decisions **3,767** · people **2,814** · risks **2,346**.  
Baseline: system **2,700** · context document **16,433**.

**Interpretation:** Trust behaviours from recent work are valuable and must not be casually undone. Headline pass rate does not yet justify the token premium. The goal is the **simplest architecture** that keeps trustworthy truth, useful reasoning, clear uncertainty, and **less redundant context** — not “shrink the prompt at all costs.”

---

## 1. Executive recommendation

Lume should become a **trusted project-intelligence product** with four hard contracts:

| Surface | Contract |
| --- | --- |
| **Capture** | WRITE / PROPOSE — messy input → proposed mutations → human review → provenance |
| **Knowledge** | MAINTAIN canonical project truth (structured where it earns its keep; narrative where life is messy) |
| **Tell Me** | READ / REASON — compact truth + selective evidence → Answer / Lume noticed / Needs confirmation |
| **Advise** | JUDGE — coaching/judgement, explicitly not recorded truth |

**Architectural thesis:** Lume’s moat is **maintained, epistemic project truth + intelligent correction UI**, not an ever-larger Tell Me prompt. Generic GPT already synthesises well from a flat document; Lume must win on **current-vs-historical, ownership restraint, contradiction/ambiguity, availability×dependency, and one-click correction that feeds future answers**.

**Do not:** another prompt-tuning cycle; agent/multi-pass/vector stacks without evidence; giant schema rewrite; badge-heavy Knowledge dashboard.

**Do:** evolve `knowledge_items` (+ light relationship fields) into canonical truth; demote History/memories/snapshots to **evidence/archive**; cut Tell Me context to **question-selected current truth**; move more trust guarantees into **data + UI + output schema**; keep one-pass model calls.

---

## 2. Current architecture map

### 2.1 Runtime shape

Canonical client shape is **`MissionState`** (`src/lib/types.ts`), loaded from Supabase by `loadMissionStateFromSupabase`.

Durable tables (workspace schema): `projects`, `stakeholders`, `todos`, `risks`, `knowledge_items`, `milestones`, `memories`, `recommendations`, `meetings`, `releases`, `capture_sessions`, `history_events`, `coach_sessions`, `project_intelligence_snapshots`, (+ billing/evals).

### 2.2 Knowledge today

`knowledge_items.section ∈ { now, decisions, risks, people, openLoops }` with free-text `body`.  
UI labels: Current position / Decisions / Risks & blockers / People & context / Waiting & open loops (`src/lib/knowledge.ts`). Cap ~8 bullets/section on merge.

**There is no first-class schema for:** confirmed / informal / superseded / conflicting / unknown / provenance / relationship type / availability windows / owner-of-scope.

Epistemic status lives in **prose + Tell Me system rules + retrieval heuristics**.

### 2.3 Overlapping stores (same semantic fact, many channels)

| Fact type | Where it can appear today |
| --- | --- |
| Current focus / position | `knowledge.now`, `projects.current_focus` / `summary`, snapshot `keyState` |
| Risk / blocker | `knowledge.risks`, `risks` table (folded into knowledge on load), recommendations `kind=risk`, snapshot `majorRisks`, release stage risks, history/memories narrative |
| People / ownership | `stakeholders`, `knowledge.people`, snapshot `keyStakeholders`, todo `waiting_on`, prose in `now` |
| Waiting / dependency | `knowledge.openLoops`, WAITING/CHASE todos, nudge frames, snapshot `keyDependencies` |
| Decisions / dates | `knowledge.decisions`, milestones, project date fields, history, memories, capture session JSON |
| Evidence | `memories`, `history_events`, `capture_sessions.result`, truncated History in Tell Me prompt |

**Conclusion:** We have **(B) several overlapping stores/directories that the model must reconcile every request**, presented as if they were one truth. Exact-string risk dedupe in `formatTellMePromptBlock` is a symptom, not a solution.

### 2.4 Surface map (as shipped)

| Product | Implementation | Mutates truth? |
| --- | --- | --- |
| Capture | `/api/capture` → findings → review UI → `applyOne` / `approveReady` | Only after user accept (primary path) |
| Knowledge | `ProjectKnowledgeBrief` + frames | Manual edit / Capture apply |
| Tell Me | `/api/tell-me` → `answerTellMeQuestion` | **No** (read-only) |
| Advise | Coach (`/api/coach`, drawer) — labelled Advise in UI | Recommendations → optional todos |

Contract docs already state the north star; **runtime context assembly has not yet caught up**.

---

## 3. Root causes of current token premium

Per-question approximate input (offline estimate): Lume **~978** vs GPT **~434**. Suite totals amplify fixed costs ×45.

### 3.1 System instructions (~432 tok/Q · ~19.4k suite)

`TELL_ME_SYSTEM` is only ~2.1k chars, but still **~7×** the baseline system. It encodes trust behaviours that Phase 2C proved necessary **because data does not enforce them**: ownership non-broadening, current-vs-history, epistemic status, qualification preservation, conversation non-authority.

**Root cause:** behavioural guarantees live in the prompt because truth is unstructured prose.

### 3.2 Repeated project channels

Every Tell Me call can ship:

1. Snapshot (summary of the same state)  
2. Knowledge sections (now / decisions / people / risks / openLoops)  
3. Structured buckets (todos / risks / milestones / history / meetings / releases / stakeholders)  
4. Conversation turns  
5. Freshness notes  

V1 fixtures often put narrative risk in Knowledge (structured Risks bucket ≈0 in estimates) while History still restates captures — **same story, multiple encodings**.

### 3.3 History as default context (~8.5k suite)

History is useful evidence but is treated as a **parallel truth channel**. Soft supersession (`refineHistoryForQuestion`, `SUPERSESSION_TOPICS`) helps trust but still sends substantial text.

### 3.4 Baseline comparison fairness note

Generic GPT gets one fair **context document** (~16.4k suite) — denser, less duplicated. Lume’s architecture tax is **multi-channel redundancy + larger instructions**, not “more total knowledge of the project.”

---

## 4. Target intelligence architecture

```
┌─────────────┐     propose       ┌──────────────────────┐
│   Capture   │ ───────────────►  │  Knowledge (truth)   │
│ WRITE/PROPOSE│   review/confirm │  canonical + epistemic│
└─────────────┘                   └──────────┬───────────┘
                                             │ read compact truth
┌─────────────┐     judge         ┌──────────▼───────────┐
│   Advise    │ ◄── truth + PM ── │      Tell Me         │
│   JUDGE     │     judgement     │   READ / REASON      │
└─────────────┘                   └──────────────────────┘
```

### Capture
Messy human input → extract **candidate mutations** → diff against canonical truth → classify new / update / contradiction / confirmation / historical / uncertain inference → **user review** → approved write with provenance. Never silent certainty.

### Knowledge
Single maintained model of what Lume **currently believes**, with history retained as superseded/evidence — not dumped as competing current channels.

### Tell Me
Read-only. Answer from compact current truth; retrieve evidence on demand or when citing; never write Knowledge. Output contract:

1. **Answer** — grounded, narrow  
2. **Lume noticed** — optional supported implications (interpretation, not auto-fact)  
3. **Needs confirmation** — optional material gaps/contradictions/ambiguities  

Explicit UI actions (`Confirm owner`, `Resolve date`, …) perform state change — not Tell Me itself.

### Advise
Separate coach path. Uses truth + general PM judgement. Must label advice vs recorded fact. Moving advisory rules out of Tell Me **shrinks Tell Me’s system prompt** and product confusion.

---

## 5. Canonical project truth model

### Design principle

**Smallest practical structured layer** on top of existing tables — not dozens of new entities. Prefer evolving `knowledge_items` + relationships over inventing a second brain schema.

### Conceptual types (challenge distinct tables)

| Concept | Structurally distinct? | Recommendation |
| --- | --- | --- |
| **Fact** (date, constraint, status claim) | Soft | One `project_facts` *or* enriched `knowledge_items` with `kind`, `status`, `valid_from/to`, `supersedes_id` |
| **Responsibility** (person → scope) | Yes | First-class relationship; never global “Owner” |
| **Decision** | Soft | Fact with `kind=decision` + confirmation status |
| **Dependency** | Yes when confirmed | Relationship edge; inferred edges stay in `ambiguities` until confirmed |
| **Availability** | Yes | Person-scoped windows (original Lume pain point) |
| **Risk / blocker** | Soft | Prefer **one** store (structured risk **or** knowledge risk) — stop dual-write |
| **Ambiguity** | Yes | `needs_confirmation` queue items — not more Knowledge bullets |
| **Evidence** | Yes | Pointers to capture/memory/history/manual edit — not full text in every prompt |

### Proposed minimum fields (logical; physical can start as jsonb columns)

For each truth item:

- `id`, `project_id`  
- `kind` (focus, date, responsibility, decision, risk, dependency, constraint, availability, …)  
- `subject` / `object` (e.g. person id, milestone id, free label)  
- `value` (display string + typed payload where useful: ISO date, enum)  
- `epistemic`: `confirmed | pending | informal | suggested | inferred | conflicting | unknown`  
- `lifecycle`: `current | superseded | historical`  
- `supersedes_id` / `superseded_by_id`  
- `provenance[]` (source type, source id, captured_at, quote)  
- `last_confirmed_at` (nullable; only where freshness matters)  
- `confidence` (from Capture proposal; not shown as certainty to users until confirmed)

### Mapping to existing tables

| Existing | Evolve how |
| --- | --- |
| `knowledge_items` | Add columns or jsonb metadata: epistemic, lifecycle, kind, entity refs, provenance ids. Keep `body` as display/narrative. |
| `stakeholders` | Become People entities; link responsibilities separately |
| `risks` | Either become canonical risk facts **or** deprecate writes in favour of knowledge — pick one path |
| `todos` / WAITING | Commitments & open loops; link to responsibilities |
| `milestones` | Canonical dates with type + supersession |
| `memories` / `history_events` / `capture_sessions` | **Evidence archive**, not current truth channels |
| `project_intelligence_snapshots` | Cache/UX summary only; never authoritative in Tell Me when live truth exists |
| `recommendations` | Advise/Capture coaching artefacts — not Knowledge |

### How surfaces use it

| Surface | Behaviour |
| --- | --- |
| Capture | Propose create/update/supersede/ambiguity rows; user confirms |
| Tell Me | Read `lifecycle=current` compact serialization; evidence by id on cite |
| UI | Entity render (@person, dates, status only when material); Needs confirmation from ambiguity rows |
| Advise | Same compact truth + judgement prompt |

---

## 6. Tell Me architecture

### Ideal V1 flow (one pass preferred)

```
Question
  → cheap intent signals (current vs historical, ownership-shaped, advisory→Advise handoff)
  → retrieve COMPACT current truth for project (typed facts, not 5 narrative sections × history)
  → attach only question-selected evidence (or none if current facts suffice)
  → single model call → structured JSON:
        answer | noticed[] | needsConfirmation[] | evidenceIds[] | confidence
  → UI renders entities + optional Confirm/Resolve actions (separate mutations)
```

### Alternatives considered

| Option | Verdict |
| --- | --- |
| A. One-pass + compact truth (above) | **Preferred V1** |
| B. Two-pass (retrieve then answer) | Only if A fails token/quality benchmarks |
| C. Agents / tools / vectors | **Avoid** until proven necessary — suite worlds are small; cost/complexity high |
| D. Keep multi-channel dump + longer prompt | Status quo — fails cost thesis |

### Output contract (product)

- **Answer** — required; narrow; grounded  
- **Lume noticed** — optional; implications/connections; never auto-written to Knowledge  
- **Needs confirmation** — optional; only material gaps; links to ambiguity ids when possible  

Tell Me remains read-only. Actions open Capture-like confirmation or dedicated resolve flows.

### System prompt strategy

Move guarantees out of prose rules into:

1. **Data** — only current facts retrieved; informal tagged; superseded excluded by default  
2. **Output schema** — forced fields for noticed / needsConfirmation / epistemic phrasing  
3. **Deterministic code** — advisory handoff; ownership topic filter as *retrieval* aid only  
4. **Short residual instructions** — refuse invention; cite ids; conversation non-authority  

Target: system closer to baseline scale (**≪ 400 tok**) once data carries epistemic load.

---

## 7. Capture architecture

Capture already has the right **product shape** (review before write). Contract should harden:

### Target flow

```
Messy input
  → AI (+ light local hints) propose state deltas against canonical truth
  → classify: new | update | contradiction | confirmation | historical | uncertain inference
  → review cards (ready / needs_review / unmatched) — existing UX
  → explicit approve
  → write truth + provenance + history retain previous values
  → open/resolve Needs confirmation items as side effect
```

### Differences from Tell Me (must stay sharp)

| | Capture | Tell Me |
| --- | --- | --- |
| Mutate | Propose → approve | Never |
| Goal | Change understanding safely | Answer from understanding |
| Risk | False certainty in Knowledge | Hallucinated recall |
| UI | Diff / confirm / dismiss | Answer / noticed / confirm gap |

### Do not

- Silently merge inferences into Knowledge  
- Use Tell Me answers as Capture authority  
- Grow keyword parsers into a second Capture brain — AI proposes, structure validates, human resolves ambiguity  

---

## 8. Intelligent UI

| Pattern | User value | Standard vs differentiator | V1 / Later / Avoid | Complexity |
| --- | --- | --- | --- | --- |
| `@Person` with scoped responsibility (`@Ava · UX sign-off`) | Clarity; prevents global-owner myth | **Lume differentiator** (scoped) | **V1** (render + hover) | M |
| Date entity + picker; current vs previous | Safe correction; supersession visible | Standard picker + **Lume** history | **V1** for milestone/go-live class | M |
| Epistemic chips (Confirmed / Informal / Unknown / Conflicting) — sparse | Trust at a glance | Standard-ish; restraint is Lume | **V1** only for material states | L if overused → keep ≤4 visible states |
| Responsibility as relationship, not “Owner” | Correct PM semantics | **Differentiator** | **V1** | M |
| Needs confirmation (project queue, prioritised) | Closes trust loop without Tell Me inventing | **Differentiator** | **V1** (small queue) | M |
| Conflict resolve (24 Sep vs 30 Sep + provenance) | Explicit truth maintenance | **Differentiator** | **V1** for dates/owners | M |
| Inferred dependency Confirm/Dismiss | Prevents silent graph growth | **Differentiator** | **Later** (after ambiguity queue works) | H |
| Evidence “Why does Lume think this?” on demand | Auditability | Expected in serious tools; **Lume** if one-click from fact | **V1** on demand | M |
| Freshness “still current?” | Only where decay matters | Standard; Lume if tied to approvals/dates | **Later** selective | M |
| Availability on person (`Away 1–12 Sep`) near commitments | Original pain point | **Core differentiator** | **V1** data + Later rich surfacing | M–H |
| Supersession reveal (Current / Previously) | History without prompt pollution | **Differentiator** | **V1** | L–M |
| One-click Wrong owner / Not current / Confirmed | Correction → future intelligence | **Differentiator** | **V1** | M |
| Tell Me Answer / Lume noticed / Needs confirmation layout | Separates fact vs inference vs gap | **Differentiator** | **V1** | M |
| Badge storm / AI warnings inbox | Noise, trust erosion | — | **Avoid** | — |
| Full enterprise resource graph UI | Overbuild | — | **Avoid** | — |
| Always-on evidence panels | Clutter | — | **Avoid** | — |

**USP filter (critical):** Differentiating workflows are those where Lume **understands project meaning** and lets the user **maintain truth cheaply** — missing ownership, conflicting dates, availability×milestone, supersession-aware answers, evidence on demand, correction that sticks. Mere @mentions or chips without epistemic discipline are **not** USPs.

---

## 9. AI vs deterministic vs human boundary

| Concern | Owner | Notes |
| --- | --- | --- |
| Entity IDs, ISO dates, lifecycle current/superseded | **Deterministic** | Schema + write path |
| Provenance links, confirmation status | **Deterministic** | |
| Explicit confirmed ownership / dependencies | **Deterministic** once confirmed | |
| Messy language → proposed facts | **AI** | Capture |
| Implication / “Lume noticed” | **AI** | Tell Me / Advise; not auto-truth |
| Question relevance / compact retrieval ranking | **AI optional**; start **deterministic + light heuristics** | Prefer simple |
| Natural-language answer phrasing | **AI** | |
| Conflicting credible sources | **Human** | Conflict UI |
| Unknown ownership / unclear authority | **Human** | Needs confirmation — **not** more keyword rules |
| Whether inference becomes truth | **Human** | Confirm/Dismiss |
| Advisory “what should I do” | **Advise (AI judgement)** | Not Tell Me |

### Explicit review of current helpers

| Helper | Keep as | Do not expand into |
| --- | --- | --- |
| `question-shape` / current vs historical | Retrieval routing | Truth determination |
| `ownership.ts` topic matching | Prompt pollution filter + offline fallback | Permanent ownership engine — **UI confirm** is the path (2C.2) |
| `SUPERSESSION_TOPICS` / history refine | Interim retrieval hack | Long-term truth model — replace with lifecycle fields |
| `extractKnowledgePatchFromText` keywords | Local fallback only | Canonical Capture brain |
| Capture local regex findings | Propose with low confidence | Silent writes |
| `localGroundedAnswer` | Offline degraded mode | Production truth source when API present |

**Rule:** Keyword detection may help **routing**; it must not **determine** project truth.

---

## 10. Expected token impact

Directional only (same model, Official V1 suite input). Baseline today ~**2.29×**.

| Lever | Est. suite impact | Notes |
| --- | --- | --- |
| Stop shipping History by default; evidence on cite/historical Q | **−5k to −8k** | Biggest structured win after system |
| Collapse duplicate now/people/risks/stakeholders channels | **−3k to −6k** | Canonical serialization once |
| Shrink system via schema+output contract | **−8k to −12k** suite (**~200–300 tok/Q**) | Requires epistemic data |
| Drop snapshot from hot path when live truth present | **−small** | Avoid double summary |
| Question-selected facts only | **−variable** | Keep completeness on multi-hop Qs |

**Plausible medium-term target:** Lume input **≲ 1.3–1.5×** baseline while **holding trust/critical at 0** and improving ambiguity/ownership cases via UI — not by dumping more text.

**Must remain every request (compact):** project identity · current facts relevant to intent · epistemic tags on those facts · short residual system rules.

**Question-selected:** history/evidence · full stakeholder directory · deep decision log · meetings/releases.

**Evidence on demand:** capture quotes · raw memories · “why” provenance.

**Redundant with canonical state:** snapshot key* fields mirroring knowledge; parallel risk table + knowledge risk; people bullets that only restate stakeholders; History lines that duplicate Current position.

---

## 11. Migration plan

Incremental, reversible, live SaaS-safe.

### Stage 0 — Freeze behaviour, instrument (done / keep)

Model tidy + token buckets + same-model control. No intelligence redesign mid-flight.

### Stage 1 — Truth metadata on `knowledge_items` (compat)

- Add nullable columns/jsonb: `epistemic`, `lifecycle`, `kind`, `metadata`, `supersedes_id`, `last_confirmed_at`, `provenance`  
- Default: `lifecycle=current`, `epistemic=confirmed` for existing rows (honest: “legacy assumed”)  
- Writers ignore new fields until enabled  
- **Risk:** low · **Rollback:** stop reading new fields  
- **Benchmark:** no score change expected  

### Stage 2 — Canonical read path for Tell Me

- Build `serializeCanonicalTruth(project, intent)` → compact block  
- Feature-flag Tell Me to prefer it; keep old prompt builder behind flag  
- History only if historical intent or citation needed  
- **Risk:** medium (quality) · **Rollback:** flag off  
- **Benchmark:** token ↓; trust must stay 0; pass ≥ prior  

### Stage 3 — Capture writes metadata + ambiguities table/queue

- Capture approve sets epistemic/lifecycle/supersession  
- Contradictions → Needs confirmation items (not silent pick)  
- **Risk:** medium · **Backfill:** optional scripts from prose heuristics (non-authoritative)  
- **Rollback:** write legacy bullets only  

### Stage 4 — Intelligent UI slice

- Tell Me three-part render  
- @person + scoped responsibility hover  
- Date supersession + resolve  
- Needs confirmation entry points  
- **Risk:** UX noise if over-badged — ship calm defaults  

### Stage 5 — Unify risks / demote snapshot authority / Advise prompt split

- Single risk source of truth  
- Snapshot = UX cache only  
- Move advisory instructions fully to Coach  
- **Risk:** medium schema cleanup · migrate carefully  

Avoid big-bang table rewrite. Prefer flags + dual-read.

---

## 12. Evaluation strategy

Keep Official V1 45-case suite as **regression** (especially trust/critical = 0).

### Evolve dimensions (architecture-aware)

| Dimension | What it proves |
| --- | --- |
| Canonical truth correctness | Current fact wins over history without prompt hacks |
| Capture update correctness | Approve writes expected mutation + provenance |
| Ambiguity detection | Needs confirmation when owner/date conflict unknown |
| Tell Me read-only | No Knowledge mutation from Ask |
| Evidence provenance | Claims cite real sources |
| Token footprint | Same-model ratio vs baseline |
| UI resolution (optional harness) | Confirm owner → subsequent Tell Me pass |

### Worlds

Reuse Meridian / Northline / Harbor / Cascade / Quiet — they already encode supersession, informal, ownership traps.

### Holdout

Add a **small hidden set (8–12 cases)** not used for day-to-day tuning: new phrasings of ownership/conflict/availability. Guard against architecture overfitting to V1 wording.

### Process rule

After architecture slices: **one controlled same-model run** + token breakdown. **No** prompt-tuning spiral between slices unless trust regressions appear.

---

## 13. Risks / challenges

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Over-structuring messy projects | Real PM life is narrative | Keep `body`/notes; structure only high-leverage kinds |
| Brittle keyword rules | Already hitting diminishing returns (2C.2) | UI confirmation; freeze ownership keyword growth |
| UI noise | Badge fatigue destroys calm brand | Sparse states; Needs confirmation ≠ inbox spam |
| Trust erosion | Wrong structured fact worse than vague bullet | Default uncertain → human; never silent inference→truth |
| Migration complexity | Live tenants | Flags, dual-read, no forced backfill correctness claims |
| False confidence | Epistemic labels mis-set | Legacy “assumed”; show evidence |
| Information decay | Stale “confirmed” | Selective freshness only |
| Pass-rate tunnel vision | GPT may still win broad synthesis | Optimise trust + differentiation + tokens, not pass alone |
| Capture/Tell Me contract bleed | Users treat Tell Me as editor | Hard UI separation; explicit confirm flows |

---

## 14. Recommended first implementation slice

**Hypothesis to test:** *Compact canonical current truth + structured Tell Me output (Answer / noticed / needsConfirmation) + one confirmation UI path (unknown ownership) can cut tokens materially while holding trust/critical at 0 — without further prompt tuning.*

### Slice contents (implementation plan later — not this task)

1. **Schema:** nullable epistemic/lifecycle/provenance on `knowledge_items` (or equivalent jsonb).  
2. **Tell Me read path (flagged):** serialize current Knowledge once (deduped); omit History by default for current-state questions; keep short system + JSON output with `noticed` / `needsConfirmation`.  
3. **UI:** render those three blocks; for `needsConfirmation` of type ownership → **Confirm owner** action writing a confirmed responsibility (Capture-grade mutation, not Tell Me write).  
4. **Evals:** same-model Official V1 + token buckets; add 2–3 ownership-ambiguity cases asserting Needs confirmation rather than invention.  

**Out of scope for first slice:** availability graph, dependency confirmations, vector retrieval, Advise rewrite, full entity redesign, badge dashboard.

**Success criteria:**

- Trust failures = 0, critical = 0  
- Token ratio clearly down (directionally toward ≤1.7× as stretch; any solid drop with flat/better trust is learning)  
- At least one ownership-gap case shows Needs confirmation instead of guess  
- No silent Knowledge writes from Tell Me  

---

## Appendix A — USP analysis (what actually differentiates)

| Behaviour | vs ChatGPT | vs notes | vs classic PM tools | USP? |
| --- | --- | --- | --- | --- |
| Maintain current vs historical without user re-explaining | Weak | Weak | Partial | **Yes** |
| Refuse invented ownership; queue confirm | Weak | N/A | Fields exist but dumb | **Yes** |
| Informal ≠ official | Weak | N/A | Rare | **Yes** |
| Availability × milestone risk | Possible in chat, not sticky | No | Partial | **Yes** if sticky in truth |
| Evidence “why” one click | Rare | No | Audit trails heavy | **Yes** if lightweight |
| One-click correction → future answers | No | Manual | Manual | **Yes** |
| Pretty @mentions alone | Commodity | — | Commodity | **No** |
| Generic AI warning inbox | Commodity noise | — | Commodity | **No** |
| Longer prompts | Cost centre | — | — | **No** |

---

## Appendix B — Pointers into code (investigation anchors)

- Truth load: `src/lib/data/supabase/load-mission-state.ts`  
- Knowledge: `src/lib/knowledge.ts`, `knowledge_items` migration  
- Tell Me: `src/lib/tell-me/answer.ts`, `context.ts`, `ownership.ts`, `question-shape.ts`  
- Capture review: `src/components/capture/*`, `src/lib/capture/review/*`  
- Advise/Coach: `src/lib/pm-coach.ts`, `IntelligenceLoopStrip.tsx`  
- Contract: `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md`  
- Cost: `docs/MODEL_TIDY_HANDOVER.md`, `src/lib/evals/token-breakdown.ts`  

---

## Final recommendation

### `ARCHITECTURE DIRECTION STRONG — PROCEED TO IMPLEMENTATION PLAN`

Direction is clear, grounded in measured cost/trust tradeoffs, compatible with the Intelligence Contract, and sliceable without a rewrite. **Do not** start another prompt-tuning iteration. Next work product should be a concrete **implementation plan for Slice 1** only.
