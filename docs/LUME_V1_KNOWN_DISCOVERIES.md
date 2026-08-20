# Lume V1 — Known Discoveries Backlog

**Status:** Living document  
**Date started:** 19 August 2026  
**Last housekeeping:** 20 August 2026 (Slice 1D Ask context — D-009/D-018 fixed; D-010 partial on canonical)  
**Authority:** `docs/v1-reference-pack/` + project-truth architecture audit  

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
| **Notes** | Prefer sparse, high-signal events over logging everything. Not required to block People/Capture domain slices. |

---

### D-005 — Invisible / soft save failures

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | high |
| **Domain** | Infra / UX trust |
| **Found in** | Test safety net trust-critical gaps; store `console.error` + `setSaveStatus("error")` patterns |
| **Failure class** | Persist failures often only set soft save status / console error; user may believe Knowledge/Risk/Todo saved when DB write failed |
| **Evidence / repro** | Force persist error (network/RLS); observe UI continues with optimistic MissionState; reload loses change |
| **Likely files** | `src/lib/store.tsx` (all supabase `void (async…)` paths); save-status UI consumers |
| **Proposed fix direction** | Surface durable toast/banner on save error; consider optimistic rollback or “not saved” badge on affected frames |
| **Explicit non-goals** | Full offline sync engine |
| **Regression test to add** | Hard without UI; at least ensure error paths set `saveStatus` and do not claim success |
| **Target resolution / validation point** | V1 product hardening; must be checked before V1 launch (incremental per write path is OK) |
| **Related docs** | `docs/LUME_TEST_SAFETY_NET_AUDIT.md` §C.4 |
| **Notes** | Cross-cutting — fix incrementally when touching a write path; full UX polish belongs in V1 product hardening |

---

### D-006 — `persistNewProject` uses invalid risk `source: "setup"`

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium |
| **Domain** | Risks / New Project |
| **Found in** | Slice 1B inspection (Aug 2026) |
| **Failure class** | New project risk inserts use `source: "setup"` but DB check allows only `manual \| capture \| seed` → insert may fail at runtime |
| **Evidence / repro** | `src/lib/data/supabase/persist-mutations.ts` `persistNewProject` risk insert; compare `supabase/migrations/20260812002748_workspace_schema.sql` risks.source check |
| **Likely files** | `persist-mutations.ts` (`persistNewProject`); `src/types/database.ts` |
| **Proposed fix direction** | Change to `source: "manual"` (or extend enum via migration if product wants `setup` — prefer allowed value first) |
| **Explicit non-goals** | Risk UI redesign |
| **Regression test to add** | Static assert allowed source values; or new-project persist unit with mocked client |
| **Target resolution / validation point** | Fix at the next New Project/persistence touchpoint; must be resolved before V1 launch |
| **Related docs** | Slice 1B completion discoveries |
| **Notes** | Small one-line fix; do not wait for a dedicated Risks slice — fix opportunistically at the next New Project/persistence touch |

---

### D-007 — People split across stakeholders + Knowledge people + structured

| Field | Value |
| --- | --- |
| **Status** | open (partially addressed in Slice 1C) |
| **Severity** | medium (down from high after 1C foundation) |
| **Domain** | People |
| **Found in** | Architecture audit §3.2.2 |
| **Failure class** | Legacy/Capture People prose can still exist without a stakeholder link; Tell Me / KC may show unpromoted free-text people |
| **Evidence / repro** | Capture people bullets vs Confirm Owner structured responsibilities vs stakeholders picker |
| **Likely files** | Capture people apply; Knowledge Edit people section; `getPersonBundle` |
| **Proposed fix direction** | Promote known people prose to stakeholders when identity is explicit; keep legacy bullets as projection; richer People & Context UI later |
| **Explicit non-goals** | Portfolio org chart; Advise; Ocean redesign in foundation slices |
| **Regression test to add** | Capture→promote path once specified |
| **Target resolution / validation point** | Capture hardening (promotion) + richer People & Context UI later; identity/responsibility foundation delivered in Slice 1C |
| **Related docs** | `docs/SLICE1C_PEOPLE_ENTITIES_HANDOVER.md` |
| **Notes** | Slice 1C made stakeholders the durable identity authority and linked responsibilities via personId. Remaining gap is prose that never went through Confirm Owner. Not overdue — planned 1C foundation is done. |

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
| **Notes** | **Slice 1D validated/fixed on canonical path:** current-state MODE omits History evidence; historical/change questions retrieve scoped evidence. Production still defaults to legacy — residual risk remains until flag default changes. Do not remove legacy rollback yet. |

---

### D-011 — Demo-name regex extractors in write-adjacent paths

| Field | Value |
| --- | --- |
| **Status** | open |
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
| **Notes** | Adjacent to Capture interpretation — only touch when Capture slice allows |

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
| **Target resolution / validation point** | Capture hardening |
| **Related docs** | Architecture audit |
| **Notes** | Not blocking domain-authority slices |

---

### D-014 — Live Capture apply → Supabase round-trip not in CI

| Field | Value |
| --- | --- |
| **Status** | open (test gap) |
| **Severity** | medium |
| **Domain** | Capture / Infra |
| **Found in** | Test safety net; `verify-capture-trust-boundary.ts` knownGap |
| **Failure class** | Deterministic suite cannot prove Capture apply durability without credentials or a persistence fake |
| **Evidence / repro** | `knownGap("End-to-end Capture apply → Supabase round-trip")` |
| **Likely files** | `scripts/verify-capture-trust-boundary.ts`; `scripts/verify-phase2-persistence.ts` |
| **Proposed fix direction** | Persistence fake or CI secrets for live job; keep deterministic suite credential-free |
| **Explicit non-goals** | Weakening review-before-write |
| **Regression test to add** | Fake client apply round-trip OR separate live workflow |
| **Target resolution / validation point** | Capture hardening; must be checked before Capture is declared V1-ready |
| **Related docs** | `docs/LUME_TEST_SAFETY_NET_AUDIT.md` |
| **Notes** | Testing debt, not product ambiguity |

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

### D-017 — Capture risk-complete path: exact-title domain match (Slice 1B transitional)

| Field | Value |
| --- | --- |
| **Status** | open (validation required — not a silent product expansion) |
| **Severity** | medium (trust / architecture guardrail) |
| **Domain** | Capture / Risks |
| **Found in** | Slice 1B — `CaptureSessionContext.tsx` risk `op === "complete"` path |
| **Failure class** | Capture complete now routes genuine Risks via `findProjectRiskByExactTitle` → `setRiskStatus`, else Knowledge-only resolve. This must remain **identity carriage** (exact title ↔ domain row), not a growing semantic/fuzzy Risk interpreter |
| **Evidence / repro** | `src/components/capture/CaptureSessionContext.tsx` (risk complete branch); `src/lib/risks/lifecycle.ts` `findProjectRiskByExactTitle` (exact match only; no substring/fuzzy). Slice 1B intentionally removed prior fuzzy `includes(…slice(0, 24))` matching |
| **Likely files** | `src/components/capture/CaptureSessionContext.tsx`; `src/lib/risks/lifecycle.ts`; Capture review apply path |
| **Proposed fix direction** | During Capture hardening: prefer carrying stable `risks.id` through Capture review items when available; keep exact-title only as transitional fallback; **never** reintroduce fuzzy/NLP matching; assert recommendations are not auto-resolved as domain Risks |
| **Explicit non-goals** | Capture interpretation redesign; AI risk linking; expanding title heuristics |
| **Regression test to add** | Capture complete: (1) domain risk with exact title → status resolved by id; (2) near-miss title does **not** resolve domain risk; (3) no `risks` row → Knowledge-only path; (4) recommendation kind risk unchanged unless explicit convert |
| **Target resolution / validation point** | Validate during Capture hardening; must be checked before Capture is declared V1-ready |
| **Related docs** | `docs/SLICE1B_RISK_LIFECYCLE_AUTHORITY_HANDOVER.md`; `docs/LUME_V1_KNOWN_DISCOVERIES.md` D-003 (suggestions remain suggestions) |
| **Notes** | This entry is a **guardrail**, not permission to grow Capture NLP. Exact-title matching is transitional identity evidence until Capture review carries `riskId` end-to-end. |

---

### D-019 — Confirm Owner UI lacks explicit replace-vs-share choice

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium |
| **Domain** | People |
| **Found in** | Slice 1C |
| **Failure class** | API supports `replacePersonId` for time-varying ownership, but Confirm Owner dialog always ADDs/shares. Users cannot explicitly replace Bob with Mary from the current dialog |
| **Evidence / repro** | `ConfirmOwnerDialog.tsx` only passes personId + resolveTruthItemId; no replace control |
| **Likely files** | `src/components/intelligence/ConfirmOwnerDialog.tsx`; People & Context UI later |
| **Proposed fix direction** | When another current owner exists for the scope, offer Share vs Replace (Needs clarification) rather than silent replace |
| **Explicit non-goals** | Full People drawer redesign beyond the confirm flow |
| **Regression test to add** | UI/integration later; API already covered in `verify:people-entities` |
| **Target resolution / validation point** | Richer People & Context UI later; must be checked before V1 launch if Confirm Owner is a primary correction path |
| **Related docs** | `docs/SLICE1C_PEOPLE_ENTITIES_HANDOVER.md` |
| **Notes** | Default share (no silent overwrite) is intentional and safer than pre-1C supersede-all |

---

### D-020 — Dependencies / availability lack dedicated Ask domains

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | low |
| **Domain** | Ask/Tell Me · People · Knowledge |
| **Found in** | Slice 1D Ask context authority |
| **Failure class** | Ask can surface `kind=dependency` / `kind=availability` structured Knowledge rows when present, but there is no dedicated dependency graph or availability calendar domain. Gaps are easy to miss if only prose exists |
| **Evidence / repro** | Cross-domain person+risk fixture works when structured availability exists; no structured dependency inventory in MissionState beyond Knowledge kinds |
| **Likely files** | `src/lib/canonical-truth/serialize.ts`; future People/availability UI |
| **Proposed fix direction** | Keep exposing structured kinds; do not invent brittle prose heuristics. Add dedicated modelling only when product requires it |
| **Explicit non-goals** | Building a universal graph or calendar in Ask convergence |
| **Regression test to add** | Already covered lightly in `verify:ask-context-authority` when structured availability present |
| **Target resolution / validation point** | Richer People & Context UI / later domain modelling — not blocking Ask UI integration |
| **Related docs** | `docs/SLICE1D_ASK_CONTEXT_AUTHORITY_HANDOVER.md` |
| **Notes** | Documented rather than compensated with heuristics in 1D |

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
| **Notes** | 1D intentionally did not force a full dedupe redesign |

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

## Suggested fix order (non-binding)

1. **D-006** — next New Project/persistence touchpoint (before V1 launch)  
2. ~~**D-001 + D-002**~~ — fixed in Slice 1C  
3. **D-019** — Confirm Owner replace-vs-share UI (People UI later / before V1 launch)  
4. **D-007** remainder — Capture promote + People UI  
5. **D-017** — validate during Capture hardening (before Capture V1-ready)  
6. **D-003** — suggestion persist (V1 product hardening)  
7. **D-005** — save-error visibility (V1 product hardening, incremental OK)  
8. **D-004** — history persist gaps (V1 product hardening)  
9. ~~**D-009 / D-018**~~ — fixed in Slice 1D; **D-010** residual until canonical production default  
10. **D-008 / D-021**, **D-011–D-015**, **D-020** — as their domains are scheduled  

Do **not** treat this order as a mandate to broaden an in-flight slice.

---

## Maintenance rules

- Every V1 foundation PR that finds an adjacent defect must add or update an entry **before** merge.
- Do not delete resolved entries; move them to **Resolved discoveries**.
- Do not encode open discoveries as green tests; use `knownGap` until fixed.
- Prefer linking PRs and handover docs over duplicating long design prose here.
- Always set **Target resolution / validation point** using the vocabulary above (or mark ambiguous).
