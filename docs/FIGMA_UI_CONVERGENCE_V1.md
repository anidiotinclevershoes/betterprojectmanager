# Figma UI Convergence V1

**Status:** Part 1 recovery / preflight / plan — Figma frame inspection still open  
**Date:** 17 September 2026  
**Programme:** Lume 0.9 Figma UI Convergence  
**Docs entry:** [`docs/README.md`](./README.md)  
**Integration branch:** `integration/figma-ui-convergence-v1`  
**PR base:** `main`  
**Do not merge to `main` until the programme is explicitly accepted.**

This is the durable recovery document for future Cursor sessions. It exists so agents do **not** need the two giant Part 1 / Part 2 prompts again.

Visual / interaction authority: **Figma**.  
Behaviour / canonical-data / persistence authority: **existing production architecture**.

This file is **not** a second architecture constitution. If it disagrees with [`docs/LUME_CONSTITUTION.md`](./LUME_CONSTITUTION.md), a specialist contract, or current code on a durable rule, those win.

---

## Plain English

Lume already has a working production architecture. Capture writes only after Review. Knowledge Centre is a view over saved project information. Timeline is read-only.

The approved Figma file now defines how the product should look and how people move around it. This programme moves that approved UI into the live app **without** rewriting Capture, inventing a second store, or changing persisted project data.

Part 1 recovered the current repository and mapped what to reuse. It **stopped** before changing production UI. A later session must inspect the actual Figma frames, then begin implementation only when Part 2 is explicitly started.

---

## How to continue (new Cursor thread)

The previous Cloud Agent started **before** the Figma plugin was installed. That session cannot authenticate Figma. Start a **new** agent after the plugin is installed.

### Paste this as the new-thread prompt

```text
You are Ultron, lead implementation agent for Lume.

Continue LUME 0.9 — FIGMA UI CONVERGENCE from the durable handoff:

  docs/FIGMA_UI_CONVERGENCE_V1.md

Do not restart recovery from scratch.

1. Authenticate the Figma MCP in this new thread.
2. Fetch origin/main and run npm run git:preflight on
   integration/figma-ui-convergence-v1.
3. If the branch is CURRENT and contains current main, continue.
   If it is MATERIALLY STALE, STOP.
4. Inspect the approved Figma frames listed in the handoff.
   File: Lume-V1-UX
   Key: TPzPxiSMFgPQBZPDNzQ6LL
5. Confirm or revise the reuse matrix and phases against the
   actual current frames. Older/reference frames are not authority.
6. Update docs/FIGMA_UI_CONVERGENCE_V1.md with Figma evidence
   and close the Figma-inspection blocker.
7. STOP. Do not implement production UI unless I explicitly
   start Part 2 in this thread.

Authorities:
- Figma = visual and interaction
- Existing production architecture = behaviour, canonical data,
  persistence
If Figma appears to require a material architecture/schema/domain
change, record a gate and STOP.

Do not merge to main.
Do not rewrite Capture Simplification.
Do not import AI-first or Novel work.
```

If the user then says **Part 2**, implement from this document’s phases. Do not wait for the original giant Part 1 prompt to be re-sent.

---

## 1. Rationale

This is **not** a redesign and **not** an architectural rewrite.

Purpose:

1. recover the real current Lume architecture;
2. establish a safe integration line from current `origin/main`;
3. inspect existing UI and write architecture;
4. inspect approved Figma targets;
5. decide reuse / modify / create;
6. produce a durable implementation plan;
7. stop before changing production UI.

---

## 2. Authorities

| Authority | Owns |
| --- | --- |
| Figma `Lume-V1-UX` | Visual layout, interaction, copy, spacing, component appearance |
| Constitution + specialist contracts + current `main` | Canonical writes, persistence, Capture, durable project data |

If Figma appears to require behaviour that conflicts with production architecture:

- preserve canonical-data safety;
- preserve existing persisted project data;
- do not create a parallel writer;
- do not create a feature-specific source of truth;
- do not silently reinterpret stored data;
- identify the conflict;
- propose the smallest safe resolution;
- **STOP** if it requires a material architecture / schema / domain decision.

---

## 3. Branch / baseline

Recorded 17 September 2026 after `git fetch origin main`.

```text
Working branch: integration/figma-ui-convergence-v1
Branch HEAD:    71219584972d8d65a11296187a090ecef56a5db0
origin/main HEAD: 71219584972d8d65a11296187a090ecef56a5db0
Merge-base:     71219584972d8d65a11296187a090ecef56a5db0
Ahead: 0
Behind: 0
Contains current main?: YES
Working tree clean?: YES at branch creation; this docs commit is the first programme change
PR base: main
Dependencies: none
Shared/global files expected: none in Part 1 (docs only)
Branch classification: CURRENT
```

Historical Capture Simplification SHAs (reference only, **not** current tip):

- architecture baseline: `29acea5149c1c56dcb18375fd22025c072931a24` (PR #184)
- later docs-only main tip, now **current** `origin/main`: `71219584972d8d65a11296187a090ecef56a5db0` (PR #185)

`integration/figma-ui-convergence-v1` was created clean from current `origin/main`. It did not exist before this programme.

---

## 4. Baseline test evidence

Run on `7121958` before any production UI change:

| Check | Result |
| --- | --- |
| `npm test` | **99/99 passed** |
| `npm run typecheck` | **passed** (`tsc --noEmit` exit 0) |
| `npm run build` | **passed** (exit 0) |
| `npm run lint` | **failed on current main** — 59 errors / 83 warnings, pre-existing. Do not treat as a regression introduced by this programme. Do not “fix lint” as a side quest unless a later phase touches those files. |

Normal follow-up checks for later phases: `npm run git:preflight`, `npm test`, and the existing UI verify scripts listed in §12.

---

## 5. Product rules for this programme

### Workspace

Target product model (Figma / current product instruction, **not** current production code):

> Home | Capture | Knowledge Centre | Project Scan

- Home is the resting / default state.
- Selecting Capture, Knowledge Centre or Project Scan expands that mode inline and pushes the Home projection downward.
- Selecting Home collapses the expanded mode.
- There is no separate “Project Overview” destination.

Home composition:

- top: ~75% To Do working queue, ~25% condensed People rail;
- then Issues, Knowledge, inline Timeline;
- Issues and Knowledge can collapse;
- queue may contain canonical To Dos, genuinely date-relevant non-To-Do items, and optional AI Suggestions;
- a date-relevant Issue remains an Issue. Do not silently turn it into a To Do.

### Capture

Preserve Capture Simplification. AI extraction always goes through Review. Do not introduce “Suggestion” semantics into Capture. Capture Review cards and Home / Project Scan Suggestions are different concepts.

### Knowledge Centre

Supports grid/list, fuzzy search, Ask Lume, domain filters, tag filters, endless scroll, detail drawer, direct manual Edit, manual Add. Manual user-entered edits do not require Review. They still use canonical writes.

### Project Scan

Analysis only. Groupings: Risks, Dependencies, Missing information, Contradictions. Must not mutate canonical project data simply because it found something.

### Interaction contracts

- Drawer uses a navigation stack. `← Back`. No breadcrumbs.
- Canonical item History is read-only, newest first, meaningful-event only.
- Universal actions: **Close** (inactive, keep record/history) and **Remove** (destructive, distinct).
- Manual Add: Issue, Person, To Do, Knowledge. Bypasses Review. Canonical writes. No partial create, no duplicate create on retry, no false success.
- Suggestions are advisory until the user acts. **Add** opens a short pre-filled Save/Discard state. **Discard** remembers dismissal enough that the exact same suggestion is not immediately regenerated unless the underlying situation materially changes. Discard does not alter the source Issue / Scan finding / project data.

### Tags

Project-scoped metadata for search/filter. Not a second store of project facts. Supported on Issue, To Do, Knowledge. **Do not add tags to People in this UI**, even though the data model already allows `stakeholder` tags.

Editing contract: type → autocomplete existing project tags → select or offer Create “new-tag” → typing/selecting Create does **not** persist → Save commits → reuse equivalent existing tags → otherwise create-and-attach safely → Discard creates no orphan tag and no item mutation → add/remove appears in History. Normalise casing/whitespace duplicates.

### Ownership

Do not invent multiple-owner UI for canonical items. Current product assumption is one owner per item. People may have multiple responsibilities. Inspected: multi-owner **items** do not safely exist. Keep single-owner for items.

### Visual contract

Preserve approved Lume identity.

- Domain: Issues coral, People blue, To Do green, Knowledge purple.
- Domain colour through icon, restrained header/top line, subtle tint. Not saturated domain panels.
- Operation colour separate: Create green, Update blue, Remove red, Needs You amber.
- Primary action: Lume purple.
- AI / “me” mark: underlined `me`, sizes standard / button / micro. Micro for inline Suggestions. If the mark belongs to a button, it belongs inside the button. Do not use purple-filled UI as a generic synonym for AI.
- Workspace shell: persistent project sidebar, clearly selected project, generous logo → New Project gap, generous New Project → project-list gap, **no PROJECTS heading**, project title, four equal workspace tabs, subtle separators, active tab bright white, inactive muted, no last-used dates inside Capture / Project Scan tabs, small top-right me/token-use callout, Usage & spending link, purple/lighter page header band.
- Use **Open Details** consistently.
- Never expose internal phrase **project truth**. Prefer: saved project information / project information / what Lume knows about the project.

---

## 6. Architecture invariants

Non-negotiable. Full contracts: constitution, Canonical Project Truth, Durable Project Truth, Capture status.

- Once persisted, project data must remain readable and meaningful.
- `UI action → existing canonical write architecture → persisted canonical information → projections refresh`.
- No feature-specific store pretending to be canonical.
- No duplicate writers, silent writes, or false success.
- Timeline is a read-only projection.
- Do not rewrite Capture Simplification.
- Do not import experimental AI-first architecture.
- Novel is unrelated. Do not use it as Lume evidence.

Current production Capture:

- engine: Capture V2 only;
- prompt: Prompt A;
- Ready means the same production Apply path can execute that change; Apply still revalidates;
- session binds to the open project;
- after successful Apply, never adopt pre-write state.

---

## 7. Current production vs Figma target

The August surface inventories in `docs/v1-convergence-mp/` and Ocean UI baseline docs are **historical**. Current code on `7121958` is the implementation map.

### What production actually is now

```text
AppShell
├── Sidebar (PROJECTS heading, + New Project, project list,
│            Master To Do, History, Captures, Account, Help)
└── Route
    ├── /  → redirect to first project KC, or first-run New Project
    ├── /projects/[id] → OceanProjectWorkspace
    │     default mode: knowledge
    │     tabs: Capture | Knowledge Centre | Catch Me Up | Advise (disabled)
    │     knowledge → four-bucket KC + Timeline embed + detail drawer
    │     capture → CaptureWorkspace variant="ocean"
    │     catch-me-up → CatchMeUpPanel (derived briefing, not Scan)
    ├── /todos → cross-project Master To Do
    ├── /history → workspace chronology
    └── /captures → Capture session index
```

There is **no** Home workspace, **no** Project Scan mode, and **no** inline expand/collapse of modes over a Home projection.

### Notable leftover / unmounted UI

Do not remount as a shortcut unless the architecture still matches:

- `ProjectWidgetGrid` — old suggestions dashboard, unmounted;
- `KnowledgeItemCard` — superseded by `KcItemCard` inside `OceanKnowledgeFrames`;
- `CoachDrawer` — unmounted;
- `ProjectSetupReview`, `NewProjectCategorisation` — leftover, not live New Project;
- `ProjectTimelineGantt` — leftover writable Gantt, unmounted;
- `/memory`, `/coaching`, `/meetings`, `/capture` — redirect or leftover.

---

## 8. Architecture findings

### Shell

| Piece | Current symbol | Path |
| --- | --- | --- |
| App chrome | `AppShell` | `src/components/AppShell.tsx` |
| Sidebar | `Sidebar` | `src/components/app-shell/Sidebar.tsx` |
| Top header | `TopHeader` | `src/components/app-shell/TopHeader.tsx` |
| Project workspace | `OceanProjectWorkspace` | `src/components/knowledge-centre/OceanProjectWorkspace.tsx` |
| Mode tabs | `ProjectModeSelector` | `src/components/knowledge-centre/ProjectModeSelector.tsx` |
| Intelligence strip | `ProjectIntelligenceStrip` | `src/components/knowledge-centre/ProjectIntelligenceStrip.tsx` |
| Project page | `ProjectDashboardPage` | `src/app/projects/[id]/page.tsx` |
| Home | `HomePage` | `src/app/page.tsx` — redirects; first-run uses `NewProjectExperience` |

Tokens: `src/styles/lume-locked-visual.css` already has domain + operation + primary colours. Buttons: `primary-btn`, `ghost-btn`, `danger-btn`. Me mark today is wordmark weight/colour (`ocean-wordmark-me`) plus ✦ `ocean-ai-glyph`, not the approved underlined `me` sizes.

### Canonical writes

```text
Capture AI → Review → POST /api/capture/apply
  → applyApprovedCaptureSuggestion → planCaptureApply → executeCaptureApply
  → capture_apply_receipts → reload + confirmAuthoritativeWrites

New Project → store.createProject → POST /api/workspace/projects
  → persistNewProject → RPC create_project_bundle
  (idempotent via clientProjectId)

Manual KC / To Do / Confirm Owner → store.tsx
  → persist-mutations.ts / persist-tags.ts via browser Supabase
```

`MissionState` is a hydrate / paint cache, not authority.

Manual paths that already bypass Review and write canonically: `addTodo`, `updateTodo`, `toggleTodo`, `removeTodo`, `updateKnowledgeSection`, `addKnowledgeBullet`, `setRiskStatus`, `confirmResponsibilityOwner`, New Project compose.

Gaps for Figma Manual Add:

- no mounted KC/Home **Add Issue / Add Person / Add To Do / Add Knowledge** on the live project workspace;
- no `addRisk` / `addPerson` store helpers named that way — people/issues today enter via New Project compose, Capture Apply, or Confirm Owner (`persistEnsureStakeholder`);
- `acceptSuggestion` / `dismissSuggestion` are **memory-only** (D-003).

### Tags

Persistence **already exists**. Do **not** invent a new table in Part 2 unless a later inspection proves a real gap.

| Layer | Evidence |
| --- | --- |
| Tables | `project_tags`, `item_tags` — `supabase/migrations/20260831160000_project_retrieval_tags.sql` |
| RLS | member CRUD already present |
| Types | `src/lib/tags/types.ts` — `risk`, `todo`, `stakeholder`, `knowledge_item`, `milestone` |
| Normalise | `tagSlug` / `dedupeTagNames` — casing/whitespace |
| Autocomplete | `suggestTags()` already returns project / predefined / create |
| Hydrate | `loadRetrievalTags` → `state.projectTags` / `state.itemTags` |
| New Project write | `create_project_bundle` + `tagsFromCreateDraft` |
| Post-create helpers | `persistEnsureProjectTag`, `persistAttachItemTag`, `persistDetachItemTag` in `src/lib/data/supabase/persist-tags.ts` |
| UI | `KnowledgeTagFilter` is **filter-only**. No tag editor. Helpers are **not wired** from `store.tsx` |
| People tags in data | **yes** (`stakeholder`). Figma/product rule: **do not add People-tag UI** |
| History for tag add/remove | **missing** |

**Tag architectural gate:** none for persistence of existing kinds. Wiring UI + store + optional History events is enough. Creating a new table/RPC/RLS is a STOP.

If History events for tags require a new `HistoryEventType` rather than `other`, treat that as a **small additive contract** and record it before implementing. Do not silently broaden History into a second truth store.

### Ownership

| Question | Finding |
| --- | --- |
| Multi-owner **items** (todo / risk / knowledge row)? | **No.** No owner field on `TodoItem` / `ProjectRisk`. |
| Multi-owner **responsibility scopes**? | **Yes.** Share / replace via `confirmResponsibilityOwner`. People may have multiple responsibilities. |
| UI to invent? | Keep **single-owner** for items. Do not change the domain model for multiple item owners. |

### History

| Layer | Role |
| --- | --- |
| `history_events` + `persistHistoryEvent` | Durable project chronology |
| `src/lib/workspace/history.ts` `pushHistory` | In-memory / session paint |
| `src/lib/sessions/history.ts` | Capture/Coach **localStorage** session list — not item History |

- Workspace History page exists: `src/app/history/page.tsx` (newest first).
- **Item-level History panel does not exist** in `KnowledgeItemDetailDrawer`.
- D-004: many `pushHistory` paths never persist.
- Capture Apply does persist history (secondary after write).
- Do not create a UI-only item history store. Project `history_events` and filter by item when the event payload allows; if events lack item ids, that is a gate, not a licence to invent a second store.

### Close / Remove

Semantics exist but labels are inconsistent:

- To Do: `done` / complete ≈ Close; `removeTodo` / Capture remove ≈ Remove (row delete);
- Risk: `resolved` / `accepted` ≈ Close; no user-facing delete;
- People: responsibility `superseded`; no user-facing person Remove;
- Drawer actions today: Correct, Mark done, Mark resolved, Confirm owner, More details, Close (dismiss drawer).

### Capture

Do not rewrite. Files to leave alone unless a later phase is explicitly visual-only on Review chrome:

- `src/lib/capture-v2/**`
- `src/lib/capture/apply/**`
- `src/app/api/capture/**`

Review UI that may later receive visual convergence (not behaviour rewrite):

- `src/components/capture/CaptureWorkspace.tsx`
- `src/components/capture/review/*`
- `src/components/capture/review/review-cards.css`

### Suggestions

Two different concepts:

| Kind | Current | Figma target |
| --- | --- | --- |
| Capture Review | Approve / Dismiss / Exclude → Apply | Keep Capture vocabulary. Do not rename to Suggestion Add/Discard |
| Home / Scan advisory | `recommendations` + unmounted `ProjectWidgetGrid`; D-003 memory-only dismiss | Add → pre-filled Save/Discard; Discard remembers dismissal |

Durable dismiss of Home/Scan suggestions needs persist of `recommendations` status (D-003). That is an **existing open discovery**, not a new schema by default. Confirm the column already exists before any migration.

### Project Scan

No Scan surface. Closest read-only analysis:

- Catch Me Up briefing (`CatchMeUpPanel`) — derived, must not become Scan-owned truth;
- KC Issues bucket + `ProjectIntelligenceStrip` dependency counts;
- Ask / Tell Me contradiction handling is reasoning, not a Scan writer.

Scan in Part 2 must be a **projection / analysis view**. Findings may seed Suggestions. They must not write canonical rows on sight.

---

## 9. Figma authority

**File:** Lume-V1-UX  
**Key:** `TPzPxiSMFgPQBZPDNzQ6LL`

Inspect these nodes. Prefer the newest explicitly current / converged production surfaces. Older/reference/state frames are not authority.

| Surface | Node |
| --- | --- |
| Home | `213:2` |
| Capture | `153:131` |
| Knowledge Centre grid | `151:243` |
| Knowledge Centre list | `171:131` |
| KC detail | `152:669` |
| KC Edit Item | `248:263` |
| Project Scan | `153:231` |
| Review | `28:119` |
| New Project | `91:202` |
| First Project | `94:65` |
| First Project Help | `209:333` |
| Suggestion → Add | `282:2` |
| Manual Add Item | `282:435` |

**Part 1 blocker:** these frames were **not** inspected in the first agent run. Figma MCP was unavailable, then un-authenticatable on that thread. A new thread must inspect them before marking Part 1 complete / starting Part 2 UI.

---

## 10. Reuse matrix

Decisions below are from **code inspection**. Mark `FIGMA-PENDING` until the named frames confirm visual/interaction detail. Prefer modify/reuse over replacement when responsibility already matches.

| Figma concept | Existing code | Decision | Rationale |
| --- | --- | --- | --- |
| Project sidebar | `Sidebar` | **modify** | Already the project list + New Project. Remove `PROJECTS` heading; retune logo / New Project / list gaps; keep selected-project state. |
| Workspace tabs | `ProjectModeSelector` | **modify** | Same shell responsibility. Change set to Home / Capture / KC / Project Scan; four equal tabs; retire Catch Me Up and Advise from this tab row (Catch Me Up remains a derived briefing, not a 4th tab unless Figma later says otherwise). |
| Page header | `TopHeader` + `ocean-project-header` + `ProjectIntelligenceStrip` | **modify** | Collapse competing headers into the approved band: project title, me/token callout, Usage & spending. Do not add a second identity chrome. |
| Home surface | `OceanProjectWorkspace` + `HomePage` redirect + KC four-bucket + `TodoFrame` | **modify + compose** | No new truth store. Home is a new **projection layout** over existing todos / people / issues / knowledge / timeline selectors. Stop redirecting `/` away from the open project’s Home. |
| People rail | `buildPeopleRows` / KC people bucket / `PersonEntity` | **modify** | Reuse people projection. New layout only. |
| To Do queue | `composeKnowledgeCentreItems` todo bucket + `addTodo` / `toggleTodo` | **modify** | Queue is a presentation over canonical todos plus date-relevant non-todos. Do not coerce Issues into todos. |
| Capture | `CaptureWorkspace` | **modify (visual only)** | Keep Analyse → Review → Apply. Do not change resolver/Apply. |
| Review | `CompactChangeCard`, `SuggestedChangesList`, `CorrectionActions` | **modify (visual only)** | Domain/operation colours already exist in `review-cards.css`. |
| Knowledge Centre | `OceanKnowledgeFrames`, `four-bucket.ts`, `KnowledgeSearchAskBar`, `KnowledgeTagFilter` | **modify** | Already four-bucket + search/ask/tags/timeline. Add grid/list, endless scroll, Manual Add if Figma shows them. |
| KC detail drawer | `KnowledgeItemDetailDrawer` | **modify** | Same drawer. Add Back stack, History, Close/Remove, Open Details, tag editor. Do not replace with a new drawer system. |
| KC Edit Item | drawer `Correct` / `updateKnowledgeSection` / `updateTodo` | **modify** | Manual edit already bypasses Review. Align chrome to Figma. |
| Project Scan | none mounted | **create (view only)** | New mode component that **reads** existing risks/dependencies/gaps/contradictions. No writer. May reuse Catch Me Up assembly only as a read helper if it stays non-authoritative. |
| New Project | `NewProjectExperience` | **modify (visual)** | Compose-oriented four-frame path is already production. |
| First Project / Help | `NewProjectExperience variant="first-run"`, `FirstProjectGuidance` | **modify (visual)** | Same first-run entry. |
| Suggestion → Add | unmounted `ProjectWidgetGrid` + `acceptSuggestion` | **modify + persist** | Reuse recommendation records. Do not treat Capture Review as this flow. D-003 must be closed for Discard to survive reload. |
| Manual Add Item | New Project `ComposeFrame`; store `addTodo` / knowledge helpers | **create thin adapter** | New modal/drawer chrome, existing canonical writes. Missing Issue/Person create helpers may be small store extensions over existing persist functions — not a new RPC. |
| Drawer Back stack | none | **create** inside existing drawer | Client navigation stack only. Not a route/store of truth. |
| Domain header / cards | `KcItemCard`, `DomainMark`, locked domain tokens | **modify** | Tokens already match coral/blue/green/purple. Restrain tints. |
| me mark | `ocean-wordmark-me`, `ocean-ai-glyph` ✦, `LumeLogo` | **modify / small create** | Need standard / button / micro underlined `me`. Keep inside buttons. Logo SVG is not the wordmark authority. |
| Warning / instruction | `.ocean-save-error`, Capture reliability, Needs You, first-run cues | **modify** | Reuse surfaces; replace “project truth” copy. |
| Buttons | `primary-btn` / `ghost-btn` / `danger-btn` | **reuse** | Already locked to Lume purple / destructive. |
| Avatars | `ReviewPersonAvatar`, `PersonEntity` | **reuse** | |
| Timeline | `TimelineFrame`, `timeline-projection.ts` | **reuse** | Read-only embed on Home / KC. |
| History | `history_events`, `/history` page | **modify** | Add item-level read of the same events. No second store. |
| Tags | `src/lib/tags/*`, `persist-tags.ts`, `KnowledgeTagFilter` | **modify** | Wire editor + store. No new schema. |
| Catch Me Up | `CatchMeUpPanel` | **keep unmounted from tabs** unless Figma still shows it | Derived briefing. Not Project Scan. Not a writer. |

---

## 11. Behaviours already available vs missing

### Already available

- Canonical Capture Review / Apply spine;
- four-bucket KC projection;
- search + Ask Lume;
- tag **filter** + tag **data** + tag **suggest** helper;
- Timeline read-only projection;
- New Project compose + first-run;
- Confirm Owner / shared responsibility scopes;
- Manual To Do create/update/complete/delete;
- Manual knowledge section edit;
- Risk resolve;
- Domain and operation colour tokens;
- Receipt / idempotency on Capture Apply and New Project create.

### Missing (UI / wiring, not new architecture)

- Home as default workspace projection;
- Project Scan analysis view;
- four equal tabs and expand/collapse-over-Home;
- sidebar visual contract (no PROJECTS heading, spacing);
- header me/token callout + Usage & spending;
- drawer Back stack;
- item History panel;
- Close / Remove universal labelling and People/Issue Remove where product requires it;
- KC/Home Manual Add for all four domains;
- Suggestion Add → Save/Discard + durable Discard (D-003);
- tag editor on Issue / To Do / Knowledge;
- grid/list + endless scroll if Figma KC frames require them;
- underlined `me` mark sizes;
- user-facing “project truth” copy sweep.

### Architecture gates (do not implement in passing)

1. **Tag persistence model** — already exists. Gate only if someone proposes a new table/RPC/RLS.
2. **People tags** — data allows `stakeholder` tags; product forbids People-tag UI. Do not “complete” the data model in the UI.
3. **Multi-owner items** — not present. Do not add.
4. **Suggestion discard durability** — D-003. Prefer persist existing `recommendations` status. STOP if that requires a new table.
5. **Item History identity** — if `history_events` cannot be filtered to one item without schema change, STOP and propose the smallest additive field.
6. **Manual Add Issue / Person** — if existing persist helpers cannot create a risk / stakeholder without a new RPC, extend the established persist path additively. STOP before a new canonical kind.
7. **Project Scan writer pressure** — if Figma shows Scan applying fixes directly, keep analysis-only and route user action through Suggestion Add or Manual Add. Do not let Scan write.
8. **Catch Me Up vs Project Scan** — do not rename Catch Me Up into Scan. Do not import AI-first Scan architecture.

---

## 12. Proposed Part 2 phases

Safe commit boundaries. Each phase stays on `integration/figma-ui-convergence-v1`. Re-run `npm run git:preflight` and `npm test` at the end of each phase. Do not merge to `main`.

0. **Figma close-out** — inspect listed nodes; update this file; confirm reuse matrix. No production UI.
1. **Shell chrome** — sidebar + four tabs + header band + copy sweep for “project truth” in mounted chrome. Home tab may still render current KC until Phase 2. Files: `Sidebar.tsx`, `ProjectModeSelector.tsx`, `OceanProjectWorkspace.tsx`, `TopHeader.tsx`, `AppShell.tsx`, locked CSS.
2. **Home projection** — compose To Do queue / People rail / Issues / Knowledge / Timeline from existing selectors (`four-bucket.ts`, `ocean-frames.ts`, `TimelineFrame`). Change `/` and project default mode to Home. No new persist.
3. **Knowledge Centre visual convergence** — grid/list, scroll, filters, Open Details label, Manual Add entry points wired to existing writes.
4. **Drawer stack + History + Close/Remove** — extend `KnowledgeItemDetailDrawer` with Back stack and item History read. Map Close/Remove onto existing complete/resolve/delete helpers. No second history store.
5. **Tags editor** — wire `suggestTags` + `persist-tags.ts` through `store.tsx` for Issue / To Do / Knowledge only. Discard creates nothing. Save is the write. Tests in `scripts/verify-project-tags.ts` plus new store/UI tests.
6. **Manual Add + Suggestion Add/Discard** — thin adapters over canonical writes; persist recommendation dismiss (D-003) if the existing table supports it.
7. **Project Scan view** — read-only groupings. Findings may offer Suggestions. No canonical mutation.
8. **Capture / Review / New Project / First Project visual pass** — chrome only. Do not touch Apply, resolver, receipts, or Prompt A.
9. **Visual verification + regression** — screenshot scripts, Playwright where contracts exist, `verify:ocean-*`, `verify:knowledge-centre-four-bucket`, `verify:project-tags`, `verify:ocean-item-detail`, `verify:first-run-journey`, `verify:new-project-four-frame`, `npm test`.

If a phase needs schema / RPC / RLS / new canonical kind: **stop and update §11 gates** instead of implementing.

---

## 13. Testing strategy

- Deterministic verify scripts already cover KC four-bucket, tags, item detail, Capture workspace, New Project, first-run, Timeline projection, Apply integrity.
- Add / extend tests when behaviour changes: Home composition (Issue stays Issue), drawer Back stack, tag Save vs Discard, suggestion dismiss surviving hydrate, Scan does not write, Manual Add idempotency.
- Do not weaken assertions. Do not use sleeps as fixes.
- Visual: existing `scripts/screenshot-*.mjs` plus browser verification of each mounted surface. Screenshot script still mentions `.project-owned-workspace`; prefer `ocean-project-workspace` / new test ids.
- Hosted OpenAI journeys stay opt-in and are not `npm test`.

---

## 14. Completed-phase ledger

| Phase | Status | Evidence |
| --- | --- | --- |
| Recover docs / constitution / Capture status | done | this file; docs read 17 Sep 2026 |
| Fetch `origin/main` + create integration branch | done | branch from `7121958` |
| Baseline `npm test` / typecheck / build | done | 99/99; tsc 0; build 0 |
| Code inspection: shell, writes, tags, ownership, history | done | §7–§11 |
| Figma frame inspection | **open** | plugin not bound to first agent thread |
| Part 2 UI implementation | not started | by design |

---

## 15. Known blockers

1. **Figma MCP must be authenticated in a new thread** started after the plugin install. Until frames are inspected, Part 1 is not closed and Part 2 must not start.
2. D-003 suggestion dismiss is memory-only. Home/Scan Discard cannot be honest across reload until persisted.
3. D-004 History persist gaps. Item History UI must not pretend missing events exist.
4. Current `npm run lint` is already red on `main`. Not a programme blocker; do not churn it.
5. User-facing “project truth” copy still exists in mounted Capture / AppShell / New Project strings.

**STOP conditions found in Part 1 code inspection:** none that prevent planning. No schema change is required to begin shell/Home/KC visual work. Figma inspection may still raise a gate.

---

## 16. Part 1 status for the next agent

```text
PART 1 STATUS
  Recovery, preflight, code inspection, and plan are written.
  Figma frames are not yet inspected.

READY FOR PART 2
  NO — authenticate Figma, inspect the listed nodes, update this file,
  then wait for an explicit Part 2 instruction.

SAFEST NEXT ACTION
  New Cursor thread using the prompt in “How to continue”.
  Stay on integration/figma-ui-convergence-v1.
  Do not implement production UI in that close-out.
```
