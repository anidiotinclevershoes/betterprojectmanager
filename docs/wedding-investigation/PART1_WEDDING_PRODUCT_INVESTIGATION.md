# Wedding Product Investigation — Part 1

**Market wedge, product definition, wedding workflow and UX**

| | |
| --- | --- |
| **Status** | Investigation only. No production code changed. |
| **Date** | 27 August 2026 |
| **Repository** | `mission-control` (product name: **Lume**) |
| **Branch investigated** | `main` |
| **HEAD SHA** | `e5cd9ba8e183f7a42f8f5c74aef73c3c7d73d54f` |
| **HEAD commit** | `Merge pull request #84 from anidiotinclevershoes/cursor/v1-review-needs-you-ux-08a0` |
| **Working branch for this report** | `cursor/wedding-product-investigation-part1-ad60` |
| **Part 2 consumes** | this file |

---

## How to read this report

Section 0 is the evidence base: what the Lume codebase actually contains, verified against implementation and tests rather than documentation. Sections A–Z are the required Part 1 outputs.

Two conventions are used throughout:

- **Evidenced** means a named source or a specific file path supports the claim.
- **Asserted** means it is my judgement and should be treated as a hypothesis to be tested, not a finding.

A deliberate scepticism note appears in Section E about the quality of publicly available wedding-industry "evidence" in 2026. It materially affects how much confidence anyone should place in the market section, and it is the single most important methodological caveat in this document.

---

# 0. Repository baseline — what Lume actually is today

This section was produced by reading implementation code, SQL migrations and the test suite. Where the repository's own documentation disagrees with the code, the code is reported and the divergence is flagged.

## 0.1 Architecture

Lume is a single Next.js application deployed to Vercel. There is no separate backend service.

- **Next.js 16.2.11**, App Router, **React 19.2.4**, TypeScript, Tailwind CSS 4.
- Almost all product UI is client-side. The root layout (`src/app/layout.tsx`) is a server shell that mounts `MissionProvider` and `AppShell`; from there the application behaves as a client SPA over a React context store (`src/lib/store.tsx`).
- **No Server Actions anywhere** (zero `"use server"` occurrences). All durable work happens in route handlers under `src/app/api/**/route.ts`.
- Request gating is done by `src/proxy.ts`, not a conventional `middleware.ts`.
- Deployment config is `vercel.json` (`framework: nextjs`, region `iad1`).

**Implication for a wedding product:** the runtime shape is conventional and portable. Nothing about the hosting or framework choice is wedding-hostile, and nothing about it is a moat.

## 0.2 Data model

Twenty-three tables across eight migrations in `supabase/migrations/`. The tenant tables that matter:

| Table | Purpose | Notes |
| --- | --- | --- |
| `profiles` | user profile keyed to `auth.users` | |
| `workspaces` | tenant | one personal workspace bootstrapped per user |
| `workspace_members` | membership | roles `owner` / `member` |
| `projects` | the container entity | `name`, `code`, `summary`, `status` (`healthy`/`watch`/`at_risk`), `kind` (`delivery`/`release_ops`), `current_focus`, `next_milestone`, `next_milestone_on`, plus release-ops date fields |
| `stakeholders` | people, scoped to a project | `name`, `role`, `preferences` jsonb, `concerns` jsonb, `last_contact_at` |
| `todos` | actions | `title`, `detail`, `done`, `due_on`, `kind` ∈ `ACTION`/`WAITING`/`CHASE`/`REMINDER`, `waiting_on`; `project_id` is nullable |
| `risks` | risks/issues | `status` ∈ `open`/`watch`/`resolved`/`accepted`, `source` ∈ `manual`/`capture`/`seed` |
| `knowledge_items` | the flexible truth store | `section` ∈ `now`/`decisions`/`risks`/`people`/`openLoops`, `body`, `position`, plus later additive columns `kind`, `epistemic`, `lifecycle`, `supersedes_id`, `meta` jsonb, `provenance` jsonb |
| `milestones` | dates | `label`, `type` ∈ `phase`/`milestone`/`meeting`/`deadline`/`submission`, `start_on`, `end_on`, `notes` |
| `memories` | free-form recall records | `type`, `title`, `content`, `tags`, `people`, `occurred_at`, `source` |
| `recommendations` | coach/capture suggestions | `status` ∈ `active`/`done`/`dismissed` |
| `meetings` | meeting records | nested `prep`, `during_prompts`, `debrief` jsonb |
| `releases` | release playbook | PM-specific; irrelevant to weddings |
| `capture_sessions` | capture transcripts and results | `source` ∈ `typed`/`recorded`/`uploaded`/`pasted` |
| `history_events` | chronology | `type`, `title`, `detail`, `source` ∈ `user`/`ai`/`system` |
| `coach_sessions` | coaching output | legacy-adjacent |
| `workspace_preferences`, `workspace_usage` | prefs and AI-usage counters | usage counter exists but the product still meters client-side (open debt D-024) |
| `billing_customers`, `subscriptions`, `billing_events` | Stripe billing foundation | |
| `project_intelligence_snapshots` | one compressed intelligence row per project | |
| `eval_runs` | internal eval store | service-role only |

The most important structural observation: `knowledge_items` with `kind` / `epistemic` / `lifecycle` / `supersedes_id` / `meta` / `provenance` is a **general-purpose, supersession-aware, provenance-carrying truth store**. It is not PM-shaped. That is the single most transferable asset in the schema.

**Validation is hand-rolled.** There is no Zod anywhere in `src/` or in `package.json`; `src/lib/data/validate.ts` does UUID/string/date checks by hand. Structured LLM output is requested via OpenAI JSON mode plus a prose schema hint — **not** JSON Schema and **not** tool calling. `src/types/database.ts` is hand-maintained and lags the migrations (open debt D-012).

## 0.3 Auth

Three modes resolved by `src/lib/auth-mode.ts`: `none`, `demo`, `supabase`. Production is always `supabase` unless explicitly overridden.

Supabase path: `signUp` / `signInWithPassword` / `resetPasswordForEmail` / `updateUser`, with session cookies refreshed in `src/proxy.ts` via `getUser()` (not a bare `getSession()`). On login, `ensurePersonalWorkspace` and `ensureWorkspaceTrial` run. A legacy HMAC cookie demo gate (`DEMO_USERS` + `AUTH_SECRET`) still exists for local previews.

Not implemented: OAuth providers, MFA, workspace invitations, any team-management UI.

## 0.4 Workspace / project model

Multi-tenancy is **workspace-scoped**, enforced at two layers: Postgres RLS via an `is_workspace_member` helper on every tenant table (with `FORCE RLS`), and application-layer scoping helpers (`loadProjectScopedWorkspace`, `filterMissionStateToProject`).

A trigger `handle_new_user` creates the profile, a "Personal Lume Workspace", the owner membership and a usage row. The schema supports multiple members and multiple workspaces; **the UI does not** — it always bootstraps and uses one personal workspace. For a solo-planner product that is a feature, not a gap.

## 0.5 Persistence

Production writes go to Supabase through explicit `persist*` helpers in `persist-mutations.ts` (`persistNewProject`, `persistTodo*`, `persistKnowledge*`, `persistRiskStatus`, `persistTimeline*`, `persistCaptureSession`). Local/demo mode uses `localStorage` (`mission-control-state-v5`). A repository abstraction exists (`getDataRepositories`) but the local implementations mostly throw; the live UI goes through the store.

Known persistence debt that matters commercially: some mutations are still optimistic with soft failure (D-005), suggestion accept/dismiss is memory-only and resurrects on reload (D-003), and many history events never persist (D-004).

## 0.6 Capture

Capture is the write/propose boundary and the most developed part of the system.

**Two pipelines exist simultaneously** (open debt D-032):

| | Legacy (default) | Capture V2 (flagged) |
| --- | --- | --- |
| Flag | active when `LUME_CAPTURE_V2` unset | `LUME_CAPTURE_V2=1` |
| Truth source at analyse time | client-posted `MissionState` | server-loaded durable world (`loadServerCaptureWorld`) |
| Extraction shape | "findings" | atomic "observations" |
| Apply | client-side `planCaptureApply` | server `POST /api/capture/apply` (404 when flag off) |

Input modalities: typed text (live), voice via `MediaRecorder` → `POST /api/transcribe` → `whisper-1` (live), paste (into the same textarea; no dedicated pipeline). **File upload is stubbed** — the session API has `addFileName` but no UI calls it. `/capture` is a redirect to `/`; the real surface is `CaptureWorkspace` mounted inside the project page.

**Nothing is written to project truth on analyse.** Analyse produces a session, a `capture_analysed` history event and a usage bump. Everything else requires an explicit approve/apply.

## 0.7 AI extraction

The V2 extraction prompt (`src/lib/capture-v2/prompt.ts`) is short and unusually disciplined:

```20:34:/workspace/src/lib/capture-v2/prompt.ts
export function buildObservationExtractionPrompt(args: {
  transcript: string;
  projectBlock: string;
}): string {
  return `You extract atomic project observations. You do not mutate a database.

Rules:
- Split the transcript into the smallest project-relevant facts (multiple observations per sentence are expected).
- Every observation needs a verbatim evidence quote from the transcript.
- candidateTargetId MUST be copied from the supplied current records. Never invent IDs.
- If a person/risk/date/todo already exists, prefer update_existing or no_change over create_new.
- If share vs replace (or two plausible targets) cannot be decided from the transcript, disposition=ambiguous.
- Project-irrelevant chatter is domain=commentary and disposition=commentary.
- Duplicate restatements: keep one observation and mark others disposition=merge.
- Do not output operations, SQL, or Apply Ready. Confidence is informational only.
```

The observation domains are `person | responsibility | risk | milestone | todo | availability | knowledge | decision | commentary | unknown` and the dispositions are `update_existing | create_new | no_change | ambiguous | merge | commentary | ignore`.

The critical design decision: **the model never emits an operation.** It emits observations with evidence quotes and a disposition. Deterministic code then decides whether that becomes a legal write, a `needs_you`, or a `no_change`.

Models: `gpt-4o-mini-2024-07-18` by default for extraction, `whisper-1` for transcription.

## 0.8 Identity and resolution

There is **no fuzzy matching and no alias table.** This is a deliberate choice, and it is the most wedding-relevant single decision in the codebase.

```35:42:/workspace/src/lib/people/identity.ts
export function normalisePersonName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
export function namesMatchExact(a: string, b: string): boolean {
  return normalisePersonName(a) === normalisePersonName(b);
}
```

A model-supplied person UUID is treated as evidence of model *intent*, not proof of identity. Binding a person requires the recorded full name to actually appear in the capture text (`personLinkedIdentityGate` in `src/lib/capture-v2/resolve.ts`). A single-token name where multiple people exist becomes `needs_you`. Unknown or foreign IDs are rejected as `foreign_id` / `cross_project_id` and the target is stripped rather than silently re-matched.

## 0.9 Review and approval

Review-before-write is enforced, not merely documented. The review panel orders items unmatched → needs review → ready and counts them. The boundary copy is explicit:

```918:921:/workspace/src/components/capture/CaptureWorkspace.tsx
            Review every finding below. Nothing enters maintained project truth
            until you approve it (Approve / Apply Ready / Remember).
```

A documentation-versus-code divergence worth recording: the product constitution describes a triad of **Known / ✦ Lume noticed / Needs you**. Capture Review actually uses **Ready / Needs Review / Unmatched**, with V2 adding an accounting line. "✦ Lume noticed" appears on Tell Me and the Ask bar, not as Capture chrome.

## 0.10 Ambiguity

Ambiguity is a first-class outcome rather than a low confidence score. The apply decision type is a three-way union in which "I cannot safely do this" is as legitimate as "write":

```147:163:/workspace/src/lib/capture/apply/types.ts
export type CaptureApplyDecision =
  | {
      kind: "write";
      domain: Exclude<CaptureLegalDomain, "unsupported">;
      operation: CaptureLegalOperation;
    }
  | {
      kind: "needs_you";
      domain: CaptureLegalDomain;
      reason: string;
      confirmOwner?: CaptureConfirmOwnerRequest;
    }
  | {
      kind: "no_change";
      domain: CaptureLegalDomain;
      reason: string;
    };
```

Ownership ambiguity has dedicated semantics — `share | replace | continue | ambiguous` — with a `ConfirmOwnerDialog` when the transcript cannot decide. Notably, **V2 treats model confidence as informational only** and does not gate Apply Ready on it; legacy still gates below 70.

## 0.11 People

People are `stakeholders` rows scoped to a project. There is no `/people` route; a person is reached through the Knowledge Centre People frame and a detail drawer. Responsibilities are *not* a column on the person — they are `knowledge_items` with `kind = responsibility` and `meta.responsibility.{personId, personName, scope, ownerConfirmed}`, with multiple concurrent `lifecycle = current` rows permitted.

That last detail matters enormously for weddings: **one person can hold several scoped responsibilities simultaneously, and a handover supersedes only the specific scope.** "Laura's mum now does ceremony flowers, the florist keeps reception flowers" is natively expressible.

## 0.12 Dates

`milestones` rows plus `TimelineItem` in the domain model, plus a `date` kind in the canonical metadata layer (`meta.date.{label, dateIso, dateType}`). Capture emits a `timelinePatch` that appends or updates rather than rebuilding. There is a Gantt component. Milestone completion has no durable status (deferred debt D-029).

## 0.13 To Dos

`todos` table, `/todos` Master To Do page, and a project To Do frame. `TodoKind` is `ACTION | WAITING | CHASE | REMINDER`; `WAITING` and `CHASE` items are filtered out of the main list into Dependencies/Waiting frames. To Dos can be project-scoped or personal.

## 0.14 Risks

First-class `risks` table with an explicit lifecycle authority module (`src/lib/risks/lifecycle.ts`) and statuses `open | watch | resolved | accepted`. The domain table is authoritative; the Knowledge risks section is a projection, and a resolved risk must not reappear as an open knowledge item.

## 0.15 Reminders

**Reminders do not exist as a subsystem.** `REMINDER` is one of four `TodoKind` values. There is no scheduler, no cron, no notification table, no push and no email. Anything in the wedding product that depends on "it will tell you before the deadline" is net-new build.

## 0.16 Decisions

Decisions are **not** a first-class table. They exist in four weaker forms: a `decisions` section of `knowledge_items`; an optional `kind: "decision"` on canonical metadata; a `decisionsToObtain[]` field in meeting prep; and a `recommendations.kind` value. There is a Decisions frame in the Knowledge Centre but no decisions CRUD API.

## 0.17 Responsibility

Covered in 0.11. The mechanism is `confirmResponsibilityOwner`, a `ConfirmOwnerDialog`, concurrent scoped current rows, and supersession via `replacePersonId` with `provenance: user_confirmation`. There is a deterministic fast path in `tell-me/answer.ts` for "who owns X" questions.

## 0.18 History and change intelligence

`history_events` plus a `/history` page. Event types include `capture_analysed`, `task_*`, `risk_added`, `knowledge_updated`, `coach_accepted`. Provenance on knowledge items drives an `EvidenceReveal` component.

Honest limitation: **this is a chronological event log, not a lineage graph.** History events are not reliably linked back to the source transcript ID, and many history events never persist (D-004). The philosophy document's ambition — "what used to be true / what changed / when / why / where did Lume learn this / what did the source actually say" — is only partly realised.

## 0.19 Tell Me

Live. `POST /api/tell-me` and `POST /api/tell-me/refresh`, engine in `src/lib/tell-me/*`, UI in `TellMePanel` and the Ocean Ask bar. Read-only recall over project truth. The server loads durable truth and **ignores client-posted state**. Ownership questions can short-circuit deterministically without a model call.

Documentation divergence: several handovers state that canonical truth assembly is off by default. The live route explicitly passes `useCanonicalTruth: true`.

## 0.20 Catch Me Up

**Does not exist.** Not under that name, not under an alias. The nearest substitutes are Tell Me asked a "what changed" style question (a prompt heuristic, not a product mode), the `/history` page, and the capture session list.

This is significant: the wedding hypothesis in the brief treats "Catch me up on Laura & James" as a headline capability. In Lume it is unbuilt.

## 0.21 Meeting Prep

Exists at `/meetings` and `/meetings/[id]`, plus a Knowledge Centre frame and a brief modal. The `MeetingPrep` shape is rich (objectives, opening script, talking points, questions to ask, decisions to obtain, risks to discuss, people to engage, leadership opportunities, stakeholder concerns, ownership moments). Readiness is **deterministically scored from stored fields**, not generated by an LLM on page load. It is not in the Ocean sidebar and the constitution marks it "retain if stable, disable before launch if not."

## 0.22 Knowledge Centre

The heart of the product. It lives at `/projects/[id]` in `knowledge` mode (`OceanProjectWorkspace`), **not** at `/memory` — `/memory` is a legacy keyword search over `memories`. Frames come from `ocean-frames.ts`; item detail from `KnowledgeItemDetailDrawer`. Sections are `now | decisions | risks | people | openLoops` plus domain rows. Structured kinds are fact, responsibility, decision, risk, date, dependency, availability, open_loop, ambiguity.

## 0.23 Advise

**Stub.** The Advise tab renders "Advise is coming soon" and is disabled. The constitution explicitly parks it. A separate legacy Coach drawer (`/api/coach`, `src/lib/pm-coach.ts`) is still live and streams PM coaching from client-posted state — which is itself open debt (D-033).

## 0.24 Testing

This is where Lume is genuinely unusual, and it deserves precision.

- **No Vitest, no Jest, no `node:test`.** The suite is ~52 hand-written `tsx` scripts under `scripts/verify-*.ts` using `node:assert/strict`, aggregated by `scripts/run-regression-suite.ts` (45 of them run in CI). Roughly **478 named assertions**.
- **Playwright** for e2e: 3 specs, 15 tests, run credential-free with `LUME_CAPTURE_V2=1` and frozen model outputs.
- **CI** (`.github/workflows/regression.yml`) runs typecheck + the deterministic suite + Playwright on every PR, with API keys cleared. Live evals are `workflow_dispatch` only.
- **Two eval systems.** A 45-case Ask/Tell Me intelligence benchmark (`src/lib/evals`, `eval_runs` table); and a Capture V2 safety eval (`src/lib/eval-capture-v2`) over a 22-case frozen corpus that classifies every outcome as MODEL FAILURE, LUME CATCH or LUME FAILURE — where a LUME FAILURE means an incorrect operation would still have become an approvable write.

The checked-in scorer-v3 replay results:

| Model | Lume failures | Model failures | Lume catches | Apply-ready |
| --- | ---: | ---: | ---: | ---: |
| gpt-4o-mini | 0 | 10 | 21 | 15 |
| gpt-4.1-mini | 2 | 23 | 8 | 15 |
| claude-sonnet-4-5 | 0 | 15 | 27 | 34 |

The interesting number is not the model score. It is that **the harness measures the containment layer separately from the model** — how often a wrong model output was caught rather than written. Very few products of this size have that instrument.

**Where the philosophy outruns the enforcement**, stated bluntly because it matters for any claim of advantage:
- Review-before-write is strongly enforced in Capture V2 and the Phase 3B apply boundary; the legacy pipeline still runs by default and still trusts client-posted state.
- Live multi-tenant RLS is verified only by asserting on migration text in CI; the live tenant-isolation test skips without credentials and is not in the PR gate (D-014).
- "✦ Lume noticed" is largely an Ask output shape and UI label, not a durable knowledge class with a tested "can never become truth without user action" persistence invariant.
- Twenty-six open discoveries (D-003 … D-035) are tracked honestly in `docs/LUME_V1_KNOWN_DISCOVERIES.md`.

## 0.25 Supabase

`supabase/config.toml` declares `project_id = "workspace"`, Postgres 17, local API on 54321, email confirmations off locally, and a seed path `./seed.sql` — **which does not exist**, so a local `db reset` would fail at the seed step. Three client patterns: browser anon, server anon-with-cookies, and a service-role client used only by the billing webhook, evals and test setup.

## 0.26 Billing and account foundations

Real but minimal, which is the right amount for this stage.

Present: `billing_customers` / `subscriptions` / `billing_events`; a 14-day trial RPC (`ensure_workspace_trial`); `evaluateEntitlement` → `canUseLume` for `trialing | active | past_due`; Stripe Checkout, Customer Portal, signature-verified idempotent webhooks; an account page with subscribe/manage; and AI routes returning `403 entitlement_required` when unentitled.

Absent: any plan/tier catalogue (a single `STRIPE_PRICE_ID`), seat limits, usage-based entitlements, and a server-side action meter (the "actions left" figure is still a client counter — D-024).

## 0.27 What this means before we go near the market

Separating the genuinely transferable from the merely present:

**Transferable and hard to rebuild (the real head start):**
1. The fail-closed apply boundary — a closed set of typed legal operations, no generic fallback write, and `needs_you` as a first-class outcome equal in standing to `write`.
2. Identity discipline — exact-name binding, model IDs treated as intent rather than proof, foreign/cross-container IDs rejected rather than re-matched.
3. Evidence-quote requirement on every extracted observation.
4. Stale-target fingerprinting so a slow approval cannot overwrite newer truth.
5. Supersession and provenance on the knowledge store (`lifecycle`, `supersedes_id`, `provenance`), plus scoped responsibility with concurrent current rows.
6. A safety eval harness that measures the containment layer, not just the model.
7. Ordinary but real SaaS plumbing: auth, RLS multi-tenancy, Stripe, trials, transcription, deployment.

**Transferable with rename only:** todos, risks, milestones/dates, stakeholders, knowledge items, capture sessions, history events.

**Not transferable:** releases and the release playbook, PM project status vocabulary (`healthy`/`watch`/`at_risk`), the Coach, `/memory`.

**Claimed but not built** — and this list should discipline every subsequent section: Catch Me Up, reminders/notifications of any kind, decisions as a first-class entity, file/photo upload, offline capture, email ingestion, any mobile-specific interface, and Advise.

---

# A. Executive assessment

**PROMISING — VALIDATE FIRST**

Placed there deliberately rather than higher, and the reasoning is worth stating precisely because it is the one judgement everything else hangs from.

The proposed wedge — "tell it what happened instead of updating the system" — was a genuinely open opportunity in 2024. **It is no longer open by default.** HoneyBook shipped an AI Notetaker that records in-person meetings from the mobile app, transcribes them, extracts action items, and files notes directly into the client's project, at no extra cost inside an existing subscription ([HoneyBook help centre](https://help.honeybook.com/en/articles/11888545-use-the-ai-automations-builder); [feature review, 2026](https://cldebloat.com/blog/honeybook-ai-meeting-assistant-review/)). HoneyBook has also shipped an MCP connector that lets Claude read and act on client pipelines, notes, invoices and contracts ([announcement coverage, August 2026](https://ohsem.me/2026/08/honeybook-mcp-debuts-as-a-claude-connector-for-client-pipelines-invoices-and-contracts/)). The capture half of the hypothesised wedge is a shipped incumbent feature.

What remains genuinely unbuilt anywhere I can find is the *second* half: **maintaining a single current picture across many conversations over twelve months, including reconciliation, supersession and contradiction.** HoneyBook's notetaker produces per-meeting artefacts — a summary and a list of action items attached to a project. It does not reconcile "the vintage bus is cancelled" against a bus that a note from four months ago recorded as booked, it does not notice that two credible final-numbers deadlines now exist, and it does not maintain a queryable current state that survives ninety conversations. That is a real difference, and it is exactly what Lume's apply boundary, supersession model and identity discipline were built for.

But it is a *narrower* difference than the brief assumes, it is harder to demonstrate in a thirty-second ad than "AI takes your notes", and it is a difference in reliability engineering — which customers do not buy directly. They buy outcomes.

So: not a no-go, because the residual differentiation is real, the segment is reachable, and the refit cost is genuinely low relative to building from nothing. Not a strong opportunity, because the incumbent has already moved, the pain evidence is thinner and more circular than it first appears, and the acquisition maths is unproven. The correct next action is a paid willingness-to-pay experiment (Section X) with pre-committed kill criteria, not a build.

## A.1 One correction to the brief that changes the product

The primary research turned up a finding significant enough that it should sit next to the rating rather than three sections later.

The brief frames the product per-wedding: *"Catch me up on Laura & James."* The practitioner evidence says per-wedding is the part that already works. Planners run a spreadsheet per wedding and it is frequently a considered choice rather than neglect — chosen for real-time propagation to suppliers and zero learning curve for clients. What breaks is the level above:

> "to track everything across all of our clients manually, was really, really frustrating."
> — a working wedding planner, corroborated by another who caps her volume at ten to fifteen weddings a year specifically so she does not *"confuse my couples names or details"*

**Per-client organisation is broadly solved. Cross-client is not.** And the asymmetry is commercially interesting: the pains that wedding-software vendors assert most loudly in their marketing — WhatsApp fragmentation, day-of surprises, timeline churn — are precisely the ones with no practitioner evidence behind them, while the pain planners state most clearly gets almost no vendor airtime.

So the proposition should lead with the portfolio question — *across all my weddings, what needs me this week* — and treat the maintained per-wedding picture as the substrate that makes the portfolio answer trustworthy rather than as the product itself. Sections G, H, I and L are written to that framing. This is also, notably, the one area Lume's own constitution explicitly parks: portfolio intelligence is out of V1 scope, with Master To Do and "✦ Lume Thinks" as the deliberate exception. That exception turns out to be the most directly reusable surface in the product.

## A.2 What would change the rating

**Most likely to raise it:** evidence that the cross-client framing lands harder in the validation experiment than the per-wedding one, or confirmation that planners who used HoneyBook's AI Notetaker for a season found it relocated the problem rather than solving it.

**Most likely to lower it:** the segment-mix problem in the entry market (Section D.5), any incumbent announcing reconciled cross-conversation truth, or a validation result showing planners respond to "AI takes your notes" and not to reconciliation — which would mean the differentiated half is not the half they will pay for.

Both are answerable cheaply and should be answered before anything is built.

---
# B. Strongest bear case

Written to kill the idea. Nothing here is softened, and several of these points are, in my judgement, correct.

## B.1 The incumbent already shipped the visible half, free, and does it better on mobile

HoneyBook shipped an AI meeting notetaker for video calls around November 2024 and **in-person recording from the mobile app in July 2025**. It transcribes, summarises, extracts action items, converts them to tasks in one click, and files everything into the client's project. It is included on every tier at no extra cost, including the $29/month entry plan. Its mobile app is rated 4.77 from over sixteen thousand ratings. Dubsado shipped a notetaker in June 2026, free on all plans. Fathom records and transcribes unlimited meetings on a $0 plan.

So the demonstrable, explicable, ad-friendly half of the proposition — *stop typing up your notes* — has a market price of zero and is already installed on the customer's phone. Everything this product has left to sell is the invisible half, and the invisible half is hard to put in a headline.

## B.2 Planners have never paid for internal organisation

This is the most damaging finding in the entire investigation and it comes from the market's own revealed behaviour, not from opinion.

There are 46 wedding-planner-business templates in the Notion marketplace at $10–$18.50, and equivalents at $5–$11.51 on Gumroad, covering client CRM, vendor trackers, budgets, payment schedules, contract trackers and checklists. Those templates persist alongside a market where Aisle Planner charges $840/year and HoneyBook $588–$1,308/year. What the templates cannot do is the client-facing layer — branded portals, e-signature, payment processing, automated reminders.

**Planners pay for client-facing professionalism and for moving money. They solve internal organisation for twelve dollars.** This product sells internal organisation exclusively. It has deliberately excluded contracts, invoices, portals and payments — which is to say it has deliberately excluded everything the market has demonstrated it will pay for.

## B.3 The market is crowded, and it is consolidating right now

Fifteen-plus products compete for a solo planner's subscription. More importantly, the space is consolidating under exactly the thesis being proposed here: That's The One — planner-native, deep planning features, £45/month, seven languages, already filing Zoom transcripts and converting run-of-show files into timelines — **was acquired on 6 August 2026 by Helium Ventures**, which had already bought Maroo (payments) earlier in the year. An AI-native holding company is assembling planning plus payments right now, with a product that is closer to this proposition than anything else on the market and that already has customers in thirty-plus countries.

Behind that: Ayyla ($75–$199/month, AI-native planner OS), Nuptial ($39–$149), Breezit AI ($99–$399), Zennvue, Wedflo (UK, waitlist). Some are vapour. It only takes one to be real.

## B.4 The addressable market is small and the outcome is capped

At €39/month, two hundred paying planners is €94,000 of annual recurring revenue. The professional wedding planner population is small, unregulated, uncounted, and heavily weighted towards part-timers and hobbyists who will not pay. To reach even a modest venture-scale outcome would require thousands of paying solo planners, which almost certainly means expanding beyond weddings — and expanding beyond weddings destroys the focus that makes the product good.

The honest framing is that this is a lifestyle business unless something unexpected happens. That may be perfectly acceptable. It should be a decision, not a discovery.

## B.5 Wedding information may be too bespoke to structure reliably

Every planner has a personal method. The words they use for booking states, the way they split responsibility, what they consider a decision versus a preference, whether "confirmed" means signed or means the venue nodded — none of it is standardised, and the industry has no regulator, no certification requirement and no shared vocabulary. A structured truth model imposes an ontology on a profession that has actively avoided one.

The failure mode is specific and likely: the planner looks at the extracted picture, sees things filed in categories that do not match how they think, and concludes the software does not understand their business. The generic-tool evidence supports this reading — planners choose Notion and spreadsheets precisely *because* they impose no ontology.

## B.6 The trust model is friction that competitors will not impose

Review-before-write is the product's principal engineering achievement and it is a tax on the user. A competitor who lets the model write directly will feel faster, will demo better, and will be wrong occasionally in ways the planner may not notice for weeks. Markets do not reliably reward the careful option — they reward the one that feels effortless. "Nothing is recorded until you approve it" is a sentence that sounds like protection to an engineer and like homework to a user with fourteen items in a queue.

## B.7 Lume's reliability advantage is partly aspirational

The containment machinery is genuinely good, and it is not as finished as the philosophy document implies. Capture V2 — the pipeline with server-authoritative truth and the full apply boundary — **is behind a feature flag and is not the default**; the legacy pipeline still runs in production and still trusts client-posted state. Live multi-tenant isolation is verified in CI by asserting on migration text, not by a live database test. Twenty-six open discoveries are tracked, including optimistic writes with silent failure (D-005) and suggestion state that vanishes on reload (D-003). The "Known / ✦ Lume noticed / Needs you" epistemic model is substantially a UI label rather than a tested persistence invariant.

Any pitch built on "we solved reliability" is currently overstating the position.

## B.8 The real competitor is not a wedding CRM

HoneyBook has shipped an MCP connector, so a planner can already point Claude at their client pipeline, notes, invoices and contracts and ask questions in natural language. If general assistant AI keeps improving — persistent memory, connectors to the tools people already use, agentic write-back — then "tell it what happened and it maintains a picture" stops being a product and becomes a capability that arrives free with something the planner already pays for.

Building a specialised memory product in 2026 is a bet that general memory stays bad for longer than it takes to reach durable scale. That is not obviously a good bet.

## B.9 Value at trial is approximately zero

The product is worth nothing until roughly twenty updates have accumulated on a wedding, which is six to ten weeks of real use. A trial does not reach that. Every mitigation proposed in this report — the manufactured first-run moment, the intake paste, the forced second capture — is an attempt to fake a value curve that genuinely takes two months to climb. Those mitigations may simply not work, and if they do not, the conversion rate will be dreadful regardless of how good the product is.

## B.10 The acquisition arithmetic barely closes

Tolerable acquisition cost is around €290 at a 3:1 ratio on a twenty-four-month life. That requires roughly sixty high-intent clicks per customer at €4 a click with five per cent click-to-trial and a third trial-to-paid. Every one of those numbers is optimistic, and the dominant risk is unmodelled: most search volume on wedding-planning terms is *couples*, not professionals, so a large fraction of paid clicks will be wasted on people who will never buy. There is also no obvious organic channel — the UK Alliance of Wedding Planners, the natural UK association partner, **closed in 2023**.

## B.11 Planners will not add another product

Two subscriptions is already what most planners tolerate, and both of the ones they have are load-bearing: one moves money, one holds the client relationship. A third tool that holds neither, whose value is invisible for two months, and which requires a new daily habit, is a hard sell. "Nothing to migrate" reduces the switching cost but does not create a reason to start.

## B.12 The strategic pattern is a warning

This is the third domain the same engine has been proposed for — project managers, executive coaches, wedding planners. That flexibility is real and it is also the classic signature of a product searching for a market rather than a market pulling a product. The right response is not to reject the pivot; it is to notice that a fourth domain will look equally appealing in six months, and to require an evidence bar high enough that domain number four does not get proposed before this one has been tested.

## B.13 The bear case in one paragraph

Wedding planners buy client-facing professionalism and payment processing, not internal organisation, which they have solved with twelve-dollar templates for a decade. The one part of this proposition they would visibly value — automatic note-taking — is already free inside the CRM they use, works on mobile, and is better resourced. The remaining differentiation is a reliability property that is invisible in a demo, currently incomplete in the codebase, and hard to explain in an advertisement. The market is small enough to cap the outcome, crowded enough that a consolidator with payments and planning is already assembling, and exposed to general assistant AI making the whole category redundant. The product's value takes two months to appear and the trial lasts fourteen days.

---

# C. Assumptions challenged

| Assumption in the brief | Verdict | Reasoning |
| --- | --- | --- |
| Existing Lume creates an *unfair* head start | **Partly false** | It creates a genuine head start of engineering months in containment, identity discipline, supersession and evaluation. "Unfair" overstates it: none of that is visible to a buyer, none of it is protected, and the capture surface it would compete against is already free. |
| The customer is the independent full-service planner | **Challenged** | Full-service planners have the most context per wedding but the fewest weddings (8–20). Section D argues the better first target is the high-volume partial/full mix at 15–25 weddings, where memory load per unit of revenue peaks. |
| Wedding truth arrives through fragmented channels | **True** | Well supported, including by four competing vendors independently naming spreadsheets and email threads as the incumbent. |
| Planners manually maintain the picture across systems and memory | **True but incomplete** | They do. What is not established is that they experience it as a *problem worth paying to solve*, as opposed to the job. |
| The pain is strong and recurring | **Recurring, yes. Strong, unproven.** | Frequency is well evidenced. Intensity is not, and the revealed-preference evidence in B.2 cuts against it. |
| "Tell it what happened instead of updating the system" is the wedge | **Half occupied** | The capture half is shipped by HoneyBook and Dubsado and free from Fathom. The reconciliation half is genuinely unbuilt anywhere — no incumbent CRM does conversational write-back. |
| "Every decision. Every supplier. Every change. Remembered." | **Weak** | Commodity memory claim, no benefit verb. Section G. |
| "The wedding that remembers everything." | **Reject** | Consumer bridal register; anthropomorphises the wrong object. |
| "Tell it what changed. Your wedding plan updates itself." | **Actively dangerous** | Promises autonomy the trust model deliberately refuses. Sets up a week-one disappointment. |
| Existing wedding software does not do this | **True, and now precisely documented** | Aisle Planner has the deepest planning and *zero* AI. HoneyBook has the best AI and *no* planning workflow. Only Timeline Genius does anything like conversational updates, and only inside one timeline. |
| The market is crowded | **True, and worse than stated** | Fifteen-plus products, plus active consolidation — That's The One acquired August 2026 by a holding company that also owns a payments product. |
| Incumbents could copy it trivially | **HoneyBook yes, others no** | HoneyBook has the AI capability and the distribution but its centre of gravity is payments and it serves photographers and coaches as well as planners, which makes wedding-specific truth semantics unattractive. Aisle Planner has the intent and not the velocity — an eight-person company with no AI on its roadmap. |
| Planners will not add another product | **Largely true** | Mitigated only by refusing to require migration. Not eliminated. |
| Seasonal churn damages SaaS economics | **Overstated for the target segment** | Wedding *dates* are seasonal; wedding *planning* is not, because next summer's weddings are worked all winter. Established planners have live engagements year-round. It is a real threat only for day-of coordinators and part-timers — which is an argument about segment choice, not about the model. |
| Customers expect all-in-one | **True and must be actively refused** | Every step towards all-in-one makes the product a worse Aisle Planner. Coexistence positioning is the only viable answer. |
| Timeline Genius may be defunct | **False** | Trading, thirteen years old, shipped AI in 2026. |
| Vendor must be first-class | **Confirmed** | Stable across weddings, carries booking state, primary source of contradiction. |
| Payments are needed for the wedge | **False** | Only the deposit *deadline* matters, and that is a date. |
| Guest count is structured truth | **The number yes, the list emphatically no** | Also the decisive GDPR mitigation — keeping the guest list out avoids special-category dietary data almost entirely. |
| The wedding-day timeline is V1 | **False** | Late-engagement, highest-stakes, largest build, most entrenched incumbents. Expansion, with a read-only "what I know about the day" view as the V1 bridge. |
| Mobile matters | **True, and it is a live competitive gap** | Aisle Planner — sold on day-of coordination — has no native mobile app, and its own docs say drag-and-drop does not work on mobile. Timeline Genius, Planning Pod and Rock Paper Coin have none either. |
| AI is a moat | **False, and it must never be claimed** | |
| Reliability engineering is a moat | **False** | It is a head start and a promise. Sections P and S. |
# D. Best initial customer

## D.1 The definition that matters is not the one in the brief

The brief segments by *service type* — full-service, partial, month-of, day-of, destination, luxury. That is how the industry describes itself, and it is the wrong axis for this product.

The binding variable is **concurrent live weddings**, not weddings per year or service tier. A planner running twelve-month full-service engagements at fifteen weddings a year is carrying roughly fifteen live weddings simultaneously, all at different stages. A day-of coordinator doing forty weddings a year carries perhaps six weeks of context each and almost none of it overlaps.

Two independent pieces of evidence support this reframe. First, **Aisle Planner prices in bands of active projects** — 15 / 25 / 50 / 100 — which is a revealed-preference statement by the market's most planning-native vendor about how planners actually segment. Second, the only first-person account of volume-setting found in the research explains the cap in exactly these terms:

> "I keep it real and attend to 10-12, sometimes 15 weddings a year. That's plenty! I want to make sure that I can keep the facts straight and **don't confuse my couples names or details** and manage to follow up on all of the many to dos."
> — Strings & Champagne Events

A planner capping her own revenue because of cross-client cognitive load is the product thesis stated by a practitioner, unprompted, on her own blog.

## D.2 Scoring by segment

Scored 1–5. These are judgements informed by the evidence, not measurements, and the volume figures are the weakest-sourced item in the entire investigation — no industry body publishes per-segment throughput.

| | Concurrent load | Complexity | WTP | Current spend | Buying authority | Memory reliance | Targetable | Retention | Fit |
| --- | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: |
| **Full-service, high volume (15–25/yr)** | 5 | 5 | 4 | 4 | 5 | 5 | 3 | 4 | **5** |
| Full-service, low volume (6–12/yr) | 3 | 5 | 4 | 3 | 5 | 3 | 3 | 4 | 3 |
| **Partial planning** | 4 | 3 | 3 | 3 | 5 | 4 | 3 | 3 | **4** |
| Month-of coordination | 2 | 2 | 2 | 2 | 5 | 2 | 3 | 2 | 2 |
| Day-of coordination | 1 | 1 | 1 | 1 | 5 | 1 | 3 | 1 | 1 |
| **Destination planners** | 4 | 5 | 5 | 4 | 5 | 5 | 2 | 4 | **5** |
| Luxury planners | 3 | 5 | 5 | 5 | 4 | 4 | 2 | 4 | 3 |
| Small studios (2–4 people) | 5 | 4 | 4 | 4 | 4 | 5 | 2 | 4 | 4 |
| Venue coordinators | 4 | 2 | 1 | 1 | **1** | 3 | 4 | 3 | 2 |
| Corporate/broader event planners | 4 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3 |

## D.3 Reading the table

**Day-of and month-of coordinators are the worst possible starting customers**, and it is worth being explicit because their high annual volume makes them superficially attractive. Their context per wedding is thin, their engagement is weeks, their fee floor is low, and their subscription is the most seasonal thing in the market. They would churn every November.

**Venue coordinators fail on the one column that cannot be compensated for.** They are employees. They do not buy software; their venue does, and their venue buys Planning Pod at $199–$319 a month with a procurement conversation attached. Everything else about them is attractive and none of it matters.

**Luxury planners have the highest willingness to pay and are the wrong first customer.** Their processes are the most bespoke, their expectations of polish are highest, they frequently have assistants doing exactly the work this product automates, and their requirements will drag a young product towards bespoke complexity. They are a year-two customer.

**Destination planners score as highly as high-volume full-service and are harder to reach.** They have genuinely the strongest fit: many suppliers, unfamiliar suppliers, time zones, travel, in-person site visits, and the most fragmented communication of any segment. But they are a small, geographically scattered population with no obvious channel. Treat as a high-value secondary target reached through content rather than a primary acquisition focus.

**Small studios of two to four people score better than their size suggests**, for a reason absent from the brief: when a lead planner hands a wedding to an associate for the day, or goes on holiday, the context has to *transfer*. A maintained, evidenced picture is far more valuable when more than one person needs it. They also have four to five times the budget tolerance of a sole trader. They are a strong second target and a natural expansion path from the solo plan.

## D.4 Recommended first ICP

> **Independent wedding planners carrying twelve or more concurrent live weddings, on engagements of nine months or longer, selling full-service or substantial partial planning, working alone or with one part-time assistant, and already paying for at least one professional tool.**

Deliberately *not* "full-service planners", for three reasons. Service tier is the wrong axis (D.1). A low-volume full-service planner with six weddings has plenty of depth per wedding and not enough breadth to feel the pain the evidence actually documents. And a high-volume partial planner carrying eighteen concurrent engagements has the pain acutely, whatever they call their packages.

The "already paying for a tool" qualifier is doing real work. It filters out hobbyists, establishes that the buyer accepts software as a cost of business, and — given the strongly evidenced resentment of multi-product stacks — identifies someone already unhappy with their current arrangement.

## D.5 The geographic tension, stated honestly

I recommended UK and Ireland as the entry market in Section S on the grounds that HoneyBook's AI Notetaker is US and Canada only, so the incumbent alternative is genuinely absent. The segment evidence complicates that and the complication should not be buried.

Bridebook's 2026 report puts **average UK spend on a wedding planner at £1,543**, down from £1,892 the prior year. The Irish equivalent is **€2,054**. Those figures are averages across couples who spent anything at all, and they imply a market dominated by on-the-day coordination rather than full-service planning — which is precisely the segment scoring lowest in D.2. The full-service UK planner exists and charges several times that, but she is a smaller fraction of a smaller population than the equivalent in the US.

So the two markets trade off against each other directly: **the US has the better segment mix and the incumbent has already moved; the UK and Ireland have a genuine incumbent gap and a worse segment mix.** There is no clean answer. The validation experiment in Section X is designed to run both as parallel cells for exactly this reason, and the decision should be made on measured response rather than on this argument.

---

# E. Market evidence

Full evidence log with sources: `docs/wedding-investigation/PART1_APPENDIX_PRACTITIONER_EVIDENCE.md`.

## E.1 The methodological finding that governs everything else

**There is no large, active, public professional wedding-planner community anywhere on the open internet.** The subreddit `r/weddingindustry` has one post, from 2013. `r/weddingplanners` is empty. `r/eventplanning` is dead. `r/WeddingProfessionals` is ten days old with top posts scoring two to four points. The richest planner-on-planner operational detail found in the entire research came from planners answering a *client's* question in `r/BigBudgetBrides`.

This has two consequences and both are serious.

For **evidence**, it means every claim below rests on small samples. Nobody — including the companies currently selling to this market — has strong public evidence about how these people work. Capterra, G2 and GetApp were Cloudflare-blocked during research, so the two-and-three-star reviews that carry the real signal could not be retrieved; on Trustpilot only HoneyBook has a usable sample, with Dubsado at one review, Aisle Planner at two and Planning Pod at one.

For **acquisition**, it removes the channel a solo B2B SaaS product would normally rely on. There is no Hacker News, no active subreddit, no public forum. The candid discussion happens in **closed Facebook groups**, which is where a go-to-market has to earn its way in. Section T treats this as the central acquisition constraint.

## E.2 Strongly evidenced

**Multi-product stacks, and resentment of them.** Named, first-person and repeated: HoneyBook plus Aisle Planner plus Google Docs; Dubsado plus Drive plus Sheets; Aisle Planner plus Asana plus Sheets plus floorplan software. The clearest statement of intent found anywhere in the research is a planner asking for help building her back end *"so I'm not using multiple CRMs."*

**Google Sheets and Drive are the real system of record, including at the $15,000-plus tier.** And — this is the part that matters and cuts against the product — **it is frequently a considered choice rather than neglect.** Planners cite real-time propagation to vendors and zero client learning curve. One planner states she is fully capable of automating her own spreadsheets and chooses not to because she does not want to maintain her own software ecosystem.

Any product replacing the spreadsheet must beat those two specific properties. The product described in this report does neither: it does not propagate anything to vendors and it has no client-facing surface at all. That is a genuine gap in the value proposition, not a positioning problem.

**Channel fragmentation and context switching.** Two quotes carry it: *"email + texting + drive + a floor plan software"*, and *"the part that fries your brain isn't the tasks, it's the context switching."* Note that the evidenced channels are **email, SMS and Instagram DMs**. WhatsApp specifically, with couples, is *not* evidenced — see E.4.

**Supplier unreliability and late-arriving information**, treated by planners as structural rather than exceptional.

**Admin load and burnout as the dominant self-reported challenge**, with more than half of a 500-plus professional survey naming workflows and automation as a 2026 priority.

**A 2026 demand slowdown.** Booked-levels reported falling from 66% in 2025 to 42% in 2026, longer decision cycles and a hollowing middle market. IBISWorld records the US wedding-planner industry declining 12.2% in 2024 and a further 4.2% in 2025 to $1.5bn before a modest 2.1% recovery to $1.6bn in 2026, attributing part of the contraction to *"more couples have opted to plan their weddings themselves."* **This is a headwind and belongs in the bear case:** the target customer's own business is under pressure and their appetite for a new subscription is correspondingly lower.

## E.3 The pain planners actually articulate — and it is not the one in the brief

This is the single most important finding of the investigation.

> "I am very adept at building Google sheets, can automate everything/write my own code to have it automated, but choose not to because I do not want to maintain my own software ecosystem. Also, **to track everything across all of our clients manually, was really, really frustrating.**"
> — u/oso_events, wedding planner

Corroborated independently by the planner who caps her volume at ten to fifteen weddings so she does not *"confuse my couples names or details"*.

**Per-client organisation is broadly solved. Cross-client tracking is not.** A spreadsheet per wedding works. Eighteen spreadsheets across eighteen weddings at eighteen different stages does not, and the failure mode is the planner's own attention rather than any individual document.

The brief's core loop — *"Catch me up on Laura & James"* — is per-wedding, and per-wedding is the part that already works. The product framing needs to move up a level: the primary question is not "where does this wedding stand" but **"across all my weddings, what needs me this week."** The per-wedding picture is the substrate that makes the portfolio answer trustworthy; it is not the proposition. Sections G, I and L have been written to reflect this.

## E.4 Weakly evidenced or unevidenced

Listed plainly because several of these were load-bearing assumptions in the brief.

- **Poor mobile capture during venue visits — no practitioner evidence whatsoever.** Only vendor marketing copy. If a product thesis rests on this, it is currently an assumption.
- **Wedding-day surprises caused by something unrecorded — no evidence.** A Reddit thread constructed to elicit exactly those stories drew zero replies.
- **Repeated late timeline churn — asserted throughout vendor marketing, evidenced nowhere.** Timeline maintenance is real and cyclical but is described by planners as the job, not as pain.
- **WhatsApp fragmentation with couples — not evidenced.** Instagram DMs and SMS are.
- **Planner counts for the UK, Ireland or the EU — none exist.** The US figure is unusable: IBISWorld's own two pages state 58,141 businesses in 2026 and 21,714 in 2025, which cannot both be true.
- **Per-segment wedding volumes — no credible source.** The widely circulated "15–30 per year" and the "$1,500 day-of / $6,000 partial / $12,000 full" tiering both originate in content-marketing sites for training products and propagate verbatim across AI-generated pages.
- **Any credible churn statistic for wedding-planning businesses.**

## E.5 Moderately evidenced, and the most valuable of them

**Disputed verbal decisions.** One outstanding, specific, first-person account from a planner-educator: *"I knew we had talked about the budget. I knew we had reviewed the numbers together on a call months earlier... A lot gets decided. And couples, understandably, don't always remember the specifics of what was said six months ago."* Discounted because the author sells training and links an affiliate tool, but too specific and too consequential to dismiss. **This is the highest value per unit of evidence in the whole corpus and it maps directly onto the evidence-quote and change-history design.** It also badly needs primary validation.

**Information going stale**, best evidenced from the client side — two independent clients at $16,000 and $18,500 describing planners whose Aisle Planner and Drive were not kept current. The reframe that matters: the constraint is not access to a tool, it is **the marginal cost of keeping it current**. That is precisely the cost this product attacks.

## E.6 The AI attitude finding, which is a product specification

Planner sentiment towards AI is neither enthusiasm nor fear. It is fatigue with AI marketing, scepticism of anything client-facing, specific hunger for back-office automation, and — critically — **conditional on verifiability**:

> "unless it linked me to the appropriate document... so I can double check manually"
> — u/dzzi

> "**Why I'm still doing event specs manually and I can't forward all my documents to AI to create deadlines and a project plan off of contracts is beyond me.** Until an actual PLANNER and not just some tech company trying to sell to planners decides to figure out how to really make this work…I'm not hopeful."
> — u/FittestEventProf

Three things follow directly.

The first quote is **an unprompted specification of the evidence-quote feature.** The requirement that every extracted fact shows the source is not a nicety of Lume's design philosophy; it is the stated precondition for this market trusting AI at all. That is the strongest single piece of validation for the existing architecture found anywhere in this investigation.

The second quote is **an unprompted demand statement** — and note what it asks for. It is not about calls. It is about **forwarding documents and contracts** and getting deadlines and a plan out of them. That nudges document ingestion up the roadmap relative to my V1.1 placement in Section M, and it is worth testing directly in the validation experiment.

The third is the tone: *"an actual PLANNER and not just some tech company trying to sell to planners."* Credibility in this market is not established by product quality alone. Whatever is built needs a practitioner attached to it visibly.

## E.7 The vendor-marketing mirror

Every pain in the brief is asserted, confidently and in near-identical language, by at least one company selling software to wedding planners — InvitiApp, Mitra Planner, WeddingFlow, Nuptial, Paige. Two readings, not mutually exclusive: convergent validation from several teams who each did customer development, or founder consensus copied between AI-generated SEO pages.

The asymmetry decides it. **The pains vendors assert most loudly — WhatsApp fragmentation, missed line-item changes, day-of surprises — are precisely the ones with no practitioner evidence. The pain planners articulate most clearly, cross-client tracking, gets almost no vendor airtime.**

That asymmetry is simultaneously the strongest argument for this product and the clearest warning about how it has been conceived so far. The market is crowded with products solving the pains that are easiest to write a landing page about, and comparatively empty of products solving the one a planner actually named.
# F. Competitors

## F.1 Corrections to assumptions in the brief

Four things stated or implied in the brief are wrong and change the analysis.

**Timeline Genius has not shut down.** It is trading, posted a thirteen-year anniversary in August 2026 claiming over 300,000 timelines created, and shipped a conversational AI assistant called Genie in early 2026 with further capability in July 2026. It is roughly a five-person company, so it is small — but it is alive and it shipped AI before Aisle Planner did.

**Táve is the product that effectively disappeared.** It is now VSCO Workspace and, since 23 June 2026, is no longer sold standalone — new customers must buy the $499.99/year VSCO One bundle. Existing subscribers are grandfathered.

**Planning Pod has abandoned solo planners.** Self-serve pricing is gone, the tiers are quote-only, and its own FAQ states the software, support and roadmap are venue-first. Typical single-location venues are quoted $199–$319 per month. It is no longer a competitor for this customer.

**Prismm (formerly AllSeated)**, the floorplan tool many planners depend on, was acquired by Cvent and **sunsets on 31 December 2026**, going view-only from 1 October 2026. HoneyBook's floorplan story is an integration with a product that is about to be switched off. This creates a short-term disruption in the market, though not one this product should chase.

## F.2 The landscape

| Product | Price (Aug 2026) | Solo plan | Planning depth | AI status |
| --- | --- | :--: | :--: | --- |
| **HoneyBook** | $29–$109/mo annual; $36–$129 monthly | Yes | **None** | **Far ahead** — video + in-person notetaker, AI chat, automations builder, lead enrichment, Gmail lead finder, MCP/Claude connector |
| **Dubsado** | $35 / $55 per mo | Yes | None | **Shipping fast** — email-thread summaries Nov 2025; Notetaker June 2026, free on all plans while in Labs |
| **Aisle Planner** | $49.99–$229.99/mo by *active project count* | Yes | **Deepest of the incumbents** — timelines, checklists, budgets, seating, guest management | **Zero.** No AI anywhere in its changelog to 22 July 2026, and none on its published roadmap |
| **Planning Pod** | $199–$319/mo, quote only | **No** | Venue operations | None |
| **Timeline Genius** | $54.95/mo, $549.95/yr | Yes | Run-of-show timelines only | **"Genie"** — reviews timelines for errors, parses contracts, drafts emails, parses pasted contact lists |
| **Rock Paper Coin** | Free / $33 / $41 per mo | Yes, free tier | None | None found |
| **WeddingPro (Knot/WeddingWire)** | Unpublished; est. $50–$1,200/mo | N/A | N/A — advertising | None vendor-side |
| **17hats** | $60/mo all-in | Yes | None | Minimal — email tone rewriting, ~2023 |
| **Studio Ninja** | $16 / $27 / $40 per mo; **native GBP** | Yes | None | **None** |
| **Moxie** | $10 / $20 / $32 per mo | Yes | None | Undocumented "AI assistant" |
| **Bridebook SupplierPro (UK)** | £20 / £99 per mo +VAT | Yes | Light CRM | Couple-side only (ChatGPT venue search) |
| **That's The One (UK/global)** | £45/mo, unlimited weddings | Yes | **Deep** — timelines, seating, RSVP, budgets, 7 languages | **Yes** — run-of-show file → timeline; files Zoom transcripts and summaries |
| **Ayyla** (2026) | $75 / $120 / $199 per mo | Yes | AI-native planner OS | AI-first — but effectively pre-launch, unfunded |
| **Nuptial** (new) | $39 / $79 / $149 per mo | Yes | Claimed | Unverified — no reviews, press or funding found |
| **Breezit AI** | $99–$399/mo by inquiry volume | Yes | None — AI sales assistant only | AI *is* the product; most credible new entrant |
| **RSVP'd** | Free / $49 per mo | — | Claimed all-in-one | **Targets couples, not planners.** Own counters read "20 active planners, 79 events" |

## F.3 The four observations that matter

**One. Nobody has combined wedding-native planning depth with AI.** This is the clearest structural finding in the whole investigation. Aisle Planner owns the planning workflow — timelines, checklists, budgets, seating, guest management — and has shipped **zero AI**, with none on its announced roadmap. HoneyBook has the best AI in the category by a wide margin and **no wedding planning workflow at all** — no day-of timeline, no checklists tied to a wedding date, no couple's budget, no seating. Dubsado has a good notetaker and no planning workflow. Timeline Genius has AI and timelines but no CRM, no contracts, no invoicing and no mobile app.

**Two. No incumbent CRM does conversational write-back.** Every AI feature that has shipped is *read-oriented*: transcribe, summarise, draft, suggest. HoneyBook extracts action items and can convert them to tasks with a click — the closest anyone comes. Dubsado's roadmap includes "Ask Dubsado", explicitly read-only Q&A. The only product doing anything resembling conversational updates is Timeline Genius's Genie, and only within a single timeline. **Telling a system what changed and having it maintain the record is genuinely unbuilt.** That is the wedge, and it survives contact with the evidence.

**Three. Mobile is a real and surprising weakness in the planning-depth products.** Aisle Planner — sold substantially on day-of coordination — **has no native mobile app**, and its own help documentation warns that drag-and-drop in checklists, budgets and seating does not work on mobile. Planning Pod, Timeline Genius and Rock Paper Coin have no native apps either. HoneyBook is the outlier with a 4.77 rating from over sixteen thousand ratings, and its in-person notetaker is mobile-only. So the products a planner would use *at a venue* are the ones without AI, and the product with AI is the one without planning.

**Four. Consolidation has started, and it is aimed at exactly this space.** That's The One — £45/month, planner-native, deep planning features, seven languages, already shipping transcript filing — was **acquired by Helium Ventures on 6 August 2026**. Helium also acquired Maroo (payments) earlier in 2026. A planning-plus-payments consolidation under an AI-native owner is now underway, and TTO is the single closest competitor to the product described in this report. It is not an American product with a UK skin; it prices in GBP and operates in thirty-plus countries.

## F.4 What the planner actually pays today

Typical realistic stacks, at 2026 prices:

- **US full-service planner:** HoneyBook Essentials ($59) + Aisle Planner ($69.99 for ≤15 projects) ≈ **$129/month**, plus WeddingPro advertising which can dwarf both.
- **US budget-conscious planner:** Rock Paper Coin free tier + Google Sheets ≈ **$0/month plus 2.5% processing**.
- **UK planner:** Studio Ninja (£13–£29) or Dubsado ($35) + Bridebook (£20) + spreadsheets ≈ **£40–£70/month**, or TTO at £45 as a single tool.

A €39/month product must fit into that picture as an addition, which reinforces the coexistence positioning in Section G. It also means the realistic competitive question is not "would they switch" but "would they add a third line item".

## F.5 Generic tools

No methodologically sound survey of what professional planners use exists — that should be stated plainly, because a lot of confident percentages circulate and none of them are traceable. What does exist is unusually strong circumstantial evidence, because **four competing vendors independently name spreadsheets as the incumbent they displace**: Planning Pod ("most venues come to us running on Google Sheets, Google Calendar, and emailed PDF contracts"), HoneyBook's pricing page listing Trello/Asana as a line item it replaces, Nuptial's homepage ("day-of coordination is still a spreadsheet"), and Aisle Planner's own marketing addressing planners "still managing event logistics through email threads and spreadsheets" — while recommending Asana and Monday.com alongside its own product.

The Notion template market is small but real: 46 templates in the official marketplace for "wedding planner business", at $10–$18.50, plus equivalents at $5–$11.51 on Gumroad and Payhip covering client CRM, vendor trackers, budgets, payment schedules and checklists.

**The price comparison is the finding.** A planner can buy a functionally comparable tracker system once for $5–$20, versus $600–$1,320 a year for Aisle Planner or HoneyBook. What the templates cannot do is the client-facing layer — no branded portal, no e-signature, no payment processing, no automated reminders. That tells you precisely what planners are willing to pay for: **client-facing professionalism and money movement, not internal organisation.** Internal organisation, which is exactly what this product sells, is the part they have historically solved for twelve dollars.

That is the most uncomfortable single fact in this report and it belongs in the bear case as much as here.

## F.6 A warning about the evidence base

A large share of what surfaces when searching for AI wedding software in 2026 is machine-generated affiliate content produced by the startups themselves, and it contains fabricated statistics and wrong competitor prices. Concrete instances found during this research: RSVP'd's blog cites a $399/month tier that does not exist on its own pricing page and states an Aisle Planner price that is verifiably wrong; Wedy Pro AI's site implies a Mark Cuban endorsement when the Shark Tank record shows all five sharks declined and Cuban specifically criticised the valuation, and its homepage counters render as "$0M processed"; several content sites publish precise-sounding AI benefit figures with no attribution.

All such numbers have been excluded from this report. The practical consequence for Part 2 and for any investor conversation: **any market statistic about AI in the wedding industry should be assumed fabricated until traced to a primary source.**
# G. Exact product proposition

## G.1 The three candidate propositions, tested

None of the three should survive unamended.

**"Every decision. Every supplier. Every change. Remembered."**
Rhythmically good and it names the right three objects. Its weakness is that "remembered" is now a commodity claim — every AI product in 2026 advertises memory, and a planner reading it has no way to tell this apart from an AI notetaker. It also has no verb of benefit: it describes what the software holds, not what changes for the planner. Keep it as a secondary line or an ad headline; it cannot be the primary proposition.

**"The wedding that remembers everything."**
Reject. It anthropomorphises the wedding rather than the tool, which reads as consumer bridal copy, and the professional buyer is being asked to identify with the event rather than with their own competence. It is also ambiguous — a couple could read this as a wedding-website product.

**"Tell it what changed. Your wedding plan updates itself."**
This is the closest to the actual mechanism and the most dangerous. "Updates itself" promises autonomy that the product deliberately does not deliver: nothing is written until the planner approves it. Shipping a promise that the core safety design contradicts creates a specific and predictable churn event in week one — the planner sees a review queue, concludes the product does not in fact update itself, and reads the approval step as unpaid labour rather than as protection. If any variant of this line is used, the review step must be framed inside the promise, not discovered after it.

## G.2 Recommended proposition

The practitioner evidence in Section E moves the emphasis up a level. Planners do not describe losing track of one wedding; they describe losing track *across* weddings. So the promise leads with the portfolio and the mechanism follows it.

> **Fifteen weddings. One place that knows where every one of them actually stands.**
> **Tell it what happened after each call — it keeps the picture straight and shows you exactly what changed.**

Supporting one-liner:

> **Stop being the only system that knows what's going on.**

Category framing, which matters more than the words:

> **Not another wedding CRM. The layer that sits above the one you already use.**

That third line is doing the heaviest commercial work in the whole document. The strongest single objection in Section B is that planners will not adopt another product. The counter is not to argue with it — it is to remove migration from the purchase decision entirely. The product must be explicitly positioned as coexisting with HoneyBook, Dubsado, Aisle Planner or a spreadsheet, and must never ask the planner to move their contracts, invoices or client portal.

## G.3 What the proposition must not claim

- Not "AI wedding planner" — that phrase is now occupied by products that position themselves as a *replacement* for the planner, which makes it actively hostile to the buyer.
- Not "all-in-one" — untrue and it invites a feature comparison the product loses.
- Not "never forget anything" — an absolute reliability claim that a probabilistic extraction step cannot honour.
- Not "automatic" — see G.1.

---

# H. Smallest compelling product

## H.1 Is the proposed loop sufficient?

The brief's loop is: capture after a call → AI proposes structured changes grouped as Changed / Responsibility changed / Deadline / Commitment / Decision / Needs confirmation → planner approves → truth updates → "Catch me up on Laura & James" returns the current picture.

**The capture-and-approve half alone is not sufficient to justify a paid subscription.** A planner can already record a call with Fathom (free tier), Otter or Granola, or use HoneyBook's built-in notetaker at no marginal cost, and get a summary with action items filed against the client. Charging separately for a slightly better version of a bundled free feature is not a business.

**The loop becomes sufficient only when the second half is genuinely present**, and the second half is the part nobody has shipped:

1. The new capture is **reconciled against everything previously recorded**, not filed alongside it. When the bus is cancelled, the previously-booked bus becomes superseded, not contradicted-in-a-different-document.
2. **Contradictions surface as a question rather than a silent overwrite.** Two credible final-numbers dates cannot both be current.
3. **"Catch me up" answers from maintained state**, not by re-reading ninety notes — so it is fast, consistent, and stays useful at wedding number forty.
4. **"What changed" is answerable across an arbitrary window**, with the evidence quote that caused each change.

So: the loop as written is the right loop, and it is sufficient *if and only if* reconciliation, contradiction handling and change history are in V1. If the first release is capture → summary → notes, the product is a worse Granola and should not be built.

## H.2 The smallest compelling product

Eight things. Nothing else.

0. **The week view across every wedding.** One screen answering "what needs me". Not a dashboard and not a score — a list of concrete unresolved things drawn from maintained truth: deadlines falling due, confirmations outstanding, decisions unanswered, contradictions unresolved, each labelled with which couple it belongs to. This is listed first because the evidence in Section E says it is the pain planners actually name, and because it is the only screen that is valuable on day one rather than in week six. Everything below exists to make this screen true.

1. **Create a wedding.** Couple names, date, venue name, and nothing else mandatory. Under thirty seconds.
2. **One intake capture.** Paste an existing planning document, a handover note, an email thread, or dictate five minutes of everything currently in the planner's head. This produces the initial picture and is also the activation event (Section J).
3. **Update capture.** Type, paste or dictate after any interaction. No categorisation, no forms, no field selection.
4. **Review.** Ready items in one tap; a short, honest "Needs you" list for genuine ambiguity. The review must be clearable in under sixty seconds for a typical call, or the loop dies.
5. **The Wedding Picture.** Current truth, grouped, inspectable, correctable. Every item shows where it came from.
6. **Catch me up.** Current position, what changed since last viewed, open decisions, upcoming dates, outstanding confirmations, issues.
7. **Changes.** Reverse-chronological change history with the evidence quote and the previous value.

## H.3 Explicitly out of V1

Budgets, payments, invoicing, contracts, proposals, lead capture, client portals, guest lists, RSVP tracking, seating charts, floorplans, wedding websites, day-of timeline building, vendor directories and email automation.

Every one of those is well served by an incumbent, and each one added makes the product a worse version of a category leader rather than the only version of something else. The discipline to omit them is the product decision. A wedding ERP built by one team against Aisle Planner and HoneyBook loses.

## H.4 The honest risk in this scope

A planner evaluating a tool with none of the above will ask "so what does it actually do?" and the answer is intangible until they have used it for several weeks across several weddings. **The product's value is longitudinal and its trial is not.** This is the central product-design problem, and Section J exists to solve it: the first-run experience must manufacture the longitudinal moment inside ten minutes by ingesting a wedding that already has history.

---

# I. Core user loop

## I.1 The lifecycle, stage by stage

**Wedding creation.** Triggered by a signed contract. Low frequency, low value, must be near-zero friction. Any onboarding wizard here is a mistake; the planner has done nothing yet and has nothing to gain from configuring.

**Intake.** The planner already holds context — from the enquiry call, the proposal, the venue, the date. In practice this arrives as an existing document or as knowledge in their head. This is the highest-leverage single moment in the product and is treated fully in Section J.

**Ongoing update capture.** The load-bearing behaviour. Happens after couple calls, supplier calls, venue visits, and in fragments from WhatsApp and email. Frequency ranges from a few times a month early on to several times a week in the final six weeks.

**Couple meetings.** Typically scheduled, often video, sometimes in person, 45–90 minutes, dense with preferences and decisions. Highest extraction yield per capture.

**Supplier calls.** Short, frequent, high consequence. Usually about availability, timings, deposits, changes and confirmations. Often on a mobile phone, often while doing something else.

**Venue visits.** Physical, mobile, hands occupied, sometimes poor signal, often with photographs. This is where an incumbent desktop CRM is at its weakest and where a mobile-first capture is at its strongest.

**Review.** Must happen close to capture or it accumulates. A review backlog is the single most likely mechanical cause of churn.

**Preparation.** Before the next call with the same couple or supplier. This is where the accumulated value is realised.

**Wedding week.** Confirmation-heavy. Final numbers, final timings, final changes. Very high stakes; very low tolerance for a tool that is slow or wrong.

**Wedding day.** Almost certainly not a capture surface. The planner is executing from a printed or shared run sheet with a phone in one hand. **Do not build for the wedding day in V1** — it is the highest-stakes, lowest-tolerance moment and the incumbent artefact (the run sheet) is deeply entrenched.

**Archive.** After the wedding. Low frequency, but it is the thing that makes an annual subscription defensible (Section R).

## I.2 Where the habit actually forms

Not at capture. Capture is a *cost* the planner pays, and paying it depends on believing in a later payoff.

**The habit forms at preparation, and there are two preparation moments rather than one.**

The *weekly* one is the stronger and it is the one the evidence supports. Monday morning, fifteen live weddings, and the planner opens one screen that tells her what needs her across all of them. That is the moment the product replaces an act of memory she currently performs herself and resents performing — and it recurs every week regardless of which weddings are active.

The *per-call* one is the moment the brief describes: about to speak to a couple, opens "Catch me up", does not have to scroll back through email to remember where things stood. It is real, and it is secondary, because per-wedding recall is the part planners have already solved tolerably well.

Both convert capture from optional admin into obviously-worth-it, because the planner can feel what the capture bought.

The design consequence is significant: **the product must engineer that moment early and deliberately rather than waiting for it to occur naturally.** A planner who captures four times and never once uses Catch Me Up before a call will churn, having experienced only the cost. Prompting Catch Me Up ahead of a known upcoming interaction is therefore not a nice-to-have notification feature; it is the mechanism by which the loop closes.

A secondary, weaker habit point exists in wedding week, when "what is still unconfirmed" becomes urgent. It is real but arrives too late to drive trial conversion.

## I.3 Where extra administration kills adoption

Ranked by how quickly each would end the trial:

1. **A review queue that grows faster than it is cleared.** If a five-minute call produces fourteen items needing individual decisions, the planner will stop capturing within a week. Ready-by-default with a short genuine-ambiguity list is not a UX preference; it is a survival requirement.
2. **Being asked to categorise or file at capture time.** The entire proposition is that the planner speaks and the system sorts. Any field, dropdown or tag at capture time contradicts the sale.
3. **Requiring migration.** Asking a planner to re-enter fifteen live weddings before getting value guarantees abandonment.
4. **Requiring a second system of record.** If the product asks the planner to also maintain their CRM, they will keep the CRM.
5. **Repeated correction of the same misunderstanding.** Confidence in the extraction is fragile; a system that keeps mis-assigning the same supplier will be abandoned even if it is right eighty per cent of the time.
6. **Setup before value.** No workspace configuration, no supplier-category setup, no template selection.

---

# J. First-run and the wow moment

## J.1 The design problem

The value is longitudinal; the trial is not. A first-run that starts from an empty wedding and asks the planner to capture their next call defers the payoff by days and loses most trials. The first run must therefore **manufacture a longitudinal moment from material the planner already has.**

## J.2 The recommended first ten minutes

**First screen.** Not a dashboard, not a tour, not a settings page. A single field and a single instruction:

> *Paste anything you have about one wedding you're currently planning. Meeting notes, a planning document, an email thread, or just talk for two minutes about where it stands.*

Below it, three secondary affordances: a microphone, a "paste from WhatsApp" hint, and a "show me with a sample wedding" link for the sceptical. The couple's names and date are asked for *after* the paste, pre-filled from what was extracted, so the planner never types anything the system could have read.

**First action.** The planner pastes a real planning document or dictates two minutes. This is deliberately the messiest possible input — a real one, not a curated one — because the demonstration only lands if it survives real mess.

**First extraction.** The system returns the wedding organised into: the couple and the people around them; suppliers and what each is responsible for; decisions already made; dates and deadlines; commitments outstanding; and, critically, **a short list of things it could not resolve.**

**The review.** Presented as a picture with a few gaps rather than a queue of tasks. The framing sentence is the product in one line:

> *Here's what I understood. Four things I couldn't be sure about.*

**The resulting Wedding Picture.** A single readable page: current position, people and suppliers, decisions, dates, actions, issues. The planner's own wedding, structured, in under five minutes of their effort.

**The immediate next action.** This is the step most first-run designs omit and it is the one that matters. The system offers:

> *Add what happened in your last conversation about this wedding.*

The planner pastes or dictates a second, more recent input. And then the wow moment fires — not on the first extraction, but on the second:

> *Three things changed. The bus you had as booked is now cancelled. Ceremony flowers moved from the florist to Laura's mother. The final-numbers deadline moved from 19 May to 12 May — the earlier date is still in your notes from March.*

**Activation event.** Two captures against the same wedding, with at least one reconciled change surfaced, followed by one use of Catch Me Up. That triple is the activation metric. Not signup, not first capture, not "created a wedding".

## J.3 "What makes this not HoneyBook with ChatGPT bolted on?"

The answer must be demonstrated in the first ten minutes, not argued. Three demonstrations do it, in order of force:

1. **It changed its mind correctly.** A bolted-on chatbot summarises the input it was given. This product noticed that the new input *contradicted* something it already held, superseded the old value, and said so. Summarisation cannot do this; it requires maintained state.
2. **It refused to guess.** When the input said "she's sorting the flowers", it did not invent a person. It asked which she. A planner who has watched an LLM confidently invent a supplier name understands the significance of this immediately, and it is the fastest possible way to establish that this is not a wrapper.
3. **It showed its working.** Every fact carries the sentence the planner actually said. Not a citation to a document — the words themselves.

The line to put under the demo:

> *A summary tells you what was said. This tells you what is now true — and what stopped being true.*

---

# K. Wedding-native semantics

## K.1 Method and caveat

Terminology below is drawn from how professional planners and suppliers write publicly, and from the UK/US differences that are well documented. The strongest confirmed difference is **supplier (UK/Ireland) versus vendor (US)** — this is not a stylistic preference, it is a marker of whether the writer is inside the industry in that market ([terminology comparison](https://www.thewaytobloom.com/blog/exploring-american-vs-english-wedding-terminology)).

## K.2 Recommended translation

| Lume concept | Wedding product | Reasoning |
| --- | --- | --- |
| Project | **Wedding** | Universal, unambiguous. Not "Event" — planners distinguish weddings from events and a wedding-specific product should not hedge. |
| Workspace | *(no user-facing term)* | A solo planner has one. Never show the word. |
| Stakeholder | **Person** | "Stakeholder" is corporate and will read as foreign. |
| — | **Couple** | A first-class relationship, not two unrelated people. |
| — | **Supplier** (UK/IE) / **Vendor** (US) | Must be locale-switched. Getting this wrong signals outsider status instantly. |
| People (section) | **People & Suppliers** | Keeps the couple, family and suppliers in one place, which is how planners think. |
| To Do | **Action** for the planner's own work; **Commitment** for what someone else said they would do | The distinction is real and is one of the most valuable things the product can maintain. Merging them into "tasks" loses it. |
| Milestone | **Key date** | "Milestone" is project-management vocabulary. |
| Risk | **Issue** when it is happening, **Watch** when it might | "Risk" is corporate; planners say "problem", "issue" or "something to keep an eye on". |
| Capture | **Update** as the noun; **"Add an update"** as the action | Avoid "Capture" — it is internal vocabulary and means nothing to a planner. A voice affordance can be labelled "Remember this". |
| Knowledge Centre | **Wedding Picture** (the page) / **the picture** (in conversation) | "Knowledge Centre" is enterprise software language. "Wedding Hub" is weaker — hubs imply navigation, not truth. |
| Meeting Prep | **Prep** — "Prep for this call" | Short, matches how planners speak. |
| History | **Changes** | "History" implies an archive; "Changes" implies relevance. |
| Catch Me Up | **Catch me up** | Keep exactly. It is already how planners talk, it is a verb phrase the user can say out loud, and it is the best-named thing in the brief. |
| Tell Me / Ask | **Ask** | Plain. |
| Decision | **Decision** | Already native. |
| Advise | *(omit)* | Not in V1 and the word is presumptuous towards an expert. |

## K.3 Terms to add that Lume has no equivalent for

- **Run sheet** (UK/IE) / **timeline** (US) — the minute-by-minute wedding-day schedule. Note the collision: "timeline" in the US means the wedding-day schedule, whereas in project software it means a Gantt of the planning period. The product must never use "timeline" to mean the planning period, or it will be misread by every US planner.
- **Final numbers** / **final headcount** — the single most consequential recurring deadline in the whole domain.
- **Wedding breakfast** (UK) — the meal after the ceremony, regardless of time of day.
- **Hen / stag** (UK/IE) versus **bachelorette / bachelor** (US).
- **Confirmed / provisional** — planners already use these words about bookings, and they map directly onto the trust model in Section O.

## K.4 Register — what to avoid

The buyer is a professional whose competence is the product they sell. Avoid: "big day", "I do", "dream wedding", "happily ever after", "bride and groom" (excludes a meaningful share of the market and reads dated), heart or ring iconography, and script typefaces. Avoid equally the opposite failure — "resource", "stakeholder", "deliverable", "workstream" — which will read as software built by someone who has never been at a wedding.

The correct register is that of a very good senior assistant: precise, calm, unfussy, never chirpy.

---

# L. UX and information architecture

## L.1 What to challenge in the proposed area list

The brief proposes: Current Picture, Couple, People & Vendors, Decisions, Actions, Key Dates, Issues, Changes, Ask, Prep. That is ten navigable areas for a product whose entire claim is low administration. **Ten areas is a filing system, and filing systems are what the planner already has and dislikes.** Each one is a place where information can be in the wrong place, and each one implies the planner should maintain it.

Reduce to **three surfaces plus two overlays.**

## L.2 The recommended architecture

**Surface one — the week.** The planner's home, and on the evidence in Section E the most important screen in the product.

It answers one question across the whole portfolio: *what needs me*. The content is a single flat list of concrete unresolved things, each tagged with the couple it belongs to and ordered by consequence and proximity — deadlines falling due, confirmations a supplier owes, decisions the couple has not answered, contradictions the product could not resolve, commitments now overdue. "Venue needs final numbers for Laura & James in 9 days." "Photographer hasn't confirmed timings for Priya & Sam." "Two different ceremony times recorded for Hannah & Rob."

Everything on it is an item the planner can act on or dismiss, and every item is derived from maintained truth rather than from anything the planner filed.

Below that list sits the wedding index: one row per active wedding, sorted by date, carrying the couple's names, the date with a plain-language distance ("14 weeks"), and a short honest state line — "3 unconfirmed", or "nothing outstanding". Archived weddings behind a filter.

**No health scores, no percentages, no traffic lights, and no readiness score.** A planner will not believe a computed score for a wedding they know intimately, and one wrong score contaminates trust in the accurate parts of the page. A count of specific unresolved things is trustworthy in a way a score never is, because the planner can click it and check.

**Surface two — the Wedding Picture.** The core screen. A single scrolling page, not a tabbed workspace.

At the top, a quiet header: couple names, date, venue, distance to the wedding. Beside it a single primary action, **Add update**, and a secondary **Catch me up**.

Then the page scrolls through blocks in this order, which reflects what a planner needs when they open a wedding cold:

1. **Needs you** — only when non-empty. Unresolved ambiguities and contradictions, each phrased as a specific question with the evidence quote and one-tap answers. This must be first because it is the only block that asks something of the planner, and burying it makes the truth quietly wrong.
2. **Recent changes** — the last handful of changes with dates. This is the block that makes the product feel alive and is the cheapest possible demonstration of the differentiator.
3. **Coming up** — key dates and deadlines within a rolling window, with the ones the planner owns distinguished from the ones a supplier owes.
4. **Outstanding** — commitments and confirmations awaiting someone else, grouped by person. This is the block planners will screenshot.
5. **People & Suppliers** — the couple first, then family and others, then suppliers by category, each with their current scoped responsibility and booking state.
6. **Decisions** — settled decisions and, separately, the ones still open.
7. **Issues** — current problems and things being watched.

There is no Budget block, no Guest block, no Documents block. Their absence is the positioning.

Every item on this page is selectable and opens the detail overlay. Nothing on this page is a form.

**Surface three — Changes.** The full chronology for one wedding: what changed, when, from what to what, and the sentence that caused it. Filterable by person, by supplier and by date. This is the surface that wins arguments, and "who said the bus was cancelled and when" is a real, frequent, high-stakes question.

**Overlay one — Update.** Invoked from anywhere. A large text area, a microphone, and nothing else. On submit it returns the proposed changes grouped by *kind of change* rather than by entity type — Changed, Decided, Now responsible, Deadline, Commitment, Needs you — because that grouping matches how the planner remembers the conversation they just had. Ready items are pre-approved with a single confirm; Needs-you items are individual questions. The overlay closes back to the Wedding Picture with the changed blocks briefly highlighted, so cause and effect are visible.

**Overlay two — Ask / Catch me up.** One input. "Catch me up" is a pre-filled suggestion rather than a separate feature, which keeps the surface count down and teaches the phrase.

## L.3 What planners will expect that this deliberately omits

**A countdown.** Expected, and cheap. Include it as text in the header, not as a hero element — a large countdown is consumer bridal styling and undermines the professional register.

**A dashboard across all weddings.** Expected — and the distinction between a dashboard and the week view above is the whole argument. A *dashboard* aggregates into summary indicators, which requires the underlying truth to be complete for every wedding to be trustworthy, which it will not be in the first season. The *week view* enumerates specific unresolved items, which is honest even when the picture is partial: an incomplete list of real things is useful, whereas an incomplete score is misleading. Build the enumeration. Never build the aggregate.

**A timeline / run sheet.** Strongly expected — this is arguably the most-used artefact in the profession. It is deliberately excluded from V1 (Section N) and this will be the most common feature objection. The honest answer is that the product feeds the run sheet rather than replacing it, and Part 2 should evaluate a read-only "everything I know about the day" export as the cheapest possible bridge.

**Category navigation and supplier views.** A per-supplier view — everything about the florist, in one place, including every change — is genuinely useful and falls naturally out of the data model. Treat it as the detail overlay for a supplier rather than as a new navigation area.

**A readiness state.** Wanted, and dangerous. See the wedding list above. If it is ever built, it must be a count of concrete unresolved things, never a score.

## L.4 The single UX principle

Every screen should be readable without the planner having maintained it. The moment a screen looks empty because the planner did not fill something in, the product has become the thing it replaced.

---

# M. Mobile and in-the-moment use

## M.1 Where the planner actually is — and a warning about this section

**A caveat first, because it undercuts the section's most intuitive argument.** The research found **no practitioner evidence at all** for poor mobile capture during venue visits. It is asserted throughout vendor marketing and nowhere by an actual planner. The evidenced note-taking habit is the opposite of what a mobile-capture thesis assumes: typed notes into a Google Doc during the call, followed by a recap email. That is a desk behaviour.

So the venue-visit case below is an **assumption**, not a finding, and it should be tested directly in the validation experiment rather than built on. What survives without it is still enough to make mobile capture necessary — immediately after a call is the most frequent capture window by a wide margin, and it is the two-minute gap in which the planner either records what happened or defers it indefinitely.

With that caveat: venue visits are the theoretically strongest case — standing up, hands partly occupied, generating a dense stream of facts otherwise reconstructed from memory in the car. Travel between appointments is a real window in a profession that drives a great deal. Supplier meetings resemble venue visits. Wedding week is confirmation-heavy and mobile. Wedding day is execution, not capture.

## M.2 Assessment of each capability

**Quick text capture — required V1.** The irreducible minimum. Must open and accept text in under three seconds from a cold start.

**Voice capture — required V1.** This is the venue-visit and in-the-car case and it is where the product is most clearly better than the alternative. Lume already has the transcription path (`/api/transcribe` → `whisper-1`). Two things it does not have and needs: capture that continues while the screen is off or the app is backgrounded, and clear handling of a failed upload. A voice note that is silently lost is worse than no product.

**Paste from any messaging channel — required V1, and cheaper than it looks.** Framed deliberately as *any channel* rather than WhatsApp specifically, because WhatsApp-with-couples turned out to be unevidenced; the channels planners actually name are email, SMS and Instagram DMs. The feature is identical either way: accept a pasted block of multi-speaker chat and extract from it. No integration, no API, no permissions. The only real work is prompt handling for timestamped multi-speaker format, including the fact that a sentence means different things depending on who said it. High value per unit of build.

**Document and contract ingestion — promote from "later" to a V1 candidate.** The single most direct demand statement found in the research is a working event professional asking why she still does specs manually and cannot *"forward all my documents to AI to create deadlines and a project plan off of contracts."* That is an unprompted request for exactly this capability, and it is about documents rather than conversations. It also solves the cold-start problem in Section J — a supplier contract is dense with dates, deposits and responsibilities. Text-bearing documents (PDF and Word) are a modest build; scanned images are not. **Recommend text-based document ingestion in V1 and defer image OCR.**

**Mobile review — required V1, in reduced form.** If capture is mobile and review is desktop, the loop breaks. But full review on mobile invites long queues on a small screen. The right shape is: confirm the ready items and answer the Needs-you questions on mobile, defer detailed correction to desktop.

**Photo attachment — valuable V1.1.** Planners photograph everything at venues. But a photograph creates an expectation of extraction (reading a handwritten quote, a contract page, a place-card layout) that is a meaningfully harder problem, and storing images has cost, privacy and retention consequences (Section W). Attaching a photo as evidence to a captured fact is the cheap version and is a reasonable V1.1.

**Email forwarding — valuable V1.1.** A forwarding address per wedding is a well-understood pattern and email is where supplier confirmations actually live. It is V1.1 rather than V1 because it introduces inbound-mail infrastructure, address routing, spoofing considerations and a whole new failure surface, and because forwarded threads are long, quoted and repetitive — exactly the input most likely to produce a large, noisy review queue and poison the first-week experience.

**Offline capture — required V1 in its weak form only.** Venues have poor signal; this is real. The required version is narrow: if the network is unavailable, the typed or recorded update is stored locally and uploaded when connectivity returns, with a visible pending state. Full offline reading and offline review is unnecessary and expensive.

**Native app — unnecessary.** An installable, well-built responsive web application covers everything above except reliable background audio, which is the one genuine argument for native. Not a V1 argument.

**Wedding-day mode — unnecessary and actively unwise in V1.** See Section I.

## M.3 Summary

| Capability | Verdict |
| --- | --- |
| Quick text capture | Required V1 |
| Voice capture with reliable upload | Required V1 |
| Paste from any messaging channel | Required V1 |
| Mobile review (confirm + answer) | Required V1 |
| Text-document / contract ingestion | Required V1 — evidenced demand |
| Offline queue for captures | Valuable V1 — but see M.1; the venue case is unevidenced |
| Photo as evidence attachment | Valuable V1.1 |
| Email forwarding address | Valuable V1.1 |
| Photo and scan content extraction | Later, if ever |
| Native apps | Unnecessary |
| Wedding-day mode | Unnecessary in V1 |
| Full offline read/review | Unnecessary |

---

# N. Domain and data model

## N.1 Principle

The failure mode to avoid is obvious and common: the model expands until the product is a wedding ERP with a chat box. The test applied to every candidate entity below is narrow — **does the core loop break without it?** Not "would a planner find it useful", because a planner would find a budget tracker useful and a budget tracker is not this product.

## N.2 Essential

| Entity | Why essential |
| --- | --- |
| **Wedding** | The container. Everything is scoped to it. |
| **Person** | Every fact attaches to someone. |
| **Couple** | A named relationship on the wedding, not a separate table — two person references plus the label used in conversation ("Laura & James"). Needed because the couple is addressed as a unit constantly. |
| **Supplier** | See N.4 — yes, first-class. |
| **Responsibility** | The scoped "who is doing what", with supersession. This is the single most valuable entity in the model and the one incumbents represent worst. |
| **Decision** | What has been settled, with its state (Section O). Must be first-class here even though it is not in Lume. |
| **Action** | The planner's own work. |
| **Commitment** | What someone else undertook. Distinct from Action — see N.6. |
| **Key date** | Deadlines, appointments and the wedding date, with a type. |
| **Issue** | Current problems and things being watched. |
| **Change record** | What changed, when, from what, and why. Not derivable after the fact; must be written at apply time. |
| **Evidence** | The verbatim source sentence, linked to whatever it caused. Lume has `provenance` on knowledge items; this must become universal. |
| **Update / capture** | The raw source, retained. |

## N.3 Deliberately excluded from V1

Payment, deposit, contract, guest, guest count as a structured record, dietary requirement, table, seating, budget line, invoice, lead, enquiry, proposal, task template, checklist, and wedding-day run sheet. Each is discussed below where the brief asks specifically.

## N.4 Must Vendor be first-class? — **Yes**

Three reasons, and they are decisive.

A supplier is a **stable entity across weddings**. The same florist recurs across a planner's whole portfolio. Modelling suppliers as free text loses the one piece of cross-wedding structure that is cheap to get and genuinely valuable later ("everything the florist has ever committed to, across every wedding").

A supplier has **a booking state that changes over time** (Section O), and states need somewhere to live.

A supplier is **the most common source of contradiction**, which is the product's core competence. Contradictions need a stable target.

The important qualification: a supplier is first-class but **thin**. Name, category, one or more contacts, and a per-wedding booking state and responsibility. Not a CRM record, not rate cards, not contracts, not documents.

Supplier contacts must be modelled as People, because "the florist" and "Maria at the florist" are different things and the sentence "Maria is on holiday" must not silently mean the business is unavailable.

## N.5 Must Venue be first-class? — **Yes, but as a supplier with a flag**

The venue is a supplier: it is booked, it has contacts, it imposes deadlines, it changes things. Giving it a separate table duplicates the machinery. Give it a `is_venue` marker so the Wedding Picture can display it prominently and so "the venue" resolves unambiguously in extraction — which matters a great deal, because "the venue" is the most frequently used definite reference in the entire domain and must never resolve to the wrong entity.

## N.6 Are payments required for the wedge? — **No, with one exception**

Payments are not required and including them is a trap: the moment the product holds partial financial data, planners will expect reconciliation, reporting and completeness, and an incomplete financial record is worse than none.

The exception is that **the deposit deadline** is one of the highest-consequence recurring facts in the domain. Model it as a Key Date of type `payment_due` attached to a supplier — a date with consequence, not a financial record. Amounts are optional free text on the date. No ledger, no totals, no paid/unpaid balance.

## N.7 Are selections required? — **No, as a separate concept**

"Menu B", "the ivory linen", "the vintage bus" are all **Decisions with a state**. Adding a separate Selection entity duplicates Decision and forces an artificial boundary — is choosing a caterer a decision or a selection? The state machine in Section O does all the necessary work. What Decision does need is an optional link to the supplier it concerns, so that "what have they chosen for flowers" is answerable.

## N.8 Is guest count structured truth? — **Partly. The number, yes. The list, no.**

The guest *list* is emphatically out of scope: it is large, personal, high-maintenance, and thoroughly served by incumbents.

The guest *count* is different. It is a single number that changes repeatedly, is the subject of a hard deadline, drives catering, seating and cost, and is a classic verbal-update casualty — "they're down to about 95" is exactly the kind of sentence this product exists to catch. Model it as a small number of dated, evidenced values with a type (`estimated` / `confirmed` / `final`) attached to the wedding. That is the smallest structure that supports "what's the current number and when did it change", which is the whole ask.

## N.9 Is the wedding-day timeline V1 or expansion? — **Expansion, and this is a considered decision**

The arguments for V1 are strong: it is the artefact planners use most, it changes constantly, and maintaining it is a real burden.

The arguments against are stronger. Building a run sheet means building a *document editor with an opinionated schema*, which is a large piece of work orthogonal to the wedge and directly competitive with entrenched incumbents and with the Word and Google Docs templates most planners actually use. It is also the highest-stakes artefact in the profession — planners will not trust an AI-maintained run sheet on the day until they trust everything else, and a product that gets a run sheet wrong once is finished. And it is a *late-engagement* artefact, which means it contributes nothing to the first three months of a subscription while consuming most of the build.

The right V1 compromise is a read-only **"everything I know about the day"** view: confirmed timings, arrival and access times, supplier contacts and their responsibilities, assembled from truth the product holds anyway. It costs little, it demonstrates value at exactly the moment the planner is under most pressure, and it feeds the run sheet the planner will build elsewhere.

## N.10 Classification of every major Lume entity

| Lume entity | Verdict | Detail |
| --- | --- | --- |
| `workspaces`, `workspace_members` | **Reuse unchanged** | Solo planner has one. Never surfaced. |
| `profiles` | **Reuse unchanged** | |
| `projects` | **Rename + extend** → `weddings` | Drop `kind`, `status` (healthy/watch/at_risk), `release_month`, `merge_on`, `release_on`, `current_focus`, `next_milestone*`. Add wedding date, venue reference, couple label, engagement type, archived state. |
| `stakeholders` | **Rename + extend** → `people` | Keep name/role/preferences/concerns — `preferences` jsonb is directly useful for couples. Add relationship-to-couple and an optional supplier link. |
| — | **New** → `suppliers` | Thin. Name, category, is_venue, cross-wedding identity. |
| — | **New** → `wedding_suppliers` | The join carrying booking state per wedding (Section O). |
| `todos` | **Extend** → `actions` | Keep the table. `TodoKind` already carries `ACTION`/`WAITING`/`CHASE`/`REMINDER`, which is most of the Action/Commitment distinction; add an explicit owner reference so a Commitment names a person or supplier rather than a free-text `waiting_on`. |
| `risks` | **Rename** → `issues` | Statuses map cleanly: `open`→open, `watch`→watch, `resolved`→resolved, `accepted`→accepted. The lifecycle-authority module transfers as-is. |
| `milestones` | **Rename + extend** → `key_dates` | Replace the type enum (`phase`/`submission` are meaningless here) with `wedding_day`/`deadline`/`appointment`/`payment_due`/`supplier_milestone`. Add supplier and owner references. |
| `knowledge_items` | **Reuse, heavily** | The `kind`/`epistemic`/`lifecycle`/`supersedes_id`/`meta`/`provenance` columns are the most valuable thing in the schema. `kind` gains wedding values; `section` needs new values. Responsibilities continue to live here exactly as they do now. |
| `capture_sessions` | **Reuse unchanged** | Rename in UI only. |
| `history_events` | **Extend** → `changes` | Must gain a reliable link to the source capture and to the previous value. Currently a log, needs to become a change record. |
| `memories` | **Discard** | Overlaps `knowledge_items`; a second free-form store is the exact duplication the constitution warns about. |
| `recommendations` | **Discard for V1** | Tied to the parked Coach/Advise surface. |
| `meetings` | **Replace** | The rich `MeetingPrep` shape is PM-specific. Prep should be generated from maintained truth on demand, not stored as a record. |
| `releases` | **Discard** | Entirely PM-specific. |
| `coach_sessions` | **Discard** | |
| `project_intelligence_snapshots` | **Reuse** | The compression/freshness mechanism transfers directly and is the natural backing for Catch Me Up. |
| `workspace_preferences`, `workspace_usage` | **Reuse unchanged** | |
| `billing_*`, `subscriptions` | **Reuse unchanged** | Needs a plan catalogue added (Section R). |
| `eval_runs` | **Reuse unchanged** | The eval harness is one of the strongest assets; a wedding corpus replaces the PM corpus. |

## N.11 Net assessment of the refit

Of twenty-three tables, roughly ten reuse with a rename, four need extension, four are discarded, and three are net-new (`suppliers`, `wedding_suppliers`, plus a guest-count structure). **The schema is not the hard part.** The hard part, quantified in Part 2, is that the capture apply boundary encodes a closed set of thirteen legal operations (`create_todo`, `update_risk_status`, `confirm_responsibility`, `write_availability` and so on) and a fixed domain enum. Wedding semantics need booking-state transitions, guest-count updates and decision-state transitions added to that closed set — and each addition must be accompanied by the same class of containment test the existing ones have, or the reliability advantage is diluted rather than transferred.

---

# O. AI trust model

## O.1 Why this section is the product

In project management, a wrongly recorded status is embarrassing and recoverable. In weddings there is a fixed, unmovable date and no second attempt. A supplier wrongly recorded as booked is discovered on the day. **The cost of a confident error is categorically higher in this domain than in Lume's current one**, which cuts both ways: it makes reliability genuinely valuable, and it makes any reliability failure existential.

## O.2 Certainty states

Two distinct axes are being conflated in the brief and must be separated.

**Axis one — how sure is the product that it understood the sentence?** This is an extraction property. It belongs in review and nowhere else. Once approved, it disappears. Lume already takes this position: V2 treats model confidence as informational and does not gate on it.

**Axis two — how settled is the thing itself in the real world?** This is a domain property. It is permanent, it is what the planner actually needs, and it is what the states below describe.

Conflating them produces the badge-covered interface the Lume constitution explicitly rejects, and it also produces a subtler failure: a fact the model extracted with total confidence from the sentence "we're leaning towards menu B" is a *confidently extracted tentative decision*, and displaying it as high-confidence is precisely wrong.

## O.3 Booking states for suppliers

Proposed, with the honest note that these must be validated with practising planners before being fixed, because a state machine the user does not recognise is worse than free text:

| State | Meaning |
| --- | --- |
| `considering` | On the list, no contact or early contact |
| `shortlisted` | Actively in the running, usually quoted |
| `verbally_agreed` | Agreed in conversation, nothing signed or paid |
| `booked` | Contract signed |
| `deposit_paid` | Deposit confirmed received |
| `cancelled` | No longer engaged |

Two judgements about this list. First, `verbally_agreed` is the state that justifies the whole machine — it is precisely the ambiguity the product exists to hold, and it is the state that no incumbent captures, because a CRM records a contract event and has no vocabulary for "the florist said yes on the phone". Second, `deposit_paid` is probably one state too many for V1 and risks pulling the product towards financial tracking; the deposit is better represented as a Key Date. **Recommend shipping five states, with `deposit_paid` deferred pending validation.**

## O.4 Decision states

Simpler, and sufficient: `open` (being decided), `leaning` (a preference exists but is not settled), `decided`, `changed` (previously decided, now different — with the prior value retained), `reversed`.

`leaning` is the counterpart to `verbally_agreed` and matters for the same reason. "We're leaning towards menu B" must not become "Menu: B".

## O.5 What the AI may do

**May extract without asking:**
- Atomic statements with a verbatim evidence quote.
- Dates stated explicitly or unambiguously relative ("12 May", "the Friday before the wedding").
- Named people and named suppliers, where the name appears in the text.
- Responsibility statements where both the person and the scope are named.
- Commitments where the person and the undertaking are both named.
- State *downgrades* — cancelled, postponed, fallen through. Asymmetry is deliberate and important: recording something as less settled than it is causes a phone call; recording it as more settled causes a wedding-day failure.

**May auto-resolve:**
- An exact full-name match to an existing person or supplier on this wedding. Lume's existing `namesMatchExact` gate is exactly right and should transfer unchanged.
- "The venue" where exactly one supplier on this wedding is flagged as the venue.
- A repeated statement of something already held — recognise as no change, do not re-record.
- Trivially unambiguous relative dates.

**Requires review:**
- Any state *upgrade* — considering → booked, leaning → decided, estimated → confirmed. This is the single most important rule in the model. Every upgrade is a claim that something became more certain, and every wedding-day disaster in Section P is an unreviewed upgrade.
- Creating a new person or supplier — the primary duplicate-entity risk.
- Any contradiction with something currently held.
- Any change to the wedding date, the guest count, or a deadline.
- First-name-only references where more than one person could match.
- Responsibility transfers.

**Must not infer, ever:**
- A person or supplier not named in the source. No inventing "the florist" as a name.
- A responsibility owner from mere participation in a discussion. Lume's constitution already states this and it transfers verbatim: someone who discussed the flowers is not the owner of the flowers.
- A booking state from a discussion of a supplier.
- A deadline from a general statement of urgency.
- That silence means unchanged is now confirmed, or that silence means cancelled. **A later capture that does not mention a still-current fact must never cause the fact to be forgotten** — Lume's durable-knowledge rule, and the highest-value principle in this domain.
- Which of two contradictory statements is correct. Surface both.

## O.6 The four examples from the brief, resolved

| Input | Correct handling |
| --- | --- |
| "The venue has moved the deadline to 12 May." | Extract. Venue resolves via the venue flag. But this is a **deadline change**, so it goes to review with the previous date shown alongside. Auto-apply would be wrong. |
| "She'll take care of flowers." | Never auto-resolve. Needs you, with the candidate people offered as one-tap answers. Lume's existing single-token-name gate produces exactly this behaviour today. |
| "We're leaning toward menu B." | Extract as a Decision in state `leaning`, ready. Recording a leaning as a leaning is safe; the danger is only in recording it as decided. |
| "The photographer is booked." | The hardest case. A state upgrade to `booked`, therefore always review — and the review must ask the discriminating question rather than merely presenting the change: *"Contract signed, or agreed verbally?"* Answering it takes one tap and produces a materially more truthful record than any incumbent holds. |

That last row is, in miniature, the entire argument for the product.

---

# P. Failure modes

## P.1 Ranked by severity

Severity here means consequence to the planner's business — reputation, liability and the possibility of a ruined wedding — not technical seriousness.

**Catastrophic — a wedding fails or the planner is liable**

1. **Tentative recorded as confirmed.** "We're leaning towards" becomes "decided"; "he said he'd probably do it" becomes "booked". The planner stops chasing something that was never secured. Discovered on the day. This is the worst failure the product can produce and it is the one an eager extraction model produces most naturally.
2. **Preferred supplier recorded as booked.** A specific and especially dangerous instance of the above, because it is the case where the planner's own behaviour changes most decisively — they stop looking.
3. **Missed cancellation.** Something is cancelled in conversation and is not recorded. The planner's picture says booked. Identical consequence, opposite cause: an extraction miss rather than an extraction over-reach. Mitigated by the asymmetry rule in O.5 — cancellations may be extracted freely, upgrades may not.
4. **Wrong date on a hard deadline.** Final numbers, deposit, or the wedding date itself. Missing final numbers has immediate financial and catering consequences.

**Severe — significant embarrassment and rework**

5. **Wrong wedding.** A fact from Laura & James lands on a different couple. Two weddings are now wrong and the planner may act on either. Technically the most preventable failure — Lume already rejects cross-project IDs at validation and the tests assert that a write to A leaves B unchanged. It is severe rather than catastrophic only because it is usually noticed.
6. **Stale information overwriting current truth.** A late-processed capture from three weeks ago overwrites a change made yesterday. Corrosive because it is invisible: the record looks orderly and is wrong. Lume's stale-target fingerprinting exists precisely for this.
7. **Wrong supplier.** A commitment attributed to the wrong business. The florist is chased for something the caterer owes; the caterer is not chased at all.
8. **Wrong responsibility.** "Laura's mum is doing the flowers" recorded as replacing the florist entirely rather than sharing the scope. Both the mother and the florist may now think the other is handling the ceremony. Lume's `share | replace | continue | ambiguous` semantics and the Confirm Owner dialog exist for exactly this case, which is a genuinely striking fit.

**Serious — degrades trust in the product**

9. **Hidden unresolved decision.** Something needing a decision is recorded ambiguously and never surfaces. The planner believes the picture is complete. This is why Needs you must be the first block on the page, not a filter.
10. **Lost chronology.** "When did they say that?" becomes unanswerable. Damages the product's credibility in exactly the situation where it should be most valuable — a dispute. Currently a real Lume weakness, since history events are not reliably linked to their source capture.

## P.2 Is Lume's reliability philosophy a meaningful advantage?

**Yes — but not for the reason it is usually stated, and the honest version is narrower than the enthusiastic one.**

The advantage is not "Lume is careful". Every competitor would say that. The advantage is that carefulness is **implemented as structure and measured as a metric** rather than asserted as an intention. Concretely:

- The model cannot emit a write. It emits observations; deterministic code decides. A competitor bolting an LLM onto a CRM will typically let the model emit the mutation, and no amount of prompt engineering makes that as safe.
- There is a closed set of legal operations and no generic fallback write, so an unanticipated extraction fails closed rather than landing somewhere plausible.
- `needs_you` is a first-class outcome with equal standing to `write`, so "I cannot safely do this" is a normal result rather than an error path.
- Identity binding requires the recorded name to appear in the source text. A model-supplied ID is treated as intent, not proof.
- Every observation carries a verbatim evidence quote, which makes the chronology in failure 10 mechanically possible rather than a reporting feature.
- The eval harness separates **model failure** from **containment failure** — it counts how often a wrong model output was caught. Almost nobody measures this, and it is the only number that actually predicts the catastrophic failures above.

Now the qualifications, which matter:

- Most of that lives in **Capture V2, which is behind a flag and is not the default pipeline**. The legacy path still runs by default and still trusts client-posted state. Any claim of advantage is a claim about V2 specifically.
- The published philosophy runs ahead of the enforcement in several places, catalogued honestly in the project's own Known Discoveries: live tenant isolation is not in the PR gate, several mutations are optimistically applied with soft failure, and the epistemic triad is more UI label than tested persistence invariant.
- **It is not a moat** (Section S). It is a head start measured in engineering months, and it is invisible in a feature comparison.

Where it becomes commercially real is narrower and more specific: it lets the product make a promise incumbents cannot safely make — *this will never quietly tell you something is booked when it isn't* — and then survive the scrutiny of a planner who tests it. In a domain with a fixed date, that promise is worth more than in most.

---

# Q. Longitudinal value

## Q.1 Value by stage

| Stage | What the planner gets | Honest assessment |
| --- | --- | --- |
| **After intake** | A structured picture of one wedding assembled from a document they already had. | Real but shallow. Feels like a good summariser. Not worth paying for on its own. |
| **After ~5 updates** | The first reconciled changes. "This contradicts what you told me in March." | **The first genuinely differentiated moment.** This is where the product stops resembling a notetaker. Reaching it fast is the central activation problem. |
| **After ~20 updates** | Catch Me Up becomes materially faster than the planner's own recall or their email archive. Outstanding-confirmations lists become non-obvious. | **The point of no return.** The planner would now have to reconstruct real value to leave. |
| **3 months out** | Suppliers mostly booked; the picture is broad. Value is in "what's still open". | Moderate and steady. |
| **1 month out** | Deadlines cluster, changes accelerate, the planner is running several weddings in parallel at different phases. | **Peak value.** This is when the memory burden actually exceeds human capacity and the product earns its subscription. |
| **Wedding week** | Every outstanding confirmation, every final number, every changed timing, in one place. | Peak *urgency*, and the highest-stakes reliability test. Get this wrong once and the customer is gone permanently. |
| **Day before** | "Is anything unconfirmed?" answered from maintained truth. | High emotional value, and the strongest possible testimonial generator. |
| **Post-wedding / archive** | A complete evidenced record of what was agreed, by whom, and when. | Undervalued. Insurance against disputes, a genuine business asset, and the main reason an annual subscription survives the off-season (Section R). |

## Q.2 Compelling versus gimmicky

**Compelling:**

- **Outstanding confirmations, grouped by who owes them.** The most concretely actionable thing the product can produce, directly convertible into the planner's next hour of work.
- **Upcoming deadlines with ownership.** Distinguishing "I owe this" from "the venue owes me this" is genuinely hard to maintain by hand.
- **Unresolved choices.** Answers the question a planner actually asks before a couple call.
- **What changed this week.** Compelling precisely because it is impossible without maintained state — it is the differentiator made visible, and it is the natural content of a weekly re-engagement email.
- **Readiness briefing before a call or in wedding week.** The single highest-value output, and the reason capture gets done.

**Gimmicky, or at least unproven:**

- **Decisions reversed.** Interesting-sounding, rare in practice, and mostly a subset of "what changed". Do not build a dedicated surface for it.
- **Dependencies.** Lume has real dependency machinery and it is tempting to carry it across. But wedding dependencies are largely conventional and already known to the professional — a planner does not need software to tell them the florist needs the ceremony time. Automatic dependency inference would be noise dressed as insight. The genuine exception is the small set of *chained deadlines* ("final numbers depend on RSVPs, which depend on the invitation deadline"), and even that may not clear the bar in V1.
- **Cross-wedding portfolio intelligence.** Attractive to build and dangerous to ship early, for the reasons in Section L.
- **Anything scored as a percentage.** A planner will disbelieve a readiness score for a wedding they know intimately, and one wrong score contaminates trust in the accurate parts of the product.

## Q.3 The shape of the value curve, and what follows from it

Value is close to zero for the first few captures and rises steeply somewhere around the point where the planner's own recall starts failing — realistically twenty-plus updates, or roughly six to ten weeks of active planning on one wedding.

Two consequences dominate the commercial design.

**A thirty-day trial does not reach the value.** Either the trial is longer, or the first run manufactures the moment artificially (Section J), or the product converts on a promise rather than a demonstration. Manufacturing it is the only one of the three that is both honest and reliable, which is why Section J is disproportionately detailed.

**Churn risk is front-loaded and then collapses.** A planner who reaches twenty updates on two weddings is very unlikely to leave mid-engagement, because leaving means losing the picture on a live wedding with a fixed date. Retention effort should be concentrated almost entirely in the first six weeks.
# R. Retention and business model

## R.1 The structural question

A wedding ends. A planner's portfolio does not. So the retention question is not "will they stay after the wedding" but "does the planner's *rolling portfolio* keep at least one wedding valuable at all times". Given typical volumes and engagement lengths, the answer is usually yes — and that is the most important economic fact in this section.

A solo planner handling fifteen to twenty-two weddings a year, with engagements typically running nine to eighteen months, has live weddings in every month of the year. Wedding *dates* are seasonal; wedding *planning* is much less so, because the bookings for next summer are made and worked through this winter. **Seasonal churn is therefore a smaller threat than the brief assumes for established planners**, and a much larger one for newer or part-time planners doing five to ten weddings a year, whose engagements can genuinely lapse.

The exception that matters: day-of and month-of coordinators. Their engagement per wedding is weeks, not months, and it clusters hard into season. They are the segment most likely to cancel in November — and, not coincidentally, the segment with the least accumulated context to lose.

## R.2 What creates switching cost

Ranked by strength:

1. **Live weddings mid-engagement.** Leaving means losing the current picture on a wedding with an immovable date. This is the strongest lock any product in this space can have, and it is strongest at exactly the moment cancellation would otherwise be considered.
2. **The evidenced record.** A chronology of what was agreed, by whom, when, with the actual words. That is a business asset with dispute value, and planners will not casually delete it.
3. **Accumulated supplier knowledge across weddings.** Only accrues after a full season, but it compounds and is not portable.
4. **Habit.** Weakest, and the only one an incumbent can attack directly.

## R.3 Pricing

Anchors, all observed in 2026: HoneyBook Starter $36 / Essentials $59 / Premium $129 per month; Aisle Planner from $39.99 for ten projects rising to $169.99 for a hundred; Planning Pod $74–$159 by event cap; Granola around $25 per seat; Fathom free for recording. So the planner's existing software spend is typically $40–$120 per month, and a free-or-cheap AI notetaker is already available to them.

| Price | Assessment |
| --- | --- |
| **€19** | Reject. Signals a utility rather than a system of record, and at realistic user counts the revenue does not support the reliability engineering the product's entire claim rests on. Also invites comparison with a notetaker, which is the comparison to avoid. |
| **€29** | Defensible as an entry point and roughly notetaker-parity. Its weakness is precisely that parity — it frames the product as a better Granola. |
| **€39** | **Recommended.** Materially below HoneyBook Essentials, comfortably above a notetaker, and easy to justify against a single billable hour. High enough to fund support and to filter out hobbyists, low enough to be a same-day decision for someone billing $7,500 per wedding. |
| **€49+** | Only defensible if the product does meaningfully more than the wedge — at which point it is competing directly with HoneyBook Essentials at $59, which also does contracts, invoices and payments. Losing that comparison is easy and avoidable. |

**Recommendation: a single plan at €39 per month, or €390 per year (roughly two months free).** One plan, not three. Tiering a product this focused creates a purchase decision where none is needed and forces the buyer to evaluate features rather than the proposition.

An active-wedding limit should exist but should be set high enough never to bite a genuine solo planner — twenty-five active weddings, which is above the upper bound of a sustainable solo practice. Its purpose is to define the studio upgrade later, not to meter V1.

**Per-wedding pricing: reject as the primary model.** It is superficially attractive — it matches how planners bill, and it lets a day-of coordinator pay little — but it fails on the behaviour it creates. The product only works if every wedding is in it, and per-wedding pricing puts a cost decision in front of the planner at precisely the moment they should be frictionlessly adding one. It also makes revenue lumpy and seasonal, which is the opposite of what the annual plan is for. It is worth keeping as an over-limit mechanism only.

**Annual plans should be pushed hard**, and are the correct answer to seasonality: they convert a churn risk into a cash-flow advantage, and they are an easy sell in February when the planner is booking a full summer.

## R.4 Broad economics

Recurring revenue at €39 per month:

| Users | MRR | ARR |
| --- | ---: | ---: |
| 25 | €975 | €11,700 |
| 50 | €1,950 | €23,400 |
| 100 | €3,900 | €46,800 |
| 200 | €7,800 | €93,600 |

Direct cost of goods, estimated from Lume's own measured figures. Lume's controlled runs averaged roughly 1,092 tokens per Ask on the legacy path. Assume an active planner in season generating forty updates and thirty asks per month, with three minutes of dictation per voice update: transcription at Whisper rates is roughly $0.70 per user per month; extraction and Ask on a small model is a few tens of cents; even routing Ask to a frontier model keeps the total comfortably **under €3 per user per month**. Add hosting and Supabase and the blended gross margin sits above 90%.

**So unit economics are not the problem. Absolute scale is.** Two hundred paying planners at €39 is €94k of annual recurring revenue. That is a sustainable one-person business and it is not a venture outcome. This should be stated plainly to whoever is deciding, because it determines whether the correct target is 200 users or 2,000, and those imply completely different acquisition strategies. Reaching 2,000 solo wedding planners paying €39 requires either a genuinely viral referral dynamic within a tight-knit profession, or expansion beyond weddings into adjacent event professionals — and the second option contradicts the focus that makes the product good.

## R.5 Customer acquisition cost tolerance

If a planner stays twenty-four months at €39, lifetime revenue is €936 and gross profit is roughly €870. At a 3:1 ratio the tolerable acquisition cost is around **€290**.

That is the number every channel in Section T must be measured against, and it is tighter than it looks. On paid search, if a high-intent click costs €4, five per cent of clicks start a trial and a third of trials convert, then one customer costs sixty clicks — €240. That clears the bar, but only just, and only if every one of those assumptions holds. It leaves no room for the more likely reality that most wedding-planning search volume is consumers rather than professionals.

---

# S. Competitive moat

## S.1 What is not a moat

**AI is not a moat.** Neither is the prompt, the schema, the extraction quality, nor access to a good model. All are available to anyone within a week.

**Reliability engineering is not a moat either**, though this is the least intuitive claim in the section. It is a head start measured in engineering months — real, valuable, and completely invisible in a feature-comparison table. No planner has ever chosen software because of its containment architecture. It converts into commercial advantage only indirectly: it lets the product make a promise competitors cannot safely make, and then survive being tested on it.

## S.2 Assessment of each proposed source

| Source | Genuine defensibility |
| --- | --- |
| Conversational capture | **None.** Shipped by HoneyBook, available free from Fathom and Otter. |
| Structured truth | **Low to moderate.** The concept is copyable; a correct implementation is not trivial, but it is a matter of months. |
| Change intelligence | **Moderate.** The hardest of the group to retrofit, because it requires the truth to have been maintained with supersession from the beginning. A competitor who has been filing per-meeting summaries for two years cannot retroactively produce a reconciled change history from them. That is a genuine structural advantage — but it protects against *retrofitting*, not against a competitor starting fresh. |
| Approval and reliability | **Low as a moat, high as a promise.** See S.1. |
| Evidence-backed chronology | **Moderate, and it compounds.** Its value grows with the volume of history a customer has accumulated, which makes it the strongest of the switching-cost mechanisms rather than the strongest barrier to entry. |
| Catch Me Up | **None as a feature.** Anyone can build a summariser over their own data. Its quality depends entirely on the truth underneath it. |
| Low administration | **None as a feature, everything as a discipline.** An incumbent cannot ship low administration without removing things from a product their existing customers use. That is a real organisational constraint, and it is closer to a moat than anything on the technical list. |

## S.3 Could HoneyBook, Dubsado or Aisle Planner reproduce most of this within twelve months?

**HoneyBook: they already reproduced the visible half, and yes, they could do most of the rest.** The notetaker exists, records in person from mobile, extracts action items and files into the project. MCP exposes their record to Claude. What they have not done is maintain reconciled current truth across captures, and there is no public sign that they intend to. The constraint is not capability but centre of gravity: HoneyBook's revenue is substantially tied to payments flowing through the platform, so engineering effort concentrates on money movement, and the product must serve photographers, coaches and consultants as well as planners — which makes wedding-specific truth semantics like booking states and final numbers structurally unattractive to them. Verdict: **could, probably will not, and the window is real but not wide.**

**Aisle Planner: intent yes, velocity no.** Wedding-specific, but a platform of 2013 vintage, US-only in language and currency, with weak integrations. Twelve months is optimistic for them. Verdict: **unlikely.**

**Dubsado: no.** Deep workflow automation for service businesses generally, with no wedding-truth ambition. Verdict: **very unlikely.**

**The threat nobody named is the largest.** It is not the wedding CRMs. It is a general AI assistant with memory and a connector into whatever the planner already uses. HoneyBook MCP means a planner can already ask Claude about their pipeline. If personal-assistant AI keeps improving, "tell it what happened and it maintains a picture" becomes a general capability that arrives free with the tools people already pay for. **This is the single largest strategic risk to the entire thesis** and it is not addressed by out-executing HoneyBook.

## S.4 What could still make a focused product win

1. **Be additive, not competitive.** Never ask the planner to move contracts, invoices or their client portal. The product that requires no migration cannot be blocked by an incumbent's switching cost — and equally cannot be killed by an incumbent adding a feature, because it was never the reason the planner kept HoneyBook.
2. **Own the locale the incumbent has not.** HoneyBook's AI Notetaker is US and Canada only. UK and Ireland planners have no equivalent inside their tools, and their vocabulary ("supplier", "run sheet", "wedding breakfast", "final numbers") is not served by US-only products. This is a concrete, currently-verifiable, dated gap — and it is a considerably better wedge than competing in the US where the incumbent has already moved.
3. **Make the reliability promise explicit and testable.** "It will never quietly tell you something is booked when it is not" is a promise a general platform cannot make without redesigning how its AI writes. Say it in the marketing, then let planners try to break it.
4. **Accumulate a record the competitor cannot backfill.** Every month of evidenced, reconciled history is a month a switching competitor cannot reconstruct.
5. **Stay narrow.** The moment the product adds invoicing, it is a worse HoneyBook.
# V. Marketing site and new-user experience

## V.1 Testing the Monday–Friday narrative

The proposed narrative — couple changes flowers, venue changes deadline, photographer needs timing, transport changes, planner asks "catch me up" — is a good instinct and a weak execution.

What works: it is concrete, it is recognisable, and it dramatises frequency rather than volume, which is the correct emotional target. A planner does not feel overwhelmed by one big change; they feel eroded by twenty small ones.

What fails: the four changes are unrelated, so Friday's payoff is only *recall*. Recall is what a notetaker gives you, and the whole argument of this document is that recall is no longer differentiated. The narrative as written sells a product HoneyBook already ships.

## V.2 The improved narrative

Keep the week. Make the changes *collide*, and let Friday show reconciliation rather than recollection.

> **Monday.** The venue moves final numbers to 12 May. You note it.
>
> **Tuesday.** You tell the caterer 19 May, because that is the date in your spreadsheet from March.
>
> **Wednesday.** Laura's mother takes over the ceremony flowers. The florist still has the reception.
>
> **Thursday.** The vintage bus falls through on a phone call in a car park.
>
> **Friday.** *Catch me up.*
>
> — The final-numbers deadline is 12 May. You told the caterer 19 May on Tuesday.
> — Ceremony flowers moved to Laura's mother on Wednesday. The florist still has the reception.
> — The vintage bus was cancelled on Thursday. It was booked in February. Nothing has replaced it.

The second line is the whole product. It is the only line on the page that a summariser cannot produce, because producing it requires knowing what was already true and noticing that the new thing disagrees.

## V.3 Site structure

**Hero.** The proposition from Section G, set in the professional register:

> **After every call, tell it what happened.**
> **It keeps every wedding's current picture straight — and shows you exactly what changed.**

Beneath it, the disarming line that removes the largest objection before it forms:

> Works alongside HoneyBook, Aisle Planner or your spreadsheets. Nothing to migrate.

The hero visual should be the *output*, not the input: a short looping demonstration of a paragraph of messy speech resolving into structured changes with one item flagged as needing an answer. Showing the ambiguity flag in the hero is counter-intuitive and correct — it is the fastest way to differentiate from a wrapper.

**Pain section.** The Monday–Friday narrative from V.2, told plainly. No statistics, no invented percentages, no stock photography of stressed women with clipboards. The narrative should be recognisable enough that a planner reads it and thinks *that was my week*, which is the only conversion mechanism that matters here.

**Product demo sequence.** Four beats, in this order:
1. **Say what happened.** Real messy speech, not a curated sentence.
2. **See what it understood.** Grouped changes, ready items pre-approved, one honest question.
3. **Watch it disagree with itself.** The reconciliation moment. This beat is the site.
4. **Ask it anything.** Catch me up before a call.

Beat three is where a sceptical planner either leans in or leaves, and it should get more space than the other three combined.

**Differentiation.** Three short, checkable statements rather than a comparison grid — a grid invites feature comparison, which is the argument this product loses:
- *It updates what it already knew. It does not just add another note.*
- *It asks instead of guessing. Nothing is recorded as confirmed until you say so.*
- *Every fact shows the words that produced it.*

**Trust.** Under-designed on most sites of this type and disproportionately important here, because the buyer is being asked to put their clients' business into a new product from an unknown company. Four things, stated plainly: what the AI is allowed to do without asking; that nothing is used to train models; that the planner can export or delete a wedding in one action; and who the sub-processors are. A short, honest, human-readable page beats a trust badge.

**Pricing.** One plan, one price, an annual toggle, and a free trial that does not require a card. Show the price on the page — a hidden price signals enterprise sales and this buyer will simply leave.

**CTA.** Not "join the waitlist" and not "book a demo". A solo planner will not book a demo. The call to action is *start with one wedding* — because it names the smallest possible commitment and it is also the correct first-run behaviour.

---

# W. Privacy and compliance

## W.1 What is genuinely at stake

The planner is the data controller for their couples' and suppliers' data; the product is a processor. Because UK, Ireland and the EU are the recommended initial market, UK GDPR and the EU GDPR both apply, and the requirements are real but modest at this scale.

## W.2 Assessment by category

**Ordinary personal data** — couple names, family names, supplier contacts, phone numbers, email addresses. Standard. Requires a lawful basis (the planner's legitimate interest and contract), a privacy notice, security, and honoured data-subject rights.

**Family relationships** — "Laura's mother", "James's stepfather". Personal data, occasionally sensitive in the ordinary sense (divorce, estrangement, bereavement are constant features of wedding planning and will appear in captured notes). Not special category, but they warrant care in any output the planner might share.

**Dietary and accessibility information** — **this is the one genuine trap.** Dietary requirements frequently imply health conditions (coeliac, allergies) or religious belief (halal, kosher), both of which are Article 9 special-category data requiring an additional condition for processing. The mitigation is already in the product design and should now be understood as a compliance decision, not only a scope decision: **the guest list is out of scope and only the guest count is structured** (Section N.8). That single choice keeps the product out of special-category processing almost entirely. It should be defended on those grounds as well as on focus.

**Voice** — the sharpest and most under-appreciated issue, and here the product design turns a liability into an advantage. HoneyBook's notetaker records meetings, which raises consent obligations that vary by jurisdiction and are genuinely awkward with couples and suppliers. **The recommended V1 does not record conversations.** It accepts the planner dictating a summary *after* the fact — the planner's own voice, their own words, their own device. That sidesteps two-party consent entirely, removes the need for a recording disclosure, and is materially easier to sell to a planner who does not want to tell a nervous couple they are being recorded. If call recording is ever added, it becomes a substantially larger compliance project and should be treated as such.

**Payments** — out of scope in V1 (Section N.6), which removes PCI considerations entirely. Stripe-hosted checkout keeps card data out of the system for the product's own billing.

**Photos and documents** — deferred to V1.1, and the deferral is partly a privacy decision. Uploaded contracts and venue photographs expand the retention, deletion and residency surface considerably for value that is not yet proven.

**AI providers** — the material dependency. Required before launch: a signed data-processing agreement with the model provider; contractual assurance that inputs are not used for training; a published sub-processor list; and a decision on data residency. For a UK/Ireland-first product, being able to answer "where is my couples' data processed" with something better than a shrug is a genuine sales asset, not merely a compliance box.

## W.3 Genuine launch requirements

- A readable privacy notice and a data-processing agreement the planner can accept without a lawyer.
- Named sub-processors, with notification of changes.
- Contractual no-training assurance from the model provider.
- Per-wedding and whole-account deletion that actually deletes, including captures, transcripts and evidence quotes.
- Export of a wedding in a human-readable form. This doubles as a trust and anti-lock-in signal and costs little.
- A stated retention policy — a sensible default is that a wedding is archived after the date and deleted a defined period later unless the planner keeps it, since the archive has genuine dispute value.
- Encryption in transit and at rest; row-level tenant isolation, which already exists and is enforced in Postgres.
- Breach-notification process, however lightweight.

## W.4 What would be disproportionate

SOC 2, ISO 27001, single sign-on, customer-managed keys, audit-log export, a formal DPIA, a data-protection officer, and regional data-residency guarantees. The customer is a sole trader. None of these will be asked for, and building them signals a misunderstanding of the buyer.

---

# X. Validation before build

## X.1 What must be tested

Not "is there interest" — interest is free and meaningless. Three specific things, in order of importance:

1. **Will a professional planner pay for this specific proposition**, given that a free notetaker and a bundled incumbent feature already exist?
2. **Is the reconciliation moment the thing that persuades them**, or do they only respond to "AI takes your notes"? If it is the latter, the wedge is dead regardless of the build quality.
3. **Can a planner be reached for less than the cost tolerance in Section R.5** (~€290)?

A waitlist tests none of these, which is why the brief is right to exclude it.

## X.2 The experiment

A **priced landing page with a working interactive demonstration and a real checkout**, backed by a concierge service.

**The demonstration must be interactive and must use the visitor's own material.** A video demo tests message appeal; a demo the planner can paste their own messy notes into tests whether the extraction survives reality. The demo runs the real extraction pipeline against a temporary in-memory wedding, then — this is the essential part — invites a second paste and shows the reconciliation. It is a genuine build of perhaps a fortnight, and it is the experiment. Skipping it and testing a static page tests copywriting, not the product.

**Checkout must be real.** Stripe, the actual €39 price, an actual card entry. On successful payment: an honest message that onboarding is personal and manual for the first cohort, a booking link, and a full refund offered immediately if they change their mind. Payment intent with a real card is the only signal that means anything.

**The backend is concierge.** For the first ten to twenty customers the "product" can be the demo plus a human doing the maintenance behind it. This is legitimate, it is fast, and it produces the qualitative material — the actual sentences planners dictate — that Part 2 needs to build a real extraction corpus.

## X.3 Design

| | |
| --- | --- |
| **Primary audience** | UK and Ireland independent wedding planners doing roughly ten to twenty-five weddings a year, full-service or partial. Chosen because HoneyBook's AI Notetaker is US/Canada only, so the incumbent alternative is genuinely absent. |
| **Secondary audience** | US planners at the same volume, run as a smaller parallel cell purely to measure whether the incumbent's notetaker has already satisfied the need. |
| **Channels** | (a) Google Search on high-intent professional terms with tightly negatived consumer keywords; (b) Meta/Instagram to interest and behaviour audiences plus lookalikes; (c) direct outreach to fifty named planners for qualitative interviews — cheapest and highest-information of the three. |
| **Budget** | €3,000–€5,000 across four to six weeks. Roughly €1,500 Google, €1,500 Meta, the remainder on the demo build and incentives for interviews. |
| **Primary conversion** | Completed paid checkout. |
| **Secondary metrics** | Demo started; demo second-paste completed (the reconciliation moment reached); checkout started; interview-stated willingness to pay. |

## X.4 Thresholds, committed in advance

Stated before the money is spent, because thresholds set afterwards are rationalisations.

**Strong result — build.** Fifteen or more paid checkouts within the budget at under €250 acquisition cost; more than half of demo users reaching the second paste; and, in interviews, planners spontaneously describing the reconciliation behaviour rather than the note-taking as the reason they would pay.

**Ambiguous — iterate, do not build.** Five to fourteen paid checkouts, or acquisition cost between €250 and €500, or strong demo engagement with weak payment. Most likely diagnosis: the proposition is interesting and the price or the trust is wrong. Re-run once with a changed price or a changed hero. Do not start engineering.

**Failure — stop.** Fewer than five paid checkouts on a full budget; or acquisition cost above €500; or — and this is the killer regardless of the other numbers — planners in interviews consistently saying "my CRM already does this" or "I'd just use Fathom". If the qualitative signal says the incumbent has satisfied the need, the quantitative signal does not matter.

**One additional stop condition, independent of the experiment:** if during the test period a major incumbent announces reconciled cross-conversation truth maintenance, the window described in Section S.3 has closed and the experiment should be abandoned rather than completed.

---

# Y. Wedding versus Coaching versus Lume for PMs

## Y.1 Comparison

Scored 1–5, where 5 is best. Scores are judgements, not measurements.

| | **Wedding planners** | **Executive coaches** | **Lume for PMs (current)** |
| --- | :--: | :--: | :--: |
| Wedge clarity | 4 | 4 | 2 |
| Pain intensity | 3 | 3 | 4 |
| Willingness to pay | 3 | 4 | 2 |
| **Personal buying authority** | **5** | **5** | **1** |
| Acquisition targetability | 3 | 3 | 2 |
| Retention structure | 3 | 5 | 3 |
| Competitive intensity | 2 | 2 | 1 |
| Privacy burden | 3 | 1 | 4 |
| Fit to what Lume already is | 4 | 4 | 5 |
| Value of error containment | 5 | 2 | 3 |
| Refit cost | 3 | 4 | 5 |
| Path to first 25 | 4 | 4 | 2 |
| Path to 100–200 | 3 | 3 | 2 |

## Y.2 Reading the table

**The decisive column is buying authority, and it is why the currently-built product is the weakest of the three.** A wedding planner and an executive coach both own their business and can buy a €39 tool from a phone between appointments. A project manager is an employee. They cannot expense it without a conversation, their organisation already pays for Jira, Confluence, Notion and increasingly an AI assistant embedded in Microsoft 365, and any purchase decision involves someone whose problem this is not. Lume for PMs is the most finished product and has the worst commercial physics of the three. That is uncomfortable and it is the most important single finding in this section.

**Weddings win on error containment, and that is not a small thing.** Lume's most expensive and least copyable asset is the machinery that prevents a confident wrong write. That machinery is worth most where a confident wrong write is catastrophic. In weddings there is an immovable date and no second attempt: a supplier wrongly recorded as booked is discovered in front of a hundred and twenty guests. In coaching, a mis-remembered fact is an awkward moment. In project management it is a bad status report. **The domain where Lume's hardest-won capability is worth the most is weddings**, and that is a stronger argument for the pivot than anything in the market research.

**Coaching wins on retention and privacy is why it might still lose.** A coach's client relationship is open-ended — often years — which removes the engagement-end churn cliff entirely and produces materially better lifetime value. Coaches also bill at rates that make €39 trivial. But coaching notes carry health, employment and relationship content of a sensitivity that dwarfs anything in wedding planning, sometimes under quasi-therapeutic confidentiality expectations. Building an AI product that ingests those conversations is a substantially heavier compliance and trust proposition, and the objection "I am not putting my clients' sessions into someone's AI" is much harder to answer than the same objection about a florist's deposit deadline.

**All three are the same product with different nouns.** That is either the strongest strategic asset available — one engine, three markets, sequential entry — or the trap that prevents ever going deep enough to win any of them. Given a solo or very small team, it is a trap. The correct response is to pick one, go deep enough to be unarguably the best product in that niche, and treat the transferability as an option to be exercised later rather than a plan.

## Y.3 Recommendation

**Weddings, conditionally, and for a reason that is not the market research.**

The market case for weddings is only moderate: the pain is real but not screaming, the evidence is thinner than it appears, the category is crowded, and the incumbent has already shipped the visible half of the wedge. On market evidence alone, weddings and coaching are close to a tie and neither is compelling.

The case that breaks the tie is the fit between the domain and the specific thing Lume has already built. Lume's real asset is not capture and not AI — it is a fail-closed apply boundary, identity discipline, supersession, evidence and a harness that measures containment. Weddings is the domain where those are worth the most, because it is the domain where being confidently wrong costs the most. Coaching would use maybe half that machinery.

**The condition is Section X.** The validation experiment must run first and its failure thresholds must be honoured. And within weddings, the UK and Ireland market is the recommended entry, because the incumbent's equivalent feature is not available there and the vocabulary gap is a real, current, verifiable opening rather than a hypothesised one.

---

# Z. Questions Part 2 must resolve technically

Ordered by how much they could change the plan.

## Z.1 Feasibility of the core claim

1. **Can extraction achieve acceptable accuracy on real wedding language?** Build a wedding corpus in the shape of `src/lib/eval-capture-v2/corpus.ts` — real messy planner dictation and pasted WhatsApp threads, not written examples — and measure with the existing three-way taxonomy of model failure, containment catch and containment failure. **The pass bar must be zero containment failures on state upgrades**, because that is the catastrophic class in Section P. Everything else is negotiable.
2. **Does the reconciliation actually work across a long sequence?** The existing eval measures single captures. Weddings need a longitudinal harness: thirty to fifty sequential captures against one wedding, checking that a fact recorded in month one is still correct in month nine, that supersession fires when it should, and — the harder half — that it does *not* fire when a later capture is simply silent about something still true. Lume's durable-knowledge rule is stated in its constitution and, as far as I can tell, is not tested longitudinally anywhere.
3. **Can the review queue be kept short enough?** Measure the number of review items produced by a realistic ten-minute call. If a typical capture produces more than three or four things needing a decision, the loop dies regardless of accuracy. This is a product-viability measurement disguised as a technical one and it should be run early.
4. **Is `needs_you` frequency tolerable for the identity rules?** The exact-name gate is right for safety and may be intolerable in a domain where planners habitually say "Laura's mum", "the venue", "the florist" and first names only. Quantify how often it fires on real transcripts, and design the intermediate mechanisms — role-based aliases ("mother of the bride" bound once, then resolvable), supplier-category resolution, and remembered clarifications so the same question is never asked twice.

## Z.2 Architecture and refit

5. **Which pipeline does the wedding product start from?** Capture V2 is the only path with server-authoritative truth and the containment boundary, and it is behind a flag with the legacy pipeline as the default. Part 2 should determine whether the wedding product forks from V2 with legacy deleted, and what that removes from the inherited test coverage.
6. **Fork, extract or rebuild?** Three options with very different costs: fork the repository and rename; extract the capture/apply/truth engine into a shared package with two domain configurations; or rebuild the wedding product reusing patterns but not code. The brief explicitly warns against premature shared-platform infrastructure, so the shared-package option should be treated with suspicion despite its elegance. Part 2 should cost all three honestly, including the cost of maintaining two products.
7. **What is the true cost of extending the legal-operation set?** The apply boundary encodes thirteen typed operations and a fixed domain enum. Weddings need booking-state transitions, decision-state transitions and guest-count updates. Each needs the same class of containment test the existing operations have. Count the work precisely — this, not the schema, is the refit's centre of gravity.
8. **Should structured output move to JSON Schema or tool calling?** Extraction currently uses JSON mode plus a prose schema hint, with no Zod anywhere. Adding wedding state machines increases the cost of malformed output. Assess whether strict structured outputs reduce the containment burden or merely relocate it.
9. **How is a supplier identified across weddings?** The cross-wedding supplier entity is new and it reintroduces exactly the fuzzy-matching problem the codebase has deliberately avoided. Determine whether suppliers are workspace-global with explicit user-confirmed linking, or per-wedding with an optional link. Do not let fuzzy matching in through this door.
10. **How does change history become a lineage?** History events today are a log, are not reliably linked to their source capture, and often do not persist (D-004). "What changed and why" is a headline capability. Specify the change record as a first-class write at apply time, carrying previous value, new value, source capture and evidence quote.

## Z.3 Net-new subsystems

11. **Reminders and scheduling.** Genuinely absent — no scheduler, no cron, no notification table, no email or push. The prep-before-a-call prompt that Section I identifies as the habit-forming mechanism depends on this. Specify the smallest version: a scheduled job, an email channel, and a rule for what is worth interrupting someone about.
12. **Offline capture queue.** Required V1 per Section M. Specify local persistence, retry, conflict handling on late upload, and the visible pending state.
13. **WhatsApp paste handling.** Specify parsing of multi-speaker timestamped chat exports and how the extraction prompt should treat speaker attribution — because "she'll do the flowers" said by the couple and said by the florist mean different things.
14. **Catch Me Up.** Does not exist in any form. Determine whether it is a deterministic assembly over maintained truth, a model call over a compressed snapshot, or a hybrid; and how "since when" is computed. `project_intelligence_snapshots` is the natural foundation.

## Z.4 Operational and commercial

15. **Cost per active planner at realistic volumes.** Section R estimates under €3 per user per month. Verify against the real corpus, including the long-transcript worst case and the cost of the longitudinal eval itself.
16. **Model choice and provider risk.** The checked-in scorer-v3 replay shows meaningfully different containment behaviour between models — zero containment failures for gpt-4o-mini and claude-sonnet-4-5, two for gpt-4.1-mini. Determine which model the wedding corpus requires, and whether provider portability is worth the abstraction cost.
17. **Data residency for UK/Ireland.** If UK/Ireland is the entry market, determine what is required and what is merely reassuring, for both Supabase and the model provider.
18. **Billing plan catalogue.** The billing foundation supports one Stripe price and has no plan table. Specify what the single-plan-plus-annual model needs, plus the active-wedding limit mechanism.
19. **What of the 26 open discoveries must be fixed before a paying wedding customer?** At minimum the optimistic-write and soft-failure gaps (D-005) and the memory-only suggestion state (D-003) — a planner who approves a change, reloads, and finds it gone will not return. Triage the full list against a wedding launch bar.

## Z.5 The question that should be asked first

20. **Is there any cheaper way to test the reconciliation claim than building it?** Section X proposes a concierge backend behind a real demo. Part 2 should determine the minimum engineering that makes that demo genuinely real — because if the interactive reconciliation demo can be built from the existing Capture V2 pipeline in a fortnight with a renamed domain and no persistence, then the validation experiment and the first increment of the product are the same piece of work, and the sequencing problem in this entire investigation dissolves.
