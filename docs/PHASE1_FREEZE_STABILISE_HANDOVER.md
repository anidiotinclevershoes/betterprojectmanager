# Phase 1 Freeze & Stabilise — Handover Report

**Branch:** `cursor/phase1-freeze-stabilise-c9f3`  
**Base:** `main` @ `5fb13c4` (Intelligence Header + refresh hydrate already merged)  
**Date:** 2026-08-17  
**Audience:** Product/development lead AI preparing Phase 2 (specialist PM intelligence evaluation)

---

## A. Executive summary

Lume’s core product on `main` is now **more reliable and safer for a paid V1 freeze**:

1. **Server-side entitlement** is enforced on all production AI routes (auth ≠ entitlement; both required).
2. **Coach identity** no longer hard-codes “Tom”; uses display name or “the project manager”.
3. **Known launch bugs** addressed: Ask Lume button chrome, Needs Review alignment, +Add focus loss, Capture minimise, History on New Build, Build AI error surfacing, cancel for Capture/Build/Coach AI.
4. **AI vs non-AI clarity** added via lightweight “Uses AI” hints on AI-consuming actions.
5. **Contained Knowledge/header QoL**: collapsible sections, People scan table, Best Practice beside Capture, Advise label on strip.
6. **Token/€ cost display** deliberately **not** shipped — data is incomplete for a defensible user-facing estimate.

**Recommendation at end of this report:** see section H.

The product is coherent enough to freeze feature work and begin Phase 2 intelligence evaluation **after** founder completes the manual production checklist in section F (Stripe, migrations verification, smoke tests). Remaining P0s are mostly ops/config, not missing code paths.

---

## B. Every requested item

| Item | Status | Notes |
|------|--------|-------|
| Server-side entitlement on Capture / Tell Me / refresh / Coach / New Project / transcribe | **FIXED** | `requireAiCaller` now calls `ensurePersonalWorkspace` + `ensureWorkspaceTrial` + `getWorkspaceEntitlement`; `!canUseLume` → **403** `entitlement_required`. Demo/`auth=none` local DX unchanged. |
| Auth vs entitlement separation | **FIXED** | 401 for missing auth; 403 for failed entitlement; rate limit still 429. |
| Coach “Tom” hard-coded | **FIXED** | `buildPmCoachSystemPrompt` / `resolveCoachManagerLabel`; coach API passes `gate.displayName`. UI copy cleaned. Legacy parser still accepts old “What Tom Should Do Now” section title for old sessions. |
| past_due grace (client + server agree) | **VERIFIED ALREADY FIXED** (evaluator) + **FIXED** (UX) | `canUseLume: true` + `past_due_grace` already in entitlements. Added grace banner when allowed + `past_due`. No dunning system. |
| Billing / snapshots / RLS / tenant / prod config in repo | **VERIFIED IN CODE** | Migrations exist: `20260813140000_billing_foundation.sql`, `20260815160000_project_intelligence_snapshots.sql`. Scripts pass structurally. Live tenant isolation **SKIPPED** (no local Supabase creds). |
| Tell Me “Ask Lume” not looking like a button | **FIXED** | Uses `primary-btn tell-me-ask-btn` + Uses AI hint. |
| Needs Review date alignment | **FIXED** | Reserved `np-needs-review-slot` column so grids don’t shift. |
| + Add focus loss after one character | **FIXED** | Unstable `key={title-index}` → stable `clientKey` / index keys. |
| Editable dates / date picker | **VERIFIED ALREADY FIXED** | All editable dates audited use native `type="date"`. |
| Capture Minimise does nothing | **FIXED** | Was setting `collapsed` with **no CSS**/no hide. Now hides panels + restore affordance. |
| Capture Maximise | **FIXED** (removed) | Redundant after full-width Capture layout; maximise only added shadow. Button removed. State fields retained harmlessly for persisted sessions. |
| History missing on New Build | **FIXED** | `createProject` now pushes `project_created` into `state.history` (local + supabase client cache). DB insert already existed. |
| New Build AI error | **FIXED** (surfacing) | Build intentionally calls `POST /api/new-project` (AI when configured, local assemble fallback). Failures previously silent. Now surfaces API/`note` errors while still offering local draft for review. Cancel supported. |
| Stop/cancel Build & Capture AI | **FIXED** | AbortController on Capture analyse, New Build, Coach (cancel clears partial UI; aborted results do not apply). Tell Me ask cancel not added (short request); transcription cancel left as recording Stop only. |
| AI vs non-AI clarity | **PARTIALLY ADDRESSED** | Lightweight `Uses AI` hints on Analyse, Ask Lume, Build, Advise run. Deterministic actions (Knowledge search, View what Lume remembers, Add bullet, suggestions accept) unchanged / no AI badge. |
| Token/cost estimate before AI | **DEFERRED DELIBERATELY** | See section D/E. Tell Me captures provider usage in-dev cockpit; no pricing table; output tokens unknown pre-request. Showing € would be false precision. |
| Knowledge collapsible sections | **FIXED** | Per-section collapse; sessionStorage per project. |
| People + Context scanability | **FIXED** | Table-like Person / Role·context rows via heuristic parse of existing bullets (no invented fields). |
| Avoid walls of text | **PARTIALLY ADDRESSED** | Collapse + people table + existing frames. No AI summarisation. |
| + Add richer modal redesign | **DEFERRED DELIBERATELY** | Focus bug fixed. Full modal/form framework specified as V1.1 (see E). |
| Capture + Lume learns less busy / Learn beside Capture | **PARTIALLY ADDRESSED** | Strip already had Learn inside Capture control (PR #24). Best Practice moved **beside** compose area. No full shell redesign. |
| Best Practice to the right of Capture | **FIXED** | `capture-compose-row` grid; stacks on narrow screens. |
| Advise same interaction style as Capture/Tell Me | **DEFERRED DELIBERATELY** | Strip label renamed **Advise**; still opens existing Coach drawer/results (streaming/session intact). Unifying into inline panel like Tell Me needs larger refactor — documented below. |
| Phase 2 intelligence work | **NOT STARTED** (correct) | No agents/RAG/prompt overhaul. |

---

## C. Current V1 user journey

| Step | Status | Notes |
|------|--------|-------|
| Visitor | 🟡 | No dedicated marketing landing/Terms/Privacy yet (pre-existing gap). |
| Signup | 🟢 | Supabase auth routes + proxy. |
| Onboarding / first project | 🟢 | Talk It Through / Start Blank; review before create. |
| New Project → Capture | 🟢 | |
| Lume learns | 🟢 | Passive Knowledge via Capture apply; Learn link non-AI. |
| Tell Me | 🟢 | Read-only Q&A; now entitlement-gated server-side. |
| Advise | 🟢/🟡 | Works; still drawer-based (not identical to Tell Me inline). |
| Return later | 🟢 | Hydrate race fixed on main (#25). |
| Trial | 🟢 | `ensure_workspace_trial` + client gate + **server AI gate**. |
| Payment | 🟡 | Code + webhook path exist; **Stripe dashboard config is founder ops**. |
| Continued access / past_due | 🟢 | Grace allow + banner; expired hard-blocked client+server. |

---

## D. Current AI architecture (updated)

### Capture AI
- `POST /api/capture` → OpenAI (production requires key) with structured context manifest + reliability gate.
- Client: Analyse → review suggestions → user applies (no silent write of AI suggestions).
- Auth + rate limit + **entitlement** via `requireAiCaller("capture")`.
- Cancel: AbortController; aborted run does not apply analysis.

### Build AI (New Project)
- Talk path → optional `POST /api/transcribe` then `POST /api/new-project`.
- Server: AI assemble when OpenAI configured; else / on failure: local `assembleFromNarrative` draft + note.
- Client now shows errors/notes; Cancel aborts in-flight build.
- Entitlement enforced on both new-project and transcribe.

### Knowledge / memory
- Structured sections (now, decisions, risks, people, openLoops) in MissionState + Supabase `knowledge_items`.
- Capture/Build persist bullets; Tell Me searches deterministically then may call AI for answer phrasing with grounding.
- Knowledge search UI is **non-AI**.

### Tell Me
- `POST /api/tell-me` (+ optional snapshot refresh `POST /api/tell-me/refresh`).
- Deterministic retrieval + grounded answer; confidence/sources; unsupported answers must not cite unrelated evidence (prior fix on main).
- Entitlement enforced.

### Advise (Coach)
- `POST /api/coach` SSE stream; context from client MissionState slice.
- Prompt personalized via display name; sections Leadership/Risks/Strategic/Disruptive/Recommended Actions.
- Entitlement enforced; Cancel aborts stream and clears partial markdown.

### Context / grounding / validation
- Capture: context manifest + reliability states (`normal` / `review_recommended` / `limited`).
- Tell Me: evidence filtering; related_context vs not_found.
- No RAG/vector DB.

### Entitlement enforcement
- Pure: `evaluateEntitlement` (`past_due` grace, cancel-until-period-end, clock-expired trial).
- Server AI: `src/lib/ai-gate.ts`.
- Client soft UI: `EntitlementGate` + past_due banner.
- Analysis monthly meter remains **informational only** (not billing).

### AI / non-AI distinction
- AI-consuming: Capture Analyse, transcription, Build My Project (when AI configured), Tell Me ask, Tell Me refresh, Advise run.
- Deterministic/local: Knowledge search, View what Lume remembers, accept/dismiss suggestions, Add knowledge bullet, most edits.
- Convention: small `Uses AI` hint near AI CTAs — not badges everywhere.

### Token / cost measurement
- Tell Me (and snapshot refresh) can record OpenAI `usage` in **dev cockpit** paths.
- Capture/Coach/Build do **not** consistently persist usage to user-facing billing.
- `js-tiktoken` is available; char/4 heuristics exist in cockpit only.
- **No defensible €/$ pre-action estimate today** without: price table per model, measured averages per action, and clear output assumptions.

**Smallest V1.1 cost UX:** show “Uses AI · typically ~X–Y tokens” as ranges from logged averages after 2 weeks of production usage — not currency until Stripe metered or fixed price table is owned.

---

## E. Remaining launch blockers

### P0 — before customers
1. **Founder:** Confirm production Supabase has applied billing + intelligence snapshot migrations.
2. **Founder:** Stripe products/prices/webhook + Vercel env (`STRIPE_*`, `OPENAI_API_KEY`, Supabase URL/keys, site URL/auth redirects).
3. **Founder:** Production smoke: signup → trial → Capture → Tell Me → Advise → create project → refresh → expired entitlement blocked on API.
4. Landing / Terms / Privacy still missing if selling publicly (legal/marketing — not coded this phase).

### P1 — ideally before customers
1. past_due banner + Account portal path verified with a real Stripe past_due test clock.
2. Advise inline (Tell Me-style) interaction — better coherence.
3. Tell Me cancel for slow answers.
4. Richer + Add modal (person/role/context fields) reused across Knowledge/setup.
5. Rate limits: in-memory only — fine for early V1; Redis later.

### V1.1 — consciously deferred
- Token/€ estimates before AI actions
- Multi-agent / RAG / vector search
- OAuth / team invites
- Package rename (`mission-control` → `lume`)
- Broad Meeting Prep / stakeholder redesign
- Sophisticated dunning

---

## F. Manual actions required from the founder

1. **Merge this PR** to `main` (or local merge + push) so Vercel production picks up entitlement + bugfixes.
2. **Supabase production SQL** (if not already):
   - `supabase/migrations/20260813140000_billing_foundation.sql`
   - `supabase/migrations/20260815160000_project_intelligence_snapshots.sql`
   - plus any earlier Phase 1/2 migrations if a fresh project
3. **Vercel env** (Production): Supabase URL + anon + service role as required by server routes; `OPENAI_API_KEY`; Stripe keys + webhook secret; `NEXT_PUBLIC_SITE_URL` / auth redirect URLs matching Vercel domain.
4. **Stripe**: webhook → `/api/billing/webhook`; price IDs referenced by checkout; test a checkout + past_due.
5. **Smoke on production URL** after deploy:
   - Create project (History shows Created…)
   - Hard refresh (project remains)
   - Ask Lume looks like a button
   - Analyse / Build show Cancel while running
   - Expired trial: UI blocks + `curl` AI API returns 403

---

## G. Tests

| Script | Result |
|--------|--------|
| `tsc --noEmit` | Pass |
| `npm run build` | Pass |
| `verify:production-config` | Pass (19 checks incl. new entitlement/Tom/past_due) |
| `verify:hydrate-session` | Pass |
| `verify:phase2-auth` | Pass |
| `verify:new-project` | Pass |
| `verify:tell-me` | Pass |
| `verify` (coach) | Pass |
| `verify:capture-context` | Pass |
| `verify:capture-reliability` | Pass |
| `verify:findings` | Pass |
| `verify:ai-domain` | Pass |
| `verify:golden-test` | Pass |
| `verify:rls-policies` | Pass |
| `verify:capture-review` | Pass |
| `verify:capture-prompt` | Pass |
| `verify:seed-reset` | Pass |
| `verify:capture-workspace` | Pass |
| `verify:tenant-isolation` | **SKIPPED** — no Supabase credentials in agent env |
| `verify:phase2-persistence` | Not re-run live (needs creds) |
| `npm run lint` | **Fails repo-wide** on pre-existing react-hooks/any issues; not introduced as a gate this phase. Changed files mostly clean aside from pre-existing CaptureWorkspace effect warnings. |

**Coverage gaps:** No Playwright E2E for entitlement 403 or cancel AbortController; rely on structural + unit verifies + manual smoke.

---

## H. Phase 1 recommendation

**PHASE 1 NOT COMPLETE**

Smallest remaining close-out (mostly ops, not more engineering):

1. Merge/deploy this branch to production.
2. Founder verifies migrations + Stripe + production smoke (section F).
3. Optional but recommended before charging: Terms/Privacy/landing stub.

Once F is done and smoke is green, Phase 1 can be declared complete and Phase 2 intelligence evaluation may begin.

*(If treating “code freeze ready” separately from “commercially live”: the **code** for Phase 1 freeze is ready to merge; commercial go-live still needs F.)*

---

## I. Repository state

- **Working branch:** `cursor/phase1-freeze-stabilise-c9f3`
- **Commits:** see git log on branch after push
- **Pushed:** yes (this agent pushes with the PR)
- **main:** does **not** yet include this Phase 1 work until PR merge
- **PR:** opened/updated against `main`
- **Merge steps (PowerShell):**

```powershell
cd C:\Users\spudh\betterprojectmanager
git fetch origin
git checkout main
git pull origin main
git merge origin/cursor/phase1-freeze-stabilise-c9f3
git push origin main
```

Or merge the GitHub PR (Ready for review → Merge).

---

## Advise inline (deferred scope note)

To make Advise match Tell Me’s top-level inline panel without breaking streaming:

- Extract Coach results from drawer/results-card into a panel sibling of `TellMePanel` under `CaptureCoachRow`.
- Preserve `CoachSessionContext` AbortController + session history persistence.
- Responsive: single intelligence stage mode (`capture` | `tell-me` | `advise`).
- Estimate: moderate UI refactor across `CaptureCoachRow`, `CoachDrawer`, `CoachResultsCard`, CSS ownership accents — **not** safe as a drive-by inside freeze.

---

## + Add reusable component (V1.1 spec)

Recommended: `EntityAddDialog` with variants `todo | stakeholder | date | knowledge | risk`, fields title/name, optional role/date/kind, optional details textarea, remember toggle for knowledge. Shared by ProjectSetupReview + ProjectKnowledgeBrief. Out of Phase 1 to avoid form-framework churn.
