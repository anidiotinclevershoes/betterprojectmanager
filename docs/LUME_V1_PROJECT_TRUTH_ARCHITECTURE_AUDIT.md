# Lume V1 Project Truth Architecture Audit

**Status:** Read-only audit (no implementation)  
**Date:** 19 August 2026  
**Branch observed:** `main` (post PR #43 V1 reference pack)  
**Authority:** `docs/v1-reference-pack/` (philosophy, Ocean UI baseline, development/evaluation roadmap)  
**Behavioural contract (reconcile, do not silently replace):** `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md`

This audit maps how Lume currently stores, mutates, reads and assembles **project truth**. It does not change code, migrations, prompts, tests, schemas or UI.

---

## 1. Current architecture map

### 1.1 Runtime hub

Almost all product surfaces read/write through **`MissionState`** in `src/lib/store.tsx` (`MissionProvider`).

| Mode | Switch | Meaning |
| --- | --- | --- |
| `supabase` | `src/lib/persistence-mode.ts` → `getPersistenceMode` | Supabase Postgres is durable authority; MissionState is hydrated cache |
| `local` | same | `localStorage` key `mission-control-state-v5` is durable authority |

Hydration: `src/lib/data/supabase/load-mission-state.ts` → `loadMissionStateFromSupabase`  
Incremental writes: `src/lib/data/supabase/persist-mutations.ts` (+ some repository helpers in `src/lib/data/supabase/repositories.ts`)

### 1.2 Durable domain stores (Supabase)

Core schema: `supabase/migrations/20260812002748_workspace_schema.sql`  
Canonical metadata (additive): `supabase/migrations/20260818230000_knowledge_canonical_metadata.sql`  
Tell Me snapshots: `supabase/migrations/20260815160000_project_intelligence_snapshots.sql`

```
workspace
  └── projects
        ├── stakeholders          (people rows)
        ├── todos
        ├── risks                 (status enum: open|watch|resolved|accepted)
        ├── knowledge_items       (section bullets + Slice-1 metadata)
        ├── milestones            (→ MissionState.timeline)
        ├── memories
        ├── recommendations
        ├── meetings
        ├── releases
        ├── capture_sessions
        ├── history_events
        ├── coach_sessions
        └── project_intelligence_snapshots   (derived, 1 per project)
```

Isolation boundary: **`workspace_id`** (+ RLS membership), not per-user ownership of project rows. App code further filters by `projectId`.

### 1.3 Application types (MissionState)

Primary definitions: `src/lib/types.ts`

| Field | Maps from | Notes |
| --- | --- | --- |
| `projects[]` (+ nested `stakeholders`) | `projects` + `stakeholders` | Nested people |
| `todos[]` | `todos` | First-class |
| `knowledge[]` | `knowledge_items` (+ open/watch `risks` titles folded into `sections.risks`) | String sections + optional `structured[]` |
| `timeline[]` | `milestones` | First-class |
| `memories[]` | `memories` | |
| `recommendations[]` | `recommendations` | |
| `meetings[]` / `releases[]` | `meetings` / `releases` | |
| `history[]` | `history_events` | Partial persist coverage |

**No first-class `MissionState.risks[]`.** Risk UI derives from knowledge bullets + risk recommendations (`src/components/frames/RiskFrame.tsx`).

### 1.4 Canonical truth layer (not a separate table)

Modules: `src/lib/canonical-truth/{types,serialize,flag,confirm-responsibility,suggestions,index}.ts`

- Structured overlay: `CanonicalTruthItem` on `ProjectKnowledge.structured`
- Persisted as nullable columns on `knowledge_items`: `kind`, `epistemic`, `lifecycle`, `supersedes_id`, `meta`, `provenance`
- Flag: `isCanonicalTruthEnabled` (`src/lib/canonical-truth/flag.ts`) — **live default off**; evals force on via `forEval`
- Affects **Tell Me / Ask context assembly only** when on + scoped project — not Knowledge UI, Capture apply, or suggestion builders

### 1.5 Client-only / parallel stores

| Key / store | File | Role |
| --- | --- | --- |
| `mission-control-state-v5` | `src/lib/store.tsx` | Full MissionState (local mode authority / dual-write cache) |
| `lume-mission-supabase-cache-v1` | `src/lib/mission-cache.ts` | Last successful Supabase hydrate |
| `lume-capture-sessions-v1` | `src/lib/sessions/history.ts` | Capture history (max 80); table `capture_sessions` exists but client list still dominates |
| `lume-coaching-sessions-v1` | same | Coach history; table `coach_sessions` underused |
| `lume-tell-me-snapshots-v1` | `TellMeSessionContext.tsx` | Client snapshot map alongside `project_intelligence_snapshots` |
| `lume-capture-session-v1` (sessionStorage) | Capture session contexts | Active draft/review (tab-scoped) |
| `lume-project-dictionary-v1` | `src/ai/domain/dictionary.ts` | Vocab helper, not project truth |
| Layout/appearance/sidebar keys | various | UI chrome only |

### 1.6 Write / read hubs (relationships)

```
Capture (propose) ──AI──► review cards ──confirm──► MissionState mutations
                                                      │
Knowledge Centre (inspect/correct) ───────────────────┤
Todos / Risk frame / Confirm owner ───────────────────┤
New Project ──► persistNewProject / create-project ───┤
                                                      ▼
                                         persist-mutations (partial)
                                                      ▼
                                              Supabase tables
                                                      │
                      load-mission-state ◄────────────┘
                              │
                              ▼
              Knowledge UI · Tell Me context · Capture context · History · Snapshots
```

**Tell Me fork:**
- Legacy: `buildTellMeContext` → `buildCaptureContext` + optional snapshot (`src/lib/tell-me/context.ts`)
- Canonical: `serializeCanonicalTruth` only; **`snapshot: null`**; no `buildCaptureContext`

---

## 2. Source-of-truth matrix

| Concept | Where it lives now | Authority | Primary writes | Primary reads |
| --- | --- | --- | --- | --- |
| **Project metadata** (name, code, summary, status, focus, RELOPS dates) | `projects` / `MissionState.projects` | Authoritative (DB when supabase) | `persistNewProject`, project create API | Project page header, Capture/Tell Me context, snapshots |
| **Current position** | `knowledge_items` section `now` → `knowledge.sections.now` (+ optional structured `kind: fact`) | Authoritative bullets; structured overlay when present | Capture apply, `addKnowledgeBullet`, `replaceKnowledge` (memory-only), New Project remember facts | Knowledge UI, `buildCaptureContext`, canonical serialize |
| **People (identity)** | Dual: `stakeholders` **and** `knowledge.sections.people` / structured responsibilities | **Split** — create-time stakeholders authoritative in DB; later people often knowledge prose only | New Project inserts stakeholders; Capture/confirm often knowledge-only; confirm-owner updates in-memory stakeholders **without** DB stakeholder insert | Knowledge people section; Tell Me stakeholders list (legacy); `findConfirmedOwner` (structured) |
| **Scoped responsibilities** | `CanonicalTruthItem` kind `responsibility` in `structured` + people bullet; not a dedicated table | Authoritative **when structured + persisted**; otherwise absent / prose-inferred | `confirmResponsibilityOwner` → `persistKnowledgeBullet` with meta | Canonical serialize; Tell Me ownership fast-path (`findConfirmedOwner` in `answer.ts`) |
| **Todos** | `todos` / `MissionState.todos` | Authoritative | `addTodo` / `updateTodo` / `toggleTodo` / `removeTodo` + Capture apply | To Do UI; Capture context; canonical WAITING/CHASE slice |
| **Risks** | Dual: `risks` table **and** `knowledge.sections.risks` (+ recommendations kind risk) | **Split** — table authoritative in schema; UI treats knowledge strings as operational truth; load **merges** open/watch titles into knowledge | Add: `persistKnowledgeBullet` also inserts `risks`; Resolve/edit: `replaceKnowledge` with `[Resolved]` prefix — **no DB update** | RiskFrame (knowledge-derived); Capture/Tell Me knowledge risks; load folds table→knowledge |
| **Dates / milestones** | `milestones` / `timeline` | Authoritative | `addTimelineItem` / persist; New Project extract; Capture | Timeline UI; Capture context; canonical MILESTONES block |
| **Decisions** | `knowledge.sections.decisions` (+ structured `kind: decision`) | Authoritative as knowledge bullets | Capture / knowledge edits | Knowledge UI; contexts |
| **Dependencies** | Mostly prose in knowledge / snapshot fields `keyDependencies`; structured kind exists (`dependency`) but sparsely used | **Weak / derived** | Snapshot builders; occasional Capture bullets | Snapshot / legacy Tell Me; canonical only if structured/legacy bullet exists |
| **Availability** | Prose in people/openLoops; structured kind `availability` exists | **Weak** | Capture / manual knowledge | Contexts if present as bullets |
| **Waiting / open loops** | Dual: `todos` (WAITING/CHASE/`waitingOn`) **and** `knowledge.sections.openLoops` | **Duplicated channels** | Capture apply to either; todo CRUD | Both in legacy context; canonical includes waiting todos + open_loop items |
| **Provenance / evidence** | `knowledge_items.provenance` jsonb; Capture sessions; `history_events`; memories; UI Evidence affordances partially stubbed vs Ocean | Partial — Capture/history stronger than per-item provenance for legacy bullets | Capture persist session/history; confirm-owner writes provenance entry | Tell Me source catalogue; History page; Evidence UI when wired to structured |
| **History** | `history_events` / `MissionState.history` + local capture/coach session lists | Intended chronology/evidence; **not** complete durable log (many `pushHistory` calls never `persistHistoryEvent`) | Partial persist on capture apply, todo add/toggle, project create | `/history` page; legacy Tell Me history dump; canonical includes history **only for historical questions** |
| **Snapshots** | `project_intelligence_snapshots` + localStorage | **Derived** compact view — must not mutate projects (`snapshot-store.ts`) | Tell Me refresh API | Legacy Tell Me context; freshness; **ignored on canonical path** |
| **Recommendations / nudges** | `recommendations` | Authoritative suggestion store | Capture suggestions, coach, resolveNudge | Frames; RiskFrame risk suggestions |
| **Epistemic state** | `knowledge_items.epistemic` + `CanonicalTruthItem.epistemic`; Capture review confidence is session-scoped | Structured path only; legacy bullets → `epistemic: null` via `deriveLegacyStructured` | Confirm owner → `confirmed`; Capture rarely writes epistemic today | Canonical prompt lines; EpistemicChip in Knowledge UI when structured present |
| **Current vs superseded** | `lifecycle` + `supersedes_id` on knowledge_items / structured | Model exists; lightly used (confirm-owner supersedes prior responsibility) | confirm-owner | Canonical serialize filters `lifecycle === "current"` unless historical question |
| **Ambiguity / conflict** | Types: `NeedsConfirmationItem`, epistemic `conflicting`/`unknown`; UI Confirm owner | Sparse population; `findUnknownOwnerHints` can invent “owner not recorded” gaps | Mostly read-time inference in serialize | Canonical KNOWN GAPS block; ConfirmOwnerDialog |

---

## 3. Confirmed architecture defects

Only defects with repo evidence. No benchmark-score optimisation.

### 3.1 Persistence defects

1. **Knowledge Edit Save does not persist**  
   `ProjectKnowledgeBrief.saveEdit` → `replaceKnowledge` (`src/lib/store.tsx` ~1609–1618) updates MissionState only — **no** `persist-mutations` call. Refresh/rehydrate restores prior Supabase bullets.

2. **`updateKnowledgeSection` does not persist**  
   Same file ~1526–1563: in-memory + `pushHistory` only; history event also not `persistHistoryEvent`.

3. **Risk resolve / risk edit do not persist**  
   `RiskFrame` prefixes `[Resolved]` / rewrites bullets via `replaceKnowledge` (`src/components/frames/RiskFrame.tsx`). `risks` table rows are never status-updated on resolve. After reload, open risks reappear from DB fold-in (`load-mission-state.ts` ~230–235).

4. **No knowledge update/replace mutation helper in the hot path**  
   `persistKnowledgeBullet` **insert-only** (`persist-mutations.ts` ~366–412). Repository delete exists (`repositories.ts` knowledge delete) but store correction flows do not reconcile section replacements to DB (delete+insert or update-by-id).

5. **Confirm-owner stakeholder dual-write incomplete**  
   `confirmResponsibilityOwner` (`confirm-responsibility.ts` ~127–145) appends stakeholder **in memory** and persists a `knowledge_items` row; **does not** insert into `stakeholders` table. Reload keeps the people bullet (if persist succeeded) but may drop the stakeholder picker entry.

6. **History persistence gaps**  
   Many `pushHistory` paths never call `persistHistoryEvent` (e.g. knowledge section update, replaceKnowledge, parts of todo update). History UI after reload is incomplete vs in-session view.

7. **Capture/coach session tables underused**  
   Durable client lists `lume-capture-sessions-v1` / `lume-coaching-sessions-v1` remain primary; Supabase `capture_sessions` / `coach_sessions` are not the consistent authority.

### 3.2 Duplication / staleness defects

1. **Risks: table vs knowledge bullets vs `[Resolved]` prose**  
   Add writes both; resolve mutates only knowledge strings; load merges table titles back — classic stale/resurrect loop.

2. **People: `stakeholders` vs knowledge people vs structured responsibilities**  
   Same semantic person/role can exist in one, two, or three shapes with different write coverage.

3. **Waiting: todos vs `openLoops` knowledge**  
   Canonical serialize and legacy context can both surface overlapping open-loop semantics from different stores.

4. **Structured overlay vs section strings**  
   Confirm-owner updates both; other edits may update only sections. Serialize prefers structured then legacy-by-body (`serialize.ts` ~146–158) — asymmetric updates cause drift.

5. **Tell Me snapshot vs live MissionState**  
   Freshness logic acknowledges staleness (`freshness.ts`); canonical path drops snapshot entirely while legacy may still inject a stale compact summary.

6. **Suggestions vs Ask path**  
   `buildCanonicalSuggestions` merges in UI regardless of `LUME_CANONICAL_TRUTH`; Ask may still use legacy context when flag off — dual product behaviour.

### 3.3 Retrieval / assembly defects

1. **Legacy vs canonical Tell Me divergence** (`context.ts` ~169–199 vs ~201+)  
   Canonical: compact facts + milestones + waiting todos; **no** full capture context, **no** snapshot, history only for historical questions.  
   Legacy: multi-channel dump with question heuristics.  
   Production default = legacy; evals force canonical → observed behaviour differs by environment (also stated in philosophy §18).

2. **Canonical coverage thinner than domain reality**  
   Serialize does not systematically include general open todos (non-waiting), stakeholder table rows, dependency/availability as first-class unless already mirrored into knowledge/structured. Slice-1 regression diagnostic themes (lost people/roles, compressed risk chains) are consistent with this coverage gap — not a prompt-first problem.

3. **False / speculative KNOWN GAPS**  
   `findUnknownOwnerHints` (`serialize.ts` ~98–126) can emit “owner is not recorded” for ownership questions without a confirmed responsibility — can poison answers (philosophy cites Helen/Omar / false known gap).

4. **History used as competing truth in legacy path**  
   Despite philosophy (“History is primarily evidence and chronology”), legacy `buildCaptureContext` still injects history into many Ask prompts, with regex/heuristic trimming (`refineHistoryForQuestion`, `SUPERSESSION_TOPICS` in `context.ts`).

5. **Client-supplied MissionState on APIs**  
   Capture / Tell Me request bodies carry client `state`. Workspace RLS protects DB writes, but Ask/Capture assembly trusts client-provided cache contents for the model context (integrity/isolation nuance).

### 3.4 Semantic-modelling gaps

1. **Ocean / philosophy epistemic model not fully instantiated**  
   Product wants: maintained knowledge / `✦ Lume noticed` / `Needs you`. Code has richer internal `EpistemicStatus` union and Capture confidence, but KC does not yet consistently present the three user-facing states; most legacy bullets remain `epistemic: null`.

2. **Dependencies and availability lack reliable domain homes**  
   Kinds exist on `CanonicalTruthItem`; no durable first-class tables or consistent Capture→structured write path.

3. **Risk lifecycle modelled as English prefix**  
   `[Resolved]` string convention instead of `risks.status` or knowledge `lifecycle`.

4. **Prose→truth regex extractors still in write paths**  
   - `extractKnowledgePatchFromText` hardcodes demo names `priya|marcus|elena|jordan` (`knowledge.ts` ~158)  
   - `create-project.ts` `extract*` family (name, stakeholders, risks, todos, dates)  
   - Local Capture fallback uses extractors when AI unavailable  
   Philosophy §20: deterministic code must not become a homemade LLM — these paths conflict with that direction for semantic interpretation.

5. **Hand-maintained `src/types/database.ts` lags migrations**  
   Omits several live tables (snapshots, memories, etc.) — typing/ops drift risk, not runtime truth by itself.

---

## 4. Existing assets worth preserving

Build on these; do not replace wholesale:

1. **MissionState + Supabase workspace schema** — already has the right *kinds* of domain tables (projects, stakeholders, todos, risks, knowledge_items, milestones, history, memories). Philosophy explicitly prefers reliable domain objects over a second universal truth DB.

2. **Capture review-before-write product boundary** — Capture propose → review → confirm → mutate is aligned with the reference pack WRITE/PROPOSE model.

3. **Knowledge section taxonomy** — `now` / `decisions` / `risks` / `people` / `openLoops` (`src/lib/knowledge.ts`) maps cleanly to Ocean Knowledge Centre columns/frames.

4. **Additive canonical metadata on `knowledge_items`** — Slice-1 columns + `CanonicalTruthItem` are the right *cross-cutting* place for epistemic/lifecycle/provenance/responsibility meta without a giant new table.

5. **Confirm scoped responsibility** — `confirmResponsibilityOwner` / `findConfirmedOwner` correctly model **scoped** ownership (not global project owner) and supersession of prior responsibility items.

6. **Deterministic Search + suggestion helpers** — `searchProjectKnowledge`, `buildCanonicalSuggestions` direction matches “Search/suggestions deterministic when stored info is enough.”

7. **Snapshots as derived-only** — explicit non-mutating compact view is correct; keep as cache/UX aid, not authority.

8. **Feature flag rollback** — `LUME_CANONICAL_TRUTH=0` is a real kill switch for the Ask read-path experiment.

9. **Todo persistence CRUD** — create/update/delete paths are comparatively complete vs knowledge corrections.

10. **Project isolation in app filters** — consistent `projectId` filtering in Knowledge, Capture context, canonical serialize; workspace RLS underneath.

---

## 5. Minimal target architecture recommendation

Aligned with reference pack: **Capture = write/propose**, **Knowledge Centre = read/inspect/correct**, History = evidence, no Advise, no portfolio, no second giant canonical DB.

### 5.1 Authority rules (smallest coherent V1)

| Concern | Authoritative home | Notes |
| --- | --- | --- |
| Project metadata | `projects` | |
| People identity | `stakeholders` | Knowledge people bullets may *display* relationships but identity CRUD goes here |
| Scoped responsibility | `knowledge_items` structured (`kind: responsibility`) linked to stakeholder when known | Confirm-owner is the write API |
| Current position / decisions / open-loop *facts* | `knowledge_items` by section | One row per item; edits update/supersede rows |
| Todos / waiting actions | `todos` | Do not duplicate the same chase as the only copy in `openLoops` unless it is a *fact* about waiting, not a task |
| Risks | `risks` table as status authority; Knowledge risks frame **projects** open risks (and optional narrative detail on knowledge_items) | Stop `[Resolved]` as sole lifecycle |
| Dates | `milestones` | Structured date meta may mirror but not fork |
| Provenance | `provenance` on knowledge rows + capture_session / history_event links | History is chronology/evidence |
| Epistemic UX | Map storage → maintained / noticed / needs-you at the edges | Keep internal enums if needed |
| Ask context | **Assembler over authoritative domain objects + current knowledge_items** | Not a thinner orphan summary; not a full History dump for current-state |
| Snapshots | Derived only | Optional accelerator for legacy/UX; never sole source |

### 5.2 What not to do

- Do not create `canonical_truth` mega-table that copies todos/risks/milestones/people.
- Do not “fix” recall by restoring multi-channel History dumps as default Ask context.
- Do not expand regex extractors to replace Capture AI interpretation.
- Do not redesign UI / build Advise / introduce portfolio scope in the truth layer.

### 5.3 Canonical path role

Treat Slice-1 serialize as an **Ask assembler** that must eventually read the same authoritative objects Knowledge Centre edits — not a parallel product truth. Flag stays until coverage and persistence make production-safe convergence possible.

---

## 6. Migration / transition strategy

Incremental, rollback-safe, evidence-driven (roadmap §2 format).

### Phase A — Make corrections durable (persistence integrity)

1. Implement knowledge **reconcile** persist for replace/edit/resolve (update/delete/`lifecycle` supersession — not insert-only).
2. Risk resolve → `risks.status` (+ knowledge lifecycle), not `[Resolved]` prose alone.
3. Confirm-owner → also upsert `stakeholders` when new person.
4. Keep flag off in production; regression: refresh after edit must keep corrections.

**Rollback:** feature-gate new persist helpers; revert store wiring; DB rows remain additive.

### Phase B — Collapse dual writes (authority clarity)

1. Single write API per concept (risks, people, open waiting).
2. Loaders become projections (e.g. Risk frame reads `risks` status, not merged stale titles only).
3. Stop writing the same chase to both todo and openLoops unless explicitly two artefacts.

**Rollback:** keep read-side merge temporarily while write-side is single-homed.

### Phase C — Converge Ask assembly on the same authority

1. Expand canonical assembler to include missing **authoritative** slices (stakeholders, open todos summary, risk status, milestone set) without reintroducing History-as-truth for current-state.
2. Retire false KNOWN GAP invention; only emit Needs-you from stored ambiguity/conflict items.
3. When dogfood-safe, default production Ask to converged assembler; keep `LUME_CANONICAL_TRUTH=0` rollback.

**Temporary legacy:** `buildCaptureContext` path remains for cross-project / flag-off until Phase C acceptance.

### Phase D — Epistemic UX + provenance polish

Map to maintained / noticed / needs-you; Evidence inspect from provenance + captures; still no Advise.

### What stays legacy temporarily

- String section bullets as the common KC display model while structured metadata fills in.
- Local capture/coach session lists until table sync is a dedicated slice.
- Snapshot refresh UX while Ask authority is live state.
- Regex extractors in New Project / local Capture fallback — quarantine; do not extend; prefer AI propose + review for semantics.

---

## 7. First implementation slice

### Problem

Knowledge Centre is specified as the place to **inspect and correct** maintained project truth, but the primary correction write path (`replaceKnowledge` / Knowledge Edit Save / Risk resolve) updates **in-memory MissionState only**. In Supabase mode, reload resurrects pre-correction knowledge and open risks from Postgres. Capture can add durable bullets; users cannot durably correct them through the same Knowledge surface.

### Evidence

- `src/components/ProjectKnowledgeBrief.tsx` — `saveEdit` → `replaceKnowledge`
- `src/lib/store.tsx` — `replaceKnowledge` (~1609–1618) has **no** persist call; `updateKnowledgeSection` likewise; `addKnowledgeBullet` **does** call `persistKnowledgeBullet`
- `src/components/frames/RiskFrame.tsx` — resolve via `replaceKnowledge` + `[Resolved]` prefix
- `src/lib/data/supabase/persist-mutations.ts` — `persistKnowledgeBullet` insert-only; risk insert on section `risks`; **no** resolve/update helper used by store
- `src/lib/data/supabase/load-mission-state.ts` — re-folds open/watch `risks` into `sections.risks` on hydrate
- Reference pack: Capture → confirm → “Knowledge Centre immediately reflects the change”; KC must support correction; philosophy §18 lists “full Knowledge editing is not consistently persisted”

### Proposed change

**Persistence-integrity slice only** (no prompt changes, no UI redesign, no canonical-flag flip):

1. Add Supabase reconcile helpers for knowledge section replacement / bullet edit / soft-supersede (id-stable where structured ids exist).
2. Wire `replaceKnowledge` and Knowledge Edit Save to persist in supabase mode.
3. Wire Risk resolve to update `risks.status` (and knowledge lifecycle/body consistently) so reload does not resurrect resolved risks.
4. Tests: round-trip edit/resolve → reload MissionState → corrections remain; add-bullet path unchanged.

### Non-goals

- Prompt tuning / benchmark chasing  
- Enabling `LUME_CANONICAL_TRUTH` in production  
- Redesigning Knowledge Centre / Ocean layout  
- Advise, portfolio, new mega-table  
- Full stakeholders unification (follow-up)  
- Expanding regex extractors  
- Token reduction / History dump restoration  

### Acceptance criteria

- After Knowledge Edit Save in supabase mode, full page reload shows edited bullets.
- After Risk resolve, reload does not reintroduce that risk as open from the `risks` table fold-in.
- `addKnowledgeBullet` / Capture apply persistence behaviour unchanged.
- Local persistence mode still works.
- No change to Tell Me prompts required for this slice to pass its own acceptance tests.

### Regression risks

- Naive delete-all+reinsert could break `supersedes_id` / structured ids / provenance — prefer update-by-id or controlled reconcile.
- Dual risk rows (knowledge + risks) must stay consistent on resolve to avoid empty UI or duplicates.
- Concurrent Capture apply vs edit races (existing async persist pattern) — keep same error/saveStatus signalling as add-bullet.

### Rollback plan

- Revert store wiring to memory-only replace; leave any new DB helper unused.
- No flag required if helpers are only called from new code paths; alternatively gate with `LUME_PERSIST_KNOWLEDGE_EDITS=0`.
- DB: additive updates only; no destructive migration in this slice.

---

## 8. Questions / ambiguities for product owner

Only items not decidable from the reference pack or repo alone:

1. **Risk home during transition:** When Knowledge shows a narrative risk bullet that never had a `risks` table row (legacy/local imports), should resolve create a resolved table row, or only mark knowledge `lifecycle=superseded`?

2. **Open loops vs todos:** For V1, should “waiting on X for Y” prefer **todo (WAITING/CHASE)** as the actionable authority, with `openLoops` reserved for non-actionable facts — or the reverse? Pack implies tasks vs facts but does not freeze the write rule for Capture apply.

3. **People bullet after confirm-owner:** Should the durable display form remain free-text `Name — scope` in Knowledge, or should KC people frame increasingly render from `stakeholders` + structured responsibilities only (bullets become projection)?

4. **Production Ask convergence timing:** Pack says production defaults to legacy while evals force canonical. After Phase A persistence, do you want Ask to stay legacy until assembler coverage (Phase C), or dogfood canonical earlier behind the existing flag?

*(No speculative product questions beyond these.)*

---

## Recommendation

**If we do only one thing next, it should be…**

> **Make Knowledge Centre corrections durable in Supabase** — wire Knowledge Edit Save / `replaceKnowledge` / Risk resolve to real persist/reconcile paths (and `risks.status`), so Capture’s write/propose loop is matched by KC’s inspect/correct loop without touching prompts, UI redesign, or the canonical Ask flag.

That is a persistence-integrity defect with direct pack alignment, clear evidence, bounded scope, and safe rollback — and it unblocks every later “single source of truth” slice.
