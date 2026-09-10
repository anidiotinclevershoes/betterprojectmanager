# Lume — Adversarial architecture & data-integrity audit

**Status:** Durable engineering asset. Original audit of `main` at `f737f8a88442bff9e850d91de55c9afd82cda630`; remediations for D-045–D-048 closed and regression-proven on `cursor/dogfood-integrity-gate-cedc`.  
**Dates:** Audit 6 September 2026; remediations 6 September 2026  
**Mode:** findings + remediations. This file is **not** a second architecture map. If it and the code disagree later, **the code wins**.

Probes (non-mutating by default):

- `npm run verify:adversarial-integrity` — 25 in-memory / source probes + printed SQL (operator-only; do not run as a migration)
- `npm run verify:dogfood-integrity-gate` — 9 production-path regressions for D-045–D-048
- `scanMissionIntegrity()` in `scripts/verify-adversarial-integrity.ts` — read-only in-memory scanner

SQL probes in that script were **not** executed against user data in this programme. Do not wire a production integrity daemon from this file.

---

# Closed by this programme (D-045–D-048)

These were the four dogfood blockers. They stay in the findings table as **CLOSED / VERIFIED**. Do not delete the original evidence.

### D-045 / A-001 — Apply reload / reconciliation — CLOSED / VERIFIED

| Field | Value |
| --- | --- |
| **Fix architecture** | After `executed.kind === "wrote"`, production Apply returns reloaded workspace state only. If `reloadWorkspace` throws and persist hooks are present, return `{ executed, reconcileFailed: true }` and **omit `state`**. Never return the pre-write snapshot as success. |
| **Enforcement** | `applyApprovedCaptureSuggestion`; HTTP `/api/capture/apply` exposes `reconcileFailed`; client `applyOne` adopts `data.state` only when present; on write + reconcileFailed it calls `reconcileDurableWorkspace()` (`GET /api/workspace/state`). If that fails, it announces save + refresh. Memory path without hooks may still return `box.state`. |
| **Production regression** | `verify-adversarial-integrity` A-001; `verify-dogfood-integrity-gate` D-045 (receipted create + knowledge retry). |
| **Residual** | The write is not rolled back. A failed reload can leave the UI briefly behind the database until hydrate/refresh. History persist remains best-effort after the write. Paint cache is still not written by `adoptAppliedState` (N-10). |

### D-046 / A-002 / A-004 / N-07 fingerprint — CLOSED / VERIFIED

| Field | Value |
| --- | --- |
| **Fix architecture** | Apply world todos include `dueAt` / `detail`; timeline includes `endAt` (notes already present). Fingerprint and stale check compare those fields, plus responsibility `replacePersonId` + sorted current owner set + availability key. |
| **Enforcement** | `captureApplyWorldFromState`, `fingerprintExpectedTarget`, `staleExpectedTargetReason`. Apply still does **not** re-bind `replacePersonId` (Review-only by design). |
| **Production regression** | A-002 / A-004 / N-07 inverted; dogfood probes for dueAt, detail, milestone notes/endAt, replacement owner set. |
| **Residual** | No integer row-version column (D-034 remainder, accepted). Fingerprint is still field-complete only for fields the planner writes today. Two tabs can still last-write-win on unfingerprinted Ocean UI edits. |

### D-047 / A-008 / N-06 — Capture project / session binding — CLOSED / VERIFIED

| Field | Value |
| --- | --- |
| **Fix architecture** | Session key is `lume-capture-session-v1:${projectId}`. Switching the open project parks the current slice and loads that project’s parked session or empty. Apply refuses when the analysed session project ≠ the scoped/open project. |
| **Enforcement** | `captureSessionStorageKey`, `captureSessionProjectMismatch`, `bindOpenProject` from `CaptureWorkspace`, `applyOne` mismatch guard. Persist still writes the legacy unscoped key for one release of compatibility, then the project key. |
| **Production regression** | A-008 / N-06; dogfood D-047 key + mismatch helper. |
| **Residual** | Browser `sessionStorage` remains the session authority (D-013). Same-account two-tab Capture of the same project is not a lock. Account switch remains D-036 (already closed). |

### D-048 / A-005 / N-05 — Knowledge / availability idempotency — CLOSED / VERIFIED

| Field | Value |
| --- | --- |
| **Fix architecture** | Reuse `capture_apply_receipts` — no second receipt system, no migration. `write_knowledge`, `write_availability`, `ensure_person`, and `confirm_responsibility` carry `applyOperationId`. Persist hooks look up the receipt and skip; memory execute actually writes knowledge and tracks receipts. |
| **Enforcement** | `planKnowledge` / person-linked planners; `persist-execute` + `findApplyReceipt`; Apply-level receipt check before execute; `persistKnowledgeBullet` writes a receipt after a non-risk insert when `meta.receipt` is set. |
| **Production regression** | A-005 / N-05 inverted; dogfood double-Apply knowledge and availability = one row; D-045+D-048 reload-fail then retry = `no_change`. |
| **Residual** | Non-risk knowledge insert + receipt insert are sequential, not one RPC. A crash between those two inserts could still duplicate. Updates/deletes stay unreceipted (usually correct). |

---

# Still open (prioritised)

See also `docs/LUME_V1_KNOWN_DISCOVERIES.md` § Future hardening backlog.

**BEFORE EXTERNAL USERS**

- New Project / delete atomicity (D-028 / A-003)
- Same-workspace RLS project-alignment on weak tables (N-09)
- Remaining persist-helper membership audit (D-035 remainder)
- Operator integrity check (scanner + SQL exist; not a product observer)
- Coach leftover client MissionState if Coach returns (D-033 remainder)

**HARDEN DURING V1**

- Hydrate 24 vs structured vs UI 8 (D-049 / N-03)
- Durable `analysesThisMonth` (N-04 / D-024)
- Paint cache after confirmed Apply (N-10)
- `source_recommendation_id` if product still wants the link (N-08)
- Same-project `supersedes_id` (N-13)
- Date/time normalisation (`T12:00:00.000Z` date-only hydrate)
- Apply API Review attestation (N-12 — document or add)
- Orphan-todo NOT NULL / cleanup (A-006)

**DATABASE / INVARIANT STRENGTHENING**

- Knowledge/availability receipt in the same transaction as the insert
- Semantic uniqueness only after a product decision (A-007)
- `item_tags.target_id` FK; `todos.project_id` NOT NULL

**OBSERVABILITY / RECOVERY**

- User-visible truth-health; hydrate does not flag orphans / missing people
- History persist skips remain `console.error` only (D-004)

**PRODUCT / MODEL DECISIONS**

- Waiting vs open-loop split (D-008 / D-021)
- People uniqueness / workspace people
- Archive / undo (D-027)
- Whether 8 or 24 is the Knowledge section law
- Whether API Apply without Review is an accepted power

Replacement-pin **fingerprint** is closed (N-07). Apply must still not re-bind.

---

# A. Product Owner report — plain English

## Is Lume currently structurally safe enough to dogfood with real project data?

**YES.**

The four precautions from the original audit (Apply retry, concurrent due-date overwrite, leftover Review on another project, duplicate knowledge/availability on retry) are closed and regression-proven. Workspace isolation remains real; Ready → Apply still fail-closed; Meeting Prep and the old writable Gantt still do not drive current surfaces; Capture V2 is still the only Analyse engine.

Why not a claim of “finished product”: there is still no production integrity observer; leftover Knowledge prose and paint-cache lag can still confuse a reader. Those are later hardening, not the dogfood blockers named in this audit.

**9 September 2026 follow-up:** New Project create is now one `create_project_bundle` transaction (same programme as `delete_project_bundle`). D-028 / A-003 create remainder is closed. History remains secondary after success.

**10 September 2026 (D-050):** Hosted New Project failed after that RPC shipped because production never received later additive migrations (`knowledge_items.kind` and retrieval tag tables). The RPC is not inventing a stale column. Reconstructing every repo migration into disposable Postgres was green; SQL Editor catch-up of selected files was not equivalent. Fail-closed at persist (`not treated as maintained project truth`). Catch-up is additive `20260910120000_hosted_canonical_schema_catchup.sql`. Do not strip `kind` from the RPC.

## Is there any credible current path that could silently corrupt project truth?

**Closed by this programme (no longer current paths):** Apply returning pre-write state after a successful write; fingerprint-blind due-date overwrite; leftover Project A Review applying on Project B; unreceipted knowledge/availability/person Apply retries.

Remaining confirmed or high-confidence paths:

1. **Non-risk knowledge insert + receipt are two writes.** A crash between them could still duplicate (rare; retry after a recorded receipt is `no_change`).
2. **Same-workspace mis-attribution** is now refused at RLS for recommendations / history / capture_sessions (`project_belongs_to_workspace`) and at persist helpers that name a project id. Residual: a helper that still forgets `project_id` on a table whose policy is membership-only. Not a cross-tenant leak.

Closed 9 September 2026: New Project create and project delete are one DB transaction each (`create_project_bundle` / `delete_project_bundle`). A crash mid-create rolls back the whole bundle. The app cannot report success on a partial create.

Not silent canonical corruption: Meeting Prep leftover does **not** write current surfaces; hard-refresh paint-cache lag is **temporary UI** (N-10).

## Could two parts of Lume disagree about the same project fact?

Yes, under these conditions:

- **Risks table vs Knowledge “risks” list.** Open risks are folded into Knowledge on hydrate; resolved/accepted risks stay in `state.risks` but are omitted from that fold. Leftover Knowledge prose can still name a risk that the Risks table has resolved (known D-030).
- **Knowledge section list vs structured overlay.** Hydrate keeps at most 24 bullets per section in the prose arrays, but keeps **all** structured rows. After 24, one surface can look truncated while another still has the extra facts.
- **Browser vs database after Apply.** If reload-after-write fails, the client now omits stale state and hydrates or asks for refresh. Until that hydrate lands, the UI can lag the database (honest lag, not a reverted snapshot).
- **Paint cache vs database.** Apply does not refresh `lume-mission-supabase-cache-v1`. A hard refresh can briefly paint the last hydrate, then catch up.
- **People.** A person can exist as a stakeholder, as Knowledge people prose, and as a structured responsibility, and those three can drift (known D-007).
- **History.** History is evidence, not a second store. Some events are skipped on persist failure; the domain write can exist without the History line.

## Could retries, concurrency or failures create duplicates / partial truth?

Yes.

- Receipted creates (To Do / Risk / milestone / knowledge / availability / person / responsibility with an operation id): retry is supposed to no-op.
- Residual: crash between a non-risk knowledge insert and its receipt insert.
- New Project: one `create_project_bundle` transaction. Inspect-on-retry by `clientProjectId` plus a completeness check — not a full bundle compare. Leftover partials (pre-RPC rows) still clean up through `delete_project_bundle`.
- Optimistic To Do toggle/edit: the UI changes first, then persists; failure reconciles from the server (known D-005). That is a **temporary** lie, not a silent durable one, if reconcile works.

## Could one project’s data ever leak into another?

**Across workspaces (two accounts / two tenants):** this audit did not run a live two-browser isolation trial. The code still uses forced RLS + `is_workspace_member(workspace_id)`. D-036 (same-browser logout → previous user’s workspace) is already closed on production. Nothing found that bypasses RLS for normal Capture / workspace CRUD. Service-role is used for billing and evals, not ordinary Apply.

**Inside one workspace (Candy vs Atlas):** isolation is mostly **application** logic, not a database wall. Capture Apply loads the requested project and refuses foreign To Do / Risk / person ids. To Do update/delete now require workspace + project + id (the old “update by id only” instance of D-035 is gone). RLS on recommendations, history, and capture sessions checks workspace membership only — a bug could *mis-attribute* a row to another project in the same workspace; it would not show Customer B’s workspace to Customer A.

**What was actually tested/proven here:** source + in-memory production-path probes; existing isolation verify scripts remain in the suite. No live cross-account SQL was run in this slice.

## Could AI cause incorrect project truth even though Review exists?

The model **cannot write the database**. Analyse calls the model; parse/validate/resolve/plan are TypeScript against server-loaded truth. Apply **does not call the model again**.

What Apply *does* trust is the **browser’s reviewed suggestion object**, plus the deterministic planner. Review is a human gate in the UI, not a signed ticket. A crafted `POST /api/capture/apply` from a logged-in member can write without ever opening Review — the same class of power as editing a To Do on the To Do frame. The model cannot sneak a write past the planner. A human (or a buggy client) can still send a legal write the user never consciously reviewed.

## Could historical / legacy data still affect current behaviour?

**Stored Meeting Prep** still hydrates for compatibility. Catch Me Up and Capture context do **not** read it. `/meetings` redirects home. Timeline does **not** mount the writable Gantt. Capture V2 is hard-wired; the env flag cannot revive the deleted findings path.

Legacy influence that *can* still matter: leftover Knowledge prose, `[Resolved]` titles in old risk rows (D-015), date-only values rehydrated as `T12:00:00.000Z`, and compatibility columns that current code still folds (risks → Knowledge section).

## If something became corrupted, would Lume notice?

**Mostly no.** There is no production integrity observer. Hydrate will paint whatever the tables contain, including orphans, duplicate names, and responsibilities pointing at missing people. This audit added a **read-only in-memory scanner** and published SQL probes. They are not wired into the app. Apply reload failures and History persist skips are `console.error` only.

## What scares you most technically?

1. **Same-workspace persist helper that forgets `project_id`** — RLS is membership-wide on residual tables (D-035 remainder / N-09 closed for recommendations / history / capture_sessions).
2. **Invariants that still live only in application code** — semantic uniqueness, several project-alignment checks, knowledge insert+receipt atomicity.
3. **No production integrity observer** — scanner + SQL probes exist; they are not a daemon.

## What should we fix before serious dogfooding?

The original five are done (1–4) or demoted (5).

**Closed (6 Sep 2026):** Apply reload fail-closed; fingerprint completeness; Capture session project binding; knowledge/availability/person receipts.

**Still useful practice, not a required precaution:** prefer one Capture Review at a time; if the UI says “Saved. Refresh…”, refresh before clicking Apply again; do not treat Meeting Prep, Gantt, or suggestion-accept as durable.

**Before outside users (this programme, 9 September 2026):** New Project / delete transactions and same-workspace RLS alignment for recommendations / history / capture_sessions are closed. Residual: persist-helper membership on tables that still rely on WHERE clauses; lawyer Privacy/Terms; support inbox ownership.

---

# B. Technical audit report

## Baseline

| Item | Value |
| --- | --- |
| **main SHA** | `f737f8a88442bff9e850d91de55c9afd82cda630` (`Merge pull request #139`) |
| **Audit branch** | `cursor/adversarial-integrity-audit-cedc` |
| **Preflight** | Run at start of this slice against `origin/main`; expected CURRENT / ahead 0 / behind 0. Re-run before merge of any later fix slice. |
| **Test baseline** | `npm test` — **67/67** deterministic suites passed after this report landed, including `adversarial-integrity` (25 probes). |
| **Live DB** | Not mutated. No RLS bypass. No user-data cleanup. |
| **Delegated recon** | Persistence/RLS, Review→Apply, Capture/AI boundary, hydrate/concurrency — read-only. Lead independently verified production paths below. |

Recent context already on `main`: #138 leftover Meeting Prep / Gantt influence deactivated; #139 `/meetings` no longer paints stored prep.

## Architecture maps

### Persistence

Workspace-scoped Postgres. Forced RLS on product tables. Tenant key = `workspace_id` + `is_workspace_member()`.

Canonical tables (not exhaustive): `workspaces`, `workspace_members`, `projects`, `stakeholders`, `todos`, `risks`, `knowledge_items`, `milestones`, `memories`, `recommendations`, `meetings` (prep jsonb = **compatibility**), `releases`, `capture_sessions`, `history_events`, `coach_sessions`, `capture_apply_receipts`, `project_tags`, `item_tags`, plus billing / evals / snapshots.

Delete semantics on `projects`: CASCADE for stakeholders, risks, knowledge, milestones, meetings, releases, snapshots, tags, receipts. **SET NULL** for todos, memories, recommendations, history, capture/coach sessions. App delete must remove SET NULL children first (D-028).

Transactional Capture RPCs (`20260829200000_authoritative_apply_tx.sql`): risk+knowledge, todo create+receipt, milestone create+receipt, person+responsibility. Knowledge-only and availability writes are **not** in that set.

### Writes

| Path | Authority | Atomic? | Receipt? |
| --- | --- | --- | --- |
| `POST /api/capture/apply` | Server load + `planCaptureApply` + `supabaseCaptureApplyHooks` | Per RPC for receipted creates | To Do / Risk / milestone create |
| Ocean To Do / Knowledge / People UI | Browser persist helpers after optimistic `setState` | Single-row | No |
| `persistNewProject` | `create_project_bundle` RPC (thin caller) | Yes (canonical bundle) | Retry via `clientProjectId` inspect |
| `persistProjectDelete` | `delete_project_bundle` RPC | Yes | N/A |
| Tell Me / Catch Me Up / Coach | No project-truth writes (Tell Me refresh may write intelligence snapshot cache) | — | — |
| `updateMeeting` / `acceptSuggestion` / `updateTodoDueDate` | Memory-only; **not mounted** on current pages | — | — |

Apply production reload: `reloadWorkspace` → `loadAuthenticatedWorkspace()` (full workspace). History persist is best-effort after the write.

### Reads / projections

`loadMissionStateFromSupabase` is the hydrate spine. MissionState is the client bag. Surfaces re-project: Timeline (dated truth), Knowledge Centre (sections + structured), Catch Me Up / Tell Me (serialized canonical truth), Capture context (project-scoped extract + capped cross-project names).

Paint cache: `lume-mission-supabase-cache-v1` written on hydrate and `saveStatus === "saved"`. `adoptAppliedState` does **not** write it.

Date-only columns hydrate as `{date}T12:00:00.000Z`.

`analysesThisMonth` is hardcoded `0` on hydrate (D-024 class).

### State transitions

Analyse → Review (Ready / Needs you) → Apply. Ready uses `assessApplyReadiness` → same `planCaptureApply` Apply uses. Apply additionally reloads a fresh world and checks `expectedTarget`. Destructive confirmation is Review-UI only (by design). Human confidence / coverage gates are Review-only.

Corrections are intended as state transitions on canonical rows, not a second store.

## Invariant matrix

| Invariant | Enforced where | DB guarantee? | Application guarantee? | Production-path test? | Known bypass? |
| --- | --- | --- | --- | --- | --- |
| Project isolation (tenant) | RLS `is_workspace_member` | Yes (workspace) | Server clients use user session | `verify-rls-policies`, `verify-tenant-isolation`, D-036 closed | Service-role (billing/evals only) |
| Project isolation (same workspace) | Capture world filter + `require*OnProject` + some persist scopes | Partial (child `project_id` FKs; several policies membership-only) | Capture V2 yes; persist helpers mixed | Capture server-truth / D-035 tests; **not** every helper | Id-only helper that forgets `project_id`; recommendations RLS |
| Referential integrity | FKs + app cleanup | Partial (`todos.project_id` SET NULL; `item_tags.target_id` no FK; `supersedes_id` global) | Delete bundle; Capture refuses missing targets | Project-delete suite | Orphan todos representable (A-006) |
| Ready → Apply equivalence | Shared `planCaptureApply` | No | Yes for planner; Review has extra human gates | `verify-review-apply-executability`, readiness contract | Fingerprint omits written fields (A-002); `writeRepresentsProposal` Review-only; API without Review (N-12) |
| Idempotency | `capture_apply_receipts` unique `(workspace, project, operation)` | Yes for receipted creates | `applyOperationId` on todo/risk/milestone/knowledge/availability/person/responsibility writes | Helper + dogfood gate + apply history tests | Crash between non-risk knowledge insert and receipt insert |
| Atomic multi-write | Apply RPCs | Yes for those RPCs | New Project / delete / tags / plain knowledge: no | New Project / delete suites test cleanup, not crash isolation | Smoke between insert and cleanup (A-003, D-028) |
| Correction target safety | Fingerprint + fresh world + membership | No row versions | Yes for fields the planner writes (incl. dueAt/detail/endAt/notes/replace pin/owners) | `verify-capture-server-truth` D/E; dogfood D-046 | Unfingerprinted Ocean UI edits; no integer `version` |
| Destructive confirmation | Review view-model | No | Review UI only | Review contract tests | Direct Apply API (documented, M7) |
| Partial-create retry | `clientProjectId` + inspect completeness | Unique project id/code | Compensating cleanup | `verify-new-project*` | Semantic fields not fully compared |
| Canonical-truth-only writes | Constitution + deleted legacy paths | N/A | Capture V2 sole engine (`isCaptureV2Enabled` ≡ true) | Architecture conformance / legacy-influence | Memory-only leftovers if remounted (N-11) |
| Timeline read-only | `TimelineFrame` unmounted Gantt | N/A | Yes on production Timeline | `verify-legacy-influence`, A-010 | Stored Gantt rows unused, not deleted |
| Meeting Prep isolation | Catch Me Up / Capture context comments + no prep read | Prep column remains | Yes after #138/#139 | `verify-meeting-catch-up`, `verify-meeting-routes`, A-009/A-010 | Hydrate still loads empty prep scaffold |
| Legacy Gantt isolation | Timeline does not import Gantt | Rows may remain | Yes | A-010 | Do not remount |

## Findings table

| ID | Severity | Classification | Area | Canonical truth affected? | Reproduced? | Evidence | Recommended timing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-001 | HIGH | **CLOSED / VERIFIED** | Apply reload | No on first failure (DB already correct). Retry of receipted writes is now `no_change` | Yes — then inverted | Production Apply omits pre-write `state`; client hydrates | closed by D-045 |
| A-002 | HIGH | **CLOSED / VERIFIED** | Fingerprint / world | Was yes — concurrent dueAt overwritten | Yes — then inverted | World/fingerprint include dueAt/detail/endAt/notes | closed by D-046 |
| A-003 | MEDIUM | HIGH-CONFIDENCE ARCHITECTURAL RISK | New Project | Yes — visible partial bundle | Source; cleanup exists | Sequential inserts, no `persist_new_project` RPC | FIX BEFORE EXTERNAL USERS (D-028 class) |
| A-004 | HIGH | **CLOSED / VERIFIED** | Apply world | Same class as A-002 | Source + A-002 runtime; inverted | World/fingerprint include dueAt, detail, endAt | closed by D-046 |
| A-005 | HIGH | **CLOSED / VERIFIED** | Apply receipts | Was yes on retry | Source + inverted memory/persist probes | `applyOperationId` + `capture_apply_receipts` on knowledge/availability/person writes | closed by D-048 |
| A-006 | MEDIUM | DEFENCE-IN-DEPTH GAP | Schema | Representable orphans | Source | `todos.project_id` ON DELETE SET NULL | HARDEN DURING V1 |
| A-007 | LOW | DOCUMENTED / ACCEPTED V1 LIMITATION | Schema | Duplicate semantic entities allowed | Source | No unique (project, name/title) | ACCEPT / DOCUMENT (product: people uniqueness) |
| A-008 | MEDIUM | **CLOSED / VERIFIED** | Capture session | Was UI/session leak; create-without-target could rebound | Source; inverted | Project-scoped session key + Apply mismatch guard | closed by D-047 |
| A-009 | — | FALSE ALARM | Meeting Prep | No | Source | Catch Me Up / Capture do not read `Meeting.prep` | — |
| A-010 | — | FALSE ALARM | Timeline / meetings | No | Source | Gantt unmounted; `/meetings` redirects | — |
| N-01 | — | FALSE ALARM | Dual Capture engine | No | Source | `isCaptureV2Enabled` always true | — |
| N-02 | — | FALSE ALARM | D-035 todo instance | No (that instance) | Source | `scopeExistingTodo` on update/delete | Update D-035 text; class remains |
| N-03 | MEDIUM | CONFIRMED DEFECT | Hydrate projection | **Derived** — DB still complete | Source | Section bodies `.slice(0, 24)`; structured uncapped; UI cap 8 | HARDEN DURING V1 |
| N-04 | LOW | OBSERVABILITY GAP / known D-024 | Usage meter | No (display) | Source | `analysesThisMonth: 0` | HARDEN DURING V1 |
| N-07 | MEDIUM | **CLOSED / VERIFIED** (fingerprint). Residual: Apply still does not re-bind | Responsibility replace | Fingerprint gap closed | Source; inverted | `replacePersonId` + owner set in expected-target; Apply does not `bindResolvedReplacement` (by design) | fingerprint closed with D-046 |
| N-08 | LOW | DOCUMENTED / ACCEPTED V1 LIMITATION | Todo provenance | Link never persisted | Source | No `source_recommendation_id` writes | HARDEN DURING V1 |
| N-09 | MEDIUM | DEFENCE-IN-DEPTH GAP | RLS | Same-workspace mis-attribution | Source | recommendations / history / capture_sessions membership-only | FIX BEFORE EXTERNAL USERS |
| N-10 | LOW | DEFENCE-IN-DEPTH GAP | Paint cache | Temporary UI | Source | `adoptAppliedState` is `setState` only | HARDEN DURING V1 |
| N-11 | — | FALSE ALARM (current product) | Memory-only APIs | No on mounted UI | Source | `ProjectWidgetGrid` / `updateMeeting(` unused | ACCEPT; do not remount |
| N-12 | MEDIUM | DEFENCE-IN-DEPTH GAP | Apply API | Writes without Review UI | Source | No readiness attestation | HARDEN / document |
| N-13 | LOW | DEFENCE-IN-DEPTH GAP | Knowledge FK | Cross-project supersede representable | Source | `supersedes_id` → `knowledge_items(id)` only | HARDEN DURING V1 |

Existing open discoveries still true and not re-filed: D-003/D-043 (memory-only if remounted), D-005 (optimistic persist), D-007, D-008/D-021, D-010 (Coach/legacy Ask), D-028, D-030, D-033 remainder (Coach client `state`), D-034 remainder (no row version; fingerprint incomplete — now A-002), D-035 remainder (helpers other than todo update/delete).

## Deep dives — HIGH

### A-001 — Apply reload failure returns pre-write state

**Starting state:** Candy workspace, one To Do.  
**Action:** `applyApprovedCaptureSuggestion` creates “Book the war room”; `reloadWorkspace` throws.  
**Expected:** fail closed, or return written state, or omit `state` so the client hydrates.  
**Actual:** `executed.kind === "wrote"` and `result.state.todos` equals the **pre-write** snapshot. Hook store contains the new To Do.  
**Persisted:** write landed.  
**Reload:** not this process; a later hydrate would show the write. The defect is the **returned** state, not the row.

Production `/api/capture/apply` always passes `reloadWorkspace`. Client `adoptAppliedState(data.state)` will revert the UI. Combined with A-005, a second Apply of knowledge is the plausible six-month duplicate.

**Fix direction:** if reload throws after `wrote`, do not return pre-write state as success. Prefer 503 / `executed: "wrote"` without `state` / force client `GET /api/workspace/state`. Invert this probe when fixed.

### A-002 / A-004 — Fingerprint-blind due date overwrite

**Starting state:** To Do “Obtain CAB approval”, due 10 Jul, detail “Owner: Elena”, fingerprinted at Analyse.  
**Concurrent change:** due 12 Jul, detail “Owner: Jordan”.  
**Action:** Ready assessment + Apply of “move to 17 Jul”.  
**Expected:** stale / Needs you.  
**Actual:** `staleExpectedTargetReason === null`, `canApprove === true`, Apply wrote due **17 Jul**. Concurrent detail survived this proposal because `planTodo` only sets `detail` from `item.recommendation?.action` (absent here). A proposal that also carries detail would overwrite that too.

**Canonical truth:** yes, the due date.  
**World:** todos are `{ id, projectId, title, done }` only. Milestone fingerprint has `startAt` but not `notes`/`endAt` even though world.timeline includes `notes`.

### A-005 + N-05 — Unreceipted knowledge

`planKnowledge` emits `write_knowledge` without `applyOperationId`. Persist hook inserts a bullet. `memory-execute` **returns state unchanged** for `write_knowledge`, so existing helper tests cannot regress this. This is a testing blind spot *and* a retry hole.

## Novel failure hypotheses (12+)

| # | Hypothesis | Test / trace | Outcome |
| --- | --- | --- | --- |
| 1 | Dual Capture engine still reachable via env flag | `flag.ts` always `true` | **FALSE ALARM** (N-01) |
| 2 | `persistTodoUpdate` still updates by id only (D-035 text) | `scopeExistingTodo` | **FALSE ALARM** for that instance (N-02). Class remains. |
| 3 | Hydrate drops extra knowledge silently | `.slice(0, 24)` vs uncapped `structured` | **CONFIRMED** projection (N-03) |
| 4 | Usage meter is durable | `analysesThisMonth: 0` | **CONFIRMED** display gap (N-04) |
| 5 | Knowledge Apply is receipted like todos | plan + persist | **CLOSED / VERIFIED** (N-05 / D-048). Residual: sequential insert+receipt |
| 6 | Capture session is keyed per project | `captureSessionStorageKey` + bind on project change | **CLOSED / VERIFIED** (N-06 / A-008 / D-047) |
| 7 | Replace-owner pin is fingerprinted | `replacePersonId` + owner set in expected-target; Apply does not re-bind | **CLOSED / VERIFIED** fingerprint (N-07). Re-bind remains Review-only |
| 8 | Suggestion→To Do provenance survives persist | no `source_recommendation` writes | **CONFIRMED** never written (N-08) |
| 9 | All child RLS re-checks project↔workspace | recommendations/history/sessions membership-only | **CONFIRMED** gap (N-09) |
| 10 | Apply refreshes paint cache | `adoptAppliedState` | **CONFIRMED** does not (N-10) |
| 11 | Memory-only meeting/suggestion APIs are live | no `ProjectWidgetGrid` import; no `updateMeeting(` | **FALSE ALARM** on current pages (N-11) |
| 12 | Apply requires Review Ready | apply route | **CONFIRMED** planner-only (N-12) |
| 13 | Supersede cannot cross projects | FK is table-global | **CONFIRMED** representable (N-13) |
| 14 | Meeting Prep still feeds Catch Me Up / Capture | #138/#139 + A-009 | **FALSE ALARM** |
| 15 | Timeline still writes Gantt | A-010 | **FALSE ALARM** |
| 16 | Coach writes project truth | API imports; no persist | **FALSE ALARM** for writes; D-033 stale-context remains |

## Existing data consistency assessment

No live workspace was scanned. The in-memory scanner is clean on `createSeedState()` and flags constructed orphans / missing responsibility people.

**Could corruption already exist without the app noticing?** Yes. Hydrate does not validate: orphan `todos.project_id`, duplicate stakeholder names, responsibility `personId` not in `stakeholders`, `item_tags.target_id` dangling, `supersedes_id` pointing at another project, receipt rows whose entity was deleted. Run the SQL probes in `verify-adversarial-integrity.ts` on a copy of dogfood data (read-only).

## DB constraint assessment

Present: workspace membership RLS; unique project code per workspace (case-insensitive); unique apply receipts; tag uniqueness; enum checks; most child FKs.

Absent / weak: semantic uniqueness; todo/project NOT NULL; project alignment on some residual RLS policies; `item_tags.target_id` FK; row version columns. New Project / delete transactions exist (`create_project_bundle` / `delete_project_bundle`).

## Invariants that live only in application code

- Same-workspace project membership on several persist paths (D-035 remainder)
- Ready fingerprint completeness for *future* planner fields (dueAt/detail/endAt/notes/replace pin are now included)
- Knowledge/availability receipt in the same DB transaction as the insert
- New Project / delete atomicity is now DB-enforced; leftover pre-RPC partials still use compensating `delete_project_bundle`
- “Do not use Meeting.prep / Gantt as truth”
- Capture session ↔ open project (now application-enforced; still not a DB rule)
- `writeRepresentsProposal` (Review only)
- Person identity text-contains-full-name (D-R14) — Apply still needs a legal payload

## Concurrency / idempotency

Fresh Apply world + fingerprint is the concurrency story. It now includes the fields Apply writes (D-046). Receipts cover todo/risk/milestone/knowledge/availability/person/responsibility creates. Updates/deletes are not receipted (usually correct). Two concurrent Applies of the same knowledge item should hit the receipt. Two tabs toggling the same To Do: last persist wins; optimistic UI can bounce on reconcile.

## Review → Apply equivalence

Same planner. Different world (client preflight vs server load). Same stale/mismatch predicates. Review-only: human gates, destructive confirm, `writeRepresentsProposal`, `bindResolvedReplacement` at Review attach time. Apply will execute a legal write that Review would have hidden. That is intentional for destructive confirm; it is a gap for fingerprint-blind fields and replace-owner pins.

## AI boundary

Nondeterminism stops at `parseObservationEnvelope`. Apply does not call the model. Apply trusts the client `PendingSuggestion`. Hallucinated target ids are blocked by membership + fingerprint. First-name person create on an empty roster is a residual resolve-time allowance (investigator; not re-run as a live model test). Impossible ISO dates are regex-only.

## Historical compatibility

Meetings.prep: hydrate only. Gantt: unmounted. Legacy Capture findings path: unreachable. Coach: hidden, still accepts client `MissionState` (D-033). `database.ts` still lags migrations (D-012).

## Cross-project isolation

Tenant: RLS. Same workspace: application. Capture foreign-id cases exist in `verify-capture-server-truth`. Todo persist instance of D-035 is fixed. Recommendations insert can name another project’s id in the same workspace at the RLS layer.

## Observability

No integrity job. No user-visible “truth health.” Apply reload / History skip → server logs. Paint cache can hide Apply until hydrate. Scanner + SQL probes are the start of detection, not a product feature.

## Single points of failure

| Component | Blast radius | Current protection | Missing | Stronger invariant belongs |
| --- | --- | --- | --- | --- |
| `loadMissionStateFromSupabase` | Entire workspace paint | Defaults / enum fallbacks | Silent drop (24), no integrity scan | Tests + optional DB checks; do not invent a second model |
| `planCaptureApply` | Every Capture write | Domain matrix, membership | Fingerprint completeness; Review attestation | Domain + regression on production Apply |
| `persist-mutations` / RPCs | Every durable write | Some scopes; some TX RPCs | Remaining helpers; New Project TX | DB where cheap; persist-layer project_id |
| `captureApplyWorldFromState` | All stale detection | Identity fields | Fields Apply writes | Same module + tests |
| `adoptAppliedState` + paint cache | What the user believes after Apply | Server reload when it works | Fail-closed reload; cache write | Apply route + client |
| Shared optimistic `setState` then persist | One entity at a time | Reconcile on failure (D-005) | User can act on false UI before reconcile | Keep reconcile; do not drop it |

## Test coverage gaps

**Strong helper / contract coverage:** Review↔Apply executability, readiness, Capture V2 server truth, person identity, project delete, RLS policy text, legacy influence, New Project cleanup.

**Weak or absent production-path coverage:**

- Apply HTTP + live Supabase (D-014)
- Reload-after-write failure (now probed in-memory; not HTTP)
- Knowledge Apply retry (memory execute no-ops the write)
- Project-switch with a live Capture session
- Concurrent dueAt vs Ready
- Live RLS project-alignment on weak tables
- Integrity of already-stored dogfood rows

Do not treat a green helper suite as proof the production caller is safe. That is the point of this audit.

## Recommended remediation backlog

### 1. FIX BEFORE DOGFOODING

**CLOSED / VERIFIED (this programme):** A-001 / D-045, A-002 / A-004 / D-046, A-008 / D-047, A-005 / D-048.

### 2. FIX BEFORE EXTERNAL USERS

- New Project / delete single transaction (D-028 / A-003)
- RLS project↔workspace alignment on weak tables (N-09)
- ~~`replacePersonId` in fingerprint~~ (closed). Keep: never re-bind on Apply (N-07 residual, by design)
- Finish persist-helper membership audit (D-035 remainder)
- Wire a read-only integrity check (scanner + SQL) for operators
- Coach: stop treating client MissionState as truth if Coach returns (D-033)

### 3. HARDEN DURING V1

- Hydrate 24 vs structured vs UI 8 (N-03 / D-049)
- `analysesThisMonth` from durable usage (N-04)
- Write paint cache after confirmed Apply (N-10)
- `source_recommendation_id` on todo create if product still wants the link (N-08)
- `supersedes_id` same-project check (N-13)
- ISO date validation beyond regex
- `writeRepresentsProposal` on Apply or accept the asymmetry in the contract
- Orphan-todo NOT NULL or periodic cleanup (A-006)

### 4. ACCEPT / DOCUMENT

- No unique person/todo/risk titles (A-007)
- Meeting.prep hydrate compatibility
- Review-only destructive confirmation
- Timeline read-only / Gantt unmounted
- Memory-only APIs as long as they stay unmounted
- Apply API without Review attestation for a logged-in member (same power as To Do frame)

### 5. PRODUCT / MODEL DECISION

- Waiting vs open-loop dual representation (D-008 / D-021)
- Workspace-level people vs per-project stakeholders
- Archive / undo after project delete (D-027)
- Whether 8 or 24 is the Knowledge section law
- Whether Capture may legally Apply without the user having seen Review (API clients)

---

## Final challenge

**If Lume corrupted one important project fact six months from now, what mechanism would most plausibly have caused it?**

Those two original stories are closed: Apply no longer returns the pre-write picture, and knowledge/availability/ownership retries are receipted; concurrent due-date edits now stale Ready.

The next most plausible six-month corruption is now **New Project / delete mid-sequence** (A-003 / D-028) or a **same-workspace persist helper that forgets `project_id`** (D-035 remainder / N-09). A rarer residual is a crash between a non-risk knowledge insert and its receipt insert.

This audit reproduced A-001 and A-002 against `applyApprovedCaptureSuggestion` on `f737f8a`. The dogfood programme inverted those probes plus A-004 / A-005 / A-008 / N-05 / N-06 / N-07.

**What assumption is repeated throughout this codebase that nobody appears to have independently proved?**

That **callers will pass the right `project_id`.** Fingerprint completeness for fields Apply writes is now independently proved (D-046). The database still does not prove semantic uniqueness or full project alignment. D-035’s todo instance was proved in code (N-02). The general persist-helper assumption remains.

---

## What this programme changed

**Audit slice (#140 assets, absorbed):**

- Added `scripts/verify-adversarial-integrity.ts` and registered it in the deterministic suite.
- Recorded D-045–D-049.
- Updated D-035 evidence: todo update/delete are now scoped.

**Dogfood integrity gate (this branch):**

- Closed D-045–D-048 in production Apply / Review / session / receipts.
- Added `scripts/verify-dogfood-integrity-gate.ts` and inverted the closed adversarial probes.
- Updated this file, Known Discoveries, `AGENTS.md`, and the v0.9 handoff snapshot.
- No new DB migration. No production integrity daemon.

Do not merge #140 separately once this programme PR exists.
