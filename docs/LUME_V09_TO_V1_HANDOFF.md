# Lume v0.9 → V1 handoff

**Status:** Canonical operating picture for closed alpha and the path to public V1  
**Date:** 5 September 2026 (Ready → Apply closeout on `main`)  
**Merged main (this update):** `64171cde93e837f1f755c79b0c4c43aca502bd03` (PR #126 Ready → Apply safety)  
**Prior v0.9 closure SHA:** `0e68384a2271b2b27e0ac75b871ee26331a26db7` (D-036 PR #100)  
**Qualified Capture engine SHA:** `2131444c77c3b06b666df393362a50112d2de56f` (frozen Analyse engine; Apply safety extended by #126)  
**Production:** https://betterprojectmanager.vercel.app  
**Docs entry:** `docs/README.md`. **Integration line:** `main` only. Desert-era branches are not a development base.

# LUME v0.9 CLOSED

> **STOP BUILDING v0.9. BEGIN TESTER LEARNING.**  

This file answers: what v0.9 is, what is closed, what debt remains, what alpha should learn, and what is genuinely required for public V1.

It does **not** replace the product constitution in `docs/v1-reference-pack/`.  
If this file and an older PHASE/SLICE/experimental doc disagree, **this file + current code win**.

---

## Plain English

Lume v0.9 is a **safe closed-alpha product** for individual project managers.

Capture understands notes, shows a review, and only writes when the user approves. Difficult cases may Needs-you. That is success. Silent wrong writes are not.

Knowledge Centre is the project memory. Ask Lume recalls it. Catch Me Up briefs it. Advise is parked. Coach is hidden.

**Server-side tenant isolation is proven** on live production (Account A cannot read, Ask, Catch-Me-Up, Capture-apply, or delete Account B’s project).

**Same-browser logout → login isolation is proven** after D-036 (PR #100, production `0e68384`). Login/logout full-navigate and MissionState is owned by the authenticated `user.id`. A blank/loading workspace during the switch is correct. Testers may share a browser across accounts.

Do not reopen Capture. Do not start V1 architecture. Put Lume in testers’ hands.

---

## 1. What is Lume?

Thesis: **You can't keep an entire project in your head. Lume can.**

Lume is an individual-first project-memory companion. It is not a portfolio tool, not a generic entity platform, and not an autonomous PM.

It should earn confidence that it:

- knows the project;
- maintains truth only after review;
- helps the PM recover context;
- notices useful connections;
- does not silently guess when uncertain.

---

## 2. What exactly is in v0.9?

Top-level project modes:

> **Capture | Knowledge Centre | Catch Me Up | Advise (coming soon)**

| Surface | v0.9 reality |
| --- | --- |
| **Capture** | Sole live Analyse → Review → Apply engine is **Capture V2**. Model: `gpt-4o-mini-2024-07-18` only. Engine frozen. `LUME_CAPTURE_V2` **cannot** restore legacy Capture (`isCaptureV2Enabled()` always returns true). |
| **Review / Needs-you** | Nothing durable is written until approve. Needs-you is success for difficult/ambiguous cases. **Ready means the same production Apply path can execute that reviewed change** (PR #126). Apply still revalidates at write time. Client overrides cannot manufacture Ready. |
| **Annotated transcript** | Uses existing Capture evidence. Matching is exact / case-normalised only. Unmatched evidence stays unhighlighted. No second model/parser. |
| **Knowledge Centre** | Four retrieval buckets on `main` (All / Issues / People / To Do / Knowledge). Search stays `searchAuthoritativeProject`. Intelligence strip and Catch Me Up mode remain. D-030 row builders still feed search. |
| **Ask Lume** | Authenticated server-loaded canonical truth. Client-posted MissionState is ignored. |
| **Catch Me Up** | AI read-only briefing from authoritative server truth: where we are / attention / missed / noticed connections. Distinguishes known vs inferred. No mutation, no vector DB, no new memory store. |
| **New Project** | Four-frame compose on current `/api/new-project` (shared Capture extract). Organise notes is fail-closed. Needs You for uncertainty. No voice. Tags are metadata-only. |
| **Timeline** | Read-only projection of dated authoritative truth on `main`. **Intended product:** keep Timeline as that projection; retire the legacy writable Gantt *surface* non-destructively (see §3). **Current code:** the legacy Gantt UI still coexists until a later slice hides it. Do not add a second schedule store. |
| **Meeting Catch Me Up** | Meeting-scoped deterministic brief from stored project truth, not generic advice. Project Catch Me Up mode stays. Stored `Meeting.prep` rows are kept. |
| **Coach** | Hidden. Not a mode. Drawer unmounted. `/coaching` leftover route only. |
| **Advise** | Disabled / coming soon. |
| **Persistence** | Durable authority is **Supabase**. Production does not use localStorage as truth. In-memory/cache is UI only. Appearance/sidebar prefs may be local. |
| **Auth / trial** | Live Supabase Auth. 90-day trial confirmed (`trialing`, trial ends 11/26/2026 from a 28 Aug signup). Stripe not required for v0.9. |
| **Identity** | Individual-first. No portfolio. No workspace Person migration. |

### Capture freeze evidence

Live qualification on the integrated engine with `gpt-4o-mini-2024-07-18`:

| Metric | Result |
| --- | --- |
| LUME FAILURE | **0** |
| LUME CATCH | **22** |
| Domain accuracy | **100%** |
| Target-ID accuracy | **100%** |

The model made mistakes. Lume prevented those mistakes becoming genuine unsafe/silent durable writes (Category E).

Do **not** retune Capture because model-level metrics are imperfect.

Historical scorer-v1 failure counts are **not** current product safety. Current scorer is **v3**. See `src/lib/eval-capture-v2/README.md` and `docs/v1-convergence/V09_QUALIFICATION.md`.

---

## 3. Architecture / source of truth

| Kind | Authority |
| --- | --- |
| Durable project truth | Supabase tables, RLS by workspace membership |
| Capture / Ask / Catch Me Up current truth | Server load of the signed-in workspace, scoped to the requested project |
| UI hydrate | `MissionProvider` after `/api/workspace/state` (or browser client fallback) |
| Paint cache | `lume-mission-supabase-cache-v1` — last paint, cleared on logout, **must not** outrank server truth |
| Local drafts / prefs | Appearance, sidebar collapse, first-run cues |

Client MissionState is **not** Capture Apply authority.

Project isolation inside a workspace is **application-layer** (RLS is workspace-wide). Cross-account isolation is RLS + server project membership checks.

### 3.1 Standing rule — actions create canonical truth first

This is a **Lume-wide** rule, not a Timeline-only rule. Future agents must read it before adding interactive surfaces.

> **Actions must create or update canonical project truth based on the currently established architecture and contracts, then re-project that truth into the relevant product surfaces. Actions must never create their own parallel or feature-specific truth.**

This applies regardless of where the action originates (Timeline, Knowledge Centre, Review, New Project, Meeting Catch Me Up, Advise, a future Gantt, or any later surface). The initiating surface must not become its own data authority.

Required flow:

```text
User action in a product surface
  → existing canonical write / domain contract
  → authoritative project truth changes
  → all projections re-read / re-project that truth
```

Forbidden flow:

```text
User action in a product surface
  → special surface-specific record/store
  → separate competing truth
```

Use the **then-current** established canonical architecture. Do not hard-code future features to today’s exact tables, helpers, or apply path if that architecture later evolves. The invariant is: *use the then-current established canonical architecture rather than inventing a parallel truth path.*

A new surface is a view, workflow, or entry point into canonical truth **unless** an explicit architecture decision establishes a new canonical domain model. New UX must not automatically imply new storage.

If a requested item does not map safely to an existing canonical domain, use Review / Needs You / the then-current canonical creation workflow. Do not invent a feature-specific type merely because the click started in that feature.

### 3.2 Timeline is a projection

> **Timeline is a projection of authoritative dated project truth, not an independent source of truth.**

It may display meetings, deadlines/milestones, dated To Dos, person availability/away dates, dated Knowledge, and other future *canonical* dated project items.

Timeline-specific storage must not compete with the authoritative project-truth spine. This is a concrete application of §3.1.

**Future Timeline Add** may exist as UX. Add must not create a special timeline-only item.

```text
Timeline Add
  → create/update the appropriate canonical project record
    through the then-current canonical truth/write contracts
  → authoritative project truth changes
  → Timeline re-projects that new truth
```

Examples: Add meeting → a real Meeting; Add milestone/deadline → the appropriate canonical dated item; Add dated To Do → a real To Do with its date; Add person away → authoritative person availability; Add dated Knowledge → authoritative Knowledge.

Do **not** create a generic `timeline_item` merely because the interaction began inside Timeline, unless that type has itself become part of the canonical domain architecture through a separate product/architecture decision.

### 3.3 Legacy writable Gantt — retire the surface, not the data

The legacy writable Gantt is **retired from the intended product experience**.

This is **not** “delete the old Gantt.” Immediate intended implementation (a later slice — not this documentation task):

- remove/hide the legacy Gantt from the normal production UI;
- do **not** delete underlying records, schema, helpers, or shared date functionality merely because the UI is retired;
- first establish whether any current functionality depends on shared Gantt/date infrastructure;
- protect anything used by modern Timeline, milestones, meetings, deadlines, person dates, Catch Me Up, or other authoritative project truth;
- preserve existing legacy Gantt data until a later explicit cleanup/migration proves it is safe to remove.

A future cleanup may remove dead Gantt code/data **only** when proven unused and safe. That is a separate task after dependency/data analysis.

**Current code still shows the writable Gantt** beside the Timeline glance. Testers and agents must not treat that leftover UI as the intended product, and must not “clean it up” by deleting schema or date helpers.

### 3.4 Future Gantt / planning surfaces

If Lume later gets a richer Gantt or planning experience, it must:

- derive from the **same** authoritative dated truth used by Timeline; or
- use a dedicated creation/editing wizard that writes canonical project records through the then-current canonical architecture.

It must **not** resurrect the legacy model where Gantt maintains an independent schedule/truth store.

A future Gantt may be a richer projection, a planning/editor surface over canonical records, or a wizard that creates canonical dated project truth. The source of truth remains the established project-truth architecture.

```text
Gantt action → canonical project truth → Gantt and other surfaces re-project
```

Never: `Gantt action → Gantt-owned truth`.

### 3.5 Same rule on other surfaces

Not limited to dates.

| Surface | Required | Forbidden |
| --- | --- | --- |
| Knowledge Centre | KC action → canonical domain mutation → KC re-projects | KC-owned copies of project records |
| Meeting Catch Me Up | Meeting action → canonical project truth → brief re-projects | Meeting-brief-owned truth |
| Advise | Suggestion/action → normal Review / canonical write path → truth changes → surfaces refresh | Advise private truth, or bypassing Review |
| New Project / Review | Already on the Capture / compose / Apply contracts | A second compose or review store |
| Any future surface | View, workflow, or entry point into canonical truth | New storage implied by new UX |

---

## 4. What is parked / hidden

| Item | Status | Do not |
| --- | --- | --- |
| Advise | Coming soon | Build it during alpha; do not give it a private truth model (§3.1) |
| Coach | Hidden | Redesign or auto-open |
| Legacy writable Gantt | **Retired from intended UX.** Still visible in current code. Hide the surface later; do not delete records/schema/helpers until proven unused (§3.3) | Treat leftover Gantt UI as product; delete Gantt data to “clean up” |
| Stripe / landing / pricing | Not required for closed alpha | Treat Legal Eagle PR #88 as current production — it was **not** the v0.9 merge |
| Portfolio | Not required for V1 unless evidence changes | Build a home dashboard |
| File upload | `addFileName` exists, **no caller** | Promise upload for V1 |

Leftover bookmarkable routes that are **not** the v0.9 product: `/memory`, `/meetings`, `/releases`, `/coaching`. Do not delete 15% of the repo. Hide or redirect before public V1 if they confuse testers.

---

## 5. Closed-alpha status

| Gate | Result |
| --- | --- |
| Capture engine freeze | **Pass** |
| Production smoke (single account) | **Pass** — New Project, Capture, Review, Apply, KC, reload, Ask, Catch Me Up, same-account A/B isolation, Todo delete, project delete, mobile, 90-day trial |
| `NEXT_PUBLIC_SITE_URL` | **Closed** — owner confirmed Production + Preview; live confirmation email redirected to `https://betterprojectmanager.vercel.app/auth/callback` |
| Live two-account **server** isolation | **Pass** — 404/fail-closed, no payload, no mutation |
| Live two-account **session-switch UI** | **Pass** — D-036 CLOSED on production `0e68384` (B→A and A→B; loading/reset during switch; no previous-user project truth) |

v0.9 may be used by **trusted testers**.

# LUME v0.9 CLOSED

> **STOP BUILDING v0.9. BEGIN TESTER LEARNING.**

---

## 6. Live two-account isolation (28 Aug 2026)

Synthetic data only. Production https://betterprojectmanager.vercel.app. No service role on the attacker side.

### Accounts (no credentials)

| | Account A | Account B |
| --- | --- | --- |
| Login | `fotepay523@slotbeer.com` | `lumeiso23f0ac43@emalupe.com` (Iso Bravo) |
| Auth user | `541360f6-44e0-4985-b401-f30dd3c2ee4a` | `d4cf92a4-96fa-4362-883d-93631b9be6a6` |
| Workspace | `1324e810-8fd7-482b-bb72-39229fc2ab25` | `987244a5-a612-4d10-a0aa-c42ed8fb0a90` |
| Project | `TENANT-A Lighthouse Launch` `a84a7601-ecdb-4e01-bf67-137ab83acb19` | `TENANT-B Redwood Archive` `2b691efb-765f-492f-8728-a4ac2ee0e0e4` |
| Markers | Alice Isolation; Beacon Switch-On 12 Oct 2026; Order blue lighthouse lens; Harbour permit delay | Brian Boundary; Archive Opening 22 Nov 2026; Digitise red ledger; Scanner procurement delay |

Workspaces and users are distinct.

### UI isolation

While A: sidebar and KC show only A’s (plus A’s earlier Northbridge smoke project). No Brian / Redwood / ledger.

While B: only TENANT-B. No Alice / Lighthouse / Northbridge.

Direct visit as B to A’s project URL: **“Project not found.”** No A facts.

### Ask Lume

| Caller | Question | Result |
| --- | --- | --- |
| A on A’s project | Who is Brian Boundary? | “Brian Boundary is not mentioned in the current project state.” |
| B on B’s project | Who is Alice Isolation? | “Alice Isolation is not mentioned in the current authoritative project state.” |
| A posting B’s `projectId` | Who is Brian Boundary? | **404** `project_not_found` — no facts |
| B posting A’s `projectId` | Who is Alice Isolation? | **404** `project_not_found` — no facts |

### Catch Me Up

A briefing: Alice, Lighthouse, harbour permit, Beacon 12 Oct. No B identifiers.

B briefing: Brian, Redwood/TBR, scanner procurement, Archive Opening 22 Nov. No A identifiers.

Foreign `projectId`: **404** `That project is not in this workspace.`

### Foreign Capture / delete

As A against B’s project (and symmetrically B against A):

| Route | Result |
| --- | --- |
| `POST /api/capture` (Analyse) | 404 `project_not_found` |
| `POST /api/capture/apply` | 404 `project_not_found` |
| `DELETE /api/workspace/projects/:foreignId` | 404 `not_found` |

A’s todo `Order blue lighthouse lens` (`b8f54449-…`) remained `done: false` after B’s apply/delete attempts. Title and project assignment unchanged.

### Session switch (the failure)

1. B logged in on TENANT-B.
2. Sign out (localStorage cache **was** cleared — `lume-mission-supabase-cache-v1` empty).
3. A signed in via SPA `router.replace` (MissionProvider **not** remounted).
4. URL still `/projects/<B-id>`.
5. **UI showed TENANT-B / Brian Boundary / Digitise red ledger while the chrome user was `fotepay523`.**
6. `GET /api/workspace/state` for that same A session returned **only A’s workspace** (Northbridge + TENANT-A; no Brian).
7. Ask on that leaked UI with B’s project id: **“Project not found or you do not have access to it.”**
8. Full navigation to A’s project remounted the provider and showed A’s truth correctly.

Cause: `MissionProvider` hydrate effect runs once. `onAuthStateChange` ignores `SIGNED_IN` once `hydrateSucceeded` is true. Logout clears localStorage but **not** React `MissionState`.

This is not an RLS/IDOR break. Mutations still fail closed. It **was** cross-account truth **display** on a shared browser (D-036).

### D-036 repair (28 Aug 2026, production `0e68384`, PR #100)

Option C: reset owned MissionState when authenticated `user.id` changes, plus full document navigation on login/logout/signup. Durable cache is not painted unless it matches the hydrated user. Regression: `scripts/verify-d036-session-switch.ts`.

Live retest on production (same two accounts, same browser):

- B → A: after logout and A sign-in, B project/facts never rendered as current workspace truth; A workspace loaded; `/api/workspace/state` A-only; Ask/Catch Me Up on B project id 404; Ask/Catch Me Up on A project did not include B facts; foreign DELETE 404.
- A → B: symmetric pass.
- Loading/reset during the switch is correct.

### Isolation verdict

**PASS — D-036 CLOSED, LIVE TENANT ISOLATION PROVEN**

Server/API/RLS isolation: **proven**. Same-browser session-switch: **proven**.

---

## 7. What alpha should learn

This is an observation backlog, not a build list. Record notes here or in Known Discoveries as **TESTER EVIDENCE**.

- Do people understand Capture without founder coaching?
- Do they trust Review / Needs-you?
- Does the annotated transcript create confidence?
- Does Knowledge Centre replace mental tracking?
- Do they use Ask Lume?
- Is Catch Me Up valuable?
- What did they expect Lume to remember that it did not?
- What disappears / reappears unexpectedly?
- What felt saved but was not?
- Do they return after several days?
- What would make them unwilling to lose the accumulated project memory?
- Needs-you frequency and Capture inputs that fail naturally
- “I would pay for this if…” evidence

Do not build speculative features before seeing use.

---

## 8. v0.9 → V1 roadmap

Compact and evidence-sensitive. Not a debt museum.

### Closed alpha learning — now

**Why:** v0.9’s job is to learn whether the product thesis is true.

Ship to trusted testers. Watch the questions in §7.

### V1 launch / trust foundation

**Why:** paying members of the public need an exit, a copy of their data, and honest persistence.

| Item | Why this stage |
| --- | --- |
| Account deletion | No whole-account delete exists |
| Export (user/project) | No export exists |
| Terms / Privacy | Deliberately deferred for trusted alpha; required for public/commercial |
| Meeting Prep persist **or** remove misleading edit | `updateMeeting` is memory-only; hydrate reads durable meetings |
| Entitlement after trial / Stripe when charging | Trial is 90 days; Stripe not configured; local “50 actions left” is not billing (D-024) |
| Hide leftover `/memory` `/coaching` `/releases` if testers find them | Confusion, not a repo-deletion programme |
| Basic ops: call `assertProductionConfigOrThrow` at boot; payload cap on Capture; don’t log row text in `error.message` | Small boring hardening |

### V1 reliability (promote only if testers hit them)

| Item | Why |
| --- | --- |
| Ready vs Apply (D-037) | **Closed on `main` by PR #126.** Ready cannot claim a write Apply cannot plan. |
| Todo delete leaves Knowledge fact | Not resurrection; Current position still shows the text |
| `openaiConfigured` stale after login-page 401 | Hard refresh workaround |
| Suggestion accept/dismiss memory-only (D-003) | If testers use suggestions |
| Optimistic mutation failure UX (D-005 remainder) | Ordinary UI still optimistic with reconcile-on-failure |
| History persist gaps (D-004) | Needed if Change Intelligence reads History |

### V1 differentiating value — Project Change Intelligence

**Why:** Lume should visibly maintain truth over time, not only hold today’s snapshot.

Narrow product:

> After an approved Capture changes structured data: **What changed?** old → new, when, and Why/How where evidence exists.

Not: event sourcing, dependency graphs, autonomous history inference, generic provenance platform.

Today `history_events` stores `type`, `title`, `detail`, `source`, `project_id`. No entity/field/old/new columns. Diffs are prose.

Smallest future primitive (dedicated audit, not this task): one write-side helper used by Capture Apply (and later KC corrections) that records `{projectId, entityType, entityId, field, previous, next, at, evidenceRef?}`. History UI and Catch Me Up / Ask “how did we get here?” should **read that**, not invent a second store.

### Commercial launch

Landing, pricing, onboarding, Stripe — only to the level needed to acquire users. Individual-first. No enterprise controls.

### Explicitly deferred (unless evidence changes)

| Item | Why deferred |
| --- | --- |
| Portfolio | Individual-first; home already opens the first project |
| Vector DB / semantic Todo matching / fuzzy identity | Capture philosophy: exact identity, Needs-you when unsure |
| Generic entity architecture / workspace Person migration | Names are not identity; do not mint a uniqueness platform |
| Dependency graph engine | “Dependencies not structured yet” is honest |
| Correction NLP / Coach rebuild / autonomous mutation | Safety > automation |
| Schema-version concurrency platform | Explicitly rejected for v0.9; fingerprints are enough until proven otherwise |
| Full event sourcing / generic archive-undo | D-027 stays product-optional |
| Milestone completion architecture (D-029) | Not required to explain dates |
| Large-scale repo refactor | Does not help testers |

---

## 9. Documentation map (what must not govern implementation)

| Class | Documents |
| --- | --- |
| **CURRENT AUTHORITATIVE** | This file (including **§3.1–§3.5** for canonical actions / Timeline / Gantt); `docs/v1-reference-pack/`; `docs/LUME_V1_KNOWN_DISCOVERIES.md` (open vs resolved); `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` **except** stale Part A flag tables — **code wins** |
| **HISTORICAL — KEEP** | `docs/SLICE*`, `docs/PHASE*`, `docs/current-state/`, `docs/LUME_V1_PROJECT_TRUTH_ARCHITECTURE_AUDIT.md`, `docs/v1-convergence-mp/` (UX reference, not an implementation licence) |
| **SUPERSEDED — keep, do not follow** | `docs/EXPERIMENTAL_PROGRAMME.md` (Capture V2 is no longer experimental); qualification “Stage 2 blocked” text (updated); root README Mission Control copy |
| **DEAD / MISLEADING if treated as current** | Any claim that `LUME_CAPTURE_V2` selects engines; Coach auto-opens; Catch Me Up does not exist / is search; production localStorage is truth; v0.9 is an unfinished Phase 3 programme |

---

## 10. Bugs / debt snapshot

Living IDs: `docs/LUME_V1_KNOWN_DISCOVERIES.md`. Classifications below are the v0.9 closure verdict (28 Aug 2026).

| Item | Current status | Classification | Evidence | Proposed next point |
| --- | --- | --- | --- | --- |
| Capture V2 sole engine / `LUME_CAPTURE_V2` | Flag ignored; `isCaptureV2Enabled()` always true | CLOSED | `src/lib/capture-v2/flag.ts`; PR #95 | Do not restore a flag |
| Live gpt-4o-mini qualification | LUME FAILURE 0 / CATCH 22 / domain 100% / target-ID 100% | CLOSED | Engine SHA `2131444`; `main` `2e024d0` | Do not retune Capture |
| `NEXT_PUBLIC_SITE_URL` | Owner confirmed Production + Preview | CLOSED | Live confirm email → `/auth/callback` | Reopen only if live evidence contradicts |
| Single-account reload / two-project isolation | Production smoke passed | CLOSED | v0.9 smoke | Keep regression tests |
| Project delete user-facing | Live smoke passed | CLOSED (unsafe-delete claim) | Production delete | Residual is D-028 sequential debt |
| D-030 Risks/dates peer prose | Structured-domain precedence | CLOSED | `ocean-frames.ts` | Remainder = D-038 |
| D-031 Coach auto-open | Drawer unmounted | CLOSED | `AppShell` does not mount `CoachDrawer` | Do not rebuild Coach |
| Catch Me Up | Live AI briefing from server truth | CLOSED (missing-feature claim) | Production CMU + isolation | No vector DB |
| D-033 Capture/Ask client-world HTTP | Server load; foreign 404 | CLOSED | Live A6; `useCanonicalTruth: true` | Coach API leftover = D-033 remainder |
| D-034 client-world Apply | Fresh load + fingerprint | CLOSED | Apply route | Version columns DEFERRED |
| D-035 Todo persist helpers | `scopeExistingTodo` workspace+project | CLOSED (Todo sub-case) | `persist-mutations.ts` | Wider helper audit remains |
| Stable Todo/milestone identity | Thor / PR #95 | CLOSED | Qualification + identity tests | Do not reopen |
| D-010 live Ask canonical | HTTP always canonical | CLOSED (product path) | `tell-me/route.ts` | Library default ACCEPTED v0.9 |
| D-036 session-switch display | In-memory MissionState survives SPA login | **CLOSED** | PR #100 / production `0e68384`; regression + live B→A / A→B | Do not reopen as V1 work |
| D-041 account deletion | No whole-account delete | V1 MUST | Repo audit 28 Aug | Settings delete before public |
| D-042 export | No user/project export | V1 MUST | Repo audit 28 Aug | Bundle dump; legal can demote to high SHOULD |
| D-044 Terms/Privacy | Deferred for trusted alpha | V1 MUST | PR #88 not in #95 | Public/commercial launch |
| D-043 Meeting Prep persist | `updateMeeting` memory-only | V1 MUST | `store.tsx` ~1249 | Persist **or** remove `/meetings` mutation |
| Entitlement/Stripe | 90-day trial live; Stripe not required | V1 MUST when charging | Live Account A trial 11/26/2026 | D-024 local meter is not billing |
| D-037 Ready vs Apply | Ready only when Apply can plan that write | **CLOSED** | PR #126 / `main` `64171cd` | Do not weaken the contract |
| D-038 Todo delete Knowledge remnant | Todo stays deleted; fact can remain | V1 SHOULD | Production smoke | Retire linked fact by id |
| D-039 `openaiConfigured` stale | 401 on `/login` can stick | V1 SHOULD | Smoke | Re-probe after SIGNED_IN |
| D-003 suggestion persist | Accept/dismiss MissionState only | V1 SHOULD / TESTER EVIDENCE | `setRecommendationStatus` | Persist if testers use it |
| D-005 optimistic remainder | Capture Apply persist-first; some UI optimistic | V1 SHOULD | `store.tsx` | Exact reachable paths only |
| D-035 remainder | Other persist helpers | V1 SHOULD | Code inventory | Not Todo-only |
| D-028 sequential delete | Live delete works; SET NULL list hand-maintained | ACCEPTED v0.9 / V1 SHOULD | `PROJECT_BUNDLE_SET_NULL_TABLES` | Bundle RPC later |
| D-004 History persist gaps | Many `pushHistory` not durable | ACCEPTED v0.9 | `history_events` schema | Needed if Change Intelligence reads History |
| D-007 people prose | Remainder: unlinked Knowledge people | ACCEPTED v0.9 | KD notes | No unique-name platform |
| D-008 / D-021 waiting dual | Authority decided, not implemented | ACCEPTED v0.9 | Handoff Part C | Later slice |
| D-011 NP extractors | Capture path fixed; NP regex remains | ACCEPTED v0.9 | `create-project.ts` | No homemade LLM |
| D-012 `database.ts` lag | Hand-maintained types | ACCEPTED v0.9 | Types vs migrations | Ops hygiene |
| D-013 session tables | Client lists still primary | ACCEPTED v0.9 | CaptureSessionContext | Not a Capture unfreeze |
| D-014 live CI apply/isolation | Manual live proof; not in CI | ACCEPTED v0.9 | Isolation §6 | Optional live job |
| D-015 `[Resolved]` titles | Transitional data | ACCEPTED v0.9 | KD | Cleanup later |
| D-024 Actions left | Local meter, not billing | ACCEPTED v0.9 | Strip UI | Wire when Stripe exists |
| D-025 Capture visual §16 | Coarse vs Ocean checklist | ACCEPTED v0.9 | CaptureWorkspace | Polish only |
| D-026 project-code uniqueness | No unique constraint | ACCEPTED v0.9 | Schema | Product decision first |
| D-032 NP V2 flag | Still env-gated; on in Production | ACCEPTED v0.9 | `new-project-v2/flag.ts` | Pin like Capture if drift |
| Leftover `/memory` `/meetings` `/releases` `/coaching` | Not in primary nav | ACCEPTED v0.9 | Routes exist | Hide if testers find them |
| `assertProductionConfigOrThrow` unused at boot | Defined, never called | ACCEPTED v0.9 | `runtime-config.ts` | Small V1 ops |
| In-memory rate limit | Per process | ACCEPTED v0.9 | `rate-limit.ts` | Enough for alpha |
| Missing `seed.sql` | Referenced by `supabase/config.toml` | ACCEPTED v0.9 | File absent | Local CLI only |
| Capture payload-size cap | Not found as a hard cap | ACCEPTED v0.9 | Routes | Small V1 hardening |
| `error.message` may include row text | Possible in persist throws | ACCEPTED v0.9 | persist-mutations | Don’t log project text |
| `addFileName` stub | No callers | SUPERSEDED as a V1 promise | CaptureSessionContext | Do not promise upload |
| Relative dates (“next Friday”) | Ambiguous → Needs-you is legal | ACCEPTED v0.9 | Capture philosophy | Capability gap, not defect |
| D-040 NP naming | Awkward titles | TESTER EVIDENCE | Smoke examples | Quality, not architecture |
| D-027 archive/undo | Permanent delete by design | DEFERRED | D-R12 | Only if product asks |
| D-029 milestone complete status | No column; Needs-you | DEFERRED | Phase 3B test 12 | Not a date-lifecycle rebuild |
| D-034 version columns | Explicitly rejected for v0.9 | DEFERRED | Convergence | Don’t promote automatically |
| Portfolio / vector DB / entity platform / Coach rebuild / fuzzy identity / event sourcing / Person migration / dependency graph | Out of v0.9+V1 default | DEFERRED | Product thesis | §8 |

Do not keep stale debt alive. Do not omit uncomfortable debt. Do not start V1 architecture from this table without evidence.

---

## 11. Final principle for future agents

Start here, then constitution, then Known Discoveries, then code.

Do not reconstruct current truth from Phase 3 handoffs, stale Capture flags, Coach docs, old scorer-v1 counts, or Magic Patterns implementation instructions.

> **v0.9 Capture is frozen. Live tenant isolation (server + same-browser session-switch) is proven.**
>
> # LUME v0.9 CLOSED
>
> **STOP BUILDING v0.9. BEGIN TESTER LEARNING.**
>
> **V1 strengthens public-launch trust, fixes evidence-backed reliability issues, and deepens Lume's differentiated project-memory value without reopening unnecessary architecture.**
>
> **D-036 is closed. It is not a Capture unfreeze.**
