# Actual V2 product surface inventory

Inspected on frozen HEAD `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4`.  
This is **what the product does now**, not a Magic Patterns inventory.

V1 **target** decisions (frame order, onboarding, Desert, Coach/Advise, Timeline, truth chrome, People direction) live in [SPIDERMAN_AMENDMENT.md](./SPIDERMAN_AMENDMENT.md). They do not rewrite this inventory.

## Shell / navigation

| Surface | Path / component | Notes |
| --- | --- | --- |
| App shell | `src/components/AppShell.tsx` | Sidebar + main |
| Sidebar | `src/components/app-shell/Sidebar.tsx` | Wordmark `lume` (embedded `me`); Projects list; green `+ New Project`; Master To Do; History; Captures; Account; Help. **No** Overview, Knowledge Centre, Capture, Advise, Coaching in normal nav. Evals + Golden Test + AI Cockpit are internal/dev. |
| Home | `src/app/page.tsx` | With projects → redirect to first project KC. Zero projects → `NewProjectExperience variant="first-run"`. **V1 first-run remains New Project Talk** (no sample project). Hydrate failure → error card, not empty seed. |
| Selected project | `src/app/projects/[id]/page.tsx` + `OceanProjectWorkspace` | Modes live **in the project**, not the sidebar |
| Mode selector | `ProjectModeSelector` | Capture (✦) / Knowledge Centre / Advise Coming soon (disabled) |
| Intelligence strip | `ProjectIntelligenceStrip` | Counts + Refresh + actions-left pill |
| Standalone Capture URL | `src/app/capture/page.tsx` | Redirects to `/` |
| Captures list | `src/app/captures/page.tsx` | Session history; empty “No Capture sessions yet.” |
| Coaching page | `src/app/coaching/page.tsx` | **Leftover** full page; not in sidebar. Coach also exists as `CoachDrawer` (D-031 auto-open). `HeaderCoachButton` exists but is **not mounted**. |
| Meetings | `/meetings`, `/meetings/[id]` | Legacy `DashboardChrome`. Also embedded as KC “Meeting Prep” frame |
| Memory | `/memory` | Legacy Knowledge Q&A; not KC primary; **not in sidebar** |
| Releases | `/releases` | Legacy playbook; not Ocean-primary |
| Account | `/account` | Profile, billing, **Appearance** (`LumeThemePicker`); trial-expired uses `TrialExpiredPanel` (no sidebar) |

## Knowledge Centre

`OceanKnowledgeFrames` — three **primary** frames then **secondary** via scroll (current product: Current position, Risks, To Do). **V1 target** (Spiderman): To Do + Risks on top; Current position below. Cards open `KnowledgeItemDetailDrawer` (role=dialog, Escape, return focus).

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
| Timeline | Embedded `TimelineFrame` | **Duplicates** Important dates. **V1:** never a date authority — projection over milestone/date data, or deletion candidate |

Search Knowledge (deterministic) vs ✦ Ask Lume (`KnowledgeSearchAskBar`). Suggested questions present. `TellMePanel` still exists but is **unwired** from the Ocean shell — “✦ Lume noticed” on the live path comes from the Ask answer block.

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
| No-change / already known | V2 account count; legacy `NO_CHANGE` findings are filtered out of the observation list — not a dedicated Review section |
| Remember | `KnowledgeRememberList` — Remember / Remember All (not maintained truth until approved) |
| Save/error | Ocean `saveStatus=error` / `ocean-save-error` (Phase 3A); Capture persist-first on 3B domains |

Review cards: `CompactChangeCard` with Current vs Suggested, create/remove layouts, Why panel (progressive disclosure). Entity kinds include action, milestone, decision, risk, stakeholder, availability, knowledge, nudge, meeting, memory.

**Orphan Capture UX:** Immediate-merge `CaptureBar` / `captureWithAI` were **deleted in Slice 1A**. Ocean path remains analyse → review → `applyOne`.

Flag: `LUME_CAPTURE_V2` (unset = legacy findings path). **Same Review chrome** for both; V2 adds the compact account line.

## New Project

`NewProjectExperience` paths: `choose` → `talk` | `blank` | (`categorise` if V2) → `review`.

| Path | Behaviour |
| --- | --- |
| Talk It Through | Messy natural input; optional STT; Build My Project |
| Start Blank | Name + code; skips review; **not** V2 map |
| Paste | **Not on the choose screen.** Historical screenshots still show it. Constitution: paste out of V1 scope. API still accepts `sourceMode: "paste"`, but the Talk textarea always posts `"talk"` even if the user pastes. |
| V2 categorisation | Only when `pipeline === "v2"`; buckets People / Risks / Dates / To Dos / Knowledge / commentary / ignore; “not maintained truth yet”; then existing `ProjectSetupReview` |
| Setup review | Existing review; create is persist-first |
| First-run | Same component, `variant="first-run"` on zero-project home — **not a separate onboarding product** |

Flag: `LUME_NEW_PROJECT_V2`.

## Advise / Coach / Tell Me / History

| Surface | Status |
| --- | --- |
| Advise | Disabled “Coming soon” in mode selector. No V1 Advise screen. **V1: parked.** |
| Coach | Drawer + leftover `/coaching` page. D-031: can auto-open over Capture/KC. **V1: leave the active shell** (removal/deprecation). Do not redesign here. |
| Tell Me / Ask | Live: `KnowledgeSearchAskBar`. `TellMePanel` unwired. |
| Meeting Prep | KC embed + leftover `/meetings` |
| History | `/history` — chronology / evidence, **not** current truth (D-004 persist gaps) |
| Reminders | Todo `kind=REMINDER` in data/setup review. **No dedicated Reminders frame.** |

## Unwired / leftover UI (deletion candidates)

| Component / route | Status |
| --- | --- |
| `CaptureBar` | **Deleted** Slice 1A (was unmounted immediate-merge) |
| `TellMePanel` | Unwired; Ask lives in `KnowledgeSearchAskBar` |
| `HeaderCoachButton` | Not mounted |
| `ProjectWidgetGrid`, `ProjectKnowledgeBrief`, `WorkspaceGrid` | Old dashboard; unwired |
| `AppearanceToggle` | Unmounted light↔dark toggle |
| `/memory`, `/meetings`, `/releases`, `/coaching` | Exist; not Ocean sidebar destinations |
| `DetailModal` | Still used by legacy frames (`TodoFrame`, `RiskFrame`) and delete confirm; Ocean KC uses the drawer instead |

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

Current implementation: **project-scoped** `stakeholders` UUID (`ensurePersonOnProject`). V1 **target direction** (Spiderman; Architecture owns schema): **workspace-scoped Person identity + project-scoped participation**. Not implemented on this branch. UI already uses `@name · scope` (`PersonEntity`) and Confirm Owner share-vs-replace (Slice 2D).
