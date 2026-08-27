# Coaching Product Investigation — Part 2

## Architecture, Shared-Core Strategy, Code Reuse, Testing and Final Decision

| | |
| --- | --- |
| **Status** | Investigation report. Read-only. Companion to Part 1. |
| **Date** | 27 August 2026 |
| **Part 1 report** | [`docs/coaching-investigation/PART1_MARKET_PRODUCT_AND_DOMAIN_FIT.md`](./PART1_MARKET_PRODUCT_AND_DOMAIN_FIT.md) |
| **Branch inspected** | `cursor/coaching-product-investigation-part1-0f4e` |
| **HEAD at time of Part 2** | `2c9966fa320f9ca9240cf9a63d7e762c563cc14a` |
| **`main` / `origin/main`** | `e5cd9ba8e183f7a42f8f5c74aef73c3c7d73d54f` |
| **Repository changes since Part 1** | **None.** `git log e5cd9ba..origin/main` is empty. The only commits on this branch are the five Part 1 documentation commits. Every Part 1 code finding still holds. |
| **Production changes made** | **None.** No code, no schema, no migrations, no refactors, no abstractions. |

---

## Contents

- [A. Technical executive verdict](#a-technical-executive-verdict)
- [B. Part 1 assumptions changed by code inspection](#b-part-1-assumptions-changed-by-code-inspection)
- [C. Shared-core reality](#c-shared-core-reality)
- [D. Architecture options](#d-architecture-options)
- [E. Recommended architecture](#e-recommended-architecture)
- [F. Data-model technical mapping](#f-data-model-technical-mapping)
- [G. Capture / AI refit](#g-capture--ai-refit)
- [H. Trust and reliability implications](#h-trust-and-reliability-implications)
- [I. UX-code mapping](#i-ux-code-mapping)
- [J. Onboarding implementation](#j-onboarding-implementation)
- [K. Feature deletion](#k-feature-deletion)
- [L. Test migration](#l-test-migration)
- [M. Privacy and security cost](#m-privacy-and-security-cost)
- [N. Billing and product separation](#n-billing-and-product-separation)
- [O. Repository change map](#o-repository-change-map)
- [P. Refit estimate](#p-refit-estimate)
- [Q. Suggested implementation slices](#q-suggested-implementation-slices)
- [R. Revised commercial viability](#r-revised-commercial-viability)
- [S. Final recommendation](#s-final-recommendation)
- [T. Exact next investigation or build step](#t-exact-next-investigation-or-build-step)

---

## A. Technical executive verdict

**The reuse is real, but it is concentrated in the parts of the product a customer never sees, and it is unavailable right now for a reason that has nothing to do with coaching.**

Three findings drive Part 2.

**First, Lume saves roughly 35–45% of the effort of building the Part 1 product from scratch — not the 70–80% the phrase "unfair head start" implies.** The savings are almost entirely in platform (auth, tenancy, RLS, billing scaffolding, deployment) and in *design* — the trust architecture, the observation/disposition extraction contract, the fail-closed apply dispatcher, and the three-way failure taxonomy. The 55–65% that must be built new is the client picture, session prep, the coaching ontology, onboarding, export, and every screen the coach actually touches. A customer comparing this to CoachRocks at $25 experiences only the new 55–65%.

**Second, the codebase is mid-convergence, and that is the decisive technical argument against acting now.** Lume currently runs **two Capture engines** behind `LUME_CAPTURE_V2` (default off — the legacy OpenAI findings path is live), **two Ask assemblers** behind `LUME_CANONICAL_TRUTH`, **two New Project extractors** behind `LUME_NEW_PROJECT_V2`, and carries roughly thirty-five open discoveries, several of which are load-bearing for a coaching product specifically (`D-004` history not persisted, `D-005` silent save failures, `D-003` dismissed suggestions resurrecting). Part C of the architecture handoff commits to deleting the legacy halves. **Forking or extracting today means duplicating a system whose primitives are actively being consolidated, and then maintaining both halves of every dual path in two products.** Every convergence item completed makes a future fork materially cheaper. This is not a reason to build later; it is a reason not to build now.

**Third, the one thing that would most differentiate the product does not exist in the data model.** Part 1's central demo — click a statement, see the sentence that produced it — requires provenance that reaches the source. Capture writes `provenance: [{ type: "capture", at: <timestamp> }]` with the optional `id` **unset** (`src/lib/capture/apply/persist-execute.ts:191`), no durable fact is foreign-keyed to `capture_sessions`, and `todos`, `risks` and `milestones` have no provenance column at all. This is a modest schema change, but it means the differentiator is new work, not inherited work.

**On the architecture question the brief poses** — minimise backend duplication while keeping the brands separate — the honest answer is that **the sensible amount of sharing here is close to zero, and that is a finding rather than a failure of imagination.** There is no repository or service layer between the UI and the domain: 79 components read a single 2,722-line `MissionProvider` god-context (`src/lib/store.tsx`) exposing ~35 PM-named mutations (`setRiskStatus`, `confirmResponsibilityOwner`, `cloneRelOps`). The durable schema encodes PM semantics in `CHECK` constraints. The apply dispatcher's legality table is a hard-coded switch over PM entity kinds. There is no seam to share along that does not first have to be invented — and inventing it is precisely what Lume's own constitution prohibits, listing "Generic Truth Engine", "Entity-Everything table" and "permanent dual truth projections" under *explicitly do not build*.

**Recommendation: PARK.** Not reject — the engineering assets are real and the domain fit is genuine. But Part 1 found the market occupied with a $25 price floor and two venture-funded corpses, and Part 2 finds the refit larger than hoped, the platform mid-refactor, and the marquee differentiator absent from the schema. Those compound rather than offset.

Two cheap exceptions survive the park, and both are in section T: the **two-hour, zero-cost competitor test** from Part 1 §W0, and — if that surprises — a focused audit of the **integration variant** (be the memory layer for CoachAccountable and Paperbell), which requires almost none of the architecture assessed here and is therefore a genuinely different technical proposition.

---

## B. Part 1 assumptions changed by code inspection

Part 1 was treated as input, not truth. Six of its claims moved.

| # | Part 1 claim | Code evidence | Effect |
| --- | --- | --- | --- |
| 1 | "The persistence layer does not transfer, but the AI/trust layer does" | Half right. The trust *architecture* transfers as design. The trust *code* is more PM-bound than Part 1 implied: `classifyCaptureLegalDomain` (`src/lib/capture/apply/classify.ts:98`) is a hard-coded switch over PM `SuggestionKind`, and `CaptureLegalDomain` is a closed PM union | Reuse estimate lowered; see P |
| 2 | "`src/ai/domain` is a domain abstraction — write a `coaching-domain.md` and measure" (Y5) | **Capture V2 does not use it.** `src/lib/capture-v2/prompt.ts` builds its own 46-line prompt; the domain assembler and `project-domain.md` serve the *legacy* path only, and V2 builds the legacy assembly solely for cockpit metrics | The cheapest proposed experiment tests the engine being retired. Corrected in G |
| 3 | Knowledge sections would need redesign for coaching | **Better than assumed.** `KnowledgeSectionId = now \| decisions \| risks \| people \| openLoops` (`src/lib/types.ts:232`) maps almost 1:1 onto the Part 1 frames: *where they are now*, *decisions*, *watching*, *people*, *unresolved threads*. Five for five | Small upgrade to reuse; see F |
| 4 | "Project ≠ Client" is a product argument | It is also a **hard schema argument**. `projects.status text not null default 'healthy' check (status in ('healthy','watch','at_risk'))` with an index on `(workspace_id, status)` (migration lines 125–126, 143). Reusing `projects` as the Client container puts a **NOT NULL health status on every human being**, which is the exact thing Part 1 §K bans | Argument strengthened and made concrete; see F1 |
| 5 | Meeting Prep is "partially implemented" | Weaker than that. `updateMeeting` in `store.tsx` mutates local state only; there are **no `.from("meetings")` writes anywhere outside the loader**. Prep edits are lost on reload | Session Prep is 100% new; see I |
| 6 | The eval harness is "the crown jewel" and transfers | Provisionally upheld, and the strongest single asset — but its *corpus* is entirely PM (Candyland, Toyworld, GamingStudio5000, Meridian, Northline) and Part 1 already flagged that coaching worlds are the highest-value early work. See L for the machinery/content split |

**One Part 1 claim that code inspection strengthened rather than weakened.** Part 1 §F2 argued that modelling the client's *world* — named third parties with tracked relationship change — is the one uncontested differentiator. `buildPeopleRows` (`src/lib/knowledge-centre/ocean-frames.ts:97`) already renders exactly that shape: `@Name · scope` cards with shared-ownership and unconfirmed-owner epistemic markers, backed by `getPersonBundle` returning current and historical responsibilities plus shared scopes. Translating *"@Ava Chen · UX design sign-off"* to *"@Martin Reeves · her skip-level, owns the promotion decision"* is a labelling change over working logic. This is the single closest fit between Lume and coaching anywhere in the codebase.

**Nothing in Part 1's market analysis was contradicted by code**, and Part 2 did not re-run it. The one market correction worth carrying forward is Part 1's own: the verdict there is WEAK OPPORTUNITY, driven by six shipping competitors and a $25 floor, and nothing in the codebase changes that.

---

## C. Shared-core reality

Each candidate primitive classified as: **SAFE SHARED CORE NOW** · **COULD BE SHARED WITH SMALL DISCIPLINED EXTRACTION** · **CONCEPTUALLY SHARED BUT ACTUALLY PM-SPECIFIC** · **SHOULD REMAIN SEPARATE**.

| Primitive | Classification | Evidence |
| --- | --- | --- |
| **Auth / account ownership** | **Could be shared with small extraction** — but see the note below | `src/app/api/auth/**` (7 routes), `src/lib/supabase/{server,client}.ts`, `src/proxy.ts`, `src/lib/auth-mode.ts`. Genuinely generic: Supabase SSR cookie session, `getUser()` for authorisation, password reset, callback exchange. ~600 LOC of near-boilerplate |
| **Tenancy / RLS** | **Could be shared with small extraction** | `workspaces` / `workspace_members` / `profiles`, `is_workspace_member()` with `row_security = off` to avoid recursion under FORCE RLS, `handle_new_user`, `ensure_personal_workspace`. This is a well-made multi-tenant scaffold and it is domain-free |
| **Subscription / billing** | **Could be shared with small extraction** | `src/lib/billing/**`, `src/app/api/billing/**`, `20260813140000_billing_foundation.sql`. Generic Stripe customer/subscription/event pattern. Caveat in N: `subscriptions.workspace_id` is UNIQUE, so one workspace cannot hold two products |
| **AI gateway** | **Conceptually shared but not worth sharing** | There is no gateway. `src/lib/openai.ts` is 434 lines of raw `fetch` to two OpenAI endpoints with a `provider: "local"` fallback. Copying one file is cheaper than depending on a package. The *multi-provider* `ProviderAdapter` exists only in `src/lib/eval-capture-v2/adapters/**` — measurement, not routing |
| **Structured extraction — the contract** | **Safe shared core now, as a type shape** | `CaptureObservationV2` (`src/lib/capture-v2/types.ts:34`) is parameterised by string unions and is otherwise domain-neutral: `statement`, `evidence`, `domain`, `disposition`, `candidateTargetId`, `proposedValues`, informational `modelConfidence`. The *shape* is the reusable idea |
| **Structured extraction — the implementation** | **PM-specific** | `OBSERVATION_DOMAINS` is a closed PM union; the V2 prompt (`capture-v2/prompt.ts`) is PM prose; `resolve.ts` (385 LOC) branches on PM domains |
| **Review / approval** | **Conceptually shared, implementation PM-specific** | The *rule* (nothing becomes truth before a reviewed submission) is architecture-defining and free to copy. The code — `buildReviewChangeViewModels`, `SuggestionKind`, `CorrectionActions.tsx` (375 LOC) — is built around PM entity kinds |
| **Ambiguity handling** | **Safe shared core as a pattern; PM-specific as code** | `ObservationDisposition` includes `ambiguous`; `CaptureApplyDecision.kind = "needs_you"`; `ReviewReason` enumerates `TARGET_UNCERTAIN`, `OWNERSHIP_UNCERTAIN`, `PROJECT_UNCERTAIN`. The taxonomy transfers; `OWNERSHIP_UNCERTAIN` is PM |
| **Identity / entity resolution** | **Could be shared — the highest-value extraction candidate** | `personLinkedIdentityGate` and `recordedPersonNameAppearsInText` in `src/lib/people/identity.ts` and `capture-v2/resolve.ts:292-345`. The rules — *a name is not identity*, *a model-supplied UUID is not proof*, *fail closed on zero or multiple matches*, *never fuzzy-merge* — are domain-independent and hard-won |
| **Evidence / source records** | **Should remain separate — and is currently inadequate for coaching** | `ProvenanceEntry` type is generic, but writes omit the `id`, and `todos`/`risks`/`milestones` have no provenance column. Needs a different design for coaching, not a shared one |
| **Persistence** | **PM-specific** | `persist-mutations.ts` (1,098 LOC) is a flat file of `persistTodoUpdate`, `persistRiskStatus`, `persistEnsureStakeholder`, `persistTimelineItem`. Excellent per-function discipline (workspace + project scoping via `scopeExistingTodo`), zero domain neutrality |
| **History / change intelligence** | **Conceptually shared but currently too thin to share** | `history_events` has a closed 16-value type enum (`task_added`, `milestone_changed`, `nudge_chased`…), is capped at 500 in memory, insert-only, with no "since timestamp X" query. Coaching needs a richer change model, not this one |
| **Q&A retrieval** | **PM-specific implementation, reusable architecture** | `src/lib/tell-me/**` (~2,754 LOC across 15 files) is genuinely good: server-loaded truth, no client state accepted, no vectors, citation via `sourceIds`, `not_found` yields empty sources. But `serializeCanonicalTruth` emits PM sections and `questionLooksOwnership` / `questionLooksHistorical` are PM heuristics |
| **Catch Me Up generation** | **Does not exist** | Zero hits repo-wide for `Catch Me Up`, `catch-me-up`, `catchMeUp`, `catch_me_up`. Nothing to share |
| **UI primitives** | **Should remain separate** | There is no primitive library — no shadcn, no MUI, no shared `Button`/`Input`/`Modal` package. Every input is bespoke Tailwind. There is nothing extractable that would not first have to be created |
| **Testing utilities** | **Safe shared core now — the best candidate in the table** | `scripts/run-regression-suite.ts` (credential-stripping runner), the `knownGap()` convention, the provider adapters, the run/cost/serialisation machinery in `eval-capture-v2`, and above all `classifyLumeSafety` |

### C1. The two genuinely shareable things, and why neither justifies a package

**The failure taxonomy.** MODEL FAILURE / LUME CATCH / LUME FAILURE, documented in `docs/TEST_DASHBOARD.md`: *"A caught model mistake is not the same as Lume corrupting truth. Do not collapse them into one fail score."* This is a genuine intellectual asset and it is domain-independent. It is also **an idea plus a few hundred lines**, and ideas do not need npm packages.

**The identity discipline.** *A name is not identity; a model-supplied UUID is not proof; fail closed on ambiguity; never fuzzy-merge.* Also an idea, also small, also directly transferable, and — per Part 1 §O — the invariant on which the coaching product's existence depends.

Both are best transferred as **copied code plus a written rule**, not as a dependency. That conclusion is the core of section D.

### C2. What the constitution says about all of this

Worth quoting, because it settles the argument from the repository's own authority. `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` Part C §C13, *Explicitly do not build*:

> Generic Truth Engine; Hygiene Engine; reconciliation daemon; event-sourced rewrite; second persistence layer; Entity-Everything table; unique-name-as-identity constraint; giant AI orchestration; **permanent dual Capture engines; permanent dual truth projections**; app-wide command bus; Redux/Zustand; vector infrastructure; …

And §C10 rejects "Generic Truth Engine / Hygiene Engine / reconciliation daemon" outright while accepting only changes that "solve several concrete V1 problems more simply than what exists."

A shared coaching/PM core is a Generic Truth Engine with a different name. The constitution anticipated this exact temptation.

---

## D. Architecture options

Evaluated against the brief's criteria. Scores are 1 (poor) to 5 (good) **for this specific situation** — one founder, 25–200 target customers, a codebase mid-convergence.

| Criterion | 1. Fork | 2. Monorepo + shared packages | 3. One app, product config | 4. Shared backend, separate frontends | 5. Shared services, independent apps |
| --- | --- | --- | --- | --- | --- |
| Development speed (first 6 months) | **5** | 2 | 3 | 2 | 2 |
| Ongoing maintenance | 3 | 3 | **1** | 3 | 3 |
| Regression risk to Lume | **5** | 2 | **1** | 2 | 3 |
| Deployment complexity | **5** | 3 | 4 | 2 | 2 |
| Branding separation | **5** | 4 | **1** | 4 | **5** |
| Authentication | 3 | 4 | 5 | **5** | 4 |
| Billing | 3 | 4 | 4 | **5** | 4 |
| Data isolation | **5** | 3 | **1** | 2 | 3 |
| Schema evolution | **5** | 2 | **1** | **1** | 3 |
| Testing | 4 | 3 | 2 | 3 | 3 |
| Founder cognitive load | **5** | 2 | 2 | 2 | 2 |
| Enables a future third product | 2 | **4** | 3 | **4** | **4** |
| Risk of speculative abstraction | **5** | **1** | 2 | **1** | 2 |
| **Weighted verdict** | **Best** | Premature | Worst | Premature | Premature |

### Option 1 — Complete fork

Copy the repository, delete what coaching does not need, rename, point at a new Supabase project.

**For.** Zero coupling means zero regression risk to Lume, which matters enormously while Lume is mid-convergence with two live dual paths. Schema evolution is free in both directions — coaching can add `sessions` and `clients` and drop `releases` without a migration negotiation. Data isolation is physical, which is the right answer for a product whose catastrophic failure mode is cross-client leakage (Part 1 §O). Cognitive load is one mental model at a time.

**Against.** Bug fixes in genuinely shared code — an auth edge case, an RLS policy, a Stripe webhook — must be applied twice. Quantified honestly: the genuinely-shared surface is roughly **1,500–2,500 lines** across auth routes, Supabase clients, the proxy gate, billing, and the tenancy migration. A duplicated bug fix in that surface is minutes, a handful of times a year.

### Option 2 — Monorepo with shared packages

**Against, decisively.** There is nothing to package yet. Extracting `@lume/auth`, `@lume/billing`, `@lume/extraction` requires first *creating* the seams, and the two consumers you would design them against are one real product and one hypothetical. That is the classic premature-abstraction failure, and with two consumers you will guess the boundary wrong. Worse, extraction during convergence means freezing the convergence: you cannot cleanly package a Capture engine that exists in two flagged versions scheduled for one to be deleted.

Revisit under the rule of three: a third product, plus two of three needing the same primitive, plus that primitive stable for six months.

### Option 3 — One application with product configuration

**The worst option, and it should be named as such.** It scores 1 on regression risk, data isolation, schema evolution and branding. Concretely: every one of the 79 components would acquire a product conditional; `MissionState` would have to carry both ontologies; the `projects` table would need `status` to be nullable-or-meaningless for clients; the apply dispatcher's legality table would branch by product; and one bad RLS predicate would leak a coach's client notes into a PM's workspace. Part 1's catastrophic failure is cross-client contamination — this architecture makes cross-*product* contamination possible too.

### Option 4 — Shared backend/core with separate frontends

**Premature, and blocked by a specific structural fact.** There is no backend to share. The API surface is thin (auth, billing, capture, tell-me, transcribe, workspace state) and the actual domain logic lives in `src/lib/store.tsx` — a 2,722-line client-side React context with ~35 PM-named mutations that all 79 components consume via `useMission()`. A "shared backend" would have to be written from scratch first, and the server-authoritative migration that would make it possible is itself an open convergence item (`D-033`, partially done: Tell Me and Capture V2 migrated; Coach and legacy Capture still accept browser-posted `MissionState`).

### Option 5 — Shared services, independent apps

**Premature for the same reason as 2 and 4, with added ops.** Two apps calling a shared extraction service means designing a service contract for a domain you have not validated. It also adds a network hop, a deployment, and an availability dependency to a product with 25 customers.

### Option 6 — The one the repository actually supports: **fork with a declared sync list**

Fork, and additionally maintain a short, explicit, written list of files that are *known duplicates* and must be diffed when either side changes. Not a package — a list, in a markdown file, with a checklist. Roughly: the seven auth routes, the two Supabase client factories, `proxy.ts`, `ai-gate.ts`, `rate-limit.ts`, the billing lib and routes, the tenancy migration, and `run-regression-suite.ts`.

This captures the entire genuine reuse without inventing a single abstraction. It costs one document and occasional discipline, and it degrades gracefully — if the two products diverge, the list simply gets shorter, which is the correct outcome rather than a maintenance crisis.

---

## E. Recommended architecture

> **Fork the repository. Separate Supabase project. Separate Vercel project. Separate Stripe product. Share nothing as code; share a written sync list of roughly 1,500–2,500 lines of genuinely generic files. Create no packages, no monorepo, no product flags, no shared services.**

### E1. The five decisions

**Fork, not extract.** The reuse is real but it is *design* reuse and *pattern* reuse, and both are free. The code reuse is small enough that duplicating it costs less than the abstraction that would avoid duplicating it. This is the rule-of-three applied honestly at n=2.

**Separate Supabase project, not a shared one with product-scoped rows.** This is the most important decision in the section. A coach's notes about a named executive and named third parties must be physically incapable of appearing in a PM's workspace. Shared-project isolation would rest on RLS predicates and application `projectId` filters — and the architecture handoff already warns that *"workspace RLS is not a per-project ACL — application code must keep `projectId` filters"* (dangerous assumption #22), with `D-035` recording that the mutation-scoping class is not fully audited. Betting a confidentiality product on that is wrong. Separate projects also make data residency, deletion proofs and the DPA answerable independently, which Part 1 §P identified as a selling point.

Cost: roughly €25–€50/month and two dashboards.

**Copy the generic files verbatim and record them.** Do not improve them on the way across. Divergence is acceptable and expected; silent divergence is not.

**Do not port the dual paths.** Take only the winning half of each flagged pair — Capture V2, canonical Ask, V2 New Project — and delete the flags in the fork. This is the one place the fork is *better* than Lume: the coaching build starts on the target architecture with no legacy branch, which is worth more than any package would have been.

**Revisit sharing only under the rule of three.** A third product, two of three needing the same primitive, that primitive stable for six months. Write the rule down so the temptation is pre-answered.

### E2. What this looks like concretely

Two repositories. Two Supabase projects. Two Vercel projects. Two Stripe products under one Stripe account. One shared `SYNC.md` in each repo listing duplicated files with the SHA of the version they were copied from. No shared npm packages. No cross-imports. Nothing named "core", "platform", "shared" or "common".

### E3. The honest cost of this recommendation

It forecloses cheap platform economics. If a third and fourth product followed, this would be visibly the wrong structure and would need consolidating. That is a real cost and it should be stated rather than hidden — but it is a cost incurred *after* two products have proven themselves, which is exactly when you would have the evidence to design the abstraction correctly.

---

## F. Data-model technical mapping

### F1. Can `project` remain the internal container while the UI says "Client"?

**Technically yes. Recommended: no.** The semantic debt is concrete and it lands on the one thing Part 1 said must never ship.

```sql
create table public.projects (
  ...
  code text not null,
  status text not null default 'healthy'
    check (status in ('healthy', 'watch', 'at_risk')),
  kind text not null default 'delivery'
    check (kind in ('delivery', 'release_ops')),
  current_focus text not null default '',
  next_milestone text, next_milestone_on date,
  release_month text, merge_on date, release_on date,
  is_template boolean not null default false,
  cloned_from_id uuid references public.projects (id) on delete set null,
  ...
);
create index projects_workspace_status_idx on public.projects (workspace_id, status);
```

Four specific problems:

**Every client would carry a `NOT NULL` health status of `healthy | watch | at_risk`, with an index on it.** Part 1 §K bans status on a person as the single most damaging thing that could survive the port, and §L bans it again in the UI. Here it is not a UI choice — it is a database default that cannot be null. Someone will eventually surface it, because it is indexed and free.

**`code text not null`** is meaningless for a person and would be filled with `''` or a fake, which is exactly the kind of lie that makes a schema unreadable in year two.

**Seven release-operations columns** (`kind`, `release_month`, `merge_on`, `release_on`, `is_template`, `cloned_from_id`, `next_milestone*`) become permanent dead weight that every future developer must ask about.

**It blocks the Client-above-Engagement model** that Part 1 §M1 argues for and that Lume's own Part C §C7 has already decided for people. A returning client needs one identity across two engagements; `projects` has no place to hang that.

Since the recommendation in E is a **fork**, none of this needs to be inherited. The coaching schema should define its own container. Renaming a table you control is free; carrying seven dead columns forever is not.

### F2. Entity-by-entity technical mapping

Classification: **REUSE CURRENT SCHEMA** · **EXTEND** · **NEW TABLE** · **DERIVED / READ-ONLY** · **AVOID**.

| Concept | Verdict | Technical detail |
| --- | --- | --- |
| **Practice / account** | **REUSE** | `workspaces`, `workspace_members`, `profiles`, `is_workspace_member()`, `ensure_personal_workspace`. Copy verbatim |
| **Client** | **NEW TABLE** | `clients (id, workspace_id, display_name, created_at, archived_at)`. Durable identity above engagement. Structurally the table Part C §C7 already specifies as `people` — same reasoning, same constraints, **no unique constraint on name** |
| **Engagement** | **NEW TABLE** (replaces `projects`) | `engagements (id, workspace_id, client_id, started_at, ended_at, cadence, sessions_contracted, archived)`. Everything `projects` has minus `code`, `status`, `kind` and the release columns |
| **Session** | **NEW TABLE, informed by `capture_sessions`** | `capture_sessions` is the right shape and the wrong grain. It has `transcript`, `result`, `suggestions`, `status`, `analysed_at`, but **no session-date column** — only `created_at`, which is when the note was typed, not when the session happened. Coaching needs both, plus a sequence number within the engagement. Also note `project_id` is `on delete set null`, so client deletion would orphan transcripts unless application code compensates (it does today, via `deleteProjectScopedBundle`) — for a confidentiality product this should be `on delete cascade` |
| **Client picture facts** | **REUSE, EXTEND** | `knowledge_items` plus the canonical overlay (`kind`, `epistemic`, `lifecycle`, `supersedes_id`, `meta`, `provenance`) is the single most valuable inherited object. **And the five section IDs already fit**: `now → where they are now`, `decisions → decisions`, `risks → watching`, `people → people`, `openLoops → unresolved threads`. Extend `epistemic` with `reported`; extend `kind` with `goal` and `commitment` if those are not separate tables |
| **People in the client's world** | **REUSE, terminology only** | `stakeholders` is `project_id not null on delete cascade` — strictly scoped, no cross-project identity, no fuzzy merge. Part 1 called that a limitation to fix; for coaching it is a **confidentiality requirement**. Keep it exactly as it is |
| **Relationship facts** | **REUSE** | `knowledge_items` with `kind = responsibility` and `meta.responsibility.personId`. Multi-owner, share-vs-replace and supersession all work. `@Ava Chen · UX sign-off` → `@Martin Reeves · her skip-level` is a label change |
| **Goals** | **NEW TABLE** (or `knowledge_items kind=goal`) | Lume has no goal object. Recommend a table, because goals need their own lifecycle and because burying them in `knowledge_items` makes *"what has she said about the VP role over eight months"* a filtered scan rather than a keyed query. Reuse the `supersedes_id` pattern either way |
| **Commitments** | **EXTEND `todos`** | Existing `todos` gives title, detail, done, due, project scope and workspace scope. Two changes: replace `kind` (`ACTION\|WAITING\|CHASE\|REMINDER`) with an **owner axis** (`client \| coach \| third_party`), and replace `waiting_on text` with a real FK. Part 1 §O ranks misattributed commitment as a top-three failure; a text name is not adequate |
| **Watching / concerns** | **REUSE, terminology only** | `risks` with `status open\|watch\|resolved\|accepted` and the `isOpenRiskStatus`/`isClosedRiskStatus` lifecycle in `src/lib/risks/lifecycle.ts`. Four states map cleanly, *accepted* included |
| **Important dates** | **REUSE, terminology only** | `milestones` (`label`, `type`, `start_on`, `end_on`, `source`). Add a source value distinguishing client-stated from coach-inferred |
| **Decisions** | **REUSE** | `knowledge_items` `section='decisions'` / `kind='decision'` with supersession. Already correct |
| **Evidence / provenance** | **EXTEND — and this is load-bearing** | `ProvenanceEntry` has an optional `id` that Capture never sets. Make it required and point it at the session; add a provenance column to commitments, watch items and dates. Without this, Part 1's differentiating demo does not exist |
| **History / change** | **EXTEND substantially** | `history_events` has a closed 16-value enum, a 500-row memory cap, insert-only writes, and no "since X" query. Coaching needs `what changed since the last session` as a keyed query, not token overlap against event titles |
| **Recurring topics** | **DERIVED / READ-ONLY** | Per Part 1 §N: computed on demand, never persisted, evidence-linked, non-personal. Non-persistence is also the cheapest privacy posture |
| **Raw note archive** | **REUSE** | `memories`. Correct as-is |
| **Suggestions** | **REUSE, but fix `D-003` first** | `recommendations` is the right shape. Accept/dismiss is currently memory-only and resurrects on reload — unacceptable in a product whose promise is that it remembers |
| **Project status / RAG** | **AVOID** | Delete. Do not carry `status` onto a human |
| **Dependencies** | **AVOID** | PM-only, and under-modelled in Lume anyway (`D-020`) |
| **Releases** | **AVOID** | `releases`, `ReleaseStage` (10 values), `CloneRelOpsButton`, `release-playbook.ts` |
| **Meetings** | **AVOID as an entity** | Sessions *are* the meetings. The `meetings` table has no write path anyway |
| **Snapshots** | **AVOID for v1** | `project_intelligence_snapshots` is a derived cache the canonical Ask path already ignores. Do not port a cache before there is a load problem |

### F3. Net schema delta

Three new tables (`clients`, `engagements`, `sessions`), one probable fourth (`goals`), five reused nearly unchanged (`knowledge_items`, `stakeholders`, `risks`, `milestones`, `memories`), two extended (`todos`, provenance columns), and six dropped (`releases`, `meetings`, `recommendations`' PM fields, `project_intelligence_snapshots`, `coach_sessions`, `workspace_preferences` if unused).

**The encouraging read:** the *epistemically hard* objects — supersession, lifecycle, provenance, scoped relationships, ambiguity as a first-class kind — transfer nearly unchanged, and those are the ones that take a year to get right. **The sobering read:** the new tables are the ones the product is *about*, and the reused ones are the ones the customer never names.

---

## G. Capture / AI refit

### G1. Layer separation, from actual code

| Layer | Location | LOC | Generic? |
| --- | --- | --- | --- |
| **Model transport** | `src/lib/openai.ts`, `capture-v2/extract.ts` | 434 + 92 | **Generic.** Raw fetch, JSON mode, temp 0.2/0.3, no SDK |
| **Extraction contract** | `capture-v2/types.ts` | 91 | **Generic shape, PM vocabulary.** Unions are the only PM part |
| **Prompt** | `capture-v2/prompt.ts` | 46 | **PM.** Rewrite entirely |
| **Validation** | `capture-v2/validate.ts` | 265 | **~80% generic.** Malformed envelope, unknown domain/disposition, missing evidence/statement, **foreign_id**, **cross_project_id**. Only the domain enum is PM |
| **Resolution** | `capture-v2/resolve.ts` | 385 | **~50%.** Disposition→decision mapping is generic; the person identity gate is generic *and the most valuable part*; PM domain branches are not |
| **Review view models** | `capture/review/**`, `suggestions.ts` | ~900 | **PM.** `SuggestionKind` is a closed 10-value PM union |
| **Legality classification** | `capture/apply/classify.ts` | 137 | **Pattern generic, table PM.** See below |
| **Apply dispatcher** | `capture/apply/dispatch.ts` | 788 | **~30%.** Structure and fail-closed discipline transfer; every branch is PM |
| **Persistence execution** | `apply/persist-execute.ts`, `memory-execute.ts` | 460 | **PM** |
| **Safety invariants** | `apply/project-scope.ts`, `expected-target.ts` | 248 | **Generic in principle** — scope proof and stale-fingerprint checks |

`classify.ts` is the clearest illustration of the whole refit. The *discipline* is excellent and domain-free:

```ts
// Mapping already failed closed. Refinements must not reopen a write.
if (item.legalDomain === "unsupported") return "unsupported";
...
// A sticker must not retarget an incompatible kind (e.g. Risk → Todo).
return "unsupported";
```

The *content* is a hard-coded PM table:

```ts
function kindToDomain(kind: SuggestionKind): CaptureLegalDomain {
  switch (kind) {
    case "action": case "nudge": return "todo";
    case "risk":        return "risk";
    case "milestone":   return "milestone";
    case "stakeholder": return "person";
    ...
```

You keep the rules and rewrite the table. That ratio — perhaps 25% of the lines, 90% of the thinking — is the honest summary of the whole Capture refit.

### G2. Which approach?

Three candidates: same engine with domain configuration; separate extraction contract sharing lower-level infrastructure; separate engine.

> **Recommended: separate extraction contract, sharing the *shape* and the *rules* but not the code.**

**Not "same engine with domain configuration."** The semantic domains differ more than they appear. PM extraction resolves *who owns what scope of work* — share-vs-replace ownership, availability windows, dependency chains. Coaching extraction resolves *who said what about whom, and whether it is fact, report, or the coach's own read*. Part 1 §N requires a five-tier epistemic model with attribution preserved through the entire pipeline, and a hard prohibition on psychological inference enforced by a deny-list validator. There is no configuration that turns `ownershipSemantics: share | replace` into `attribution: client-reported`. Forcing configuration here would produce exactly the unreadable conditional the brief warns against.

**Not "separate engine" either**, if that means starting from nothing. The contract shape, the validation envelope, the fail-closed discipline, the identity gate and the disposition taxonomy are all worth copying.

**The practical shape:** copy `types.ts`, `validate.ts` and the identity-gate portion of `resolve.ts`; rewrite the unions, the prompt, the review view models and the dispatcher; keep `project-scope.ts` and `expected-target.ts` nearly as-is with renamed identifiers.

### G3. How Part 1's concepts would be represented

Using the existing observation shape with a coaching vocabulary:

| Part 1 concept | `domain` | `disposition` | Notes |
| --- | --- | --- | --- |
| Goal created | `goal` | `create_new` | |
| Goal changed | `goal` | `update_existing` | Must carry `supersedesId`; the *change* is the object |
| Commitment created | `commitment` | `create_new` | **`proposedValues.owner` is mandatory.** Absent or ambiguous → `ambiguous`, never a default |
| Commitment completed | `commitment` | `update_existing` | Never inferred from silence |
| Important person introduced | `person` | `create_new` | Reuses the existing gate: full name must appear in the text; ambiguity fails closed |
| Date changed | `date` | `update_existing` | Needs relative-date resolution against the **session** date — absent today |
| Explicit decision | `decision` | `create_new` | |
| Relationship / context change | `relationship` | `update_existing` | **Requires the new `reported` epistemic**; must never flatten to an assertion about the third party |
| Coach's own interpretation | `interpretation` | `create_new` | Only when the coach wrote it; hedges preserved verbatim |
| Psychological inference | — | — | **Not a domain.** Must be impossible to express, and blocked by validator |

Two observations. The disposition vocabulary (`update_existing`, `create_new`, `no_change`, `ambiguous`, `merge`, `commentary`, `ignore`) transfers **unchanged** — it is genuinely domain-independent and is the best-designed thing in the pipeline. And the domain union needs one structural addition the PM version does not have: **attribution**, because `relationship` and `interpretation` observations are meaningless without knowing who is asserting them.

### G4. How much deterministic reliability survives?

**The invariants survive; the tests that prove them do not.**

Surviving as directly reusable logic: project-scope proof (`project-scope.ts`), stale-write detection via analyse-time fingerprint (`expected-target.ts`), foreign-ID and cross-project-ID rejection, the person identity gate, and the fail-closed default on unknown operations.

Not surviving: every PM branch of the dispatcher, the `SuggestionKind`↔`CaptureLegalDomain` table, share-vs-replace ownership gating, availability handling, and the entire eval corpus.

**The measured reliability does not transfer at all**, because it was measured on PM worlds. Part 1 §Y1 set the gate: zero LUME FAILURE on cross-client and identity-ambiguity cases, under 2% elsewhere. The published dashboard shows 5–16 LUME FAILURES per model on 21 PM cases under scorer v1. Coaching would start with **no measurement**, and building the coaching corpus (§L) is therefore the first engineering task, not a later one.

### G5. Correction to Part 1 question Y5

Part 1 proposed writing a `coaching-domain.md` as the cheapest de-risking experiment. **Capture V2 does not use the domain assembler.** `src/lib/capture-v2/prompt.ts` builds its own prompt; `project-domain.md`, the dictionary and `assemblePrompt` serve the *legacy* path, and V2 constructs the legacy assembly only for cockpit metrics. The equivalent experiment is to rewrite the 46-line V2 prompt with a coaching ontology and run it against hand-written coaching notes — still cheap, still worth doing, but it is a prompt rewrite rather than a configuration change, and it does not validate a reusable abstraction because no such abstraction is in the live path.

---

## H. Trust and reliability implications

### H1. Can the existing model express Part 1's five tiers?

| Tier | Supported today? | Gap |
| --- | --- | --- |
| **Explicit fact** | **Yes** | `epistemic: confirmed`, `lifecycle: current`, provenance |
| **Explicit commitment** | **Partly** | `todos` exists; **owner is a text name, not a typed FK**. Owner-ambiguity must become a blocking `needs_you` |
| **Reported context** | **No** | The `epistemic` enum (`confirmed \| pending \| informal \| suggested \| inferred \| conflicting \| unknown \| legacy`) has no value meaning *"X says Y about Z"*. `informal` is the nearest and it means something else. **Needs a new value and a reporter reference** |
| **Coach interpretation** | **Partly** | `epistemic: inferred` exists but does not distinguish *the coach inferred* from *the AI inferred* — which is the whole point |
| **Psychological inference** | **No mechanism** | Nothing prevents it. `src/ai/domain/audits/**` is static reporting (`ai-readiness.ts`, `status-consistency.ts`), not a runtime validator |

**Two enum values and a deny-list validator** is the honest size of the epistemic work. That is small. What is *not* small is proving that attribution survives the whole pipeline — extraction, validation, resolution, storage, `serializeCanonicalTruth`, prompt assembly, answer rendering, and the client picture. If it can be dropped anywhere in that chain, the product will eventually state as fact that Martin is unsupportive. That needs an end-to-end property test, not a unit test.

### H2. The five named risks, mapped to code

**Cross-client leakage — the existential one.** Best-covered risk in the codebase, and still not closed. The invariant exists as `D-035`: *every project-domain mutation must verify that the target durable object belongs to the intended project*. `scopeExistingTodo` in `persist-mutations.ts:665` implements it for todos (`.eq("id", …).eq("workspace_id", …).eq("project_id", …)`), covered by `scripts/verify-d035-project-isolation.ts`. Capture V2 rejects foreign and cross-project IDs at validation. **But `D-035` is explicitly recorded as a class, not an instance** — the broader persist-helper audit is open. For coaching this must be closed exhaustively before a paying customer exists, and the fork should add a client-scope predicate at the *serialisation* boundary as well as the mutation boundary, so a retrieval bug cannot leak what a mutation bug cannot write.

**Stale evidence.** Well handled. `lifecycle: current | superseded | historical`, `supersedes_id`, and current-mode Ask excluding non-current items. Directly reusable.

**Contradictions.** The philosophy is right (*surface, never silently pick a winner*) and `epistemic: conflicting` plus `kind: ambiguity` exist. Reusable.

**Wrong-client attribution.** Partly covered by the person identity gate, which is genuinely good. **Currently failing in evaluation**: the dashboard records `ambiguous-same-first-name → write — Must not silently CREATE another Brick` as a LUME FAILURE. Must be closed.

**Historical vs current truth.** The lifecycle model handles it; `history_events` does not — no "since X" query, 500-row cap, insert-only, closed enum.

### H3. What would need significant architecture change

Only two things, and both are additive rather than structural.

**Attribution as a first-class field**, flowing end to end, with a test that proves it cannot be lost. Additive to the schema, invasive across the pipeline.

**A runtime output validator** for prohibited inference. Nothing like this exists today — the `audits` directory is static analysis. A deny-list over trait, clinical and mental-state vocabulary applied to every generated statement about any named person, with build-failing test cases, is new but small.

Everything else in Part 1's trust model is already expressible.

---

## I. UX-code mapping

**80 components, 17,254 lines**, plus 5,035 lines of routes and an 8,793-line `globals.css`. Every component is `"use client"` except two (`DashboardChrome.tsx`, `brand/LumeLogo.tsx`).

### I0. Quantified coupling

Every component classified, one class each:

| Class | Files | LOC | % of component LOC | Meaning for a fork |
| --- | ---: | ---: | ---: | --- |
| **DOMAIN-COUPLED** | 21 | 9,510 | **55.1%** | Business logic must be rewritten, not relabelled |
| **GENERIC** | 25 | 2,626 | 15.2% | Portable essentially as-is |
| **DEAD / LEGACY** | 10 | 2,588 | **15.0%** | Delete before porting — see I0b |
| **DOMAIN-LABELLED** | 13 | 1,385 | 8.0% | Renaming only; strings and icon maps |
| **CHROME** | 11 | 1,145 | 6.6% | Portable structure, product copy baked in |
| **Total** | **80** | **17,254** | 100% | |

> **The realistic reuse envelope for the frontend is ~30%** — GENERIC plus CHROME, 3,771 lines across 36 files. Add the 8% DOMAIN-LABELLED as near-free and it reaches ~38%. The remaining 55% is rewrite.

This is close to the section P estimate arrived at independently, and slightly better: the review-card layer turned out to be more genuinely generic than assumed.

### I0a. Four findings that sharpen the picture

**Navigation is hard-coded JSX, not configuration.** `Sidebar.tsx` has no `NAV_ITEMS` array and no config file — Master To Do, History, Captures, Evals, Account and Help are individually written `<Link>` blocks each with its own glyph, label and `data-testid` (lines 114–221). `AppShell.tsx` derives page titles from a chain of `pathname.startsWith(...)` checks (lines 141–211) rather than a route→title map. **A different product cannot swap the nav by supplying data; it must edit both files.** This is the most invasive thing to genericise and the clearest argument that "shared frontend shell" is not available.

**Theming is genuinely clean and a third identity is tokens-only.** `[data-theme="dark"]` (Ocean) and `[data-theme="desert"]` are pure CSS custom-property blocks; `applyLumeTheme` sets `document.documentElement.dataset.theme` and `LumeThemePicker` renders a static `OPTIONS` array. No Tailwind config fork, no component forks, and no hard-coded hex found in any `.tsx`. One caveat worth recording: the token blocks are **not co-located** — some variables are defined at the top of `globals.css` and others around line 5690 — so a third theme risks silently missing variables.

**There is no form or input primitive library.** No `Input`, `Select`, `Checkbox` or `TextField` component exists anywhere. Every form element is a bare `<input>`/`<select>`/`<textarea>` with global utility classes. `DashboardChrome` exports layout primitives (`Panel`, `StatTile`, `PageHeader`, `StatusPill`) but nothing for input. This is a genericity gap **independent of domain** — it has to be built for either product, so it is neither a reuse win nor a coaching-specific cost.

**State access is universal and PM-shaped.** `useMission` is imported in 39 files; the `MissionState` type in 74. No component reads an opaque state shape — every consumer either calls `useMission()` or receives already-PM-typed props (`Project`, `TodoItem`, `RiskStatus`, `ProjectKnowledge`). The only state-agnostic components are presentational leaves: `KnowledgeItemCard`, `DetailModal`, `ReviewBadge`, `WhyPanel`, `TargetPicker`, `CaptureSummary`.

### I0b. The dead code has a better architecture than the live code

The most interesting finding in the audit, and a genuinely useful one.

**2,588 lines across 10 files are unreachable from any route** — `ProjectWidgetGrid`, `ProjectKnowledgeBrief`, `CloneRelOpsButton`, `CoachButton` (463 LOC, imported nowhere), `CoachPreview`, `HeaderCoachButton`, `frames/RiskFrame`, `frames/NudgeFrame`, `workspace/WorkspaceGrid`, `workspace/WorkspaceCustomiser`. Part 2 had listed `CoachButton` and `RiskFrame` as live components to remove; they are already dead.

And among that dead code sits the pattern the live code lacks:

```ts
export const frameRegistry: Record<string, ComponentType<FrameProps>> = {
  todo: TodoFrame,
  meetingPrep: MeetingPrepFrame,
  risks: RiskFrame,
  nudge: NudgeFrame,
  timeline: TimelineFrame,
};
```

The pre-Ocean workspace had a **real frame registry** plus `WorkspaceCustomiser`, a generic show/hide/reorder UI over `WorkspaceFrameConfig[]`. That is exactly the architecture a second product would want, and it was replaced by hand-written JSX during the Ocean redesign.

Two consequences. It confirms that frame composition *can* be data-driven in this codebase — this is not a hypothetical refactor, it shipped once. And it means Lume should probably delete this code (it is 15% of the component tree and it decays), while a coaching fork could study the registry pattern before writing its frames. Neither product benefits from leaving it where it is.

Four routes are similarly stranded: `/memory`, `/meetings`, `/meetings/[id]` and `/releases` are live URLs unreachable from the Ocean sidebar.

### I1. Surface-by-surface mapping

| Surface | Existing code | Verdict |
| --- | --- | --- |
| **App shell** | `AppShell.tsx` (273), `app-shell/Sidebar.tsx` (226) | **Reuse with terminology.** Structure is sound |
| **Auth screens** | `src/app/{login,signup,forgot-password,reset-password}`, `components/auth/**` | **Reuse unchanged** |
| **Account / billing** | `src/app/account`, `components/billing/**` | **Reuse with styling** |
| **Client list** | *(none)* — home redirects to the first project | **New.** Part 1 §L2 wants next-session ordering, which has no analogue |
| **Create client** | `onboarding/NewProjectExperience.tsx` (743) + `ProjectSetupReview.tsx` (660) | **Remove; rebuild far smaller.** 1,403 lines of PM project-setup against Part 1's single paste box. The *review* pattern is worth studying, not porting |
| **Current picture** | `OceanKnowledgeFrames.tsx` (443), `ocean-frames.ts` (191) | **Major rewrite — the most invasive surface in the app.** `OCEAN_PRIMARY_FRAMES` / `OCEAN_SECONDARY_FRAMES` are string-literal arrays used for tests and documentation; they are never `.map()`ed to render anything. The real render is eight bespoke `useMemo` blocks (lines 92–213) and a hand-written sequence of `<FrameShell>` JSX (lines 215–434). `FrameShell` and `KnowledgeItemCard` are genuinely generic and survive; everything between them is rewritten |
| **People frame** | `buildPeopleRows` (ocean-frames.ts:97) | **Reuse with terminology — the best single fit in the codebase.** Already renders `@Name · scope` cards with shared/unconfirmed markers from `getPersonBundle` |
| **Session input** | `capture/CaptureWorkspace.tsx` (1,251), `CaptureSessionContext.tsx` (981) | **Substantial refit.** The input half (text, voice, transcription, session lifecycle) is largely reusable; the review half is PM-shaped |
| **Review UI** | `capture/review/**` — `CorrectionActions` (375), `SuggestedChangesList` (200), `CompactChangeCard` (174), `SuggestedChangeCard` (164), `KnowledgeRememberList` (125) | **Better than assumed — split verdict.** The card layer *is* genuinely generic over a `ReviewChangeViewModel` (`{entityKind, entityLabel, recordName, diff, why, actions}`); `ReviewBadge`, `WhyPanel`, `TargetPicker`, `CaptureSummary` and `KnowledgeRememberList` need no changes. Coupling re-enters in exactly three places: the `KIND_ICON`/`KIND_LABEL` maps over 10 PM `SuggestionKind`s, `CorrectionActions`' per-concept branches (ownership share/replace, risk "Resolve" vs generic "Complete", an `ENTITY_CHOICES` dropdown), and `targetOptions` in `CaptureWorkspace` built from `state.todos/risks/stakeholders/timeline/meetings`. **Reuse the shell, rewrite the taxonomy and the correction branches** |
| **Item detail drawer** | `KnowledgeItemDetailDrawer.tsx` (568), `knowledge-item-detail.ts` (**778**, larger than assumed) | **Split, and heavier than Part 2 first estimated.** The drawer *chrome* is a genuinely generic inspect-and-correct pattern — "Previously", "Why Lume believes this", "Related", "Evidence limits" all render off a generic `KnowledgeDetailModel`. But `resolveKnowledgeItemDetail` (lines 269–703) is a 430-line `if (ref.kind === …)` chain encoding PM semantics per branch, and the footer actions wire to `toggleTodo`, `setRiskStatus`, `confirmResponsibilityOwner`. Keep the chrome, replace the `KnowledgeItemRef` union, rewrite the resolver |
| **Ask** | `tell-me/TellMePanel.tsx` (354), `TellMeSessionContext.tsx` (403), `KnowledgeSearchAskBar.tsx` (204) | **Reuse with terminology.** Search/Ask distinction, citation rendering and suggested questions all transfer |
| **Session prep** | `frames/MeetingPrepFrame.tsx` (160), `meetings/MeetingBriefModal.tsx` (250) | **New.** These render *stored* prep fields and never persist. Part 1 wants generated prose |
| **Catch me up** | *(none)* | **New** |
| **Goals / commitments** | `frames/TodoFrame.tsx` (377) | **Substantial refit.** No goal UI exists; todos need the owner axis |
| **History** | `src/app/history` | **Substantial refit** |
| **Coach / Advise** | `coach/**` (1,239) | **Remove.** Note `CoachButton` (463), `CoachPreview` and `HeaderCoachButton` are **already dead** — imported nowhere |
| **Legacy PM frames** | `ProjectWidgetGrid` (557), `ProjectKnowledgeBrief` (466), `NudgeFrame` (363), `RiskFrame` (267), `CloneRelOpsButton` (184), `ProjectTimelineGantt` (165) | **Remove.** All but `ProjectTimelineGantt` are already dead |
| **Dev / evals UI** | `dev/**` (1,916), `evals/**` (1,264) | **Remove from the coaching build**; keep the eval *harness* |

**LOC disposition of the 17,254.** About **3,180 dev/evals, 1,239 coach, 2,588 already-dead and 1,403 project-onboarding are not taken** — roughly **8,400 lines, 49%, deleted or never copied.** Of what remains, ~3,771 lines (GENERIC + CHROME) port largely as-is, ~1,385 need renaming only, and the balance is rewritten against Client/Session/Goal/Commitment semantics.

### I1. Would parameterising the PM components help?

**No, and the frames prove it.** `buildOpenRiskRows` merges domain risk rows with knowledge-only risk prose, deduplicates by lowercased title with a `[Resolved]`-prefix rule, and maps `status === "watch"` to a medium priority dot. A coaching "watching" frame needs none of that; it needs open concerns with the session they arose in. A parameterised version would carry both behaviours behind a flag inside a 40-line function that currently reads clearly. That is exactly the unreadable conditional UI the brief warns against.

The right unit of reuse here is the **pattern** — pure row-builder functions, testable without React, consumed by both UI and verify scripts — not the functions themselves. Copy the pattern; write new functions.

---

## J. Onboarding implementation

Part 1's wow moment: name a client, paste whatever exists, watch extraction propose changes, approve, see the picture — then paste an earlier session and watch it *reconcile* into "since last time" with clickable provenance.

| Capability | Exists today? | Verdict | Complexity |
| --- | --- | --- | --- |
| Create first client from one field | `NewProjectExperience` is a 743-line multi-step PM flow | **New, and much smaller** | Low |
| Paste historical notes | Capture accepts pasted text today | **Reuse** | Low |
| **Multi-session import producing a diff** | No | **New — and it is the wow** | **High.** Requires ordered ingestion with per-session dates, supersession across sessions, and a "since last time" computation |
| Document/file import | `addFileName` exists with **no caller**; no file input | **New** | Medium |
| Sample client | `src/lib/seed.ts`, `seed-reset.ts` | **Reuse pattern**, new content | Low |
| Voice capture | `MediaRecorder` + Whisper via `/api/transcribe` | **Reuse nearly unchanged** | Low |
| Guided review | Review UI exists, PM-shaped | **Refit** | Medium |
| Initial client picture | Frames exist, PM-shaped | **Refit** | Medium |
| **Clickable provenance** | **No** — see B/F2 | **New** | Medium |

**V1-required:** single-field client creation, paste, multi-session ordered import with diff, guided review, initial picture, provenance to source, voice capture.
**Useful later:** file/document import, sample client, dictation polish.

**The honest read:** the two things that make the first ten minutes convincing — cross-session reconciliation and clickable provenance — are both **new**, and the multi-session diff is among the harder pieces of the whole build. Onboarding is not a place Lume's head start applies.

---

## K. Feature deletion

**KEEP SHARED** = copy near-verbatim · **TRANSFORM** = same idea, coaching semantics · **NOT EXPOSED** = code may exist, no surface · **REMOVE** · **LATER**.

| Lume area | Verdict | Note |
| --- | --- | --- |
| Auth, account, workspace bootstrap | **KEEP SHARED** | |
| Billing / trial / entitlement | **KEEP SHARED** | Per N |
| Knowledge Centre | **TRANSFORM** → the client picture | Section IDs already fit |
| Capture | **TRANSFORM** → *"After the session"* | Never called Capture; Part 1 §K |
| Capture review | **TRANSFORM** | Regroup by meaning, not entity |
| Item detail drawer | **KEEP SHARED** | Terminology only |
| Tell Me / Ask | **TRANSFORM** | New serialiser, new heuristics |
| Deterministic knowledge search | **KEEP SHARED** | |
| Suggested questions | **KEEP SHARED** | Deterministic templates |
| Catch Me Up | **LATER** | Does not exist; *Prepare me* covers v1 |
| Meeting Prep | **REMOVE** → rebuild as Session Prep | Stored fields that never persist |
| History | **TRANSFORM** | Needs a real change model |
| To Dos | **TRANSFORM** → Commitments + My follow-ups | Owner axis |
| Master To Do (cross-project) | **REMOVE** | Part 1 excludes cross-client anything |
| Risks | **TRANSFORM** → Watching | Lifecycle reused |
| People | **KEEP SHARED** | Closest fit in the codebase |
| Dates / milestones | **TRANSFORM** → Important dates | Split from Goals |
| Reminders | **REMOVE** | Enum value only; Part 1 bans nudging |
| Decisions | **KEEP SHARED** | |
| Dependencies | **REMOVE** | |
| Project creation / New Project V2 | **REMOVE** → one-field client creation | 1,403 lines |
| Multi-project UX / project switching | **TRANSFORM** → client list | Different ordering and semantics |
| Project status (RAG) | **REMOVE** | Must not exist |
| Releases / release playbook / RELOPS clone | **REMOVE** | |
| Meetings entity | **REMOVE** | Sessions are the meetings |
| Coach / Advise | **REMOVE** | Retiring in Lume anyway |
| Intelligence snapshots | **REMOVE** for v1 | |
| Intelligence strip counts | **TRANSFORM**, cautiously | *"I know 18 things"* about a person reads differently from about a project |
| ✦ Lume noticed / recommendations | **TRANSFORM** → *Worth revisiting* | Fix `D-003` first |
| Dev tools, AI cockpit, golden test UI | **NOT EXPOSED** | Keep in the fork, unrouted |
| Evals UI | **NOT EXPOSED** | Harness yes, UI no |
| Seed / demo reset | **TRANSFORM** → sample client | |
| Ocean / Desert themes | **REMOVE** both | New identity; token architecture reusable |

**The deletion test.** Part 1 §L warns the product must not feel like project management with new nouns. The concrete rule that falls out of this table: **if a surface would still make sense with the word "project" in it, it has not been transformed.** Four things fail that test if carried across unchanged — the intelligence strip, the review card grouping, the project/client switcher, and any status indicator.

---

## L. Test migration

Audited per file. **52 `verify-*.ts` scripts, 20,151 lines, 2,435 assertions.** 46 run in `npm test` via `scripts/run-regression-suite.ts` (which forces `OPENAI_API_KEY: ""` so nothing can call a live model); 6 are excluded, two of them because they need live Supabase credentials. Plus ~858 lines of Playwright, ~3,790 lines of fixtures, and two evaluation systems totalling ~8,090 lines.

| Class | Files | LOC | % | Asserts | Transfer |
| --- | ---: | ---: | ---: | ---: | --- |
| **INFRASTRUCTURE** | 10 | 2,278 | 11.3% | 357 | Survives untouched — auth, RLS, tenant isolation, production config, session hydration, model pinning, dashboard reporter |
| **DOMAIN-SHAPED INFRASTRUCTURE** | 29 | 13,559 | **67.3%** | 1,461 | **The invariant transfers; the fixtures and types do not.** The bulk of the suite and the bulk of the migration |
| **DOMAIN-COUPLED** | 7 | 1,519 | **7.5%** | 240 | Discard — risk lifecycle, golden PM scenarios, Ocean sidebar copy, legacy coach |
| **HARNESS** | 6 | 2,795 | 13.9% | 377 | Code survives, corpus does not |

> **78.6% survives as logic. Only 7.5% is dead weight. But the 67.3% middle bucket is not free** — every one of those 29 files imports PM fixture builders (`experimentalApplyWorld`, `createSeedState`, `CANDYLAND_ID`) and PM entity types (`Risk`, `Todo`, `Milestone`, `Stakeholder`). Migrating them is a mechanical fixture-and-type port across 29 files, not a redesign of test intent — substantial work, but the cheapest kind.

The runner helps: `SUITE` is a flat array of 46 entries spawned as independent child processes with no shared dependency graph or ordering requirement, so a coaching fork can filter it down with a one-line edit. There is no shared assertion helper — every script imports `node:assert/strict` and defines its own copy-pasted `check()` wrapper — but `scripts/lib/fake-supabase-workspace.ts`, an in-memory Supabase-shaped fake used for persistence tests without a live database, is genuinely reusable infrastructure.

### L1. Two fixture families with opposite properties — the actionable finding

This is the most useful thing in the audit and it directly shapes Slice B.

**`CaptureApplyWorld`** (`src/lib/experiments/worlds.ts`) hard-codes PM entities **in its type**:

```ts
export type CaptureApplyWorld = {
  projectIds: Set<string>;
  projects: Array<{ id: string; name: string; code?: string; stakeholders: … }>;
  risks: Array<{ id: string; projectId: string; title: string; status: string }>;
  todos: Array<{ id: string; projectId?: string | null; title: string; done?: boolean }>;
  timeline: Array<{ id: string; projectId: string; label: string; … }>;
  knowledge: Array<{ projectId: string; sections: { people?: string[]; risks?: string[] }; … }>;
};
```

A coaching world cannot be expressed in this shape without adding arrays and touching every function that destructures it. This type backs the Capture V2 harness and most verify scripts.

**`EvalWorldFixture`** (`src/lib/evals/types.ts`) is **already domain-parameterised**:

```ts
export type EvalCaptureEvent = { id: string; at: string; title: string; content: string; knownTruth?: string[] };
export type EvalStage = { id: string; label: string; captureIds: string[]; summary: string; knownTruth: string[] };
export type EvalCaseFixture = { id: string; worldId: string; stageId: string; question: string; …; expectedFacts?: string[] };
```

A world is an ordered list of free-text captures producing free-text known-truths, queried by free-text questions with expected-fact strings. **A coaching world — client sessions producing known truths, queried by recall questions — fits this with zero structural change.** And `scoring.ts` (566 LOC), which consumes it, contains no PM type anywhere: it is a semantic string-matching engine over free text.

> **This pair is the closest thing to a genuinely portable asset in the repository**, and it means the Part 1 §Y11 corpus work has a ready-made home — *if* the coaching corpus is built against the intelligence-harness fixture format rather than the Capture V2 one. Slice B should start there. That was not obvious before this audit and it is worth several weeks.

### L2. The eval harness, quantified

**Capture V2 harness** (4,031 LOC): ~11% pure domain-neutral machinery (provider adapters, cost tables), ~52% domain-shaped machinery whose algorithms transfer but whose types carry `projectId` and `todoId`/`riskId`/`milestoneId`, ~37% irreducible PM content (the 100+ case corpus, frozen prompts, stacked stories) that must be authored from scratch.

**Intelligence harness** (4,059 LOC): ~41% domain-neutral machinery, ~16% domain-shaped orchestration, ~43% PM fixture content.

**Playwright** (858 LOC): the config is entirely reusable and `helpers.ts` is mostly reusable page-object scaffolding — auth bypass, navigation, state IO. The three spec files (~593 LOC) are fully PM journeys, and all 641 lines of JSON fixtures are serialised PM `MissionState` snapshots that do not transfer. Roughly 31% scaffolding, 69% rewrite.

**Property tests** (`verify-capture-v2-invariants.ts`, 414 LOC): the strongest transfer story in the codebase. Ten `fast-check` properties — fail-closed parsing, idempotency, ordering independence, isolation by ID, ambiguity-must-not-resolve, structural-validity-is-not-semantic-confidence — and **eight of the ten need no fixture changes at all**, because their generators produce arbitrary strings and IDs with no PM semantics.

### L3. `classifyLumeSafety` — the crown-jewel claim, tested

Part 1 called the three-way taxonomy the crown jewel. The audit's verdict, which I accept: **the taxonomy is domain-neutral as a pattern and roughly two-thirds domain-shaped as an implementation.**

The decision tree genuinely never inspects business meaning — only structural facts: was the model wrong, what kind of decision resulted, did a write violate a rule. That control flow would classify a coaching pipeline's outputs identically, provided it exposes the same four decision kinds (`write`, `needs_you`, `no_change`, `reject`).

But the helpers it calls are PM-wired: `writeTarget` keys on `todoId`/`riskId`/`milestoneId`/`personId`, `isolationViolation` consults an `ID_PROJECT` map hard-coding the three fictional world IDs, and `isPersonLinkedWrite`, `operationCreatesNewRecord` and `prohibitedWriteHit` are all PM-shaped. **Roughly 180 of the file's 517 lines need rewriting; the control flow does not.**

That is still a genuine asset — knowing that "the model was wrong" and "we let a wrong thing become truth" are different metrics is the hard part, and no two-person competitor has it. But Part 1 §R was right to classify it as an internal engineering advantage that is invisible to a buyer, and Part 2 should not inflate it beyond that.

### L4. Coaching qualification pack

Twelve cases, per the brief, with the specific trap each must catch:

| # | Case | Must catch |
| --- | --- | --- |
| 1 | Simple session | Baseline extraction; no invention |
| 2 | Explicit commitment | Owner recorded correctly |
| 3 | Completed commitment | `update_existing`, not a duplicate |
| 4 | Changed goal | Supersession with both values retained |
| 5 | Relationship update | **Stored as reported, never as an assertion about the third party** |
| 6 | Ambiguous pronoun | *"She said he'd been better"* with two male referents → `needs_you` |
| 7 | **Coach advice vs client commitment** | *"I suggested she speak to Martin; she said she'd think about it"* must **not** become her commitment |
| 8 | Stale historical note | A superseded goal must not resurface as current |
| 9 | Contradiction | Two credible incompatible claims → surfaced, never silently resolved |
| 10 | Client-name collision | Two clients named Sarah → no merge, no leak |
| 11 | **Cross-client isolation** | A fact from client A must be unreachable from client B's picture, prep and Ask |
| 12 | **Long-running 20–50 session case** | Durability: a fact learned at session 3 and unmentioned since must still be current at session 40 |

Cases 7, 11 and 12 have no PM analogue and are the most important. Case 12 in particular is what Part 1 §Q identifies as the entire retention thesis, and Lume's philosophy §19 already names the equivalent requirement: *"if Lume learned something that remains true, a later Capture that does not mention it must not cause Lume to forget it."*

Add two beyond the brief: a **psychological-inference trap** (a note inviting trait language, where any characterisation is a hard failure), and a **hedge-preservation case** (*"she might be thinking about leaving"* must not become *"she is leaving"*).

### L5. Does the existing reliability work materially reduce refit risk?

**Yes — and this is the strongest positive finding in Part 2.** Not because the tests transfer, but because three harder things do: knowing *which* failures matter (the three-way taxonomy), having the machinery to measure them across providers at known cost, and having a written body of invariants — a name is not identity, missing retrieval is not proof of absence, resolved things must not resurrect, mutations must prove scope — that took a year of failures to discover.

A competitor starting fresh does not know that "the model was wrong" and "we let a wrong thing become truth" are different metrics. That is a genuine head start.

But it is a head start **in engineering quality, not in time to market**, and it is invisible to a coach comparing two products at $25. Part 1's competitive finding stands.

---

## M. Privacy and security cost

Audited against actual code. The platform is in better shape than expected in most respects and has four specific gaps that matter disproportionately for a confidential-data product.

| Area | State | Classification |
| --- | --- | --- |
| **RLS completeness** | Enabled **and FORCED** on every tenant table, each with explicit SELECT/INSERT/UPDATE/DELETE policies scoped through `is_workspace_member()`. **No user-facing table has RLS enabled with zero policies.** The two tables that do — `billing_events` and `eval_runs` — are deliberate deny-all, documented in the SQL: *"RLS enabled + no policies ⇒ denied for anon/authenticated"* | **Adequate already** |
| **Service-role usage** | Four call sites, **all correctly gated**: eval store (behind an email allowlist), the Stripe webhook (after signature verification), and checkout/portal (after `getUser()` *and* an explicit `workspace_members` check before trusting a client-supplied workspace id) | **Adequate already** |
| **Auth hardening** | `getUser()` (JWT-validating) at every authorisation decision. The **only** `getSession()` call in the codebase is a browser-init probe in `wait-for-browser-user.ts` whose result is immediately re-validated with `getUser()`. All 28 API routes authenticate or are intentionally public | **Adequate already** |
| **Analytics / telemetry** | **None exists.** No Sentry, PostHog, Mixpanel, Amplitude, Segment, GA or Vercel Analytics in `package.json`; no client-side tracking script | **Adequate, and a genuine asset** — zero third-party leakage vector. The corollary is zero production error visibility beyond the Vercel log stream |
| **Dev cockpit** | Gated twice on `NODE_ENV === "development"`, and **does not persist prompt or response text** — `CaptureRunMetrics` contains only counts and token measurements | **Adequate** — a worry raised in Part 1 that turns out not to apply |
| **Client-scope isolation** | `D-035` implemented for todos via `scopeExistingTodo`, **open as a class** | **Meaningful new work** — the existential invariant |
| **Deletion** | Real and correct for projects. **But `PROJECT_BUNDLE_SET_NULL_TABLES` is a hand-maintained array of six tables** — `todos`, `memories`, `recommendations`, `history_events`, `capture_sessions`, `coach_sessions` — deleted explicitly because their FK is `ON DELETE SET NULL`. The two holding verbatim content (`capture_sessions.transcript`, `coach_sessions.markdown`) are cleaned *only because someone remembered to list them* | **Meaningful new work** — see M1 |
| **Account deletion** | **Does not exist.** No route, no UI, no code path. There is an RLS policy permitting an owner to delete their workspace row, but nothing calls it. A right-to-erasure request today requires manual work in the Supabase dashboard | **Launch blocker** for a GDPR-facing product |
| **Export** | **Does not exist anywhere.** No route, no button, no serialiser | **Launch requirement** — Part 1 §P and §Q both require it |
| **Logging** | `server-log.ts` redacts by **key name only** (`password`, `token`, `secret`, `apikey`…) plus a 500-character truncation. **No current call site logs capture content** — they log ids, feature names and `error.message` | **Meaningful new work** — see M2 |
| **AI payload caps** | **None on the Capture route.** Content is `.trim()`ed and checked non-empty, then sent. Only New Project truncates, at 12,000 characters, and only inside a template string | **Minor work** |
| **Rate limiting** | In-memory `Map`, per-process, self-documented as *"Per-process only — fine for single-instance"*. On serverless the effective limit is `limit × instances` | **Future requirement**, not a launch blocker at 200 users — but note it is also an exfiltration control |
| **Production config guard** | `auditProductionConfig()` is thorough — rejects demo auth, local persistence, missing keys. **But `assertProductionConfigOrThrow()` is never called from `proxy.ts`, `next.config.ts` or any request path.** It runs only in `scripts/verify-production-config.ts` | **Minor work** — wire it to boot. It is currently a test you must remember to run |
| **Staging exposure** | `requireAiCaller` has an open-dev bypass gated on `NODE_ENV !== "production"`. A publicly reachable staging deploy without `NODE_ENV=production` would be unauthenticated | **Minor work** — real but easily closed |
| **Data residency** | Supabase region choice | **Adequate** — a fork with its own project is EU-resident from day one |
| **DPA / sub-processor list** | Not present | **Minor launch requirement** — documentation, not engineering |
| **Third-party data (Part 1 §P3)** | Not modelled | **Meaningful new work** |
| **SOC 2** | Absent | **Future enterprise requirement.** Simply.Coach already claims SOC 2 Type II + HIPAA + GDPR on all plans |

### M1. Erasure depends on a hand-maintained array

The single sharpest finding in the audit. Project deletion works today, but the guarantee is procedural rather than structural: six tables are deleted by an explicit loop over `PROJECT_BUNDLE_SET_NULL_TABLES` because their foreign keys are `ON DELETE SET NULL`. If a future migration adds a project-scoped table with a SET NULL foreign key and nobody updates that array, **its rows survive deletion indefinitely with an orphaned null `project_id`, still holding content.**

In a PM tool that is a tidiness bug. In a product whose deletion promise is *"delete a client and everything goes, including everyone mentioned in them"* — Part 1 §V4's marketing copy — it is a compliance failure waiting for a schema change.

The coaching fork should make the content-bearing tables `ON DELETE CASCADE` so the database enforces what the array currently remembers, and add a verify script asserting that every table with a client-scoped foreign key is either CASCADE or explicitly listed.

### M2. Logging is safe by accident, not by design

No current call site logs a transcript, prompt or client name — every one logs ids, feature names, status strings and `error.message`. That is good practice, and it is also, as the audit puts it, "an emergent property of every developer having been careful."

Two exposures follow. Redaction is key-name-based, so a 400-character note about a named executive passed under a field called `detail` or `title` would be written verbatim to the Vercel log stream. And `error.message` is logged widely, while Postgres constraint-violation messages routinely embed the offending row's text.

The fix is small and should be non-negotiable in a coaching build: an allowlist rather than a denylist for logged fields, a lint rule or test asserting that no content-bearing field name reaches `serverLog`, and sanitising database error messages before logging them.

### M3. Net

**Privacy is not where the bulk of the cost is, but it is not free either, and two items are launch blockers rather than nice-to-haves.** Account deletion and export do not exist at all, and both are required by the promises Part 1's landing page makes. Erasure integrity and log discipline are meaningful new work. Everything else — RLS, auth, service-role gating, the absence of third-party analytics — is genuinely good and starts the fork ahead of most two-person competitors.

Revised estimate for privacy-specific effort: **8–12% of the total refit**, up from the 5–8% estimated before the audit.

**And one finding directly validates section E.** The audit's own conclusion on data isolation between two products sharing a Supabase project: *"the realistic options are either (a) a second, fully separate Supabase project for the coaching product, or (b) adding a `product` column to every user-data table and rewriting every RLS policy to also filter on it — a much larger change."* It also notes that the service-role key is a single shared secret whose blast radius is the entire project, so a bug or leak in either product would expose both. That was reasoned to independently in §E1 on confidentiality grounds; it is now confirmed on implementation grounds.

---

## N. Billing and product separation

### N1. What exists

Stripe (`stripe@18.5`), lazily constructed. `billing_customers` (workspace UNIQUE, stripe customer UNIQUE), `subscriptions` (workspace UNIQUE, status `trialing|active|past_due|cancelled|expired`, trial and period fields, `cancel_at_period_end`), `billing_events` with UNIQUE `(provider, provider_event_id)` for idempotency. A single price from `STRIPE_PRICE_ID` — no plan catalogue in the database. A 14-day no-card trial created idempotently by `ensure_workspace_trial`. Entitlement via `evaluateEntitlement` → `canUseLume`, enforced in the UI by `EntitlementGate` and on the server by `requireAiCaller`, which returns 403 `entitlement_required`. `past_due` deliberately still permitted as grace.

The webhook is correctly built: signature-verified via `constructEvent`, idempotent through the `unique (provider, provider_event_id)` constraint with an early `{ ok: true, duplicate: true }` return, and unknown event types are recorded and no-op'd with a 200 so Stripe does not retry-storm.

### N2. Can it support two brands?

**Under the recommended fork: trivially, and with no code changes at all.** Two Supabase projects, two deployments, two `STRIPE_PRICE_ID` values, two Stripe Products under one Stripe account. Separate brands, separate pricing, separate entitlement, shared Stripe reporting.

**Under a shared database it needs a schema change, now costed precisely.** Both constraints block it:

```sql
-- billing_customers
workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
-- subscriptions
workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
```

One workspace = at most one Stripe customer = at most one subscription = one entitlement = one price. There is **no `product`, `product_key` or `app_id` column anywhere in the schema**, and `getWorkspaceEntitlement` queries by `workspace_id` alone with `.maybeSingle()`.

The smallest change is well-bounded: add `product text not null default 'lume'` to both tables, replace `unique (workspace_id)` with `unique (workspace_id, product)`, thread a `product` argument through `ensure_workspace_trial`, `getWorkspaceEntitlement`, `applySubscriptionPatch`, `recordBillingEventIfNew` and `requireAiCaller`, add per-product price configuration, and include `product` in Stripe metadata alongside `workspace_id`. Roughly five files and one migration. **Moderate, not trivial — and entirely avoided by the fork.**

Critically, that change would give product-scoped *billing* and would **not** give product-scoped *data*. The user-data tables have no product discriminator either, so a coaching row and a PM row in a shared project are structurally indistinguishable. Achieving real isolation would mean a `product` column on every user-data table plus rewritten RLS on all of them — which is precisely the argument in §E1 for two Supabase projects.

**This is the cleanest single argument for the fork in the whole report: the billing model is already single-product by constraint, and honouring that constraint is free while working around it costs a migration, five files, and still does not isolate the data.**

### N3. Two real gaps

**`D-024` — entitlement is not a real meter.** "Actions left" is a local `workspace_usage` counter, not a Stripe entitlement, and `analyses_this_month` is not even wired into hydrate (`load-mission-state` hardcodes zero). Part 1 §S proposes an active-client limit, which needs a real, archive-aware, server-enforced entitlement. Small but genuinely new, and shared with Lume's own backlog.

**Entitlement gates AI, not the product.** `evaluateEntitlement` is enforced only inside `requireAiCaller`, so an expired trial blocks Capture, Coach, Tell Me, transcription and New Project — but leaves `workspace/projects` and `workspace/state` open. A lapsed user can still create, read and delete their data. For Lume that may be deliberate. For a coaching product it needs a decision: Part 1 §Q identifies "practice contraction" as a churn moment and recommends downgrade-not-cancel, which is easier to offer if read access survives a lapse. Worth choosing on purpose rather than inheriting.

---

## O. Repository change map

Classification: **unchanged** · **small** · **moderate** · **major** · **new** · **unnecessary**.

### Shared infrastructure (copy into the fork)

| Item | Path | Class |
| --- | --- | --- |
| Supabase clients | `src/lib/supabase/{server,client,service}.ts` | unchanged |
| Request gate | `src/proxy.ts` | unchanged |
| Auth routes | `src/app/api/auth/**` (7) | unchanged |
| Auth mode / password | `src/lib/{auth,auth-mode,auth-demo,auth-password}.ts` | unchanged |
| Workspace bootstrap | `src/lib/data/workspace-bootstrap.ts` | small |
| AI gate / rate limit | `src/lib/{ai-gate,rate-limit}.ts` | small |
| OpenAI transport | `src/lib/openai.ts`, `openai-model.ts` | small |
| Runtime config | `src/lib/runtime-config.ts`, `site-url.ts` | small |
| Build config | `next.config.ts`, `tsconfig*`, `eslint.config.mjs`, `postcss.config.mjs`, `vercel.json` | unchanged |

### Coaching application

| Item | Class |
| --- | --- |
| Client list, client page, session sheet, prep, Ask surface | **new** |
| Frame row builders (coaching equivalents of `ocean-frames.ts`) | **new** (~200 LOC) |
| App shell + sidebar | moderate |
| Item detail drawer | moderate |
| Capture input half | moderate |
| Review UI | **major** |
| Onboarding | **new** |
| `store.tsx` equivalent | **major** — 2,722 lines, ~35 PM mutations |

### Database

| Item | Class |
| --- | --- |
| Tenancy + RLS + billing migrations | unchanged |
| `clients`, `engagements`, `sessions`, `goals` | **new** |
| `knowledge_items` (+ `reported` epistemic, new kinds) | small |
| `stakeholders`, `risks`, `milestones`, `memories` | small (rename only) |
| `todos` (owner axis, person FK) | moderate |
| Provenance columns on commitments/watch/dates | **new** |
| `history_events` (open enum, since-X query) | moderate |
| `releases`, `meetings`, `snapshots`, `coach_sessions` | **unnecessary** |

### AI prompts and contracts

| Item | Class |
| --- | --- |
| `capture-v2/types.ts` unions | moderate |
| `capture-v2/prompt.ts` | **major** rewrite (46 LOC, high leverage) |
| `capture-v2/validate.ts` | small |
| `capture-v2/resolve.ts` | moderate |
| `capture/apply/classify.ts` legality table | **major** |
| `capture/apply/dispatch.ts` | **major** (788 LOC) |
| `apply/{project-scope,expected-target}.ts` | small |
| `serializeCanonicalTruth` | **major** |
| Tell Me question heuristics | moderate |
| Session-prep generator | **new** |
| Inference deny-list validator | **new** |
| `src/ai/domain/**`, `project-domain.md` | **unnecessary** (legacy path only — see G5) |

### Tests

| Item | Class |
| --- | --- |
| `run-regression-suite.ts` | unchanged |
| Infrastructure verifies (auth, RLS, tenancy, prod config) | small |
| `verify-d035-project-isolation` → client isolation | moderate |
| Capture/review/apply/Tell Me verifies | **major** |
| Coaching eval corpus (3 worlds × 20+ stacked sessions) | **new — highest value** |
| `eval-capture-v2` machinery | small |
| PM corpus, `verify-risk-lifecycle`, `verify-people-entities`, `verify-coach` | **unnecessary** |
| Playwright scaffolding / journeys | small / **major** |

### Marketing site, billing, analytics, documentation

Public site: **new** (none exists in this repo). Billing: small, plus **new** active-client entitlement. Analytics: **new**, and must be content-free. Documentation: **new** — the authority-hierarchy pattern in `docs/README.md` is worth copying as a *practice*; its content is not.

---

## P. Refit estimate

Framed as *what fraction of a from-scratch build does Lume save?* — which is the only framing that answers the strategic question.

| Area | Share of total build | Saved by Lume | Reasoning |
| --- | --- | --- | --- |
| **Platform** — auth, tenancy, RLS, billing scaffolding, deployment, config | ~15% | **65–75%** | Genuinely generic and well made. Revised down slightly after the privacy audit: account deletion and export do not exist at all, erasure integrity rests on a hand-maintained array, and log discipline needs enforcing (§M) |
| **AI / extraction / trust architecture** | ~25% | **40–55%** | Contract shape, validation, identity gate, fail-closed patterns, invariants. Prompt, ontology, dispatcher, serialiser all new |
| **Test and eval machinery** | ~10% | **55–65%** on machinery, **0%** on corpus | Revised up after the per-file audit: 78.6% of verify LOC survives as logic and only 7.5% is dead weight, though the 67.3% middle bucket needs a fixture-and-type migration across 29 files. Eight of ten property tests need no changes at all, and the intelligence-harness fixture format is already domain-parameterised (§L1) |
| **Domain model and persistence** | ~15% | **25–35%** | `knowledge_items` overlay and `stakeholders` transfer well; four new tables |
| **Product UI** | ~25% | **15–25%** | Revised up slightly after the component audit: the reuse envelope is ~30% of component LOC (GENERIC + CHROME) plus a token-only theme system, better than first assumed. Offset by nav being hard-coded JSX rather than config, and by 49% of components being deleted or never copied |
| **Onboarding and wow moment** | ~10% | **~5%** | Multi-session diff and provenance-to-source are both new |
| **Weighted total** | 100% | **≈ 35–45%** | |

> **Refit ≈ 55–65% of a from-scratch build.**

### P1. Why this is the number that matters

Part 1's §Y framed the question as "how much is reusable." That framing flatters the answer, because it counts lines. The strategic question is different: **the 35–45% Lume saves is concentrated in what the customer never sees; the 55–65% that is new is everything the customer touches.** A coach evaluating this against CoachRocks at $25 experiences only the new part, and experiences it as a version 1.

### P2. Uncertainty

The estimate is a range for good reasons and should not be quoted more precisely. The AI refit could be better than 40% if the coaching ontology turns out to sit comfortably inside the existing observation shape, or worse than 55% if attribution proves invasive across the pipeline. The eval corpus is genuinely unknown — building three coaching worlds with 20+ stacked sessions each has no precedent here to estimate from, and Part 1 flagged it as the highest-value early work precisely because nobody knows what it costs. And the whole estimate assumes the fork starts *after* convergence; starting before it would add the cost of porting two of everything.

### P3. Would shared-core work accelerate future products?

**No, on current evidence — it would increase scope now.**

Three reasons. Two consumers is not enough to locate an abstraction boundary correctly, and the second consumer here is hypothetical. Extraction during convergence is actively harmful, because the primitives are being consolidated and packaging them would freeze that. And the genuinely shareable surface is 1,500–2,500 lines of near-boilerplate, against which the cost of a monorepo, a package pipeline, versioning and two-consumer API discipline is plainly larger.

**When it would change:** a third product, two of three needing the same primitive, that primitive stable for six months. Write the rule down.

---

## Q. Suggested implementation slices

Only if something proceeds. Derived from the repository's actual state, not a generic template. **No code was written.**

### Slice 0 — Finish Lume's convergence *(prerequisite, not optional)*

**Objective.** Reach a single Capture engine, a single Ask assembler, a single New Project path, with `D-003`, `D-004`, `D-005` and the `D-035` class closed.
**Why first.** Forking mid-convergence duplicates every dual path and then requires maintaining both halves twice. Every item here makes the fork cheaper and is work Lume needs regardless.
**Gates.** `LUME_CAPTURE_V2` default-on and legacy deleted; `LUME_CANONICAL_TRUTH` default-on and legacy branch deleted; history persists across reload; no silent save failures; persist-helper scope audit complete.
**Risk.** This is months of work that has nothing to do with coaching — which is itself the argument for the recommendation in S.

### Slice A — Coaching extraction spike *(cheapest decisive evidence, ~1 week)*

**Objective.** Discover whether the observation contract survives a coaching ontology.
**Shape.** In a scratch branch, rewrite `capture-v2/prompt.ts` with a coaching vocabulary, extend the domain union, and run it against 15–20 hand-written realistic coaching notes. Measure: does it produce clean observations? Does the ambiguous-pronoun case fail closed? Does attribution survive?
**Dependencies.** None. Can run today.
**Gate.** Attribution preserved on every reported-context observation; zero psychological inferences; ambiguous pronoun → `ambiguous`.
**Risk.** A scratch branch becomes a fork by accident. Time-box it and delete it.

### Slice B — Coaching qualification corpus

**Objective.** Build the twelve-case pack from §L4 plus the two additions, as three worlds with 20+ stacked sessions each.
**Dependencies.** Slice A.
**Build it against `EvalWorldFixture`, not `CaptureApplyWorld`.** This is the concrete payoff of the §L1 finding. The intelligence-harness fixture format — ordered free-text captures producing known-truths, queried by questions with expected facts — is already domain-parameterised and accepts coaching worlds with no structural change, and `scoring.ts` consumes it without a single PM type. `CaptureApplyWorld` hard-codes `risks`, `todos`, `timeline` and `stakeholders` in its type and cannot express a coaching world without being rewritten. Choosing the right fixture family before writing the corpus is worth several weeks.
**Gate.** The Part 1 §Y1 numeric gate: zero LUME FAILURE on cross-client and identity cases, under 2% elsewhere.
**Risk.** Still the most under-estimated item in the plan and the one with no precedent to size from — but less so than before this audit, because the fixture shape and the matcher already exist.

### Slice C — Fork and platform

**Objective.** New repository, new Supabase project, new Vercel project, new Stripe product. Copy the generic surface. Write `SYNC.md`. Delete everything in §K marked REMOVE.
**Gate.** Auth, RLS, tenancy and billing verifies pass green in the fork; `verify-production-config` passes.
**Risk.** Copying too much. The deletion list is the discipline.

### Slice D — Coaching domain and durable truth

**Objective.** `clients`, `engagements`, `sessions`, `goals`; extend `todos` with the owner axis; add `reported` epistemic; make provenance reach the session.
**Gate.** Client isolation test green; provenance renders the source sentence; a fact learned at session 3 survives to session 40.

### Slice E — The loop

**Objective.** Session note in → review → approve → picture. Client list, client page, session sheet.
**Gate.** Sub-90-second post-session capture on a realistic note; the twelve-case pack green end to end.

### Slice F — Prepare me, Ask, and the wow

**Objective.** Prep generation, client-scoped Ask with citations, multi-session import producing a diff.
**Gate.** The Part 1 §J demo runs on real pasted notes: paste two sessions, get "since last time", click a statement, see the sentence.

### Slice G — Launch readiness

**Objective.** Export, account deletion, DPA and sub-processor page, the paste-into-your-coaching-agreement clause, active-client entitlement, marketing site.

**Note the ordering.** Slices A and B come before the fork deliberately. They are the cheapest way to learn whether the domain works, they need no infrastructure, and if they fail nothing has been forked.

---

## R. Revised commercial viability

Part 1 concluded **WEAK OPPORTUNITY**: six shipping competitors on the exact wedge, a $25 unlimited-client price floor with a free tier beneath it, and two venture-funded shutdowns in fourteen months. Part 2 asked whether technical findings change that. **They make it worse, in three specific ways, and better in one.**

**Worse: the refit is 55–65%, not the 25–35% that would have made this a weekend-shaped opportunity.** Part 1's estimate of what transfers was measured in reuse; the honest measure is what a customer receives, and by that measure Lume contributes little.

**Worse: the marquee differentiator is absent from the schema.** Clickable provenance to the source sentence — the one thing ChatGPT cannot do and the centre of the Part 1 demo — requires new columns and new discipline at every write site.

**Worse: the platform is mid-convergence, so the true sequence starts with Slice 0.** Realistically the first coaching customer sits behind finishing Lume's convergence *and* a 55–65% build *and* a new evaluation corpus with no precedent to size it from. During that time the competitive set will not stand still: Simply.Coach has AI notes in development with SOC 2 Type II already in place, and the entry rate into this category is not slowing.

**Better: the reliability apparatus is a real asset, and it is the right one.** The three-way failure taxonomy, the identity discipline, and the invariant that mutations must prove scope are exactly what a product holding twenty-five confidential client records needs, and no two-person competitor has them. This is a genuine quality advantage.

But quality advantages must be *legible* to convert, and this one is not. A coach comparing two products at $25 cannot see a failure taxonomy. Part 1 §R already concluded there is no durable moat, only a 12–24 month head start on structure and trust — and Part 2 shows that head start costs 55–65% of a build to realise.

### R1. Effort against the realistic prize

Part 1 modelled 25–200 customers and, after the price floor was discovered, a realistic opening price of €19–€25 rather than €39. At 200 customers and €22, that is roughly **€4,400 MRR / €53k ARR gross**, before churn of 4–8% monthly and before acquisition.

Set that against Slice 0 plus a 55–65% build plus a new evaluation corpus. The ratio is poor, and it is poor *before* accounting for the fact that the same engineering effort spent finishing Lume's convergence benefits a product that already exists.

**The economics do not justify the build. They might justify a two-hour test and a much smaller integration product.**

---

## S. Coaching vs Lume vs Weddings — technical angle

> **A wedding audit has not been performed.** A repository-wide search for "wedding" returns **zero matches**. Nothing below is based on evidence about a wedding product; it is inference from the domain shape, clearly labelled as such, and should not be quoted as a finding.

| Dimension | **Continue Lume** | **Coaching product** | **Wedding product (inferred, unaudited)** |
| --- | --- | --- | --- |
| Shared primitives available | All of them — it *is* the codebase | Platform ~75%, AI architecture ~50%, UI ~15% | Platform ~75%; AI and domain unknown |
| Container fit | `projects` is correct by construction | Poor — needs Client above Engagement | Plausibly good: a wedding is a bounded, dated project with a hard deadline |
| Person model fit | Built for it | **Excellent** — scoped people with relationship change is the closest fit found | Plausibly excellent — guests, suppliers, families, roles |
| Dates / milestones | Native | Reused with renaming | **Probably the strongest fit of the three** — a wedding is dates all the way down |
| Risk / watch lifecycle | Native | Renamed to Watching | Plausibly native — supplier risk, weather, deposits |
| Longitudinal memory value | Weak — memory dies with the project | **Strong** — relationships run for years | **Weak** — 12–18 months then the customer leaves forever |
| Retention | Resets every 6–18 months | Compounds | **Terminal by design** |
| Likely duplication if built | n/a | 1,500–2,500 lines of platform | Similar |
| Domain distance from PM | Zero | **Large** — epistemics, attribution, prohibited inference | **Small** — tasks, dates, people, budget, suppliers |
| Confidentiality burden | Corporate IP | **High** — named third parties, possible Article 9 | Low |

**The technical reading, stated carefully.** *If* a wedding product resembles the obvious shape — a dated container, many named people with roles, tasks with owners, suppliers, a budget and a hard deadline — it would be by far the **most naturally supported by the current architecture**, because it is structurally a project with different nouns. `projects` with a date, `stakeholders`, `todos`, `milestones`, `risks` and `knowledge_items` would map with renaming rather than redesign, and the refit would plausibly be well under half of coaching's.

**But the two dimensions that made coaching attractive both invert.** Weddings have no longitudinal value — the memory is deliberately disposable, the customer leaves permanently after the event, and there is no compounding record. Coaching's *only* structural advantage over continuing Lume was retention, and a wedding product has worse retention than Lume does.

So the three-way comparison, from the codebase alone: **Lume fits the architecture perfectly and has weak retention. Coaching fits the architecture poorly and has strong retention. A wedding product would likely fit the architecture very well and have the worst retention of the three.** Easiest to build is not the same as best to build, and this is a clean illustration of the difference.

---

## T. Final recommendation

### **PARK**

Not REJECT — the domain fit is genuine, the reliability apparatus is a real and unusual asset, and the people model is the closest thing to a natural fit anywhere in the codebase. Not PROCEED TO NARROW PROTOTYPE — a prototype costs Slice 0 plus a 55–65% build against a market with a $25 floor and two recent funded corpses. Not HOLD UNTIL LUME V1 — that phrasing implies the answer becomes yes afterwards, and the evidence says the market will be more crowded by then, not less.

**PARK means: stop work, keep the analysis, and set an explicit reopening condition.**

Reopen if any of these becomes true:

1. **The two-hour test surprises.** If CoachRocks and its peers turn out to be materially worse in practice than their marketing, the competitive premise changes.
2. **Distribution appears** — an existing audience of executive coaches, an ICF or EMCC relationship, or a corporate-sponsor channel where SOC 2 and EU residency are procurement gates a two-person competitor cannot pass.
3. **A competitor exits.** In a market that has killed two funded players in fourteen months, consolidation is plausible, and the survivors' customers become reachable.
4. **The integration variant proves out** — see below. This is the likeliest of the four.

### Why PARK rather than a follow-up audit

The remaining technical questions are answerable, but answering them does not change the decision. If the AI refit turned out to be 40% rather than 55%, the market would still be occupied at $25. **The binding constraint is commercial, and no further code inspection relieves it.** Spending more engineering analysis on a parked question is the specific failure mode this recommendation exists to prevent.

---

## U. Exact next investigation or build step

Three steps, in order, with a stop condition after each.

### Step 1 — The two-hour competitor test *(cost: £0, this week)*

**Question.** Is the product I would build meaningfully better than CoachRocks for a coach who does not care about my architecture?

**Evidence needed.** Direct use, not screenshots. Sign up for CoachRocks' free tier (3 clients). Load three real anonymised clients with three sessions each. Use its prep briefs and its client-memory chat. Repeat on SessionFlow, currently free in beta. Note specifically: does it confuse two people with similar names; does it show where a claim came from; does it invent relationship detail; does it hold ambiguity or resolve it silently.

**Cheapest way.** Two hours and an email address.

**Stop condition.** If it is good, this investigation is closed and the answer is REJECT rather than PARK. Record that and move on.

### Step 2 — Audit the integration variant *(only if Step 1 surprises)*

**Question.** What would it take to be the memory layer *inside* CoachAccountable and Paperbell rather than a competitor to both?

**Why this and not the standalone product.** It is the only uncontested commercial position Part 1 found, it was publicly invited — CoachAccountable's founder refused to build AI in April 2026 and shipped a `Session.add` API in August specifically so third parties could — and, critically, **it requires almost none of the architecture assessed in this report.** No Ocean UI, no multi-project workspace, no onboarding flow, no client list, no theme system. It needs extraction, a small durable store, a webhook receiver, an API client and a settings page. On the §P framing, that is plausibly a **20–30% build rather than 55–65%**, and it inherits distribution instead of fighting six competitors for it.

**Evidence needed.** Read the CoachAccountable API and webhook documentation properly. Establish what session data is readable, what is writable, whether third-party apps are listed anywhere, and what Paperbell offers. Then ten conversations with coaches who already pay for one of those platforms, asking whether they would add £15/month for memory *inside* the tool they already use.

**Cheapest way.** A day of API reading and two weeks of conversations. No code.

### Step 3 — The coaching extraction spike *(only if Steps 1 and 2 both point forward)*

**Question.** Does the observation contract survive a coaching ontology with attribution intact?

**Evidence needed.** Slice A in §Q: rewrite the 46-line V2 prompt with a coaching vocabulary, extend the domain union, run against 15–20 hand-written realistic coaching notes. Success is attribution preserved on every reported-context observation, zero psychological inferences, and the ambiguous-pronoun case failing closed.

**Cheapest way.** One week in a scratch branch that is deleted afterwards. Time-box it; do not let it become a fork.

---

### One last note on sequencing

If none of this proceeds, the highest-value engineering work available remains **Slice 0** — finishing Lume's convergence, closing `D-003`, `D-004`, `D-005` and the `D-035` class, and deleting the legacy halves of three flagged dual paths. That work is required for Lume regardless, it is the prerequisite for any future fork into any domain, and it is the single thing that would most reduce the cost of whichever product is eventually chosen.

Parking coaching does not idle the codebase. It points it at the work that helps either way.

---

*End of Part 2. No production code, schema, behaviour or tests were changed by this investigation.*
