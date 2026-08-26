# V1 Architectural Convergence — Workstream A completion report

**Workstream:** Architecture, authority & deletion review  
**Branch:** `cursor/v1-convergence-architecture-9524`  
**Base SHA:** `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4` (`cursor/capture-v2-desert-new-project-56c9`)  
**Date:** 26 August 2026 (includes Thor amendment: name ≠ identity; D-035; status categories)  
**Production behaviour:** unchanged (docs only)

---

PLAIN-ENGLISH CHECKPOINT — FOR THE PRODUCT OWNER

Lume already has the right bones. This review did **not** invent a new architecture. It checked the existing map against the code that is actually on the V2 programme branch (Capture safety, Capture V2, New Project V2, Desert next to Ocean) and wrote down the few decisions that were still fuzzy.

**What is true now**

- The database is the durable memory. The browser copy (`MissionState`) is a working cache. It is not allowed to become “the real project.”
- Capture already refuses to write until a human reviews. Phase 3B is the legal gate for those writes. That stays. We do not need another mutation system.
- There is already one decent “what is true right now” projector (`serializeCanonicalTruth`). Production Ask still uses an older path that can mix in History. The target is to use the canonical projector everywhere we recall current truth, and to load it on the server from the database instead of trusting a JSON blob from the browser.
- Capture V2 is the Capture engine we want. The old Capture understanding path should be deleted once V2 has passed its tests — not kept forever “just in case.” Git is the rollback.
- Waiting todos and Knowledge “open loops” are two different things that today share one screen. They should stay as two kinds of truth: work you are waiting on, versus unfinished narrative. The screen can still show both. We must not silently merge them by similar wording.
- People today are per-project. The intended future is: one Person in the workspace, plus participation on each project. That is **not** a generic “everything is an Entity” database. A future Issue/JIRA-like object can hang off the same pattern as Risks already do. We should not build Issues now, and we should not build the Person table in the first implementation slice.
- Coach is still in the app shell. Product constitution already parks Coaching. We should hide or retire it, not polish it into a third brain.
- Magic Patterns owns V1 look-and-feel. This repo has no Magic Patterns files. We only recorded the architecture questions that UX work will hit (Waiting frame, Lume noticed, Coach, Desert tokens).

**What we are not doing in this PR**

No production API, Capture, schema, or UI changes. No merge of the experimental programme PR (#66). No implementation of the architecture we recommend.

**Verdict:** ready to start implementation **with specific conditions** — tests first, dead Capture code out, Tell Me loads truth from the server, then Capture V2 becomes the default and the old understanding path goes. Person table, bundle database functions, and Issue objects wait their turn.

### Thor amendment (same day, docs only)

Lead review accepted the report with three corrections, now applied:

1. **Name is not identity.** Unique stakeholder/person **name** constraints are **rejected**. Same-name people must remain representable. Exact-name match may stay a conservative temporary resolver; if ambiguous, Needs you.
2. **Project-scoped mutation is a broad invariant** (D-035), not a Todo-only `persistTodoUpdate` note. Later implementation/test pass audits all project-domain mutations. Not fixed here.
3. **Status categories** are explicit: CURRENT / DECIDED V1 TARGET / TRANSITIONAL / FLAGGED / DEPRECATED / SCHEDULED FOR DELETION / UNRESOLVED (handoff legend + Part C §C0a).

All other approved architectural substance is unchanged.

---

## 1. What you inspected

- Frozen programme branch `cursor/capture-v2-desert-new-project-56c9` at `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4`.
- Ancestry: Phase 3B / PR #64 HEAD `b52995c3b7eb80971d052e875c1d372ebb424ebe` **is** an ancestor. PR #64 itself is still Open against `main`; the commits are on this programme branch.
- V2 programme contents vs `docs/EXPERIMENTAL_PROGRAMME.md`: Capture V2 (`src/lib/capture-v2`), New Project V2 (`src/lib/new-project-v2`), Desert theme, independent-review follow-up commits (`e6fe704`, `3926b64`). **No material discrepancy — did not STOP.**
- Existing authority: `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md`, `docs/LUME_V1_KNOWN_DISCOVERIES.md`, `docs/README.md`, product pack (`LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md`, Ocean baseline).
- Current-truth paths: `serializeCanonicalTruth`, MissionState/`store.tsx`, hydrate (`load-mission-state`, `/api/workspace/state`, paint cache), Capture V2 world, legacy `buildCaptureContext`, Tell Me snapshots, Coach `projectBundle`, KC frames, history, sessionStorage/localStorage keys, recommendations generators.
- All `src/app/api/**/route.ts` files and AI call sites for client-supplied `MissionState`.
- `src/lib/capture/apply/*` (plan/execute/world/scope).
- Schema (`supabase/migrations/20260812002748_workspace_schema.sql` + canonical metadata), `persistNewProject` / `persistProjectDelete`.
- People: `src/lib/people/identity.ts`, `waiting_on` text, exact-name coupling.
- Dual paths in §19 vs live flags. Unmounted `CaptureBar`. Coach still in `AppShell`.
- Magic Patterns: **no local artefacts**.

## 2. What materially changed since the existing handoff

The 25 Aug handoff already knew Phase 3B, the V2 **flags**, Desert, and most domain authorities. This SHA additionally contains the V2 **code** and review fixes. What was **not** decided or mapped sharply enough:

- AI routes still take browser `MissionState` as the model’s current truth (now D-033).
- Capture apply plans against that client world, with no row `version` (now D-034).
- Waiting/open-loop **authority** was still “ambiguous”; it is now decided (not implemented).
- Person **target** is workspace-scoped identity + project participation (handoff previously froze “do not global-merge”).
- Coach is a live shell surface despite Coaching being out of V1 constitution.
- Dual-path table had removal *conditions* but not **earliest deletion points**.
- No MP artefacts in-repo for the sibling UX stream.

## 3. Which architectural assumptions were confirmed

- Capture V2 is the target V1 Capture understanding engine; Phase 3B `planCaptureApply` is the single Capture mutation safety boundary.
- `serializeCanonicalTruth` is the starting (and sufficient) current-truth **projection** — assembler, not a new store.
- MissionState is cache; durable tables are authority.
- History is evidence; canonical Ask already omits it on current-state questions.
- Domain `risks` beat Knowledge risk prose.
- Stakeholders + structured responsibilities beat people prose; stable IDs own identity; exact-name match is a temporary resolver only — **a name is not identity**; no unique-name constraint.
- New Project / project delete server routes are the right persist-first pattern to copy.
- Workspace RLS is membership, not per-project ACL — `projectId` filters stay in the app.
- Prefer reuse/deletion over new engines. Rejected list in the programme remains rejected.
- Magic Patterns V1 UX is product, not a later reskin — but it is not in this repo.

## 4. Which assumptions were challenged

- “People are project-scoped entities” as a **standing** rule — still true **today**; **DECIDED V1 TARGET** is workspace Person + participation. **A name is not identity** (unique-name-as-constraint **rejected**).
- Treating Coach as a third AI product surface to migrate carefully — constitution parks it; invest in hiding, not a Coach assembler.
- `updated_at` as if it were concurrency — it is not used on writes.
- Intelligence snapshots as a compression strategy for V1 — they compete with current truth on the legacy Ask path and should not be a second projection.
- Stretching Phase 3B into an app-wide command framework — **rejected**. It stays Capture-only.
- Waiting: “decide later” is no longer acceptable; concatenation as a **view** is fine, dual **authority** is not.

## 5. One-authority decisions / recommendations

| Concern | Authority |
| --- | --- |
| Current project truth (recall) | Durable tables → server load → **`serializeCanonicalTruth`** |
| Capture observations | Capture V2 against an **ID catalogue derived from those same tables** |
| Capture writes | Phase 3B `planCaptureApply` after review |
| Waiting *work* | `todos` WAITING/CHASE/`waitingOn` |
| Open-loop *narrative* | Knowledge `openLoops` / `open_loop` until promoted (supersede) or closed |
| ✦ Lume noticed | `recommendations` table lifecycle; generators are not truth |
| History | `history_events` + item provenance — evidence only |
| Risks | `risks` table |
| People (now) | Project `stakeholders` UUID |
| People (target) | Workspace `people` + project participation. **Stable IDs own identity. Name is not identity. No unique-name constraint.** |
| UI working copy | MissionState cache |

Full inventory and dual-path table: handoff **Part C**.

## 6. Server-truth migration recommendation

Lowest-risk order, copying `/api/workspace/projects` and `/api/new-project`:

1. `/api/tell-me` + `/api/tell-me/refresh` — drop required `state`; load with `loadMissionStateFromSupabase`; run existing `serializeCanonicalTruth`.
2. `/api/capture` — same load for `projectId`; V2 world from that load.
3. Apply execution — plan against the fresh world (D-034).
4. Coach — only if it remains; prefer retire.

**Gains (accurate):** freshness; client-forgery resistance *within* a workspace session; predictable context; payload and model-cost control; simpler truth; app-layer project scoping.

**Not the story:** “this is how we fix IDOR.” RLS already isolates tenants. Project ACL stays application-layer because workspace RLS is broader than one project.

## 7. Person / entity recommendation

Smallest future schema: `people(workspace_id, display_name)` + `stakeholders.person_id`. **No unique constraint on name.** `UNIQUE (project_id, person_id)` is an ID participation constraint only. Remap `meta.responsibility.personId` as an explicit 1:1 mapping from existing stakeholder UUIDs — **do not collapse same-name rows**. Add `todos.waiting_on_person_id`; keep text name as display cache. Name-only resolution: if ambiguous, Needs you.

**Issue stress-test:** a future first-class `issues` table can FK to people, risks, milestones, todos, knowledge/decisions, and evidence the same way `risks` already does. **No Entity-Everything table. Do not implement Issues. Do not do the Person table in the first implementation slice.**

Until then: stop adding new text-only relationships when a Person UUID is already known.

## 8. Database / concurrency implications

- New Project compensating cleanup does not run if the process dies mid-insert → one `create_project_bundle` RPC.
- D-028 sequential delete → `delete_project_bundle` **or** CASCADE those SET NULL FKs.
- Hot tables need integer `version` when apply revalidation lands; `updated_at` is insufficient.
- **Do not** add unique stakeholder/person **names**. Identity is the stable UUID. Same-name people must remain representable.
- **Invariant (D-035):** every project-domain mutation must verify that the target durable object belongs to the intended project before mutation. `persistTodoUpdate` is one known instance. Later implementation/test pass audits the class. Not this branch.
- Do **not** unique project `code` without the D-026 product decision.
- Do **not** build a generic transaction framework.

## 9. Legacy paths proposed for deletion and earliest deletion point

| Path | Earliest deletion |
| --- | --- |
| `CaptureBar` / `capture()` / `captureWithAI()` / `applyCaptureResult` immediate merge | **Next implementation slice** — already unmounted from Ocean |
| Legacy OpenAI Capture findings path | **When Capture V2 is default-on after required gates** (git rollback) |
| Legacy New Project Talk assemble | After New Project V2 default-on |
| Legacy Ask `buildCaptureContext` + snapshot-as-truth | After canonical default-on + one release of `LUME_CANONICAL_TRUTH=0` rollback |
| Coach as V1 surface | QOL/shell slice — hide/retire, don’t rewrite |
| Client Capture session lists | Phase 3D (`capture_sessions`) |
| Ocean vs Desert | **Keep both** |

The dual-path table is written so it can get **shorter** as those slices land, not in one terminal cleanup.

## 10. Anything the current V1 plan still misses

- Client MissionState as AI context was under-specified (D-033).
- Apply vs durable concurrency (D-034).
- Project-domain mutations must verify intended project membership (D-035) — class, not Todo-only.
- Coach vs parked-Coaching constitution.
- Snapshot compression temptation (reject as a second truth projection).
- Large-project control belongs in assembler caps, not a new snapshot store.
- MP UX is in-scope but artefacts are absent locally.
- Playwright / property tests are **UNRESOLVED** (Test workstream); existing `verify-*` suite is CURRENT.
- Privacy: server-load does not stop the model seeing project data; it stops the browser choosing which rows are “current.”

## 11. What you explicitly recommend NOT building

Generic Truth Engine; Hygiene Engine; reconciliation daemon; event-sourced rewrite; second persistence layer; Entity-Everything table; unique-name-as-identity constraint; giant AI orchestration; permanent dual Capture engines; permanent dual truth projections; app-wide command bus wrapping Phase 3B; Redux/Zustand; vector DB; Advise; Issues; Person table in slice 1; Redis rate limiter “just in case.”

## 12. Cross-workstream dependencies

- **Test workstream:** lock `serializeCanonicalTruth`, Phase 3B, waiting concatenation, and Capture V2 gates **before** deleting live dual engines or flipping production defaults.
- **Magic Patterns workstream:** Waiting view vs two authorities; durable ✦ Lume noticed accept/dismiss; whether Coach leaves the shell; Capture V2 review chrome reuse; Desert = tokens only; no CRM People UI.
- **Experimental PR #66:** do not merge from this review; do not cherry-pick sibling branches.
- This docs PR is intended to be reviewed first as authority so Test/MP can reconcile against it.

## 13. Risks

- Flipping canonical Ask or Capture V2 without the test gates (D-010, D-032).
- Person `personId` remap silently breaking responsibilities if mixed into an unrelated slice.
- Bundle RPC scope creep into a “mutation platform.”
- Docs drift if Part C is ignored and a fourth architecture audit is commissioned.
- Hiding Coach without MP agreeing the Intelligence strip layout.

## 14. Tech debt this direction would create

- Flags remain until each deletion point.
- Temporary dual persist semantics until Capture todo/Confirm Owner are persist-first.
- Later Person migration (stakeholder id → people id) is real, one-time debt.
- `deriveLegacyStructured` stays as a read compatibility shim until structured overlay covers active projects.

## 15. Existing tech debt it would remove

- Two OpenAI Capture understanding engines.
- Two Ask assemblers and History-as-current-truth on the default path.
- Immediate-merge Capture + dead `CaptureBar`.
- Browser-forged AI context.
- Competing waiting authorities (once implemented).
- Suggestions that resurrect on reload (once D-003 is done).
- Crash/partial-delete classes (once bundle RPCs/CASCADE land).
- Coach as a third context builder (once hidden).

## 16. Exact files changed

- `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` (header, target notes, §19 deletion conditions, Part C; Thor amendment: status register C0a, name≠identity, D-035 invariant)
- `docs/LUME_V1_KNOWN_DISCOVERIES.md` (D-008/D-021/D-032 notes; D-033; D-034; **D-035**; fix order)
- `docs/README.md` (authority pointer)
- `docs/EXPERIMENTAL_PROGRAMME.md` (convergence binding pointer)
- `docs/V1_CONVERGENCE_ARCHITECTURE_COMPLETION.md` (this report, including Thor amendment)

No production code, schema, UI, or Magic Patterns files.

## 17. Tests/checks run, if any

None required for a docs-only delta. Ancestry and path inventory were verified by git/`gh` and code inspection (`serialize.ts`, API routes, `capture/apply`, schema, `store.tsx`, grep for `CaptureBar` importers).

## 18. Recommendation: merge docs / revise first / reject

**Merge docs** after review (this PR only), **including the Thor amendment**. Do not merge to `main` as an implementation. Do not merge #66 from here. Do not start implementation automatically.

If reviewers disagree on workspace-scoped Person **timing** or Coach retirement, revise those two Part C rows before the first implementation slice — everything else can proceed. Unique-name-as-identity is **not** open for revival.

---

ARCHITECTURAL CONVERGENCE VERDICT

**READY WITH SPECIFIC CONDITIONS**

Conditions:

1. Tests lock current behaviour of canonical serialize, Phase 3B apply, and Waiting concatenation **before** deleting live dual engines.
2. First implementation slice is **not** Person table, Issues, event sourcing, or a new mutation framework.
3. First code slices, in order: dead Capture merge path → Tell Me server-load → Capture server-load / V2 default-on → delete legacy understanding path.
4. Bundle RPCs and `version` columns are a dedicated integrity/concurrency slice.
5. Canonical Ask default-on only with eval/product evidence; keep `LUME_CANONICAL_TRUTH=0` rollback for one release.
6. Magic Patterns owns UX of Waiting distinction, Coach hide, and Ocean/Desert; this workstream does not implement UI.
7. Do not begin implementation from this PR.
