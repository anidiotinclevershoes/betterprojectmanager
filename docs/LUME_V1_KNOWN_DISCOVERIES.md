# Lume V1 — Known Discoveries Backlog

**Status:** Living document  
**Date started:** 19 August 2026  
**Last housekeeping:** 12 September 2026 (D-053 added from production long-run dogfood `lr-20260912T2212Z`; prior reconciliation: D-031/D-032 closed on current `main`)  
**Product/architecture constitution:** `docs/LUME_CONSTITUTION.md`  
**Product/trust/UI philosophy:** `docs/v1-reference-pack/`  
**Current implementation map:** the code on current `main`. The 26 Aug architecture memory handoff is historical.  
**Docs entry point:** `docs/README.md`  
**Integrity audit:** `docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md`  
**Current Capture position:** `docs/LUME_CAPTURE_STATUS.md` (534/538; Prompt A; Prompt E rejected)  

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

### D-050 — Hosted production schema is not the full migration reconstruction

| Field | Value |
| --- | --- |
| **Status** | open (hosted catch-up) |
| **Severity** | high (blocked external-V1 smoke) |
| **Domain** | Infra / Schema |
| **Found in** | External-V1 hosted New Project smoke (10 Sep 2026) |
| **Failure class** | Disposable Postgres applied every `supabase/migrations` file. Hosted production was built by pasting selected SQL Editor files over time. After `create_project_bundle` deployed, New Project failed: `column "kind" of relation "knowledge_items" does not exist`. The app did not treat the change as maintained truth. |
| **Evidence / repro** | Phase-1 `knowledge_items` has `section/body/position` only. Canonical `kind/epistemic/lifecycle/meta/provenance` are added by `20260818230000_knowledge_canonical_metadata.sql`. Current persist, Capture Apply, hydrate structured overlay, and New Project compose all write `kind` (responsibilities are `knowledge_items.kind = 'responsibility'`). The RPC is not inventing a stale column. |
| **Likely files** | `supabase/migrations/20260818230000_knowledge_canonical_metadata.sql`; later files such as `20260831160000_project_retrieval_tags.sql` may also be absent on hosted |
| **Fix summary** | Do not strip `kind` from `create_project_bundle`. Catch hosted schema up with additive `20260910120000_hosted_canonical_schema_catchup.sql` (replays canonical knowledge metadata + retrieval tag tables). Operator audit: `scripts/hosted-schema-audit.sql`. Contract: `scripts/verify-rpc-schema-contract.ts`. Real Postgres hosted-lag proof: `scripts/prove-hosted-schema-lag.ts`. |
| **Explicit non-goals** | A second New Project path; editing already-applied V1 SQL files in place |
| **Regression test to add** | `scripts/verify-rpc-schema-contract.ts` |
| **Target resolution / validation point** | Hosted audit shows required columns present; New Project smoke repeated |
| **Related docs** | `docs/V1_USER_ACTIONS.md`; `docs/SUPABASE_SETUP_FOR_TOM.md` (original SQL Editor only named the first three files) |
| **Notes** | Original Tom setup listed schema + RLS + grants only. Later slices each asked for one more paste. Hosted can therefore lag repo reconstruction without any migration file being wrong. **10 Sep Preview (PR #155):** hosted `POST /api/capture/apply` 500 — `Could not find the table 'public.capture_apply_receipts'`. Same hosted-lag class. The existing catch-up SQL does **not** create this table. Canonical create is `supabase/migrations/20260829120000_capture_apply_receipts.sql`. Operator must apply that file on hosted. Do not bypass receipts or weaken idempotency in application code. |

### D-051 — Hosted Capture telemetry could not prove provider/model; New Project shares extract then diverges

| Field | Value |
| --- | --- |
| **Status** | open (telemetry added; intelligence not retuned) |
| **Severity** | high (Preview dogfood: responsibilities became Needs You; Capture Review surprises) |
| **Domain** | Capture / New Project |
| **Found in** | Tom hosted Preview test 10 Sep 2026 22:07–22:09 UTC; diagnostic on visual-convergence branch |
| **Failure class** | `capture.v2_analysed` proved the live OpenAI extract path ran (`ignoredClientTruth: true`) but did not record provider, requested/response model, prompt id/version, path, or whether fallback occurred. New Project Organise uses the shared Capture extractor then a separate adapter (`parse` + `draftFromProvisional`) — not Capture resolve/plan. On the 22:07 mapper, explicit “is responsible for X” scope never reached `responsibilities[]`, so People showed names only and Needs You re-asked the same fact. |
| **Evidence / repro** | `scripts/verify-capture-intelligence-diagnostic.ts`. Hosted `POST /api/capture` at 22:09:36 completed ~11s with `capture.v2_analysed`. Local fallback is unreachable when `NODE_ENV=production`. Pronoun “She will own UAT” with Olga Petrov and Sarah Kim both named stays Needs You (ambiguous, or UUID guess refused because the reviewed statement is only “She…”). Milestone cancel/complete has no legal write. A model `create_new` for a moved date would mint a second milestone. |
| **Likely files** | `src/app/api/capture/route.ts`; `src/app/api/new-project/route.ts`; `src/lib/capture-v2/extract.ts`; `src/lib/capture-v2/resolve.ts`; `src/lib/new-project-v2/map.ts`; `src/lib/new-project/needs-you.ts` |
| **Proposed fix direction** | Do not retune prompts in this slice. Keep provenance logs. Observation-local identity evidence is now in production (sibling names no longer poison Andris). Remaining later hardening: decide whether cancelled dates are a legal remove; keep the planner catch that a pronoun statement cannot write via UUID. |
| **Explicit non-goals** | Prompt/model upgrade; weakening Apply receipts; a second New Project extractor |
| **Regression test to add** | `scripts/verify-capture-intelligence-diagnostic.ts`; hosted logs must include `requestedModel` / `responseModel` / `fallback` |
| **Target resolution / validation point** | Capture hardening after Preview re-inspection; do not treat this as a prompt rewrite licence |
| **Related docs** | Intelligence Contract; this file D-R14 (UUID is not identity); PR #155 Preview remediation |
| **Notes** | Cockpit metrics already stored model in development only (`NODE_ENV=development`). Vercel Preview is production runtime, so cockpit was silent. The 22:34 Preview mapper recovers statement-only “is responsible for” scope; that does not retune the model. **Identity evidence is now observation-local** (quoted `evidence` only; sibling names in the same Capture no longer poison Andris). Pronoun evidence that itself names two people still Needs You. Invented evidence that is not a quote from the Capture fails closed. Contradictory same-record sibling writes stay Needs You. |

### D-052 — New Project Organise silently drops schema-rejected observations

| Field | Value |
| --- | --- |
| **Status** | fixed |
| **Fixed in** | clean production integration from post-holdout reconstruct `#166` onto `cursor/capture-convergence-production-6709` |
| **Severity** | high |
| **Domain** | New Project / People |
| **Found in** | Hosted Preview on PR #155, 11 Sep 2026. Input: “bob is the ba” / “mike handles the legacy builds”. |
| **Failure class** | Shared extractor returned a structurally valid envelope (`observationCount: 2`, `envelopeMalformed: false`). `parseNewProjectV2Envelope` mapped only accepted VALIDATE rows, so rejected named people vanished from Organise. |
| **Evidence / repro** | `scripts/verify-np-organise-observation-loss.ts`. Remaining VALIDATE rejects: `missing_truth_intent`, `unknown_disposition`. |
| **Likely files** | `src/lib/new-project-v2/parse.ts` |
| **Fix summary** | Adapter recovers a usable person name from VALIDATE-rejected raw rows as a name-only Person. Does not invent responsibilities. Unscoped `create_new` + invented id is rematerialized as an accepted create by holdout VALIDATE (not adapter recovery). Capture scoped `foreign_id` fail-closed is unchanged for non-create updates. |
| **Explicit non-goals** | Prompt/model changes; Bob/Mike special cases; changing Capture `foreign_id` fail-closed on a scoped project; inventing responsibilities; merging the 538-case experiment corpus |
| **Regression test to add** | `scripts/verify-np-organise-observation-loss.ts` now asserts rematerialized or recovered names. |
| **Related docs** | D-051; People rules (name-only Person is complete); holdout `#164` |
| **Notes** | Holdout rematerializes unscoped `create_new` + invented candidate IDs as accepted creates. Adapter recovery remains for schema near-misses (`missing_truth_intent`, `unknown_disposition`). |

### D-053 — Production long-run: wrong-target Ready Apply + empty-Review omission

| Field | Value |
| --- | --- |
| **Status** | open |
| **Severity** | critical (wrong-target write) / high (silent empty Review; responsibility vacuum) |
| **Domain** | Capture / Apply / Identity / Persistence |
| **Found in** | Production long-run dogfood `lr-20260912T2212Z` on `origin/main` `9f24a65`; official project `8537b7cf-1b50-453e-af64-2b21e2d29e90`. No product-code change in that programme. |
| **Failure class** | After a clear create was false-Needs-You (C5 timber-floor risk never written), a later “that risk is resolved; the other stays open” Capture Ready-applied **Outstanding DDA access ramp detail** `open→resolved`. Later/heavier Captures often produced an empty Review (not Needs You). Organise + ownership Captures left `knowledge_items.kind = 'responsibility'` at **0**. Updates of existing State 0 rows wrote `history_events` but no `capture_apply_receipts`. |
| **Evidence / repro** | `e2e-hosted-longrun/baselines/first-complete-run/FIRST-RUN.md`; C18 Review proposed only the DDA resolve; SQL confirms `risks.fb74aa0f-…` `updated_at` 22:07:36Z `resolved`, no timber-floor row, no receipt on that update. Isolation: only this E2E project moved in the run window. |
| **Likely files** | `src/lib/capture` validate/resolve/apply; Review Ready path; New Project Organise responsibility map; `capture_apply_receipts` write sites |
| **Proposed fix direction** | Rematerialize unmatched creates. Do not Ready-apply a *different* same-kind entity when the intended target was never created or when a sibling says another risk remains open. Persist responsibilities. Surface Needs You / unsupported instead of empty Review. Receipt updates of existing rows. |
| **Explicit non-goals** | Rewriting the frozen long-run manifest to match Lume; SQL repair of the dogfood project; prompt retune as the first move |
| **Regression test to add** | Keep `e2e:hosted-longrun` opt-in. Do not encode the C18 wrong write as a passing unit. A later unit should refuse Ready on unresolved same-kind ambiguity after a missing create. |
| **Target resolution / validation point** | Capture hardening / before V1 launch |
| **Related docs** | D-008; D-013; D-025; D-029; D-030; D-051; `e2e-hosted-longrun/ATTACK-MATRIX.md` |
| **Notes** | First-run frozen expectations were not rewritten. Dedicated E2E project left in place. Independent SQL on production Lume `exfftrxxinhduogcluce` matches the harness final snapshot. |

### D-028 — Project delete is sequential, not a single database transaction

| Field | Value |
| --- | --- |
| **Status** | closed |
| **Severity** | — |
| **Domain** | Infra / Projects |
| **Found in** | Phase 3A.1 Safe Project Deletion (Aug 2026) |
| **Failure class** | User-facing delete used to remove SET NULL children then the project row in separate round-trips. Create used a sequence of inserts. |
| **Evidence / repro** | Fake client `failOnDeleteTable: "projects"` rolls back the whole delete via `delete_project_bundle`. Fake `failOnTable: "todos"` rolls back the whole create via `create_project_bundle`. |
| **Likely files** | `src/lib/data/supabase/persist-mutations.ts`; `supabase/migrations/20260909160000_external_v1_safety.sql`; `supabase/migrations/20260909210000_create_project_bundle.sql` |
| **Fix summary** | Delete is one Postgres transaction (`delete_project_bundle`). Create is one Postgres transaction (`create_project_bundle`). `persistNewProject` is a thin caller of that RPC. History remains secondary after success. Retry inspects `clientProjectId`. Failed leftover partials still clean up through `delete_project_bundle`. |
| **Explicit non-goals** | A second onboarding-only create path; folding History into the create transaction |
| **Regression test to add** | `scripts/verify-project-delete.ts` — mid-create failure leaves no partial bundle; retry with the same client id does not duplicate |
| **Target resolution / validation point** | Closed on `release/v1-external-readiness` |
| **Related docs** | This file; adversarial A-003; `docs/V1_USER_ACTIONS.md` |
| **Notes** | SET NULL-first remains required inside the delete transaction so a successful project delete cannot leave workspace orphans. History is evidence, not part of the canonical create bundle. |

### D-041 — Account deletion

| Field | Value |
| --- | --- |
| **Status** | closed (individual-first V1) |
| **Fixed in** | `release/v1-external-readiness` |
| **Failure class** | No whole-account delete existed. |
| **Fix summary** | Signed-in POST `/api/account/delete` requires exact `DELETE MY ACCOUNT`. Server-authoritative. Does not create a workspace. Refuses other members / extra workspaces (409). Deletes the workspace (cascade) then the Auth user, then signs out. Service-role key required. Multi-member workspaces are a support path, not silent data deletion. |

### D-042 — Account / data export

| Field | Value |
| --- | --- |
| **Status** | closed (individual-first V1 JSON export) |
| **Fixed in** | `release/v1-external-readiness` |
| **Failure class** | No user export existed. |
| **Fix summary** | Authenticated GET `/api/account/export` re-projects `loadMissionStateFromSupabase` (the same canonical workspace the user can already see). JSON attachment. No service tokens. Legal may still require a lawyer-reviewed privacy notice (D-044). |

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
| **Notes** | Not blocking domain-authority slices. **Phase 3A.1:** durable `capture_sessions` / `coach_sessions` rows for a deleted project are removed with the SET NULL bundle, and matching browser Capture/Coach lists plus the active Capture draft are pruned so they cannot attach to the next project. **Phase 3B validated:** starting New Capture can still retain previous transcript text. That is session honesty, not an apply-domain fallthrough. 3B did not redesign session start. **Dogfood gate D-047:** browser session is now keyed per project and Apply refuses a mismatch. Durable Supabase `capture_sessions` as session authority remains Phase 3D. |

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
| **Status** | closed |
| **Severity** | low |
| **Domain** | Ocean / Coach |
| **Found in** | Phase 3B visual pass (25 Aug 2026) |
| **Failure class** | On project load the Coach dialog overlaid Capture and KC, including the Capture Analyse control. |
| **Evidence / repro** | `AppShell` does not mount `CoachDrawer`. `openCoachDrawer` remains as a leftover export. Verified on `91fabf8` (12 Sep 2026 documentation reconciliation). |
| **Fix summary** | Coach drawer unmounted from the product shell. Auto-open cannot occur. Coach is not a V1 mode. |
| **Explicit non-goals** | Coach product revival; deleting leftover Coach API / files |
| **Related docs** | v0.9 handoff §4; D-033 remainder (Coach HTTP still accepts client MissionState) |
| **Notes** | Closed as a product-surface defect. Leftover `/api/coach` client-truth path is D-033 remainder, not this overlay. |

---

### D-032 — Dual Capture / New Project pipelines while experimental flags are on

| Field | Value |
| --- | --- |
| **Status** | closed |
| **Severity** | medium |
| **Domain** | Capture / New Project |
| **Found in** | Experimental Programme (25 Aug 2026) |
| **Failure class** | Dual live OpenAI understanding engines (legacy findings vs Capture V2; Talk assemble vs New Project V2) would reintroduce matching/heuristic drift. |
| **Evidence / repro** | `isCaptureV2Enabled()` always returns true. `POST /api/capture` always calls `postCaptureV2`. `POST /api/new-project` always uses shared Capture extract + New Project adapter. `isNewProjectV2Enabled` is a leftover helper and is not consulted by the live routes. Verified on `91fabf8`. |
| **Fix summary** | Capture V2 is the sole live Analyse engine. New Project Organise is the shared extractor plus adapter. Legacy findings library may still exist in-repo; it is not the HTTP path. |
| **Explicit non-goals** | Deleting leftover findings files or the unused NP V2 flag in this documentation slice |
| **Related docs** | `docs/LUME_CAPTURE_STATUS.md`; D-011 remainder (NP regex leftovers) |
| **Notes** | Closed as a live dual-engine defect. Leftover library code is cleanup, not a second production engine. |

---

### D-033 — AI decision routes accept browser-supplied MissionState as current truth

| Field | Value |
| --- | --- |
| **Status** | remainder only — Coach / leftover client-truth path. Capture and Ask are closed. |
| **Severity** | medium (Coach is hidden; not a live product mode) |
| **Domain** | Coach leftover |
| **Found in** | V1 Architectural Convergence (26 Aug 2026) |
| **Failure class** | Hidden `/api/coach` still treats client-posted `MissionState` as the project truth the model sees. Harm if Coach returns: stale/forged own-session context and a second “truth” besides durable tables. |
| **Evidence / repro** | **Closed:** Ask (`/api/tell-me`) and Capture Analyse/Apply load server truth and ignore leftover `body.state`. **Still open:** `src/app/api/coach/route.ts` still requires `body.state` and passes it to `streamPmCoaching`. Verified on `91fabf8`. |
| **Likely files** | `src/app/api/coach/route.ts` |
| **Proposed fix direction** | If Coach returns, use the Tell Me / Capture server-load pattern. Do not treat this as a Capture unfreeze. |
| **Explicit non-goals** | Rebuilding Coach; claiming this as an RLS/IDOR repair |
| **Regression test to add** | Already present for Capture / Tell Me. Coach coverage only if Coach returns. |
| **Target resolution / validation point** | If Coach returns as a product surface — not ordinary Capture work |
| **Related docs** | D-031 (drawer closed); v0.9 handoff §4 |
| **Notes** | Project scoping remains application-layer because RLS is workspace membership. Do not file this remainder as “Capture still accepts client truth.” |

---

### D-034 — Capture apply validates against client world; no durable row versioning

| Field | Value |
| --- | --- |
| **Status** | partial — Capture V2 Apply reloads fresh durable truth and compares an Analyse-time target fingerprint (Slice 1C). No schema `version` column. |
| **Severity** | medium |
| **Domain** | Capture · Infra |
| **Found in** | V1 Architectural Convergence (26 Aug 2026) |
| **Failure class** | `updated_at` triggers exist but persist helpers update by id only. Concurrent tabs / stale apply review can write against a world that is no longer durable truth if the client world is trusted. |
| **Evidence / repro** | **Capture V2 Apply (Slice 1C):** `POST /api/capture/apply` reloads via `loadServerCaptureWorld`, compares `expectedTarget` (id + material fields: title/status/startAt/name/done) captured at Analyse, then `planCaptureApply` / `executeCaptureApply` on that fresh world. Deleted / materially changed / foreign targets fail closed (Needs you). No MissionState is posted on Apply. **Remaining:** no integer `version` column; fingerprint is not a universal concurrency contract; legacy Capture apply (flag off) still plans against client `MissionState`. |
| **Likely files** | `src/lib/capture/apply/apply-approved.ts`; `src/lib/capture/apply/expected-target.ts`; `src/app/api/capture/apply/route.ts` |
| **Proposed fix direction** | Keep fingerprint + fresh load for Capture. Add integer `version` on hot tables only if a later integrity slice proves fingerprints insufficient. Not a new mutation framework. |
| **Explicit non-goals** | App-wide command bus; making Phase 3B own Knowledge Centre / New Project / delete; treating this as the project-membership invariant (that is **D-035**) |
| **Regression test to add** | `scripts/verify-capture-server-truth.ts` cases D/E (changed / deleted between Analyse and Apply). |
| **Target resolution / validation point** | Schema versioning only if fingerprints fail in production — not mixed into this slice |
| **Related docs** | Handoff Part C §C5–C6; D-005; D-R13; D-035 |
| **Notes** | Phase 3B remains the Capture mutation boundary. Slice 1C did **not** add DB versioning. Dogfood gate D-046 closed the dueAt/detail/notes/endAt/replace-pin fingerprint gap. Remaining: no integer `version` column (accepted until fingerprints fail in production). |

---

### D-035 — Project-domain mutations must verify intended project membership

| Field | Value |
| --- | --- |
| **Status** | partial — Capture V2 Analyse/Apply enforce project membership of mutation targets (Slice 1C). Persist-helper audit still open. |
| **Severity** | high |
| **Domain** | Infra / all project-domain writes |
| **Found in** | V1 Architectural Convergence; Thor amendment (26 Aug 2026) |
| **Failure class** | **Invariant:** every project-domain mutation must verify that the target durable object belongs to the intended project before mutation. Workspace RLS is membership-wide, so an id-only UPDATE/DELETE can mutate another project’s row in the same workspace. `persistTodoUpdate` / `persistTodoDelete` (`.eq("id", todoId)` with no `project_id`) are **one known instance**, not the whole class. |
| **Evidence / repro** | **Capture V2 (Slice 1C):** server world is filtered to the requested project; validator rejects foreign IDs (Person, Risk, Todo, milestone); Apply stale-check + Phase 3B `require*OnProject` refuse Toyworld/GamingStudio5000 IDs inside a Candyland Capture. **Todo instance closed (audit 6 Sep 2026):** `persistTodoUpdate` / `persistTodoDelete` now go through `scopeExistingTodo` (`id` + `workspace_id` + `project_id` or `project_id IS NULL`). **Still open:** equivalent helpers must still be audited: knowledge_items, some stakeholder/memory/recommendation/history/session writes. Risks status helper is already project+workspace scoped. |
| **Likely files** | `src/lib/data/supabase/persist-mutations.ts`; Capture apply hooks; store mutations; workspace project routes |
| **Proposed fix direction** | Treat the quoted invariant as a persist-layer rule. Later implementation/test pass: inventory every project-domain mutation; require intended `project_id` (and workspace) on the target row before write. |
| **Explicit non-goals** | A generic mutation framework; conflating this with D-034 versioning; calling this an RLS/IDOR tenant bug |
| **Regression test to add** | Capture V2: `scripts/verify-capture-server-truth.ts` isolation + foreign-ID cases. Persist-helper property tests remain a later pass. |
| **Target resolution / validation point** | Later persist-helper audit — after Capture V2 server truth, not a schema migration in this slice |
| **Related docs** | Handoff Part C §C5 gap 5, §C6, assumption 23; D-034 (separate: apply world / version) |
| **Notes** | Application-layer project scoping on Capture V2 is now live. The remaining defect class is **inconsistent persist-helper enforcement**. Do not document or fix this as Todo-only. Adversarial audit N-02: do not keep citing todo update-by-id-only as current. |

---

## Resolved discoveries (reference)

Move items here when fixed. Keep enough detail that regressions are recognizable.

### D-R45 — Apply refreshes paint cache from confirmed reload (N-10)

| Field | Value |
| --- | --- |
| **Status** | CLOSED / VERIFIED |
| **Fixed in** | Family 1 Apply authoritative first paint — `cursor/apply-authoritative-first-paint-2024` |
| **Failure class** | `update_milestone` wrote `milestones.start_on` and Apply `reloadWorkspace` returned 20 Sep, but `adoptAppliedState` did not write `lume-mission-supabase-cache-v1`. Hard reload painted create-time 12 Sep until hydrate. `projects.next_milestone_on` stayed 12 Sep as a contradictory denormalized pointer. |
| **Fix summary** | Confirmed Apply reload is written to the paint cache (`writeConfirmedAppliedWorkspaceCache`). `persistTimelineUpdate` rederives `projects.next_milestone` / `next_milestone_on` when that pointer names the updated milestone. Cache is not a source of truth; it only mirrors confirmed reload. |
| **Evidence** | Hosted trace `hv-trace-20260911T201500Z`; `scripts/verify-apply-authoritative-first-paint.ts`; inverted adversarial N-10. |
| **Residual** | Failed Apply reload (`reconcileFailed`) still asks the client to hydrate. History persist remains best-effort. |
| **Related docs** | `docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md` N-10 |

### D-R44 — Hydrate no longer truncates Knowledge section lists (D-049)

| Field | Value |
| --- | --- |
| **Status** | CLOSED / VERIFIED |
| **Fixed in** | D-049 hydrate completeness — `cursor/d049-hydrate-completeness-b296` |
| **Failure class** | `loadMissionStateFromSupabase` loaded every `knowledge_items` row, then folded `sections` / `sectionItemIds` with `.slice(0, 24)` while `structured` stayed uncapped. Knowledge Centre Correct built the desired write-set from the truncated section list. `persistKnowledgeReconcile` loaded the full DB section and deleted unmatched ids, so facts 25+ could be destroyed by correcting a visible line. |
| **Fix summary** | Authoritative hydrate keeps every canonical section body and its matching `sectionItemIds` entry. Structured overlay remains complete. Capture/Ask/briefing ranking limits stay at those presentation/prompt layers. |
| **Evidence** | `scripts/verify-d049-hydrate-completeness.ts` — 30 now facts, 30 decisions, 30 open loops persist, hydrate, Correct, and rehydrate without loss. Risks-table overlay no longer re-slices section lists at 24. N-03 inverted. |
| **Residual** | Capture context and Catch Me Up briefings still rank a subset (honest `limitsReached` / snapshot slices). Local `store` availability and `confirmResponsibilityOwner` still `.slice(0, 24)` the in-memory people section; persist is insert/bundle, not reconcile-from-truncated-list. |
| **Related docs** | `docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md` N-03 |

### D-R40 — Apply reload failure no longer returns pre-write state (D-045)

| Field | Value |
| --- | --- |
| **Status** | CLOSED / VERIFIED |
| **Fixed in** | Dogfood integrity gate (6 Sep 2026) — `cursor/dogfood-integrity-gate-cedc` |
| **Failure class** | After a successful write, a failed `reloadWorkspace` returned the pre-write MissionState. The client could revert the UI; retrying an unreceipted write could duplicate. |
| **Fix summary** | Production Apply omits `state` and sets `reconcileFailed` after write+reload failure. Client hydrates via `GET /api/workspace/state` or asks for refresh. Never adopts the old snapshot. |
| **Evidence** | Inverted A-001; `npm run verify:dogfood-integrity-gate` D-045. |
| **Residual** | Honest UI lag until hydrate when reload fails (`reconcileFailed`); History persist still best-effort. |
| **Related docs** | `docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md` |

---

### D-R41 — Apply fingerprint includes fields Apply writes (D-046)

| Field | Value |
| --- | --- |
| **Status** | CLOSED / VERIFIED |
| **Fixed in** | Dogfood integrity gate (6 Sep 2026) |
| **Failure class** | Ready stayed Ready while a concurrent To Do due date / detail (or milestone notes / end) had changed. Apply could overwrite that concurrent edit. |
| **Fix summary** | World + fingerprint + stale check include todo `dueAt`/`detail`, milestone `endAt`/`notes`, and responsibility replace pin + owner set. |
| **Evidence** | Inverted A-002 / A-004 / N-07; dogfood D-046 probes. |
| **Residual** | No integer row `version` (D-034 remainder). Apply does not re-bind replace pins (Review-only). |
| **Related docs** | `docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md`; D-034 |

---

### D-R42 — Capture session binds to the open project (D-047)

| Field | Value |
| --- | --- |
| **Status** | CLOSED / VERIFIED |
| **Fixed in** | Dogfood integrity gate (6 Sep 2026) |
| **Failure class** | One global `lume-capture-session-v1` key. Project A Review could remain visible after opening project B; a rebound create could write B. |
| **Fix summary** | Session key is per project. Open-project change parks/loads the matching slice. Apply refuses a session/project mismatch. |
| **Evidence** | Inverted A-008 / N-06; dogfood D-047. |
| **Residual** | Browser sessionStorage remains session authority (D-013). |
| **Related docs** | `docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md`; D-036 (account switch, already closed) |

---

### D-R43 — Knowledge / availability / person Apply is receipted (D-048)

| Field | Value |
| --- | --- |
| **Status** | CLOSED / VERIFIED |
| **Fixed in** | Dogfood integrity gate (6 Sep 2026) |
| **Failure class** | Knowledge, availability, and some person/responsibility writes had no `applyOperationId`. Retry after a dropped response created a second row. Memory execute no-op’d knowledge, hiding the hole. |
| **Fix summary** | Same `capture_apply_receipts` table. Planners set `applyOperationId`. Persist and memory execute consult the receipt. Memory execute now writes knowledge. |
| **Evidence** | Inverted A-005 / N-05; dogfood D-048 double-Apply; D-045+D-048 reload-fail then retry. |
| **Residual** | Non-risk knowledge insert + receipt are sequential, not one RPC. |
| **Related docs** | `docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md`; D-045 |

---

### D-R36 — Same-browser SPA logout → login displayed previous user's in-memory workspace (D-036)

| Field | Value |
| --- | --- |
| **Status** | CLOSED |
| **Fixed in** | PR #100 / production `0e68384a2271b2b27e0ac75b871ee26331a26db7` (28 August 2026) |
| **Failure class** | After Sign out → SPA login as a different user without remounting `MissionProvider`, the UI could paint the previous user's project while chrome showed the new user. Authenticated APIs failed-closed. Not RLS/IDOR. |
| **Fix summary** | Option C: `missionAuthTransition` resets MissionState on `SIGNED_OUT` and on authenticated `user.id` change, then rehydrates; login/logout/signup use `window.location.assign`; durable cache is not painted unless it matches the hydrated user. |
| **Evidence** | Regression `scripts/verify-d036-session-switch.ts`; CI green on PR #100; live production B→A and A→B same-browser session-switch (no previous-user project truth; `/api/workspace/state` tenant-only; Ask/Catch Me Up foreign project 404; foreign DELETE 404). Loading/reset during the switch is correct. |
| **Related docs** | `docs/LUME_V09_TO_V1_HANDOFF.md` |

---

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

1. ~~**D-006**~~ — fixed in Phase 3A (D-R11)  
2. ~~**D-001 + D-002**~~ — fixed in Slice 1C  
3. ~~**D-019**~~ — fixed in Slice 2D (D-R10)  
4. ~~**Dead Capture merge path**~~ — unmounted `CaptureBar` / `captureWithAI` / `applyCaptureResult` **deleted in Slice 1A**  
5. **D-033 remainder** — Coach leftover client MissionState only (Capture / Ask closed)  
6. **D-010** — canonical production default after eval evidence  
7. ~~**D-032**~~ — Capture V2 is the sole live engine; New Project uses the shared extractor + adapter  
8. ~~**D-045 + D-046 + D-047 + D-048**~~ — closed in the dogfood integrity gate (D-R40–D-R43)  
9. **D-034 remainder** — fingerprints now cover dueAt/detail/notes/endAt/replace pin; schema `version` columns only if that still fails in production  
10. ~~**D-035 remainder**~~ — history/session/memory/todo create now prove the project is in the workspace; Capture membership already live  
11. ~~**D-028**~~ — `create_project_bundle` + `delete_project_bundle`  
12. **D-003** — suggestion persist  
13. **D-008 / D-021** — implement the decided waiting/open-loop split  
14. **D-007** remainder — leftover Knowledge people prose without a stakeholder link  
15. **Person identity** — workspace `people` + participation (later; not first slice). **No unique-name constraint.**  
16. **D-014** remainder — live Supabase Capture apply job  
17. **D-011** remainder — New Project extractors only  
18. **D-004** remainder — history persist gaps outside New Project create  
19. **D-026** — product decision on project-code uniqueness  
20. **D-027** — Archive/undo only if product asks  
21. **D-012–D-015**, **D-020** Ask remainder, **D-024**, **D-029**, **D-030** — as scheduled. ~~D-031~~ closed (Coach unmounted).  

Do **not** treat this order as a mandate to broaden an in-flight slice. Do **not** begin implementation from the architecture review PR.

---

## Future hardening backlog (do not implement from this list in passing)

Canonical categories for the later large hardening pass. Details live in the audit “Still open” section.

### BEFORE EXTERNAL USERS

- ~~D-028 / A-003~~ — `create_project_bundle` + `delete_project_bundle`
- **D-050** — hosted schema must catch up to full migrations (`knowledge_items.kind` missing on production)
- ~~N-09~~ — RLS `project_belongs_to_workspace` on recommendations / history / capture_sessions
- ~~D-035 remainder (named write helpers)~~ — `requireProjectInWorkspace` on history/session/memory/todo/stakeholder/knowledge/timeline creates
- ~~D-041 / D-042~~ — Account delete + JSON export (individual-first)
- Read-only integrity observer for operators (scanner + SQL already exist; classified ACCEPTED BOUNDED V1 LIMITATION)
- D-044 lawyer Privacy/Terms — Tom / legal, not invented in code
- D-033 remainder — hidden `/api/coach` must not treat client MissionState as truth if Coach returns. Not a Capture defect.

### HARDEN DURING V1

- ~~D-049 / N-03 — one Knowledge cap (8 vs 24 vs unlimited) instead of silent hydrate truncation~~ **Closed as D-R44.** Hydrate is complete. Capture ranked-12 and Catch Me Up snapshot-6 remain presentation/prompt bounds.
- N-04 / D-024 — durable analyses/usage meter
- ~~N-10 — write paint cache after confirmed Apply~~ **Closed as D-R45.** `adoptAppliedState` writes confirmed Apply reload into the paint cache; `persistTimelineUpdate` rederives `projects.next_milestone_on` when that pointer names the updated row.
- N-08 — `source_recommendation_id` if product still wants the link
- N-13 — `supersedes_id` same-project check
- Date-only hydrate normalisation (`T12:00:00.000Z`)
- N-12 — Apply API Review attestation, or keep documenting the asymmetry
- A-006 — orphan-todo NOT NULL or periodic cleanup

### DATABASE / INVARIANT STRENGTHENING

- Knowledge/availability receipt in the same transaction as the insert (D-048 residual)
- Semantic uniqueness only after a product decision (A-007)
- `item_tags.target_id` FK

### OBSERVABILITY / RECOVERY

- User-visible project-truth health (hydrate currently paints orphans / missing people)
- History persist-skip visibility (D-004)

### PRODUCT / MODEL DECISIONS

- D-008 / D-021 — waiting vs open-loop split (authority decided, not implemented)
- People uniqueness / workspace-level people
- D-027 — archive / undo after project delete
- Whether 8 or 24 is the Knowledge section law
- Whether Capture may legally Apply without the user having seen Review (API clients)

---

## Maintenance rules

- Every V1 foundation PR that finds an adjacent defect must add or update an entry **before** merge.
- Do not delete resolved entries; move them to **Resolved discoveries**.
- Do not encode open discoveries as green tests; use `knownGap` until fixed.
- Prefer linking PRs and handover docs over duplicating long design prose here.
- Always set **Target resolution / validation point** using the vocabulary above (or mark ambiguous).
