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

**The single fact most likely to change this rating** is whether planners who have used HoneyBook's AI Notetaker for a season report that it solved the problem or merely relocated it. That is answerable cheaply and should be answered before anything is built.

---
