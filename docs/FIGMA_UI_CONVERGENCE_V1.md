# Figma UI Convergence V1

**Status:** Part 2 in progress — safety clarifications recorded; implementing from Phase 1  
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

Part 1 recovered the current repository, mapped reuse, then inspected the current Figma frames on `02 — Product Screens`. Part 2 was started 17 September 2026 with two safety clarifications (item History attribution; tag Save failure safety). Stay on this integration branch. Do not merge to `main`.

---

## How to continue (Part 2)

Figma inspection is closed. Stay on `integration/figma-ui-convergence-v1`. Re-run `npm run git:preflight` first. If the branch is CURRENT and contains current `main`, continue from §12 / §17. If MATERIALLY STALE, STOP.

Do not restart Part 1 recovery. Honour §17 safety rules before any History or tag Save work.

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

Recorded 17 September 2026 after Part 2 implementation (`npm run git:preflight`).

```text
Working branch: integration/figma-ui-convergence-v1
Branch HEAD:    6cb1895e05ce61e1aa64a8ebee9235b5837f3898
origin/main HEAD: 71219584972d8d65a11296187a090ecef56a5db0
Merge-base:     71219584972d8d65a11296187a090ecef56a5db0
Ahead: 6
Behind: 0
Contains current main?: YES
Working tree clean?: YES
PR base: main
Dependencies: none
Shared/global files expected: store.tsx persist helpers (additive); no Capture Apply ownership
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
- `history_events` has **no** `item_id` / `target_id`. Title, detail, or fuzzy matching is **not** attribution.
- Do not create a UI-only item history store. Do not add a history schema migration in this programme unless a STOP is raised and explicitly approved.
- If an event cannot be deterministically attributed under existing contracts, preserve D-004 as an explicit bounded limitation in the item drawer.

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
**Inspected:** 17 September 2026 via authenticated Figma MCP (`whoami`: Tom Hughes).  
**Blocker:** **closed.**

### 9.1 File map (current vs reference)

Three pages. Only **`02 — Product Screens`** is screen authority.

| Page | Id | Authority |
| --- | --- | --- |
| `00 — Reference Archive` | `0:1` | **No.** Component studies, Final Polish v1, First Pass Home, archived Review. Includes leftover copy “Current project truth” — do not import. |
| `01 — Foundations & Components` | `10:2` | Component / token library only: `Button/*`, `ProjectIdentity`, `PersonEditor`, `ReviewCard`, `Brand/LumeWordmark`, `Brand/AIUsageMark`. |
| `02 — Product Screens` | `10:3` | **Yes.** Current workspace v2 / v3 / Production v1 frames. |

Older Product Screens frames (`ReviewWorkspace — Desktop`, `Capture — Desktop`, `Capture — Production v1`, `Knowledge Centre — Desktop`, `LEGACY — Project Home — Rules Applied v2 (pre-convergence)`, `Project Home — First Pass v1` on the archive page) are **not** authority.

### 9.2 Inspected authority frames

All listed node IDs still exist. Names below are the **current frame names**.

| Surface | Node | Current name | Verdict |
| --- | --- | --- | --- |
| Home | `213:2` | Project Workspace — Home v2 | **Current.** Default workspace. Sidebar + four equal tabs + header band. To Do queue (~75%) + People rail (~25%), then collapsible Issues / Knowledge, then read-only Timeline. Suggestions toggle. Date-relevant Issue stays an Issue (`Open Details`, not Close). |
| Capture | `153:131` | Project Workspace — Capture v2 | **Current.** Capture tab active; composer + “You’ll review everything before anything changes.” Home projection is pushed below the tab. AI `me` mark sits **inside** the Capture button. |
| Knowledge Centre grid | `151:243` | Project Workspace — Knowledge Centre v2 | **Current.** Search, Ask Lume, domain filters, tag filters, grid/list toggle (grid selected), `+ Add item`, four-domain cards, `Open Details`. Home remains below. |
| Knowledge Centre list | `171:131` | Project Workspace — Knowledge Centre List v2 | **Current.** Same chrome; list selected. Compact rows, not a different data model. |
| KC detail | `152:669` | Project Workspace — Knowledge Centre Detail v2 | **Current.** Right drawer: `← Back`, DETAILS, TAGS, CONTEXT, RELATED, HISTORY (newest-first meaningful events), Edit item, Close, Remove. Copy: “Close keeps the item and its history. Remove deletes it from the project entirely.” |
| KC Edit Item | `248:263` | Project Workspace — Knowledge Centre Edit Item v3 | **Current.** Same drawer in edit mode. Save / Discard. “New tags are created and attached only when you Save changes.” Discard restores saved values and creates no orphan tag. |
| Project Scan | `153:231` | Project Workspace — Project Scan v2 | **Current.** Groupings: Risks, Dependencies, Missing information, Contradictions. “Scan findings are analysis only. Nothing changes in the project unless you choose to act.” `View evidence ›` / `Scan again` only. Home remains below. |
| Review | `28:119` | ReviewWorkspace — Converged MP v2 | **Current Review chrome.** Standalone Review (no project sidebar, no Home tab). Confirm review / Discard review. Needs You / Create / Update / Remove. “Not saved yet — nothing changes until you click Confirm review.” Do **not** force this into the four-tab workspace shell. |
| New Project | `91:202` | New Project — Production v1 | **Current.** Compose: identity + Capture notes + four domain adders. “You’ll review what Lume finds before anything is added.” Draft until Create project. |
| First Project | `94:65` | New Project — First Project v1 | **Current.** Same compose + first-project rail + “What goes where?” |
| First Project Help | `209:333` | New Project — First Project Help Open v1 | **Current.** Help overlay open. Same compose; not a new flow. |
| Suggestion → Add | `282:2` | Project Workspace — Suggestion Add v1 | **Current.** Home + modal: “Add suggested To Do” / “Nothing is created until you Save To Do.” Discard / Save To Do. Distinct from Capture Review. |
| Manual Add Item | `282:435` | Project Workspace — Add Item v1 | **Current.** KC + drawer: type Issue / Person / To Do / Knowledge. “Manual add writes directly to the project only when you Save item. No Review is needed.” “Single owner supported by the current project model.” Tags created only on Save. |

### 9.3 Interaction evidence that confirms the plan

- Workspace tabs are **Home | Capture | Knowledge Centre | Project Scan**. Catch Me Up and Advise are absent.
- Selecting Capture / KC / Scan expands that mode and **pushes Home downward**. Home tab collapses the mode.
- Sidebar: Lume wordmark, generous gap, `+ New project`, selected-project bar, no `PROJECTS` heading, Account / Settings at the bottom. No last-used dates inside Capture / Scan tabs.
- Header: project title + `SR · Updated today…`, four equal tabs, purple/lighter band, `me` + “AI token use” / “Usage & spending →”.
- `me` is the underlined wordmark / `Brand/AIUsageMark` component (standard / button / micro). It belongs inside AI actions (Capture, Ask Lume, Scan tab, suggestion row).
- Copy uses “saved project information”, not “project truth”, on current screens.
- Grid/list is a **view toggle**, not a second store. Endless scroll is **not** shown; do not invent it.
- People appear in KC as PERSON cards. **No People-tag editor.** Filter-row `Add tag` is filter chrome, not a writer.
- Suggestions say “not a To Do yet”. Add opens a short Save/Discard state. Discard “remembers the dismissal and does not change the project.”
- Timeline is read-only embed with 2W / 1M / 3M / Fit.

### 9.4 Architecture gate from Figma?

**None.** Current frames do not require a new table, RPC, RLS, canonical kind, or parallel store. They ask for projections, chrome, and wiring of existing writes.

Existing Part 1 gates still apply (D-003 dismiss persist, D-004 history gaps, Manual Add Issue/Person persist helpers, tag History event type). Figma did not add a new one.

---

## 10. Reuse matrix

Decisions below are from **code inspection + current Figma frames** (§9). Prefer modify/reuse over replacement when responsibility already matches. No row remains Figma-pending.

| Figma concept | Existing code | Decision | Rationale |
| --- | --- | --- | --- |
| Project sidebar | `Sidebar` | **modify** | Already the project list + New Project. Remove `PROJECTS` heading; retune logo / New Project / list gaps; keep selected-project state. |
| Workspace tabs | `ProjectModeSelector` | **modify** | Same shell responsibility. Change set to Home / Capture / KC / Project Scan; four equal tabs; retire Catch Me Up and Advise from this tab row (Catch Me Up remains a derived briefing, not a 4th tab unless Figma later says otherwise). |
| Page header | `TopHeader` + `ocean-project-header` + `ProjectIntelligenceStrip` | **modify** | Collapse competing headers into the approved band: project title, me/token callout, Usage & spending. Do not add a second identity chrome. |
| Home surface | `OceanProjectWorkspace` + `HomePage` redirect + KC four-bucket + `TodoFrame` | **modify + compose** | No new truth store. Home is a new **projection layout** over existing todos / people / issues / knowledge / timeline selectors. Stop redirecting `/` away from the open project’s Home. |
| People rail | `buildPeopleRows` / KC people bucket / `PersonEntity` | **modify** | Reuse people projection. New layout only. |
| To Do queue | `composeKnowledgeCentreItems` todo bucket + `addTodo` / `toggleTodo` | **modify** | Queue is a presentation over canonical todos plus date-relevant non-todos. Do not coerce Issues into todos. |
| Capture | `CaptureWorkspace` | **modify (visual only)** | Keep Analyse → Review → Apply. Do not change resolver/Apply. |
| Review | `CompactChangeCard`, `SuggestedChangesList`, `CorrectionActions` | **modify (visual only)** | Authority is standalone `28:119` (Converged MP v2), not the four-tab workspace. Keep Analyse → Review → Apply. “Confirm review” is Apply confirmation copy. Do not mount Review as a workspace tab. |
| Knowledge Centre | `OceanKnowledgeFrames`, `four-bucket.ts`, `KnowledgeSearchAskBar`, `KnowledgeTagFilter` | **modify** | Figma confirms search, Ask Lume, domain + tag filters, grid/list toggle, `+ Add item`. Endless scroll is **not** in the current frames — do not invent it. |
| KC detail drawer | `KnowledgeItemDetailDrawer` | **modify** | Figma confirms `← Back`, HISTORY, Close, Remove, Open Details, tag chips. Same drawer. Do not replace with a new drawer system. |
| KC Edit Item | drawer `Correct` / `updateKnowledgeSection` / `updateTodo` | **modify** | Figma v3: Save changes / Discard; tags persist only on Save. Manual edit already bypasses Review. |
| Project Scan | none mounted | **create (view only)** | Figma confirms four analysis groups and explicit non-writer copy. `Scan again` recomputes the projection. Findings may seed Suggestions. Do not write on sight. |
| New Project | `NewProjectExperience` | **modify (visual)** | Compose-oriented four-frame path is already production. |
| First Project / Help | `NewProjectExperience variant="first-run"`, `FirstProjectGuidance` | **modify (visual)** | Same first-run entry. |
| Suggestion → Add | unmounted `ProjectWidgetGrid` + `acceptSuggestion` | **modify + persist** | Figma is a Home modal: Save To Do / Discard. Reuse recommendation records. Not Capture Review. D-003 must be closed for Discard to survive reload. |
| Manual Add Item | New Project `ComposeFrame`; store `addTodo` / knowledge helpers | **create thin adapter** | Figma is a KC drawer with Issue / Person / To Do / Knowledge. Writes only on Save item. Hide tags when type = Person. Missing Issue/Person helpers may extend existing persist — not a new RPC. |
| Drawer Back stack | none | **create** inside existing drawer | Client navigation stack only. Not a route/store of truth. |
| Domain header / cards | `KcItemCard`, `DomainMark`, locked domain tokens | **modify** | Tokens already match coral/blue/green/purple. Restrain tints. |
| me mark | `ocean-wordmark-me`, `ocean-ai-glyph` ✦, `LumeLogo` | **modify / small create** | Figma component `Brand/AIUsageMark` is underlined `me` (standard / button / micro). Keep inside AI buttons. Logo SVG is not the wordmark authority. |
| Warning / instruction | `.ocean-save-error`, Capture reliability, Needs You, first-run cues | **modify** | Reuse surfaces; replace “project truth” copy. |
| Buttons | `primary-btn` / `ghost-btn` / `danger-btn` | **reuse** | Already locked to Lume purple / destructive. |
| Avatars | `ReviewPersonAvatar`, `PersonEntity` | **reuse** | |
| Timeline | `TimelineFrame`, `timeline-projection.ts` | **reuse** | Read-only embed on Home / KC. |
| History | `history_events`, `/history` page | **modify** | Item drawer may show an event only when existing contracts attribute it deterministically. Current table has no `item_id` — preserve D-004 rather than fuzzy-match. No second store. No history migration. |
| Tags | `src/lib/tags/*`, `persist-tags.ts`, `KnowledgeTagFilter` | **modify** | Wire editor + store. No new schema. |
| Catch Me Up | `CatchMeUpPanel` | **keep unmounted from tabs** | Current Figma tabs do not include it. Derived briefing only. Not Project Scan. Not a writer. |

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
- KC/Home Manual Add for all four domains (Figma: drawer, Save item);
- Suggestion Add → Save To Do / Discard + durable Discard (D-003);
- tag editor on Issue / To Do / Knowledge (create-on-Save only; hide on People);
- grid/list toggle (Figma required). Endless scroll is **not** required;
- underlined `me` mark sizes (`Brand/AIUsageMark`);
- user-facing “project truth” copy sweep (current Figma already avoids the phrase).

### Architecture gates (do not implement in passing)

1. **Tag persistence model** — already exists. Gate only if someone proposes a new table/RPC/RLS.
2. **People tags** — data allows `stakeholder` tags; product forbids People-tag UI. Do not “complete” the data model in the UI.
3. **Multi-owner items** — not present. Do not add.
4. **Suggestion discard durability** — D-003. Prefer persist existing `recommendations` status. STOP if that requires a new table.
5. **Item History identity** — `history_events` has no `item_id` / `target_id`. Do **not** fuzzy-match, title-match, or invent detail-string conventions. Preserve D-004 as a bounded limitation in the item drawer. STOP before any history schema migration unless explicitly approved.
6. **Manual Add Issue / Person** — if existing persist helpers cannot create a risk / stakeholder without a new RPC, extend the established persist path additively. STOP before a new canonical kind.
7. **Project Scan writer pressure** — if Figma shows Scan applying fixes directly, keep analysis-only and route user action through Suggestion Add or Manual Add. Do not let Scan write.
8. **Catch Me Up vs Project Scan** — do not rename Catch Me Up into Scan. Do not import AI-first Scan architecture.
9. **KC filter-row `Add tag`** — filter chrome only. Do not create orphan project tags from that control.
10. **Review chrome** — `28:119` is a standalone Review surface. Do not invent a Home-tab Review mode.

Figma close-out added **no new schema / RPC / RLS gate**.

---

## 12. Proposed Part 2 phases

Safe commit boundaries. Each phase stays on `integration/figma-ui-convergence-v1`. Re-run `npm run git:preflight` and `npm test` at the end of each phase. Do not merge to `main`.

0. **Figma close-out** — **done** 17 Sep 2026. Listed nodes inspected; reuse matrix confirmed; no architecture gate.
1. **Shell chrome** — sidebar + four tabs + header band + copy sweep for “project truth” in mounted chrome. Home tab may still render current KC until Phase 2. Files: `Sidebar.tsx`, `ProjectModeSelector.tsx`, `OceanProjectWorkspace.tsx`, `TopHeader.tsx`, `AppShell.tsx`, locked CSS.
2. **Home projection** — compose To Do queue / People rail / Issues / Knowledge / Timeline from existing selectors (`four-bucket.ts`, `ocean-frames.ts`, `TimelineFrame`). Change `/` and project default mode to Home. No new persist. Issue-in-queue stays an Issue.
3. **Knowledge Centre visual convergence** — grid/list toggle, search/Ask Lume, filters, Open Details, `+ Add item` entry. No endless-scroll contract.
4. **Drawer stack + History + Close/Remove** — extend `KnowledgeItemDetailDrawer` with `← Back` and item History read. Map Close/Remove onto existing complete/resolve/delete helpers. No second history store.
5. **Tags editor** — wire `suggestTags` + `persist-tags.ts` through `store.tsx` for Issue / To Do / Knowledge only. Discard creates nothing. Save is the write. Hide on People. Tests in `scripts/verify-project-tags.ts` plus new store/UI tests.
6. **Manual Add + Suggestion Add/Discard** — KC Add Item drawer and Home Suggestion modal over canonical writes; persist recommendation dismiss (D-003) if the existing table supports it.
7. **Project Scan view** — read-only Risks / Dependencies / Missing information / Contradictions. Findings may offer Suggestions. No canonical mutation.
8. **Capture / Review / New Project / First Project visual pass** — chrome only. Capture uses workspace v2 shell; Review stays standalone `28:119`. Do not touch Apply, resolver, receipts, or Prompt A.
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
| Figma frame inspection | **done** | Figma MCP authenticated this thread; §9 evidence 17 Sep 2026 |
| Part 2 UI implementation | in progress | Phases 1–9 landed on integration branch. `npm test` 100/100. Honour §17. Do not merge to `main`. |

---

## 15. Known blockers

1. ~~Figma MCP / frame inspection~~ — **closed** 17 Sep 2026.
2. D-003 suggestion dismiss is memory-only. Home/Scan Discard cannot be honest across reload until persisted.
3. D-004 History persist gaps. Item History UI must not pretend missing events exist.
4. Current `npm run lint` is already red on `main`. Not a programme blocker; do not churn it.
5. User-facing “project truth” copy still exists in mounted Capture / AppShell / New Project strings.

**STOP conditions found in Part 1 (code + Figma):** none that prevent planning. No schema change is required to begin shell/Home/KC visual work. Figma did not raise an architecture / schema / domain gate.

---

## 16. Part 1 status for the next agent

```text
PART 1 STATUS
  Recovery, preflight, code inspection, Figma inspection, and plan
  are written. Figma-inspection blocker is closed.
  No architecture / schema / domain gate.

PART 2 STATUS
  Started. Honour §17 safety rules. Stay on
  integration/figma-ui-convergence-v1. Do not merge to main.
```

---

## 17. Part 2 safety clarifications (binding)

Recorded before Phase 1 implementation. These override any earlier “filter History by title” or “transaction-pure tag Save” reading of this file.

### 17.1 Item History attribution

`history_events` columns today: `workspace_id`, `project_id`, `type`, `title`, `detail`, `source`, `created_by`, `created_at`. There is **no** `item_id` / `target_id`.

- Do **not** implement apparent item-level History by fuzzy matching, title matching, or detail-string conventions and present that as authoritative.
- Only display a History event in an item drawer when existing data/contracts allow that event to be **deterministically attributed** to that item.
- If existing events cannot be deterministically attributed, preserve **D-004** as an explicit bounded limitation.
- Do not create a second UI history store.
- Do not add a history schema migration during this UI programme unless a STOP condition is raised and explicitly approved.
- New actions may write through existing `persistHistoryEvent` where attribution is safe under existing contracts (project-level chronology is fine).
- Do not fabricate historical events that were never persisted.

### 17.2 Tag Save failure safety

Approved existing architecture only:

- tables: `project_tags`, `item_tags`
- helpers: `persistEnsureProjectTag`, `persistAttachItemTag`, `persistDetachItemTag`

No new schema / RPC / RLS / domain contract.

- Save is the only UI write boundary. Discard before Save performs **zero** persistence.
- Reuse an existing equivalent tag (same project + slug) where possible.
- Post-create Save is ensure-then-attach, not one database transaction.
- Never report Save success unless the item/tag **attachment** actually completed.
- If this Save created a new tag and attachment then fails, clean that newly-created tag **only** if the existing architecture lets you prove it is still unused (`item_tags` lookup succeeds and is empty).
- Never delete a tag that could have been attached elsewhere.
- If safe compensating cleanup cannot be guaranteed, leave the harmless metadata row, report the Save failure, and document the bounded failure mode.
- An unattached metadata tag must never be treated as canonical project information.
- Do not add a new RPC merely to achieve transaction purity.

### 17.3 Knowledge Centre result loading

Retain the existing production behaviour:

- no traditional pager;
- hydrate the full project set, then filter/render every matching item;
- do not remove this because Figma omitted loading chrome;
- endless scroll is **not** a Figma requirement and must not be invented.
