# Lume V1 — Known Discoveries Backlog

**Status:** Living document  
**Date started:** 19 August 2026  
**Last housekeeping:** 25 August 2026 (Experimental Programme: Capture V2 / New Project V2 flags; Desert appearance; D-032)  
**Product/trust constitution:** `docs/v1-reference-pack/`  
**Current implementation map:** `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md`  
**Docs entry point:** `docs/README.md`  

This file records **project-truth and persistence defects** discovered during V1 foundation work that were **not fixed in the slice that found them** (or remain partially fixed).

Use it so future slices do not re-discover the same failure class, do not greenwash known gaps as tests, and have enough context to fix safely.

---

## How to add a discovery

When a slice finds an adjacent defect it must **not** silently fix:

1. Add a new entry under **Open discoveries** (or update an existing one).
2. Fill every field in the template below.
3. If a deterministic test would falsely encode the bug as correct behaviour, add or keep a `knownGap(...)` skip in the relevant verify script and link it here.
4. When fixed, move the entry to **Resolved discoveries**, set **Fixed in**, and flip any `knownGap` into a real assertion.

### Target resolution vocabulary

Do **not** invent calendar dates. Use roadmap stages such as:

- People slice  
- Capture hardening  
- Ask/canonical convergence  
- New Project/persistence touchpoint  
- V1 product hardening  
- before V1 launch  
- post-V1 / accepted limitation  

If timing is genuinely unclear, set **Target resolution / validation point** to `ambiguous — see Notes` and explain why.

### Entry template

```md
### D-XXX — Short title

| Field | Value |
| --- | --- |
| **Status** | open \| deferred \| fixed |
| **Severity** | critical \| high \| medium \| low |
| **Domain** | Knowledge \| Risks \| People \| Capture \| Ask/Tell Me \| Todos \| History \| Suggestions \| Infra |
| **Found in** | Slice / PR / date |
| **Failure class** | One sentence: what goes wrong for the user or for truth integrity |
| **Evidence / repro** | Steps or code path that proves it |
| **Likely files** | Paths to inspect first |
| **Proposed fix direction** | Smallest safe approach — not a full redesign |
| **Explicit non-goals** | What not to broaden into while fixing |
| **Regression test to add** | What must turn green / what knownGap to retire |
| **Target resolution / validation point** | Roadmap stage(s) when this must be fixed or explicitly validated |
| **Related docs** | Audit / handover links |
| **Notes** | Edge cases, data cleanup, migration risk |
```

**IDs:** Use `D-001`, `D-002`, … sequentially. Do not reuse IDs after resolution.

---

## Open discoveries

### D-003 — Suggestion accept/dismiss is memory-only

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium |
| **Domain** | Suggestions |
| **Found in** | Architecture audit; Test safety net trust-critical gaps |
| **Failure class** | `setRecommendationStatus` / accept / dismiss update MissionState only; Supabase `recommendations` not updated → reload resurrects suggestions |
| **Evidence / repro** | Dismiss or mark done a recommendation → reload workspace → suggestion returns |
| **Likely files** | `src/lib/store.tsx` (`setRecommendationStatus`, `acceptSuggestion`, `dismissSuggestion`); `src/lib/data/supabase/persist-mutations.ts`; recommendations repository |
| **Proposed fix direction** | Persist status update by recommendation id (workspace+project scoped); local mode keeps MissionState-only |
| **Explicit non-goals** | Auto-converting suggestions into Risks/Todos without explicit user action |
| **Regression test to add** | Accept/dismiss plan does not resurrect after hydrate simulation |
| **Target resolution / validation point** | V1 product hardening; must be resolved before V1 launch |
| **Related docs** | Architecture audit §3.1; RiskFrame recommendation path (Slice 1B left this intentional) |
| **Notes** | Risk recommendations must remain suggestions until explicitly converted (Slice 1B product rule). No dedicated “Suggestions slice” is named yet — revisit under general V1 product hardening. |

---

### D-004 — Many History events never persist

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium |
| **Domain** | History |
| **Found in** | Architecture audit §3.1.6 |
| **Failure class** | `pushHistory` updates MissionState; many paths never call `persistHistoryEvent` → History after reload incomplete vs in-session |
| **Evidence / repro** | Update Knowledge section / replaceKnowledge / some todo updates → history appears in session → reload → missing events |
| **Likely files** | `src/lib/store.tsx`; `src/lib/workspace/history.ts`; `persistHistoryEvent` in `persist-mutations.ts` |
| **Proposed fix direction** | Audit `pushHistory` call sites; persist on trust-critical mutations; do not make History authoritative for current state |
| **Explicit non-goals** | History-as-truth; History UI redesign |
| **Regression test to add** | Selected mutations emit durable history rows in plan/fake client |
| **Target resolution / validation point** | V1 product hardening |
| **Related docs** | Architecture audit; philosophy (History = evidence/chronology) |
| **Notes** | Prefer sparse, high-signal events over logging everything. Not required to block People/Capture domain slices. Slice 2C item detail **does not invent** missing History — UI honesty notes reference this gap when provenance is empty. **Phase 3A create-path decision:** New Project History is **secondary evidence after authoritative bundle success**. A failed/rolled-back create must not write `project_created`. Failure of the History insert must not roll back the project bundle. Broader `pushHistory` without `persistHistoryEvent` remains open. |

---

### D-005 — Invisible / soft save failures

| Field | Value |
| --- | --- |
| **Status** | partial |
| **Severity** | high |
| **Domain** | Infra / UX trust |
| **Found in** | Test safety net trust-critical gaps; store `console.error` + `setSaveStatus("error")` patterns |
| **Failure class** | Persist failures often only set soft save status / console error; user may believe Knowledge/Risk/Todo saved when DB write failed |
| **Evidence / repro** | Force persist error (network/RLS); observe UI continues with optimistic MissionState; reload loses change |
| **Likely files** | `src/lib/store.tsx` (all supabase `void (async…)` paths); `src/components/AppShell.tsx` (`ocean-save-error`); save-status UI consumers |
| **Proposed fix direction** | Surface durable toast/banner on save error; consider optimistic rollback or “not saved” badge on affected frames |
| **Explicit non-goals** | Full offline sync engine |
| **Regression test to add** | Hard without UI; at least ensure error paths set `saveStatus` and do not claim success |
| **Target resolution / validation point** | V1 product hardening; must be checked before V1 launch (incremental per write path is OK) |
| **Related docs** | `docs/LUME_TEST_SAFETY_NET_AUDIT.md` §C.4 |
| **Notes** | **Phase 3A (partial):** Ocean chrome now shows `saveStatus=error` via `ocean-save-error` (does not require opening a drawer or devtools). Failed persist paths call `reportPersistFailure`, which reconciles MissionState from `/api/workspace/state` and does not write dirty state to the paint cache. Success of a later persist clears the banner (`markPersistSaved`). **Phase 3A.1:** project deletion is persist-first (same failure banner; MissionState is not stripped until the server confirms). **Phase 3B:** Capture apply for Risk create/status, milestone create/update, Person ensure, and structured availability is persist-first (failed persist is Needs you / visible failure, not a false Apply). Todo create/update/complete and Confirm Owner remain optimistic-then-persist with the Phase 3A save-error + reconcile path. **Still open:** most other mutations remain optimistic-then-persist; concurrent in-flight mutations can be overwritten by a coarse rehydrate. App-wide per-field “not saved” badges remain out of scope. |

---

### D-026 — Workspace + project-code uniqueness is not a durable product constraint

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Projects / Infra |
| **Found in** | Phase 3A preflight (Aug 2026) |
| **Failure class** | There is no unique constraint on `(workspace_id, code)` or project name. Two deliberately different New Project actions can share a code. Retry safety uses a client request UUID, not code matching. |
| **Evidence / repro** | `supabase/migrations/20260812002748_workspace_schema.sql` `projects` table — `code text not null` with no unique index |
| **Likely files** | schema; `persistNewProject`; New Project review |
| **Proposed fix direction** | Decide the product rule first (codes unique per workspace vs allowed duplicates). If unique, add a DB unique index and a meaningful Ocean error. Do not invent fuzzy name matching. |
| **Explicit non-goals** | Treating name similarity as duplication |
| **Regression test to add** | If the product rule becomes “codes unique per workspace”, assert unique-violation surfaces a code-already-used error |
| **Target resolution / validation point** | New Project/product hardening — do not silently add the constraint in an integrity slice |
| **Related docs** | Phase 3A PR; this file D-R11 |
| **Notes** | Phase 3A implements retry idempotency via `clientProjectId` (same user action / same UUID). That is not a product rule that two projects cannot share a code. **Phase 3A.1 delete** is keyed by durable project UUID, not code or name. |

---

### D-027 — No archive / undo after project deletion

| Field | Value |
| --- | --- |
| **Status** | deferred |
| **Severity** | low |
| **Domain** | Projects |
| **Found in** | Phase 3A.1 Safe Project Deletion (Aug 2026) |
| **Failure class** | Confirmed Delete Project is permanent. There is no archive, recycle bin, or undo. Disposable/test projects can be cleaned; a mistaken confirmation cannot be reversed from Lume. |
| **Evidence / repro** | Delete Project confirmation → durable rows are removed; reload does not restore the project |
| **Likely files** | `persistProjectDelete`; `DeleteProjectButton.tsx` |
| **Proposed fix direction** | If product later wants Archive, add an explicit archived flag / restore path. Do not silently soften 3A.1 deletion. |
| **Explicit non-goals** | Recycle bin, bulk project management, settings redesign in 3A.1 |
| **Regression test to add** | If Archive ships: archived projects hidden from Ocean selection and restorable |
| **Target resolution / validation point** | post-V1 / accepted limitation until a product decision asks for Archive |
| **Related docs** | This file D-R12 |
| **Notes** | Recorded because Archive felt desirable during regression hygiene. 3A.1 kept deletion permanent and confirmation explicit instead of expanding scope. |

---

### D-028 — Project delete is sequential, not a single database transaction

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Infra / Projects |
| **Found in** | Phase 3A.1 Safe Project Deletion (Aug 2026) |
| **Failure class** | `persistProjectDelete` first deletes SET NULL children, then the project row. If the project-row delete fails after children were removed, the project can remain visible with some of its todos/history/sessions already gone. The UI does not fake success. Retrying delete is the recovery. |
| **Evidence / repro** | Fake client `failOnDeleteTable: "projects"` after SET NULL deletes have succeeded |
| **Likely files** | `src/lib/data/supabase/persist-mutations.ts` (`deleteProjectScopedBundle`) |
| **Proposed fix direction** | A single Postgres RPC/transaction for the bundle, same class of follow-up as New Project create |
| **Explicit non-goals** | Inventing a generic mutation framework in 3A.1 |
| **Regression test to add** | Keep the injected project-delete failure test: A remains in `projects` and UI must not claim success |
| **Target resolution / validation point** | V1 product hardening (bundle RPC) — not Phase 3B Capture dispatcher |
| **Related docs** | Phase 3A compensating cleanup; this file D-R12 |
| **Notes** | SET NULL-first is required so a successful project delete cannot leave workspace orphans. The residual is failure-after-partial-cleanup, not silent cross-project damage. |

---

### D-007 — People split across stakeholders + Knowledge people + structured

| Field | Value |
| --- | --- |
| **Status** | open (remainder: Knowledge people prose without a stakeholder link) |
| **Severity** | medium (down from high after 1C foundation) |
| **Domain** | People |
| **Found in** | Architecture audit §3.2.2 |
| **Failure class** | Capture / legacy People prose can still exist without a stakeholder link; Tell Me / KC may show unpromoted free-text people |
| **Evidence / repro** | Capture people bullets vs Confirm Owner structured responsibilities vs stakeholders picker |
| **Likely files** | Capture people apply; Knowledge Edit people section; `getPersonBundle` |
| **Proposed fix direction** | Promote known people prose to stakeholders when identity is explicit; keep leftover bullets as projection. Do **not** treat person-detail or share-vs-replace UI as still missing. |
| **Explicit non-goals** | Portfolio org chart; Advise; redoing People UI already shipped in 2C/2D |
| **Regression test to add** | Capture→promote path once specified |
| **Target resolution / validation point** | Capture hardening (people promotion into durable stakeholder/person identity) |
| **Related docs** | `docs/SLICE1C_PEOPLE_ENTITIES_HANDOVER.md`; `docs/SLICE2C_KNOWLEDGE_ITEM_DETAIL_HANDOVER.md`; `docs/SLICE2D_PEOPLE_CONTEXT_UI_HANDOVER.md` |
| **Notes** | **Already delivered (do not re-open as missing UI):** Slice 1C durable stakeholder identity + `personId` on responsibilities; Slice 2C reusable person detail (`getPersonBundle` / Ocean drawer); Slice 2D People frame polish + Confirm Owner share-vs-replace (D-019 → D-R10). **Phase 3B (D-R13):** Capture apply reuses `ensurePersonOnProject` / existing Person UUIDs. An existing Person is not duplicated; continuing-responsibility statements no-op; ambiguous identity is Needs you. **Remaining open scope:** leftover Knowledge people *prose* that was never a Capture finding still may lack a stakeholder link. That is not permission to silently mint identities. |

---

### D-008 — Waiting / open-loops dual representation

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium |
| **Domain** | Todos / Knowledge |
| **Found in** | Architecture audit §3.2.3 |
| **Failure class** | Waiting work appears as `todos` (WAITING) and/or `knowledge.sections.openLoops` → duplicate or contradictory open loops in Ask/KC |
| **Evidence / repro** | Add waiting todo vs open-loop knowledge bullet; inspect Tell Me / serialize coverage |
| **Likely files** | todos persist; openLoops knowledge; `serialize.ts`; Capture context |
| **Proposed fix direction** | Decide single authority for waiting (likely todos); Knowledge openLoops as projection/narrative only |
| **Explicit non-goals** | Full GTD redesign |
| **Regression test to add** | Authority rule characterisation once decided |
| **Target resolution / validation point** | ambiguous — see Notes |
| **Related docs** | Architecture audit |
| **Notes** | Could land under open-loop/To Do architecture, Capture hardening (if Capture writes both), or Ask/canonical convergence (if only retrieval suffers). Do not fix opportunistically inside unrelated slices until authority is decided. |

---

### D-010 — Legacy Ask path still injects History as competing truth

| Field | Value |
| --- | --- |
| **Status** | partial |
| **Severity** | medium |
| **Domain** | Ask/Tell Me |
| **Found in** | Architecture audit §3.3.4 |
| **Failure class** | Legacy `buildCaptureContext` injects history into many prompts despite “History is evidence, not current truth” |
| **Evidence / repro** | Production default `LUME_CANONICAL_TRUTH` off; Ask with history-heavy project |
| **Likely files** | `src/lib/tell-me/context.ts`; Capture context builders |
| **Proposed fix direction** | Tighten history injection to historical questions only; prefer domain authority for current-state |
| **Explicit non-goals** | Deleting History feature |
| **Regression test to add** | Context-integrity: current-state question excludes superseded history as truth |
| **Target resolution / validation point** | Canonical production default decision (after Ask UI integration + eval evidence); residual legacy path until then |
| **Related docs** | Philosophy; Phase2C2 context integrity; `docs/SLICE1D_ASK_CONTEXT_AUTHORITY_HANDOVER.md` |
| **Notes** | **Slice 1D validated/fixed on canonical path:** current-state MODE omits History evidence; historical/change questions retrieve scoped evidence. **Slice 2A** wires Ask into Ocean Knowledge Centre via existing Tell Me session without flipping production default. Residual risk remains on legacy path until flag default changes. Do not remove legacy rollback yet. |

---

### D-011 — Demo-name regex extractors in write-adjacent paths

| Field | Value |
| --- | --- |
| **Status** | open (New Project extractors only — Capture active path fixed in 3B / D-R13) |
| **Severity** | medium |
| **Domain** | Capture / New Project |
| **Found in** | Architecture audit §3.4.4 |
| **Failure class** | Deterministic extractors hardcode demo names (`priya|marcus|elena|jordan`) and create-project `extract*` family — conflicts with “deterministic code must not become a homemade LLM” for semantic interpretation |
| **Evidence / repro** | `src/lib/knowledge.ts` `extractKnowledgePatchFromText`; `create-project.ts` extract helpers; local Capture fallback |
| **Likely files** | `knowledge.ts`; `create-project.ts`; local Capture fallback |
| **Proposed fix direction** | Limit extractors to structural parsing; stop name-hardcoding; prefer AI propose + human confirm for semantics |
| **Explicit non-goals** | Building a larger regex NLP stack |
| **Regression test to add** | Extractor does not invent stakeholders from demo name list on unrelated text |
| **Target resolution / validation point** | Capture hardening; also check at next New Project/persistence touchpoint if create-project extractors are touched |
| **Related docs** | Philosophy §20 |
| **Notes** | **Phase 3B:** Active Capture interpretation/apply path no longer hardcodes Sarah/Marcus/Priya/demo dates. Token-overlap / stem matching is not used to auto-ready existing Risk/milestone/Todo updates — the existing title must appear in the **same sentence/clause** as the update or completion/resolution cue. `verify-phase3b-capture-boundary` asserts demo-name strings are absent from the listed Capture files. Residual: New Project `extractStakeholders` still uses structural proper-noun regex (not demo-name lists) — leave for a New Project touchpoint. Do not replace with a larger regex NLP stack. |

---

### D-012 — Hand-maintained `database.ts` lags migrations

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Infra |
| **Found in** | Architecture audit §3.4.5 |
| **Failure class** | `src/types/database.ts` omits some live tables → typing/ops drift |
| **Evidence / repro** | Compare migrations vs Database type |
| **Likely files** | `src/types/database.ts`; `supabase/migrations/*` |
| **Proposed fix direction** | Regenerate or manually sync types; CI check optional later |
| **Explicit non-goals** | Runtime behaviour change |
| **Regression test to add** | Optional schema drift script |
| **Target resolution / validation point** | post-V1 / accepted limitation (ops hygiene); elevate to V1 product hardening only if it blocks a ship gate |
| **Related docs** | Architecture audit |
| **Notes** | Ops hygiene — not a user-visible truth defect |

---

### D-013 — Capture/coach session tables underused

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Capture / Coach |
| **Found in** | Architecture audit §3.1.7 |
| **Failure class** | Client sessionStorage lists remain primary; Supabase `capture_sessions` / `coach_sessions` not consistent authority |
| **Evidence / repro** | Capture session survives tab vs account switch inconsistently |
| **Likely files** | CaptureSessionContext; coach session persistence; persistCaptureSession |
| **Proposed fix direction** | Decide authority; migrate durable session metadata to Supabase when logged in |
| **Explicit non-goals** | Capture interpretation redesign |
| **Regression test to add** | Later |
| **Target resolution / validation point** | Phase 3D Capture session redesign |
| **Related docs** | Architecture audit |
| **Notes** | Not blocking domain-authority slices. **Phase 3A.1:** durable `capture_sessions` / `coach_sessions` rows for a deleted project are removed with the SET NULL bundle, and matching browser Capture/Coach lists plus the active Capture draft are pruned so they cannot attach to the next project. **Phase 3B validated:** starting New Capture can still retain previous transcript text. That is session honesty, not an apply-domain fallthrough. 3B did not redesign session start. Leave the behavioural fix for Phase 3D unless stale session state is later proven to cause an unsafe write. |

---

### D-014 — Live Capture apply → Supabase round-trip not in CI

| Field | Value |
| --- | --- |
| **Status** | partial |
| **Severity** | medium |
| **Domain** | Capture / Infra |
| **Found in** | Test safety net; `verify-capture-trust-boundary.ts` knownGap |
| **Failure class** | Deterministic suite cannot prove a live Capture apply → hosted Supabase round-trip without credentials |
| **Evidence / repro** | No live-Supabase Capture apply job in `npm test` |
| **Likely files** | `scripts/verify-phase3b-capture-boundary.ts`; `scripts/verify-capture-trust-boundary.ts`; `scripts/verify-phase2-persistence.ts` |
| **Proposed fix direction** | Keep deterministic suite credential-free. Phase 3B added fake-hook persist success/failure. A live workspace round-trip remains a separate job. |
| **Explicit non-goals** | Weakening review-before-write |
| **Regression test to add** | Live Capture apply job with secrets — not in `npm test` |
| **Target resolution / validation point** | before Capture is declared V1-ready (live job); deterministic apply-failure path validated in 3B |
| **Related docs** | `docs/LUME_TEST_SAFETY_NET_AUDIT.md` |
| **Notes** | **Phase 3B:** the previous `knownGap("End-to-end Capture apply → Supabase round-trip")` skip is retired. Dispatcher tests prove persist-failure does not announce success and does not fall through to another domain. Hosted Supabase apply is still not in CI. |

---

### D-015 — Historical `[Resolved]` titles may exist as open `risks` rows

| Field | Value |
| --- | --- |
| **Status** | open (data cleanup / transitional) |
| **Severity** | low–medium |
| **Domain** | Risks |
| **Found in** | Slice 1B |
| **Failure class** | Old Capture complete path could dual-write literal `[Resolved] …` as a **new open** risk title; leftover rows may still appear until cleaned |
| **Evidence / repro** | Query `risks` where `title ilike '[Resolved]%'` and `status in ('open','watch')` |
| **Likely files** | Data cleanup script (future); RiskFrame now treats domain status as authority |
| **Proposed fix direction** | One-off cleanup: mark such rows resolved or rename titles; do not broad-rewrite all historical Knowledge strings in product code |
| **Explicit non-goals** | Broad prose cleanup in Slice 1B (explicitly deferred) |
| **Regression test to add** | Optional invariant: new creates never insert `[Resolved]` prefix as open risk title |
| **Target resolution / validation point** | V1 product hardening / data cleanup before V1 launch if production rows exist; otherwise post-V1 ops cleanup |
| **Related docs** | `docs/SLICE1B_RISK_LIFECYCLE_AUTHORITY_HANDOVER.md` |
| **Notes** | New code paths avoid this; cleanup is ops/data. Timing depends on whether any live workspaces still have tainted rows — check before launch. |

---

### D-016 — Weak wording edits may lose Knowledge identity (safe-by-design limit)

| Field | Value |
| --- | --- |
| **Status** | deferred (accepted limitation) |
| **Severity** | low |
| **Domain** | Knowledge |
| **Found in** | Slice 1A.1 |
| **Failure class** | Without carried UUID and without enough deterministic wording overlap, an edit may INSERT+DELETE instead of UPDATE → provenance reset rather than wrong transfer |
| **Evidence / repro** | Short unrelated strings at same index; see `isLikelyWordingEdit` thresholds in `knowledge-identity.ts` |
| **Likely files** | `src/lib/knowledge-identity.ts`; reconcile |
| **Proposed fix direction** | Prefer carrying `sectionItemIds` through edit UI (already done); only tighten detector with structural evidence — never fuzzy AI matching |
| **Explicit non-goals** | Semantic AI identity matching |
| **Regression test to add** | Already covered: unrelated same-index must not inherit metadata |
| **Target resolution / validation point** | post-V1 / accepted limitation |
| **Related docs** | `docs/SLICE1A_DURABLE_KNOWLEDGE_HANDOVER.md` |
| **Notes** | Prefer safe loss over incorrect metadata transfer — intentional |

---

---

### D-020 — Dependencies / availability lack dedicated Ask domains

| Field | Value |
| --- | --- |
| **Status** | open (Ask/modelling remainder — Capture ingestion fixed in 3B / D-R13) |
| **Severity** | low |
| **Domain** | Ask/Tell Me · People · Knowledge |
| **Found in** | Slice 1D Ask context authority |
| **Failure class** | Ask can surface `kind=dependency` / `kind=availability` structured Knowledge rows when present, but there is no dedicated dependency graph or availability calendar domain. Gaps are easy to miss if only prose exists |
| **Evidence / repro** | Cross-domain person+risk fixture works when structured availability exists; no structured dependency inventory in MissionState beyond Knowledge kinds |
| **Likely files** | `src/lib/canonical-truth/serialize.ts`; People/availability UI |
| **Proposed fix direction** | Keep exposing structured kinds; do not invent brittle prose heuristics. Add dedicated modelling only when product requires it |
| **Explicit non-goals** | Building a universal graph or calendar in Ask convergence |
| **Regression test to add** | Already covered lightly in `verify:ask-context-authority` when structured availability present; People UI shows structured availability only |
| **Target resolution / validation point** | Ask/modelling for dedicated availability/dependency domains — Capture write path landed in 3B |
| **Related docs** | `docs/SLICE1D_ASK_CONTEXT_AUTHORITY_HANDOVER.md`; `docs/SLICE2D_PEOPLE_CONTEXT_UI_HANDOVER.md` |
| **Notes** | Slice 2A Dependencies frame shows structured `kind=dependency` only. Slice 2D People frame/detail renders structured availability when present and refuses to invent Away labels. **Phase 3B:** Capture availability writes `knowledge_items` `kind=availability` linked to a known Person, or Needs you. Unresolved availability cannot become Stakeholder or Todo. Ask still has no dedicated calendar/graph domain. |

---

### D-021 — Todo vs Knowledge open-loop dual representation still unresolved for Ask

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium |
| **Domain** | Ask/Tell Me · Todos · Knowledge |
| **Found in** | Slice 1D (related to D-008) |
| **Failure class** | Canonical Ask now includes Todo-domain open items + WAITING/CHASE and may still include Knowledge `openLoops` / open_loop structured facts. Soft overlap can remain when the same loop exists in both stores |
| **Evidence / repro** | Project with matching todo title and openLoops bullet; inspect AUTHORITATIVE PROJECT STATE sections |
| **Likely files** | `src/lib/canonical-truth/serialize.ts`; Todo/open-loop authority slice |
| **Proposed fix direction** | Dedicated open-loop/Todo authority decision (see D-008); optional deterministic dedupe only after authority is clear |
| **Explicit non-goals** | Fully resolving D-008 inside Ask context convergence |
| **Regression test to add** | After authority decision — not encoded as green “deduped” behaviour yet |
| **Target resolution / validation point** | Open-loop / To Do architecture slice (same family as D-008) |
| **Related docs** | D-008; `docs/SLICE1D_ASK_CONTEXT_AUTHORITY_HANDOVER.md` |
| **Notes** | 1D intentionally did not force a full dedupe redesign. Slice 2A Waiting frame may surface both todo waiting/chase and Knowledge openLoops — UI does not invent dedupe. |

---

### D-024 — “Actions left” uses local analysis meter, not billing entitlement

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Billing / UI |
| **Found in** | Slice 2A |
| **Failure class** | Ocean strip shows `analysesRemaining` local monthly meter labelled “actions left” — truthful existing behaviour, not server billing entitlement |
| **Evidence / repro** | Inspect `ProjectIntelligenceStrip` + `analysesRemaining` |
| **Likely files** | `ProjectIntelligenceStrip.tsx`; `src/lib/workspace/history.ts` |
| **Proposed fix direction** | Wire to real entitlement when billing meters exist; keep non-button pill treatment |
| **Explicit non-goals** | Fabricating usage to match mockup count |
| **Regression test to add** | Entitlement display once server meter exists |
| **Target resolution / validation point** | Billing / entitlement hardening |
| **Related docs** | Ocean baseline §5; `docs/SLICE2A_OCEAN_KNOWLEDGE_CENTRE_HANDOVER.md` |
| **Notes** | Documented rather than inventing a fake 36 |

---

### D-025 — Capture Ocean discrete §16 visual states still coarse

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Capture UI |
| **Found in** | Slice 2B |
| **Failure class** | Capture is Ocean-embedded with ✦ Analyse and review-boundary copy, but baseline §16 discrete screens (empty / live transcription / transcript-complete / post-analyse full review chrome) are not separately redesigned — existing Capture stages are restyled in place |
| **Evidence / repro** | Compare Capture input vs recording vs review against Ocean §16 checklist |
| **Likely files** | `CaptureWorkspace.tsx`; Capture review components |
| **Proposed fix direction** | Optional Capture visual polish pass once item-detail/People UI land; do not change lifecycle |
| **Explicit non-goals** | Changing Capture extraction/review-before-write |
| **Regression test to add** | Visual/state markers per §16 stage if redesigned |
| **Target resolution / validation point** | Phase 3D Capture visual/session polish |
| **Related docs** | Ocean baseline §16; `docs/SLICE2B_CAPTURE_OCEAN_HANDOVER.md` |
| **Notes** | Slice 2B closed D-022 integration; this tracks remaining visual depth only. **Phase 3B** did not redesign Review chrome. Review denominator/count, restore-dismissed, New Capture honesty remain 3D. |

---

### D-029 — Milestone complete has no durable status

| Field | Value |
| --- | --- |
| **Status** | deferred |
| **Severity** | low |
| **Domain** | Capture / Dates |
| **Found in** | Phase 3B Capture mutation boundary |
| **Failure class** | Completing/resolving a milestone cannot persist a completed status — `milestones` rows have no such column. Capture therefore fails closed (Needs you) instead of faking a Todo or deleting the date. |
| **Evidence / repro** | `planMilestone` `op === "complete"` → Needs you; `persistTimelineUpdate` updates label/dates only |
| **Likely files** | `src/lib/capture/apply/dispatch.ts`; `src/lib/data/supabase/persist-mutations.ts` |
| **Proposed fix direction** | Add a real milestone lifecycle only if product wants completed dates as first-class state. Until then, Needs you is the legal outcome. |
| **Explicit non-goals** | Routing milestone completion to Todo; inventing a status in Knowledge prose |
| **Regression test to add** | Already covered: Phase 3B test 12 |
| **Target resolution / validation point** | later date-lifecycle slice — not Phase 3D session UX |
| **Related docs** | D-R13 |
| **Notes** | Date *moves* persist via `updateTimelineItem` / `persistTimelineUpdate`. Unchanged dates are No Change. |

---

### D-030 — Leftover Knowledge prose can disagree with domain after Capture apply

| Field | Value |
| --- | --- |
| **Status** | resolved (presentation / v0.9 UX slice) |
| **Severity** | medium (trust/readability, not a wrong-domain write) |
| **Domain** | Knowledge Centre / Capture |
| **Found in** | Phase 3B visual/browser pass (25 Aug 2026) |
| **Failure class** | After a legal Capture apply, domain truth updates (Risk resolved, date moved) but leftover Knowledge section bullets with *different wording* still show in KC. Intelligence may say 0 risks while Risks & blockers still shows an old “remains open” sentence. Current position may still name the old date while Important dates is correct. |
| **Evidence / repro** | Candyland: resolve “Gumdrop Bridge icing” → `risks.status=resolved` and intelligence “I see 0 risks”, but `knowledge.sections.risks` still contains “Gumdrop Bridge icing remains open.” Ocean frames only skip knowledge bullets whose stripped title *equals* the domain title. |
| **Likely files** | `src/lib/knowledge-centre/ocean-frames.ts`; Capture apply knowledge projection (not the 3B dispatcher) |
| **Proposed fix direction** | When Capture legally resolves/updates a domain record, retire or rewrite the matching Knowledge projection using carried IDs — not fuzzy title match. Until then, testers should trust the domain frame + intelligence strip over leftover sentences. |
| **Fix applied (presentation only)** | Display precedence in `buildOpenRiskRows` / `buildCurrentPositionRows`: if a project has any domain `risks` rows, Risks & blockers shows only open/watch domain risks. Knowledge `sections.risks` prose is not painted as peer current truth. Current position excludes `kind=date`/`kind=risk` and `sectionItemIds` that match a domain risk or timeline id. Unlinked leftover sentences are preserved. No fuzzy match, no Knowledge mutation, no reconcile engine. Data rewrite remains a later architecture item. |
| **Explicit non-goals** | Fuzzy matching leftover bullets to domain titles; treating Knowledge prose as Risk authority |
| **Regression test to add** | After Capture Risk resolve, KC open-risk rows exclude leftover prose for that durable Risk ID |
| **Target resolution / validation point** | KC projection / knowledge reconcile — not Phase 3D session UX |
| **Related docs** | D-R13; D-015 |
| **Notes** | Does not mean the 3B dispatcher wrote the wrong object. It makes manual regression easy to misread if the reviewer only looks at leftover bullets. |

---

### D-031 — Coach drawer auto-opens over Capture / Knowledge Centre

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Ocean / Coach |
| **Found in** | Phase 3B visual pass (25 Aug 2026) |
| **Failure class** | On project load the Coach dialog overlays Capture and KC, including the Capture Analyse control. Close is outside the default viewport in some layouts. |
| **Evidence / repro** | Open `/projects/:id` in local mode; Coach “Ready when you are” dialog is present before any Capture action |
| **Likely files** | Coach drawer / Ocean shell |
| **Proposed fix direction** | Do not auto-open Coach on Capture/KC entry; keep it opt-in. Do not redesign Ocean in 3B. |
| **Explicit non-goals** | Coach product revival; Ocean redesign |
| **Regression test to add** | Capture mode is usable without dismissing Coach |
| **Target resolution / validation point** | Ocean/QOL — not Phase 3B or 3D Capture session |
| **Related docs** | D-025 |
| **Notes** | 3B testing dismissed the overlay; it did not cause a wrong-domain write. **v0.9 UX slice:** `CoachDrawer` / `CoachResultsCard` are unmounted from `AppShell`. The drawer cannot auto-open over Capture/KC. Coach logic remains in-repo but is not a product surface. |

---

### D-032 — Dual Capture / New Project pipelines while experimental flags are on

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium |
| **Domain** | Capture / New Project |
| **Found in** | Experimental Programme (25 Aug 2026) |
| **Failure class** | `LUME_CAPTURE_V2` and `LUME_NEW_PROJECT_V2` keep legacy OpenAI/local paths alongside observation pipelines. Permanent dual engines would reintroduce matching/heuristic drift. |
| **Evidence / repro** | Unset flags → `/api/capture` uses findings + `tidyAndCoachWithOpenAI` / local regex; flags `=1` + OpenAI → `src/lib/capture-v2` / `src/lib/new-project-v2`. Phase 3B apply is shared. |
| **Likely files** | `src/app/api/capture/route.ts`; `src/app/api/new-project/route.ts`; `src/lib/capture-v2`; `src/lib/new-project-v2`; `docs/EXPERIMENTAL_PROGRAMME.md` |
| **Proposed fix direction** | After independent review: either default V2 and delete the OpenAI findings path, or disable V2. Keep Phase 3B. Local/no-OpenAI Capture remains legacy (V2 does not add regex). |
| **Explicit non-goals** | A second NLP/matching engine; weakening 3A/3B |
| **Regression test to add** | `verify-capture-v2`; `verify-new-project-v2`; phase 3B suite still green |
| **Target resolution / validation point** | Experimental Programme merge decision |
| **Related docs** | `docs/EXPERIMENTAL_PROGRAMME.md`; D-011; D-R13 |
| **Notes** | Desert is not flagged. Ocean remains the default appearance. |

---

### D-034 — No in-product account deletion (workspace can orphan)

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium |
| **Domain** | Infra |
| **Found in** | Legal Eagle V1 audit (27 Aug 2026) |
| **Failure class** | Users can delete a project; they cannot delete their account in-app. Deleting `auth.users` cascades memberships/profiles but not `workspaces`, leaving project rows ownerless (hidden by RLS, still in backups). |
| **Evidence / repro** | Account page has Sign out / billing only; schema `workspaces` has no ON DELETE from users |
| **Likely files** | `src/app/account/page.tsx`; `supabase/migrations/20260812002748_workspace_schema.sql` |
| **Proposed fix direction** | V1: Privacy Policy + support process (delete personal workspace, then Auth user). Later: one security-definer RPC. |
| **Explicit non-goals** | DSAR portal; enterprise retention |
| **Regression test to add** | If RPC ships: deleting account removes workspace projects |
| **Target resolution / validation point** | before V1 launch (documented process); self-service post-V1 |
| **Related docs** | `docs/LUME_V1_LEGAL_EAGLE_AUDIT.md` F-06 |
| **Notes** | Legal Eagle did not build self-service deletion. |

---

## Resolved discoveries (reference)

Move items here when fixed. Keep enough detail that regressions are recognizable.

### D-R01 — Knowledge Centre corrections not durable (Slice 1A)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 1A / PR #46 — `docs/SLICE1A_DURABLE_KNOWLEDGE_HANDOVER.md` |
| **Failure class** | Edit/replace Knowledge updated MissionState only; reload restored old `knowledge_items` |
| **Fix summary** | `persistKnowledgeReconcile` UPDATE/INSERT/DELETE; wired from store |

---

### D-R02 — Same-index Knowledge replacement inherited identity (Slice 1A.1)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 1A.1 / PR #48 — stable Knowledge identity |
| **Failure class** | Positional matching transferred id/provenance/metadata to unrelated bullets |
| **Fix summary** | Exact body → stable id → unique wording-edit; never index-alone; `sectionItemIds` |

---

### D-R03 — Resolved Risk resurrected on hydrate (Slice 1B)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 1B / PR #49 — `docs/SLICE1B_RISK_LIFECYCLE_AUTHORITY_HANDOVER.md` |
| **Failure class** | `[Resolved]` prose without `risks.status` update; fold-in reintroduced open title |
| **Fix summary** | `MissionState.risks` + `persistRiskStatus`; Knowledge projection sync; fold skips resolved/accepted |

---

### D-R04 — Confirm Owner non-UUID `resp-*` ids (Slice 1C)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 1C — `docs/SLICE1C_PEOPLE_ENTITIES_HANDOVER.md` |
| **Failure class** | Confirm Owner minted `resp-*` ids incompatible with UUID `knowledge_items.id` |
| **Fix summary** | Responsibility + person ids use `crypto.randomUUID()` / durable stakeholder UUID; safety-net knownGap retired |

---

### D-R05 — Confirm Owner missing stakeholder persist (Slice 1C)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 1C — `docs/SLICE1C_PEOPLE_ENTITIES_HANDOVER.md` |
| **Failure class** | Confirm Owner only updated in-memory stakeholders |
| **Fix summary** | `persistEnsureStakeholder` + in-memory `ensurePersonOnProject`; personId on responsibility meta |

---

### D-R06 — Canonical invents false “owner not recorded” gaps (Slice 1D)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 1D — `docs/SLICE1D_ASK_CONTEXT_AUTHORITY_HANDOVER.md` |
| **Failure class** | `findUnknownOwnerHints` invented unknown-owner from ownership topic tokens / missing match |
| **Fix summary** | Unknown-owner only from stored unconfirmed responsibility rows; ownership fast-path uses `findConfirmedOwners`; no fabricated Needs you from absence |

---

### D-R07 — Tell Me singular owner for shared responsibilities (Slice 1D)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 1D — `docs/SLICE1D_ASK_CONTEXT_AUTHORITY_HANDOVER.md` |
| **Failure class** | Ask/Tell Me collapsed multi-owner scopes to one person |
| **Fix summary** | Serialize emits all current `@Person → scope` rows; local ownership answer names all confirmed owners |

---

### D-R08 — Ocean Capture chrome / workspace integration (Slice 2B)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 2B — `docs/SLICE2B_CAPTURE_OCEAN_HANDOVER.md` |
| **Failure class** | Capture felt bolted-on / pre-Ocean when selected as project mode |
| **Fix summary** | `variant="ocean"` CaptureWorkspace in Ocean shell; ✦ Analyse; review-before-write banner; dark-only V1 (AppearanceToggle removed); no Capture sidebar destination |

---

### D-R09 — Knowledge item rich detail drawer (Slice 2C)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 2C — `docs/SLICE2C_KNOWLEDGE_ITEM_DETAIL_HANDOVER.md` |
| **Failure class** | Ocean Knowledge cards were opaque / To Do click only toggled done — no inspection of evidence, supersession, relations, or correction |
| **Fix summary** | Reusable Ocean side drawer keyed by stable Knowledge/domain ids; provenance humanized from stored entries only; current vs superseded; Risk/Todo/Person/section correction via existing durable store paths; save-error surfaced in drawer |

---

### D-019 — Confirm Owner UI lacks explicit replace-vs-share choice

| Field | Value |
| --- | --- |
| **Status** | fixed (resolved by D-R10) |
| **Fixed in** | Slice 2D — `docs/SLICE2D_PEOPLE_CONTEXT_UI_HANDOVER.md` |
| **Failure class** | API already supported `replacePersonId` for time-varying ownership, but Confirm Owner always ADDed/shared. Users could not explicitly replace Bob with Mary from the dialog |
| **Evidence / repro (historical)** | Pre-2D `ConfirmOwnerDialog.tsx` passed personId + resolveTruthItemId with no replace control |
| **Fix summary** | Implemented as **D-R10**. Confirm Owner now asks share vs replace when other current owners exist. **Do not treat share-vs-replace UI as still missing.** Remaining People debt is D-007 (Capture promotion), not this dialog. |

---

### D-R10 — Confirm Owner share vs replace / People Context UI (Slice 2D)

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 2D — `docs/SLICE2D_PEOPLE_CONTEXT_UI_HANDOVER.md` |
| **Failure class** | Confirm Owner always shared; users could not explicitly replace/hand over ownership (original D-019) |
| **Fix summary** | Confirm Owner asks share vs replace when other current owners exist; handover actions on person detail; People frame shows shared/availability/waiting from durable data only. This is the implementation record for D-019. |

---

### D-006 — Invalid New Project risk source `setup`

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Phase 3A (D-R11) |
| **Failure class** | New project risk inserts used `source: "setup"`; DB allows only `manual \| capture \| seed` |
| **Fix summary** | Inserts use `NEW_PROJECT_RISK_SOURCE = "manual"`. The DB enum was not expanded. |

---

### D-R11 — Phase 3A New Project integrity & durable reactive state

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Phase 3A — Data Integrity & Reactive-State Foundation |
| **Failure class** | New Project used illegal risk `source: "setup"` (D-006); sequential non-transactional inserts could leave a partial project; server-fail fell through to a second browser `persistNewProject` (duplicate/orphan); no create idempotency; MissionState was written to the Supabase paint cache on every change including unconfirmed optimistic state; Ocean had no global save-failure surface |
| **Fix summary** | Risk source `manual`; compensating cleanup of the failed bundle (SET NULL children first, then project CASCADE); one server create path; `clientProjectId` retry identity; persist-first create then `applyDurableWorkspace`; paint cache only on hydrate/confirmed persist; Ocean `ocean-save-error`; persist failure reconciles from `/api/workspace/state`. History create event is secondary after authoritative success. |

---

### D-R12 — Phase 3A.1 Safe Project Deletion & regression hygiene

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Phase 3A.1 — Safe Project Deletion & Regression Hygiene |
| **Failure class** | There was no user-facing way to delete a disposable/test project. `repositories.projects.delete` existed unused and would only delete the `projects` row (SET NULL children would become workspace orphans). No workspace+UUID scoping. |
| **Fix summary** | Confirmed Delete Project on the Ocean project header; one server path `DELETE /api/workspace/projects/[id]` → `persistProjectDelete` (membership + exact UUID, SET NULL children removed, then project row). MissionState/cache update only after confirmed success. Failure stays visible and does not hide the project. After delete, selection follows Home: first remaining project, or New Project onboarding if none remain. Project-scoped History rows are removed with the bundle (no new retention model). Adjacent residuals: D-027 (no archive/undo), D-028 (sequential delete), D-013 remainder (session authority → Phase 3D). |

---

### D-R13 — Phase 3B Conservative Capture mutation boundary

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Phase 3B — Conservative Capture Mutation Boundary |
| **Failure class** | Capture apply could fall through into the wrong authority (generic Todo, duplicate Person, Risk/date as Todo). Project scope could silently use whichever project was open. Demo-name heuristics steered interpretation. Availability could become Stakeholder. Ambiguous share-vs-replace could write. |
| **Fix summary** | Exhaustive typed apply dispatcher (`src/lib/capture/apply`) with runtime validation. Each finding mutates only its legal domain or Needs you / no write. No generic Todo fallback. Project scope uses Capture entry context only when the finding is not uncertain. Durable IDs carried for Risk/Person/milestone; a supplied Risk ID that is not on the project does **not** title-fallback onto another Risk. Unassigned (`projectId: null`) Todos cannot be mutated from a project Capture. `kind` cannot be retargeted by a conflicting `legalDomain` sticker. Availability fields cannot retarget a typed Risk/Todo/milestone. Mapping `legalDomain: unsupported` (unknown op/entity) is honored before availability/responsibility refinements. People reuse `ensurePersonOnProject`. Responsibilities reuse Confirm Owner; a Person ID not on the project is Needs you. Unknown ownership semantics cannot be discarded into a Person write. Availability writes structured `kind=availability`. Milestone date moves persist; milestone *complete* is Needs you (D-029). CREATE against an existing on-project Todo/milestone ID, or an exact unique Risk title, is no-change rather than a duplicate. Local extract auto-ready updates/completions require the existing title and cue in the same sentence (no token-overlap auto-accept). Persist-first Capture paths for Risk create/status, milestone create/update, Person, availability. Tests in `scripts/verify-phase3b-capture-boundary.ts`. Resolves D-017; Capture portions of D-011 and D-020; duplicate-Person class of D-007. |

---

### D-R14 — Shared-browser project residue after logout / account-switch

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Legal Eagle V1 audit — browser isolation |
| **Failure class** | Logout missed Tell Me snapshots and project dictionary; login did not wipe paint cache, so User B could briefly navigate into User A’s cached Knowledge Centre. Capture GET returned OpenAI key prefix. |
| **Fix summary** | `clearAuthenticatedBrowserState` now covers Tell Me snapshots, dictionary, and layout prefixes. Login/signup/logout full-navigate after wipe. Hydrate discards cache when `cached.userId` ≠ signed-in user. Capture GET uses `requireSignedIn` and hides key diagnostics outside development. |

---

## Suggested fix order (non-binding)

1. ~~**D-006**~~ — fixed in Phase 3A (D-R11)  
2. ~~**D-001 + D-002**~~ — fixed in Slice 1C  
3. ~~**D-019**~~ — fixed in Slice 2D (D-R10)  
4. **D-007** remainder — leftover Knowledge people prose without a stakeholder link  
5. ~~**D-023**~~ — fixed in Slice 2C (D-R09)  
6. ~~**D-022**~~ — fixed in Slice 2B; residual **D-025** / **D-013** → Phase 3D  
7. ~~**D-017**~~ — fixed in Phase 3B (D-R13)  
8. **D-014** remainder — live Supabase Capture apply job (deterministic fake path landed in 3B)  
9. **D-011** remainder — New Project extractors only  
10. **D-003** — suggestion persist (V1 product hardening)  
11. **D-005** remainder — persist-first for remaining optimistic store paths (Capture Risk/milestone/Person/availability landed in 3B)  
12. **D-004** remainder — history persist gaps outside New Project create (create-path coupling decided in 3A)  
13. ~~**D-009 / D-018**~~ — fixed in Slice 1D; **D-010** residual until canonical production default  
14. **D-026** — product decision on project-code uniqueness  
15. **D-028** — optional later bundle RPC for delete (same class as create)  
16. **D-027** — Archive/undo only if product asks; not required for V1 hygiene  
17. **D-008 / D-021**, **D-012–D-015**, **D-020** Ask remainder, **D-024**, **D-029**, **D-030**, **D-031** — as scheduled  

Do **not** treat this order as a mandate to broaden an in-flight slice.

---

## Maintenance rules

- Every V1 foundation PR that finds an adjacent defect must add or update an entry **before** merge.
- Do not delete resolved entries; move them to **Resolved discoveries**.
- Do not encode open discoveries as green tests; use `knownGap` until fixed.
- Prefer linking PRs and handover docs over duplicating long design prose here.
- Always set **Target resolution / validation point** using the vocabulary above (or mark ambiguous).
