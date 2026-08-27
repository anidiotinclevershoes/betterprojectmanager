# Lume product audit — landing-page strategy

**Date:** 27 August 2026  
**Repo:** `betterprojectmanager` @ `main` (`060d147` and ancestors)  
**Method:** Read-only inspection of current code, constitution docs, architecture handoff, Known Discoveries, and existing screenshot/mockup assets. No production behaviour was changed. The app was not live-run in this environment (no `.env.local`).  
**Authority used:** `docs/README.md` hierarchy — constitution for *intent*, architecture handoff + code for *what exists now*. Root `README.md` and `docs/current-state/` are historical and are treated as such.

---

## Product one-liner (from the codebase, not a marketing brief)

**Primary (constitution):** Lume is a project-intelligence workspace for project managers who cannot realistically keep an entire changing project in working memory.

Locked short line in `docs/v1-reference-pack/LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md`:

> You can't keep an entire project in your head. Lume can.

**In-product copy that actually ships:**

| Surface | Copy | File |
| --- | --- | --- |
| New Project hero | “Project Intelligence” | `src/components/onboarding/NewProjectExperience.tsx` |
| Auth shell tag | “Project Intelligence” | `src/components/auth/AuthShell.tsx` |
| HTML metadata | “Lighting your way.” / “Lead with confidence. Own your projects.” | `src/lib/mission.ts` via `src/app/layout.tsx` |
| North-star (internal) | “a project manager with unusually reliable memory” | philosophy §27 |

The older Mission Control README one-liner (“AI Chief Project Officer · Executive Coach · Second Brain”) still lives in `src/lib/mission.ts` and coaching prompts. It is **not** what the Ocean product chrome says, and Coach/Advise are parked or leftover. Do not use it as current product positioning unless you are deliberately quoting internal coaching prompts.

---

## Implemented vs V1 vs speculative

Legend: **Today** = live in current Ocean product path (code + default flags). **V1 intended** = constitution / Spiderman / Part C, not fully shipped or not default-on. **Speculative** = parked, leftover, experimental-flagged, or not supported.

| Capability | Classification | What exists | Cite | Missing / caveat |
| --- | --- | --- | --- | --- |
| **Capture** (messy NL / voice → review → write) | **Today (partial)** | Ocean project mode. Text + Record. ✦ Analyse proposes; nothing is maintained truth until Approve / Apply Ready / Remember. | `OceanProjectWorkspace`, `CaptureWorkspace`, `/api/capture`, `src/lib/capture/apply/*` | Default engine is **legacy** OpenAI findings (`LUME_CAPTURE_V2` unset = off). V2 is decided V1 target, flag-gated. Meeting findings → unsupported / Needs you. |
| **Review / Needs you** | **Today (partial)** | Capture review: Ready / Needs Review / Unmatched; Confirm Owner dialog; Ask answers can show Needs you; item detail can show Needs you. | `CaptureWorkspace` review, `SuggestedChangesList`, `ConfirmOwnerDialog`, `KnowledgeSearchAskBar` | Two labels: Capture UI mostly says **Needs Review**, V2 account + Confirm Owner + Ask say **Needs you**. Not a dedicated “Needs You inbox”. |
| **Knowledge Centre** | **Today** | Default project mode. Browse frames + deterministic Search + ✦ Ask Lume. Cards open item-detail drawer. | `/projects/[id]`, `OceanKnowledgeFrames`, `KnowledgeSearchAskBar`, `KnowledgeItemDetailDrawer` | Frame order still Current position → Risks → To Do. V1 target (Spiderman) is To Do + Risks first. |
| **Advise / Coach** | **Advise: V1 parked (Coming soon). Coach: leftover, V1 should leave the shell.** | Advise tab disabled. Coach drawer still mounted in `AppShell`; `/coaching` exists, not in sidebar. `HeaderCoachButton` unmounted. | `ProjectModeSelector`, `OceanProjectWorkspace` advise stub, `CoachDrawer`, `src/app/coaching/page.tsx` | Constitution: do not build Advise for V1. Spiderman: hide/retire Coach. Auto-open overlay is D-031. |
| **Tell Me / project Q&A** | **Today (Ask bar)** | ✦ Ask Lume on KC. HTTP loads server durable truth; read-only. Suggested questions are deterministic (no AI on browse). | `/api/tell-me`, `src/lib/tell-me/*`, `KnowledgeSearchAskBar` | Standalone `TellMePanel` is **unwired**. Cross-project Ask exists in the library when question matches “across my projects”; V1 UI is project-scoped. Advisory questions append “Ask Coach” prose; Ocean Ask bar has **no Coach button**. |
| **AI current-state briefing** (“Where are we / Catch me up / What needs my attention”) | **Not a dedicated product.** Partial substitutes exist. | Current position frame; intelligence strip (“I know N things…”); deterministic suggested questions (risks, waiting, CAB, stakeholder); ✦ Refresh rebuilds a **snapshot** (compression), does **not** rewrite truth. | `OceanKnowledgeFrames` Current position; `ProjectIntelligenceStrip`; `src/lib/tell-me/suggestions.ts`; `/api/tell-me/refresh` | **No** strings “Catch me up”, “Where are we”, or “What needs my attention” in the repo. User can *type* those into Ask. Refresh ≠ briefing. Master To Do has **no** “✦ Lume Thinks” panel. |
| **Meeting Prep** | **Today (legacy, secondary)** | KC embed + leftover `/meetings` + `MeetingBriefModal`. Confidence: Ready / Nearly ready / Needs preparation. | `MeetingPrepFrame`, `src/app/meetings/*` | Constitution: retain if stable; no major rebuild. Quality not re-audited live here. Not a V1 hero surface. |
| **New Project** | **Today (Talk + Blank)** | Choose: Talk It Through (recommended) or Start Blank. Talk: messy transcript → review → persist-first create. First-run on zero projects. | `/projects/new`, `NewProjectExperience`, `/api/new-project`, `persistNewProject` | Paste pathway **not on choose screen** (out of V1). New Project V2 categorisation map is flag-off (`LUME_NEW_PROJECT_V2`). |
| **People / stakeholder context** | **Today (project-scoped, partial)** | People & context frame from `stakeholders` + current responsibilities; `@name · scope`; Confirm Owner share vs replace; person detail via drawer. | `buildPeopleRows`, `getPersonBundle`, `ConfirmOwnerDialog`, `PersonEntity` | **Not** a workspace CRM. Same human on two projects = two rows. Capture often leaves people *prose* without a stakeholder (D-007). Workspace-scoped Person = **V1 target, not implemented**. Name is not identity. |
| **Dates** | **Today (milestones)** | Important dates from `milestones` / `MissionState.timeline`. Capture can create/update dates; complete-date is Needs you (D-029 — no status column). | `buildDateRows`, `src/lib/capture/apply/dispatch.ts` `planMilestone` | Timeline frame **duplicates** Important dates (legacy embed). Spiderman: Timeline is a projection or deletion candidate, never a second date authority. No calendar/holiday/rota. |
| **To Dos** | **Today** | KC To Do frame (open, non-waiting); Master To Do `/todos` (cross-project list). Capture create/update/complete. Manual add still exists in `TodoFrame`. | `OceanKnowledgeFrames`, `src/app/todos/page.tsx`, `TodoFrame` | Master To Do V1 spec includes **✦ Lume Thinks** — **not implemented**. Waiting todos are *not* in the To Do frame (they go to Waiting). |
| **Risks** | **Today** | Domain `risks` (`open`/`watch`/`resolved`/`accepted`). KC shows open/watch. Capture can create/update status. Resolved must not resurrect from prose. | `src/lib/risks/lifecycle.ts`, Risks & blockers frame | Leftover Knowledge risk *prose* can still appear (D-030 / D-015). Risk recommendations stay suggestions until converted. |
| **Decisions** | **Today (Knowledge-authored)** | Decisions frame from `knowledge.sections.decisions`. Capture can write knowledge/decision. | `OceanKnowledgeFrames` Decisions | Mostly bullets, not a first-class decision object with status workflow. |
| **Reminders** | **Data kind only — not a product surface** | `TodoKind = REMINDER` in types, New Project review, TodoFrame dropdown, Capture mapping. | `src/lib/types.ts`, `ProjectSetupReview`, `TodoFrame` | **No Reminders frame, no reminder engine, no notifications.** |
| **Project history / accumulated context** | **Today (partial)** | `/history` chronology; `/captures` session list (client-primary); item detail provenance; Knowledge survives later Captures that omit it (design + reconcile). | `src/app/history/page.tsx`, `src/app/captures/page.tsx`, `knowledge-item-detail.ts` | Many history events never persist (D-004). Capture/coach tables underused (D-013). History is **not** current truth. |
| **Auth / SaaS foundation** | **Today (individual workspace)** | Signup/login/forgot/reset; Supabase Auth in production; personal workspace bootstrap. | `/signup`, `/login`, `ensurePersonalWorkspace`, `src/proxy.ts` | Signup copy: “personal Lume workspace — no billing, no team setup.” Not a team product. |
| **Billing / trial** | **Scaffolding today; commercial terms not published** | 14-day trial default (`LUME_TRIAL_DAYS`); Stripe checkout/portal/webhook; entitlement gate when expired. | `src/lib/billing/*`, `/api/billing/*`, `EntitlementGate` | **No public pricing page.** Price is env `STRIPE_PRICE_ID` only. Trial days “Tom confirms before go-live.” “Actions left” is a **local analysis meter**, not Stripe (D-024). |
| **Landing / marketing site** | **Does not exist** | `/` is the app: redirect to first project KC, or New Project first-run, or login when auth required. | `src/app/page.tsx`, `src/proxy.ts` | No `/pricing`, no marketing homepage, no SEO site. Auth pages are product gates, not a landing. |
| **Portfolio Overview / health scores** | **Out of V1 / removed** | Home no longer shows Overview. | `src/app/page.tsx`; philosophy §26 | Historical screenshots still show Overview — **stale**. |
| **Integrations (Jira, Confluence, calendar)** | **Speculative / out of V1** | Not in product. | philosophy §26 | Do not claim. |
| **Autonomous agents / silent writes** | **Explicitly forbidden** | Immediate-merge Capture path **deleted**. | Slice 1A; `planCaptureApply` | Do not claim auto-updating truth. |

---

## Capture philosophy as implemented

**Job (constitution):** “Tell Lume what happened.” Messy text or voice is interpreted; **review is mandatory** before maintained truth.

**What the user actually does today**

1. Open a project → mode **Capture** (same page as Knowledge Centre). Standalone `/capture` redirects home.
2. Type into auto-expanding textareas (“What happened? Type notes or press Record…”) and/or Record (browser STT + `/api/transcribe` Whisper when configured). **Not a form wizard.** Best-practice copy tells them to brief a colleague, name the project, include people/dates/risks in the same breath.
3. ✦ **Analyse** → `/api/capture` returns findings only. History event `capture_analysed`. **No domain writes.**
4. Review UI: transcript + “What Lume Understood” + Ready / Needs Review cards (Current vs Suggested, Why panel). Boundary note: nothing enters maintained truth until Approve / Apply Ready / Remember.
5. Per-item `applyOne` → `planCaptureApply` then `executeCaptureApply`. Illegal / unresolved → Needs you / no write.

**Messy NL vs forms:** Capture is NL-first. Manual forms still exist in leftover frames (`TodoFrame` add-task fields, `RiskFrame` new-risk) when those embeds are used. Ocean KC cards are browse/select, not Capture.

**Two understanding engines (do not market as one):**

| Path | When | Notes |
| --- | --- | --- |
| Legacy findings | **Default** (`LUME_CAPTURE_V2` unset) | OpenAI findings pipeline; local regex fallback if no OpenAI |
| Capture V2 | Flag `LUME_CAPTURE_V2=1` | Observation extract + identity resolve + same Phase 3B apply. Compact “already known / Needs you” account. **Decided V1 target**, not default |

**Updates vs duplicates (as coded, not as hoped):**

The apply planner **tries to update existing truth** when a durable on-project ID is known, and **fails closed** rather than inventing a sibling:

- CREATE against an existing on-project To Do / Risk / date / person → `noChange` (“already on the project”), not a second row (`src/lib/capture/apply/dispatch.ts`).
- Exact title match for risks; no fuzzy match.
- Person: model-supplied UUID is **not** identity proof. Ambiguous same-name → Needs you.
- Ownership share vs replace → Confirm Owner; adding a second owner does not replace the first unless chosen.
- Knowledge: wording-edit keeps identity; unrelated replacement is a new id (prefer losing inferred identity to transferring metadata).
- Later Captures that omit a still-current fact are **not supposed** to delete it (philosophy §14; reconcile insert/delete unmatched).

**Partials that still create duplicate-looking truth:** leftover Knowledge people prose (D-007); Waiting todos **and** `openLoops` concatenated (D-008/D-021); leftover risk sentences after domain resolve (D-030). A landing page must not claim “never duplicates” or “always updates the same record.”

**Ambiguous changes → Review / Needs you:** yes, on the Capture apply path. Also Confirm Owner. Missing retrieval is **not** supposed to invent Needs you (D-R06). Capture UI still labels many of these **Needs Review**, not “Needs you.”

---

## Trust / review model as implemented

Locked rule: **Lume either knows, or asks.** User-facing epistemic model: Known / ✦ Lume noticed / Needs you.

| State | Where it appears today | What it is not |
| --- | --- | --- |
| **Known** | Ordinary KC cards. Confirmed / legacy / null epistemic → **no** High/Medium/Low badges | Not an AI confidence score |
| **✦ Lume noticed** | Ask answer block (`noticed[]`); Capture observations; recommendations as suggestions | Not silent Risk/Todo/truth. Suggestion accept/dismiss often **memory-only** (D-003) — reload can resurrect |
| **Needs you** | Confirm Owner (“Needs you — do not guess”); Ask `needsConfirmation`; V2 observation account; item-detail unknown/conflict | Not a global inbox. Capture review still says **Needs Review** for many cards |
| **High/Medium/Low** | Capture review extraction quality only | Must not appear as permanent Knowledge chrome |

**Refresh:** ✦ Refresh on the intelligence strip calls `/api/tell-me/refresh`, rebuilds a derived snapshot, returns “Lume is up to date.” It does **not** mutate project truth. “Actions left” is a local analysis allowance (D-024), not paid entitlement.

**Ask:** read-only. HTTP production path loads durable workspace state server-side (Slice 1B). Client MissionState is not trusted as current truth on that route. Coach and **legacy** Capture still accept browser-supplied state (D-033 remainder).

**Hypothesis (labeled):** a landing page that says “Lume asks when it’s unsure” is directionally true for Capture apply + Confirm Owner + Ask, but overclaims if it implies a single Needs-you inbox or that every ambiguity is already caught (people prose, dual waiting stores, leftover risk bullets remain).

---

## Visual language notes

**Current shipping UI (code, post-Ocean):** dark Ocean is default (`data-theme="dark"`). Desert is a selectable token theme in Account (`data-theme="desert"`). Light tokens exist in CSS; light mode is **not offered** (`AppearanceToggle` unmounted). Font: **Inter**.

| Token | Ocean (default) | Desert |
| --- | --- | --- |
| App background | `#0d1117` | `#16110d` |
| Sidebar | `#10151d` | `#1c1510` |
| Surface | `#151b24` | `#241c16` |
| Text | `#f3f5f7` | `#f6eee4` |
| Accent (purple) | `#7c5cfc` | same family |
| Wordmark `me` | `#c9d4ff` (heavier) | same components |

**Brand:** Ocean sidebar wordmark is lowercase **`lu` + accented `me`** — text-only, as constitution requires. Auth / New Project still show a **lightbulb SVG** (`LumeLogo`) + “LUME” + “Project Intelligence.” Two brand treatments coexist.

**UI patterns:** compact left sidebar (projects, green `+ New Project`, Master To Do, History, Captures, Account, Help mailto); project header + three-mode selector (Capture ✦ / Knowledge Centre / Advise Coming soon); intelligence strip; Search vs Ask split bar; three primary knowledge columns then scroll secondary; card → side drawer; ✦ marks AI.

**Constitution mockup vs live:** `docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.png` is the **approved visual parent** (Meridian-style KC). Live product is the same language but: Current position still leads; Coach leftover; Advise disabled; no sparkle-mark logo in sidebar (wordmark instead); “actions left” is not billing.

**Historical screenshots (11 Aug 2026) are the old light Mission Control chrome** — Overview, Coaching in nav, yellow lightbulb, Capture sitting above widget frames. **Do not use them as “what Lume looks like now.”** Paths below, labeled HISTORICAL.

---

## Anything a landing page MUST NOT claim

1. **That Lume is a project-management / Jira / RACI / portfolio tool.** Constitution and in-product copy: project intelligence / memory, not task-tracker primacy. No Jira/Confluence/calendar integrations.
2. **Silent AI writes** or “Lume just updates your project.” Writes go through review (Capture) or explicit Confirm Owner / KC edit. Immediate-merge Capture was deleted.
3. **Advise / Coach as a V1 product.** Advise is Coming soon (parked). Coach is leftover and scheduled to leave the V1 shell.
4. **A dedicated “Catch me up / Where are we / What needs my attention” briefing product.** Those phrases do not exist. Current position + Ask + strip are the closest substitutes.
5. **Never duplicates / always merges people and waits.** Identity is project-scoped; people prose and dual waiting stores can still look duplicated.
6. **Workspace-global people / org chart / CRM.**
7. **Team / multiplayer collaboration.** Signup is a **personal** workspace. RLS is workspace membership; V1 UI is single-user project-scoped. No team onboarding.
8. **Published price, plan names, or “unlimited.”** Stripe price id is env-only; trial default 14 days is **unconfirmed for go-live**. “Actions left” is not the paid plan.
9. **Public marketing homepage or existing landing conversion funnel.** `/` is the app.
10. **Reminders, notifications, email nudges.** REMINDER is a todo kind only.
11. **Master To Do “✦ Lume Thinks.”** Only a cross-project open-todo list exists.
12. **Light mode as a shipping theme.**
13. **Omniscience / “Lume knows everything about your project.”** Empty-project Ask: “Lume doesn’t know much about this project yet.” Trust line is: if it doesn’t know, it asks.
14. **Using 11 Aug screenshots as current UI** (Overview, Coaching nav, light theme).
15. **Capture V2 / New Project V2 as the default live engine** unless the flags are actually on in production. Code default is legacy.
16. **Complete History after reload.** D-004: many events never persist.
17. **Progress percentages, portfolio health, or fake KPIs.** Explicitly rejected.
18. **Paste-a-document / bulk estate import as V1.** Paste New Project is out of scope and off the choose screen.

---

## Paths to existing screenshots / UI compositions

Live app screenshots were **not** captured in this pass (no env; this audit is documentation-only). Use these existing assets with the dates they actually represent.

### Current visual constitution (use for landing look-and-feel)

| Path | What it is | Use for landing? |
| --- | --- | --- |
| `docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.png` | Approved Ocean Knowledge Centre mockup (19 Aug). Dark navy, purple/blue accents, Search/Ask, three frames, Advise Coming soon, intelligence strip. | **Yes, as target visual** — label as product UI direction, not a guaranteed pixel-perfect live shot. |
| `docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.md` | Visual contract: wordmark, density, no badge storms. | Copy/art direction |
| Live Magic Patterns v8 (reference only) | `https://www.magicpatterns.com/c/gekwmrddrt3hkx7f1c9gm8/screens` — dump under `docs/v1-convergence-mp/mp-source/` | Design exploration; **not** a licence that shipping UI matches v8. Spiderman records V1 deltas (frame order, Desert, Coach out). |

### Best *code* screens to compose from (if a later pass can run the app)

| Screen | Route / component | Why it matters for landing |
| --- | --- | --- |
| Knowledge Centre | `/projects/[id]` → `OceanProjectWorkspace` mode knowledge | Hero: memory you can browse |
| Capture compose | same page, Capture mode | NL “tell Lume what happened” |
| Capture review | after Analyse; also `/dev/review-preview` (dev fixture) | Trust: review before write |
| New Project first-run | `/` with zero projects; `/projects/new` | “Talk it through” + review promise |
| Ask answer | Search/Ask bar with noticed + Needs you | Q&A without claiming a briefing product |
| Confirm Owner | `ConfirmOwnerDialog` | “Lume asks rather than guesses” |
| Auth | `/login`, `/signup` | “Project Intelligence” lockup (lightbulb + LUME) — different from Ocean wordmark |
| Account appearance | `/account` | Ocean vs Desert |

### Historical UI evidence (do not present as current product)

| Path | Date | Why stale |
| --- | --- | --- |
| `docs/current-state/01-main-project-workspace.png` | 11 Aug 2026 | Light theme, Overview-era workspace, Capture above To Do/Risks widgets, Coach button |
| `docs/current-state/02*.png` | 11 Aug | Capture review **fixture**; light chrome; still useful for *review philosophy*, not Ocean look |
| `docs/current-state/03*.png` | 11 Aug | New Project including **Paste** on choose — Paste is **not** on today’s choose screen |
| `docs/current-state/04-zero-project-first-run.png` | 11 Aug | First-run; pre-Ocean |
| `docs/current-state/05-overview.png` | 11 Aug | **Overview removed** |
| `docs/current-state/06-sidebar-navigation.png` | 11 Aug | Coaching, Knowledge, Golden Test in normal nav — Ocean sidebar does not look like this |
| `docs/current-state/LUME_CURRENT_STATE.md` | 11 Aug | Explicitly superseded (localStorage-era claims) |

---

## Commercial model (as coded)

| Question | Evidence | Claimable? |
| --- | --- | --- |
| Individual vs team | Signup: “Start a personal Lume workspace — no billing, no team setup.” `ensurePersonalWorkspace` | **Individual / personal workspace.** Not a team SKU. |
| Trial | Default **14 days**, `LUME_TRIAL_DAYS`, no card at signup; `ensure_workspace_trial` | Scaffolding exists. Days **not confirmed** for production. |
| Paid | Stripe Checkout subscription, one `STRIPE_PRICE_ID`, Customer Portal, expired → `TrialExpiredPanel` | Code exists. **No public price, plan name, or seat model.** |
| Meter | “N actions left” | **Not billing.** Local analysis allowance (D-024). |
| Marketing site | None | Landing must be created; it is not in this repo. |

---

## Hypotheses (not facts)

- **H1:** The most honest landing hero is Capture → review → Knowledge Centre, with Ask as the “sound informed” payoff — matching constitution “V1 is primarily Capture ↔ Knowledge Centre.”
- **H2:** Using Coach/Advise imagery will fight the product: those surfaces are parked or being removed.
- **H3:** “Catch me up” is a *question the user can Ask*, not a named feature. Marketing it as a named briefing product would be speculative.
- **H4:** Ocean PNG + live KC (if a later agent can log in) are the only visual sources that match V1. 11 Aug PNGs would actively mis-teach the brand (light, Overview, yellow bulb-in-nav).

---

## Source map (short)

| Kind | Path |
| --- | --- |
| What Lume is / V1 scope | `docs/v1-reference-pack/LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md` |
| Visual | `docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.md` + `.png` |
| What code does now | `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` + `src/` |
| Open debt | `docs/LUME_V1_KNOWN_DISCOVERIES.md` |
| V1 UX deltas (frame order, Coach out, Desert) | `docs/v1-convergence-mp/SPIDERMAN_AMENDMENT.md` |
| Surface inventory (frozen SHA; still mostly accurate) | `docs/v1-convergence-mp/PRODUCT_SURFACE_INVENTORY.md` |
| Flags | `docs/EXPERIMENTAL_PROGRAMME.md` |
| In-product name/tagline | `src/lib/mission.ts`, `AuthShell`, New Project hero |
