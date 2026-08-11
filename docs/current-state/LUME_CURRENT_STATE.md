# Lume Current State

**Audit date:** 2026-08-11  
**Branch observed:** `cursor/capture-coach-layout-c9f3` (working tree at audit time)  
**Viewport primary:** 1440×900  
**Narrow viewport:** 1280×720  
**Method:** Read-only code inspection, automated verify scripts, production build, browser screenshots.  
**Environment note:** No `.env.local` / `OPENAI_API_KEY` in the audit environment. Capture UI therefore shows local-mode banners; Capture review screenshot `02*` is from `/dev/review-preview` (static fixture of the current review UI). Golden Mixed/Hard/Standard were exercised via `npm run verify:golden-test` (local pipeline).

**Confirmation:** No application code or behaviour was changed for this audit. Only documentation and screenshots under `docs/current-state/` were added.

---

## A. Application Stack

| Concern | Status |
|---|---|
| Frontend framework | **Next.js 16.2.11** (App Router) + **React 19.2.4** |
| Language | **TypeScript 5** |
| Styling | **Tailwind CSS 4** + large custom stylesheet `src/app/globals.css`; Inter font |
| Backend/API | **Next.js Route Handlers** under `src/app/api/**` (no separate backend service) |
| Database | **Not implemented** |
| ORM/data layer | **Not implemented** |
| Authentication | **Demo cookie gate** (`DEMO_USERS` + HMAC `mc_session`) — not a full account system |
| Hosting/deployment | **Vercel-oriented** (`vercel.json`, README). No production URL in repo |
| AI provider | **OpenAI** (server-side) |
| AI model | Chat default `gpt-4o-mini` (`OPENAI_MODEL` override); transcription `whisper-1` |
| Payments | **Not implemented** |
| Email provider | **Not implemented** |
| Analytics | **Not implemented** |
| Error monitoring | **Not implemented** |

Package name remains `mission-control`; product branding is **Lume**.

---

## B. Persistence

### Where data lives

| Store | Mechanism | Key / location |
|---|---|---|
| Primary app state (`MissionState`) | Browser **localStorage** | `mission-control-state-v5` (`src/lib/store.tsx`) |
| Workspace layouts | localStorage | `mc-workspace-layout-v3:{scope}` |
| Appearance (theme) | localStorage | `mc-appearance-v1` |
| Sidebar collapsed | localStorage | `mc-sidebar-collapsed-v1` |
| Capture session history | localStorage | `lume-capture-sessions-v1` (max 80) |
| Coach session history | localStorage | `lume-coaching-sessions-v1` (max 80) |
| Active Capture draft/review | **sessionStorage** | `lume-capture-session-v1` |
| AI vocabulary dictionary | localStorage | `lume-project-dictionary-v1` |
| Auth session | httpOnly cookie | `mc_session` (14 days) |
| AI Cockpit metrics | Server filesystem (dev) | `.lume-dev/ai-cockpit-metrics.json` |

There is **no server database** for projects, todos, knowledge, or history. Capture API receives client state in the request body.

### What happens when…

| Event | Result |
|---|---|
| Browser refreshes | MissionState + histories + layouts + theme survive (localStorage). Active Capture draft survives **same tab** (sessionStorage). |
| User logs out | Cookie cleared only. **localStorage is not wiped.** |
| Server restarts | App data unaffected (client-local). Auth cookies still valid if `AUTH_SECRET` unchanged. |
| Another browser/device | **No shared data** — empty/seed state unless that browser has its own localStorage. |

### Entity persistence status

| Entity | Status | Notes |
|---|---|---|
| Projects | **Local only** (+ **Seeded** on first visit) | ATLAS / HORIZON / RELOPS via `createSeedState()` |
| To Dos | **Local only** (+ Seeded) | |
| Risks | **Local only** (+ Seeded) | Stored primarily as `knowledge.sections.risks` (+ risk recommendations); Risk frame UI |
| Knowledge | **Local only** (+ Seeded) | Project knowledge + `/memory` org memories |
| Stakeholders | **Local only** (+ Seeded on projects) | Embedded on `Project.stakeholders`; no dedicated Stakeholders frame; Capture “stakeholder” often maps to knowledge people bullets |
| Milestones / Timeline | **Local only** (+ Seeded) | `state.timeline` |
| Capture sessions (history) | **Local only** | `lume-capture-sessions-v1` |
| Active Capture draft | **Local only** (sessionStorage) | Lost when tab/session ends |
| History (activity feed) | **Local only** (+ Seeded) | `state.history` |
| Coach sessions | **Local only** | `lume-coaching-sessions-v1` |
| User settings | **Local only** | Theme, layouts, sidebar — not account-scoped |

---

## C. Authentication / User Accounts

| Question | Current answer |
|---|---|
| Real signup? | **No** |
| Real login? | **Partial** — demo email/password against env `DEMO_USERS` |
| Passwords handled? | Plaintext pairs in env (`email:password[:Name]`), not a hashed user store |
| OAuth? | **No** |
| Email verification? | **No** |
| Forgot/reset password? | **No** |
| Sessions persistent? | **Yes** — HMAC cookie up to 14 days (`httpOnly`, `SameSite=lax`, `Secure` in production) |
| Multiple real users? | Multiple demo users can be listed in env; **not** real multi-tenant accounts |
| Data isolated between users? | **No** — all users on a machine share the same browser localStorage |
| Account deletion flow? | **No** |

If `DEMO_USERS` is unset and `AUTH_REQUIRED` is not `true`, the app is open (typical local dev). Login API returns 503 when demo users are not configured.

---

## D. Billing

| Question | Current answer |
|---|---|
| Stripe / payment provider? | **Not implemented** |
| Subscription model? | **Not implemented** |
| Free trial? | **Not implemented** |
| Plan/entitlement checks? | **Not implemented** (client soft meter: 50 analyses/month in `MissionState` only) |
| Server-side billing enforcement? | **Not implemented** |
| Customer billing portal? | **Not implemented** |
| Cancel / failed payments? | **Not implemented** |

---

## E. Landing / Public Marketing Site

| Question | Current answer |
|---|---|
| Public unauthenticated landing that explains Lume? | **No** — `/` is the app Overview (redirects to `/login` when auth required) |
| Pricing page? | **No** |
| Sign Up? | **No** |
| Login? | **Yes** — `/login` demo gate |
| Trial CTA? | **No** |
| SEO/meta setup? | Minimal app metadata only; no marketing SEO site |
| Privacy / terms content? | **No** |

---

## F. New Project

Implemented in `NewProjectExperience` / `ProjectSetupReview` / `/projects/new` / `/api/new-project`.

| Capability | Status |
|---|---|
| Start Blank | **Implemented** (name + code → create; skips review) |
| Talk It Through | **Implemented** (recommended path; record/type → Build My Project → review) |
| Paste Project Info | **Currently implemented but now out of v1 scope** |
| Zero-project onboarding | **Implemented** — Overview with `projects.length === 0` shows first-run Project Intelligence |
| Project setup review | **Implemented** (Talk/Paste only) |
| Inline corrections | **Implemented** on review |
| Uncertainty review | **Partial** — Needs Review flags on some extracted items |
| Knowledge explanation | **Implemented** in Talk path + review (“Things Lume will remember”) |
| Transcription | **Implemented** (browser STT + `/api/transcribe` Whisper when configured) |
| Final create/persist | **Implemented** into local MissionState (+ source narrative memory when present) |

Paste Project Documentation still appears in UI and screenshots (`03-new-project-start.png`, `04-zero-project-first-run.png`). **Do not treat as v1.**

---

## G. Capture

| Capability | Status | Note |
|---|---|---|
| Text input | **Implemented** | Multi-block auto-expand textareas |
| Transcription | **Implemented** | Record → live STT and/or Whisper |
| Source retention | **Partial** | Capture history stores transcript + result; active draft in sessionStorage |
| Analysis | **Implemented** | `/api/capture` OpenAI or local fallback |
| Context | **Implemented** | Context assembly + (dev) Context Inspector |
| Findings | **Implemented** | Validated findings pipeline |
| Deterministic operations | **Implemented** | create/update/complete/etc. from findings |
| What Lume Understood | **Implemented** | Review summary observations |
| Action relationships | **Implemented** | Complete/Update/Create labels |
| Ready | **Implemented** | |
| Needs Review | **Implemented** | |
| Unmatched | **Implemented** | |
| Project uncertainty | **Implemented** | `PROJECT_UNCERTAIN` + picker |
| Cross-project handling | **Implemented** | Soft hint; multi-project regressions in verify |
| Knowledge review | **Implemented** | Remember treatment in review |
| Risk review | **Implemented** | Dedicated risk handling in review + Risk frame |
| Correction UX | **Implemented** | Edit targets, kinds, dismiss, Use This, etc. |
| Apply Ready | **Implemented** | |
| Persist approved changes | **Implemented** | Writes into local MissionState |
| History integration | **Implemented** | Captures list + activity history |

Upload-file source exists in session model (`source: "uploaded"`) but **Upload UI was removed** from Capture toolbar — paste via Ctrl/Cmd+V still works.

---

## H. Project Areas

| Area | UI | Persistence | Capture integration | Editing |
|---|---|---|---|---|
| To Do | **Implemented** (default frame) | Local only | Implemented | Implemented |
| Waiting/Chase metadata | **Implemented** (todo kinds) | Local only | Implemented (chase → CHASE) | Implemented |
| Nudge Me | **UI retired** (hidden by default; re-enable via customiser) | N/A / legacy | Waiting/Chase replaces Nudge category | Legacy frame exists |
| Risk frame | **Implemented** (default) | Local only (knowledge risks) | Implemented | Implemented |
| Knowledge | **Implemented** (always on project page + `/memory`) | Local only | Implemented | Implemented |
| Meeting Prep | **Implemented** (default frame) | Local only (meetings) | Partial (meeting suggestions) | Implemented |
| Stakeholders | **Partial** — seeded on projects; **no Stakeholders frame** | Local only on project object | Partial (often knowledge people) | Via project create / seed; limited in-frame editing |
| Timeline / Milestones | **Partial** — optional frame (off by default) | Local only | Implemented as milestone ops | Implemented when frame enabled |
| History | **Implemented** (`/history`, `/captures`) | Local only | Capture sessions upserted | Read-oriented |
| Coach | **Implemented** (header button + drawer + `/coaching`) | Local only session history | Separate from Capture write path | Run coaching / view results |

---

## I. Developer Tooling

All gated by `NODE_ENV === "development"` unless noted.

| Tool | Entry | Working in audit? |
|---|---|---|
| Context Inspector | Capture “Context used” (dev) | Present in code; not exercised without AI key |
| Golden Test | `/dev/golden-test`, sidebar | **Yes** — `verify:golden-test` passed |
| Standard Golden | scenario `website-refresh` | **Passed** 3/3 local |
| Hard Capture Test | `website-refresh-hard` | **Strong** 3/3 local |
| Mixed 3/3/3 Test | `mixed-operations` | **9/9 correct** local |
| AI Cockpit | `/dev/ai-cockpit` | Present; metrics file store |
| Reset Demo Data | Sidebar button | Present; selective seed restore |
| Review Preview | `/dev/review-preview` | **Yes** — used for screenshot `02*` |
| Reliability / Reset previews | `/dev/reliability-preview`, `/dev/reset-preview` | Present |

---

## J. Current Tests

**Test command(s):** npm verify scripts (no Jest/Vitest suite; `tsx` regression scripts)

| Command | Result |
|---|---|
| `npm run verify` | **Pass** |
| `npm run verify:capture-context` | **Pass** |
| `npm run verify:capture-prompt` | **Pass** |
| `npm run verify:ai-domain` | **Pass** |
| `npm run verify:golden-test` | **Pass** |
| `npm run verify:findings` | **Pass** |
| `npm run verify:seed-reset` | **Pass** |
| `npm run verify:capture-reliability` | **Pass** |
| `npm run verify:capture-review` | **Pass** |
| `npm run verify:capture-workspace` | **Pass** (11 checks) |
| `npm run verify:new-project` | **Pass** (6 checks) |

| Metric | Value |
|---|---|
| Total verify suites run | **11** |
| Passing | **11** |
| Failing | **0** |
| Skipped | **0** |

**Capture golden outcomes (local pipeline via verify:golden-test):**

| Scenario | Outcome |
|---|---|
| Standard Golden | 🟢 Passed (3/3) × 3 runs |
| Hard | Strong (3/3), reliability=Normal, silentDrops=0 |
| Mixed 3/3/3 | 9/9 correct, needsReview=0, unmatched=0, silentDrops=0 |

**Production build:** `npm run build` — **succeeded** (Next.js 16.2.11).

---

## K. Production / Security Readiness

| Concern | Status |
|---|---|
| Secrets stored server-side | **Partial** — `OPENAI_API_KEY`, `AUTH_SECRET` server-only when set |
| Client-exposed API keys | **Not observed** — no `NEXT_PUBLIC_` OpenAI key |
| Authorization checks | **Partial** — proxy cookie gate when demo users configured; route handlers mostly trust proxy |
| Tenant/user data isolation | **Not implemented** |
| Input validation | **Partial** — ad hoc checks; findings validators; no Zod/schema layer |
| Rate limiting | **Not implemented** |
| HTTPS assumptions | **Partial** — cookie `secure` in production; hosting assumed |
| Secure cookie/session settings | **Partial** — httpOnly + SameSite=lax implemented for demo session |
| CSRF protection | **Not implemented** |
| Dependency vulnerability tooling | **Not implemented** (no audit CI) |
| Error monitoring | **Not implemented** |
| Logging | **Partial** — console / local only |
| Data deletion | **Not implemented** (account-level) |
| Data export | **Not implemented** |
| Backups | **Not implemented** (nothing server-side to back up) |
| Privacy policy | **Not implemented** |
| Terms | **Not implemented** |

---

## L. Current Deployment

| Item | Status |
|---|---|
| Deployed anywhere? | **Unknown / needs external verification** — no production URL in repo |
| Platform/provider | Configured for **Vercel** (`vercel.json`) |
| Environments | Dev local; Vercel implied by config |
| Production URL | **Not configured** in repository |
| Preview/dev environment | Local `npm run dev`; Vercel previews possible if project linked |
| Required env vars | `OPENAI_API_KEY` (AI); `DEMO_USERS` + `AUTH_SECRET` (demo auth); optional `OPENAI_MODEL`, `AUTH_REQUIRED` |
| Build command | `npm run build` |
| Start command | `npm run start` |
| Production build succeeds? | **Yes** (this audit) |

---

## M. Repository Snapshot

```
src/
  proxy.ts                 # auth gate (Next 16 proxy)
  ai/domain/               # AI record model, adapters, audits
  app/
    api/                   # auth, capture, coach, transcribe, new-project, dev/*
    (pages)                # /, projects, captures, coaching, history, login, memory, meetings, releases, dev/*
  components/
    app-shell/             # Sidebar, TopHeader, AppearanceToggle
    capture/ + review/     # Capture intelligence UI
    coach/                 # Coach drawer/preview/header button
    frames/                # To Do, Risks, Meeting Prep, Timeline, Nudge
    onboarding/            # New Project experience
    workspace/             # Frame grid / customiser
  lib/
    store.tsx              # MissionState + localStorage persistence
    types.ts               # Project models
    auth.ts                # Demo sessions
    openai.ts / pm-coach.ts
    capture/               # findings, context, review, reliability, suggestions
    create-project.ts      # New Project extraction + build
    seed*.ts               # Demo seed + reset
    sessions/              # Capture/Coach history helpers
    workspace/             # Layout defaults
    dev/                   # Golden tests, AI Cockpit
scripts/                   # verify:* regression scripts
docs/                      # product docs + this audit
public/
vercel.json
package.json
.env.local.example
```

| Concern | Location |
|---|---|
| Capture intelligence | `src/lib/capture/**`, `src/ai/domain/**`, `src/app/api/capture`, `src/components/capture/**` |
| Persistence | `src/lib/store.tsx`, `src/lib/sessions/**`, sessionStorage keys |
| Project models | `src/lib/types.ts`, `src/lib/seed.ts`, `src/lib/create-project.ts` |
| Auth plug-in point | `src/lib/auth.ts`, `src/proxy.ts`, `src/app/api/auth/**` |
| API calls | `src/app/api/**` (OpenAI from server modules) |

---

## N. Known TODOs / Comments

- **No meaningful `TODO` / `FIXME` / `HACK` / `TEMP` / `MOCK` / `DEV ONLY` comment markers** found in `src/` product code.
- Domain audit docs note Phase 1.5 gaps: `src/ai/domain/audits/ai-readiness.md`, `status-consistency.md` / `.ts` (e.g. no first-class BLOCKED/ARCHIVED status field yet).
- Dev-only surfaces explicitly gated by `NODE_ENV === "development"`.

---

## O. Current Known Limitations

### Launch blockers

These prevent strangers from safely using/paying for Lume as a real SaaS product:

1. **No durable multi-user backend persistence** — all project data is browser localStorage.
2. **No real authentication / account system** — demo cookie gate only; no signup, isolation, or account lifecycle.
3. **No billing / trial / entitlements** — cannot charge or enforce plans server-side.
4. **No privacy policy / terms / data export / deletion** — required for real users.
5. **No production tenant isolation or authorization model** for user data.
6. **No error monitoring, rate limiting, or dependency security CI**.
7. **No public marketing / pricing / signup funnel** — only the app shell + `/login`.

### Product bugs / polish issues (non-exhaustive, observed)

- Capture review screenshot environment depends on OpenAI key for live Analyse; without it, UI falls back to local mode banner.
- Paste Project Info still offered on New Project / first-run (now **out of v1 scope** — present but should not be launch-marketed).
- Stakeholders lack a first-class workspace frame; Capture stakeholder apply often writes knowledge people bullets rather than `Project.stakeholders`.
- Nudge Me frame still exists as retired/optional chrome.
- Developer tools (Golden Test, AI Cockpit, Reset demo data) appear in the sidebar in development builds — must not ship to strangers as primary nav.
- Soft monthly analysis meter is client-side only (bypassable).
- Zero-project first-run requires empty `projects` array; Reset Demo restores seeds and therefore **does not** show first-run (audit used localStorage clear in the browser only — no code change).

### Deferred / post-v1

- **Bulk project-document ingestion / Confluence / Jira estate import**
- Paste Project Documentation pathway (exists today; **out of v1**)
- Full status model (BLOCKED/ARCHIVED) per AI domain audits
- OAuth, email verification, password reset
- Server-synced Capture/Coach history across devices

---

## Screenshot notes

| File | How obtained |
|---|---|
| `01`, `05`, `06`, `07` | Live app with seeded demo data |
| `02*` | `/dev/review-preview` static Capture review fixture (current UI; no AI calls / no writes) |
| `03*` | Live `/projects/new` Talk → review via local assemble |
| `04` | Live Overview after clearing `mission-control-state-v5` in the browser session |
