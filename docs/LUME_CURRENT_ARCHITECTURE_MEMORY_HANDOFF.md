# Lume — Current Architecture Memory Handoff

> **HISTORICAL — 26 August 2026 desert-era snapshot. Not current implementation authority.**  
> This file was written against `cursor/capture-v2-desert-new-project-56c9`. PR #66 **was** merged. Capture V2 is the sole live engine. Ready → Apply is on `main` (PR #126).  
> **Do not start work from this document.** Start at `docs/README.md`. Use current `main` as the implementation map. Part C V1 *target* decisions may still inform later work; Part A/B “CURRENT” flag tables are stale.

**Status:** HISTORICAL implementation snapshot + V1 Architectural Convergence delta (Part C)  
**Date:** 26 August 2026 (Thor amendment: name ≠ identity; project-scoped mutation invariant; status categories)  
**Code observed (then):** `cursor/capture-v2-desert-new-project-56c9` @ `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4`  
**Ancestry verified:** Phase 3B / PR #64 HEAD `b52995c3b7eb80971d052e875c1d372ebb424ebe` is an ancestor. This SHA also contains Capture V2, New Project V2, and Desert. PR #66 is **not** merged and must not be merged from this review.  
**Docs entry point:** `docs/README.md`  
**Governing product authority:** `docs/v1-reference-pack/`  
**Living defect backlog:** `docs/LUME_V1_KNOWN_DISCOVERIES.md`  
**Convergence completion report:** `docs/V1_CONVERGENCE_ARCHITECTURE_COMPLETION.md`  
**Historical (not current implementation map):** `docs/LUME_V1_PROJECT_TRUTH_ARCHITECTURE_AUDIT.md` (19 Aug 2026 — written before Slices 1A–2D; several claims are now false; see Part B § discrepancies)

**How to read this file after 26 August 2026:** Part A/B remain the current-implementation map. **Part C is the binding V1 convergence delta** (one-authority decisions, deletion points, migration order). Part C does not re-audit the world. If Part A/B and Part C disagree on a *target*, Part C wins. If they disagree on *what the code does now*, the code wins and this file should be updated.

This document has three parts:

- **Part A** — memory-ready checkpoint (paste into ChatGPT context)
- **Part B** — detailed reference (paths, write/read traces, duplication map)
- **Part C** — binding V1 convergence delta (targets, deletion points, migration order)

Legend used throughout:

| Tag | Meaning |
| --- | --- |
| **CURRENT** | What the code does now (verified) |
| **DECIDED V1 TARGET** | Accepted direction, not yet fully implemented |
| **TRANSITIONAL / FLAGGED** | Temporary coexistence or migration state (often a feature flag) |
| **DEPRECATED / SCHEDULED FOR DELETION** | Surviving only until the named deletion point |
| **UNRESOLVED** | Genuinely undecided — do not treat a guess as a decision |
| **INTENT** | Product rule the code is trying to honour (may already be CURRENT) |
| **GAP** | Known incomplete / Known Discovery |

---

# PART A — MEMORY-READY ARCHITECTURE CHECKPOINT

Use this section as working context for future product/development decisions and Cursor prompts.

**Engineering defaults for future work (INTENT + CURRENT practice):**

1. **Reuse first.** Inspect existing helpers/components/store mutations/tables before creating parallel ones.
2. **Lowest-risk viable change.** Additive, bounded, reversible; do not use this to preserve genuinely unsuitable architecture.
3. **Tests with behavioural change.** Add focused verify coverage; rerun the suites that protect the touched layer.

---

## 1. Technology / application foundation

**CURRENT stack (verified):**

| Layer | Reality |
| --- | --- |
| App | Next.js **16.2.11** App Router (`src/app`), React **19.2.4** |
| Styling | Tailwind **v4** imported in `src/app/globals.css`; Ocean UI is mostly custom CSS on CSS variables, not a component library |
| State | Client `MissionProvider` in `src/lib/store.tsx` |
| Auth | Supabase Auth in production; demo JWT cookie in local/dev (`src/lib/auth-mode.ts`, `src/lib/auth-demo.ts`) |
| DB | Supabase Postgres + RLS (`workspace_id` membership) |
| AI | OpenAI via `/api/capture`, `/api/tell-me`, coach routes (`OPENAI_API_KEY`) |
| Billing | Stripe foundation (`src/lib/billing/*`, `/api/billing/*`) — **not** the Ocean “actions left” meter |
| Deploy | Vercel (preview comments + production) |
| Package name | `mission-control` in `package.json` (product name is Lume) |

**Request gate:** `src/proxy.ts` (not a root `middleware.ts`). Public: login/signup/reset/callback, `/api/auth/*`, `/api/billing/webhook`.

**Persistence modes (`src/lib/persistence-mode.ts`):**

| Environment | Default |
| --- | --- |
| Production | **Always `supabase`** unless `LUME_ALLOW_LOCAL_IN_PRODUCTION=true` and `LUME_PERSISTENCE=local` |
| Development | `LUME_PERSISTENCE=local\|supabase`, else supabase if env configured, else **local** |

**Auth modes (`src/lib/auth-mode.ts`):** `none | demo | supabase`. Production uses supabase when configured.

**Local/dev fallback:** `localStorage` key `mission-control-state-v5` is the durable store **only in local mode**. Production must not silently fall back to it.

**Stale comment (do not trust):** `src/lib/data/index.ts` still says “Default: local (MissionState / localStorage remains the live UI path).” **CURRENT production path is Supabase hydrate + per-mutation persist.**

**UI chrome:** V1 appearances are **Ocean** (default, `data-theme="dark"`) and **Desert** (`data-theme="desert"`). The user chooses in Account → Appearance. Preference persists in `mc-appearance-v1`. `AppearanceToggle` remains unmounted from the project header (Slice 2B). See `docs/EXPERIMENTAL_PROGRAMME.md`.

**Home:** `/` with projects **redirects into the first project’s Ocean Knowledge Centre** (`src/app/page.tsx`). There is no portfolio Overview.

---

## 2. Central runtime state model

**`MissionState` (`src/lib/types.ts`) is:**

- The in-memory working copy every product surface reads.
- A **hydrate/mutate cache** of durable stores when `persistenceMode === "supabase"`.
- The durable authority only when `persistenceMode === "local"`.

**It is NOT:**

- A second source of truth that can disagree with Supabase after reload (if persist succeeded).
- A graph database, CRM, or portfolio store.
- Complete coverage of every table (`capture_sessions`, `coach_sessions`, billing, snapshots live partly outside it).

**Key fields:** `projects` (nested `stakeholders`), `todos`, `knowledge` (`ProjectKnowledge[]`), **`risks?: ProjectRisk[]`** (Slice 1B — **the 19 Aug audit claim that this field does not exist is stale**), `timeline` (from DB `milestones`), `memories`, `recommendations`, `meetings`, `releases`, `history?`, analysis-meter fields.

**Hydration (`MissionProvider`):** poll `/api/auth/me` → if supabase, load via `/api/workspace/state` / `loadMissionStateFromSupabase` (`src/lib/data/supabase/load-mission-state.ts`). Flash-prevention cache: `src/lib/mission-cache.ts` (`lume-mission-supabase-cache-v1`). Production hydrate failure → empty state + error, **not** silent local seed.

**Mutations:** mixed. New Project and some creates persist first, then `setState` with durable ids. Many updates remain optimistic `setState` then `void` async persist. Failures set `saveStatus=error`, show Ocean `ocean-save-error`, and reconcile from `/api/workspace/state` (**D-005 partial**). Paint cache is written only on hydrate or confirmed persist — not on every MissionState change.

**Project scoping:** almost every domain row has `projectId`. App filters by selected project. RLS is **workspace membership**, not per-user project ownership. Future multi-project retrieval must stay permission-aware.

**Key files:** `src/lib/store.tsx`, `src/lib/types.ts`, `src/lib/persistence-mode.ts`, `src/lib/data/supabase/load-mission-state.ts`, `src/lib/data/supabase/persist-mutations.ts`, `src/lib/mission-cache.ts`.

---

## 3. Project truth authority map

| Concept | Runtime | Durable table | Stable identity | Authoritative lifecycle/state | KC projection | Helper / path | Caveat |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Projects** | `MissionState.projects` | `projects` | UUID | `status` healthy/watch/at_risk; `currentFocus` | Header + strip | `createProject` / `persistNewProject`; `deleteProject` / `persistProjectDelete` | Workspace-scoped; delete is persist-first |
| **Knowledge / current facts** | `knowledge[].sections.now` + `structured` | `knowledge_items` | UUID (`sectionItemIds` / structured `id`) | `lifecycle` current/superseded/historical | Current position frame | `updateKnowledgeSection`, `persistKnowledgeReconcile`, `alignSectionLines` | Wording-edit preserves id; unrelated replacement **new** id |
| **People identity** | `projects[].stakeholders` | `stakeholders` | Project-scoped UUID | Name + role | People frame cards | `ensurePersonOnProject`, `persistEnsureStakeholder`, `getPersonBundle` | **Not** a workspace-global CRM. Capture prose may still lack a stakeholder (**GAP D-007**) |
| **Responsibilities** | `structured` `kind=responsibility` | `knowledge_items` meta | Item UUID + `personId` | current vs superseded; `ownerConfirmed` | People cards + person detail | `confirmResponsibilityOwner` | Many-to-many. Share is default. Replace needs explicit `replacePersonId` |
| **Risks** | `MissionState.risks` | `risks` | UUID | `status`: open\|watch\|resolved\|accepted | Open/watch titles only | `setRiskStatus`, `persistRiskStatus`, `src/lib/risks/lifecycle.ts` | Knowledge `sections.risks` is **projection**. Resolved must not resurrect from prose |
| **To Dos** | `MissionState.todos` | `todos` | UUID | `done`, `dueAt`, `kind`, `waitingOn` | To Do frame (open, non-waiting) | `toggleTodo`, `updateTodo`, persist todo helpers | Waiting todos also appear in Waiting frame |
| **Decisions** | `knowledge.sections.decisions` (+ structured `decision`) | `knowledge_items` | UUID when aligned | current bullets | Decisions frame | section reconcile | Mostly Knowledge-authored |
| **Dates / milestones** | `MissionState.timeline` | `milestones` | UUID | `startAt`, `label`, `type` | Important dates | `addTimelineItem`, `persistTimelineItem` | DB table name is **milestones**, not timeline |
| **Waiting / open loops** | Dual: `todos` WAITING/CHASE/`waitingOn` **and** `knowledge.sections.openLoops` | `todos` + `knowledge_items` | Mixed | **CURRENT: no single authority.** **TARGET (Part C):** todos = maintained waiting *work*; openLoops = narrative until promoted/superseded | Waiting & open loops concatenates both | — | **GAP D-008 / D-021** — do not fuzzy-dedupe in UI/Ask |
| **Dependencies** | Structured `kind=dependency` | `knowledge_items` | UUID if structured | current structured only | Dependencies frame | `ocean-frames` filter | Under-modelled; **no graph**. **GAP D-020** |
| **Availability** | Structured `kind=availability` + meta | `knowledge_items` | UUID + `personId` | current structured | People meta / person detail | `getPersonBundle`, `formatAwayRange` | Display-only if present; Capture ingestion incomplete (**GAP D-020**) |
| **Memories** | `MissionState.memories` | `memories` | UUID | Capture memory slice | Not a KC primary frame | `persistMemory` / `applyCaptureResult` | Evidence/archive, not current truth |
| **Recommendations / ✦ Lume noticed** | `MissionState.recommendations` | `recommendations` | UUID | suggestion until user converts | Intelligence / Capture observations | `addSuggestion`, accept/dismiss | **GAP D-003** accept/dismiss often memory-only vs DB |
| **Meetings / Meeting Prep** | `meetings` + `MeetingPrepFrame` | `meetings` | UUID | meeting records | Secondary embed | frames | Not a truth authority for Knowledge |
| **Releases** | `releases` | `releases` | UUID | release ops | Not Ocean-primary | — | RELOPS-oriented |
| **History** | `MissionState.history` | `history_events` | UUID | chronology / evidence | Honesty notes; History page | `pushHistory`, `persistHistoryEvent` | **Not current truth.** Many events never persist (**GAP D-004**) |
| **Capture sessions** | sessionStorage + client list | `capture_sessions` | mixed | review draft vs applied | Capture mode | `CaptureSessionContext`, `persistCaptureSession` | Table underused vs client lists (**GAP D-013**) |
| **Ask context / snapshots** | Tell Me session (intent only on HTTP) | Durable tables via `loadMissionStateFromSupabase`; snapshots derived | 1 per project derived | **Server-loaded canonical truth** for Ask; snapshot is UX compression only | Search/Ask bar | `loadServerCurrentTruthForTellMe` → `serializeCanonicalTruth` | HTTP ignores client MissionState. Library flag still gates evals/legacy assembler. |

---

## 4. Knowledge architecture

**CURRENT model:**

- **Display/edit store (legacy + still live):** `ProjectKnowledge.sections` — five string arrays: `now`, `decisions`, `risks`, `people`, `openLoops`.
- **Stable ids:** `sectionItemIds` parallel arrays of UUIDs (or null for unidentified lines).
- **Structured overlay:** `ProjectKnowledge.structured?: CanonicalTruthItem[]` — persisted as columns on the **same** `knowledge_items` rows (`kind`, `epistemic`, `lifecycle`, `supersedes_id`, `meta`, `provenance`). **Not a separate table.**

**`CanonicalTruthItem`:** `id`, `projectId`, `body`, `kind`, `lifecycle`, optional `section`, `epistemic`, `supersedesId`, `meta`, `provenance`.

**Kinds:** `fact | responsibility | decision | risk | date | dependency | availability | open_loop | ambiguity`.

**Epistemic:** `confirmed | pending | informal | suggested | inferred | conflicting | unknown | legacy` or `null`. **null/legacy/confirmed → no permanent KC badge.** Never reintroduce Capture High/Medium/Low confidence on maintained Knowledge.

**Lifecycle:** `current | superseded | historical`. Current truth = `lifecycle === "current"` (plus domain stores). Supersession via `supersedesId` / marking prior `superseded`.

**Identity (Slice 1A.1 — CURRENT, do not regress):** never use array index alone. Match order in `alignSectionLines` / `planKnowledgeReconcile`:

1. Exact body (order-independent)
2. Stable UUID (`sectionItemIds` / structured id)
3. Unique deterministic wording-edit (`isLikelyWordingEdit`)
4. Else INSERT new + DELETE unmatched — **prefer losing inferred identity to transferring metadata to the wrong item**

**Corrections:** `updateKnowledgeSection` / `replaceKnowledge` → `persistKnowledgeReconcile` (UPDATE body+position, append `manual_edit` provenance, keep metadata on matched ids). **Does not write the `risks` table.**

**What is current truth vs projection vs legacy:**

- Structured current items + section bullets that reconcile to `knowledge_items` = maintained Knowledge.
- `sections.risks` for genuine Risks = **projection** of `risks.status`.
- `sections.people` `"Name — scope"` = **compatibility projection**, not person identity.
- `deriveLegacyStructured` synthesises overlay **for Ask serialize** when structured is empty — epistemic null, provenance type `legacy`. That is a **read projection**, not a write.

**Key files:** `src/lib/types.ts`, `src/lib/canonical-truth/types.ts`, `src/lib/knowledge-identity.ts`, `src/lib/data/supabase/reconcile-knowledge.ts`, `src/lib/knowledge.ts`.

---

## 5. People architecture

**CURRENT after 1C + 2D:**

| Concern | Authority |
| --- | --- |
| Who the person is | `stakeholders` (project-scoped UUID) |
| What they own | `knowledge_items` `kind=responsibility` linked by `meta.responsibility.personId` |
| Shared ownership | **Multiple current** rows, same `scope`, different `personId` |
| Replacement / handover | Explicit `replacePersonId` and/or `resolveTruthItemId` → prior row `lifecycle=superseded` |
| Historical | superseded/historical rows; shown in person detail, not the default People frame |
| Availability | structured `kind=availability` only — **never invented** |
| Legacy people prose | `sections.people` / `legacyPeopleBullets` — supporting context; **no fuzzy AI merge** |

**Confirm Owner (CURRENT UI):**

- Dialog: `src/components/intelligence/ConfirmOwnerDialog.tsx`
- Decision helpers: `src/lib/people/confirm-owner-choice.ts`
- Mutation: `confirmResponsibilityOwner` in `src/lib/people/identity.ts` + store persist (`persistEnsureStakeholder`, knowledge persist, `persistKnowledgeLifecycle` for superseded ids)
- If other current owners exist for the scope → **Needs you**: user must choose **Add as another owner (share)** or **Replace a named current owner**.
- Adding a second owner **does not** replace the first unless replace is chosen.
- New person: create durable stakeholder first, then attach responsibility. Existing person: reuse **stable `personId`** only when Capture text establishes that Person (recorded full name). A model-supplied UUID is not identity proof. Exact-name match within the project is **CURRENT** conservative resolution only — **a name is not identity**. Two legitimate people may share a name. If name-only resolution is ambiguous (zero or more than one match), fail closed / Needs you. Do **not** add a database uniqueness constraint on stakeholder or person name.

**Person retrieval:** `getPersonBundle(state, projectId, personId)` — current/historical responsibilities, `sharedScopes`, availability, legacy bullets. Does not scan unrelated prose.

**People are not a workspace-global CRM today.** **CURRENT:** same human on two projects is two stakeholder rows. Do not fuzzy-merge similar names. Do not assume `projectId` can never be selected dynamically later.

**DECIDED V1 TARGET (Part C — do not implement in this review):** workspace-scoped Person identity + project-scoped participation/responsibility. Stable IDs own identity; same-name people must remain representable; no unique-name constraint; no fuzzy/global merging of existing stakeholder rows. That is a later dedicated slice, not a generic Entity table. Until then, stop adding new text-name couplings (`waitingOn`, memories `people` jsonb) without a durable `personId` when the Person is already known.

**GAP D-007 remainder:** Capture still often writes people **prose** without promoting a stakeholder. UI will not invent identity from that. Target: Capture hardening.

**D-019:** resolved as **D-R10**. CURRENT CODE implements Confirm Owner share vs replace. That UI is not missing.

**Key files:** `src/lib/people/identity.ts`, `src/lib/people/confirm-owner-choice.ts`, `src/lib/canonical-truth/confirm-responsibility.ts` (re-export), Confirm Owner dialog, `buildPeopleRows` in `ocean-frames.ts`.

---

## 6. Risk architecture

**CURRENT authority:** `MissionState.risks` / table `risks` / `RiskStatus = open | watch | resolved | accepted`.

- Open for KC/Ask current mode: `open` and `watch` (`isOpenRiskStatus`).
- Closed: `resolved` and `accepted` (`isClosedRiskStatus`) — **must not be folded back** into Knowledge as open risks.
- Resolve genuine risk: `setRiskStatus` → `persistRiskStatus` + `syncKnowledgeRiskProjection` (remove/restore **bare title**, not `[Resolved]` as authority).
- Knowledge-only bullets (no `risks` row): `setKnowledgeOnlyRiskResolved` — `[Resolved]` prefix path; **do not fabricate** a domain row.
- Recommendations of kind `risk` remain **suggestions** until the user converts them (Slice 1B rule).

**Capture:** after review approval, new risk bullets mint domain rows (`source: "capture"`) unless they are `[Resolved]` prose. Exact title match against domain risks — no fuzzy matching.

**INTENT:** old Risk prose must not resurrect a resolved Risk. **GAP D-015:** leftover open DB rows whose titles still start with `[Resolved]` may exist from older write paths — cleanup, not a licence to change authority.

**Key files:** `src/lib/risks/lifecycle.ts`, store `setRiskStatus` / `setKnowledgeOnlyRiskResolved`, `persistRiskStatus`.

---

## 7. Todo / waiting / open-loop architecture

**To Dos — CURRENT authority:** `todos` table / `MissionState.todos`. Fields: `done`, `dueAt`, `kind` (`ACTION | WAITING | CHASE | REMINDER`), `waitingOn` (string name, **not** a FK to stakeholders).

- Ocean **To Do** frame: open todos that are **not** WAITING/CHASE and have no `waitingOn`.
- Ocean **Waiting** frame: waiting/chase todos **plus** Knowledge `openLoops` bullets.

**There is currently no single waiting/open-loop authority.** Duplicate or contradictory loops are possible. **GAP D-008 / D-021.**

**DECIDED V1 TARGET (Part C):** do not invent a third store. **Todos** (`WAITING` / `CHASE` / `waitingOn`) are the authority for *actionable waits the PM owns*. **`openLoops` / structured `open_loop`** are narrative Knowledge until explicitly promoted to a todo (then superseded) or closed. The Ocean Waiting frame may still concatenate both as a *view*. Ask/canonical must not treat them as interchangeable. Do not fuzzy-dedupe.

Do not create extra To Dos merely to populate People detail. Person detail waiting lines use **exact** `waitingOn === person.name` match only.

---

## 8. Dates / milestones / dependencies / availability

| Domain | Representation | Persistence | Structured vs prose | KC | Ask | Limitation |
| --- | --- | --- | --- | --- | --- | --- |
| Dates / milestones | `TimelineItem` | `milestones` | First-class | `buildDateRows` | Canonical `MILESTONES` from timeline | Prior date only if structured supersession exists |
| Dependencies | `kind=dependency` structured | `knowledge_items` | Structured only in KC frame | Empty state if none | Canonical if structured present | **No graph.** Do not infer edges. **GAP D-020** |
| Availability | `kind=availability` + `AvailabilityMeta` | `knowledge_items` | Structured only | Away meta on people cards | Canonical if structured | No calendar/holiday/rota. Capture writes structured availability when Person + dates are known; otherwise Needs you. Ask remainder: **GAP D-020** |

---

## 9. Capture architecture and trust boundary

**INTENT / locked rule:** nothing extracted from Capture becomes maintained project truth **before final human review/approval**.

**DECIDED V1 TARGET engine:** Capture V2 (`src/lib/capture-v2`, flag `LUME_CAPTURE_V2`) is the V1 Capture understanding path. **CURRENT:** flag unset = legacy OpenAI findings path (**TRANSITIONAL / FLAGGED**). Phase 3B `planCaptureApply` / `executeCaptureApply` remains the **only** Capture mutation safety gate. The V2 “world” / ID catalogue is a *derived projection of the same durable authorities*, not a second current-truth snapshot. Do not keep two OpenAI Capture engines permanently (**D-032**). Immediate-merge `capture()` / `captureWithAI` / `applyCaptureResult` / `CaptureBar` are **DELETED** (Slice 1A). The live legacy *understanding* path (`/api/capture` findings) remains until V2 gates.

**CURRENT primary Ocean flow:**

1. Input (text / transcription) in `CaptureWorkspace` `variant="ocean"`
2. ✦ **Analyse** → `analyzeCaptureWithAI` → `/api/capture` — findings/proposals only; **history event `capture_analysed`; no domain writes**
3. Review cards / ambiguity / correction (`buildReviewChangeViewModels`)
4. Per-item **`applyOne`** (`CaptureSessionContext`) — `planCaptureApply` then `executeCaptureApply`. Illegal/unresolved findings are **Needs you / no write**. Persist-first for Risk, milestone create/update, Person, availability.

**`applyOne` legal domains (post-approval):** Todo authority; Risk authority; milestone/date authority (update yes, complete → Needs you / D-029); Person via `ensurePersonOnProject`; responsibility via Confirm Owner / share-vs-replace; structured availability; knowledge/memory. Unsupported/unknown → Needs you. **There is no generic Todo fallback.** Project scope uses Capture entry project only when the finding is not uncertain. A supplied durable ID that is not on the project does not fuzzy- or title-fallback onto another record.

**Ocean UI uses analyse + `applyOne` only.** Immediate-merge `capture()` / `captureWithAI` / `applyCaptureResult` / unmounted `CaptureBar` were **DELETED** in Slice 1A.

**People:** Capture apply reuses existing Person UUIDs **only after the Capture text establishes that Person**. A model-supplied UUID is not identity proof. Incomplete first-name fragments, competing same-name records, and wrong UUIDs are Needs you (`personLinkedIdentityGate` + Phase 3B `resolvePerson`). Duplicate-stakeholder on mention is closed. Leftover Knowledge people *prose* (never a finding) may still lack a stakeholder. **GAP D-007 remainder.**

**Other Capture GAPs:** D-013 session tables vs client lists / New Capture transcript (Phase 3D); D-014 hosted Capture apply → Supabase not in CI; D-011 New Project extractors only; D-005 remaining optimistic paths (Todo / Confirm Owner); D-025 Ocean §16 visual depth (not semantics).

**Key files:** `src/components/capture/CaptureWorkspace.tsx`, `CaptureSessionContext.tsx`, `src/lib/capture/apply/*`, `src/lib/store.tsx` (`analyzeCaptureWithAI`, persist-first Capture helpers), `src/lib/capture/*`, `persistCaptureSession`.

---

## 10. Knowledge Centre architecture

**CURRENT shell:** `OceanProjectWorkspace` — one project workspace, three modes:

| Mode | Behaviour |
| --- | --- |
| Knowledge (default) | `KnowledgeSearchAskBar` + `OceanKnowledgeFrames` |
| Capture | Embedded `CaptureWorkspace variant="ocean"` |
| Advise | Disabled / “coming soon” |

**Principle:** frames are **views** over maintained truth. They do not own a second store.

**Primary frames:** Current position, Risks & blockers, To Do.  
**Secondary (scroll, no accordion):** People & context, Dependencies, Decisions, Important dates, Waiting & open loops, Meeting Prep embed, Timeline embed.

| Frame | Predominantly |
| --- | --- |
| Current position | Knowledge `now` / structured facts |
| Risks | **Domain** `risks.status` (+ leftover knowledge-only bullets) |
| To Do | **Domain** todos |
| People | **Domain** stakeholders + current responsibilities |
| Dependencies | Structured Knowledge only |
| Decisions | Knowledge `decisions` |
| Dates | **Domain** timeline/milestones |
| Waiting | Dual todos + openLoops (**GAP**) |
| Meeting Prep / Timeline | Legacy frame embeds |

**Search:** deterministic `searchProjectKnowledge` — not AI.  
**Ask:** existing Tell Me session (respects `LUME_CANONICAL_TRUTH`). Suggested questions: quiet / deterministic.

**Item selection:** `KnowledgeItemCard` → stable `KnowledgeItemRef` → `KnowledgeItemDetailDrawer`. To Do **click opens detail** (complete is a drawer action, not the card click).

**Key files:** `src/components/knowledge-centre/*`, `src/lib/knowledge-centre/ocean-frames.ts`, `ocean-counts.ts`, `knowledge-item-detail.ts`.

---

## 11. Knowledge item detail / trust inspection

**CURRENT (Slice 2C, reused by 2D):**

- Refs: `structured | section | risk | knowledge_risk | todo | person | timeline | unconfirmed_owner`
- Resolver: `resolveKnowledgeItemDetail(state, projectId, ref)` — **project-scoped**; missing/wrong project → `null` (drawer closes)
- Drawer is a **view + mutation façade** over existing store methods. **It is not a truth store.**
- Provenance: humanized from stored `ProvenanceEntry` only (`capture` → “Learned from Capture”, `user_confirmation` → “Confirmed by you”, `manual_edit` → “Manually edited”, …). Empty provenance → honesty notes, **no invention**.
- Current vs previous: `supersedesId` / person historical responsibilities.
- Corrections: `buildCorrectedSectionBullets` (id/body, never index-only), `updateTodo`, `setRiskStatus`, Confirm Owner.
- Save errors: Ocean chrome `ocean-save-error` plus drawer + Confirm Owner (`saveStatus`/`saveError`) (**partial D-005**).
- History incompleteness: honesty notes cite **D-004**. Do not pretend History is complete after reload.

---

## 12. Ask / Tell Me architecture

**HTTP production path (Slice 1B — CURRENT):** browser sends `projectId` + `question` + conversation/display name. Server authenticates (`requireAiCaller`), loads durable workspace state (`loadMissionStateFromSupabase` via cookie RLS client), verifies the exact project belongs to that workspace, filters to that project, then `serializeCanonicalTruth`. Client `MissionState` / snapshot are **not** current-truth inputs. Load or assembly failure returns a visible error — never falls back to browser state.

**Library / eval path (TRANSITIONAL):** `answerTellMeQuestion` / `buildTellMeContext` may still accept a MissionState argument for tests and evals. `LUME_CANONICAL_TRUTH` still gates the **library assembler** (unset = off except eval/explicit; `0` = legacy `buildCaptureContext`). The HTTP route always passes `useCanonicalTruth: true` and never attaches a snapshot.

### Flag `LUME_CANONICAL_TRUTH` (`src/lib/canonical-truth/flag.ts`)

| Value | Behaviour |
| --- | --- |
| unset | **off** for library callers; **on** when `forEval` or `explicit: true`. HTTP Tell Me always passes explicit true. |
| `1` / `true` / `on` | Force canonical assembler |
| `0` / `false` / `off` | Force legacy assembler **in the library** (emergency rollback of serialiser, not of server load) |

**Remaining deletion gate:** legacy `buildCaptureContext` branch inside `buildTellMeContext`; flag default-off for evals; Coach still accepts client MissionState; **legacy Capture** (`LUME_CAPTURE_V2` unset) still uses `body.state`. Capture V2 Analyse+Apply use server load (Slice 1C). Do not delete the legacy Capture engine until the V2 default-on gate is authorised.

### Canonical Ask (HTTP + explicit / evals)

- `serializeCanonicalTruth` — **assembler only**, not a new store
- Includes: project metadata, Knowledge (current structured + legacy section projection), **all domain Risks with `risks.status`**, stakeholders, **all current responsibilities (multi-owner)**, open todos + WAITING/CHASE, milestones, structured dependency/availability **if present**, stored unconfirmed-owner ambiguities only (does **not** invent “owner not recorded” from absence — D-R06)
- History evidence **only** when `questionLooksHistorical`
- Current-state MODE excludes superseded Knowledge; domain Risks still listed with durable status (including resolved)
- Snapshot **null** on the HTTP path
- Tell Me remains **read-only**; Confirm Owner is a separate mutation

**Key files:** `src/lib/tell-me/{answer,context,server-truth,question-shape,scope,types}.ts`, `src/lib/canonical-truth/serialize.ts`, `src/app/api/tell-me/route.ts`.

---

## 13. History / provenance / evidence

| Mechanism | Question it answers | Authority |
| --- | --- | --- |
| **Provenance** (`knowledge_items.provenance`) | Why does Lume believe this maintained item? | Stored entries only |
| **Lifecycle / supersession** | What is current vs previous truth? | `lifecycle` + `supersedes_id` |
| **History** (`history_events`) | What happened, in time? | Chronology / evidence — **not competing current truth** |

**GAP D-004:** `pushHistory` often updates MissionState without `persistHistoryEvent`. After reload, History is incomplete. UI must not fabricate completeness. New Project `project_created` is secondary evidence after authoritative bundle success (Phase 3A); History insert failure does not roll back the project.

---

## 14. Persistence / Supabase model

**Isolation:** every product table is `workspace_id` + RLS `is_workspace_member`. App then filters `project_id`.

**Architecturally important tables (CURRENT):**

| Table | Role |
| --- | --- |
| `workspaces`, `workspace_members`, `profiles` | Tenant |
| `projects` | Project metadata |
| `stakeholders` | Person identity |
| `todos` | Todo authority |
| `risks` | Risk lifecycle authority |
| `knowledge_items` | Knowledge bullets + canonical metadata overlay |
| `milestones` | Dates (`MissionState.timeline`) |
| `memories`, `recommendations`, `meetings`, `releases` | Adjacent domains |
| `history_events` | Partial chronology |
| `capture_sessions`, `coach_sessions` | Intended durable sessions; **underused vs client lists** |
| `project_intelligence_snapshots` | Derived Ask compact view; ignored on canonical path |
| `workspace_usage` | Local analysis meter inputs |
| Billing (`billing_customers`, `subscriptions`, `billing_events`) | Stripe; **omitted from `src/types/database.ts`** (**GAP D-012**) |

**Canonical metadata migration:** `supabase/migrations/20260818230000_knowledge_canonical_metadata.sql` (additive columns on `knowledge_items`). Core schema: `20260812002748_workspace_schema.sql`.

**Phase 3A New Project persist:** `persistNewProject` inserts the reviewed bundle, then a secondary `history_events` row. Illegal risk source `setup` is gone (`manual`). There is no Postgres RPC transaction for this bundle. On child-insert failure the function deletes SET NULL children for that new `project_id` then deletes the project (CASCADE removes stakeholders/risks/knowledge/milestones). Client retries reuse `clientProjectId` (PK idempotency). Server `POST /api/workspace/projects` is the only supabase create path — store must not fall through to a second browser persist.

**Phase 3A.1 project delete:** User-facing Delete Project on the Ocean project header. Confirmation is `DetailModal` + Cancel + destructive button (same pattern as Reset demo; no type-the-name). Server `DELETE /api/workspace/projects/[id]` is the only supabase delete path. `persistProjectDelete` requires the exact project UUID in the authenticated workspace, deletes SET NULL children (`todos`, `memories`, `recommendations`, `history_events`, `capture_sessions`, `coach_sessions`) scoped by `workspace_id` + `project_id`, then deletes the project row (CASCADE removes stakeholders/risks/knowledge/milestones/meetings/releases/snapshots). Clones survive (`cloned_from_id` SET NULL). Workspace-level rows without that `project_id` are left alone. History belonging only to the deleted project is removed with the bundle — no workspace “project deleted” audit row is invented. After success, `applyDurableWorkspace` refreshes MissionState and paint cache; selection follows Home (`projects[0]` or `/` New Project onboarding). Failure uses `reportPersistFailure` and does not hide the project. Residual: **D-028** sequential non-transactional delete; **D-027** no archive/undo; Capture session *authority* remains **D-013** / Phase 3D.

---

## 15. Authentication / tenant isolation

- User authenticates (Supabase Auth production).
- Membership: `workspace_members` → RLS on all workspace tables.
- Projects belong to a workspace, not “the user row” as FK for every child.
- Application **must** keep `projectId` filters even when RLS would allow other projects in the same workspace.
- Future cross-project retrieval: only authorised workspace projects; never bypass RLS; never invent global person identity.

---

## 16. Cross-project future-readiness

**CURRENT V1 constraint:** project-scoped UI. No portfolio Overview, no cross-project Ask, no workspace-global People resolution.

**Already good for a later authorised multi-project read:** UUIDs on projects/people/items, `projectId` on rows, workspace RLS, provenance, People `personId` not array indexes.

**Avoid introducing:** helpers that hard-code “there is only ever one project in memory”; collapsing people by first name globally; APIs that drop `projectId` because V1 UI is single-project.

**Do not implement** portfolio behaviour in V1 slices.

---

## 17. AI vs deterministic behaviour

**AI (✦ affordance):** Capture interpretation, Ask reasoning, ✦ Refresh / coaching intelligence, future Advise. Must not persist durable relationships without review.

**Deterministic:** Knowledge search, UUID/identity lookup, `getPersonBundle`, project scoping, risk/todo lifecycle, date rendering, suggested questions (current), correction/reconcile, share-vs-replace **decision gating**, frame row builders, item-detail resolver.

Significance: ✦ marks model judgement. Confirmed Knowledge should look normal, not like an AI alert.

---

## 18. Trust / epistemic architecture

| State | Use |
| --- | --- |
| Known / confirmed / unmarked | Normal maintained truth |
| Informal / Unconfirmed / Conflicting / Needs you | Only when **stored** epistemic or unconfirmed responsibility supports it |
| ✦ Lume noticed | Observation / suggestion — not silent Risk/Todo/truth |
| superseded / historical | Previous truth; inspect in detail |
| High/Medium/Low confidence | **Capture review only** — not permanent Knowledge |

**INTENT:** material ambiguity → Needs you. Do not guess share vs replace. Do not invent unknown-owner gaps from missing retrieval (D-R06). Missing retrieval ≠ proof of unknown.

---

## 19. Current feature flags / transitional architecture

The **deletion-point** version of this table is Part C §H. This table remains the current-runtime map. The programme rule: **this table must get shorter as convergence proceeds.** Deletion should happen close to the change that supersedes a path, not in a terminal “cleanup PR”. Status tags: **CURRENT** / **DECIDED V1 TARGET** / **TRANSITIONAL / FLAGGED** / **DEPRECATED / SCHEDULED FOR DELETION** / **UNRESOLVED**.

| Flag / dual path | Status | Purpose | Default | New path | Old path remains | Removal condition |
| --- | --- | --- | --- | --- | --- | --- |
| `LUME_CANONICAL_TRUTH` | **TRANSITIONAL / FLAGGED.** **DECIDED V1 TARGET** = `serializeCanonicalTruth`. Legacy Ask **DEPRECATED / SCHEDULED FOR DELETION** after default-on | Ask assembler | **unset = legacy (off)** | `serializeCanonicalTruth` | `buildCaptureContext` + snapshots | After eval + product review; keep `0` rollback through one release; then delete legacy Ask branch |
| `LUME_CAPTURE_V2` | **TRANSITIONAL / FLAGGED.** **DECIDED V1 TARGET** = V2 + Phase 3B. Legacy findings **DEPRECATED / SCHEDULED FOR DELETION** after V2 gates | Capture observation pipeline | **unset = legacy (off)** | `src/lib/capture-v2` + Phase 3B apply | OpenAI findings / local regex fallback | Delete legacy OpenAI findings path after the required V2 gates; keep git as rollback. Local/no-OpenAI remains a fallback, not a second extraction engine |
| `LUME_NEW_PROJECT_V2` | **TRANSITIONAL / FLAGGED.** **DECIDED V1 TARGET** = V2 map + existing persist | New Project categorisation map | **unset = legacy (off)** | observations → provisional map → review → `persistNewProject` | `assembleFromNarrative` Talk path | Adopt or remove after Gate B evidence; do not keep two OpenAI New Project extractors |
| Appearance Ocean/Desert | **CURRENT** both. **DECIDED V1 TARGET** = keep both | Token themes | **Ocean default** | `[data-theme="desert"]` + Account picker | Ocean `[data-theme="dark"]` remains | **Keep both**; user-selectable. Magic Patterns V1 UX is product target, not a later reskin |
| `LUME_PERSISTENCE` | **CURRENT** prod supabase | Durable store | prod supabase | hydrate + persist-mutations | localStorage v5 in local/dev | Do not silent-fallback in prod |
| `LUME_AUTH` | **CURRENT** prod supabase | Auth | prod supabase | Supabase session | demo JWT / none | Keep demo/none for local DX |
| `LUME_ALLOW_LOCAL_IN_PRODUCTION` | **CURRENT** locked off | Escape hatch | unset/false | — | local in prod if both set | Keep locked |
| Knowledge sections vs structured | **TRANSITIONAL** overlay | Overlay | both live | structured + sectionItemIds | string bullets | Do not wipe sections; structured + ids are authority |
| Domain risks vs knowledge risks | **CURRENT** domain wins; leftover prose **TRANSITIONAL** | Lifecycle | domain wins | `MissionState.risks` | knowledge-only `[Resolved]` | Transitional compatibility + D-015/D-030 cleanup |
| Stakeholders vs people prose | **CURRENT** stakeholders; workspace Person = **DECIDED V1 TARGET** | Identity | stakeholders | Confirm Owner / bundle | unpromoted Capture bullets | Capture hardening (D-007); later workspace Person slice. Name is not identity |
| Capture analyse+applyOne vs captureWithAI | **DELETED** (Slice 1A). **CURRENT** Ocean = analyse+applyOne | Trust boundary | Ocean uses review | `applyOne` | — | Immediate-merge path removed; do not revive |
| Client session lists vs `capture_sessions` | **TRANSITIONAL** | Session history | client-primary | table write on apply | localStorage lists | Capture hardening (D-013) / Phase 3D |
| Coach drawer vs parked Advise | **CURRENT** Coach in AppShell. **DECIDED V1 TARGET** hide/retire Coach; Advise stays parked | Advisory UI | Coach still in AppShell | Product: Advise parked; Coaching out of V1 | `/api/coach` + `buildCoachContext` | Hide/retire Coach as a V1 product surface; do not invest in a third truth assembler |

---

## 20. Known architecture debt / unresolved seams

From `docs/LUME_V1_KNOWN_DISCOVERIES.md` as of this handoff. **Do not treat resolved D-R* as open.** D-019 is **resolved (D-R10)** — share-vs-replace UI shipped in Slice 2D.

| ID | Problem | Current impact | Target stage |
| --- | --- | --- | --- |
| D-003 | Suggestion accept/dismiss often MissionState-only | Reload resurrects suggestions | V1 product hardening |
| D-004 | Many History events never `persistHistoryEvent` | Evidence missing after reload (New Project create-path decided in 3A) | V1 product hardening |
| D-005 | Soft save failures | Ocean banner + reconcile landed; Capture Risk/milestone/Person/availability persist-first; other mutations may still be optimistic | V1 product hardening |
| D-007 | Capture people prose not promoted to stakeholders | Duplicate Person on Capture apply is closed; leftover Knowledge prose may still lack a stakeholder | remainder after 3B |
| D-008 / D-021 | Todo waiting vs Knowledge openLoops | Duplicate/contradictory loops in KC/Ask | Open-loop / To Do architecture slice |
| D-010 | Legacy Ask injects History as competing truth | Residual until canonical default | Canonical production default decision |
| D-011 | Demo-name regex extractors | Capture active path cleaned; New Project extractors remain structural | New Project touchpoint |
| D-012 | `database.ts` lags migrations | Typing/ops drift (billing, snapshots, evals) | post-V1 hygiene unless it blocks a gate |
| D-013 | Capture/coach tables underused; New Capture can retain transcript | Session honesty / authority | Phase 3D |
| D-014 | No live CI Capture apply → Supabase round-trip | Deterministic fake persist-failure exists; hosted apply not in `npm test` | before Capture V1-ready |
| D-015 | Historical `[Resolved]` titles as open risk rows | Possible leftover data | Data cleanup / V1 hardening |
| D-020 | Dependencies/availability under-modelled | Capture writes structured availability; Ask still has no calendar/graph | Ask/modelling remainder |
| D-024 | “Actions left” is local analysis meter | Not Stripe entitlement | Billing hardening |
| D-025 | Capture Ocean §16 visual depth | Review counts / session chrome | Phase 3D |
| D-026 | No unique `(workspace_id, code)` | Two projects may share a code; 3A retry uses UUID not code | New Project product decision |
| D-027 | No archive/undo after project delete | Permanent by design until a product Archive decision | post-V1 / accepted limitation |
| D-028 | Project delete is sequential, not one DB transaction | Failure after SET NULL cleanup can leave a visible project with some children already gone; UI does not fake success | V1 product hardening (bundle RPC) |
| D-029 | Milestone complete has no status column | Capture complete-date is Needs you | later date-lifecycle slice |
| D-030 | Leftover Knowledge prose vs domain after Capture apply | KC may still show old risk/date sentences | KC projection / reconcile |
| D-031 | Coach drawer auto-opens over Capture/KC | Overlay can hide Analyse | Ocean/QOL — **convergence: hide/retire Coach as V1 surface** |
| D-032 | Dual Capture / New Project OpenAI pipelines | Permanent dual engines reintroduce drift | After V2 gates; delete legacy understanding path |
| D-033 | AI decision routes accept browser-supplied MissionState | Stale/forged own-session context; unbounded payloads | **Tell Me HTTP fixed (Slice 1B).** **Capture V2 Analyse+Apply fixed (Slice 1C).** Coach + legacy Capture remain. |
| D-034 | Capture apply world is client MissionState; no row versioning | Planner cannot see concurrent durable writes | **Capture V2 Apply reloads fresh world + Analyse-time fingerprint (Slice 1C).** No schema `version`. Legacy apply still client-world. |
| D-035 | Project-domain mutations must verify intended project membership | `persistTodoUpdate` is one known instance (id-only WHERE); class is broader | **Capture V2 membership live (Slice 1C).** Persist-helper audit remains. |

**Resolved (do not reopen as missing architecture):** D-R01 durable Knowledge, D-R02 stable identity, D-R03 risk resurrection, D-R04/R05 Confirm Owner persist/UUIDs, D-R06 false unknown-owner, D-R07 multi-owner Ask, D-R08 Ocean Capture, D-R09 item detail, D-R10 share vs replace, D-R11 Phase 3A New Project integrity (includes D-006), D-R12 Phase 3A.1 Safe Project Deletion, D-R13 Phase 3B Capture mutation boundary (includes D-017).

---

## 21. Regression / test architecture

Deterministic suite: `npm test` → `scripts/run-regression-suite.ts` (credential-free; strips `OPENAI_API_KEY`). Live Supabase/evals are **separate** scripts.

| Suite | Protects |
| --- | --- |
| `knowledge-reconcile` / `project-truth-safety` | Identity, reconcile, isolation, persist plans |
| `risk-lifecycle` | `risks.status` vs Knowledge projection |
| `people-entities` | Confirm Owner model, share/replace API, bundles |
| `people-context-ui` | People frame + share-vs-replace UI contract |
| `ask-context-authority` / `canonical-truth` / `tell-me` / `context-integrity` | Ask assemblers; do not flip default in tests unless explicit |
| `ocean-knowledge-centre` / `ocean-capture` / `ocean-item-detail` | Ocean shell, Capture mode, drawer |
| `capture-trust-boundary` / `phase3b-capture-boundary` / `capture-review` / `capture-reliability` / `findings` / `capture-workspace` / `golden-test` | Review-before-write; legal-domain apply dispatcher |
| `hydrate-session` / `phase2-auth` / `rls-policies` / `production-config` | Auth/persist/prod invariants |
| `new-project` / `seed-reset` | Onboarding / demo |

**Rerun guidance:** touch Knowledge identity → reconcile + project-truth; Risks → risk-lifecycle; People → people-entities + people-context-ui; Ask → ask-context + tell-me + canonical; Ocean UI → matching ocean-* + capture-trust if Capture chrome; Capture apply → phase3b-capture-boundary; always `typecheck` + full `npm test` before merge of behavioural PRs.

**Playwright / property testing:** **CURRENT.** Workstream B landed a small frozen Playwright Capture V2 journey set (`e2e/capture-v2-journeys.spec.ts`) and narrow `fast-check` invariants (`scripts/verify-capture-v2-invariants.ts`), beside the credential-free `verify-*` regression suite. This is not a test-framework rewrite, not a screenshot farm, and not live-provider CI. These tests must protect behaviour **before** risky structural deletion (canonical default-on, Capture V2 default-on, legacy-path removal).

---

## 22. Reuse-first map

Inspect/extend these **before** creating parallel implementations:

| Purpose | Path | Reuse when |
| --- | --- | --- |
| Mission mutations / hydrate | `src/lib/store.tsx` | Any write the UI should persist |
| Knowledge reconcile | `src/lib/data/supabase/reconcile-knowledge.ts`, `knowledge-identity.ts` | Any Knowledge body/id change |
| Persist helpers | `src/lib/data/supabase/persist-mutations.ts` | New durable writes |
| People identity / confirm | `src/lib/people/identity.ts` | Person create/link/responsibility |
| Share vs replace gating | `src/lib/people/confirm-owner-choice.ts` + `ConfirmOwnerDialog` | Any ownership UI |
| Person bundle | `getPersonBundle` | Person-centred UI/Ask |
| Risk lifecycle | `src/lib/risks/lifecycle.ts` | Any risk status/display |
| KC frame rows | `src/lib/knowledge-centre/ocean-frames.ts` | KC list projections |
| Item detail | `knowledge-item-detail.ts` + `KnowledgeItemDetailDrawer` | Inspection/correction UX |
| Canonical Ask | `serializeCanonicalTruth` | Ask context — do not rebuild a third assembler |
| Legacy Ask | `buildTellMeContext` / `buildCaptureContext` | Rollback path only |
| Capture apply | `src/lib/capture/apply` (`planCaptureApply` / `executeCaptureApply`) via `CaptureSessionContext.applyOne` | Capture writes — exhaustive domain dispatcher; no generic Todo fallback; unknown op / foreign ID / conflicting `legalDomain` / unknown ownership semantics fail closed; availability stickers cannot retarget Risk/Todo/milestone; CREATE against an existing on-project identity is no-change |
| Search | `src/lib/tell-me/knowledge-search.ts` | Deterministic search |
| Ocean shell | `OceanProjectWorkspace` | Project UI modes |
| Drawer pattern | item-detail / CoachDrawer | Side inspection, not new pages |
| Project scoping | always pass `projectId` into resolvers | Isolation |

---

## 23. Dangerous assumptions future developers should NOT make

Verified against current product/code:

1. Knowledge prose is **not** automatically authoritative for Risks, People identity, Todos, or milestones.
2. A responsibility does **not** have exactly one owner.
3. Adding a new owner does **not** imply replacement.
4. History is **not** current truth and is **not** complete after reload.
5. Missing retrieval does **not** prove a fact is unknown (do not invent Needs you from absence).
6. Resolved Risks must **not** be resurrected from Knowledge prose or `[Resolved]` folding.
7. Capture analysis does **not** write before review on the Ocean path (`analyzeCaptureWithAI`). Immediate-merge `captureWithAI` was deleted in Slice 1A.
8. Stable item identity must **not** rely on list position.
9. Knowledge Centre frames do **not** own the truth they display.
10. People identity is **currently** project-scoped `stakeholders`, not global contacts; do not fuzzy-merge similar names. **DECIDED V1 TARGET** is workspace-scoped Person + project participation (Part C §C7) — that is not a licence to introduce an Entity-Everything table. **A name is not identity**; do not add a unique-name constraint.
11. V1 being project-scoped does **not** justify dropping `projectId` or blocking later authorised multi-project reads.
12. AI must **not** infer and persist durable relationships without human review.
13. Production Ask is **not** canonical unless `LUME_CANONICAL_TRUTH=1`.
14. `localStorage` is **not** the production source of truth.
15. `src/types/database.ts` is **not** a complete inventory of live tables.
16. Timeline in MissionState is **not** a table named `timeline` (it is `milestones`).
17. The 19 August Project Truth Architecture Audit is **not** fully current (especially Risks, People persist, Knowledge Edit persist, Confirm Owner share).
18. Browser-posted `MissionState` is **not** server-authoritative current truth for AI routes (D-033).
19. Capture V2’s prompt “world” is **not** a second snapshot store — it is an ID catalogue over the same durable authorities.
20. Coach is **not** a V1 product surface to invest in (philosophy §26); do not build a third assembler for it.
21. `updated_at` triggers are **not** optimistic concurrency (D-034).
22. Workspace RLS is **not** per-project ACL — application code must keep `projectId` filters.
23. **Every project-domain mutation must verify that the target durable object belongs to the intended project before mutation** (D-035). `persistTodoUpdate` is one known gap, not the whole class.

---

# PART B — DETAILED ARCHITECTURE REFERENCE

## A. High-level data-flow (CURRENT)

```
User input (Capture Ocean mode)
  → ✦ Analyse (/api/capture) → findings in session (NOT project truth)
  → human review / applyOne
      → planCaptureApply (legal domain + project scope) → executeCaptureApply
          → persist-first Capture hooks (risk / milestone / person / availability)
          → existing todo / knowledge / confirm-owner store mutations
              → persist-mutations / persistKnowledgeReconcile / persistRiskStatus / persistEnsureStakeholder
              → Supabase (workspace RLS)
                  → loadMissionStateFromSupabase (reload)
                      → MissionState cache
                          → Ocean frames (views)
                          → item detail resolver (view + façade mutations)
                          → deterministic Search
                          → Ask: legacy buildTellMeContext  OR  canonical serializeCanonicalTruth
                              (flag default = legacy)

Parallel writes:
  Knowledge Centre / item detail Correct
  Confirm Owner (share | replace)
  Todo complete / Risk resolve
  New Project persistNewProject
  Delete Project persistProjectDelete
```

---

## B. Domain-by-domain architecture

### Projects

- Types: `Project` in `src/lib/types.ts`
- UI: `OceanProjectWorkspace`, `Sidebar`, `NewProjectExperience`
- Table: `projects`
- Writes: `createProject` → `POST /api/workspace/projects` → `persistNewProject` (compensating cleanup + `clientProjectId` idempotency); `deleteProject` → `DELETE /api/workspace/projects/[id]` → `persistProjectDelete` (SET NULL children then project; persist-first)
- Tests: `verify-new-project.ts`, `verify-phase3a-integrity.ts`, `verify-project-delete.ts`
- GAP: **D-026** product rule for unique project codes is unresolved; retry safety does not use code matching. **D-027** no archive/undo. **D-028** sequential delete.

### Knowledge

- Types: `ProjectKnowledge`, `CanonicalTruthItem`
- UI: Ocean frames, `ProjectKnowledgeBrief` (legacy brief still exists), item detail
- Helpers: `alignSectionLines`, `planKnowledgeReconcile`, `remapStructuredForSections`
- Store: `updateKnowledgeSection`, `addKnowledgeBullet`, `replaceKnowledge`
- Table: `knowledge_items`
- Tests: `verify-knowledge-reconcile.ts`, `verify-project-truth-safety.ts`
- Note: 19 Aug audit said Knowledge Edit Save did not persist — **CURRENT `replaceKnowledge` calls `persistKnowledgeReconcile`** (D-R01)

### People / responsibilities

- Types: `Stakeholder`, `ResponsibilityMeta`, `PersonBundle`
- UI: People frame, person detail, `ConfirmOwnerDialog`, `PersonEntity`
- Helpers: `identity.ts`, `confirm-owner-choice.ts`
- Store: `confirmResponsibilityOwner`
- Tables: `stakeholders` + `knowledge_items`
- Tests: `verify-people-entities.ts`, `verify-people-context-ui.ts`
- Discoveries: D-007 open (Capture promote); D-019 **implemented** (D-R10)

### Risks

- Types: `ProjectRisk`, `RiskStatus`
- Helpers: `src/lib/risks/lifecycle.ts`
- Store: `setRiskStatus`, `setKnowledgeOnlyRiskResolved`
- Table: `risks` (+ knowledge projection)
- Tests: `verify-risk-lifecycle.ts`
- Discoveries: D-015 leftover data; D-003 suggestions not auto-risks

### Todos / waiting

- Types: `TodoItem`, `TodoKind`
- Store: `toggleTodo`, `updateTodo`, `addTodo`, `removeTodo`
- Table: `todos`
- UI: Ocean To Do + Waiting frames, Master To Do `/todos`
- Discoveries: D-008, D-021

### Dates

- Types: `TimelineItem`
- Table: `milestones`
- Store: `addTimelineItem`

### Capture

- Components: `CaptureWorkspace`, `CaptureSessionContext`
- API: `src/app/api/capture/route.ts` (Analyse); `src/app/api/capture/apply/route.ts` (V2 Apply)
- V2 truth: `loadServerCaptureWorld` (shared durable loader) → `captureApplyWorldFromState` / `worldFromCaptureState` (Phase 3B ID catalogue, not `serializeCanonicalTruth`)
- V2 Apply: fresh load → expectedTarget fingerprint → `planCaptureApply` → `executeCaptureApply`
- Flag `LUME_CAPTURE_V2` still default **off**. Legacy understanding path still uses client `body.state`.
- Tests: capture-trust-boundary, capture-review, capture-v2, capture-server-truth, stacked-capture, ocean-capture
- Discoveries: D-033 partial (Capture V2); D-034 partial (fingerprint, no schema version); D-035 partial (Capture membership; persist helpers remain)

### Ask / Tell Me

- `loadServerCurrentTruthForTellMe` → `serializeCanonicalTruth` → `answerTellMeQuestion`
- HTTP does not trust client MissionState
- Library flag: `isCanonicalTruthEnabled` (evals / legacy assembler rollback)
- Tests: ask-context-authority, canonical-truth, tell-me, tell-me-server-truth, context-integrity
- Discoveries: D-033 partial (Tell Me HTTP + Capture V2); Coach + legacy Capture remain; D-010 residual on library legacy branch

### History / provenance

- `HistoryEvent`, `ProvenanceEntry`
- `persistHistoryEvent` (partial)
- Discovery: D-004

---

## C. Key file index

| Concern | Primary files | Purpose |
| --- | --- | --- |
| Product constitution | `docs/v1-reference-pack/*` | Philosophy, Ocean UI, process |
| Defects | `docs/LUME_V1_KNOWN_DISCOVERIES.md` | Open/resolved architecture debt |
| Runtime state | `src/lib/store.tsx`, `src/lib/types.ts` | MissionState hub |
| Persistence mode | `src/lib/persistence-mode.ts`, `src/lib/auth-mode.ts` | local vs supabase |
| Hydrate | `src/lib/data/supabase/load-mission-state.ts` | DB → MissionState |
| Writes | `src/lib/data/supabase/persist-mutations.ts` | Incremental persist |
| Knowledge identity | `src/lib/knowledge-identity.ts` | Stable ids |
| Knowledge reconcile | `src/lib/data/supabase/reconcile-knowledge.ts` | Durability |
| Canonical types | `src/lib/canonical-truth/types.ts` | Overlay model |
| Canonical Ask | `src/lib/canonical-truth/serialize.ts`, `flag.ts` | Assembler + flag |
| People | `src/lib/people/identity.ts`, `confirm-owner-choice.ts` | Identity + share/replace |
| Risks | `src/lib/risks/lifecycle.ts` | Status authority |
| Ocean KC | `src/components/knowledge-centre/*` | Workspace UI |
| Frame builders | `src/lib/knowledge-centre/ocean-frames.ts` | Pure projections |
| Item detail | `src/lib/knowledge-centre/knowledge-item-detail.ts` | Resolver |
| Confirm Owner UI | `src/components/intelligence/ConfirmOwnerDialog.tsx` | Share vs replace |
| Capture UI | `src/components/capture/CaptureWorkspace.tsx`, `CaptureSessionContext.tsx` | Analyse/apply |
| Tell Me | `src/lib/tell-me/*` | Ask |
| Search | `src/lib/tell-me/knowledge-search.ts` | Deterministic search |
| DB types | `src/types/database.ts` | Incomplete vs migrations |
| Schema | `supabase/migrations/` | Live tables + RLS |
| Request gate | `src/proxy.ts` | Auth redirects |
| Billing | `src/lib/billing/*` | Stripe |
| Regression | `scripts/run-regression-suite.ts`, `scripts/verify-*.ts` | Safety net |

---

## D. Database / table map (architectural)

- **Workspace** owns **projects**. Child rows carry `workspace_id` + `project_id`.
- **`knowledge_items`:** `section`, `body`, `position`, plus canonical `kind`, `epistemic`, `lifecycle`, `supersedes_id`, `meta` jsonb, `provenance` jsonb.
- **`stakeholders`:** `name`, `role`, arrays for preferences/concerns; **no** global person key.
- **`risks`:** `title`, `status`, `source` check (`manual|capture|seed`).
- **`todos`:** `kind`, `waiting_on` text, `due_at`, `done`.
- **`milestones`:** mapped to timeline items (`label`, `start_at`, `type`).
- **RLS:** membership helper; not documented here as raw SQL.

---

## E. Main write paths (CURRENT)

| User action | In-memory | Durable |
| --- | --- | --- |
| Manual Knowledge section edit / item-detail Correct | `updateKnowledgeSection` / `replaceKnowledge` | `persistKnowledgeReconcile` |
| Capture applyOne Knowledge bullet | `addKnowledgeBullet` / merge | knowledge persist / reconcile |
| Capture applyOne new Risk | `addCaptureRisk` persist-first | `persistKnowledgeBullet` dual-write `risks` |
| Capture applyOne Risk status | `setCaptureRiskStatus` persist-first | `persistRiskStatus` + knowledge risks reconcile |
| Capture applyOne date create/update | `addTimelineItem` / `updateTimelineItem` persist-first | `persistTimelineItem` / `persistTimelineUpdate` |
| Capture applyOne Person | `ensureCapturePerson` persist-first | `persistEnsureStakeholder` |
| Capture applyOne availability | `addAvailabilityItem` persist-first | `persistKnowledgeBullet` `kind=availability` |
| Risk resolve (domain) | `setRiskStatus` | `persistRiskStatus` + knowledge risks section reconcile |
| Knowledge-only risk resolve | `setKnowledgeOnlyRiskResolved` | knowledge reconcile only |
| Confirm Owner share | `confirmResponsibilityOwner` without `replacePersonId` | `persistEnsureStakeholder` + knowledge insert/update |
| Confirm Owner replace | same + `replacePersonId` | plus `persistKnowledgeLifecycle` superseded |
| Todo edit/complete | `updateTodo` / `toggleTodo` | `persistTodoUpdate` (+ some history persist) |
| New Project | `createProject` (persist first, then MissionState from returned hydrate) | `persistNewProject` via `/api/workspace/projects` only |
| Delete Project | `deleteProject` (persist first, then MissionState from returned hydrate) | `persistProjectDelete` via `DELETE /api/workspace/projects/[id]` only |

Optimistic UI: many updates still change MissionState immediately; persist errors set `saveStatus=error`, show Ocean save failure, and reconcile from durable workspace state (**D-005 partial**). Paint cache must not store unconfirmed state.

---

## F. Main read paths (CURRENT)

| Surface | Path |
| --- | --- |
| Knowledge Centre frames | `useMission().state` → `ocean-frames.ts` builders → cards |
| Search | `searchProjectKnowledge` over project Knowledge |
| Person detail | `refForPerson` → `resolveKnowledgeItemDetail` → `getPersonBundle` |
| Knowledge/Risk/Todo detail | typed refs → resolver → drawer |
| Ask legacy | `buildTellMeContext` → Capture context + snapshot |
| Ask canonical | `serializeCanonicalTruth` from MissionState domains |

---

## G. Current duplication map

| Concept | Where it appears | Classification |
| --- | --- | --- |
| Open risk title | `risks` + `knowledge.sections.risks` | **Authoritative + projection** (acceptable if sync held) |
| Person | `stakeholders` + people bullets + structured responsibility | **Authoritative identity + projection + TRANSITIONAL unpromoted prose (D-007)** |
| Waiting | todos waiting + openLoops | **Competing authority (D-008)** — architectural risk |
| Capture session list | localStorage vs `capture_sessions` | **Transitional** (D-013) |
| Ask context | legacy Capture-context vs canonical serialize | **Feature-flag dual path** (D-010 residual on legacy) |
| History | in-session `pushHistory` vs `history_events` | **Evidence incomplete (D-004)** |
| Suggestions | MissionState vs `recommendations` table | **Competing on accept/dismiss (D-003)** |
| Analysis meter vs Stripe | strip “actions left” vs billing tables | **Intentional different concepts (D-024)** |
| Timeline vs milestones | naming only | Acceptable mapping |

---

## H. Feature-flag / compatibility map

See Part A §19. Rollback for Ask: `LUME_CANONICAL_TRUTH=0`. Persistence rollback to local in production requires **two** explicit env knobs and is not a product path.

Canonical serialize still calls `deriveLegacyStructured` when a project has no `structured` overlay — compatibility read, not a write.

---

## I. Architecture chronology (why it looks like this)

Foundations on `main` (through Slice 2D):

| Slice | What it established |
| --- | --- |
| **1A** | Knowledge corrections persist (`persistKnowledgeReconcile`) |
| **1A.1** | Stable Knowledge identity (never index-alone) |
| **1B** | Risk lifecycle authority (`risks.status`); Knowledge projection |
| **1C** | Person UUID + scoped responsibilities; share-by-default API; stakeholder persist |
| **1D** | Canonical Ask **assembler** from those authorities; production flag **still off** |
| **2A** | Ocean KC as views over those authorities |
| **2B** | Capture as Ocean mode; review-before-write chrome; dark-only |
| **2C** | Reusable item-detail drawer; provenance honesty |
| **2D** | Share vs replace UI; People frame/detail consume 1C |

Earlier Phase 2 work delivered auth, Supabase schema, Tell Me, evals, billing **prep**. Do not treat Phase handovers as overriding Slices 1A–2D.

---

## Discrepancies: 19 Aug Project Truth Architecture Audit vs CURRENT code

The audit remains useful as a map of tables and dual-path **risks**, but these claims are **stale**:

| Audit (19 Aug) | CURRENT (21 Aug / Slice 2D) |
| --- | --- |
| No first-class `MissionState.risks[]`; Risk UI from knowledge + recommendations | `MissionState.risks` is Risk authority; KC projects open/watch |
| Knowledge Edit / `replaceKnowledge` memory-only | `replaceKnowledge` persists via `persistKnowledgeReconcile` |
| Confirm Owner does not persist stakeholders; second owner silently supersedes | `persistEnsureStakeholder`; default **share**; UI asks replace vs share |
| People identity “split” as the operating model | Operating model is stakeholders + structured responsibilities; split remains as **Capture promotion gap** |
| Canonical flag “affects Tell Me only, not Knowledge UI” | Still true that the **flag** is Ask-only; Knowledge UI **does** consume structured overlay independently of the flag |

Prefer this handoff + Known Discoveries + slice handovers over the audit for authority rules.

---

## Documentation maintenance

When a later slice changes authority, update:

1. This file (especially Part A §§3–12, 19–20, 22 **and Part C** if a convergence decision is reversed or completed)
2. `docs/LUME_V1_KNOWN_DISCOVERIES.md`
3. The slice handover

Do not leave “open” Known Discovery headings that contradict a D-R resolved entry without housekeeping.
Do not create a fourth overlapping architecture audit. Amend this file.

---

# PART C — V1 ARCHITECTURAL CONVERGENCE DELTA (26 August 2026)

**Status:** Binding target decisions for V1 convergence. **Not implemented in this review.**  
**Base SHA:** `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4` (`cursor/capture-v2-desert-new-project-56c9`)  
**Is this a new architecture?** No. This part answers: *what changed since the 25 Aug handoff, what was already documented, and which one path should survive.*  
**Thor amendment (same day):** name is not identity (no unique-name constraint); project-scoped mutation is a broad invariant (D-035); status categories made explicit. Approved architectural substance is otherwise unchanged.

For every claim below, **Already documented** means Part A/B or Known Discoveries already had it; **New since handoff** means this review found or decided it against current code.

---

## C0a. Status register (explicit)

Use the legend in the file header. This table is the ambiguity-remover for the dual-path / target items. It does not replace Part A.

| Topic | CURRENT | DECIDED V1 TARGET | TRANSITIONAL / FLAGGED | DEPRECATED / SCHEDULED FOR DELETION | UNRESOLVED |
| --- | --- | --- | --- | --- | --- |
| Capture V2 | Flag unset = **off**; library present | **The** V1 Capture understanding engine + Phase 3B apply | `LUME_CAPTURE_V2=1` coexistence | — | — |
| Legacy Capture understanding (OpenAI findings / local regex extract) | **Default** `/api/capture` path when flag unset | Not the V1 engine | Coexists until V2 default-on | **After required V2 gates** (git rollback) | — |
| Immediate-merge `capture()` / `captureWithAI` / `CaptureBar` | **DELETED** (Slice 1A) | Ocean analyse + `applyOne` | — | Removed | — |
| Canonical truth (`serializeCanonicalTruth`) | Assembler exists; production flag **off** | **The** current-truth recall projection | `LUME_CANONICAL_TRUTH` dual Ask | Legacy Ask branch after default-on + one-release rollback | Production default-on **timing** waits on eval/Test workstream |
| Person identity | Project-scoped `stakeholders` UUID. **UUID is not Capture identity proof** (Slice 1D: recorded full name in text) | Workspace `people` + project participation. **Stable IDs own identity. A name is not identity.** Same-name people must remain representable. Name-only resolution if ambiguous → Needs you. No unique-name DB constraint. No fuzzy/global merge of existing rows | Exact-name match as conservative temporary resolver | — | When to ship the `people` table (not first slice) |
| Playwright / property testing | `verify-*` + frozen Playwright Capture V2 journeys + narrow fast-check invariants | Tests must protect behaviour **before** risky structural deletion | — | — | — |
| Ocean | Default appearance | **Keep** | — | **Never** | — |
| Desert | Supported appearance (`data-theme="desert"`) | **Keep both** (user-selectable) | — | — | MP token/UX polish (sibling stream) |
| Coach | In AppShell / Intelligence strip / `/api/coach` | **Hide/retire** as V1 product surface | — | Coach product surface | Exact MP strip layout after hide |
| Advise | Stub “Coming soon” | **Parked** (philosophy §26) | — | — | Whether Advise is required later |
| Waiting vs openLoops | KC concatenates both; no single authority | Todos = waiting *work*; openLoops = narrative | Concatenated **view** until promotion/supersede lands | — | Visual distinction in the Waiting frame (MP) |
| ✦ Lume noticed | `recommendations` table + often memory-only accept/dismiss (D-003) | Table is durable noticed lifecycle; generators are not truth | — | — | — |
| Unique person/stakeholder **name** | App may reuse exact name (`ensurePersonOnProject`) | **Rejected as identity.** Do **not** add `UNIQUE` on name | Exact-name match as temporary resolver only | Unique-name-as-identity recommendation (removed in Thor amendment) | — |

---

## C0. What is genuinely new vs already documented

| Topic | Already in handoff / discoveries? | What this review adds |
| --- | --- | --- |
| MissionState is a hydrate cache, not server truth | **Yes** §2 | Migration map of *which AI routes still accept client MissionState* (D-033) |
| `serializeCanonicalTruth` is the Ask assembler | **Yes** §12; flag default off | Promote it to **the** current-truth projection for recall; do not build another snapshot architecture |
| Capture V2 + Phase 3B apply | **Yes** §9/§19, D-032, `EXPERIMENTAL_PROGRAMME.md` | Bind V2 as **the V1 Capture engine**; V2 world is an ID catalogue, not a second truth store |
| Waiting dual authority | **Yes** D-008/D-021 | Product-grounded split: todos = waiting *work*; openLoops = narrative |
| Recommendations vs table | **Yes** D-003 | Table = durable noticed-lifecycle; generators are not authorities |
| History incomplete / not current truth | **Yes** D-004, §13 | Canonical path already correct; persist sparse events; snapshots must not compete |
| Risks domain authority | **Yes** §6 | Confirmed. Cleanup is D-015/D-030, not a new Risk engine |
| People project-scoped stakeholders | **Yes** §5 | **Target direction** is now workspace Person + project participation (binding). Not first implementation slice |
| Phase 3B is Capture mutation boundary | **Yes** D-R13 | Concrete gaps only: client world, no `version`, mixed persist, not app-wide (and should not become app-wide) |
| New Project / delete non-transactional | **Yes** D-R11 residual, D-028 | Smallest DB fix: two bundle RPCs (or CASCADE on SET NULL FKs). No generic transaction framework |
| Dual Capture/Ask flags | **Yes** §19 | Earliest **deletion points** so the dual-path table gets shorter |
| Coach in AppShell | Partially (D-031) | Product constitution parks Coaching. Do not migrate Coach to a third assembler |
| Magic Patterns V1 UX | Binding programme; not in handoff as artefacts | **No MP artefacts in this repo.** Flag dependencies for the MP workstream |

V2 programme match (no STOP): Phase 3B is in ancestry; Capture V2, New Project V2, and Desert are on this SHA; independent review verdicts are in `docs/EXPERIMENTAL_PROGRAMME.md`. PR #66 remains open and is not merged here.

---

## C1. One canonical current-truth path

### Spine (binding)

```
authoritative durable state (Supabase tables)
  → one server-authoritative current-project representation
      (`loadMissionStateFromSupabase`, scoped by workspace RLS + application `projectId`)
  → one recall assembler (`serializeCanonicalTruth`)
  → model observations (Capture V2) / Ask answers
  → human Review
  → fresh validation + typed legal mutation (`planCaptureApply` for Capture)
  → durable state
```

`MissionState` stays as **client view/cache**. It must not be posted as the authority for AI/decision routes.

### Inventory (what exists now)

| Path | Role now | Class | After convergence |
| --- | --- | --- | --- |
| Supabase domain tables | Durable truth | **authoritative** | Keep |
| `loadMissionStateFromSupabase` / `GET /api/workspace/state` | Server hydrate | **authoritative transport** | Keep; reuse for AI routes |
| `MissionState` / `store.tsx` | UI working copy | **cache** | Keep as cache only |
| `lume-mission-supabase-cache-v1` | Paint cache | **cache** | Keep; never write unconfirmed state |
| `mission-control-state-v5` | Dev local durable | **cache** (dev) | Keep for local DX; never prod fallback |
| `serializeCanonicalTruth` | Canonical Ask assembler (flag **off**) | **derived recall projection** | **THE current-truth projection** for Ask/Coach-if-any/any recall |
| `buildCaptureContext` + snapshots | Default Ask + Capture ranking; injects history | **derived + historical leakage** | Delete from Ask after canonical default; optional ranked retrieval for Capture only if still needed |
| `project_intelligence_snapshots` / `lume-tell-me-snapshots-v1` | Compact Ask summary | **derived cache** | Not current truth. Optional “last refreshed” UX only |
| Capture V2 `worldFromCaptureState` / `formatAuthoritativeStateForPrompt` | ID catalogue for observation extraction | **derived ID list** | Keep as a *view of the same authorities*; build from **server-loaded** state, not a new snapshot store |
| `buildCoachContext` / `projectBundle` | Bespoke Coach JSON from client state | **derived duplicate** | Do not invest. Hide/retire Coach |
| `generateProactiveRecommendations` / `refreshProjectSuggestions` | Heuristic suggestion generators | **provisional** | Generators only; persist via `recommendations` or do not claim durability (D-003) |
| Ocean frames / item detail / search | UI views | **derived** | Keep |
| Capture sessionStorage / client session lists | Review draft + local history | **session** | Phase 3D → `capture_sessions` |
| `deriveLegacyStructured` | Read projection when `structured` empty | **compatibility** | Keep until overlay covers active projects; not a write |

`serializeCanonicalTruth` already takes `{ state: MissionState, projectId, question }`. Do **not** create a parallel serializer. The migration is: **load `state` on the server**, then call the existing function. Caps already exist in the assembler (risks/people/todos/milestones) — that is the large-project control, not a second snapshot architecture.

Capture V2 must **not** become a second current-truth projection. Its prompt block is intentionally a compact ID list so the model extracts observations against stable identities. Those identities must come from the same durable rows `serializeCanonicalTruth` reads.

---

## C2. Competing domain authorities — decisions

Grounded in `docs/v1-reference-pack/LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md` and Ocean baseline, not implementation convenience.

### 1. Waiting / open loops (D-008 / D-021)

| Store | Product meaning | Authority |
| --- | --- | --- |
| `todos` with `WAITING` / `CHASE` / `waitingOn` | Actionable wait the PM owns (“person the PM is waiting on”) | **Maintained waiting work** |
| `knowledge.sections.openLoops` / structured `open_loop` | Narrative unfinished facts | **Knowledge narrative** until promoted or closed |

**Decision:** one Waiting *frame* (view) may still concatenate both. There must be **one authority per kind of thing**. Do not fuzzy-dedupe. When a todo is created from an open loop, **supersede** the openLoop item (lifecycle) rather than leaving two current rows. Canonical Ask: waiting block from todos; `open_loop` items remain Knowledge, not a second todo list.

`waitingOn` is text today (exact name match). Until the Person slice, new writes should carry `personId` in meta/fields when the Person is already known; keep the display name as cache.

### 2. Recommendations / ✦ Lume noticed (D-003)

**Decision:** ✦ Lume noticed is **provisional**. It must not silently become Risk/Todo/Knowledge (philosophy §6).

| Layer | Role |
| --- | --- |
| `recommendations` table | Durable lifecycle of noticed items the user has been shown (pending / accepted / dismissed) |
| `MissionState.recommendations` | Cache of that table |
| `generateProactiveRecommendations`, `refreshProjectSuggestions`, Capture-emitted recs | **Generators**, not authorities |

Accept/dismiss **must persist** (D-003) before suggestions are treated as product-real. Do not add a Hygiene Engine. Do not auto-convert.

### 3. History (D-004)

**Decision:** History is evidence/chronology, not current truth (already documented; philosophy §15/§21).

| Path | Durable? | Survives reload? |
| --- | --- | --- |
| `history_events` | Yes | Yes (until project delete — intentional with the bundle) |
| `pushHistory` without `persistHistoryEvent` | No | **Disappears** — this is the V1 history that can vanish |
| Provenance on `knowledge_items` | Yes | Yes — answers “why do we believe this item?” |
| Intelligence snapshots | Derived | Must not compete with current truth |

Canonical Ask already omits history unless the question looks historical. Legacy Ask still injects it (D-010). Prefer sparse high-signal durable events; never make History the recall assembler.

### 4. Risks

**Decision:** `risks` table / `MissionState.risks` remains the sole open-risk authority (already documented). `knowledge.sections.risks` is projection. Recommendations of kind `risk` stay suggestions until the user converts. Leftover `[Resolved]` rows and leftover prose are **data/projection cleanup** (D-015, D-030), not a new Risk model.

### 5. People / responsibilities / availability

**CURRENT:** project-scoped `stakeholders` UUID = identity **and** participation. Responsibilities/availability live on `knowledge_items` with `personId`. Exact normalised name match within a project is a **temporary resolver**, not identity. `waitingOn` and memories `people` are text.

**DECIDED V1 TARGET:** see §C7. Stable IDs own identity. Same-name people remain representable. No unique-name constraint. Do not fuzzy-merge. Do not mint identity from leftover prose (D-007 remainder).

---

## C3. Server-authoritative migration

This is **not** primarily an IDOR/tenant-isolation repair. Workspace RLS (`is_workspace_member(workspace_id)`) already bounds tenant access. Project isolation remains **application-layer** because RLS is workspace-wide.

**Actual gains of server load:** freshness; resistance to the client omitting/forging in-session context; predictable assembler input; model-cost and payload control; simpler truth semantics; consistent `projectId` scoping.

### Routes that accept browser-supplied MissionState today

| Route | Client sends | Server loads project truth? | Call sites |
| --- | --- | --- | --- |
| `POST /api/tell-me` | `projectId` + `question` + conversation (intent). Leftover `state`/`snapshot` **ignored** | **Yes** — `loadMissionStateFromSupabase` then `serializeCanonicalTruth` | `TellMeSessionContext.tsx` |
| `POST /api/tell-me/refresh` | `projectId` (+ display name). Leftover `state` **ignored** | **Yes** — same server load; snapshot is derived UX, not AI truth | `TellMeSessionContext.tsx` |
| `POST /api/capture` | V2: `projectId` + transcript. Leftover `state` **ignored**. Legacy (flag off): partial MissionState | **V2 yes** — `loadServerCaptureWorld` then `worldFromCaptureState`. Legacy no | `requestCaptureAnalysis` in `store.tsx` |
| `POST /api/capture/apply` | V2: `projectId` + approved item + expectedTarget. **No MissionState** | **Yes** — fresh `loadServerCaptureWorld`, fingerprint revalidation, Phase 3B | `CaptureSessionContext.applyOne` when `capturePipeline === "v2"` |
| `POST /api/coach` | Large MissionState slice | **No** | `CoachSessionContext.tsx`, `CoachButton.tsx` |
| `POST /api/new-project` | Narrative / answers only | No (draft); persist is separate | `NewProjectExperience.tsx` |
| `POST /api/workspace/projects` | `CreateProjectInput` | **Yes** — persist then `loadMissionStateFromSupabase` | `store.createProject` |
| `DELETE /api/workspace/projects/[id]` | Path UUID | **Yes** | `store.deleteProject` |
| `GET /api/workspace/state` | None | **Yes** | Hydrate / reconcile |
| `POST /api/transcribe` | Audio only | No | Capture / New Project |

**Reference pattern to copy:** `/api/new-project` (intent in) and `/api/workspace/projects` (server persist + reload). Lowest-risk AI pattern:

```
projectId + user intent
  → requireAiCaller (auth + entitlement + rate limit)
  → loadMissionStateFromSupabase
  → application-layer filter to that projectId
  → serializeCanonicalTruth  OR  captureApplyWorldFromState
  → model / planner
```

**Surface-by-surface order (lowest risk first):**

1. **`/api/tell-me` and `/api/tell-me/refresh`** — **done (Slice 1B).** Read-only; `serializeCanonicalTruth`; no client-state fallback.
2. **`/api/capture`** — replace `body.state` with server load for `projectId`; keep Phase 3B; V2 world from that load.
3. **Capture apply execution** — planner world from the same fresh load (D-034), still `planCaptureApply`.
4. **`/api/coach`** — only if Coach remains at all; prefer hide/retire over migration investment.

Do not send a client-constructed “current project JSON” to decision routes. Transcript/question/conversation are intent.

---

## C4. AI trust boundary (establish during migration; do not implement here)

Already present: `requireAiCaller` (auth, `canUseLume` entitlement, per-user hourly in-memory rate limits). Production 503 if OpenAI missing on Capture/Tell Me.

**Gaps to close on the same slices that server-load context:**

| Control | Current | Target on AI routes |
| --- | --- | --- |
| Input payload caps | Client slicing only; no explicit JSON body cap; transcribe has no app size cap | Server caps: content length, conversation turns, selected-project only |
| Entitlement | Boolean `canUseLume` | Keep; do not invent a second billing meter in Capture |
| Model/provider telemetry | Capture/Tell Me → **dev cockpit**; Coach/new-project none | Production logs: provider, model, feature, projectId, latency, token in/out, error class |
| Cost / spend | No token budget; rate limit is per-process memory | Record cost estimates; shared limiter only if multi-instance spend becomes a launch blocker — **do not add Redis speculatively** |
| Failure visibility | Tell Me/Capture JSON errors; Coach SSE weak | User-visible failure that does not fake a successful write (already the Capture persist-first rule) |

Privacy: server-load does **not** stop the model seeing project data. It stops the browser from *choosing* which durable rows count as truth and from stuffing history into “current”. Do not add a second data-provider abstraction.

---

## C5. Phase 3B / command boundary

**Decision:** `src/lib/capture/apply` (`planCaptureApply` / `executeCaptureApply`) **remains THE single typed mutation boundary for Capture finding → domain write.** Do not create another command/mutation framework. Do not stretch it over Knowledge Centre edits, New Project persist, or project delete — those already have their persist helpers / server routes.

**What it already does well:** exhaustive domain classification; fail closed; no generic Todo fallback; stable target IDs against the supplied world; foreign-project protection against that world; Capture V2 `resolve.ts` reuses it.

**Concrete gaps only:**

1. **Fresh-state revalidation** — world is `captureApplyWorldFromState(client MissionState)`. No DB reload before plan/write.
2. **Optimistic concurrency** — no `version` / `expectedVersion`. `updated_at` triggers exist and are **unused** for writes. This is a **database + command** concern: add integer `version` (or equivalent) on hot tables when this slice is done; check it in persist helpers. Not a TypeScript-only field.
3. **Idempotency** — New Project has `clientProjectId`. Capture apply operations do not. Double-apply can duplicate knowledge bullets depending on domain.
4. **Stable IDs / foreign-project** — enforced against **client** `world.projectIds`, not server project enumeration.
5. **Project-scoped mutation (broad invariant, D-035)** — **Every project-domain mutation must verify that the target durable object belongs to the intended project before mutation.** This is **not** a Todo-only defect. `persistTodoUpdate` / `persistTodoDelete` currently key by id only (workspace RLS still applies; no `project_id` in the WHERE). The later implementation/test pass must **audit equivalent paths** across all relevant project-domain mutations (todos, risks, knowledge_items, milestones, stakeholders, memories, recommendations, history, sessions, …). **Do not fix them in this docs branch.** Schema: no `version` column (D-034, separate).
6. **Execute persist semantics** — Risk/milestone/Person/availability/knowledge/memory Capture hooks are persist-first; todo complete/update/delete and Confirm Owner remain optimistic-then-persist (D-005 remainder). Same dispatcher, split failure UX.

Unsupported on purpose: meeting complete, milestone *complete* (D-029). Leave them Needs you.

---

## C6. Database integrity — smallest changes

Do not design a generic transaction framework.

| Gap | Smallest material fix | First slice? |
| --- | --- | --- |
| New Project sequential inserts; crash skips `catch` cleanup | One `create_project_bundle` Postgres RPC (this bundle only). Keep `clientProjectId` PK idempotency | Dedicated integrity slice |
| D-028 delete SET NULL then project row | `delete_project_bundle` RPC **or** change those six FKs to `ON DELETE CASCADE` | Same integrity slice |
| Same-name people blocked by a unique-name index | **Do not add** `UNIQUE` on stakeholder or person name. Identity is the stable UUID. Same-name people must remain representable | N/A — rejected |
| Project-domain writes that do not check `project_id` (D-035) | Invariant: verify the target row belongs to the intended project before mutate. Audit all persist helpers; `persistTodoUpdate` is one known instance | Later implementation/test pass — **not this branch** |
| `todos.source_recommendation_id` has no FK | `REFERENCES recommendations(id) ON DELETE SET NULL` | With D-003 |
| `waiting_on` text | Add `waiting_on_person_id` when Person slice lands; keep text as display cache. Resolve by ID; name-only only if unambiguous | Person slice |
| No row versioning (D-034) | `version int not null default 1` on `projects`, `todos`, `risks`, `knowledge_items`, `milestones`, `stakeholders`; persist helpers `WHERE version = $expected` | With apply revalidation, not earlier |
| D-026 project code uniqueness | **Product decision first** — do not add silently | No |
| Workspace_id vs parent project workspace | Optional later composite/trigger; not V1-critical while app always writes both | No |

Multi-step dual-write (`persistKnowledgeBullet` knowledge then risks) should ride the same persist-first Capture hooks; do not invent a second dual-write protocol.

---

## C7. Person / entity-compatible architecture

**DECIDED V1 TARGET (binding):** workspace-scoped Person identity + project-scoped participation/responsibility.

**Identity principle (Thor amendment):**

- **Stable IDs own identity.**
- A **name is not identity.** Two legitimate different people may share the same name.
- A **model-supplied Person UUID is not identity proof.** Capture V2 / Phase 3B must independently establish the Person from Capture text (recorded full name) before a person-linked write is Apply Ready. UUID cannot convert incomplete or competing evidence into a legal write.
- Same-name people **must remain representable** (no unique-name constraint on `stakeholders` or `people`).
- Exact-name matching may remain a **conservative temporary resolution** behaviour.
- If name-only resolution is ambiguous (zero or more than one match), **fail closed / Needs you**.
- Do **not** fuzzy/global-merge existing stakeholder rows.

**Do not build** a universal `entities` table, graph DB, or CRM.

### Smallest schema (later slice)

```text
people (
  id, workspace_id, display_name
  -- NO unique constraint on name / name_normalized
)
stakeholders  → participation row
  + person_id REFERENCES people(id)
  UNIQUE (project_id, person_id)   -- same Person cannot participate twice; names may collide
  name/role/preferences/concerns may remain on the participation row
```

`UNIQUE (project_id, person_id)` is an **ID** constraint (one participation row per person per project). It is **not** a name uniqueness constraint.

**Migration implications:** do **not** group existing stakeholders by exact normalised name into one `people` row. Preserve each existing stakeholder UUID (1:1 `people` row, or equivalent) unless a **human** later explicitly links two records as the same person. Remap `knowledge_items.meta.responsibility.personId` from stakeholder id → `people.id` only as an explicit, tested mapping. Add `todos.waiting_on_person_id`; keep `waiting_on` text as display cache. Different spellings stay distinct (no fuzzy merge). Same spelling stays distinct **until** IDs say otherwise.

**CURRENT** `ensurePersonOnProject` reuses exact name within a project (prevents accidental duplicate-on-mention). That is **TRANSITIONAL** resolver behaviour, not a licence to make name unique in the database. Once two same-name people can exist, name-only ensure must Needs you.

**Until that slice:** keep project-scoped stakeholders. Stop adding new exact-name-only relationships when a UUID is already known.

### Future Issue / JIRA-like object — stress test

**Yes — no further fundamental rewrite.** Durable UUID homes already exist: People (target `people.id`), Risks, milestones, Todos, Decisions (`knowledge_items`), evidence (`memories`, provenance, `history_events`). A future `issues` table would be a **first-class domain table with FKs**, the same pattern as `risks`. It can relate to people, risks, dates, todos, decisions, and evidence without an Entity-Everything table.

**Stop there. Do not implement Issues.**

---

## C8. Legacy / dual-path deletion (table must get shorter)

| Dual path | Survive | Evidence before deletion | Earliest safe deletion |
| --- | --- | --- | --- |
| `LUME_CAPTURE_V2` vs OpenAI findings | **V2 + Phase 3B** | Test workstream server-backed/manual/automated V2 gates; `verify-capture-v2` + `phase3b-capture-boundary`; D-014 remainder acknowledged | **Close to V2 default-on** — delete legacy understanding path; git is rollback. Local/no-OpenAI stays a fallback, not a second extractor |
| `LUME_NEW_PROJECT_V2` vs Talk assemble | **V2 categorisation + existing persist** | Gate B / `verify-new-project-v2`; approval cannot be skipped | After V2 default-on |
| `LUME_CANONICAL_TRUTH` vs `buildCaptureContext` Ask | **`serializeCanonicalTruth`** | Eval + Ask smoke; D-010 closed on default path; keep env `0` one release | After default-on + rollback tested, delete legacy Ask branch |
| Snapshots in Ask prompt | Canonical `snapshot: null` | Canonical default | Same slice as Ask default-on. Keep table only if ✦ Refresh UX needs a derived summary |
| Coach `/api/coach` + drawer vs parked Advise | **Hide/retire Coach** | Philosophy §26; D-031 | QOL / shell slice — do not wait for a Coach rewrite |
| Knowledge sections vs structured | Structured + `sectionItemIds` | Reconcile covers active projects | Do not wipe sections; stop *writing* identity-less bullets |
| Domain risks vs knowledge-only risk prose | Domain `risks` | D-015/D-030 cleanup | After cleanup, KC shows projection only |
| Stakeholders vs people prose | Stakeholders + structured | D-007 remainder closed | After promotion slice |
| Client session lists vs `capture_sessions` | DB sessions | D-013 / Phase 3D | Phase 3D |
| Ocean vs Desert | **Keep both** | Product | Never delete Ocean |
| Local persist / demo auth | Keep for DX | Prod tests | Not V1 |

---

## C9. `store.tsx` / state complexity

`src/lib/store.tsx` is ~2,878 lines. **Do not rewrite it into another state framework.**

| Keep as client state/view | Move behind server over time | Delete when superseded |
| --- | --- | --- |
| `MissionProvider`, hydrate, paint cache, `saveStatus`, in-flight create/delete guards, OpenAI probe | Mutation orchestration that still `createBrowserSupabaseClient()` after optimistic `setState` — follow `createProject` / `deleteProject` | Immediate-merge `capture` / `captureWithAI` / `applyCaptureResult` / `mergeCapture` / `CaptureBar` — **DELETED** Slice 1A |

After those deletions, optional file split (`store-hydration`, persist-meta) is cosmetic. Prefer **deleting responsibilities** over introducing Redux/Zustand.

---

## C10. Outlier pass — accept vs reject

**Accept only if it solves several concrete V1 problems more simply than what exists:**

| Idea | Verdict |
| --- | --- |
| Server-load + existing `serializeCanonicalTruth` | **Accept** — freshness, forgery, cost, truth semantics |
| Two bundle RPCs (create/delete) | **Accept** — crash and D-028 classes |
| Integer `version` on hot tables | **Accept later** — with apply revalidation |
| Workspace `people` + participation | **Accept later** — stable identity; Issue-ready |
| Payload caps + production AI telemetry | **Accept on the AI migration slices** |
| Generic Truth Engine / Hygiene Engine / reconciliation daemon | **Reject** |
| Event-sourced rewrite / second persistence layer | **Reject** |
| Entity-Everything table | **Reject** |
| Giant AI orchestration framework | **Reject** |
| Permanent dual Capture engines or dual truth projections | **Reject** |
| Redis rate limiter “because serverless” | **Reject unless** multi-instance spend is a demonstrated launch blocker |
| Vector DB / multi-pass agents | **Reject** (philosophy §26) |
| Making `planCaptureApply` the app-wide mutation bus | **Reject** — Capture boundary stays Capture |

**Still missing from a naive V1 plan (now recorded):** D-033/D-034/D-035; Coach vs constitution mismatch; project-scoped mutation invariant (class, not Todo-only); snapshots-as-compression temptation; MP UX is in-scope but artefacts are not in this repo.

---

## C11. Magic Patterns — architecture dependencies (not this workstream)

No Magic Patterns artefacts were found locally. The sibling MP agent owns UX. Do not modify MP outputs from this PR.

**Questions / dependencies for MP:**

1. Waiting frame: keep concatenation as a *view* while authorities split — does V1 UX need a visual distinction between waiting todos and narrative open loops?
2. ✦ Lume noticed: accept/dismiss must be durable (D-003) — where does that live in Ocean vs Ask?
3. Coach: constitution parks Coaching — should V1 shell remove Coach entry points (Intelligence strip, drawer, results card)?
4. Capture V2 review chrome already exists; MP should not invent a second Review.
5. Desert is token-only; no component forks.
6. People cards today assume project-scoped stakeholders; workspace Person is a later slice — do not design a CRM.
7. Advise stays `Coming soon`.

---

## C12. First implementation slices (not started here)

Recommended order after this authority is reviewed:

1. ~~**Dead-path deletion:** `CaptureBar` / immediate merge APIs~~ — **done Slice 1A**.
2. **Tests (sibling workstream):** lock `serializeCanonicalTruth`, Phase 3B apply, waiting concatenation, V2 gates **before** structural deletion of live dual engines.
3. **Tell Me server-load** + keep canonical assembler — **done (Slice 1B).** Capture V2 must not start automatically from this slice.
4. **Capture server-load** of the same world; V2 default-on; **then** delete legacy OpenAI findings path.
5. **Integrity RPCs** (create/delete bundle) as their own slice.
6. **Person table** only after the above; **not** mixed with Capture deletion.
7. **Do not** implement Issues, Coach rewrite, or a new mutation framework.

---

## C13. Explicitly do not build

Generic Truth Engine; Hygiene Engine; reconciliation daemon; event-sourced rewrite; second persistence layer; Entity-Everything table; unique-name-as-identity constraint; giant AI orchestration; permanent dual Capture engines; permanent dual truth projections; app-wide command bus; Redux/Zustand; vector infrastructure; Advise; Issues; workspace Person table in the first slice; Redis “just in case”.

