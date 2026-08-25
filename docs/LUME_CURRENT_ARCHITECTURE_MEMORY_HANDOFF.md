# Lume — Current Architecture Memory Handoff

**Status:** Documentation of CURRENT implementation (not an ideal architecture)  
**Date:** 25 August 2026  
**Code observed:** `main` plus Phase 3B Capture mutation boundary (`src/lib/capture/apply`, persist-first Capture Risk/milestone/Person/availability)  
**Docs entry point:** `docs/README.md`  
**Governing product authority:** `docs/v1-reference-pack/`  
**Living defect backlog:** `docs/LUME_V1_KNOWN_DISCOVERIES.md`  
**Historical (not current implementation map):** `docs/LUME_V1_PROJECT_TRUTH_ARCHITECTURE_AUDIT.md` (19 Aug 2026 — written before Slices 1A–2D; several claims are now false; see Part B § discrepancies)

This document has two parts:

- **Part A** — memory-ready checkpoint (paste into ChatGPT context)
- **Part B** — detailed reference (paths, write/read traces, duplication map)

Legend used throughout:

| Tag | Meaning |
| --- | --- |
| **CURRENT** | Verified in code now |
| **INTENT** | Product rule the code is trying to honour |
| **LEGACY / TRANSITIONAL** | Still present; do not treat as the target model |
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

**UI chrome:** V1 is **dark Ocean only**. AppearanceToggle was removed in Slice 2B.

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
| **Waiting / open loops** | Dual: `todos` WAITING/CHASE/`waitingOn` **and** `knowledge.sections.openLoops` | `todos` + `knowledge_items` | Mixed | **No single authority** | Waiting & open loops concatenates both | — | **GAP D-008 / D-021** |
| **Dependencies** | Structured `kind=dependency` | `knowledge_items` | UUID if structured | current structured only | Dependencies frame | `ocean-frames` filter | Under-modelled; **no graph**. **GAP D-020** |
| **Availability** | Structured `kind=availability` + meta | `knowledge_items` | UUID + `personId` | current structured | People meta / person detail | `getPersonBundle`, `formatAwayRange` | Display-only if present; Capture ingestion incomplete (**GAP D-020**) |
| **Memories** | `MissionState.memories` | `memories` | UUID | Capture memory slice | Not a KC primary frame | `persistMemory` / `applyCaptureResult` | Evidence/archive, not current truth |
| **Recommendations / ✦ Lume noticed** | `MissionState.recommendations` | `recommendations` | UUID | suggestion until user converts | Intelligence / Capture observations | `addSuggestion`, accept/dismiss | **GAP D-003** accept/dismiss often memory-only vs DB |
| **Meetings / Meeting Prep** | `meetings` + `MeetingPrepFrame` | `meetings` | UUID | meeting records | Secondary embed | frames | Not a truth authority for Knowledge |
| **Releases** | `releases` | `releases` | UUID | release ops | Not Ocean-primary | — | RELOPS-oriented |
| **History** | `MissionState.history` | `history_events` | UUID | chronology / evidence | Honesty notes; History page | `pushHistory`, `persistHistoryEvent` | **Not current truth.** Many events never persist (**GAP D-004**) |
| **Capture sessions** | sessionStorage + client list | `capture_sessions` | mixed | review draft vs applied | Capture mode | `CaptureSessionContext`, `persistCaptureSession` | Table underused vs client lists (**GAP D-013**) |
| **Ask context / snapshots** | Tell Me session + optional snapshot | `project_intelligence_snapshots` | 1 per project derived | **Derived**, must not mutate projects | Search/Ask bar | `buildTellMeContext` / `serializeCanonicalTruth` | Canonical path **ignores snapshot**. Flag default **legacy** |

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
- New person: create durable stakeholder first, then attach responsibility. Existing person: reuse `personId` / exact name within the project.

**Person retrieval:** `getPersonBundle(state, projectId, personId)` — current/historical responsibilities, `sharedScopes`, availability, legacy bullets. Does not scan unrelated prose.

**People are not workspace-global contacts.** Same human on two projects is two stakeholder rows today. Do not introduce unsafe “global person” merging. Do not assume `projectId` can never be selected dynamically later.

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

**There is no single waiting/open-loop authority.** Duplicate or contradictory loops are possible. **GAP D-008 / D-021.** Do not “dedupe” in UI or Ask until a dedicated slice decides authority (likely todos as waiting authority; openLoops as narrative projection).

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

**CURRENT primary Ocean flow:**

1. Input (text / transcription) in `CaptureWorkspace` `variant="ocean"`
2. ✦ **Analyse** → `analyzeCaptureWithAI` → `/api/capture` — findings/proposals only; **history event `capture_analysed`; no domain writes**
3. Review cards / ambiguity / correction (`buildReviewChangeViewModels`)
4. Per-item **`applyOne`** (`CaptureSessionContext`) — `planCaptureApply` then `executeCaptureApply`. Illegal/unresolved findings are **Needs you / no write**. Persist-first for Risk, milestone create/update, Person, availability.

**`applyOne` legal domains (post-approval):** Todo authority; Risk authority; milestone/date authority (update yes, complete → Needs you / D-029); Person via `ensurePersonOnProject`; responsibility via Confirm Owner / share-vs-replace; structured availability; knowledge/memory. Unsupported/unknown → Needs you. **There is no generic Todo fallback.** Project scope uses Capture entry project only when the finding is not uncertain. A supplied durable ID that is not on the project does not fuzzy- or title-fallback onto another record.

**LEGACY still in store (do not use as the Ocean path):** `capture()` local heuristic and `captureWithAI()` **merge immediately** without review. Ocean UI uses analyse + `applyOne`.

**People:** Capture apply reuses existing Person UUIDs. Duplicate-stakeholder on mention is closed. Leftover Knowledge people *prose* (never a finding) may still lack a stakeholder. **GAP D-007 remainder.**

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

**Two assemblers. Production default is LEGACY.**

### Flag `LUME_CANONICAL_TRUTH` (`src/lib/canonical-truth/flag.ts`)

| Value | Behaviour |
| --- | --- |
| unset | **off** for live product; **on** when `forEval` or `explicit: true` |
| `1` / `true` / `on` | Force canonical |
| `0` / `false` / `off` | Force legacy rollback |

**Why production has not flipped:** INTENT requires Ask UI smoke + eval evidence + residual D-010 plan. Slice 2A wired Ask into Ocean **without** flipping the default.

### Legacy Ask (CURRENT production)

- `buildTellMeContext` → `buildCaptureContext` + optional `project_intelligence_snapshots`
- Mixes Knowledge sections, history, snapshot fields
- **GAP D-010:** History can still compete as current truth on this path
- Ownership / current-state heuristics reduce history volume but do not apply the canonical MODE:current rule

### Canonical Ask (flag / evals)

- `serializeCanonicalTruth` — **assembler only**, not a new store
- Includes: project metadata, Knowledge (current structured + legacy section projection), **Risks from `risks.status`**, stakeholders, **all current responsibilities (multi-owner)**, todos + WAITING/CHASE, milestones, structured dependency/availability **if present**, stored unconfirmed-owner ambiguities only (does **not** invent “owner not recorded” from absence — D-R06)
- History evidence **only** when `questionLooksHistorical`
- Current-state MODE excludes superseded
- Snapshot **null** on this path
- Tell Me remains **read-only**; Confirm Owner is a separate mutation

**Key files:** `src/lib/tell-me/{answer,context,question-shape,scope,types}.ts`, `src/lib/canonical-truth/serialize.ts`, `src/app/api/tell-me/route.ts`.

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

| Flag / dual path | Purpose | Default | New path | Old path remains | Removal condition |
| --- | --- | --- | --- | --- | --- |
| `LUME_CANONICAL_TRUTH` | Ask assembler | **unset = legacy (off)** | `serializeCanonicalTruth` | `buildCaptureContext` + snapshots | After eval + product review; keep `0` rollback |
| `LUME_PERSISTENCE` | Durable store | prod supabase | hydrate + persist-mutations | localStorage v5 in local/dev | Do not silent-fallback in prod |
| `LUME_AUTH` | Auth | prod supabase | Supabase session | demo JWT / none | — |
| `LUME_ALLOW_LOCAL_IN_PRODUCTION` | Escape hatch | unset/false | — | local in prod if both set | Keep locked |
| Knowledge sections vs structured | Overlay | both live | structured + sectionItemIds | string bullets | Do not wipe sections |
| Domain risks vs knowledge risks | Lifecycle | domain wins | `MissionState.risks` | knowledge-only `[Resolved]` | Transitional compatibility |
| Stakeholders vs people prose | Identity | stakeholders | Confirm Owner / bundle | unpromoted Capture bullets | Capture hardening |
| Capture analyse+applyOne vs captureWithAI | Trust boundary | Ocean uses review | `applyOne` | immediate `mergeCapture` still in store | Do not call immediate path from Ocean |
| Client session lists vs `capture_sessions` | Session history | client-primary | table write on apply | localStorage lists | Capture hardening (D-013) |

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
| D-031 | Coach drawer auto-opens over Capture/KC | Overlay can hide Analyse | Ocean/QOL |

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
| Capture apply | `src/lib/capture/apply` (`planCaptureApply` / `executeCaptureApply`) via `CaptureSessionContext.applyOne` | Capture writes — exhaustive domain dispatcher; no generic Todo fallback; unknown op / foreign ID / conflicting `legalDomain` fail closed |
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
7. Capture analysis does **not** write before review on the Ocean path (`analyzeCaptureWithAI`); do not revive immediate `captureWithAI` as the product path.
8. Stable item identity must **not** rely on list position.
9. Knowledge Centre frames do **not** own the truth they display.
10. People are **project-scoped** entities, not global contacts; do not fuzzy-merge similar names.
11. V1 being project-scoped does **not** justify dropping `projectId` or blocking later authorised multi-project reads.
12. AI must **not** infer and persist durable relationships without human review.
13. Production Ask is **not** canonical unless `LUME_CANONICAL_TRUTH=1`.
14. `localStorage` is **not** the production source of truth.
15. `src/types/database.ts` is **not** a complete inventory of live tables.
16. Timeline in MissionState is **not** a table named `timeline` (it is `milestones`).
17. The 19 August Project Truth Architecture Audit is **not** fully current (especially Risks, People persist, Knowledge Edit persist, Confirm Owner share).

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
- API: `src/app/api/capture/route.ts`
- Tests: capture-trust-boundary, capture-review, capture-reliability, ocean-capture
- Discoveries: D-007, D-011, D-013, D-014, D-025

### Ask / Tell Me

- `answerTellMeQuestion`, `buildTellMeContext`, `serializeCanonicalTruth`
- Flag: `isCanonicalTruthEnabled`
- Tests: ask-context-authority, canonical-truth, tell-me, context-integrity
- Discoveries: D-010 residual legacy

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

1. This file (especially Part A §§3–12, 19–20, 22)
2. `docs/LUME_V1_KNOWN_DISCOVERIES.md`
3. The slice handover

Do not leave “open” Known Discovery headings that contradict a D-R resolved entry without housekeeping.
