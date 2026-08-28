# Lume V1 — Known Discoveries Backlog

**Status:** Living document  
**Date started:** 19 August 2026  
**Last housekeeping:** 28 August 2026 (v0.9 final closure: isolation D-036, Capture freeze, Coach/Catch-Me-Up/Ask reality)  
**Product/trust constitution:** `docs/v1-reference-pack/`  
**v0.9 operating picture:** `docs/LUME_V09_TO_V1_HANDOFF.md`  
**Current implementation map:** `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` (Capture-flag tables in Part A are stale — code + v0.9 handoff win)  
**Docs entry point:** `docs/README.md`  

This file records **project-truth and persistence defects** discovered during V1 foundation work that were **not fixed in the slice that found them** (or remain partially fixed).

Use it so future slices do not re-discover the same failure class, do not greenwash known gaps as tests, and have enough context to fix safely.

**v0.9 closed-alpha reading rule:** Capture is frozen. Do not reopen Capture because an old discovery still exists. Classify remaining items with the v0.9 vocabulary in `docs/LUME_V09_TO_V1_HANDOFF.md` §10: CLOSED / ACCEPTED v0.9 / V1 MUST / V1 SHOULD / TESTER EVIDENCE / DEFERRED / SUPERSEDED. The **Status** field below remains `open | partial | deferred | fixed` for history.

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
| **Notes** | Risk recommendations must remain suggestions until explicitly converted (Slice 1B product rule). **v0.9 classification: V1 SHOULD / TESTER EVIDENCE** — still memory-only (`setRecommendationStatus` / accept / dismiss). Dismissed suggestions can return after reload; accepted derived To Dos may be memory-only. Classify by actual V1 prominence after alpha, not by building a suggestion platform now. |

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
| **Notes** | Prefer sparse, high-signal events over logging everything. Broader `pushHistory` without `persistHistoryEvent` remains open. **v0.9:** `history_events` stores `type`, `title`, `detail`, `source`, `project_id` — **no** entity/field/old/new columns. Diffs are prose. This is why Project Change Intelligence must not pretend History already is a deterministic change log. **v0.9 classification: ACCEPTED v0.9**; promote when building the narrow old→new primitive (`docs/LUME_V09_TO_V1_HANDOFF.md` §8). |

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
| **Notes** | **Phase 3A (partial):** Ocean chrome now shows `saveStatus=error` via `ocean-save-error`. Failed persist paths call `reportPersistFailure`, reconcile from `/api/workspace/state`, and do not write dirty state to the paint cache. **Phase 3B:** Capture apply for Risk/milestone/Person/availability is persist-first. Todo create/update/complete and Confirm Owner remain optimistic-then-persist. **Still open / user-reachable:** ordinary KC/Todo mutations that are optimistic with reconcile-on-failure; **D-043 Meeting Prep** is memory-only with no persist. Do not call the entire persistence layer unsafe. Capture V2 Apply is persist-first/server authoritative. **v0.9 classification: V1 SHOULD** for remaining optimistic UX; **V1 MUST** for D-043 if reachable. |

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
| **Notes** | SET NULL-first is required so a successful project delete cannot leave workspace orphans. The residual is failure-after-partial-cleanup, not silent cross-project damage. **Live production smoke (v0.9):** project deletion succeeded; do **not** describe project deletion as currently unsafe. Hand-maintained `PROJECT_BUNDLE_SET_NULL_TABLES` (todos, memories, recommendations, history_events, capture_sessions, coach_sessions) is future-proofing debt if a new SET-NULL table is added without the list. **v0.9 classification: ACCEPTED v0.9** (tech debt / V1 SHOULD bundle RPC, not a launch blocker). |

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
| **Notes** | **Already delivered (do not re-open as missing UI):** Slice 1C durable stakeholder identity + `personId` on responsibilities; Slice 2C reusable person detail (`getPersonBundle` / Ocean drawer); Slice 2D People frame polish + Confirm Owner share-vs-replace (D-019 → D-R10). **Phase 3B (D-R13):** Capture apply reuses `ensurePersonOnProject` / existing Person UUIDs. An existing Person is not duplicated **by ID**; continuing-responsibility statements no-op; ambiguous identity is Needs you. Exact-name reuse is **CURRENT** conservative resolution only — **a name is not identity** (handoff Part C §C7). Two legitimate people may share a name; do **not** add a unique-name DB constraint. **Remaining open scope:** leftover Knowledge people *prose* that was never a Capture finding still may lack a stakeholder link. That is not permission to silently mint identities. |

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
| **Proposed fix direction** | **Authority decided (26 Aug convergence, not implemented):** todos `WAITING`/`CHASE`/`waitingOn` = maintained waiting *work*; `openLoops` / structured `open_loop` = narrative Knowledge until promoted (then superseded) or closed. KC Waiting frame may still concatenate as a view. Do not fuzzy-dedupe. Canonical Ask must not treat them as interchangeable. |
| **Explicit non-goals** | Full GTD redesign; a third waiting store |
| **Regression test to add** | Authority rule characterisation: waiting todos vs openLoop narrative; promotion supersedes the openLoop |
| **Target resolution / validation point** | Open-loop / To Do architecture slice — after tests lock current concatenation behaviour |
| **Related docs** | Architecture audit; `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` Part C §C2 |
| **Notes** | Authority is now decided in the handoff. Implementation is a later slice. Do not fix opportunistically inside unrelated slices. |

---

### D-010 — Legacy Ask path still injects History as competing truth

| Field | Value |
| --- | --- |
| **Status** | partial — **production Ask HTTP path closed**; residual is the unused/legacy library default |
| **Severity** | low (was medium when production default was off) |
| **Domain** | Ask/Tell Me |
| **Found in** | Architecture audit §3.3.4 |
| **Failure class** | Legacy `buildCaptureContext` can still inject history into prompts if called without canonical truth. **Live product Ask does not take that path.** |
| **Evidence / repro** | **Production (v0.9):** `POST /api/tell-me` always passes `useCanonicalTruth: true`, loads durable workspace truth, ignores leftover `state`/`snapshot`. Live two-account isolation (28 Aug 2026) returned 404 `project_not_found` for a foreign `projectId` and did not leak Account B facts when asking “Who is Brian Boundary?” on Account A. **Residual:** `isCanonicalTruthEnabled()` still defaults **off** when neither `explicit` nor `forEval` is set and `LUME_CANONICAL_TRUTH` is unset. That default is **not** the live HTTP path. |
| **Likely files** | `src/app/api/tell-me/route.ts`; `src/lib/canonical-truth/flag.ts`; `src/lib/tell-me/context.ts` |
| **Proposed fix direction** | Optionally flip the library default to on so evals/scripts cannot accidentally use legacy. Do not treat this as “Ask still uses History as truth.” |
| **Explicit non-goals** | Deleting History; reopening Capture |
| **Regression test to add** | Context-integrity on canonical path already exists; keep live Ask isolation as a manual/alpha check |
| **Target resolution / validation point** | Library-default cleanup — ACCEPTED v0.9; not a Capture unfreeze |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md`; Philosophy; `docs/SLICE1D_ASK_CONTEXT_AUTHORITY_HANDOVER.md` |
| **Notes** | **v0.9 classification: ACCEPTED v0.9** (library default) / **CLOSED** for the live Ask product path. Do not restore “canonical truth is optional in production” guidance. |

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
| **Notes** | **Phase 3B:** the previous `knownGap("End-to-end Capture apply → Supabase round-trip")` skip is retired. Dispatcher tests prove persist-failure does not announce success and does not fall through to another domain. Hosted Supabase apply is still not in CI. **v0.9:** live production Capture Apply was smoke-tested; live two-account **server** isolation was proven manually (28 Aug 2026). CI still does not run live tenant isolation (D-014 remainder + D-036 is a separate session-switch defect). **v0.9 classification: ACCEPTED v0.9** for missing live CI job. |

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
| **Proposed fix direction** | Follow D-008 / handoff Part C: Ask waiting block from todos only as *work*; `open_loop` items remain Knowledge narrative. No fuzzy title dedupe. Promotion must supersede the openLoop. |
| **Explicit non-goals** | Fully resolving D-008 inside an Ask-only PR; string-similarity merge |
| **Regression test to add** | After authority implementation — not encoded as green “deduped” behaviour yet |
| **Target resolution / validation point** | Open-loop / To Do architecture slice (same family as D-008) |
| **Related docs** | D-008; `docs/SLICE1D_ASK_CONTEXT_AUTHORITY_HANDOVER.md`; handoff Part C §C2 |
| **Notes** | 1D intentionally did not force a full dedupe redesign. Authority is now decided; implementation is later. Slice 2A Waiting frame may still surface both as a view. |

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
| **Status** | fixed (presentation / v0.9 UX slice) — data-rewrite remainder is D-038 if a Todo delete still leaves a Current-position fact |
| **Severity** | medium (trust/readability, not a wrong-domain write) |
| **Domain** | Knowledge Centre / Capture |
| **Found in** | Phase 3B visual/browser pass (25 Aug 2026) |
| **Failure class** | After a legal Capture apply, domain truth updates (Risk resolved, date moved) but leftover Knowledge section bullets with *different wording* still show in KC. |
| **Evidence / repro** | Historical Candyland: resolve “Gumdrop Bridge icing” → domain risk resolved while leftover prose still painted as a peer. |
| **Fix applied (presentation only)** | Display precedence in `buildOpenRiskRows` / `buildCurrentPositionRows`: if a project has any domain `risks` rows, Risks & blockers shows only open/watch domain risks. Knowledge `sections.risks` prose is not painted as peer current truth. Current position excludes `kind=date`/`kind=risk` and `sectionItemIds` that match a domain risk or timeline id. Unlinked leftover sentences are preserved. No fuzzy match, no Knowledge mutation, no reconcile engine. |
| **v0.9 classification** | **CLOSED** for the D-030 “stale peer prose beside current Risks/dates” presentation bug. Remaining mirrored-fact-after-Todo-delete is **D-038**, a different remainder. |
| **Related docs** | D-R13; D-015; D-038; `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | Does not mean the 3B dispatcher wrote the wrong object. Do not unfreeze Capture to “reconcile Knowledge.” |

---

### D-031 — Coach drawer auto-opens over Capture / Knowledge Centre

| Field | Value |
| --- | --- |
| **Status** | fixed (v0.9 UX — Coach unmounted) |
| **Severity** | low |
| **Domain** | Ocean / Coach |
| **Found in** | Phase 3B visual pass (25 Aug 2026) |
| **Failure class** | On project load the Coach dialog overlaid Capture and KC. |
| **Evidence / repro (historical)** | Open `/projects/:id` in local mode; Coach “Ready when you are” dialog present before any Capture action. |
| **Fix applied** | `CoachDrawer` / `CoachResultsCard` are **unmounted** from `AppShell`. `openCoachDrawer()` still dispatches `lume:open-coach` with no mounted listener. Coach logic remains in-repo. Leftover route `/coaching` is not a v0.9 mode. Advise is parked/coming soon. |
| **v0.9 classification** | **CLOSED** as a v0.9 product surface. Leftover `/coaching` + `/api/coach` client-state acceptance is **ACCEPTED v0.9** (hide/remove before public V1 if testers find it). Do **not** rebuild Coach. |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md`; D-033 remainder |
| **Notes** | Auto-open cannot happen because the drawer is not mounted. |

---

### D-032 — Dual Capture / New Project pipelines while experimental flags are on

| Field | Value |
| --- | --- |
| **Status** | partial — **Capture dual-engine CLOSED**; New Project V2 still env-flagged |
| **Severity** | low (was medium while Capture still had a live flag) |
| **Domain** | Capture / New Project |
| **Found in** | Experimental Programme (25 Aug 2026) |
| **Failure class** | Permanent dual engines would reintroduce matching/heuristic drift. |
| **Evidence / repro** | **Capture (v0.9):** `src/lib/capture-v2/flag.ts` `isCaptureV2Enabled()` **always returns true**. `LUME_CAPTURE_V2` is ignored. Legacy findings cannot be restored. Engine frozen at SHA `2131444` / `main` `2e024d0`. **New Project:** `isNewProjectV2Enabled()` still requires `LUME_NEW_PROJECT_V2=1\|true`. Current Production has that flag on (Talk It Through → “Here’s what Lume understood”). Unset locally still selects legacy Talk assemble. |
| **Likely files** | `src/lib/capture-v2/flag.ts`; `src/lib/new-project-v2/flag.ts`; `src/app/api/new-project/route.ts` |
| **Proposed fix direction** | Leave Capture frozen. Optionally pin New Project V2 the same way as Capture if local/preview drift becomes a problem. Do not restore a Capture engine flag. |
| **Explicit non-goals** | A second NLP/matching engine; unfreezing Capture; deleting New Project V2 |
| **Regression test to add** | Existing `verify-capture-v2` / `verify-new-project-v2` |
| **Target resolution / validation point** | New Project flag pin — ACCEPTED v0.9 unless preview/local drift appears |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md`; `docs/EXPERIMENTAL_PROGRAMME.md` (superseded as engine guidance) |
| **Notes** | **v0.9 classification: CLOSED** for Capture dual-engine / `LUME_CAPTURE_V2` deployment requirement. **ACCEPTED v0.9** for New Project still being env-gated. `docs/EXPERIMENTAL_PROGRAMME.md` must not govern Capture implementation. |

---

### D-033 — AI decision routes accept browser-supplied MissionState as current truth

| Field | Value |
| --- | --- |
| **Status** | partial — **Tell Me + Capture HTTP CLOSED**; Coach leftover API still accepts client MissionState |
| **Severity** | low for v0.9 product (Coach unmounted); medium if `/api/coach` is called directly |
| **Domain** | Ask/Tell Me · Capture · Infra |
| **Found in** | V1 Architectural Convergence (26 Aug 2026) |
| **Failure class** | `/api/coach` still treats client-posted `MissionState` as the project truth the model sees. This is not primarily IDOR (RLS still applies). |
| **Evidence / repro** | **Tell Me (fixed):** `POST /api/tell-me` requires `projectId` + `question`; leftover `state`/`snapshot` ignored; server load. **Capture (fixed, v0.9 sole engine):** Analyse/Apply load durable truth; leftover `body.state` ignored; foreign project 404. **Legacy Capture branch:** not reachable (`isCaptureV2Enabled()` always true). **Still open:** `/api/coach` accepts client MissionState. Coach UI is unmounted. |
| **Likely files** | `src/app/api/coach/route.ts` |
| **Proposed fix direction** | Before public V1, disable or server-load `/api/coach` if the route remains. Do not rebuild Coach. |
| **Explicit non-goals** | Claiming this as an RLS/IDOR repair; restoring Coach as a product surface |
| **Regression test to add** | Existing `verify-capture-server-truth.ts` / `verify-tell-me-server-truth.ts` |
| **Target resolution / validation point** | Hide leftover Coach API — V1 SHOULD / ACCEPTED v0.9 |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md`; D-010; D-032; D-031 |
| **Notes** | **v0.9 classification: CLOSED** for Capture Apply client-world and live Ask. **ACCEPTED v0.9** for unmounted Coach API. Client MissionState is still a hydrate/cache after Apply — it is not HTTP current-truth authority. D-036 is a *display* leak of that cache across SPA login, not this HTTP class. |

---

### D-034 — Capture apply validates against client world; no durable row versioning

| Field | Value |
| --- | --- |
| **Status** | partial — **Capture V2 Apply fresh-load + fingerprint CLOSED**; no schema `version` column (intentionally not a v0.9/V1 requirement) |
| **Severity** | low |
| **Domain** | Capture · Infra |
| **Found in** | V1 Architectural Convergence (26 Aug 2026) |
| **Failure class** | Concurrent tabs / stale apply review could write against a world that is no longer durable truth **if the client world is trusted**. Live Capture Apply does not trust client world. |
| **Evidence / repro** | `POST /api/capture/apply` reloads via `loadServerCaptureWorld`, compares Analyse-time `expectedTarget`, fail-closed on deleted/changed/foreign. No MissionState posted on Apply. Legacy client-world apply is unreachable. **Remaining:** no integer `version` column; fingerprint is not a universal concurrency contract. |
| **Likely files** | `src/lib/capture/apply/apply-approved.ts`; `src/lib/capture/apply/expected-target.ts`; `src/app/api/capture/apply/route.ts` |
| **Proposed fix direction** | Keep fingerprint + fresh load. Do **not** promote schema versioning to V1 unless fingerprints fail in production. Version columns were explicitly rejected for v0.9. |
| **Explicit non-goals** | App-wide command bus; treating this as D-035 project-membership |
| **Regression test to add** | `scripts/verify-capture-server-truth.ts` cases D/E |
| **Target resolution / validation point** | Schema versioning only if fingerprints fail — **DEFERRED** |
| **Related docs** | Handoff Part C §C5–C6; D-005; D-R13; D-035; `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | **v0.9 classification: CLOSED** for client-world Capture Apply. **DEFERRED** for integer `version` columns. |

---

### D-035 — Project-domain mutations must verify intended project membership

| Field | Value |
| --- | --- |
| **Status** | partial — **Todo persist helpers CLOSED**; wider persist-helper audit still open |
| **Severity** | medium (was high while Todo update/delete were id-only) |
| **Domain** | Infra / all project-domain writes |
| **Found in** | V1 Architectural Convergence; Thor amendment (26 Aug 2026) |
| **Failure class** | Workspace RLS is membership-wide, so an id-only UPDATE/DELETE can mutate another project’s row in the **same** workspace. This is not cross-account IDOR. |
| **Evidence / repro** | **Capture V2:** server world filtered to requested project; foreign IDs fail closed. **Todos (v0.9):** `persistTodoUpdate` / `persistTodoDelete` use `scopeExistingTodo` with `workspace_id` **and** `project_id` (or `project_id IS NULL`). Old “Todo persist helpers are ID-only” wording is **false**. **Still open:** equivalent helpers for other domains (knowledge_items, milestones, stakeholders, memories, recommendations, history_events, sessions) must still be inventoried. |
| **Likely files** | `src/lib/data/supabase/persist-mutations.ts` |
| **Proposed fix direction** | Later persist-helper audit: require intended `project_id` + workspace on every project-domain write. Do not document this as Todo-only, and do not re-open the Todo sub-case as if it were still id-only. |
| **Explicit non-goals** | A generic mutation framework; conflating with D-034 versioning; calling this an RLS/IDOR tenant bug |
| **Regression test to add** | Capture V2 isolation tests exist. Persist-helper property tests remain a later pass. |
| **Target resolution / validation point** | V1 SHOULD persist-helper audit — not a Capture unfreeze |
| **Related docs** | Handoff Part C §C5; D-034; `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | **v0.9 classification: CLOSED** for Todo update/delete project membership. **V1 SHOULD** for the remaining helper inventory. Live two-account isolation (28 Aug) proved cross-account mutate/delete fail-closed (404). Same-account project isolation is application-layer. |

---

### D-036 — Same-browser SPA logout → login displays previous user's in-memory workspace

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | high (display / shared-device; not RLS/IDOR) |
| **Domain** | Auth / hydrate / tenant display |
| **Found in** | v0.9 live two-account isolation (28 August 2026) |
| **Failure class** | After Sign out → SPA login as a different user without remounting `MissionProvider`, the UI can still paint the previous user's project (name, people, todos) while chrome shows the new user. Authenticated APIs fail-closed. Mutations do not succeed. `lume-mission-supabase-cache-v1` is cleared on logout. The leak is **in-memory React state**. |
| **Evidence / repro** | Account B on TENANT-B → Sign out → Account A login via `router.replace`. URL stayed `/projects/<B-id>`. UI showed Brian Boundary / Digitise red ledger while chrome user was Account A. `GET /api/workspace/state` returned only A's workspace. Ask on the leaked B id: “Project not found or you do not have access to it.” Full `page.goto` remounted and showed A's truth. Cause: hydrate `useEffect([])` runs once; `onAuthStateChange` returns early if `hydrateSucceeded`; logout does not `setState(emptyMissionState())`; login uses `router.replace` not full load. |
| **Likely files** | `src/lib/store.tsx` (hydrate + `onAuthStateChange`); `src/components/AppShell.tsx` signOut; `src/app/login/page.tsx` |
| **Proposed fix direction** | Smallest bounded repair (pick one, prefer 2+3): (1) reset MissionState + persist meta on logout; (2) on `SIGNED_IN`, re-hydrate when `session.user.id` ≠ last hydrated user (ignore `hydrateSucceeded`); (3) login/logout via `window.location` full load. Do **not** redesign RLS or the data layer. |
| **Explicit non-goals** | Service-role attacker tests; Capture unfreeze; new persistence architecture |
| **Regression test to add** | Two-account Playwright: logout B → login A without full reload must not paint B's project |
| **Target resolution / validation point** | **V1 MUST** before shared-browser / public use. Trusted testers on **separate browsers** do not hit this. |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md` §6 |
| **Notes** | **v0.9 classification: V1 MUST.** This is why live two-account isolation is **FAIL** on the display gate and **PASS** on server/API/RLS. Do not close D-013 merely because cache clear on logout works. |

---

### D-037 — Review Ready vs Apply reject for missing responsibility scope

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low (safety is correct; signalling is not) |
| **Domain** | Capture Review UX |
| **Found in** | v0.9 production smoke (Owen / Person bind) |
| **Failure class** | After the user binds a Person, Review can show Ready while the Apply gate still rejects because required responsibility scope is missing. Fail-closed is correct. UX readiness is inconsistent. |
| **Evidence / repro** | Bind Person in Review → Ready chrome → Apply refused for missing scope |
| **Proposed fix direction** | Align Ready with the Apply gate, or show why Apply will refuse. Do **not** unfreeze Capture logic to make Apply more lenient. |
| **Explicit non-goals** | Weakening Apply; Capture retune |
| **Target resolution / validation point** | **TESTER EVIDENCE** first; **V1 SHOULD** if frequent |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | **v0.9 classification: TESTER EVIDENCE / V1 SHOULD.** Safety behaviour stays. |

---

### D-038 — Todo deletion leaves mirrored Knowledge fact

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Knowledge Centre / Todos |
| **Found in** | v0.9 production smoke |
| **Failure class** | Structured Todo deletes correctly and stays deleted across reload. A Knowledge/fact representation with the same text can remain in Current Position / Waiting. Not Todo resurrection. |
| **Evidence / repro** | Delete a Todo → structured list empty after reload → Current position still shows the sentence |
| **Proposed fix direction** | When a domain Todo is deleted, retire the linked Knowledge projection by id (not fuzzy title). Distinct from D-030 (risks/dates presentation precedence, now closed). |
| **Explicit non-goals** | Fuzzy match; treating this as Todo persist failure |
| **Target resolution / validation point** | **V1 SHOULD** / **TESTER EVIDENCE** |
| **Related docs** | D-030 (closed presentation); `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | **v0.9 classification: V1 SHOULD.** |

---

### D-039 — `openaiConfigured` can stay false after login-page 401

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Capture chrome / hydrate |
| **Found in** | v0.9 production smoke |
| **Failure class** | `/api/capture` 401s on the login page (`MissionProvider` fetch). After login, `openaiConfigured` can remain false until hard refresh. Final smoke worked post-login / after refresh. |
| **Evidence / repro** | Hit `/login` while signed out (401 on capture probe) → log in without full remount → Analyse appears unavailable until refresh |
| **Likely files** | `src/lib/store.tsx` hydrate; Capture workspace config fetch |
| **Proposed fix direction** | Re-probe OpenAI/config after `SIGNED_IN` (same remount family as D-036). |
| **Explicit non-goals** | Capture engine change |
| **Target resolution / validation point** | **V1 SHOULD** (may ride with D-036 remount) |
| **Related docs** | D-036 |
| **Notes** | **v0.9 classification: V1 SHOULD.** |

---

### D-040 — New Project naming quality

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | New Project |
| **Found in** | v0.9 production smoke |
| **Failure class** | Awkward titles (“Parade Day Is”), verbose CREATE titles, clumsy phrasing. Product quality, not integrity. |
| **Proposed fix direction** | Do not elevate into architecture. Observe during alpha. Prompt/label polish only if testers complain. |
| **Explicit non-goals** | Capture unfreeze; New Project engine rewrite |
| **Target resolution / validation point** | **TESTER EVIDENCE** |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | **v0.9 classification: TESTER EVIDENCE.** |

---

### D-041 — No whole-account deletion

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium for public/commercial; not an alpha blocker |
| **Domain** | Auth / legal / settings |
| **Found in** | v0.9 closure audit (28 Aug 2026) |
| **Failure class** | No user-facing or API path deletes the whole account/workspace. Testers on trusted alpha can be cleaned by the owner. Paying public users need an exit. |
| **Evidence / repro** | Repo grep: no `deleteAccount` / account-delete flow. Settings do not offer it. |
| **Proposed fix direction** | Small settings action: delete workspace + auth user (or document owner process). Do not invent enterprise admin. |
| **Explicit non-goals** | Building this during closed alpha |
| **Target resolution / validation point** | **V1 MUST** before public/commercial launch |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | **v0.9 classification: V1 MUST.** |

---

### D-042 — No user/project export

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium for public/commercial |
| **Domain** | Settings / legal |
| **Found in** | v0.9 closure audit (28 Aug 2026) |
| **Failure class** | No export of a user's project truth. |
| **Evidence / repro** | Repo grep: no export workspace/project download path. |
| **Proposed fix direction** | JSON (or similar) dump of the authorised project bundle. Product/legal can choose MUST vs high SHOULD; treat as **V1 MUST** unless legal says otherwise. |
| **Explicit non-goals** | Generic ETL; portfolio export |
| **Target resolution / validation point** | **V1 MUST** (or high V1 SHOULD pending legal) |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | **v0.9 classification: V1 MUST.** |

---

### D-043 — Meeting Prep edits are memory-only

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | high if the UI is reachable and implies save; otherwise leftover chrome |
| **Domain** | Meetings |
| **Found in** | Persistence audit; verified on `main` 28 Aug 2026 |
| **Failure class** | `updateMeeting` in `src/lib/store.tsx` patches `MissionState` only. Hydrate reads durable meetings. User can believe a meeting edit saved when reload restores the previous row. |
| **Evidence / repro** | `updateMeeting` has no `persistMeeting` call. Leftover route `/meetings` is not a v0.9 mode. |
| **Proposed fix direction** | Persist the edit **or** disable/remove the misleading mutation. Do not create another meeting architecture. |
| **Explicit non-goals** | Meeting product rebuild |
| **Target resolution / validation point** | **V1 MUST** if users can reach the editor; otherwise hide `/meetings` with leftover chrome |
| **Related docs** | D-005; `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | **v0.9 classification: V1 MUST** (persist or remove). `/meetings` is leftover; still a lying-save if opened. |

---

### D-044 — Terms / Privacy not in production (trusted alpha only)

| Field | Value |
| --- | --- |
| **Status** | open (deliberately deferred for trusted closed alpha) |
| **Severity** | high for public/commercial; none for trusted alpha |
| **Domain** | Legal |
| **Found in** | v0.9 closure |
| **Failure class** | Formal Terms/Privacy framework is not current production. Legal Eagle PR #88 is **not** the v0.9 merge. |
| **Proposed fix direction** | Public/commercial V1 needs an appropriate legal/privacy launch, not this closure task. |
| **Explicit non-goals** | Treating #88 as live; writing legal copy in Known Discoveries |
| **Target resolution / validation point** | **V1 MUST** before public/commercial |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md` |
| **Notes** | **v0.9 classification: V1 MUST.** Not forgotten. |

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
| **Fix summary** | Exhaustive typed apply dispatcher (`src/lib/capture/apply`) with runtime validation. Each finding mutates only its legal domain or Needs you / no write. No generic Todo fallback. Project scope uses Capture entry context only when the finding is not uncertain. Durable IDs carried for Risk/Person/milestone; a supplied Risk ID that is not on the project does **not** title-fallback onto another Risk. Unassigned (`projectId: null`) Todos cannot be mutated from a project Capture. `kind` cannot be retargeted by a conflicting `legalDomain` sticker. Availability fields cannot retarget a typed Risk/Todo/milestone. Mapping `legalDomain: unsupported` (unknown op/entity) is honored before availability/responsibility refinements. People reuse `ensurePersonOnProject`. Responsibilities reuse Confirm Owner; a Person ID not on the project is Needs you. Unknown ownership semantics cannot be discarded into a Person write. Availability writes structured `kind=availability`. Milestone date moves persist; milestone *complete* is Needs you (D-029). CREATE against an existing on-project Todo/milestone ID, or an exact unique Risk title, is no-change rather than a duplicate. Local extract auto-ready updates/completions require the existing title and cue in the same sentence (no token-overlap auto-accept). Persist-first Capture paths for Risk create/status, milestone create/update, Person, availability. Tests in `scripts/verify-phase3b-capture-boundary.ts`. Resolves D-017; Capture portions of D-011 and D-020; duplicate-Person class of D-007. **Slice 1D:** a valid Person UUID is no longer sufficient identity (see D-R14). |

---

### D-R14 — Model-supplied Person UUID does not prove identity

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | Slice 1D — Person identity certainty safety invariant |
| **Failure class** | Capture V2 resolver trusted `candidateTargetId` as Person identity. Incomplete evidence such as a first-name fragment plus a valid existing UUID became Apply Ready (person / availability / responsibility). Phase 3B `resolvePerson` short-circuited on that UUID. |
| **Fix summary** | **Invariant:** a model-supplied Person UUID is evidence of model intent, not proof of identity. Primary gate: V2 `personLinkedIdentityGate` (expanded from `personCreateIdentityGate`). Person-linked writes require the Capture text to contain the recorded full name (`recordedPersonNameAppearsInText`). UUID cannot raise incomplete/competing evidence to Apply Ready. Same-name duplicates stay Needs you. Explicit new full names remain creatable. Secondary: Phase 3B `resolvePerson` refuses UUID-only binds. Not a first-name heuristic, not an Identity Engine, not benchmark-specific. Tests: `scripts/verify-person-identity-safety.ts` plus invariant properties. |

---

## Suggested fix order (non-binding)

This is **not** a licence to start V1 implementation from this closure PR. Capture stays frozen. Alpha learning comes first except D-036 if testers share a browser.

1. ~~**D-006**~~ — fixed in Phase 3A (D-R11)  
2. ~~**D-001 + D-002**~~ — fixed in Slice 1C  
3. ~~**D-019**~~ — fixed in Slice 2D (D-R10)  
4. ~~**Dead Capture merge path**~~ — deleted in Slice 1A  
5. ~~**D-032 Capture dual-engine / `LUME_CAPTURE_V2`**~~ — v0.9: V2 is the sole live engine  
6. ~~**D-033 Capture + Ask HTTP client-world**~~ — closed; Coach leftover API is ACCEPTED v0.9  
7. ~~**D-030 stale Risks/dates peer prose**~~ — presentation closed; remainder is D-038  
8. ~~**D-031 Coach auto-open**~~ — Coach unmounted  
9. **D-036** — session-switch remount (**V1 MUST**; smallest bounded repair in the v0.9 handoff)  
10. **D-041 / D-042 / D-044** — account delete, export, Terms/Privacy (**V1 MUST** for public launch)  
11. **D-043** — Meeting Prep persist **or** remove misleading edit (**V1 MUST** if reachable)  
12. **D-003** — suggestion persist if testers use suggestions  
13. **D-037 / D-038 / D-039** — Ready-vs-Apply, Knowledge remnant, openaiConfigured — **TESTER EVIDENCE** then V1 SHOULD  
14. **D-035 remainder** — persist-helper audit excluding the closed Todo sub-case  
15. **D-028** — bundle RPC (tech debt, not current delete-unsafe)  
16. **D-008 / D-021 / D-007 remainder / D-011 remainder** — data-model debt; do not start from alpha  
17. **D-004** — history persist — relevant if Project Change Intelligence reads History  
18. **D-027 / D-029 / D-034 version columns** — **DEFERRED** unless evidence changes  
19. **D-040** — New Project naming — tester evidence only  
20. **D-012, D-013, D-014, D-015, D-024, D-025, D-026** — ACCEPTED v0.9 / ops hygiene  

Do **not** treat this order as a mandate to broaden an in-flight slice. Do **not** reopen Capture. The next production-development decision should be an actual alpha blocker, recurring tester evidence, or the agreed V1 roadmap in `docs/LUME_V09_TO_V1_HANDOFF.md`.

---

## Maintenance rules

- Every V1 foundation PR that finds an adjacent defect must add or update an entry **before** merge.
- Do not delete resolved entries; move them to **Resolved discoveries**.
- Do not encode open discoveries as green tests; use `knownGap` until fixed.
- Prefer linking PRs and handover docs over duplicating long design prose here.
- Always set **Target resolution / validation point** using the vocabulary above (or mark ambiguous).
