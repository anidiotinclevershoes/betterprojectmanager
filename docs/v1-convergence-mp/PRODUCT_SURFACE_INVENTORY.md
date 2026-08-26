# Actual V2 product surface inventory

Inspected on frozen HEAD `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4`.  
This is **what the product does now**, not a Magic Patterns inventory.

## Shell / navigation

| Surface | Path / component | Notes |
| --- | --- | --- |
| App shell | `src/components/AppShell.tsx` | Sidebar + main |
| Sidebar | `src/components/app-shell/Sidebar.tsx` | Wordmark `lume` (embedded `me`); Projects list; green `+ New Project`; Master To Do; History; Captures; Account; Help. **No** Overview, Knowledge Centre, Capture, Advise, Coaching in normal nav. Evals + Golden Test + AI Cockpit are internal/dev. |
| Home | `src/app/page.tsx` | With projects → redirect to first project KC. Zero projects → `NewProjectExperience variant="first-run"`. Hydrate failure → error card, not empty seed. |
| Selected project | `src/app/projects/[id]/page.tsx` + `OceanProjectWorkspace` | Modes live **in the project**, not the sidebar |
| Mode selector | `ProjectModeSelector` | Capture (✦) / Knowledge Centre / Advise Coming soon (disabled) |
| Intelligence strip | `ProjectIntelligenceStrip` | Counts + Refresh + actions-left pill |
| Standalone Capture URL | `src/app/capture/page.tsx` | Redirects to `/` |
| Captures list | `src/app/captures/page.tsx` | Session history |
| Coaching page | `src/app/coaching/page.tsx` | **Leftover** full page; constitution says Advise/Coaching are not sidebar destinations. Coach also exists as a drawer (`CoachDrawer`) — D-031 auto-open |
| Meetings | `/meetings`, `/meetings/[id]` | Also embedded as KC “Meeting Prep” frame |
| Memory | `/memory` | Org memories, not KC primary |
| Releases | `/releases` | Not Ocean-primary |
| Account | `/account` | Profile, billing, **Appearance** (`LumeThemePicker`) |

## Knowledge Centre

`OceanKnowledgeFrames` — three **primary** frames then **secondary** via scroll. Cards open `KnowledgeItemDetailDrawer` (role=dialog, Escape, return focus).

| Frame | Source of rows | Empty copy |
| --- | --- | --- |
| Current position | Structured current facts/dates, else `sections.now` | Nothing recorded yet. |
| Risks & blockers | Domain `risks` open/watch, plus leftover knowledge bullets (D-030) | No open risks. |
| To Do | Open non-waiting todos | No open to-dos. |
| People & context | Stakeholders + responsibilities + availability via `buildPeopleRows` / `getPersonBundle` | No people recorded yet. |
| Dependencies | Structured `kind=dependency` current only | No structured dependencies yet. |
| Decisions | `sections.decisions` | No decisions recorded. |
| Important dates | Timeline/milestones | No milestones recorded. |
| Waiting & open loops | WAITING/CHASE/`waitingOn` todos **plus** `sections.openLoops` (dual authority D-008/D-021) | No open loops. |
| Meeting Prep | Embedded `MeetingPrepFrame` | Legacy embed |
| Timeline | Embedded `TimelineFrame` | **Duplicates** Important dates — candidate to delete later |

Search Knowledge (deterministic) vs ✦ Ask Lume (`KnowledgeSearchAskBar` → Tell Me). Suggested questions present.

Item detail: body, previous value, provenance (“Why Lume believes this”), Needs you reason, Confirm Owner, inline edit, related people via `PersonEntity` (`@name · scope`).

## Capture

`CaptureWorkspace` `variant="ocean"` inside project mode.

| State | How it appears |
| --- | --- |
| Compose | Textarea, labelled (sr-only), Analyse |
| Loading | Analyse in progress; `aria-live` region |
| Error / retry | `role="alert"` banner + Retry / Copy |
| Local/no OpenAI | Dev banner; V2 does **not** add regex — legacy fallback |
| Review | `ocean-capture-review`; boundary note: nothing enters maintained truth until approve |
| Observation accounting (V2 only) | `capture-v2-account`: total / proposed / already known / Needs you / commentary |
| Apply Ready | Ready cards + Approve Ready |
| Needs you | `readiness=needs_review` or `unmatched` → `CorrectionActions` (Use this / pick target / Confirm Owner) |
| No-change / already known | Counted in V2 account; may still be a card depending on pipeline |
| Save/error | Ocean `saveStatus=error` / `ocean-save-error` (Phase 3A); Capture persist-first on 3B domains |

Review cards: `CompactChangeCard` with Current vs Suggested, create/remove layouts, Why panel (progressive disclosure). Entity kinds include action, milestone, decision, risk, stakeholder, availability, knowledge, nudge, meeting, memory.

Flag: `LUME_CAPTURE_V2` (unset = legacy findings path). **Same Review chrome** for both; V2 adds the compact account line.

## New Project

`NewProjectExperience` paths: `choose` → `talk` | `blank` | (`categorise` if V2) → `review`.

| Path | Behaviour |
| --- | --- |
| Talk It Through | Messy natural input; optional STT; Build My Project |
| Start Blank | Name + code; skips review; **not** V2 map |
| Paste | **Not on the choose screen.** Historical screenshots still show it. Constitution: paste out of V1 scope. API still accepts `sourceMode: "paste"`. |
| V2 categorisation | Only when `pipeline === "v2"`; buckets People / Risks / Dates / To Dos / Knowledge / commentary / ignore; “not maintained truth yet”; then existing `ProjectSetupReview` |
| Setup review | Existing review; create is persist-first |
| First-run | Same component, `variant="first-run"` on zero-project home — **not a separate onboarding product** |

Flag: `LUME_NEW_PROJECT_V2`.

## Advise / Coach / Tell Me / History

| Surface | Status |
| --- | --- |
| Advise | Disabled “Coming soon” in mode selector. No V1 Advise screen. |
| Coach | Drawer + leftover `/coaching` page. D-031: can auto-open over Capture/KC. |
| Tell Me / Ask | `TellMePanel` / `TellMeSessionContext`; Search vs Ask distinction in KC |
| Meeting Prep | KC embed + `/meetings` |
| History | `/history` — chronology / evidence, **not** current truth (D-004 persist gaps) |
| Reminders | Todo `kind=REMINDER` in data/setup review. **No dedicated Reminders frame.** |

## Account / themes

| Theme | Mechanism |
| --- | --- |
| Ocean | Default. `data-theme="dark"`. Boot script in `layout.tsx` prevents FOUC. |
| Desert | Additive. `data-theme="desert"`. Account picker. Persists `mc-appearance-v1=desert`. Same components. |
| Light | Token block still in `globals.css`. **Not offered.** `AppearanceToggle` (light↔dark) is **unmounted**. |

## Trust states in UI

| State | Product presence |
| --- | --- |
| Known / confirmed | No permanent KC confidence badges (`null` / `legacy` / `confirmed` → no chip) |
| ✦ Lume noticed | Recommendations / intelligence; constitution allows stronger treatment |
| Needs you | Capture review, Confirm Owner dialog, item-detail `needsYouReason`, epistemic unknown/conflicting |

## People

Current implementation: **project-scoped** `stakeholders` UUID (`ensurePersonOnProject`). Architecture direction (this programme): **workspace-scoped Person identity + project-scoped participation**. Flagged — not silently designed away. UI already uses `@name · scope` (`PersonEntity`) and Confirm Owner share-vs-replace (Slice 2D).
