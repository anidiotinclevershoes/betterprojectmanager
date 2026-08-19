# Lume V1 — Known Discoveries Backlog

**Status:** Living document  
**Date started:** 19 August 2026  
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
| **Related docs** | Audit / handover links |
| **Notes** | Edge cases, data cleanup, migration risk |
```

**IDs:** Use `D-001`, `D-002`, … sequentially. Do not reuse IDs after resolution.

---

## Open discoveries

### D-001 — Confirm Owner persists non-UUID `resp-*` ids

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | high |
| **Domain** | People / Knowledge |
| **Found in** | Architecture audit; Test safety net (Aug 2026); still open after Slice 1B |
| **Failure class** | Confirm Owner mints client ids like `resp-…` that are not UUIDs; Supabase `knowledge_items.id` expects UUID → persist can fail or leave structured overlay out of sync with DB |
| **Evidence / repro** | Confirm a scoped responsibility owner in UI; inspect `confirmResponsibilityOwner` output `itemId`; `isKnowledgeUuid("resp-…") === false`. Safety net: `knownGap("Confirm Owner persist must use UUID…")` in `scripts/verify-project-truth-safety.ts` |
| **Likely files** | `src/lib/canonical-truth/confirm-responsibility.ts`; `src/lib/store.tsx` (`confirmResponsibilityOwner`); `src/lib/data/supabase/persist-mutations.ts` (`persistKnowledgeBullet`) |
| **Proposed fix direction** | Mint UUID for new responsibility `knowledge_items` rows; keep supersession links on UUID ids; await/surface persist errors |
| **Explicit non-goals** | Full People/stakeholder consolidation; person relationship graph; Ocean UI redesign |
| **Regression test to add** | Retire knownGap; assert Confirm Owner insert uses UUID; reload retains confirmed owner |
| **Related docs** | `docs/LUME_V1_PROJECT_TRUTH_ARCHITECTURE_AUDIT.md` §3.1.5; `docs/LUME_TEST_SAFETY_NET_AUDIT.md` |
| **Notes** | Stakeholder table dual-write is also incomplete (see D-002) — may fix together in People slice |

---

### D-002 — Confirm Owner does not insert `stakeholders` row

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | high |
| **Domain** | People |
| **Found in** | Architecture audit §3.1.5 |
| **Failure class** | Confirm Owner updates in-memory stakeholders + knowledge people bullet, but does not insert into `stakeholders` table → reload may drop picker/list identity while knowledge prose remains |
| **Evidence / repro** | Confirm owner → soft refresh / rehydrate → stakeholder list missing person that still appears in Knowledge people |
| **Likely files** | `src/lib/canonical-truth/confirm-responsibility.ts`; `src/lib/store.tsx`; `src/lib/data/supabase/persist-mutations.ts`; stakeholders repository |
| **Proposed fix direction** | Single write API: ensure `stakeholders` row exists (create-or-get by project+name) when confirming; Knowledge/structured remain projection + epistemic overlay |
| **Explicit non-goals** | Full CRM; relationship edges; Advise |
| **Regression test to add** | Confirm Owner → simulated hydrate keeps stakeholder + structured responsibility |
| **Related docs** | Architecture audit People authority table; philosophy scoped ownership |
| **Notes** | Natural home: People entity/relationship slice after Risk authority |

---

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
| **Related docs** | Architecture audit §3.1; RiskFrame recommendation path (Slice 1B left this intentional) |
| **Notes** | Risk recommendations must remain suggestions until explicitly converted (Slice 1B product rule) |

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
| **Related docs** | Architecture audit; philosophy (History = evidence/chronology) |
| **Notes** | Prefer sparse, high-signal events over logging everything |

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
| **Related docs** | `docs/LUME_TEST_SAFETY_NET_AUDIT.md` §C.4 |
| **Notes** | Cross-cutting — fix incrementally per write path when touching that path |

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
| **Related docs** | Slice 1B completion discoveries |
| **Notes** | Small one-line fix; safe anytime |

---

### D-007 — People split across stakeholders + Knowledge people + structured

| Field | Value |
| --- | --- |
| **Status** | open (domain slice planned) |
| **Severity** | high |
| **Domain** | People |
| **Found in** | Architecture audit §3.2.2 |
| **Failure class** | Same person/role can exist in one, two, or three stores with asymmetric write coverage → Tell Me / KC / picker disagree |
| **Evidence / repro** | Create project stakeholders vs Capture people bullets vs Confirm Owner structured responsibilities |
| **Likely files** | `stakeholders` table; `knowledge.sections.people`; `structured` responsibilities; load-mission-state; Confirm Owner |
| **Proposed fix direction** | People entity authority slice: `stakeholders` (or equivalent) as identity home; Knowledge projects; structured holds scoped responsibility epistemic |
| **Explicit non-goals** | Portfolio org chart; Advise |
| **Regression test to add** | Project isolation + confirm owner + hydrate consistency |
| **Related docs** | Architecture audit recommended People authority; Slice 1B recommendation to proceed to People slice |
| **Notes** | Includes D-001/D-002 as first concrete fixes inside this domain |

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
| **Related docs** | Architecture audit |
| **Notes** | Do not fix opportunistically inside unrelated slices |

---

### D-009 — Canonical serialize can invent false “owner not recorded” gaps

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | high (trust) |
| **Domain** | Ask/Tell Me |
| **Found in** | Architecture audit §3.3.3; philosophy Helen/Omar example |
| **Failure class** | `findUnknownOwnerHints` may emit “owner is not recorded” for ownership questions without confirmed responsibility → poisons answers / invents known gaps |
| **Evidence / repro** | Ownership question when people exist but no structured responsibility; inspect serialize hints |
| **Likely files** | `src/lib/canonical-truth/serialize.ts` (~findUnknownOwnerHints) |
| **Proposed fix direction** | Only emit unknown-owner when question requires it **and** absence is evidenced; never invent false gaps |
| **Explicit non-goals** | Enabling canonical flag by default without eval proof |
| **Regression test to add** | Fixture: joint ownership / named people must not yield false known-gap |
| **Related docs** | Philosophy; Phase2C trust handovers |
| **Notes** | Trust-critical; fix under Ask/canonical workstream, not Risk/People persistence alone |

---

### D-010 — Legacy Ask path still injects History as competing truth

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | medium |
| **Domain** | Ask/Tell Me |
| **Found in** | Architecture audit §3.3.4 |
| **Failure class** | Legacy `buildCaptureContext` injects history into many prompts despite “History is evidence, not current truth” |
| **Evidence / repro** | Production default `LUME_CANONICAL_TRUTH` off; Ask with history-heavy project |
| **Likely files** | `src/lib/tell-me/context.ts`; Capture context builders |
| **Proposed fix direction** | Tighten history injection to historical questions only; prefer domain authority for current-state |
| **Explicit non-goals** | Deleting History feature |
| **Regression test to add** | Context-integrity: current-state question excludes superseded history as truth |
| **Related docs** | Philosophy; Phase2C2 context integrity |
| **Notes** | Canonical path already narrower — production flag still legacy |

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
| **Related docs** | Architecture audit |
| **Notes** | Ops hygiene |

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
| **Related docs** | `docs/SLICE1B_RISK_LIFECYCLE_AUTHORITY_HANDOVER.md` |
| **Notes** | New code paths avoid this; cleanup is ops/data |

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
| **Related docs** | `docs/SLICE1A_DURABLE_KNOWLEDGE_HANDOVER.md` |
| **Notes** | Prefer safe loss over incorrect metadata transfer — intentional |

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

## Suggested fix order (non-binding)

1. **D-006** — tiny schema-value bug (anytime)  
2. **D-001 + D-002 + D-007** — People / Confirm Owner domain slice  
3. **D-003** — suggestion persist (small, high user-visible ROI)  
4. **D-005** — save-error visibility (cross-cutting, incremental)  
5. **D-004** — history persist gaps  
6. **D-009 / D-010** — Ask trust / history injection (with canonical eval discipline)  
7. **D-008, D-011–D-015** — as their domains are scheduled  

Do **not** treat this order as a mandate to broaden an in-flight slice.

---

## Maintenance rules

- Every V1 foundation PR that finds an adjacent defect must add or update an entry **before** merge.
- Do not delete resolved entries; move them to **Resolved discoveries**.
- Do not encode open discoveries as green tests; use `knownGap` until fixed.
- Prefer linking PRs and handover docs over duplicating long design prose here.
