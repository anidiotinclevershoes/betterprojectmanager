# LUME v0.9 LIVE 100-CAPTURE QUALIFICATION

**TEST / RELEASE QUALIFICATION ONLY. Production was not modified. Do not merge.**

Candidate production: PR **#110** (`cursor/v09-shared-truth-hardening-9524` @ `95ac3680d2817efd62c42d4257ef76093dc65bf6`).

This branch: `cursor/v1-v09-live-100-610b` (PR **#112**).

Scenario: unchanged Northstar 100 from PR **#108**. Oracle expected truth was not edited. Live observations were not repaired before Apply.

---

## 1. Executive verdict

**STRUCTURAL PROBLEM REAPPEARED**

The live 100 completed (100/100 captures, 130 counted AI calls + 12 analyse-only extracts, no safety stop). Persistence reloaded at every checkpoint. Atlas was not mutated. That is not enough.

After 100 live Captures, Northstar is **not a maintained project**. People = `[]`. The one milestone is a CAB sentence whose date wandered 18 → 16 → 20 → 18. The one risk is a 24-hour CAB-pack *rule* stored as a risk. To-do titles are still capture prose. Identity only bound four keys, and three of those are sentence-titles.

| Axis | Verdict | Why |
| --- | --- | --- |
| Truth longevity | **RED** | 0 people for the entire run. Priya never created. One milestone absorbed UAT/CAB/release. Current board is not the project the 100 updates described. |
| Capture extract quality | **RED** *(LIVE-PROVEN)* | C1 bound Priya to the seed to-do. 15 `person/create_new` rows omitted `proposedValues.name`. `truthIntent` almost never emitted `non_current` (6/229). A=5, B=1, E=6. |
| Apply / persist | **RED** *(LIVE-PROVEN)* | 56 captures produced Ready write rows; only 23 persisted anything. **G=37** Ready applies returned `executed.kind !== "wrote"` with **zero thrown exceptions**. |
| Ask honesty | **AMBER** *(LIVE-PROVEN)* | `not_found` is decent when the board is empty. Late Ask invents a 27 October release with `direct_confirmation` and invents SSO/Jordan reasons from thin History. |
| Token / cost growth | **AMBER** *(LIVE-PROVEN, misleadingly small)* | Extract prompt 2.8k → 3.2k chars (1.13×). Growth is small **because current truth never filled in**. Not a quality win. |
| Persistence / reload / isolation | **GREEN** | 100/100 completed. Reload matched at CK1/10/25/50/75/100. Atlas Quinn Adler + ledger to-do untouched. `stoppedAt` null. |

Oracle `divergenceCount: 100` is **not** the release metric (string compare vs the #108 expected world). The release metric is the A–G taxonomy below.

**Do not treat this as a v0.9 release candidate.** Do not merge #108, #110, #111, or #112 on the back of this run.

---

## 2. Run environment

| | |
| --- | --- |
| Production candidate | PR #110 `cursor/v09-shared-truth-hardening-9524` @ `95ac368` |
| Harness branch | `cursor/v1-v09-live-100-610b` @ `253eaa3591db2d0ee3f8c6ca105b5355e208d820` |
| CI live-100 | [run 33307350137](https://github.com/anidiotinclevershoes/betterprojectmanager/actions/runs/33307350137) **SUCCESS** (~8 min) |
| Artefact `harnessSha` | `2c099e467e81ba10a9a666f42130b7ebdf19d04b` (Actions `pull_request` merge commit; not on the branch tip) |
| mode | **live** |
| model | `gpt-4o-mini-2024-07-18` |
| persist | disposable local Supabase (`supabase start` on `ubuntu-latest`) |
| FakeWorkspaceClient | **false** |
| oracle envelopes / regex Capture / `localCaptureFallback` | **false** |
| captures attempted / completed | **100 / 100** |
| live extract calls | 100 |
| Ask calls | 30 (5 probes × 6 checkpoints) |
| Analyse-only probes | 12 (never Applied) |
| total AI calls (summary field) | 130 (= extract + Ask; analyse extra) |
| provider calls including analyse | **142** |
| elapsed | 354417 ms |
| stoppedAt | `null` |
| firstDivergence | C1 `people.person:priya-shah: expected Priya Shah actual (missing)` |
| Cursor VM | blocked (no `OPENAI_API_KEY`, no Docker). CI was the live path. |

Proof labels:

- Persistence / Apply / History / reload — **LIVE-PROVEN** disposable Supabase
- Extract quality — **LIVE-PROVEN** `extractObservationsWithOpenAI`
- Ask answers — **LIVE-PROVEN** `answerTellMeQuestion`
- Token API usage — **LIVE-PROVEN** OpenAI `usage`
- UI pages / Playwright — **not run** on this workflow

Command (CI):

```bash
npm run stress:project-longhaul -- --captures=100 --mode=live --out=longhaul-100-live
```

Live mode requires `OPENAI_API_KEY` and disposable Supabase. It exits 2 rather than falling back to Fake or envelopes.

e2e / regression / Vercel reds on PR #112 are Harbourline / #110 issues. Out of scope. The `live-100` job is the qualification job.

---

## 3. Project at Capture 100

Northstar Member Portal Renewal after 100 live updates:

**People: none.** Priya Shah, Liam Brooks, Sarah Okonkwo, Sarah Kim, Marcus Chen, Elena Voss, Jordan Hale, and everyone else are missing. Atlas still has Quinn Adler.

**Dates:** one timeline row, label `CAB is scheduled for 18 October 2026.`, `startAt` 18 October 2026. There is no UAT-start row and no Release row. The same CAB id absorbed later “UAT moves to 20th / 16th” writes.

**Open work (5):**

| Title | done | due |
| --- | --- | --- |
| Confirm project baseline with key stakeholders *(seed)* | false | 26 Oct |
| A to-do for login error handling needs to be added. | false | 17 Oct |
| A new to-do for vendor contract check needs to be added for Liam. | false | — |
| Member communications are still due on 26 Oct. | false | — |
| Password-reset regression is done. | **false** | — |

**Risks (1):** `There are no exceptions to the rule about CAB packs.` status `watch`. API timeout and vendor-delay never became their own rows.

**Knowledge / decisions that did land** (not in the compact truth snapshot, but present in MissionState): feature-flag cutover; SSO in / marketing widgets out; “not swapping processors”; weekend cutover rejected; “go on 27 October”; member comms day-before-release (the C51 unsafe Ready write).

This does **not** read as the project the 100 updates built. It reads as a nearly empty board with a handful of sentence-titles and a decision list that drifted in sideways.

Identity map at C100:

```
todo:login-error-handling
milestone:uat-start   → the CAB-labelled row
todo:vendor-contract-check
todo:feature-flag-cleanup  → “Password-reset regression is done.”
```

---

## 4. Truth integrity

| Check | Result |
| --- | --- |
| Reload after every capture / checkpoint | **OK** (`reloadOk: true` at CK1/10/25/50/75/100) |
| Wrong-project write to Atlas | **none**. Safety stop never fired. |
| Atlas at C100 | Quinn Adler + “Close the billing ledger” unchanged |
| Duplicate person identity | **none** (there were no people to duplicate) |
| Needs You wrote current truth | **no** for expected-Needs-You captures that stayed Needs You (C42, C50). **yes** for silent captures that wrote (A). |
| History after successful write | History 1 → 26. Generic titles (`Capture added a To Do`). |
| History on Needs You / no_change | No extra History when Apply did not write |
| Atomic persist | Mean **2.29** observations/capture (min 1, max 9). Dense captures often split facts. Apply then dropped siblings (C11: 3 milestone creates, 1 wrote). |
| `truthIntent` | 201 `current` / 22 `uncertain` / 6 `non_current` across 229 observations |

**Person-create contract (structural).** `runCaptureV2FromModelJson` refuses `person/create_new` unless `proposedValues.name` or `candidateTargetTitle` is a usable name (`resolve.ts`: “A new person needs a name before Lume will write a stakeholder.”). The extract schema in `buildObservationExtractionPrompt` lists `proposedValues` as `{ status, date, ownershipSemantics }` — **no `name`**. All 15 live `person/create_new` rows had `proposedValues: {}` or `null`. Resolve therefore stayed Needs You. People never entered current truth. Later captures then targeted the seed to-do or the CAB-pack risk.

That is not a Fake/harness bug. It is the #110 extract schema vs resolve contract, live-proven.

**Apply after Ready (G).** Harness policy: Apply only resolve-`write` rows. `applyFailed` is set when `executed.kind !== "wrote"`. No `applyError` exceptions were thrown. Production Apply returned `needs_you` / `no_change` / `failed` after Extract+resolve had already said Ready — stale expected target, Apply re-plan, or persist hook catch. 33 of 37 G captures persisted **zero** of their Ready rows; 4 were partial.

---

## 5. Truth checkpoint table

| CK | People | Todos | Risks | Milestone label / date | History | Reload |
| ---: | ---: | ---: | ---: | --- | ---: | --- |
| 1 | 0 | 1 (seed) | 0 | — | 1 | OK |
| 10 | 0 | 2 | 1 (CAB-pack rule, open) | — | 4 | OK |
| 25 | 0 | 2 | 1 | CAB sentence / 18 Oct | 6 | OK |
| 50 | 0 | 3 | 1 | CAB sentence / **16 Oct** | 14 | OK |
| 75 | 0 | 3 | 1 (watch) | CAB sentence / **20 Oct** | 20 | OK |
| 100 | 0 | 5 | 1 (watch) | CAB sentence / **18 Oct** | 26 | OK |

Search at C100: `Priya Shah` 0 hits; `UAT` 0; `API timeout` 0; `CAB` 3 (the malformed risk + the CAB sentence); `feature flags` 2 (decision text).

---

## 6. Capture quality over time

Live taxonomy (a capture may carry more than one letter; `correct` is exclusive when no letter fired):

| Letter | n | Meaning |
| --- | ---: | --- |
| **A** | **5** | Silent / no-change capture wrote current truth |
| **B** | **1** | Unsafe Ready on an ambiguous capture |
| C | 24 | Conservative Needs You (truth safe; often a missed write) |
| D | 14 | Expected fact never observed |
| **E** | **6** | Wrong `truthIntent` on dated / stale captures |
| F | 4 | Extra create / wording |
| **G** | **37** | Apply failed after Ready |
| correct | 25 | |

### A — wrote when the capture should have been silent

| Cap | What happened |
| ---: | --- |
| 30 | “API timeout is still open… not changing it” updated the CAB-pack-rule risk to `open` |
| 46 | Chatter write (“Priya, Marcus and Jordan are all in the 11am working session”) |
| 76 | Weekend cutover rejected — wrote current decision/date (`truthIntent=current,current`) |
| 78 | Quoted RAID UAT 14th — applied a current write |
| 95 | Dense dump classified Ready and persisted at least one row (also G) |

### B — unsafe Ready

**C51** “Sarah said the member comms can go out the day before release.” Two Sarahs are on the project in the oracle. Live extract emitted a `decision/create_new` and Apply **wrote** it. C42 (“Sarah said the CAB pack needs a threat model”) correctly stayed Needs You. Same first-name trap; one safe, one not.

### C — conservative Needs You (24)

Includes the entire opening people sequence (C1–C4, C6, …) and C42 / C50 (correct ambiguity). Truth stayed safe. Automation was missed: the project never gained a delivery PM.

C1 detail (the poison):

- Input: “Kickoff. Priya Shah is the delivery PM…”
- Model: `person/update_existing` targeting seed to-do **Confirm project baseline…**, `ownershipSemantics: replace`
- Resolve: Needs You
- Priya never created. Every later person create then had an empty people list and a schema that does not carry `name`.

### D — missed expected facts (14)

Notable: Elena Voss never observed (C5); CAB 24h rule stored as risk/milestone not knowledge (C8); member CSV export missed (C20); UAT start at C64 extracted as `todo/create_new` not a milestone update; Tomiko left / CAB pack done / hypercare decision missed or Apply-failed.

### E — `truthIntent` (existing #108 captures; exact Part-2 phrases were not added)

| Cap | Input pattern | Intents | Apply | Note |
| ---: | --- | --- | --- | --- |
| 63 | UAT moves to 20th | current, uncertain | wrote | scored **correct** (intent matched) |
| 64 | CAB 18th; move UAT to 18th | current, current | failed | D+G; UAT became a new to-do |
| 71 | steering notes 22nd; CAB still 18th | current, uncertain | Needs You | wanted `non_current` |
| 73 | discussed 30th, not agreed | current, uncertain | no_change | wanted `non_current`; **did not write** (safe) |
| 76 | weekend cutover rejected | current, current | **wrote** | **A+E** |
| 77 | still 27 Oct | current | no_change | wanted `non_current`; safe |
| 78 | quoted RAID UAT 14th | current, non_current | **wrote** | **A+E** |
| 82 | steering PDF 12th | current, uncertain, uncertain | no_change | wanted `non_current`; safe |

C63 is the only dated-capture win. When the model marked stale text `current` **and** Apply wrote, current truth moved (76, 78).

### F — extra creates (4)

C29 invented “SSO is included…” as a create (SSO *is* in the story, but as a later decision). C46 / C62 / C96 created people-session / mood / shadowing rows.

### G — Ready but not written (37)

Dominant letter. Sample:

- **C11** three dated milestones (UAT 14 / CAB 18 / Release 27) — Ready, **1 of 3 wrote** (CAB only). Release and UAT never became rows. All later date moves targeted the CAB sentence.
- **C33** Sarah Kim `create_new` (nameless `proposedValues`) + pen-test risk/todo Ready — Apply persisted 0.
- C10, C13, C18–C25, C34, C43–C45, C47, C56, C59–C60, C64, C68, C70, C86–C87, C92–C93, C97–C98, C100 — Ready writes that did not land.

G is **not** “Apply threw.” It is “Extract+resolve said write; `#110` Apply did not persist.” Some of those Apply refusals are conservative (stale target / identity). In aggregate they left the board empty.

---

## 7. Capture token / context / cost growth

**LIVE-PROVEN** OpenAI `usage` on every extract.

| | Captures 1–20 | Captures 81–100 | Ratio |
| --- | ---: | ---: | ---: |
| Extract prompt chars | 2823 | 3182 | **1.13×** |
| tiktoken input | 639 | 769 | **1.20×** |
| projectBlock chars | 454 | 784 | **1.73×** |
| current truth objects | 6.1 | 18.75 | **3.07×** |
| History events | 3.5 | 23.75 | **6.79×** |

Provider extract tokens (n=100):

| | min | median | p90 | max | mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| input | 600 | 768 | 788 | 888 | 750 |
| output | 119 | 270 | 399 | 837 | 287 |
| total | 772 | 1022 | 1188 | 1697 | 1037 |

History **is not** in the V2 extract prompt. `projectBlock` stayed under 1k chars. History 3.5 → 23.75 (6.8×) while extract only grew 1.2× — same architecture finding as #108, now with real tokens.

**Comparison vs deterministic #108:** extract prompt 2.2k → 8.5k (3.8×), tiktoken 492 → 2626 (5.3×), because oracle Apply filled the board with transcript-shaped titles. Live growth looks better **only because writes failed**. Object count still grew faster than the prompt (3.07× vs 1.13×) on a handful of prose rows. This is not a token-architecture win.

---

## 8. Ask quality + token/cost growth

30 live `answerTellMeQuestion` calls. Ask did **not** mutate current truth (reload still matched after each checkpoint).

| Probe | CK1 | CK25 | CK50 | CK75 | CK100 |
| --- | --- | --- | --- | --- | --- |
| Release date | `not_found` — none stated | `not_found` — none stated | **`direct_confirmation` 18 Oct** (the CAB row) | `not_found` | **`direct_confirmation` 27 October** (decision text, no release milestone) |
| Open risks | none (honest) | CAB-pack-rule “risk” | same | same | same |
| UAT owner | `not_found` | `not_found` | `not_found` | `not_found` | `not_found` (correct given 0 people) |
| Open actions | seed baseline | seed + login-error sentence | + vendor-contract sentence | same | + member comms sentence |
| Why dates moved | `not_found` | CAB has not moved | **invents** UAT 16 Oct / SSO tightness | **invents** Jordan + two days / CAB 20 Oct | weekend cutover rejected / stay 27th (from C76 write) |

Honesty when the board is empty is acceptable. Confidence is **not** acceptable once Ask starts answering from a single mislabelled CAB row or from decision chatter:

- CK50 release date = 18 Oct with `direct_confirmation` (that is CAB, not release).
- CK50/CK75 “why moved” invents SSO/Jordan causal stories. C63 *did* mention Jordan asking for two days — but it wrote that onto the CAB row, so Ask treats CAB as the thing that moved.
- CK100 release “27 October” is grounded in a knowledge decision, not a milestone. Oracle expected a Release row at 27 Oct. Ask sounds sure about a date the timeline does not carry.

Ask context chars: CK1–25 mean 1354 → CK75–100 mean 2727 (**2.01×**). Historical Ask is larger than current-state Ask (median 3480 vs 1996). Canonical current Ask still omits History (good). Growth tracks the thin current board + accumulating decision/history evidence, not a 100-person project.

---

## 9. UI findings

Playwright / screenshots were **not** part of `v09-live-100.yml`. No UI claim is live-proven.

From checkpoint MissionState, a user opening Northstar at C100 would see:

- People: empty
- To Do: five rows, four of them full sentences, one seed task; “Password-reset regression is done.” still open
- Important dates: one CAB sentence
- Risks: one rule-as-risk
- Neighbour Atlas: unchanged

#108’s UI problem was enormous transcript-duplicate blobs. This run’s UI problem would be the opposite: a **blank-looking project** with a few ugly titles. Neither is a maintained board.

---

## 10. History behaviour

| | |
| --- | --- |
| History events (Northstar) | 26 at C100 |
| Titles | Generic (`Capture added a To Do`, `Capture updated a milestone`) — not transcript dumps |
| After write / not after Needs You | Holds on the captures that actually persisted |
| In the V2 extract prompt | **No.** `projectBlock` ≠ History |
| In current-state Ask | **No** (MODE:current). Historical Ask probe uses History |

History grew 6.8× while current people stayed at 0. History is accumulating generic apply evidence, not repairing identity. That is the #108 architecture split, live-confirmed: History is not the cost problem, and it is also not the truth problem.

---

## 11. Curve-ball results

| Ball | Caps | Live result |
| --- | --- | --- |
| same-first-name | 33, 42, 51 | C42 Needs You (correct). C33 Ready writes failed (G); Sarah Kim never created. **C51 Ready wrote** (B). |
| date-moves / twice | 26, 63, 64 | C26/C63 scored correct **on the only milestone** (CAB sentence). C64 extracted UAT move as a new to-do and Apply failed. |
| quoted-stale / discussed-not-agreed / rejected | 71–78, 82 | Intent mostly wrong (E). Writes on 76 and 78 (A+E). Others stayed no_change / Needs You (safe). |
| explicit-no-change | 30, 77 | C30 wrote (A). C77 did not write. |
| responsibility transfer / back | 27, 65, 66 | Needs You (C) — no people to attach to. |
| person-leaves / replacement | 84, 85 | Needs You; Tomiko/Nadia never landed. |
| negation (Marcus is NOT…) | 53, 81 | C81 Needs You scored correct. C53 Apply failed (G). |
| another-project-reference | 80 | no_change, scored correct. Atlas untouched. |
| 5-plus-facts / dense notes | 48, 93, 95, 96 | C48 wrote and scored correct. C93/95/96 Ready/mixed + G (and A/F). Atomic split happened; persist did not keep up. |
| owner-unavailable | 17, 90 | C17 empty/correct. C90 Needs You. |

Analyse-only (never Applied), live extract:

| Probe | Behaviour |
| --- | --- |
| reaffirm-priya | `no_change` at every checkpoint (wouldMutate false). Vacuous: Priya is not on the project. |
| repeat-release | **wouldMutate true** at CK25/50/75/100 — `write` a 27 Oct milestone. Same #108 finding: restating a date creates/updates because no short “Release” label exists. |
| resolved-cab-historical | `no_change` at CK75/100. Would not reopen. |

---

## 12. Architecture stress findings

These are the same family of problems #108 showed with oracle envelopes, now under a real model and real RPCs.

1. **Person identity cannot be born from live extract.** Schema has no `name`. Resolve requires a name. C1 made it worse by `update_existing` against a to-do. Result: 0 stakeholders for 100 captures. Deterministic #108 landed 11 people (still missed Sarah Kim). Live is strictly worse.

2. **Ready ≠ persisted.** 37 captures had resolve-`write` rows that Apply did not write. No harness exception. `#110` Apply re-checks expected target / re-plans / persist hooks and often returns non-`wrote`. Combined with (1), the board never accumulates.

3. **One row absorbs every date.** C11 created three milestone observations; one CAB sentence survived. C63 “UAT moves to the 20th” updated that CAB id. Dates wandered. Ask then treated CAB as release.

4. **Titles are still utterances.** The few to-dos that landed are “A to-do for X needs to be added.” Knowledge decisions are closer to usable sentences. Current To Do / dates are not.

5. **`truthIntent` is mostly unused.** 6 `non_current` vs 201 `current`. Stale / discussed / rejected captures are not reliably marked. When they are marked `current` and Apply writes, truth moves (A+E).

6. **History vs current.** History grows; current does not. Extract cost stays flat for the wrong reason. A future run that actually persisted people/todos would re-open the #108 title-bloat cost curve.

7. **Isolation holds.** Atlas untouched. Wrong-project stop unused. This is the one architecture piece that survived.

8. **G over-counts vs “unsafe write” but under-counts vs “project works.”** Some Apply refusals are correct conservatism. They still leave a product that cannot record a named person or a second milestone from a live model.

---

## 13. 2000-CAPTURE READINESS

**No.**

- Current-truth longevity already failed at C1 and never recovered.
- Token headroom looks fine (extract ~1k total tokens mean) only because the project is empty. A 2000-capture run on this candidate would either stay empty (worthless) or, after any identity fix, hit the #108 transcript-title cost curve that this run did not exercise.
- Ask already invents causal stories at n=50–75 on a thin board.
- Apply already drops a majority of Ready writes. 2000 captures would multiply G, not average it out.
- Analyse `repeat-release` would still want to write.

Do not scale this candidate. Do not spend another live 100 hoping for a different `gpt-4o-mini` draw. C1 targeting + nameless person creates + Ready-not-written are systematic.

---

## 14. Findings ranked

| Rank | Finding | Proof | Why it blocks v0.9 |
| ---: | --- | --- | --- |
| 1 | People cannot be created from live extract (schema/resolve name contract + C1 to-do bind) | LIVE C1–C8, C33, 15 nameless `create_new`, people=[] at every CK | A project without people cannot own UAT, resolve Sarah, or answer Ask |
| 2 | Majority of Ready writes do not persist (G=37, 0 exceptions) | LIVE outcomes: 56 Ready captures, 23 with any persist | Capture that “looks Ready” does not become truth |
| 3 | One CAB sentence is the entire date system; dates wander | LIVE C11 partial apply; CK50=16th, CK75=20th, CK100=18th | UAT/CAB/release are not separately true |
| 4 | Unsafe writes on silent / stale / ambiguous captures (A=5, B=1, E writes on 76 & 78) | LIVE taxonomy | Current truth is not protected when the model is wrong |
| 5 | `truthIntent` almost never `non_current` | LIVE 6/229 | Dated/stale architecture from #110 is not live-exercised by the model |
| 6 | Ask over-confident on a hollow board | LIVE CK50/75/100 | Users would trust 18 Oct or 27 Oct as “the release” |
| 7 | Transcript-shaped titles on the few rows that land | LIVE truth-final.json | #108 P0 title problem is still here, just on fewer rows |
| 8 | Token growth looks healthy for the wrong reason | LIVE 1.13× extract vs empty board | Must not be cited as a v0.9 cost win |
| 9 | Isolation + reload hold | LIVE Atlas + reloadOk | Necessary, not sufficient |

---

## 15. Final recommendation

**STRUCTURAL PROBLEM REAPPEARED**

Not `READY FOR v0.9 RELEASE CANDIDATE`.
Not `MODEL QUALITY NOT GOOD ENOUGH` as the sole letter — the model *did* emit `person/create_new` for Liam, Sarah Okonkwo, Amira, Sarah Kim; production resolve/Apply would not take them. Model quality is still poor (C1, A/B/E, Ask invention) and would remain after a name-field patch.
Not `ONE BOUNDED LIVE-MODEL FIX REQUIRED` — landing `proposedValues.name` is necessary and not sufficient. G=37, date collapse, A/E writes, and title quality would still fail a release bar.
Not `LIVE RUN BLOCKED` — the live 100 ran in CI.

The #108 identity / title / Apply architecture is still the product. Live OpenAI did not create a coherent 100-capture project on #110. It created an empty people list, one wandering CAB row, and a decision drawer.

**Production changes from this PR: NONE.**

**Do not merge** #108, #110, #111, or #112.

DB-boundary on #111 remains independently QUALIFIED. This report does not reopen it.

---

## Artefacts

| File | What |
| --- | --- |
| `longhaul-100-live/run-summary.json` | mode, model, taxonomy, tokens, proof labels |
| `longhaul-100-live/calls.csv` | per-call tokens / latency / chars |
| `longhaul-100-live/live-observations.json` | raw model observations + A–G per capture |
| `longhaul-100-live/outcomes.json` | resolve counts, applied counts, oracle diffs |
| `longhaul-100-live/checkpoints.json` | CK1/10/25/50/75/100 truth, Ask, analyse, search |
| `longhaul-100-live/checkpoints/state-*.json` | full MissionState snapshots |
| `longhaul-100-live/failures.json` | oracle diffs (not the release metric) |
| `longhaul-100-live/truth-final.json` | compact current truth at C100 |
| `longhaul-100-live/token-growth.json` | extract / Ask / analyse / provider usage |
| `longhaul-100-live/taxonomy.json` | A–G counts |
| `longhaul-100-live/scenario-reference.json` | #108 inputs + expected truth (unchanged) |
| `longhaul-100-live/identity-map.json` | four bound keys |
| `docs/v1-convergence/V09_LIVE_100.md` | this report, filed |

CI artefact: `v09-live-100-evidence` on run `33307350137`.
