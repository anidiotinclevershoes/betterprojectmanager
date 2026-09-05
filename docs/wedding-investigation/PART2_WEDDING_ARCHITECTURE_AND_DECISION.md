# Wedding Product Investigation — Part 2

**Architecture, shared-core strategy, code reuse, testing and final decision**

| | |
| --- | --- |
| **Status** | Investigation only. No production code, schema or architecture changed. |
| **Date** | 27 August 2026 |
| **Working branch** | `cursor/wedding-product-investigation-part1-ad60` |
| **HEAD at time of audit** | `4ff073c7f8c2953f525d082d9c3ce2d14b24c1d3` |
| **Product code baseline** | `main` = `origin/main` = `e5cd9ba8e183f7a42f8f5c74aef73c3c7d73d54f` |
| **Changes to product code since Part 1** | **None.** `main` and `origin/main` are identical and unchanged; the only commits on this branch are documentation. |
| **Part 1 report** | `docs/wedding-investigation/PART1_WEDDING_PRODUCT_INVESTIGATION.md` |
| **Part 1 evidence appendix** | `docs/wedding-investigation/PART1_APPENDIX_PRACTITIONER_EVIDENCE.md` |
| **Coaching technical audit** | **Does not exist** in `/docs`. Section U distinguishes evidence from assumption accordingly. |

## Measured baseline

Everything in this report is sized against these counts, taken at the audit HEAD.

| Area | Lines |
| --- | ---: |
| `src/**/*.{ts,tsx}` | 65,126 |
| ├─ `src/lib` | 40,847 |
| ├─ `src/components` | 17,254 |
| ├─ `src/app` (incl. `api` 2,995) | 5,237 |
| ├─ `src/ai` | 1,289 |
| └─ `src/types` | 394 |
| `src/app/globals.css` | 8,793 |
| `scripts/` + `e2e/` | 23,969 |
| **Total** | **~98,000** |

Notable individual sizes: `src/lib/capture` 8,313 · `src/lib/eval-capture-v2` 4,031 · `src/lib/evals` 4,059 · `src/lib/store.tsx` 2,722 · `src/lib/tell-me` 2,654 · `src/lib/capture-v2` 1,490 · `src/lib/seed.ts` 1,194 · `src/lib/knowledge-centre` 1,136 · `src/lib/canonical-truth` 733 · `src/lib/people` 634 · `src/lib/capture/suggestions.ts` 638 · `src/lib/capture/apply/dispatch.ts` 788 · `src/lib/billing` 441 · `src/lib/openai.ts` 434 · `src/lib/supabase` 281 · `src/lib/ai-gate.ts` 187.

---

# A. Technical executive verdict

**The head start is real but it is roughly half the size Part 1 implied, and it is concentrated in design and test discipline rather than in reusable code.**

Three findings drive that, in descending order of importance.

**One. Part 1's strongest reuse claim is wrong.** Part 1 said change intelligence was "potentially one of the strongest areas of Lume reuse." It is not. `history_events` has columns for `type`, `title`, `detail`, `source` and `created_at` and **no columns for entity, field, old value or new value**. Where a change is recorded at all, the diff is assembled as English prose and stuffed into `detail`:

```1127:1167:/workspace/src/lib/store.tsx
      const changes: string[] = [];
      if (before.title !== next.title) {
        changes.push(`Title:\n${before.title} → ${next.title}`);
      }
...
        makeHistoryEvent({
          type: "task_updated",
          title: "You updated a To Do",
          detail: `${next.title}\n${changes.join("\n")}`,
```

That is a feed, not a change API. The one genuine supersession mechanism — `knowledge_items.supersedes_id` plus `lifecycle` — yields a *previous body string* for knowledge items only, and is read in exactly one place (`previousBodyFor` in `src/lib/knowledge-centre/knowledge-item-detail.ts`). Dates, todos, risks and milestones have **no supersession at all**. So the wedding product's headline capability — "the deadline moved from 19 May to 12 May", "the bus went from booked to cancelled" — requires new primitives. This is net-new work, not reuse, and it sits directly on the differentiator.

**Two. There is no domain configuration anywhere.** The PM ontology is hardcoded in at least eight parallel places that must be kept in agreement: `OBSERVATION_DOMAINS` (`src/lib/capture-v2/types.ts`), `CAPTURE_LEGAL_DOMAINS` and `CaptureLegalOperation` (`src/lib/capture/apply/types.ts`), `SuggestionKind` (`src/lib/capture/suggestions.ts`), `AIEntityType` (`src/ai/domain/types.ts`), the `DOMAIN_TO_KIND` / `DOMAIN_TO_LEGAL` maps (`src/lib/capture-v2/resolve.ts`), `classifyCaptureLegalDomain` (`src/lib/capture/apply/classify.ts`), and the prose ontology in `src/ai/domain/project-domain.md`. Retargeting is therefore a rewrite threaded through the whole pipeline, not a configuration swap.

**Three. Several safety mechanisms Part 1 credited as transferable are themselves PM-specific.** `fingerprintExpectedTarget` and `staleExpectedTargetReason` (`src/lib/capture/apply/expected-target.ts`, 162 lines) branch on risk / todo / milestone / person and read `world.risks`, `world.todos`, `world.timeline`, `world.stakeholders`. `personLinkedIdentityGate` (`src/lib/capture-v2/resolve.ts`) is written against stakeholders. Only four things in the safety layer are genuinely domain-agnostic: `validateObservations`' foreign-ID and cross-scope rejection, `recordedPersonNameAppearsInText`, `resolveCaptureProjectScope`, and `requireAiCaller`.

**What survives the audit intact** is the part that matters most and is hardest to value: the *architecture*. Model emits observations with evidence and never an operation; deterministic code decides; a closed operation set with no generic fallback; `needs_you` as a first-class outcome equal to `write`; fail-closed scope resolution; and an eval harness that scores the containment layer separately from the model. Knowing that this shape works, and having a test corpus format that measures it, is worth more than any of the code — and none of it appears in a line count.

**Consequence for the plan.** The refit is **60–75%**, not the 20–30% the "unfair head start" framing implies (Section Q). That does not kill the opportunity, because Part 1's commercial case never rested on refit cost. It does kill two things: the idea that a wedding product is a quick rename, and the idea from Part 1 §Z.20 that the validation demo and the first product increment could be the same piece of work. They cannot. The validation artefact must be throwaway.

---

# B. Part 1 assumptions changed

| Part 1 assumption | Part 2 finding | Impact |
| --- | --- | --- |
| "Change intelligence… potentially one of the strongest areas of Lume reuse" (§S, §Q) | **False.** No field-level change primitives exist. `history_events` has no old/new value columns; supersession exists only for `knowledge_items` bodies. | **Major.** Moves the differentiator from reuse to net-new build. |
| "Stale-target fingerprinting" transfers (§P.2) | **Partly false.** `expected-target.ts` is entirely PM-entity-branched. The *idea* transfers; the code does not. | Moderate. |
| "Lume's existing `namesMatchExact` gate is exactly right and should transfer unchanged" (§O.5) | **Half true.** `recordedPersonNameAppearsInText` and `namesMatchExact` are domain-agnostic (`src/lib/people/identity.ts` L35–59). The gate that calls them, `personLinkedIdentityGate`, is stakeholder-specific. | Minor. |
| "The schema is not the hard part… the apply boundary is the centre of gravity" (§N.11) | **Confirmed and understated.** `dispatch.ts` is 788 lines of per-domain planners; `suggestions.ts` 638; review layer ~1,800; legacy `findings/` ~2,200. | Moderate — raises the estimate. |
| "Roughly ten tables reuse with a rename" (§N.10) | **Confirmed.** Schema really is the easy part. | None. |
| Terminology translation is a light task (§K) | **False.** **There is no i18n layer.** All copy is inline in JSX and TS constants (`TYPE_LABELS` in `src/app/history/page.tsx`, `CONFIDENCE_LABEL` in `src/lib/tell-me/answer.ts`, sidebar strings in `src/components/app-shell/Sidebar.tsx`). A rename is a manual sweep across ~17k lines of components. | Moderate. |
| Ocean theme is portable | **False.** `globals.css` is a single 8,793-line stylesheet coupling design tokens to every feature class (`.ocean-*`, capture, coach, history). Tokens are reusable; the stylesheet is not a package. | Minor. |
| Knowledge Centre frames are data-driven | **Half true.** `src/lib/knowledge-centre/ocean-frames.ts` provides data *row builders*, but which frames exist and their titles are hardcoded JSX in `OceanKnowledgeFrames.tsx` (443 lines). | Minor. |
| "Project intelligence snapshots… the natural foundation for Catch Me Up" (§Z.14) | **Confirmed as a foundation, but there is no "since X" generator anywhere.** `buildDeterministicSnapshot` is a current-state digest; freshness is a revision counter. | Moderate. |
| Eval harness transfers with a new corpus (§Z.1) | **Confirmed.** `BenchmarkCase` in `src/lib/eval-capture-v2/types.ts` is a clean, domain-neutral case shape (`material`, `allowedDomains`, `prohibitedWrites`). Authoring a wedding corpus is structurally easy and semantically hard. | Positive — one of the few claims that strengthened. |
| Voice capture exists and transfers (§M) | **Confirmed** — `/api/transcribe` → `whisper-1`. But there is **no mobile-specific UI, no offline queue, no background recording**. | None (Part 1 already said this). |
| Reminders are absent | **Confirmed emphatically.** No scheduler, no cron, no notification table, no email or push infrastructure of any kind. | None. |

One Part 1 conclusion is *strengthened* by the audit: the recommendation to keep the wedding data model small. Every new legal operation costs edits in seven places (Section G.2). A model that expands towards wedding ERP would multiply that cost linearly.

---

# C. Shared-core reality

Assessed against the fifteen candidates in the brief, using measured code rather than intent.

| Candidate | Verdict | Evidence |
| --- | --- | --- |
| **Auth** | **Shared unchanged** | `src/app/api/auth/*`, `src/lib/auth-mode.ts`, `src/proxy.ts`, `src/lib/supabase/{client,server,service}.ts` (281 lines). Zero domain knowledge. |
| **Accounts / workspaces** | **Shared unchanged** | `workspaces`, `workspace_members`, `is_workspace_member`, `ensure_personal_workspace`. Tenancy is domain-neutral. |
| **Billing** | **Shared unchanged** | `src/lib/billing` (441 lines), Stripe checkout/portal/webhook, `evaluateEntitlement`. Needs a plan catalogue (Section O) but no domain change. |
| **AI gateway** | **Shared unchanged** | `src/lib/ai-gate.ts` (187 lines) — auth + entitlement + rate limit. The single cleanest reusable module in the codebase. |
| **Extraction infrastructure** | **Split** | Transport (`extract.ts`, `openai.ts` wrappers) and envelope parsing/validation (`capture-v2/validate.ts`, 265 lines) are generic. Prompt, context assembly and result mapping are PM-specific. Roughly **655 of ~9,800 lines** across `capture/` + `capture-v2/` are domain-free. |
| **Review** | **Conceptually similar but too PM-specific** | `src/lib/capture/review/*` (~1,800 lines): `reviewReason.ts` encodes ownership/risk/stakeholder copy; `viewModel.ts` encodes PM kinds. The *interaction pattern* is the asset. |
| **Ambiguity** | **Worth keeping as a pattern, not code** | The three-way `CaptureApplyDecision` union is a 15-line type and a design decision. Copy the type; rewrite what fills it. |
| **Identity / entity resolution** | **Split** | `namesMatchExact` / `recordedPersonNameAppearsInText` shared unchanged. `personLinkedIdentityGate` and `confirmResponsibilityOwner` are PM/stakeholder-shaped. |
| **Source / evidence** | **Worth extracting conceptually; small in code** | The evidence-quote requirement lives in a prompt line and an observation field. `provenance` jsonb on `knowledge_items` is a schema pattern. Very little code, very high value. |
| **Persistence** | **Keep product-specific** | `persist-mutations.ts` and `persist-execute.ts` write PM tables by name. Only the Supabase client factories are shared. |
| **History / change intelligence** | **Keep product-specific — and mostly build new** | See Section A. |
| **Q&A (Tell Me)** | **Conceptually similar but too PM-specific** | `src/lib/tell-me` (2,654 lines). The pipeline shape — scope → select records → serialise → deterministic fast path → one model call — is excellent and transferable. The contents are not: the system prompt says "a project memory recall assistant for project managers", and `SUPERSESSION_TOPICS` in `context.ts` literally contains `"snyk"`, `"go-live"`, `"cab "`, `"msa"`. |
| **Catch Me Up** | **New** | Does not exist. No "since X" generator anywhere. |
| **Test utilities** | **Worth extracting now — the strongest candidate in the list** | `scripts/run-regression-suite.ts` (101 lines, generic spawn orchestrator) and `scripts/lib/fake-supabase-workspace.ts` (363 lines, tenant-aware fake client) are ~85% domain-neutral. The `BenchmarkCase` shape is domain-neutral. |
| **UI primitives** | **Split** | `src/components/workspace/*` (frame packing/expand), `DetailModal`, `auth/AuthShell`, `billing/*`, `PersonEntity` (17 lines), `EpistemicChip` (17 lines) are unchanged. Everything above that is PM product surface. |

## C.1 The measured size of the true shared core

| Module | Lines | Status |
| --- | ---: | --- |
| `src/lib/supabase/*` | 281 | Unchanged |
| `src/lib/billing/*` | 441 | Unchanged |
| `src/lib/ai-gate.ts` | 187 | Unchanged |
| `src/app/api/auth/*` + `auth-mode.ts` + `proxy.ts` | ~500 | Unchanged |
| `capture-v2/validate.ts` + `flag.ts` + `account.ts` | ~354 | Unchanged |
| `apply/project-scope.ts` + `execute.ts` + `apply-approved.ts` | ~301 | Unchanged / enum-swap |
| `people/identity.ts` name helpers | ~30 | Unchanged |
| `scripts/run-regression-suite.ts` + `scripts/lib/fake-supabase-workspace.ts` | ~464 | Unchanged |
| UI primitives (workspace frames, modal, auth shell, billing, chips) | ~700 | Unchanged |
| **Total genuinely domain-free** | **~3,250** | **~3.3% of ~98,000** |

**That is the honest number.** Three per cent of the codebase transfers without thought. The remainder either changes, is deleted, or is valuable only as a design precedent.

Two qualifications keep this from being as damning as it sounds. First, the 3.3% is disproportionately the *boring* infrastructure — auth, tenancy, billing, entitlement, deployment — which is a genuine multi-week saving and is exactly the work founders most often underestimate. Second, and larger: the design precedent is worth substantially more than the code. Arriving at "the model must not emit operations", "needs_you is a first-class outcome", and "measure containment failures separately from model failures" took this codebase many months and an eval harness to discover. Starting a wedding product already knowing those three things is the head start.
---

# D. Recommended architecture

## D.1 The six options compared

Scored 1–5, where 5 is best. "Founder overhead" and "premature abstraction risk" are scored so that 5 means *low* burden and *low* risk.

| | 1. Fork | 2. Monorepo + shared packages | 3. One app, product config | 4. Shared backend, separate frontends | 5. Shared services, separate apps | 6. Fork now, extract later |
| --- | :--: | :--: | :--: | :--: | :--: | :--: |
| Implementation speed | **5** | 2 | 3 | 2 | 1 | **5** |
| Maintenance (2 products) | 2 | 4 | **5** | 4 | 3 | 3 |
| Regression risk | **5** | 2 | **1** | 2 | 3 | **5** |
| Deployment | **5** | 3 | **5** | 3 | 2 | **5** |
| Branding separation | **5** | **5** | 2 | 4 | **5** | **5** |
| Auth | 3 | 4 | **5** | **5** | **5** | 3 |
| Billing | 3 | 4 | 4 | **5** | **5** | 3 |
| Data isolation | **5** | 4 | 2 | 2 | 3 | **5** |
| Schema evolution | **5** | 3 | 1 | 1 | 2 | **5** |
| Testing | 4 | 4 | 2 | 3 | 3 | 4 |
| Founder overhead | 3 | 2 | 4 | 1 | 1 | 4 |
| Third-product potential | 2 | **5** | 3 | 4 | **5** | 4 |
| Premature-abstraction risk | **5** | 1 | 2 | 2 | 1 | 4 |

## D.2 Recommendation: **fork, with a disciplined copy list and a deferred extraction trigger** (option 6)

The argument turns on one measured fact from Section C: **the genuinely shared code is about 3,250 lines, and it is commodity infrastructure.** Extracting 3,250 lines of auth, billing and Supabase plumbing into a shared package buys almost nothing and costs a package boundary, a versioning story, a release process and a coupling that will be regretted.

More decisively: **you cannot extract a shared core that does not exist.** There is no `OntologyConfig`, no domain registry, no pluggable domain pack — the ontology is threaded through types, planners, world assembly, prompts, review copy and persistence in eight parallel places. A "shared capture core" would therefore have to be *invented*, designed against exactly one proven domain (PM) and one hypothetical one (weddings). That is the textbook definition of premature abstraction, and the brief explicitly warns against it.

Three further reasons, each sufficient on its own:

**Lume V1 is not shipped.** Capture V2 — the pipeline with the containment boundary — is behind `LUME_CAPTURE_V2` and is not the default. Twenty-six open discoveries are tracked. Extracting a shared core now would freeze Lume's architecture at a moment when it still needs to change, and would make every Lume fix a two-product regression event.

**Option 3 is the trap that looks like the answer.** One app with a product configuration flag scores well on maintenance and deployment and catastrophically on regression and schema evolution. It means every wedding schema change touches the database Lume's paying customers depend on, and every Lume prompt change risks the wedding product. For a solo founder with no staging discipline beyond a deterministic PR suite, that is the fastest route to breaking both products at once.

**The data must be separately deletable.** Section N requires per-account deletion under GDPR with a wedding-specific retention policy. Separate Supabase projects make that trivially provable. A shared database makes it a query you have to get right.

## D.3 What "disciplined fork" means concretely

Copy verbatim, and accept the duplication permanently:

`src/lib/supabase/*` · `src/lib/billing/*` · `src/lib/ai-gate.ts` · `src/app/api/auth/*` · `src/lib/auth-mode.ts` · `src/proxy.ts` · `src/components/{auth,billing,workspace}/*` · `DetailModal.tsx` · the `workspaces` / `workspace_members` / `profiles` / billing migrations · `scripts/run-regression-suite.ts` · `scripts/lib/fake-supabase-workspace.ts` · CSS custom-property token block from `globals.css` (not the stylesheet) · `vercel.json`, `next.config.ts`, `eslint.config.mjs`, `playwright.config.ts`.

Separate Supabase project. Separate Stripe product and price. Separate Vercel project and domain. Separate repository.

**The extraction trigger, written down in advance so it is not relitigated:** extract a shared package only when *both* (a) a third product exists or is committed to, and (b) the same file has had to be changed in lockstep in two products at least twice. Until both are true, duplication is the cheaper option.

## D.4 Where duplication is genuinely dangerous

One exception to the "duplicate freely" rule. **The Stripe webhook handler and the entitlement evaluator are security-sensitive and idempotency-sensitive.** A bug fixed in one product and not the other is a billing incident. These are ~200 lines. The pragmatic answer is not a shared package but a written note in both repositories pointing at the other, plus the same test file copied into both suites. If that proves insufficient after the first divergence, it is the first and only candidate for extraction.

---

# E. Wedding data architecture

## E.1 Should `projects` remain the internal wedding container?

**Yes — rename the table, keep the shape.** `projects` already carries workspace scoping, an owner, RLS, and a foreign key from every domain table. Every scoping helper (`resolveCaptureProjectScope`, `loadProjectScopedWorkspace`, `filterMissionStateToProject`) and every isolation test (`verify-d035-project-isolation.ts`) is built on it.

**The semantic debt of doing so, stated honestly**, because "just rename it" hides real cost:

- **Columns that become dead weight or lies:** `kind` (`delivery` / `release_ops`), `status` (`healthy` / `watch` / `at_risk`), `release_month`, `merge_on`, `release_on`, `current_focus`, `next_milestone`, `next_milestone_on`, `is_template`, `cloned_from_id`. Leaving them is how a schema rots. Drop them in the fork.
- **`project_id` as a column name persists everywhere** — in `CaptureLegalOperation`, in every persist helper, in the world shape, in every test. Renaming to `wedding_id` is a large mechanical diff with real risk in a codebase with no i18n and hand-rolled validation; leaving it is a permanent readability tax on a wedding product. **Recommend renaming in the fork, once, at the start.** It is far cheaper on day one than in month six, and Part 1's semantics work (§K) is worthless if the code says "project" throughout.
- **`code` (project code) has no wedding analogue.** Drop it — and note it carries open debt anyway (D-026: no unique constraint on `(workspace_id, code)`).

## E.2 Entity-by-entity technical mapping

| Concept | Technical treatment | Classification |
| --- | --- | --- |
| **Wedding** | `projects` → `weddings`; drop the PM columns above; add `wedding_date`, `venue_supplier_id`, `couple_label`, `engagement_type`, `archived_at`. | **V1 requirement** |
| **Couple** | **Not a table.** Two nullable person references plus `couple_label` text on the wedding. A join table for two rows is overhead, and the label ("Laura & James") is what the UI and every prompt actually use. | **Derivable** |
| **Person** | `stakeholders` → `people`; keep `name`, `role`, `preferences` jsonb, `concerns` jsonb, `last_contact_at`; add `relationship_to_couple`, nullable `supplier_id`. | **V1 requirement** |
| **Vendor / Supplier** | **New table**, workspace-scoped rather than wedding-scoped, so it persists across weddings. Thin: `name`, `category`, `is_venue`. | **V1 requirement** — see Section F |
| **Wedding↔Supplier** | **New join table** carrying `booking_state` and `is_venue_for_this_wedding`. This is where booking state lives; it is per-wedding, not per-supplier. | **V1 requirement** |
| **Vendor contact** | A `people` row with `supplier_id` set. No new table. | **Derivable** |
| **Venue** | A supplier with `is_venue`, referenced from the wedding. No separate table. | **Derivable** |
| **Responsibility** | `knowledge_items` with `kind = 'responsibility'` and `meta.responsibility.*`, exactly as today (`src/lib/people/identity.ts`). Concurrent `lifecycle = 'current'` rows already supported. **The single best-fitting existing mechanism in the codebase.** | **Derivable — reuse as-is** |
| **Action** | `todos` renamed; keep `kind` enum. | **V1 requirement** |
| **Commitment** | `todos` with `kind = 'WAITING'`/`'CHASE'`, plus a new `owner_person_id` / `owner_supplier_id` to replace free-text `waiting_on`. | **V1 requirement** (small extension) |
| **Decision** | **Promote to first-class.** Part 1 §N requires it and Lume has only a knowledge section and an optional `kind`. Needs a state machine (Section H), which prose cannot carry. | **V1 requirement — new** |
| **Key date** | `milestones` renamed; replace the type enum with `wedding_day` / `deadline` / `appointment` / `payment_due` / `supplier_milestone`; add `supplier_id`, `owner_person_id`. | **V1 requirement** |
| **Issue** | `risks` renamed; statuses map 1:1. Lifecycle authority module (`src/lib/risks/lifecycle.ts`) transfers with a rename. | **V1 requirement** |
| **Reminder** | **New subsystem entirely.** No scheduler, cron, notification table, email or push exists. | **V1 requirement if the habit loop in Part 1 §I is to work; otherwise V1.1** |
| **Change record** | **New table.** `entity_type`, `entity_id`, `field`, `previous_value`, `new_value`, `changed_at`, `source_capture_id`, `evidence_quote`. Written at apply time. See Section I. | **V1 requirement — new** |
| **Evidence** | Extend `provenance` jsonb from `knowledge_items` to all domain rows, or carry it on the change record. The change record is the cheaper place. | **V1 requirement** |
| **Selection** | **Avoid as a separate concept.** A Decision with a state and an optional `supplier_id`. | **Avoid** |
| **Payment** | **Avoid.** Only the deposit *deadline*, as a Key Date of type `payment_due` with optional free-text amount. No ledger, no balances. | **Avoid (deadline only)** |
| **Guest count** | Small table of dated, evidenced values with `count_type` ∈ `estimated`/`confirmed`/`final`. Three columns and a foreign key. | **V1 requirement — minimal** |
| **Wedding-day timeline** | **Future expansion.** Part 1 §N.9. The V1 bridge is a read-only assembled "what I know about the day" view over data already held — a query, not a schema. | **Future expansion** |

## E.3 Tables to delete outright

`releases`, `coach_sessions`, `memories`, `recommendations`, `meetings`. Together with `src/lib/seed.ts` (1,194 lines of PM demo data), `src/lib/release-playbook.ts`, `src/lib/coach.ts` (480) and `src/lib/pm-coach.ts` (484).

`memories` deserves a specific note: Part 1 recommended discarding it because it duplicates `knowledge_items`, and the audit confirms it is a second free-form store feeding a legacy `/memory` page. Carrying it into a new product would import the exact duplication Lume's own constitution identifies as its principal architectural debt (§18 of the philosophy document).

## E.4 Net schema assessment

Roughly ten tables rename, four extend, five are deleted, and four are new (`suppliers`, `wedding_suppliers`, `decisions`, `changes`, plus a small `guest_counts`). **Part 1 was right that the schema is the easy part** — this is perhaps a week of migration work. The cost is downstream: every new table needs persist helpers, world-assembly entries, planner branches, apply operations, hooks in two executors, and tests.

---

# F. People and vendor architecture

## F.1 Can the existing model carry the wedding cast?

The relevant mechanism is scoped responsibility: a person is a `stakeholders` row; what they are responsible for is a `knowledge_items` row with `kind = 'responsibility'` and `meta.responsibility.{personId, personName, scope, ownerConfirmed}`, with **multiple concurrent `lifecycle = 'current'` rows permitted** and handover implemented by marking prior rows superseded:

```206:212:/workspace/src/lib/people/identity.ts
  const markSuperseded = (id: string) => {
...
    structured[ri] = { ...cur, lifecycle: "superseded" };
```

Assessed against the wedding cast:

| Role | Supported? |
| --- | --- |
| Couple | Yes — two people plus a label on the wedding. |
| Parent / family member | Yes — a person with a relationship field. Their *responsibilities* are already expressible ("Laura's mother · ceremony flowers"). |
| Florist, photographer (the business) | **No.** These are organisations, and there is no organisation entity. |
| Supplier contact ("Maria at the florist") | Partially — a person, but with no link to the business. |
| Venue coordinator | Same gap. |
| The planner | Yes — the account owner. |
| Responsibility changing over time | **Yes, and unusually well.** This is the strongest existing fit in the codebase. |

**The verdict is precise: the model handles people and responsibilities excellently and has no concept of an organisation at all.**

## F.2 Should Vendor be a typed organisation, a person with metadata, a separate table, or later?

**A separate table, workspace-scoped, and in V1.**

Rejecting the alternatives on evidence rather than taste:

*Person with metadata* fails on a specific and dangerous case. "Maria is on holiday" must not mean the florist is unavailable, and "the florist cancelled" must not mean Maria left. If both are person rows distinguished only by a flag, the identity gate cannot tell them apart, and Section H shows that mis-recording a supplier's booking state is the most commercially dangerous failure in the domain.

*A typed entity inside `people`* is the same failure with extra branching.

*Later* fails because booking state has to live somewhere from day one, and retrofitting an organisation entity after captures have populated free-text supplier names means a migration that requires fuzzy matching — the exact thing the codebase has deliberately avoided.

*Workspace-scoped rather than wedding-scoped* is the non-obvious part and it is deliberate. The same florist recurs across a planner's portfolio, and Part 1 §S identified cross-wedding supplier knowledge as a compounding switching cost. Per-wedding suppliers would throw that away.

Booking state belongs on the **join**, not the supplier: a florist is `booked` for one wedding and `shortlisted` for another simultaneously.

## F.3 Implications for identity resolution — the significant new risk

Workspace-scoped suppliers reintroduce the problem the codebase has most carefully avoided. Today, every identity decision is scoped to one project and resolved by exact full-name match; a model-supplied ID is treated as intent, not proof. A cross-wedding supplier table means the question "is this the same florist as on the Hartley wedding?" is now askable, and the temptation to answer it with fuzzy matching is exactly the temptation the constitution warns against (§20: "deterministic code must not become a homemade language model").

**Recommended rule, and it should be treated as a hard constraint on the fork:**

1. Within a wedding, resolution stays exactly as it is today — exact full name, present in the capture text, else `needs_you`.
2. **Cross-wedding supplier linking is never automatic.** When a new supplier name is created, the UI may *offer* an existing workspace supplier with a similar name as a one-tap suggestion. It is a UI affordance the planner confirms, never a resolution the extractor performs.
3. Supplier categories may resolve definite references only when unambiguous within the wedding — "the venue" resolves via `is_venue`; "the florist" resolves only when exactly one florist is attached to that wedding, otherwise `needs_you`.

Rule 3 is worth flagging as a genuine product risk. Part 1 §Z.4 asked how often the exact-name gate would fire on real wedding language, and the answer determines whether the review queue is tolerable. Planners say "the florist", "the venue", "Laura's mum" constantly and use full names rarely. **Category-based definite reference resolution is not an optimisation here — it is probably the difference between a usable product and an unusable one**, and it should be measured on real transcripts before anything else is built.
---

# G. Capture engine refit

## G.1 Anatomy: what is generic, what is PM

The pipeline is **extract → validate → resolve → plan → execute → review**. The control flow and the decision *shape* are reusable; the ontology, world, planners, prompts and persistence are not.

| Layer | Files | Lines | Verdict |
| --- | --- | ---: | --- |
| Feature flag | `capture-v2/flag.ts` | 11 | Generic |
| Envelope parse + ID/scope validation | `capture-v2/validate.ts` | 265 | **Generic** — `foreign_id` / `cross_project_id` rejection has no domain knowledge |
| Observation types | `capture-v2/types.ts` | 91 | Generic with domain enum |
| Extraction transport | `capture-v2/extract.ts` | 92 | Generic; PM prompt |
| Prompt | `capture-v2/prompt.ts` | 46 | PM-specific (small, easy) |
| Prompt context assembly | `capture-v2/context.ts` | 85 | PM-specific |
| Resolve (observation → suggestion) | `capture-v2/resolve.ts` | 385 | PM-specific |
| Result mapping | `capture-v2/toResult.ts` | 253 | PM-specific |
| World loading | `capture-v2/server-truth.ts` + `apply/world.ts` | 137 | PM-specific |
| Scope resolution | `apply/project-scope.ts` | 86 | **Generic** |
| Legal domains + operations | `apply/types.ts` | 236 | PM-specific |
| Kind → domain classification | `apply/classify.ts` | 137 | PM-specific |
| **Planners** | `apply/dispatch.ts` | **788** | PM-specific |
| Execution dispatcher | `apply/execute.ts` | 110 | **Generic with domain enum** |
| Supabase hooks | `apply/persist-execute.ts` | 220 | PM-specific |
| In-memory hooks | `apply/memory-execute.ts` | 240 | PM-specific |
| Stale-target fingerprint | `apply/expected-target.ts` | 162 | PM-specific |
| Server apply orchestration | `apply/apply-approved.ts` | 105 | **Generic** |
| Suggestions | `capture/suggestions.ts` | 638 | PM-specific |
| Review layer | `capture/review/*` | ~1,800 | PM-specific |
| Legacy findings pipeline | `capture/findings/*` | ~2,200 | PM-specific — **delete** |
| AI domain vocabulary | `src/ai/domain/*` | 1,289 | PM-specific |

Roughly **655 of ~9,800 lines** in the capture engine are domain-free.

## G.2 The cost of one new operation

Measured, not estimated. Adding a single legal operation requires edits in **seven places**:

1. `apply/types.ts` — new member of the `CaptureLegalOperation` union
2. `apply/execute.ts` — new method on `CaptureApplyHooks`
3. `apply/execute.ts` — new `case` in the exhaustive `switch (op.type)`
4. `apply/memory-execute.ts` — new `case` in `applyCaptureOperationInMemory`
5. `apply/memory-execute.ts` — wire the hook into `memoryCaptureApplyHooks`
6. `apply/persist-execute.ts` — implement the Supabase persist
7. `apply/dispatch.ts` — emit it from the relevant planner

If it needs a *new domain* as well, add: `CAPTURE_LEGAL_DOMAINS`, `classifyCaptureLegalDomain`, the `switch (domain)` in `planCaptureApply`, `OBSERVATION_DOMAINS`, the `DOMAIN_TO_KIND` / `DOMAIN_TO_LEGAL` maps in `resolve.ts`, the schema string in `prompt.ts`, and `SuggestionKind`. **Fifteen edit sites.**

The exhaustive `switch` with `assertNever` means the compiler finds most of them, which is genuinely good engineering. It does not make the work smaller. **This is the single strongest technical argument for Part 1's insistence on a minimal domain model.**

## G.3 The eight Part 1 examples, costed

| Example | Mechanism | Complexity |
| --- | --- | --- |
| **Responsibility changed** ("Laura's mum now does ceremony flowers") | Existing `confirm_responsibility` + `replacePersonId`, with `share`/`replace`/`continue`/`ambiguous` semantics and the Confirm Owner dialog. | **Lowest — near-direct reuse.** The best-fitting case in the entire domain. |
| **Date moved** ("final numbers by 12 May") | Existing `update_milestone` shape. Needs the previous value written to the change record. | **Low.** |
| **Decision confirmed** ("they chose menu B") | New domain, new entity, new operations, new planner. | **Medium.** |
| **Tentative choice** ("leaning towards menu B") | Same as above plus a state value. The *interesting* part is free once Decision exists. | **Low, given Decision.** |
| **Vendor cancelled** ("the vintage bus is cancelled") | New supplier + join entity; a booking-state transition operation; and the change record. | **Medium.** |
| **Supplier booked** ("the photographer is booked") | Same operation, but it is a *state upgrade* and therefore must route to review with a disambiguating question ("signed, or agreed verbally?"). Requires a new review-card interaction type, not just a new operation. | **Medium-high.** |
| **Deposit paid** | Deliberately not modelled as a payment. A `payment_due` key date. | **Low — because it was descoped.** |
| **Guest number changed** ("down to about 95") | New small entity, one append-only operation, plus extraction of an approximate number with a type. "About 95" is `estimated`, not `confirmed` — that distinction must survive extraction. | **Medium.** |

Three genuinely new domains (supplier/booking, decision, guest count) at fifteen edit sites each, plus new review interactions for state upgrades. **Nothing here is hard. All of it is work, and none of it is configuration.**

## G.4 Which approach?

The brief offers: same engine with a domain contract; separate domain layer on shared infrastructure; separate engine; or another solution.

**Recommendation: a separate engine in the fork, built by copying the Capture V2 architecture and rewriting the ontology-bearing layers — and V2-only, with the legacy findings pipeline deleted on day one.**

*Same engine with a domain contract* is rejected because the contract does not exist and would have to be designed against one real domain and one hypothetical one. It is also the option that couples two products at their most safety-critical seam.

*Separate domain layer on shared infrastructure* sounds like the sophisticated answer and fails on measurement: the shared infrastructure underneath the domain layer is ~655 lines. A package boundary around 655 lines of validation and scope helpers is not worth its own release process.

*Separate engine* — meaning a rewrite that ignores Lume — throws away the design, which is the actual asset.

The recommended path keeps the design and rewrites the ontology. Concretely: copy `validate.ts`, `project-scope.ts`, `execute.ts`, `apply-approved.ts`, `flag.ts` and `account.ts` verbatim; copy the *shape* of `resolve.ts`, `dispatch.ts` and `expected-target.ts` and rewrite their bodies for wedding entities; write new `prompt.ts`, `context.ts`, `server-truth.ts`, `persist-execute.ts` and `memory-execute.ts`; delete `findings/*` (~2,200 lines) and the legacy `openai.ts` capture path entirely.

**Deleting the legacy pipeline is the highest-value single decision in the refit.** It removes ~2,200 lines, resolves open debt D-032 and D-033 by construction, means the wedding product has exactly one capture path from day one, and means every one of Lume's V2 containment guarantees applies by default rather than behind a flag.

---

# H. Certainty and status model

## H.1 Can the existing model represent the states?

| State | Existing representation | Adequate? |
| --- | --- | --- |
| `considering` | none | No |
| `shortlisted` | none | No |
| `awaiting confirmation` | partial — `TodoKind.WAITING`, `NeedsConfirmationItem` | Not for suppliers |
| `verbally agreed` | none | No |
| `booked` | none | No |
| `deposit paid` | none | No (deliberately descoped) |
| `final` | partial — `epistemic` on knowledge items, `ownerConfirmed` on responsibilities | Not generally |
| `cancelled` | none for bookings; `risks.status = 'resolved'` for risks | No |

The codebase has **three unrelated status mechanisms**: `risks.status` (`open`/`watch`/`resolved`/`accepted`), `todos.done` (a boolean), and the `epistemic` / `lifecycle` columns on `knowledge_items`. There is no general status machinery, and `src/ai/domain/audits/status-consistency.ts` exists precisely because this inconsistency was already recognised as debt.

## H.2 Recommendation: domain-specific state on two entities only

Explicitly **not** a generic status model. A generic state machine would be machinery in search of a use, and Lume's own audit shows that even three ad-hoc status schemes already cause confusion.

Two state fields, on two entities:

**`wedding_suppliers.booking_state`** ∈ `considering | shortlisted | verbally_agreed | booked | cancelled`. Five values, per Part 1 §O.3, with `deposit_paid` deferred — it drags the product towards financial tracking, and the deposit is better represented as a Key Date.

**`decisions.state`** ∈ `open | leaning | decided | changed | reversed`.

Everything else stays as it is. Guest count carries a `count_type` which is a *kind of value*, not a lifecycle. Issues keep the existing risk statuses. Responsibilities keep `ownerConfirmed`. Actions keep `done`.

The important architectural point: **the two new state fields are the only places a state *transition* can occur, so they are the only places that need transition guards.** Concentrating the danger in two fields rather than spreading a generic status model across ten entities is what makes the guard in H.3 affordable.

## H.3 The transition rule that carries the product

One rule, and it is the most important sentence in this report:

> **Any transition towards greater certainty requires review. Any transition towards less certainty may be applied without review.**

`considering → booked` is a review. `booked → cancelled` is not. `leaning → decided` is a review. `decided → reversed` is not. `estimated → final` on guest count is a review; a revised estimate is not.

The asymmetry is the whole design. Recording something as *less* settled than reality causes a phone call. Recording it as *more* settled than reality causes a wedding-day failure. It is also mechanically cheap: an ordered enum and a comparison, evaluated in the planner, routing to `{ kind: "needs_you" }` — a decision shape the pipeline already has.

## H.4 Commercially dangerous status errors, ranked

1. **`verbally_agreed` or `shortlisted` recorded as `booked`.** The planner stops chasing. Discovered on the day. Catastrophic and irreversible.
2. **`cancelled` missed.** Same outcome by omission. Mitigated by the asymmetry rule making downgrades frictionless.
3. **`leaning` recorded as `decided`.** The couple is told their choice is confirmed; the caterer was never briefed.
4. **`estimated` guest count treated as `final`.** Direct financial consequence at the catering deadline.
5. **A booking state applied to the wrong supplier.** Two suppliers now wrong.
6. **A state changed on the wrong wedding.** Severe but usually noticed; already structurally prevented by cross-scope ID rejection.

Every item in the top four is a *certainty upgrade*. That is not a coincidence — it is why the rule in H.3 is worth building the whole state model around.

---

# I. Change intelligence reuse

## I.1 The finding

**This is where Part 1 was most wrong, and it matters because change intelligence is the differentiator.**

`history_events` (migration `20260812002748_workspace_schema.sql`) has `type`, `title`, `detail`, `project_id`, `source`, `created_at`. There is **no entity reference, no field, no previous value, no new value, and no link to the capture that caused it.** `HistoryEvent` in `src/lib/types.ts` mirrors that shape exactly.

Where a diff is captured at all, it is prose in `detail` — see the `store.tsx` excerpt in Section A. The history page renders `title` and `detail` as text. Nothing queries a change.

The one real supersession mechanism is `knowledge_items.supersedes_id` + `lifecycle`, written by `confirmResponsibilityOwner` and read in exactly one function:

```207:215:/workspace/src/lib/knowledge-centre/knowledge-item-detail.ts
function previousBodyFor(
  knowledge: ProjectKnowledge,
  item: CanonicalTruthItem,
): string | undefined {
  if (!item.supersedesId) return undefined;
  const prior = (knowledge.structured ?? []).find(
    (i) => i.id === item.supersedesId,
  );
  return prior?.body?.trim() || undefined;
}
```

That returns a *previous body string* for a knowledge item. Dates, todos, risks and milestones have no supersession whatsoever. And there are three tracked open discoveries in this exact area: D-004 (many history events never persist), D-005 (soft/invisible save failures), D-034 (no schema row versioning).

## I.2 Mapped against the wedding requirements

| Requirement | Supported today? |
| --- | --- |
| Date changed from X to Y | **No.** Timeline updates do not store the prior date. |
| Vendor changed | **No.** No vendor entity. |
| Responsibility changed A → B | **Yes** — the one case that works, via supersession plus the Confirm Owner flow. |
| Decision reversed | **No.** No decision entity, no state. |
| Booking cancelled | **No.** |
| Guest count moved | **No.** |
| Tentative → confirmed | **Partial**, for ownership and epistemic tags only. |
| Confirmed → cancelled | **No.** |

**One of eight.**

## I.3 What must be built

A single new table, written transactionally at apply time:

`changes(id, wedding_id, entity_type, entity_id, field, previous_value, new_value, changed_at, source_capture_id, evidence_quote, actor)`

Roughly eight columns and two indexes. It is not architecturally difficult. But it must be written **at apply time, inside the same operation as the mutation** — which means every one of the operations in Section G.2 gains a change-record write, and the two executor hooks (`persist-execute.ts` and `memory-execute.ts`) must both do it or the in-memory tests will diverge from production.

Once it exists, three Part 1 capabilities become straightforward queries rather than features: "what changed this week" (filter by date), "why does it say that" (join to evidence), and the Changes surface (Part 1 §L). Catch Me Up's "since when" becomes a timestamp comparison rather than a model call.

## I.4 Honest reframing of the advantage

Lume does not give the wedding product change intelligence. What it gives is:

- **The `supersedes_id` / `lifecycle` / `provenance` schema pattern** on `knowledge_items`, which is the right shape and can be generalised.
- **A working precedent** in `confirmResponsibilityOwner` for supersede-and-replace with a user-confirmation provenance entry.
- **The `EvidenceReveal` component and the detail-drawer "Previously" section** as UI precedent.
- **The knowledge that an event log is not enough** — learned the expensive way, recorded in D-004 and D-034, and now avoidable.

That last one has real value. A team building this from scratch would very likely build an event log first, ship it, and discover the gap when they tried to answer "what changed". **Knowing in advance that the change record must be first-class and written at apply time is worth more than the code that would have been reused.** But it should be described as a lesson, not as reuse — and Part 1's §S claim that change intelligence is a strong reuse area should be struck.

---

# J. UX-code mapping

## J.1 Classification

| Wedding surface | Nearest Lume code | Lines | Verdict |
| --- | --- | ---: | --- |
| Application shell | `src/components/AppShell.tsx`, `app-shell/{Sidebar,TopHeader,LumeThemePicker,AppearanceToggle}.tsx` | ~630 | **Terminology + branding.** Structure is sound. |
| Design tokens | CSS custom properties in `src/app/globals.css` | ~300 of 8,793 | **Unchanged** (tokens only — the stylesheet is not portable) |
| Frame mechanics | `src/components/workspace/*` | ~300 | **Unchanged** |
| Auth / account / billing screens | `auth/AuthShell.tsx`, `billing/*`, `app/account/page.tsx` | ~450 | **Unchanged / terminology** |
| **The week view** (Part 1's home screen) | Nothing. `app/todos/page.tsx` (35) is the closest precedent, plus the "✦ Lume Thinks" concept. | — | **New** |
| Wedding list | `app-shell/Sidebar.tsx` project list | ~226 | **Moderate refit** |
| Create wedding | `onboarding/NewProjectExperience.tsx` (743), `NewProjectCategorisation.tsx` (163), `ProjectSetupReview.tsx` (660) | ~1,566 | **Substantial refit** — the flow shape (talk/paste → categorise → review → create) is exactly right; the content is entirely PM |
| Wedding Picture | `knowledge-centre/OceanProjectWorkspace.tsx` (77) + `OceanKnowledgeFrames.tsx` (443) + `lib/knowledge-centre/ocean-frames.ts` (191) | ~711 | **Substantial refit.** Row builders are data-driven; the frame set and titles are hardcoded JSX |
| Item detail | `KnowledgeItemDetailDrawer.tsx` | 568 | **Moderate refit** — "Previously" and provenance sections are directly on-point |
| Capture | `capture/CaptureWorkspace.tsx` | 1,251 | **Substantial refit.** Interaction design is the asset; every label and kind is PM |
| Capture session state | `capture/CaptureSessionContext.tsx` | 981 | **Moderate refit** |
| Review | `capture/review/{SuggestedChangeCard,SuggestedChangesList,KnowledgeRememberList,...}` | ~920 | **Moderate refit** — plus one genuinely new card type for certainty-upgrade questions (Section H) |
| Confirm owner | `intelligence/ConfirmOwnerDialog.tsx` | 348 | **Moderate refit** — maps directly onto wedding responsibility handover |
| People & Suppliers | `intelligence/PersonEntity.tsx` (17) | 17 | **Mostly new** — no organisation UI exists |
| Decisions | Frame row builder only | — | **New** |
| Actions | `frames/TodoFrame.tsx` | 377 | **Terminology → moderate** |
| Key dates | `frames/TimelineFrame.tsx` (55), `ProjectTimelineGantt.tsx` (165) | 220 | **Moderate refit**; the Gantt is probably **unnecessary** in V1 |
| Issues | `frames/RiskFrame.tsx` | 267 | **Moderate refit** |
| Changes | `app/history/page.tsx` | 180 | **Substantial refit** — the underlying data changes shape entirely (Section I) |
| Ask | `tell-me/TellMePanel.tsx` (354), `TellMeSessionContext.tsx` (403), `KnowledgeSearchAskBar.tsx` (204) | ~961 | **Moderate refit** |
| Catch Me Up | Nothing | — | **New** |
| Call prep | `frames/MeetingPrepFrame.tsx` (160), `meetings/MeetingBriefModal.tsx` (250) | 410 | **Substantial refit** — Part 1 wants prep generated from truth on demand, not stored |
| Evidence display | `intelligence/EvidenceReveal.tsx` | 36 | **Terminology only** |
| Coach | `coach/*`, `CoachButton.tsx`, `app/coaching/page.tsx` | ~750 | **Delete** |
| Releases, RelOps clone, dashboard widgets, `/memory` | `app/releases`, `CloneRelOpsButton.tsx`, `ProjectWidgetGrid.tsx`, `DashboardChrome.tsx`, `app/memory` | ~1,000 | **Delete** |
| Evals / dev tooling | `components/evals/*`, `components/dev/*`, `app/evals`, `app/dev` | ~2,000 | **Keep as internal tooling**, not product |

## J.2 Does parameterising Lume's UI create maintainability problems?

**Yes, decisively, and this is the strongest UI-level argument for the fork.**

There is **no i18n layer and no string table**. Copy is inline in JSX and in TS constants scattered across the codebase — `TYPE_LABELS` in `app/history/page.tsx`, `CONFIDENCE_LABEL` in `lib/tell-me/answer.ts`, `"PROJECTS"` and `"New Project"` in `Sidebar.tsx`, `"Why does Lume think this?"` in `EvidenceReveal.tsx`, CAB references inside `tell-me/suggestions.ts`.

Introducing a product-parameterised string layer across ~17,000 lines of components would be a large, risky, low-value refactor of a product that has not shipped V1, and every subsequent Lume copy change would carry a wedding-side obligation. Worse, the differences are not vocabulary — they are structural. The wedding product's home screen does not exist in Lume, its Wedding Picture has a different frame set, its review needs a card type Lume has no use for, and it deletes Coach, Releases and Meetings. **A shared parameterised UI would have to express "these two products have different screens", which is not parameterisation; it is two applications sharing a repository.**

The correct unit of sharing at the UI layer is the **design-token block and roughly 700 lines of genuinely generic primitives** — copied, not packaged.
---

# K. Mobile and import cost

## K.1 Actual technical cost

| Capability | What exists | What is needed | Cost |
| --- | --- | --- | --- |
| **Quick text capture** | `CaptureWorkspace.tsx` textarea, responsive | A genuinely mobile-first entry point — the current surface is a 1,251-line desktop workspace | **Low-medium.** A small dedicated mobile route, not a responsive squeeze |
| **Voice capture** | `MediaRecorder` + `/api/transcribe` → `whisper-1`, plus optional Web Speech live transcript | Reliable upload, retry, visible pending/failed state, and behaviour when the screen locks | **Medium.** The recording exists; the *reliability* does not, and a silently lost voice note is worse than no feature |
| **Paste from messaging** | Textarea accepts paste | Prompt handling for timestamped multi-speaker format, including speaker attribution | **Low.** Mostly prompt and eval-corpus work |
| **Mobile review** | Review UI is desktop-shaped | A reduced surface: confirm ready, answer needs-you | **Medium** |
| **Text document ingestion** | **Nothing.** `addFileName` exists in the session API and is never called from any UI | Upload endpoint, PDF/DOCX text extraction, storage decision, extraction over long documents | **Medium-high.** Genuinely new, and it introduces file storage with its privacy consequences |
| **Offline queue** | Nothing | Local persistence of pending captures, retry, late-upload conflict handling against a changed world | **Medium.** The conflict case is the hard part, though `fingerprintExpectedTarget`'s staleness pattern is directly applicable |
| **Photo attachment** | Nothing | Storage, thumbnails, retention, deletion | **Medium** |
| **Email forwarding** | Nothing | Inbound mail infrastructure, per-wedding addressing, spoofing protection, thread de-duplication | **High** |
| **Photo/scan OCR** | Nothing | Vision model, accuracy work | **High** |
| **Native apps** | Nothing | — | **Very high** |

## K.2 Classification

**Launch-critical:** quick text capture on a mobile-first surface; voice capture with reliable upload and honest failure states; paste from any messaging channel; reduced mobile review.

**V1.1:** offline queue; text-document ingestion; photo as evidence attachment.

**Nice to have or later:** email forwarding; OCR; native apps; wedding-day mode.

Two deliberate movements against Part 1.

**Offline moves from "required V1" to V1.1.** Part 1 justified it largely on venue visits, and Section E of Part 1 found *no practitioner evidence* for venue-visit capture. Spending on an offline sync layer to serve an unevidenced use case is exactly the kind of inflation the brief warns against. Ship a clear failure state instead, and let real usage decide.

**Document ingestion moves from "required V1" to V1.1, reluctantly.** The demand evidence is the strongest single quote in Part 1 — *"why I can't forward all my documents to AI to create deadlines and a project plan off of contracts is beyond me"* — but the cost includes file storage, which pulls the privacy surface (Section N) open early. **Test it in the validation experiment before committing.** If planners respond to document ingestion more strongly than to conversational capture, that is a significant product finding and it should change the build order, not be discovered afterwards.

Mobile and import together represent roughly **10–15%** of the total refit. That is proportionate. It becomes disproportionate the moment email forwarding or OCR is admitted to V1.

---

# L. Feature deletion

| Lume feature | Verdict | Note |
| --- | --- | --- |
| **Capture (V2)** | **ADAPT** | Architecture kept, ontology rewritten |
| **Capture (legacy findings)** | **DELETE** | ~2,200 lines. Removes D-032 and D-033 by construction |
| **Knowledge Centre** | **ADAPT** | Becomes the Wedding Picture; frame set redesigned |
| **`/memory` legacy page + `memories` table** | **DELETE** | Duplicate free-form store; the codebase's own identified debt |
| **People / stakeholders** | **ADAPT** | Plus a new supplier entity |
| **Responsibilities** | **KEEP SHARED** | Best-fitting mechanism in the codebase; near-direct reuse |
| **Dates / milestones** | **ADAPT** | New type enum, supplier and owner references |
| **Gantt (`ProjectTimelineGantt`)** | **HIDE** | Retain the code, do not expose in V1. Wedding dates are sparse and a Gantt implies a planning-period timeline, which collides with the US meaning of "timeline" |
| **To Dos** | **ADAPT** | Action / Commitment distinction via existing `TodoKind` plus a real owner reference |
| **Master To Do (`/todos`)** | **ADAPT — and promote** | The nearest precedent for Part 1's week view, and the one cross-project exception Lume's constitution already allows |
| **Risks** | **ADAPT** | Rename to Issues; lifecycle module transfers |
| **Reminders** | **FUTURE POSSIBILITY → V1 if the habit loop is the plan** | Nothing exists. Part 1 §I makes the weekly prompt the habit-forming mechanism, which requires a scheduler and an email channel |
| **Decisions** | **ADAPT → effectively new** | Currently a knowledge section; needs to be first-class with a state |
| **Tell Me / Ask** | **ADAPT** | Pipeline shape reused; prompts, topics and suggestions rewritten |
| **Catch Me Up** | **NEW** | Does not exist |
| **Meeting Prep** | **ADAPT, reduced** | Generated on demand from truth; the stored `MeetingPrep` record and the `meetings` table are deleted |
| **Advise** | **DELETE** | A disabled stub |
| **Coach (`/api/coach`, `pm-coach.ts`, `coach.ts`, `/coaching`)** | **DELETE** | ~1,700 lines. Also removes the client-posted-state debt in D-033 |
| **History** | **ADAPT → substantially new** | Event log replaced by a change record (Section I) |
| **Project creation / onboarding** | **ADAPT** | Flow shape excellent, content entirely PM |
| **New Project V2** | **ADAPT** | Same |
| **Account / auth / billing** | **KEEP SHARED** | Copied verbatim |
| **Multi-project** | **KEEP SHARED — and it becomes central** | In Lume, portfolio intelligence is explicitly out of V1 scope. In the wedding product, cross-wedding *is* the product (Part 1 §E.3). This is the largest single product-shape divergence between the two |
| **Releases / release playbook / RelOps clone** | **DELETE** | |
| **Seed / demo data (`seed.ts`, 1,194 lines)** | **DELETE and rewrite** | A wedding sample dataset is needed for the first-run "show me an example" path |
| **Evals harness** | **KEEP SHARED** | Structure kept, corpus rewritten |
| **Evals UI, dev tooling** | **KEEP SHARED** as internal tooling | Never product surface |

**Deleted or rewritten from scratch: roughly 10,000–11,000 lines.** The deletion list is as important as the build list — it is what prevents the outcome the brief warns against, "Lume with wedding vocabulary". A wedding product that still contains Coach, Releases, Meetings and `/memory` would be exactly that.

The most important entry in the table is **multi-project**. Lume's constitution parks portfolio intelligence; the wedding product's primary screen *is* portfolio intelligence. These are not the same product with different nouns, and that single divergence justifies the fork more cleanly than any code measurement.

---

# M. Test migration

## M.1 What the harness actually is

52 `verify-*.ts` scripts (45 in CI) using `tsx` + `node:assert/strict`, roughly 478 named assertions, orchestrated by `scripts/run-regression-suite.ts`; 3 Playwright specs with 15 tests running credential-free against frozen model outputs; and two eval systems.

| Layer | Reusability |
| --- | --- |
| `scripts/run-regression-suite.ts` (101 lines) | **~100%** — a generic spawn orchestrator over a name list |
| `scripts/lib/fake-supabase-workspace.ts` (363 lines) | **~85%** — a tenant-aware fake client; the table list is Lume's but the mechanism is neutral |
| The `check()` assertion idiom | **100%** — a convention, not code |
| Playwright config + frozen-fixture pattern | **~90%** — `playwright.config.ts` runs with `LUME_AUTH=none`, `LUME_PERSISTENCE=local`, `OPENAI_API_KEY=""` |
| `BenchmarkCase` shape (`src/lib/eval-capture-v2/types.ts`) | **~95%** — `material`, `meaningTokens`, `allowedDomains`, `prohibitedWrites` are domain-neutral |
| Three-way safety taxonomy (model failure / catch / containment failure) | **100% as a design** |
| Individual verify-script *bodies* | **~30%** — fixtures and assertions are PM |
| Eval worlds (Candyland, Toyworld, Meridian, Northline…) | **0%** |

**Overall: 30–40% of the ~24,000 lines of test code is reusable scaffolding; 60–70% is domain content to rewrite.**

Three scripts are worth naming as near-direct ports because they test invariants that matter more in weddings than in PM: `verify-person-identity-safety.ts` (529 lines — ambiguous and forged person identity must become `needs_you`), `verify-d035-project-isolation.ts` (409 lines — an update must prove its container, and a write to A must leave B unchanged), and `verify-phase3b-capture-boundary.ts` (1,484 lines — the legal-domain mutation boundary; the largest and the one whose *structure* is most valuable).

## M.2 Wedding qualification cases

The thirteen cases in the brief, mapped to the layer that should own each.

| Case | Layer | Expected outcome |
| --- | --- | --- |
| Clean couple update | Deterministic + eval | Apply Ready, no `needs_you` |
| Vendor addition | Deterministic | New supplier proposed at `considering`; **never** at `booked` |
| Vendor cancellation | Deterministic | Applies without review (downgrade) |
| Date movement | Deterministic | Review required; previous value present in the change record |
| Responsibility change | Deterministic | `share` vs `replace` ambiguity → `needs_you` with Confirm Owner |
| Tentative vs confirmed | **Eval (live model)** | "Leaning towards" must never reach `decided`. **The single most important case in the suite** |
| Pronoun ambiguity | Deterministic + eval | "She'll sort the flowers" → `needs_you`, never a guessed person |
| Conflicting old information | Deterministic | Both surfaced; no silent winner |
| Stale handover | Deterministic | Stale-target fingerprint rejects the late apply |
| Same-name vendors/people | Deterministic | Two florists named "Bloom" → `needs_you`; never auto-linked |
| Wrong-wedding leakage | Deterministic | Cross-scope ID rejected; wedding B unchanged |
| **50-update marathon** | **New longitudinal harness** | A fact recorded at update 1 is still correct at update 50; silence never deletes; supersession fires only on genuine contradiction |
| **Wedding-week dense change pack** | **New longitudinal harness** | Twenty changes in three days produce a correct current picture and a correct change list |

The last two are the ones that do not exist in any form today. Lume's eval measures **single captures**. Part 1 §Z.2 asked for a longitudinal harness and the audit confirms none exists — the constitution's durable-knowledge rule ("a later capture that does not mention a still-current fact must not cause Lume to forget it") is stated and **not tested over sequences**. Building it is genuinely new work, and it is the test that actually measures the product's differentiator.

## M.3 How much advantage does the test investment create?

**Real, and smaller than the line count suggests.** Around 40% of the harness carries over as scaffolding. What carries over more strongly is not code:

- **The three-way safety taxonomy.** Counting containment catches separately from model failures is the only measurement that predicts the catastrophic errors in Part 1 §P, and almost nobody builds it. Arriving with it already designed is a genuine advantage.
- **The discipline that the PR gate must be deterministic and credential-free**, with live model evaluation kept separate and manual.
- **The written rule against tuning product code to eval failures**, which is how AI-product test suites usually rot.
- **A worked example of what a good containment test looks like** — `verify-phase3b-capture-boundary.ts` is 1,484 lines of exactly that.

Set against it, one honest deduction: the harness has a known blind spot. Live multi-tenant RLS is verified in CI only by asserting on migration *text*; the live tenant-isolation test skips without credentials and is not in the PR gate (D-014). A wedding product carrying couples' personal data should close that gap rather than inherit it.

---

# N. Privacy and security

| Requirement (Part 1 §W) | Current state | Classification |
| --- | --- | --- |
| Tenant isolation | RLS with `FORCE` and `is_workspace_member` on every tenant table | **Ready** — but see the CI gap below |
| Auth | Supabase Auth, cookie sessions refreshed via `getUser()` in `src/proxy.ts` | **Ready** |
| Encryption in transit and at rest | Supabase and Vercel defaults | **Ready** |
| Per-record and per-account deletion | Project delete exists (`/api/workspace/projects/[id]`), but it is **sequential, not transactional** (D-028) and there is no account-level delete | **Small launch work** |
| Export | **Nothing exists** | **Small launch work** — a JSON/Markdown export per wedding; also a trust and anti-lock-in asset |
| Retention policy | **Nothing exists** | **Small launch work** — policy plus a scheduled job, which is the same infrastructure reminders need |
| AI provider DPA, no-training assurance, sub-processor list | Contractual and documentation work, not code | **Small launch work** |
| Special-category data avoidance | Guest list out of scope, guest count only | **Ready by design** — the single most valuable privacy decision in the product, and it was made for focus reasons |
| Voice consent | **Ready by design** — the product takes the planner's own post-hoc dictation, not call recording, which sidesteps two-party consent entirely. A real differentiator against HoneyBook's recording notetaker | **Ready** |
| Logging hygiene | Needs an audit: transcripts and evidence quotes must not reach logs or error reporting | **Small launch work** |
| File storage | Not needed until V1.1 document/photo ingestion | **Future** |
| Analytics | Nothing currently; must be configured privacy-first from the start | **Small launch work** |
| Data residency (UK/IE entry market) | A Supabase region choice plus a model-provider decision | **Meaningful adaptation** if EU processing is promised |
| SOC 2, ISO 27001, SSO, audit-log export, DPIA, DPO | Absent | **Future business/enterprise only — do not build** |

**One item deserves elevation.** Live tenant isolation is not proven in the PR gate (D-014). For a PM tool the risk is commercial; for a product holding couples' and families' personal data across a solo planner's whole client base, a cross-tenant leak is a reportable breach. **Putting a live RLS test into CI is a launch requirement for the wedding product even though it is merely desirable for Lume.**

**Estimated privacy refit impact: ~5% of total effort** — deletion, export, retention job, logging audit, and documentation. Small, and none of it is optional.

---

# O. Billing and product separation

## O.1 What exists

`billing_customers`, `subscriptions`, `billing_events`; a 14-day trial RPC; `evaluateEntitlement` → `canUseLume`; Stripe Checkout, Customer Portal, signature-verified idempotent webhooks; and AI routes returning `403 entitlement_required`. Roughly 441 lines in `src/lib/billing` plus migrations. **No plan catalogue** — a single `STRIPE_PRICE_ID` — and the "actions left" meter is still client-side (D-024).

## O.2 Recommended structure: complete separation

Separate Stripe **product** and **prices** (monthly and annual) under the **same Stripe account**; separate Supabase project; separate accounts.

The temptation is a common account layer so a customer could hold both products under one login. **Reject it for V1.** There is no plausible customer who wants both a PM intelligence tool and a wedding-planning tool, so a shared identity plane would be pure cost — a cross-product user table, cross-product entitlement resolution, and a coupling between two products' billing at the point where a bug is a financial incident.

The one thing worth carrying across is naming discipline: rename `canUseLume` to something product-neutral in the fork, so the wedding product does not carry a function called `canUseLume` forever.

## O.3 What must be added

- **A plan row or price identifier per plan**, so monthly and annual can coexist. Small.
- **An active-wedding limit** (Part 1 §R recommends 25). A count query at wedding-creation time; do not build metering infrastructure.
- **A server-side entitlement check on the wedding-creation route** rather than a client meter, resolving D-024 by not inheriting it.

Everything else transfers unchanged. **Billing is one of the genuinely clean reuse stories: perhaps two days of work to point a copy at a new Stripe product.**

---

# P. Repository change map

| Area | Paths | Verdict |
| --- | --- | --- |
| **Shared infrastructure (copy verbatim)** | `src/lib/supabase/*`, `src/lib/billing/*`, `src/lib/ai-gate.ts`, `src/app/api/auth/*`, `src/app/api/billing/*`, `src/lib/auth-mode.ts`, `src/proxy.ts`, `vercel.json`, `next.config.ts`, `tsconfig*.json`, `eslint.config.mjs`, `playwright.config.ts` | **Unchanged** |
| **Shared UI primitives** | `src/components/{auth,billing,workspace,brand}/*`, `DetailModal.tsx`, `intelligence/{PersonEntity,EpistemicChip,EvidenceReveal}.tsx` | **Unchanged / minor** |
| **Design tokens** | CSS custom-property block of `src/app/globals.css` | **Minor** (extract ~300 of 8,793 lines; leave the rest) |
| **App shell** | `src/components/AppShell.tsx`, `src/components/app-shell/*` | **Minor–moderate** (labels, branding, nav) |
| **Schema** | `supabase/migrations/*` | **Moderate** — 10 renames, 4 extensions, 5 deletions, 4 new tables. Fresh migration set in the fork; do not port history |
| **Types** | `src/types/database.ts`, `src/lib/types.ts` | **Major** — and worth generating rather than hand-maintaining, resolving D-012 |
| **Capture engine** | `src/lib/capture-v2/*`, `src/lib/capture/apply/*` | **Major** — ~655 of ~9,800 lines survive |
| **Legacy capture** | `src/lib/capture/findings/*`, legacy path in `src/lib/openai.ts` | **Delete** (~2,400 lines) |
| **Suggestions / review** | `src/lib/capture/suggestions.ts`, `src/lib/capture/review/*` | **Major** (~2,400 lines) |
| **AI contracts and prompts** | `src/ai/domain/*` incl. `project-domain.md`, `dictionary.ts`, `statuses.ts`, `adapters/*` | **New** (1,289 lines replaced) |
| **Ask / Tell Me** | `src/lib/tell-me/*`, `src/lib/canonical-truth/*` | **Major** — pipeline shape kept, contents replaced (~3,400 lines) |
| **Catch Me Up** | — | **New** |
| **Change intelligence** | `src/lib/workspace/history.ts`, `history_events`, `src/app/history/page.tsx` | **New** (change record table, apply-time writes, new surface) |
| **Reminders / scheduling** | — | **New** |
| **Persistence** | `src/lib/persist-mutations.ts`, `apply/persist-execute.ts`, `apply/memory-execute.ts` | **Major** |
| **Store** | `src/lib/store.tsx` (2,722 lines) | **Major** — and an opportunity to reconsider a 2,700-line client context |
| **Knowledge Centre UI** | `src/components/knowledge-centre/*`, `src/lib/knowledge-centre/*` | **Major** |
| **Frames** | `src/components/frames/*` | **Moderate**; `RiskFrame` moderate, Gantt hidden |
| **Onboarding** | `src/components/onboarding/*`, `src/lib/new-project-v2/*` | **Major** — flow shape kept, content new |
| **Week view / portfolio** | `src/app/todos/page.tsx` as precedent | **New** |
| **Mobile capture** | — | **New** |
| **Tests — scaffolding** | `scripts/run-regression-suite.ts`, `scripts/lib/fake-supabase-workspace.ts` | **Unchanged** |
| **Tests — bodies** | `scripts/verify-*.ts` (52 files) | **Major** — ~30% structural reuse |
| **Evals — harness** | `src/lib/eval-capture-v2/{types,lume-safety,scoring}.ts` | **Minor** |
| **Evals — corpus and worlds** | `src/lib/eval-capture-v2/corpus.ts`, `src/lib/experiments/worlds.ts`, `src/lib/evals/fixtures/*` | **New** (~8,000 lines replaced) |
| **E2E** | `e2e/*.spec.ts` | **Major** — pattern kept |
| **Deletions** | `src/app/{releases,coaching,memory,meetings}`, `src/components/coach/*`, `src/lib/{coach,pm-coach,release-playbook,seed}.ts`, `CloneRelOpsButton.tsx`, `ProjectWidgetGrid.tsx`, `DashboardChrome.tsx` | **Delete** (~5,500 lines) |
| **Marketing site** | Does not exist in this repository | **New** — and per Part 1 §X it is the validation artefact, built first |
| **Analytics** | Does not exist | **New** (small) |
| **Documentation** | `docs/` (Lume-specific throughout) | **New** — carry over only the philosophy and the Known Discoveries *practice*, not the content |

---

# Q. Refit estimate

**Definition used**, because the number is meaningless without it: *refit % = the proportion of a from-scratch build's effort that still has to be done, given Lume exists.* 100% means Lume helps not at all; 0% means it already exists.

| Dimension | Estimate | Basis |
| --- | ---: | --- |
| **Product refit** | **~70%** | The week view, Catch Me Up, Changes, reminders, mobile capture and booking states are new surfaces. Coach, Releases, Meetings and `/memory` are deleted. Multi-project inverts from parked to central. |
| **Technical refit** | **~70–75%** | ~3,250 of ~98,000 lines transfer unchanged. ~10,000–11,000 are deleted. The remainder is rewritten or substantially refitted. |
| **Shared-core extraction** | **~5%** | Copying files, not building a package. The recommendation is *not* to extract (Section D). |
| **Wedding-specific work** | **~60% of total effort** | Domain model, three new domains at 15 edit sites each, planners, prompts, world assembly, persistence, frames, state machines, change records, Catch Me Up, wedding eval corpus. |
| **Privacy work** | **~5%** | Deletion, export, retention job, logging audit, live RLS test, documentation. |
| **Mobile / import** | **~10–15%** | Mobile capture surface, reliable voice, mobile review at launch; offline, documents and photos at V1.1. |

## **Overall band: 60–75% refit.**

Lume saves roughly **one quarter to two fifths** of a greenfield build.

## What drives the estimate upward

1. **No ontology configuration exists.** The domain is threaded through eight parallel definitions, so retargeting is a rewrite rather than a swap. Every new operation costs seven edit sites; every new domain costs fifteen.
2. **Change primitives are absent.** The differentiator has to be built, not inherited.
3. **Three net-new subsystems**: reminders/scheduling, Catch Me Up, and mobile capture including a reliable voice path.
4. **No i18n**, so terminology is a manual sweep across ~17,000 lines of components rather than a string-table swap.
5. **A large deletion set** — deleting well takes real time, and doing it badly produces "Lume with wedding vocabulary".
6. **The longitudinal eval harness does not exist**, and it is the test that measures the actual product claim.

## What drives it downward

1. **Infrastructure is genuinely free**: auth, tenancy, RLS, billing, Stripe, entitlement, transcription, deployment. Disproportionately the work founders underestimate.
2. **The schema maps well** — one week of migration work.
3. **Scoped responsibility with supersession is a near-perfect fit** and needs almost no change.
4. **The architecture is known to work**, which removes the most expensive risk in an AI product: discovering after six months that letting the model emit mutations was the wrong shape.
5. **The eval case format and safety taxonomy transfer**, and few teams would think to build them.

## A note on the framing

Part 1's "unfair head start" hypothesis is **not supported at the code level.** A 60–75% refit is a normal, useful head start of the kind any adjacent codebase provides. The genuine advantage is architectural knowledge and test discipline, and neither is visible in a diff. That does not defeat the opportunity — Part 1's commercial case never depended on refit cost — but it should defeat any plan premised on a quick rename.
---

# R. Maintenance and duplication

## R.1 Long-term cost of the options

| Structure | Ongoing cost |
| --- | --- |
| **Two independent products (recommended)** | Two deploys, two Supabase projects, two Stripe products, two test suites, two dependency-upgrade streams. Security patches applied twice. **Predictable and boring — its virtue is that nothing surprises you.** |
| **Shared core package** | Everything above, *plus* a package boundary, versioning, a release process, and a class of bug where a fix for one product breaks the other. Removes perhaps 3,250 lines of duplication. |
| **Shared schema** | The worst option. Every wedding migration risks Lume's paying customers. Deletion and residency guarantees become queries you have to get right rather than facts you can demonstrate. |
| **Separate UIs** | Correct, because the screens genuinely differ. The week view does not exist in Lume; Lume's Coach does not exist in the wedding product. |
| **Separate prompts** | Correct and unavoidable. Prompts are the ontology. |
| **Separate tests** | Correct for bodies; the runner and fake client are copied once and rarely change. |

## R.2 Where duplication is safer than abstraction

- **The capture ontology.** Two domains, two vocabularies, two state models. Any abstraction would be a configuration language invented for a sample size of two — the classic mistake, and one the brief explicitly warns against.
- **Prompts and eval corpora.** These must diverge freely; sharing them would couple the products at the point where each most needs independent tuning.
- **Schema.** Independent evolution is the entire point.
- **UI copy.** With no i18n layer, introducing one to serve two products is a large refactor of an unshipped product for negligible benefit.
- **Auth, billing and Supabase plumbing.** Counter-intuitive but correct: ~1,400 lines that change perhaps twice a year. The coupling costs more than the duplication.

## R.3 Where duplication would be wasteful

- **The Stripe webhook and entitlement evaluator.** Security- and idempotency-sensitive; a fix applied to one and not the other is a billing incident. Mitigate with a cross-reference comment in both repositories and the same test file copied into both suites. First and only candidate for extraction if that proves insufficient.
- **Dependency upgrades.** Next.js and React majors applied twice. Unavoidable; keep versions in lockstep so the second application is mechanical.
- **The regression runner and fake Supabase client.** ~464 lines, nearly static. Copy and forget.

## R.4 Founder maintenance burden — the decisive constraint

This is, in my assessment, the strongest argument in the entire Part 2 report and it is not a technical one.

**Lume V1 is not shipped.** Capture V2 is behind a flag and is not the default. Twenty-six open discoveries are tracked, including optimistic writes with silent failure (D-005) and suggestion state that vanishes on reload (D-003) — both of which are trust-destroying for a paying customer. Live tenant isolation is not in the PR gate (D-014). The dual capture pipeline (D-032) and client-posted state on AI routes (D-033) remain open.

Running two AI products with a shared reliability philosophy means two eval corpora requiring periodic live runs, two sets of model-drift exposure, two support inboxes, two on-call surfaces, and two marketing narratives. For a solo founder or a very small team, the realistic outcome of starting the second product before the first has shipped is that neither reaches the quality bar its own constitution demands.

**The practical rule that follows: validation of the wedding opportunity is cheap and should proceed. Construction of the wedding product should not begin while Lume V1 is unshipped.** Those are separable decisions and treating them as one is the error to avoid.

---

# S. Possible implementation slices

Derived from the code, ordered by dependency, and **contingent on validation succeeding**. Each is scoped to be independently abandonable.

## Slice 0 — Throwaway validation demo *(precedes everything; not product code)*

**Objective.** A public, interactive demo that accepts a planner's pasted notes, extracts a wedding picture, accepts a second paste, and shows what changed. This is the validation artefact from Part 1 §X.

**Dependencies.** None. **Deliberately not built on Lume's persistence, apply boundary or schema.**

**Areas.** A new marketing repository. Reuses only the *shape* of `buildObservationExtractionPrompt` and the envelope validation idea. An in-memory world; no database; no accounts.

**Tests.** None beyond smoke. It is throwaway by design.

**Risk.** The temptation to keep it. Part 1 §Z.20 hoped the demo and the first product increment could be the same work; Section G of this report shows they cannot, because a real apply path requires the world, planners, persistence and containment tests that the demo deliberately omits. **A demo that grows into the product would inherit none of the safety machinery and would silently discard the only genuine advantage.** Write it to be deleted.

## Slice A — Fork and strip

**Objective.** A running, deployable, empty wedding application: auth, tenancy, billing, deployment, and nothing else.

**Dependencies.** Validation passed; Lume V1 shipped.

**Areas.** New repository. Copy the Section D.3 list verbatim. Delete Coach, Releases, `/memory`, Meetings, `seed.ts`, `findings/*`, dashboard widgets (~10,000 lines). New Supabase project with a fresh migration set: `profiles`, `workspaces`, `workspace_members`, billing tables, `weddings`. Rename `project_id` → `wedding_id` throughout, once. New Stripe product.

**Tests.** `run-regression-suite.ts` and `fake-supabase-workspace.ts` copied; auth, billing and RLS tests ported — **including a live RLS test in the PR gate**, closing D-014 rather than inheriting it.

**Risk.** Low. The main risk is under-deleting; the deletion list should be treated as a checklist with a reviewer.

## Slice B — Wedding domain and capture

**Objective.** Say what happened; review; approved changes persist correctly and safely.

**Dependencies.** Slice A.

**Areas.** Migrations for `people`, `suppliers`, `wedding_suppliers`, `actions`, `key_dates`, `issues`, `decisions`, `guest_counts`, `knowledge_items`. New `prompt.ts`, `context.ts`, `server-truth.ts`. Rewritten `resolve.ts`, `dispatch.ts`, `expected-target.ts`, `classify.ts`, `types.ts`. New `persist-execute.ts` and `memory-execute.ts`. Copy `validate.ts`, `project-scope.ts`, `execute.ts`, `apply-approved.ts` unchanged. **V2 only — no legacy pipeline ever exists.**

**Tests.** Ports of `verify-phase3b-capture-boundary`, `verify-capture-v2`, `verify-person-identity-safety`, `verify-d035-project-isolation` with wedding fixtures. A wedding `BenchmarkCase` corpus. **The certainty-upgrade rule (Section H.3) must have its own dedicated suite** — it is the highest-severity failure class in the domain.

**Risk.** **The highest of any slice.** Two specific dangers: the `needs_you` rate on real wedding language may be intolerable given how rarely planners use full names (Section F.3), and the certainty-upgrade guard must be right the first time because the failure is discovered at a wedding.

## Slice C — The Wedding Picture and the week view

**Objective.** Read the truth: per-wedding and, critically, across weddings.

**Dependencies.** Slice B.

**Areas.** Adapt `OceanProjectWorkspace` and `OceanKnowledgeFrames` to the wedding frame set; adapt `KnowledgeItemDetailDrawer`; **build the week view new**, using `app/todos/page.tsx` and the "✦ Lume Thinks" concept as the only precedents.

**Tests.** Deterministic frame-content tests in the style of `verify-ocean-knowledge-centre.ts`; Playwright journeys.

**Risk.** Medium. The week view is the product's primary screen per Part 1 §E.3 and has no precedent to copy. Getting it wrong means shipping a per-wedding tool into a cross-wedding pain.

## Slice D — Change intelligence and Catch Me Up

**Objective.** "What changed" and "catch me up", from maintained truth.

**Dependencies.** Slice B — and the change-record write must in practice be built *inside* Slice B, because retrofitting apply-time writes across every operation afterwards is more expensive than doing it once.

**Areas.** `changes` table; change writes in both executor hooks; the Changes surface; Catch Me Up built on the `project_intelligence_snapshots` pattern with a real "since" timestamp; adapted Ask.

**Tests.** **The 50-update marathon and the wedding-week dense change pack.** This is where the product's actual claim is verified, and it is entirely new test infrastructure.

**Risk.** Medium-high. It is the differentiator, it is unbuilt, and it is untested territory for this codebase.

## Slice E — Onboarding, mobile capture and launch

**Objective.** First run, the wow moment, mobile capture, public site, payment.

**Dependencies.** Slices C and D.

**Areas.** Adapt `NewProjectExperience` and `ProjectSetupReview` to the wedding intake; the forced-second-capture reconciliation moment from Part 1 §J; a mobile-first capture route; reliable voice upload; reduced mobile review; export and deletion; retention job; marketing site; analytics.

**Tests.** Playwright first-run journeys; export/delete integrity.

**Risk.** Medium. The activation moment is a product bet and the reliability of mobile voice is a support-load bet.

**Deferred beyond E:** reminders and scheduling (unless the weekly prompt is judged essential to the habit loop, in which case it moves into E), offline queue, document ingestion, photo attachment, studio/multi-user, wedding-day view.

---

# T. Revised commercial case

Part 1 rated the opportunity **PROMISING — VALIDATE FIRST**. Three technical findings bear on that; none reverses it, and two sharpen it.

**The refit is 60–75%, not 20–30%.** This weakens the "unfair head start" framing considerably. But Part 1's commercial case rested on market position — an incumbent gap in reconciled cross-conversation truth, a segment that pays, a locale where the incumbent's feature is unavailable — not on cheap engineering. A larger refit changes the *cost* side, and at these revenue scales (Part 1 §R: €94k ARR at 200 users) cost was already the binding constraint on ambition. It should be understood as narrowing the plausible outcome, not invalidating it.

**Change intelligence must be built.** This is the one that genuinely stings, because change intelligence *is* the differentiator. It is not architecturally hard — one table and disciplined apply-time writes — but it is not free, and it is exactly the thing Part 1 counted as a strength.

**The certainty model turned out to be tractable and cheap.** Part 1 worried about status machinery. The audit shows the danger concentrates in exactly two state fields, which makes the upgrade-requires-review rule (Section H.3) affordable to implement and to test. **This is the single most encouraging technical finding**: the product's most dangerous failure class has a small, cheap, testable guard.

Two other findings cut in the product's favour. **Scoped responsibility with supersession is a near-perfect fit** and needs almost no change — and Part 1 identified responsibility as the thing incumbents model worst. And **the no-recording design is a genuine competitive and compliance advantage** over HoneyBook's recording notetaker, not merely a scope decision.

Against all of that sits Part 1's own bear case, which the technical audit does nothing to soften: HoneyBook already ships the visible half free, planners have historically paid for client-facing professionalism rather than internal organisation, the market is consolidating (That's The One acquired August 2026), the customer's own industry is contracting, and there is no public community to acquire through.

**Verdict: the opportunity still merits validation, and the validation is now more clearly separable from the build than Part 1 assumed.** The refit finding makes the sequencing discipline more important, not less: at 60–75%, building before validating would be a serious misallocation.

---

# U. Wedding versus Coaching versus Lume

**No coaching technical audit exists in `/docs`.** The coaching column below is therefore reasoned from the same code evidence, not measured against a real coaching product definition. It is marked as assumption throughout and should not be treated as equivalent in confidence to the other two columns.

| | **Lume for PMs** | **Coaching** *(assumed)* | **Weddings** |
| --- | :--: | :--: | :--: |
| Market wedge | 2 | 4 | 4 |
| Pricing power | 2 | 4 | 3 |
| Paid acquisition | 2 | 3 | 2 |
| Retention | 3 | **5** | 3 |
| Privacy burden (5 = light) | 4 | **1** | 3 |
| Refit (5 = least work) | **5** | 3 *(assumed)* | 2 |
| Architecture reuse | **5** | 4 *(assumed)* | 3 |
| Test reuse | **5** | 4 *(assumed)* | 3 |
| Differentiation | 2 | 3 | 4 |
| Speed to launch | **5** | 3 | 2 |
| First 25 customers | 2 | 4 | 4 |
| 100–200 potential | 2 | 3 | 3 |
| Maintenance burden (5 = light) | **5** | 3 | 2 |

## U.1 The tension the table exposes

**The domain that is cheapest to refit is the one that needs Lume's hardest-won capability least.**

Coaching would require fewer new domains than weddings: a client container, people, sessions, commitments, themes. No organisation entity, no booking states, no cross-entity contradiction of the kind a cancelled bus creates. My estimate — and it is an estimate — is a **50–60% refit against weddings' 60–75%**.

But the value of containment scales with the cost of a confident error, and those costs are wildly different. A wedding has a fixed date and no second attempt: a supplier wrongly recorded as booked is discovered in front of the guests. A coach mis-remembering what a client said is an awkward moment in a conversation that will happen again in three weeks. **Lume's most expensive asset — the machinery that prevents a confident wrong write — is worth the most precisely where the refit is largest.**

Coaching's compensating advantages are real: open-ended client relationships remove the engagement-end churn cliff entirely, and coaches bill at rates that make €39 trivial. Its disqualifying risk is privacy — coaching conversations carry health, employment and relationship content under quasi-therapeutic confidentiality expectations, and the objection *"I am not putting my clients' sessions into someone's AI"* is far harder to answer than the same objection about a florist's deposit deadline. Notably, weddings sidesteps its version of that problem by design (the planner dictates afterwards rather than recording the couple); coaching cannot, because the session *is* the content.

**Lume for PMs remains the best technical position and the worst commercial one**, for the reason given in Part 1 §Y: a project manager is an employee with no personal buying authority, competing against tools their employer already pays for. It scores 5 on refit because it is already built, and 2 on almost everything that determines whether anyone pays.

## U.2 Ranking

1. **Weddings** — best fit between the domain and the specific capability Lume has already proven, clearest differentiation, buyer with personal authority. Highest refit and highest maintenance burden.
2. **Coaching** — best retention economics and a lower refit, undermined by a materially heavier privacy proposition and by needing least what Lume is best at. **It has not had a technical audit and should get one before being ranked against weddings with confidence.**
3. **Lume for PMs** — finished, cheap, and commercially weakest.

---

# V. Shared-core conclusion

> **Is there now enough evidence that Lume contains a reusable multi-domain longitudinal-intelligence core?**

## **No.**

Lume contains a **proven single-domain implementation of a reusable architectural pattern.** Those are different things, and conflating them is how a product company becomes a platform company by accident.

The evidence is unambiguous:

- **~3,250 of ~98,000 lines are domain-free** (~3.3%), and almost all of it is commodity infrastructure — auth, tenancy, billing, entitlement — not intelligence machinery.
- **There is no ontology abstraction of any kind.** No `OntologyConfig`, no registry, no domain pack. The PM domain is hardcoded across eight parallel definitions.
- **Of the capture engine's ~9,800 lines, roughly 655 are domain-free.**
- **The safety layer is domain-coupled**: `expected-target.ts`, `personLinkedIdentityGate`, `dispatch.ts` and the world assembly all branch on PM entities.
- **The one candidate for a genuine cross-domain primitive** — supersession and provenance on `knowledge_items` — is implemented for exactly one entity type and read in exactly one function.

Extracting a "core" now would mean *designing* one against a single proven domain and one hypothetical one. Every abstraction boundary would be a guess, and the guesses would be locked in at the safety-critical seam of an unshipped product.

## V.1 What is genuinely reusable — and it is not code

The concepts the brief lists (durable work container, source ingestion, structured findings, human review, entity identity, change application, history, retrieval, briefings) **are** the right list. Lume validates them as a *design*. What it does not provide is an implementation of them that is separable from project management.

The five design decisions worth carrying to any future domain, stated so they can be reused without any code at all:

1. **The model emits observations with verbatim evidence and never an operation.** Deterministic code decides what becomes a write.
2. **A closed set of typed legal operations with no generic fallback**, so an unanticipated extraction fails closed.
3. **`needs_you` is a first-class outcome with equal standing to `write`**, not an error path.
4. **Identity binding requires the recorded name to appear in the source text**; a model-supplied ID is evidence of intent, not proof.
5. **Measure containment failures separately from model failures.** It is the only metric that predicts the errors that actually hurt.

To those, this audit adds a sixth, learned from what Lume got wrong:

6. **The change record must be first-class and written at apply time.** An event log with prose diffs cannot be upgraded into change intelligence later.

That list is the asset. It is portable to weddings, to coaching, and to anything else, and it does not require a shared package — only a shared document, which is what this report is.

## V.2 When to revisit

Revisit only when both conditions hold: a third product exists or is committed to, **and** the same file has required lockstep changes in two products at least twice. Until then, the answer is no.
---

# W. Final recommendation

## **PROCEED TO MARKET VALIDATION — and HOLD any wedding build until Lume V1 ships or is formally abandoned.**

These are two separate decisions and the most common way to get this wrong is to treat them as one. Validation is cheap, quick, does not touch Lume, and answers questions no amount of further code reading can. Construction is expensive, is a 60–75% refit, and starting it now with Lume V1 unshipped is the most reliable way to end up with two unfinished products.

**Why not PROCEED TO NARROW PROTOTYPE.** Tempting, because Part 1 §Z.20 hoped the reconciliation demo and the first product increment might be the same work. Section G shows they are not: a real capture increment requires the world, the planners, the persistence and the containment tests, and none of that is needed to test whether planners will pay. A prototype would cost a large multiple of the demo and answer the same question.

**Why not HOLD UNTIL LUME V1 outright.** Holding entirely would waste the cheapest and most informative action available. The validation experiment costs €3,000–€5,000 and a throwaway build, requires no Lume changes, and — critically — the market is moving. That's The One was acquired in August 2026 by a holding company assembling planning and payments. Waiting six months to learn whether anyone wants this is a worse risk than spending five thousand euros to find out now.

**Why not PARK or REJECT.** The differentiated claim survived a hostile technical audit. No incumbent CRM does conversational write-back to maintained truth. The certainty-upgrade guard — the product's most dangerous failure class — turned out to be small and cheap. Scoped responsibility is a near-perfect fit for the thing incumbents model worst. And the no-recording design is a real compliance and competitive advantage in the recommended entry market, where HoneyBook's notetaker is not even available.

## W.1 The conditions, stated so they can be enforced

1. **The validation artefact is throwaway.** Written to be deleted. It must not become Slice B.
2. **No wedding build begins while Lume V1 is unshipped.** Capture V2 is behind a flag, twenty-six discoveries are open, and D-003 and D-005 are trust-destroying for a paying customer.
3. **The failure thresholds in Part 1 §X are honoured as written.** Fewer than five paid checkouts, or acquisition cost above €500, or planners saying "my CRM already does this" — any one of those stops the programme.
4. **If a major incumbent announces reconciled cross-conversation truth maintenance during the test, abandon rather than complete it.**

## W.2 The specific follow-up audit to fold into validation

One technical unknown is large enough to change the plan and cannot be resolved by reading code.

**The unknown.** How often does the exact-name identity gate fire `needs_you` on real wedding language?

**Why it matters.** The gate is the product's core safety mechanism and Lume's cleanest transferable safety property. Wedding language is dense with definite references and diminutives — "the venue", "the florist", "Laura's mum", first names only. If a ten-minute call produces more than three or four items needing a decision, the review loop dies and the product fails regardless of everything else in this report. This single measurement determines whether Slice B is feasible as designed or needs category-based reference resolution (Section F.3) as a launch requirement rather than an optimisation.

**The cheapest test.** Collect fifteen to twenty real planner transcripts during the validation interviews — dictated recaps, not scripts. Run the existing Capture V2 extraction against them with a rewritten prompt and a hand-built wedding world, and count how many observations the exact-name rule would reject. **No product code required.** A few days of work, using the pipeline that already exists, answering the question that most threatens the build.

## W.3 The other unknowns, ranked

| Unknown | Why it matters | Cheapest test |
| --- | --- | --- |
| Does the cross-wedding framing outperform per-wedding? | Part 1 §E.3 reframed the whole product on two quotes. That is thin evidence for a product bet. | Two landing-page variants in the same validation spend. |
| Do planners respond to reconciliation or only to note-taking? | If only note-taking, the differentiated half is not the half they pay for and the thesis fails. | The two-paste demo; measure how many reach the second paste. |
| Has HoneyBook's notetaker satisfied the need for US planners? | Determines whether the US is addressable at all. | Ten interviews with US planners who have used it for a season. |
| Would document ingestion beat conversational capture? | The strongest demand quote in Part 1 is about documents, not calls. It would reorder the roadmap. | A third demo variant accepting a pasted contract. |
| Booking-state vocabulary | A state machine planners do not recognise is worse than free text. | Ask directly in the interviews. |

---

# X. Exact next action

**Do not write wedding product code.**

In order:

1. **Run the Part 1 §X validation experiment.** €3,000–€5,000 over four to six weeks. UK/Ireland primary cell, US secondary. A throwaway two-paste interactive demo, a real €39 Stripe checkout, and fifty direct outreach conversations. Honour the pre-committed thresholds.
2. **Inside that experiment, run the `needs_you`-frequency measurement** described in W.2 against fifteen to twenty real planner transcripts.
3. **Continue Lume V1 to ship.** Specifically: promote Capture V2 to default and delete the legacy pipeline (D-032, D-033), close D-003 and D-005, and put a live tenant-isolation test into the PR gate (D-014). Every one of those is required for Lume and would otherwise be inherited as debt by any wedding product.
4. **Commission a coaching technical audit** equivalent to this one before ranking coaching against weddings with any confidence. It does not exist, and Section U's coaching column is reasoning, not evidence.
5. **Re-read this report before any build begins**, specifically Sections G.2 (fifteen edit sites per new domain), H.3 (upgrades require review) and I (the change record must be written at apply time). Those three are the ones most likely to be forgotten and most expensive to retrofit.

**Decision point:** when the validation experiment reports. If it clears the strong-result bar and Lume V1 has shipped, begin at Slice A. If it lands ambiguous, iterate the proposition once — do not begin engineering. If it fails, park the wedding thesis and keep this report, because the six design principles in Section V.1 are the durable output and they transfer to whatever comes next.
