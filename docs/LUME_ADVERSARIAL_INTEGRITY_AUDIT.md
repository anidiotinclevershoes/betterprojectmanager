# Lume — Adversarial architecture & data-integrity audit

**Status:** Evidence-backed audit of `main` at `f737f8a88442bff9e850d91de55c9afd82cda630`  
**Date:** 6 September 2026  
**Branch:** `cursor/adversarial-integrity-audit-cedc`  
**Mode:** reconnaissance + adversarial testing + findings. This file is **not** a second architecture map. If it and the code disagree later, **the code wins**.

Probes: `scripts/verify-adversarial-integrity.ts` (`npm run verify:adversarial-integrity`).  
Read-only scanner: `scanMissionIntegrity()`. SQL probes in that script are for a live workspace and were **not** executed against user data in this audit.

---

# A. Product Owner report — plain English

## Is Lume currently structurally safe enough to dogfood with real project data?

**YES, WITH SPECIFIC PRECAUTIONS.**

Why not **NO**: workspace isolation is real; Capture Apply reloads server truth and re-runs the same planner Review uses; core To Do / Risk / milestone creates have receipts; Meeting Prep and the old writable Gantt no longer drive Catch Me Up, Capture, or Timeline; the leftover dual Capture engine is gone.

Why not unqualified **YES**: one successful Apply can still hand the browser the *old* project picture; a Ready change can overwrite a date someone else just edited; knowledge notes can duplicate on retry; Capture Review from one project can stay on screen after you open another; New Project is still a sequence of inserts, not one database transaction. None of those is “the database forgot which customer you are.” Several *are* “the project can become silently wrong.”

## Is there any credible current path that could silently corrupt project truth?

Confirmed or high-confidence paths (not drama, not display-only):

1. **Apply succeeds, reload fails, UI shows the old project.** The write is already in the database. If you click Apply again on a knowledge / availability / person-ownership note (no receipt), you can create a **duplicate**. Receipted To Do / Risk / milestone creates will not duplicate.
2. **Two tabs / two people edit the same To Do.** Review fingerprints title and done, not due date or detail. Apply can **overwrite a concurrent due-date change** without asking again. Reproduced in-memory against the production Apply function.
3. **Retry of a knowledge or availability Apply** has no idempotency receipt. A second success is a second row.
4. **New Project / project delete are sequential.** A crash in the middle can leave a half-created or half-deleted bundle until cleanup runs. The app tries to clean up; another reader can see the window.

Not silent canonical corruption (included so they are not overstated): Capture session leftover on another project is mostly **Review display**; Meeting Prep leftover does **not** write current surfaces; hard-refresh cache lag is **temporary UI**.

## Could two parts of Lume disagree about the same project fact?

Yes, under these conditions:

- **Risks table vs Knowledge “risks” list.** Open risks are folded into Knowledge on hydrate; resolved/accepted risks stay in `state.risks` but are omitted from that fold. Leftover Knowledge prose can still name a risk that the Risks table has resolved (known D-030).
- **Knowledge section list vs structured overlay.** Hydrate keeps at most 24 bullets per section in the prose arrays, but keeps **all** structured rows. After 24, one surface can look truncated while another still has the extra facts.
- **Browser vs database after Apply.** If reload-after-write fails, the UI can disagree with the database until the next successful hydrate.
- **Paint cache vs database.** Apply does not refresh `lume-mission-supabase-cache-v1`. A hard refresh can briefly paint the last hydrate, then catch up.
- **People.** A person can exist as a stakeholder, as Knowledge people prose, and as a structured responsibility, and those three can drift (known D-007).
- **History.** History is evidence, not a second store. Some events are skipped on persist failure; the domain write can exist without the History line.

## Could retries, concurrency or failures create duplicates / partial truth?

Yes.

- Receipted creates (To Do / Risk / milestone with an operation id): retry is supposed to no-op.
- Knowledge, availability, and some person/responsibility writes: **retry can duplicate**.
- New Project: inspect-on-retry by `clientProjectId` plus a completeness check — not a full bundle compare. Sequential inserts + compensating delete.
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

1. **Apply “success” that returns the pre-write picture** — users re-apply; unreceipted writes duplicate. (A-001 + A-005)
2. **Fingerprint / Apply-world blindness** — Ready stays Ready while the field Apply is about to write has already changed. (A-002)
3. **Invariants that live only in application code** — uniqueness, several project-alignment checks, New Project atomicity. One missed `project_id` in a helper is a same-workspace wrong-project write.

## What should we fix before serious dogfooding?

Maximum five, ordered:

1. **After a successful Apply, never treat a failed reload as “here is the new project.”** Fail closed, omit state, or force a hydrate. Do not hand the browser the old snapshot with `executed: "wrote"`.
2. **Fingerprint (or the Apply world) must include the fields Apply actually writes** — at least To Do due date / detail and milestone end / notes.
3. **Do not keep Project A’s Review on Project B.** Clear or isolate the Capture session when the open project changes.
4. **Receipts (or an equivalent retry identity) for knowledge and availability Apply.**
5. **Dogfood practice:** one tab per project; if Apply looks like nothing happened, refresh before clicking again; do not Apply the same session from two browsers; do not treat Meeting Prep, Gantt, or suggestion-accept as durable (those UIs are unmounted or memory-only).

---

# B. Technical audit report

## Baseline

| Item | Value |
| --- | --- |
| **main SHA** | `f737f8a88442bff9e850d91de55c9afd82cda630` (`Merge pull request #139`) |
| **Audit branch** | `cursor/adversarial-integrity-audit-cedc` |
| **Preflight** | Run at start of this slice against `origin/main`; expected CURRENT / ahead 0 / behind 0. Re-run before merge of any later fix slice. |
| **Test baseline** | Deterministic suite via `npm test` after this report lands. New script: `verify:adversarial-integrity` (25 probes). |
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
| `persistNewProject` | Sequential inserts + `cleanupFailedNewProjectBundle` | No | Retry via `clientProjectId` inspect |
| `persistProjectDelete` | Sequential SET NULL children then project | No | N/A |
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
| Idempotency | `capture_apply_receipts` unique `(workspace, project, operation)` | Yes for receipted creates | `applyOperationId` on some ops | Helper + apply history tests | Knowledge / availability / some person writes (A-005, N-05) |
| Atomic multi-write | Apply RPCs | Yes for those RPCs | New Project / delete / tags / plain knowledge: no | New Project / delete suites test cleanup, not crash isolation | Smoke between insert and cleanup (A-003, D-028) |
| Correction target safety | Fingerprint + fresh world + membership | No row versions | Yes for fingerprinted fields | `verify-capture-server-truth` D/E | dueAt/detail/notes/endAt/replacePersonId (A-002, N-07) |
| Destructive confirmation | Review view-model | No | Review UI only | Review contract tests | Direct Apply API (documented, M7) |
| Partial-create retry | `clientProjectId` + inspect completeness | Unique project id/code | Compensating cleanup | `verify-new-project*` | Semantic fields not fully compared |
| Canonical-truth-only writes | Constitution + deleted legacy paths | N/A | Capture V2 sole engine (`isCaptureV2Enabled` ≡ true) | Architecture conformance / legacy-influence | Memory-only leftovers if remounted (N-11) |
| Timeline read-only | `TimelineFrame` unmounted Gantt | N/A | Yes on production Timeline | `verify-legacy-influence`, A-010 | Stored Gantt rows unused, not deleted |
| Meeting Prep isolation | Catch Me Up / Capture context comments + no prep read | Prep column remains | Yes after #138/#139 | `verify-meeting-catch-up`, `verify-meeting-routes`, A-009/A-010 | Hydrate still loads empty prep scaffold |
| Legacy Gantt isolation | Timeline does not import Gantt | Rows may remain | Yes | A-010 | Do not remount |

## Findings table

| ID | Severity | Classification | Area | Canonical truth affected? | Reproduced? | Evidence | Recommended timing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-001 | HIGH | CONFIRMED DEFECT | Apply reload | No on first failure (DB already correct). **Yes** if user retries an unreceipted write | Yes — production `applyApprovedCaptureSuggestion` | `apply-approved.ts` swallows reload errors; HTTP returns pre-write `state` | FIX BEFORE DOGFOODING |
| A-002 | HIGH | CONFIRMED DEFECT | Fingerprint / world | Yes — concurrent dueAt overwritten | Yes — Ready stays; Apply wrote 17 Jul over 12 Jul | `world.ts` todos omit dueAt/detail; `expected-target.ts` compares title+done | FIX BEFORE DOGFOODING |
| A-003 | MEDIUM | HIGH-CONFIDENCE ARCHITECTURAL RISK | New Project | Yes — visible partial bundle | Source; cleanup exists | Sequential inserts, no `persist_new_project` RPC | FIX BEFORE EXTERNAL USERS (D-028 class) |
| A-004 | HIGH | CONFIRMED DEFECT | Apply world | Same class as A-002 | Source + A-002 runtime | World/fingerprint omit dueAt, detail, endAt | FIX BEFORE DOGFOODING |
| A-005 | HIGH | HIGH-CONFIDENCE ARCHITECTURAL RISK | Apply receipts | Yes on retry | Source; memory execute **no-ops** knowledge so helper tests cannot see it | `planKnowledge` has no `applyOperationId`; persist `writeKnowledge` / `writeAvailability` skip receipts | FIX BEFORE DOGFOODING |
| A-006 | MEDIUM | DEFENCE-IN-DEPTH GAP | Schema | Representable orphans | Source | `todos.project_id` ON DELETE SET NULL | HARDEN DURING V1 |
| A-007 | LOW | DOCUMENTED / ACCEPTED V1 LIMITATION | Schema | Duplicate semantic entities allowed | Source | No unique (project, name/title) | ACCEPT / DOCUMENT (product: people uniqueness) |
| A-008 | MEDIUM | CONFIRMED DEFECT | Capture session | Usually **UI/session**. Create-without-target can land on rebound `projectId` | Source | Global `lume-capture-session-v1`; no project-switch clear | FIX BEFORE DOGFOODING |
| A-009 | — | FALSE ALARM | Meeting Prep | No | Source | Catch Me Up / Capture do not read `Meeting.prep` | — |
| A-010 | — | FALSE ALARM | Timeline / meetings | No | Source | Gantt unmounted; `/meetings` redirects | — |
| N-01 | — | FALSE ALARM | Dual Capture engine | No | Source | `isCaptureV2Enabled` always true | — |
| N-02 | — | FALSE ALARM | D-035 todo instance | No (that instance) | Source | `scopeExistingTodo` on update/delete | Update D-035 text; class remains |
| N-03 | MEDIUM | CONFIRMED DEFECT | Hydrate projection | **Derived** — DB still complete | Source | Section bodies `.slice(0, 24)`; structured uncapped; UI cap 8 | HARDEN DURING V1 |
| N-04 | LOW | OBSERVABILITY GAP / known D-024 | Usage meter | No (display) | Source | `analysesThisMonth: 0` | HARDEN DURING V1 |
| N-07 | MEDIUM | HIGH-CONFIDENCE ARCHITECTURAL RISK | Responsibility replace | Yes if wrong `replacePersonId` applied | Source | Fingerprint has no `replacePersonId`; Apply does not `bindResolvedReplacement` | FIX BEFORE EXTERNAL USERS |
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
| 5 | Knowledge Apply is receipted like todos | plan + persist | **CONFIRMED** not receipted (N-05) |
| 6 | Capture session is keyed per project | `CAPTURE_SESSION_KEY` constant; delete-only clear | **CONFIRMED** (N-06 / A-008) |
| 7 | Replace-owner pin is fingerprinted | `replacePersonId` absent from expected-target; Apply does not re-bind | **HIGH-CONFIDENCE RISK** (N-07) |
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

Absent / weak: semantic uniqueness; todo/project NOT NULL; project alignment on some RLS policies; `item_tags.target_id` FK; row version columns; New Project / delete transactions.

## Invariants that live only in application code

- Same-workspace project membership on several persist paths (D-035 remainder)
- Ready fingerprint completeness
- Knowledge/availability idempotency
- New Project / delete atomicity and compensating cleanup
- “Do not use Meeting.prep / Gantt as truth”
- Capture session ↔ open project
- `writeRepresentsProposal` (Review only)
- Person identity text-contains-full-name (D-R14) — Apply still needs a legal payload

## Concurrency / idempotency

Fresh Apply world + fingerprint is the concurrency story. It is incomplete (A-002). Receipts cover a subset of creates. Updates/deletes are not receipted (usually correct). Two concurrent Applies of the same knowledge item = two rows. Two tabs toggling the same To Do: last persist wins; optimistic UI can bounce on reconcile.

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

1. Apply reload fail-closed (A-001 / D-045)
2. Fingerprint + world include written fields (A-002 / A-004 / D-046)
3. Capture session scoped or cleared on project change (A-008 / D-047)
4. Receipts for knowledge + availability (A-005 / D-048)
5. Dogfood precautions in PO report § last question

### 2. FIX BEFORE EXTERNAL USERS

- New Project / delete single transaction (D-028 / A-003)
- RLS project↔workspace alignment on weak tables (N-09)
- `replacePersonId` in fingerprint; never re-bind on Apply (N-07)
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

Apply returned a successful write, the UI still showed the old fact (A-001), the user clicked Apply again, and the second write was a **knowledge / availability / ownership** row with **no receipt** (A-005). Alternate: two people edited a To Do due date; Ready stayed Ready; Apply overwrote the later date (A-002).

This audit reproduced A-001 and A-002 against `applyApprovedCaptureSuggestion`. A-005 is proven from the production persist hook and planner; the in-memory execute path would have hidden it.

**What assumption is repeated throughout this codebase that nobody appears to have independently proved?**

That **callers will pass the right `project_id` and that the Analyse fingerprint is a complete concurrency control.** The database does not prove semantic uniqueness, full project alignment, or Apply-world completeness. D-035’s todo instance was later proved in code (N-02). The general assumption was not.

---

## What this slice changed

- Added `scripts/verify-adversarial-integrity.ts` and registered it in the deterministic suite.
- Recorded D-045–D-049.
- Updated D-035 evidence: todo update/delete are now scoped.
- No production behaviour change. No merge to `main`.
