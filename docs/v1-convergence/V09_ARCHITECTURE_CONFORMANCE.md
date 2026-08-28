# v0.9 architecture conformance & integration regression

**Owner:** Hulk (evaluation / safety). Isolated evidence pack. **Do not merge as a product fix.** **Do not treat green domain tests as production-composition proof.**

**Exact SHA this pack was measured against:** `add3532` (`origin/main`, 2026-08-28).

**Branch:** `cursor/v1-v09-architecture-conformance-610b`

**Command:** `npm run verify:v09-architecture`

---

## Why this pack exists

The v0.9 audit found a testing blind spot:

> Individual / domain tests can be completely green while the real production New Project route uses a different intelligence pipeline.

This pack is a **thin** architecture-conformance / workflow regression layer. It is **not** “can every button in Lume be clicked?” It answers:

> Does the real production journey actually pass through the architecture we approved and tested?

### The fixture vs composition distinction (explicit)

A test that starts with:

> “Here are four perfectly split person observations”

does **not** prove:

> “Messy New Project input uses the right extractor and produces four observations.”

`scripts/verify-new-project-v2.ts` is the first kind. Journey 1 in this pack is the second: it POSTs a **raw narrative** to `POST /api/new-project` and asserts the Talk path called `extractObservationsWithOpenAI` with `buildObservationExtractionPrompt` / `CAPTURE_V2_OBSERVATION_SCHEMA`.

Controlled model JSON is injected **only after** the prompt/composition gate, and only to keep CI off live OpenAI.

---

## Parallel branch awareness (do not wait)

Tests describe the **intended** architecture independently of these open PRs:

| Work | Branch / PR | Status vs `add3532` |
| --- | --- | --- |
| Hawkeye first-user / New Project copy | `cursor/hawkeye-first-user-journey-0161` PR **#94** | OPEN — Talk still `assembleNarrativeWithOpenAI` + regex fallback |
| Thor New Project shared extract | `cursor/v1-new-project-shared-extract-9524` PR **#102** | OPEN — intended Talk path is Capture extract + fail-closed HTTP |
| Iron Man Search / KC | `cursor/kc-shell-ocean-polish-9f13` | Search on main is still `searchProjectKnowledge` over **knowledge-section bullets** |
| Thor Capture → History persist | not on main | `persist-execute.ts` does **not** call `persistHistoryEvent` |

Where a conformance test correctly fails against current HEAD, it is recorded as **EXPECTED RED**. Production code is **not** altered to make it green.

---

## Tests added / changed

| Path | Change |
| --- | --- |
| `scripts/verify-v09-architecture-conformance.ts` | **Added.** Ten journeys. Expected-red failures exit 0; unexpected-green-path failures exit 1. |
| `package.json` | `verify:v09-architecture` |
| `scripts/run-regression-suite.ts` | Includes `v09-architecture-conformance` |
| `docs/v1-convergence/README.md` | Link to this document |

No production behaviour was changed.

---

## Current PASS / FAIL (`add3532`)

| # | Journey | Expect | Result | Why |
| --- | --- | --- | --- | --- |
| 1 | New Project Talk uses shared Capture extractor | RED | **EXPECTED RED** | Talk path never called `extractObservationsWithOpenAI`. Production uses `assembleNarrativeWithOpenAI` / `assembleFromNarrative` (and a **bespoke** `extractNewProjectV2WithOpenAI` only when `LUME_NEW_PROJECT_V2=1`). |
| 2 | Extract failure must not silently succeed via regex / legacy | RED | **EXPECTED RED** | OpenAI 500 → HTTP **200**, `provider=local`, note `OpenAI assemble failed — used local parse.` |
| 3 | Capture → validate → resolve → Review → Apply → FakeWorkspace → reload (Todo title preserved) | GREEN | **PASS** | Ordinary UPDATE keeps `todo:candyland:permit`; title unchanged; due date written; hydrate matches persist. |
| 4 | Needs You produces no durable write | GREEN | **PASS** | Ambiguous “the deadline” → `needs_you`; FakeWorkspace `writes=0`. |
| 5 | Stale / wrong `expectedTarget` produces no write | GREEN | **PASS** | Apply `ok: false`, `writes=0`. |
| 6 | RIGHT FACT → WRONG PROJECT fails closed at Apply | GREEN | **PASS** | Project B risk applied while scoped to Project A → not `wrote`; durable snapshot unchanged. |
| 7 | Search finds todo, risk, milestone, person, knowledge | RED | **EXPECTED RED** | Production Search (`searchProjectKnowledge`, same helper KC uses) **missed** todo “File the parade permit” and milestone “Go-live”. Knowledge-section hits can still green narrower tests. |
| 8 | Tell Me + Catch Me Up HTTP ignore posted MissionState | GREEN | **PASS** | Source-level: both routes load server truth and ignore `body.state`. Full suites kept: `verify-tell-me-server-truth`, `verify-catch-me-up`. |
| 9 | Approved Capture write leaves durable History after reload | RED | **EXPECTED RED** | `src/lib/capture/apply/persist-execute.ts` does not call `persistHistoryEvent`. Apply wrote the todo; `history_events` empty after reload. |
| 10 | Needs You does not write a successful History event | GREEN | **PASS (vacuous)** | True because **nothing** writes History on Apply yet. Not proof that a future History hook correctly skips needs-you. Re-score when journey 9 is green. |

**Exit code of `npm run verify:v09-architecture`:** 0 (expected-red is not a CI failure).

**Unexpected failures:** none.

---

## Mapping: test → user journey → production entry → shared primitive

| Test | User journey | Production entry point | Shared primitive proven |
| --- | --- | --- | --- |
| 1 | First Talk: paste messy project story | `POST /api/new-project` (`src/app/api/new-project/route.ts`) | `extractObservationsWithOpenAI` + `buildObservationExtractionPrompt` + `CAPTURE_V2_OBSERVATION_SCHEMA` (unscoped) |
| 2 | Talk when the model is down | same | Fail closed (no 200 regex / `assembleFromNarrative` success) |
| 3 | Capture “move the permit to 12 April” | Capture V2 run → `applyApprovedCaptureSuggestion` → `supabaseCaptureApplyHooks` → `loadMissionStateFromSupabase` | validate / resolve / Apply / persist / hydrate; stable Todo identity + title |
| 4 | Capture ambiguous “the deadline” | same, no Apply write | Needs-you produces no durable write |
| 5 | Stale review card Apply | `applyApprovedCaptureSuggestion` | `expectedTarget` mismatch → no write |
| 6 | Harbourline fact applied while on Candyland | Apply scoping | RIGHT FACT → WRONG PROJECT fails closed |
| 7 | KC Search Ask | `KnowledgeSearchAskBar` → `searchProjectKnowledge` (`src/lib/tell-me/knowledge-search.ts`) | Authoritative todo / risk / milestone / person / knowledge findable |
| 8 | Tell Me / Catch Me Up | `POST /api/tell-me`, `POST /api/catch-me-up` | Server authoritative truth; posted MissionState ignored |
| 9 | After approved Capture write, History then reload | persist-execute + `history_events` + hydrate | Durable History evidence of the change |
| 10 | Needs-you Capture | persist-execute + History | No false successful History event |

---

## Existing tests that gave false architectural confidence

1. **`verify-new-project-v2`** — starts from **already-split** observations → `parseNewProjectV2Envelope` / `draftFromProvisional`. Greens the mapping layer while Talk still uses a **bespoke** assemble prompt and regex fallback. Class **C**.
2. **`verify-first-run-journey`** — asserts Ocean copy *and* documents “Showing a local draft instead” as the fallback. Greens a product story that **accepts regex intelligence** when OpenAI fails. Class **C** if treated as “Talk uses Capture extract”.
3. **`LUME_NEW_PROJECT_V2` default-off checks** in `verify-new-project-v2` — prove the flag is off. Easy to read as “V2 Talk is the live path.” It is not. Class **C**.
4. **Ocean / Tell Me Search tests that query knowledge-section strings** (e.g. “CAB”) — `searchProjectKnowledge` over `knowledge.sections` can pass while todos and milestones are invisible. Class **C** as “Search finds project truth”.
5. **Harbourline / e2e frozen envelopes** — useful journeys, but frozen model JSON **skips the extractor**. Does not prove New Project Talk composition. Class **B / C**.
6. **Journey 10 in this pack, until History exists** — “no successful History on needs-you” is vacuously true. Do not cite it as History-hook proof. Class **C** until journey 9 is green.

These suites remain useful. **Do not delete them.** Stop treating them as runtime composition proof.

---

## Test audit (important existing suites)

Legend:

- **A** — production wiring proof (real route / orchestration / persist)
- **B** — useful domain / component proof
- **C** — useful but misleading if treated as runtime / composition proof
- **D** — obsolete as current Capture V2 / Talk runtime coverage (may still guard leftover paths)

| Suite | Class | Notes |
| --- | --- | --- |
| `scripts/verify-v09-architecture-conformance.ts` | **A** (intended) | Thin composition / workflow pack. Journeys 1, 2, 7, 9 are expected-red on `add3532`. |
| `scripts/verify-new-project-v2.ts` | **C** (+ **B** mapping) | Split observations in → draft. Not Talk composition. |
| `scripts/verify-first-run-journey.ts` | **B / C** | Create-from-draft, Ocean copy, **local-draft fallback treated as success**. |
| `scripts/verify-new-project-onboarding.ts` | **B** | Setup / review / onboarding domain. Not extract composition. |
| `scripts/verify-capture-v2.ts` | **B** | Capture V2 engine. Not New Project Talk. |
| `scripts/verify-capture-v2-invariants.ts` | **B** | Contract / identity / no-cross-project. |
| `scripts/verify-capture-phase3b-boundary.ts` | **B** | Review / Apply / expectedTarget. |
| `scripts/verify-stable-object-identity.ts` | **A / B** | Real Apply + FakeWorkspace; identity preservation (Thor #89 on main). |
| `scripts/verify-stacked-capture.ts` | **A / B** | Same-object stacked Apply. |
| `scripts/verify-capture-server-truth.ts` | **A** | HTTP Capture uses server truth, not posted MissionState. |
| `scripts/verify-d035-server-truth.ts` | **A** | D-035 HTTP ignore-client-state. |
| `scripts/verify-tell-me-server-truth.ts` | **A** | **Keep.** HTTP Tell Me ignores posted MissionState. |
| `scripts/verify-catch-me-up.ts` | **A** | **Keep.** HTTP Catch Me Up uses `loadAuthoritativeProjectTruth`; client state ignored. |
| `scripts/verify-tell-me.ts` / `verify-tell-me-canonical-truth.ts` | **B** | Domain / canonical-truth helpers. Not HTTP composition by themselves. |
| `scripts/verify-tell-me-ocean.ts` / `verify-knowledge-centre-ocean.ts` | **B / C** | Ocean copy + knowledge-bullet Search hits. |
| `scripts/verify-eval-capture-v2.ts` / scorers | **B** | Eval instruments, not production route wiring. |
| `scripts/verify-findings-golden.ts` / `verify-findings-engine.ts` | **D** for Capture V2 runtime | Legacy `extractLocalFindings`. Still useful leftover-path guards. |
| `scripts/verify-harbourline-e2e.ts` / frozen envelopes | **B / C** | Journey + frozen JSON; skips live extract composition. |
| `src/lib/new-project-v2/extract.ts` tests via v2 suite | **C** vs Talk | Bespoke `buildNewProjectV2Prompt` — **not** the shared Capture extractor. Thor #102 deletes this path. |

---

## Expected failures caused by confirmed v0.9 violations

These are **correct reds**. Do not patch production from this PR to green them.

1. **Talk New Project ≠ Capture extract** — `src/app/api/new-project/route.ts` always regex-assembles first; default AI path is `assembleNarrativeWithOpenAI` (`src/lib/new-project/assemble.ts`), not `extractObservationsWithOpenAI`.
2. **Talk fail-open** — OpenAI errors return HTTP 200 with `assembleFromNarrative` local draft.
3. **Search is knowledge-section retrieval** — `searchProjectKnowledge` does not search todos / timeline as first-class records. KC Ask uses this helper on client `useMission()` knowledge only.
4. **Capture Apply does not persist History** — `persist-execute.ts` has no `persistHistoryEvent`. Client `persistHistory` in `CaptureSessionContext` is sessionStorage Capture-session slice, not `history_events`.

---

## Recommended small mandatory pre-merge v0.9 regression set

Run this before merging architecture PRs (Hawkeye Talk, Iron Man Search, Thor extract / History). Treat expected-red on the conformance pack as **known violations** until those PRs land — do not “fix” by weakening assertions.

```bash
npm run verify:v09-architecture
npm run verify:capture-server-truth
npm run verify:tell-me-server-truth
npm run verify:catch-me-up
npm run verify:stable-object-identity
npm run verify:stacked-capture
npm run verify:new-project-v2
npm test
```

When Thor #102 lands, journeys **1** and **2** must flip **green** (or this pack is wrong).  
When Iron Man Search lands, journey **7** must flip **green**.  
When Capture→History persist lands, journey **9** must flip **green** and journey **10** must be re-read as a real (not vacuous) gate.

---

## What this pack deliberately does not do

- Live OpenAI bake-off
- Enormous Playwright “click every button”
- Perfect pre-split observation fixtures as composition proof
- Production patches
- Deleting useful unit tests
