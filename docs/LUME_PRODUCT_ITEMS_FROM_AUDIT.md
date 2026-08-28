# Lume product items from the investigation audits

**Status:** Extract. Not coaching work. Not a Known Discoveries filing.  
**Date:** 28 August 2026  
**Source:** Platform, privacy/billing, UX, and architecture audits done during the coaching-product investigation (Parts 1–2). Inspected `main` HEAD `e5cd9ba8e183f7a42f8f5c74aef73c3c7d73d54f`.  
**This file does:** list defects and product decisions that belong to **Lume**.  
**This file does not:** recommend a coaching product, a fork, naming, pricing, or shared-platform work.

Items already in `docs/LUME_V1_KNOWN_DISCOVERIES.md` are **not** restated as new work. They are listed once at the end as confirmed, so this extract does not replace that backlog.

Promote any **new** item into Known Discoveries (full D-xxx template) when a Lume slice owns it. Until then, this file is a triage list only.

---

## Rank 1 — Launch / trust (address for Lume V1)

These are user-rights, truth-integrity, or advertised-capability gaps. They are not coaching-specific.

### 1. No account deletion

There is no route, UI, or code path that deletes a user account or workspace. An RLS policy allows an owner to delete a workspace row; nothing calls it. A right-to-erasure request today requires manual work in the Supabase dashboard.

Evidence: repo-wide search; `docs/current-state/LUME_CURRENT_STATE.md` already noted “no … deletion”; confirmed still true.

### 2. No data export

There is no export route, button, or serialiser. A user cannot take their project truth with them.

Evidence: repo-wide search; same current-state note.

### 3. No privacy policy / terms

Still absent. Required for real users independently of any other product. Same current-state note; the later audits did not find these pages.

### 4. Capture still writes on identity-ambiguity and unresolved targets

Published live Capture V2 evaluation (Test Dashboard, scorer v1) records **LUME FAILURE** counts of 5 / 9 / 16 across models, including:

- `ambiguous-same-first-name → write — Must not silently CREATE another Brick`
- `mixed-domains → write — Unresolved target became CREATE`

On the controlled 45-case benchmark, generic GPT scored **32/45** vs Lume **30/45** (legacy) and **23/45** (canonical). A v3 scorer exists in the repo; published rows are still v1 — do not treat the numbers as current until republished, but the failure *class* (ambiguous person → CREATE) is a Lume trust defect regardless of coaching.

Evidence: `docs/TEST_DASHBOARD.md`; Issue #73 dashboard; Part 1 §Y / uncomfortable reliability.

### 5. Provenance does not reach the source

Capture writes `provenance: [{ type: "capture", at: <timestamp> }]` with the optional `id` **unset**. Durable facts are not foreign-keyed to `capture_sessions`. `todos`, `risks`, and `milestones` have no provenance column.

Lume can say a fact was “learned from a Capture” and *when*. It cannot show the sentence, or the capture session, that produced it. Knowledge Centre “Why Lume believes this” is weaker than the product claim.

Evidence: `src/lib/capture/apply/persist-execute.ts` (around line 191); `src/lib/capture/apply/memory-execute.ts` (around line 204).

### 6. Meeting Prep does not persist — retain or disable

The V1 constitution says retain Meeting Prep if stable/useful, else disable before launch (`LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md` §16). It is **not** stable: `updateMeeting` in `src/lib/store.tsx` mutates local state only. Hydrate reads `meetings`; there are **no** `.from("meetings")` writes outside the loader. Prep edits are lost on reload.

Decision for Lume: persist it properly, or remove/disable the surface before launch. Do not leave a frame that looks saved.

Evidence: `src/lib/store.tsx` `updateMeeting`; `src/lib/data/supabase/load-mission-state.ts`; `src/components/meetings/MeetingBriefModal.tsx`.

### 7. Project-delete erasure depends on a hand-maintained SET NULL list

Related to **D-028** (sequential, not transactional) but a distinct integrity hole.

`PROJECT_BUNDLE_SET_NULL_TABLES` is a hand-maintained array (`todos`, `memories`, `recommendations`, `history_events`, `capture_sessions`, `coach_sessions`). Those tables use `ON DELETE SET NULL`. Content-bearing rows (`capture_sessions.transcript`, `coach_sessions.markdown`) are cleaned **only because they are listed**. A future project-scoped SET NULL table that is omitted from the array will survive deletion with an orphaned null `project_id`, still holding content.

Evidence: `src/lib/data/supabase/persist-mutations.ts` lines 38–45 and the delete loop; `scripts/verify-project-delete.ts`.

---

## Rank 2 — Product honesty / leftover surfaces

### 8. Dual Capture / New Project / Ask engines while flags are on

Already **D-032**. Confirmed and sharpened: Capture V2 (`src/lib/capture-v2/prompt.ts`, 46-line prompt) does **not** use `src/ai/domain` / `project-domain.md`. Those serve the **legacy** path. V1 convergence (handoff Part C) already commits to deleting the legacy halves. Until that lands, Lume is mid-refactor and eval numbers split across two engines.

### 9. Coach is parked in the constitution but leftover surfaces remain

Already **D-031** (drawer auto-opens). The UX audit added: `CoachButton`, `CoachPreview`, `HeaderCoachButton` are unreachable; `/api/coach` and `/coaching` still exist; Ocean Advise is “coming soon”. Decide: delete the dead Coach UI and park the API, or finish Advise. Do not leave both.

### 10. Stranded routes still live

`/memory`, `/meetings`, `/meetings/[id]`, `/releases` are reachable URLs with no Ocean sidebar entry. `AppShell` still special-cases their titles. Either wire them into the product or remove them.

Evidence: `src/app/meetings/page.tsx`, `src/app/meetings/[id]/page.tsx`, `src/components/AppShell.tsx`.

### 11. Dead UI is ~15% of the component tree

Unreachable from any route (~2,588 LOC, 10 files):

- `ProjectWidgetGrid`, `ProjectKnowledgeBrief`, `CloneRelOpsButton`
- `CoachButton`, `CoachPreview`, `HeaderCoachButton`
- `frames/RiskFrame`, `frames/NudgeFrame`
- `workspace/WorkspaceGrid`, `workspace/WorkspaceCustomiser`

Delete before they are mistaken for live architecture. The pre-Ocean `frameRegistry` in that dead code is historically interesting; it is not current.

### 12. File upload in Capture is a stub

`addFileName` / `source: "uploaded"` exist in `CaptureSessionContext` and have **no caller**. Do not advertise upload. Either wire a real path or remove the dead API so it cannot be mistaken for shipped.

### 13. No relative-date normalisation

Phrases like “next Friday” are not resolved to a calendar date anywhere in `src/lib`. Capture can store a string; it cannot make a date fact. Either add normalisation with an explicit “Lume assumed” marker, or keep dates as Needs you when they are relative. Do not silently invent a day.

### 14. Entitlement gates AI, not the product — confirm on purpose

`requireAiCaller` blocks Capture, Coach, Tell Me, transcription, and New Project after trial expiry. Workspace/project CRUD stays open. For Lume this may be deliberate (read-your-data after lapse). It is currently inherited, not chosen in product copy. Confirm: expired trial = AI off, data still yours — or lock the workspace.

Already related: **D-024** (local analysis meter, not Stripe; `load-mission-state` hardcodes `analyses_this_month` to 0).

---

## Rank 3 — Security / ops hygiene

Not all are launch blockers at small scale. All are real.

### 15. Logging is safe by accident, not by design

`src/lib/server-log.ts` redacts by **key name** (`password`, `token`, `secret`, …) plus truncation. No current call site logs capture content — they log ids, feature names, and `error.message`. Postgres constraint-violation messages routinely embed the offending row’s text. A field named `detail` or `title` would be logged verbatim.

Fix direction: allowlist logged fields; sanitise database `error.message` before log.

### 16. Capture route has no payload size cap

Content is `.trim()`ed and checked non-empty, then sent. Only New Project truncates (12,000 characters, inside a template string). Add a hard cap on Capture analyse/apply bodies.

### 17. Production config audit is not wired at boot

`assertProductionConfigOrThrow()` exists and is thorough. It is **never** called from `proxy.ts`, `next.config.ts`, or any request path. It runs only in `scripts/verify-production-config.ts`. A misconfigured production deploy is not fail-closed at runtime.

### 18. Staging is unauthenticated if `NODE_ENV !== "production"`

`requireAiCaller` in `src/lib/ai-gate.ts` returns `{ ok: true, userId: "local-dev" }` when auth mode is `none` and `NODE_ENV !== "production"`. A publicly reachable staging deploy without `NODE_ENV=production` would be open.

### 19. Rate limit is in-memory per process

`src/lib/rate-limit.ts` is documented as fine for a single instance. On serverless the effective limit is `limit × instances`. Acceptable at current scale; not an exfiltration control. Do not treat it as one.

### 20. `supabase/config.toml` points at a missing `seed.sql`

`sql_paths = ["./seed.sql"]` — the file is not in the repository. Local reset/seed will fail or no-op depending on CLI behaviour. Point at a real seed or remove the path.

---

## Rank 4 — Docs / eval honesty (cheap, do not skip)

### 21. D-035 todo wording is stale; the persist-helper class is still open

`persistTodoUpdate` / `persistTodoDelete` **already** scope by workspace + current project via `scopeExistingTodo` (`persist-mutations.ts`). Known Discoveries still describes them as id-only UPDATE/DELETE. **Update the discovery text.** The remaining work is the rest of the persist helpers (knowledge_items, milestones, stakeholders, memories, recommendations, history_events, sessions — inventory, do not assume). `persistRiskStatus` already filters `id` + `project_id` + `workspace_id`.

### 22. Published eval rows are scorer v1 while v3 exists

Republish the Test Dashboard from v3, or label v1 as historical, so the 5/9/16 LUME FAILURE counts are not read as current product quality if they are not.

### 23. Root README is still localStorage-era

`docs/README.md` already says the root README is not product/architecture authority. It still misleads anyone who starts there. Refresh or stub it to point at `docs/README.md`.

### 24. Theme tokens in `globals.css` are not co-located

Some `[data-theme]` variables live at the top of the file, others around line 5690. A third theme (or a token edit) can silently miss variables. Hygiene, not a user-facing bug.

---

## Explicitly not Lume work (do not file from this extract)

These belong to the coaching investigation only:

- ICP, pricing, naming (Ballast / Weft), CoachRocks / category occupancy
- Fork vs monorepo vs shared services; `SYNC.md`; separate Stripe/Supabase
- Client / Engagement / Session schema; psychological-inference deny-list
- Catch Me Up as a coaching surface (Lume does not claim it)
- Form primitive library and hard-coded nav JSX (architecture notes, not Lume defects)
- PARK / WEAK OPPORTUNITY recommendation

---

## Already in Known Discoveries — audit confirmed, do not re-file

Open unless noted. The audit did not close any of these.

| ID | Title (short) |
| --- | --- |
| D-003 | Suggestion accept/dismiss is memory-only |
| D-004 | Many History events never persist |
| D-005 | Invisible / soft save failures |
| D-007 | People split across stakeholders + Knowledge people |
| D-008 / D-021 | Waiting / open-loop dual representation |
| D-010 | Legacy Ask still injects History as competing truth |
| D-011 | Demo-name regex extractors in write-adjacent paths |
| D-012 | Hand-maintained `database.ts` lags migrations |
| D-013 | Capture/coach session tables underused |
| D-014 | Live Capture apply → Supabase round-trip not in CI |
| D-015 | Historical `[Resolved]` titles may exist as open risks |
| D-016 | Weak wording edits may lose Knowledge identity (limit) |
| D-020 | Dependencies / availability lack dedicated Ask domains |
| D-024 | “Actions left” uses local analysis meter, not billing |
| D-025 | Capture Ocean discrete visual states still coarse |
| D-026 | Workspace + project-code uniqueness is not durable |
| D-027 | No archive / undo after project deletion |
| D-028 | Project delete is sequential, not one transaction |
| D-029 | Milestone complete has no durable status |
| D-030 | Leftover Knowledge prose can disagree with domain after apply |
| D-031 | Coach drawer auto-opens over Capture / Knowledge Centre |
| D-032 | Dual Capture / New Project pipelines while flags are on |
| D-033 | Some AI routes still accept browser-supplied MissionState (Tell Me + Capture V2 HTTP fixed; Coach + legacy Capture remain) |
| D-034 | No durable row versioning (fingerprint only on Capture V2 Apply) |
| D-035 | Persist-helper project-membership audit still open (todos now scoped; docs stale — see item 21) |

---

## Suggested Lume triage order

1. Identity-ambiguity / unresolved-target **LUME FAILURE** (item 4) — this is the trust claim.  
2. Meeting Prep: persist or disable (item 6).  
3. Account deletion + export + privacy/terms (items 1–3) before real users.  
4. Provenance `id` on Capture writes; then columns on todos/risks/milestones if KC should show source (item 5).  
5. Make SET NULL cleanup structural (CASCADE or a test that every SET NULL table is listed) (item 7 / D-028).  
6. Delete dead UI and stranded routes (items 10–11).  
7. Wire production config at boot; close staging `NODE_ENV` hole; cap Capture payloads; harden logs (items 15–18).  
8. File any Rank 1–2 items that survive triage as D-xxx in Known Discoveries, then delete or shrink this extract.
