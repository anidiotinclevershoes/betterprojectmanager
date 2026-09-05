# Lume engine excavation (hostile, evidence-only)

**Constraint:** This file is documentation of existing code. No product code was changed.

**Question this file exists to answer, without charity:**

1. Does Capture **mutate** existing objects (update / patch / merge / supersede), or does it only **extract and append** new items?
2. Does Ask / Tell Me read **structured Knowledge Centre / domain objects**, or **RAG over notes / transcripts**?

Short answers are in §0. The rest is the structured audit.

Legend: **IMPLEMENTED** = wired code path. **V1 COMMITTED** = docs/tickets show V1 intent, not the live default. **SPECULATIVE** = language without a write/read path.

Default production Capture is still the **legacy** engine. `isCaptureV2Enabled()` (`src/lib/capture-v2/flag.ts`) is true only when `LUME_CAPTURE_V2` is `"1"` or `"true"`. Unset = off.

---

## 0. The two questions, without padding

### 0.1 Capture: mutate vs extract-and-append

**Both, by domain. Knowledge/decisions are extract-and-append. Todos/risks/dates/people can mutate IF a durable ID is resolved. There is no general patch/merge/supersede of facts.**

The V2 extraction prompt says, verbatim (`buildObservationExtractionPrompt` in `src/lib/capture-v2/prompt.ts`):

> You extract atomic project observations. You do not mutate a database.
>
> … If a person/risk/date/todo already exists, prefer update_existing or no_change over create_new.

That is **model intent**, not a write. Writes happen only after human `applyOne` → `planCaptureApply` → `executeCaptureApply`.

| Domain | After human apply, does the existing row change? | Function / persist |
|---|---|---|
| **Knowledge / decisions** | **No. INSERT a new `knowledge_items` row.** `planKnowledge` maps both `create` and `update` to `{ type: "write_knowledge" }`. `persistKnowledgeBullet` does `client.from("knowledge_items").insert(row)`. No `supersedes_id` is set on this path. | `planKnowledge` (`dispatch.ts`), `persistKnowledgeBullet` |
| **To Do** | **Yes, if `targetTodoId` / `targetEntityId` is on-project.** `complete_todo` / `update_todo` / `delete_todo` call `persistTodoUpdate` (`.update` on `todos`: `title`, `detail`, `due_on`, `done`, …) or `persistTodoDelete`. Create without an ID **inserts**. Duplicate titles are allowed. | `planTodo`, `persistTodoUpdate` |
| **Risk** | **Status can mutate** via `persistRiskStatus` → `risks.update({ status })` where `status ∈ {open, watch, resolved, accepted}`. Create without ID inserts unless **exact** `title.trim().toLowerCase()` already exists (`planRisk` → `no_change` or Needs you). Wording-different “same risk” = new row. | `planRisk`, `persistRiskStatus` |
| **Date / milestone** | **Yes, if UUID resolved.** `persistTimelineUpdate` patches `milestones` (`label`, `start_on`, …). Complete → Needs you (no status column, D-029). Create without ID **always inserts** (`planMilestone`). | `planMilestone`, `persistTimelineUpdate` |
| **Person** | **Reuse UUID** via `ensurePersonOnProject` / `persistEnsureStakeholder` on exact normalised name. Does not patch role/concerns from Capture prose as a general update. First-name / ambiguous / UUID-without-full-name-in-text → Needs you (`personLinkedIdentityGate` in `resolve.ts`). | `planPerson`, `ensurePersonOnProject` |
| **Responsibility** | **Mutate overlay:** share inserts another current `kind=responsibility` row; replace sets prior `lifecycle='superseded'` (`confirmResponsibilityOwner` + `persistKnowledgeLifecycle`). Default is share, not replace. | `planResponsibility`, `confirmResponsibilityOwner` |
| **Availability** | **Insert** a new `knowledge_items` row `kind=availability` unless same personId + same ISO days already current (`planAvailability` `no_change`). Does not patch the old away range. | `planAvailability`, `persistKnowledgeBullet` |
| **Meeting** | **No write.** `classifyCaptureLegalDomain`: `kind === "meeting"` → `"unsupported"`. | `classify.ts` |
| **Memory** | Insert into `memories`. Evidence, not current truth. | `planMemory` |

**Merge that looks like update but is not identity:** `mergeSectionBullets` / `mergeKnowledge` (`src/lib/knowledge.ts`) prepends incoming bullets, skips 40-character prefix near-duplicates, caps at 8. Used on in-memory `addKnowledgeBullet`. Durable Capture apply does **not** use this as supersession; `persistKnowledgeBullet` still **inserts**.

**Manual Knowledge Centre corrections** (not Capture) **do** preserve or drop IDs via `alignSectionLines` (`src/lib/knowledge-identity.ts`): exact body → keep UUID; unique wording-edit (Jaccard ≥ 0.45) → keep UUID; else new UUID + delete unmatched. That is inspect/correct, not Capture.

**Honest one-liner:** Capture extracts proposed observations; after review it **mutates todos/risks/dates/ownership when it has a legal ID**, and **appends knowledge/decision bullets**. It does not patch “the current position object.” Today does not automatically supersede yesterday’s fact.

### 0.2 Ask / Tell Me: structured objects vs RAG

**Structured (plus knowledge bullets as records). Not RAG. No embeddings. No vector index. No search over capture transcripts as the retrieval layer.**

Repo grep for `embedding` / `pgvector` / `vector` in `src/`: **no implementation**. Vectors are explicitly out of V1 (`docs/v1-reference-pack/LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md` §23, §26).

**HTTP Ask (`POST /api/tell-me`):**

1. `loadServerCurrentTruthForTellMe` loads durable workspace (`load-mission-state` / `loadProjectScopedWorkspace`). Leftover client `state` / `snapshot` ignored (`clientPostedTruthFields`).
2. `serializeCanonicalTruth({ state, projectId, question })` builds a prompt block from **tables**: `knowledge_items` (current structured overlay, else legacy section strings), `risks.status`, `stakeholders`, `todos`, `milestones`. History only if `questionLooksHistorical`.
3. `answerTellMeQuestion(..., useCanonicalTruth: true)` calls the model with `TELL_ME_SYSTEM_CANONICAL`:

> You are Tell Me for Lume — read-only project recall over AUTHORITATIVE PROJECT STATE.
> You are READ-ONLY. Never create, update, or delete project state.
> Use only the canonical facts provided.

`isCanonicalTruthEnabled`: env `0` forces legacy even on HTTP. Unset + `explicit: true` (what the route passes) = canonical. Library default-off does **not** apply to this HTTP path.

**Deterministic Search** (`searchProjectKnowledge` in `src/lib/tell-me/knowledge-search.ts`): `haystack.toLowerCase().indexOf(q)` over `knowledge.sections[now|decisions|risks|people|openLoops]`. Not AI. Not embeddings. Not transcripts.

**Ownership shortcut:** `findConfirmedOwners` can answer without the LLM.

**What Ask does not query:** `memories.content` as a corpus, capture session transcripts, `history_events` for current-state questions (canonical MODE:current omits them), snapshot tables (`snapshot: null` on HTTP).

**Honest one-liner:** Ask is an LLM over a **serialized project record dump**, not retrieval-augmented generation over notes.

---

## 1. Engine summary — paste messy text

Input is **not** meeting-transcript-only. `CaptureWorkspace` is typed blocks + optional record/transcribe. `CaptureInput.sourceType`: `"note" | "voice_note" | "conversation" | "meeting_note"`. V2 still labels the blob `Transcript:` in the prompt.

Analyse does **not** write domain tables. Immediate-merge `captureWithAI` is deleted. Ocean: Analyse → review cards → per-item `applyOne`.

### A. Default — `LUME_CAPTURE_V2` unset — LEGACY — IMPLEMENTED (live)

`postCaptureLegacy` in `src/app/api/capture/route.ts` accepts `body.state` (client MissionState). `buildCaptureContext` ranks todos/risks/people/knowledge/history/meetings. `tidyAndCoachWithOpenAI` + findings mapper. Offline: `extractLocalFindings` / `extractKnowledgePatchFromText` (regex). Apply: client `planCaptureApply(captureApplyWorldFromState(state))`.

### B. Flag on — V2 — IMPLEMENTED behind flag; V1 COMMITTED as the engine to keep

`postCaptureV2` ignores `body.state`. `loadServerCaptureWorld` → `formatAuthoritativeStateForPrompt`:

> Authoritative current records (use these IDs only; never invent IDs):
> `- id=… domain=person|risk|todo|milestone title=…`

**Not in that prompt:** current-position bullets, decisions, open loops, responsibilities. `contextRecordsFromWorld` only lists people, risks, todos, milestones.

Then `extractObservationsWithOpenAI` → `validateObservations` → `resolveObservations` (including `personLinkedIdentityGate`) → `planCaptureApply`. Apply: `POST /api/capture/apply` against a **fresh** load + `expectedTarget` fingerprint.

Human-in-the-loop: Needs you / no-change are no-ops in `executeCaptureApply`. Confirm Owner is share vs replace (`ConfirmOwnerDialog`).

---

## 2. Data model of first-class objects

Schema: `supabase/migrations/20260812002748_workspace_schema.sql` + overlay `20260818230000_knowledge_canonical_metadata.sql`. Types: `src/lib/types.ts`, `src/lib/canonical-truth/types.ts`.

Isolation: `workspace_id` + RLS `is_workspace_member`. App filters `projectId`. No per-project ACL.

| Object | Table | Identity | Status / lifecycle | Present | Absent |
|---|---|---|---|---|---|
| Project | `projects` | UUID | `healthy \| watch \| at_risk` | name, code, summary, current_focus | archive, version |
| Person | `stakeholders` | **project-scoped** UUID | none | `name`, `role`, `preferences` jsonb, `concerns` jsonb, `last_contact_at` | workspace `people`, unique name, aliases |
| To Do | `todos` | UUID | `done` boolean | `kind` ACTION/WAITING/CHASE/**REMINDER**, `waiting_on` **text**, `due_on` date | OPEN/IN_PROGRESS/BLOCKED, `waiting_on_person_id`, reminder schedule |
| Risk | `risks` | UUID | `open \| watch \| resolved \| accepted` | title, source `manual\|capture\|seed` | owner, severity, superseded_by, confidence |
| Date | `milestones` | UUID | none | label, type, `start_on`, `end_on`, notes | completed, version, valid_from |
| Knowledge fact | `knowledge_items` | UUID | `lifecycle` current/superseded/historical | `section` now/decisions/risks/people/openLoops, `body`, `position`, optional `kind`, `epistemic`, `meta`, `provenance`, `supersedes_id` | valid_from, version, confidence-as-authority |
| Decision | same table, `section='decisions'` | UUID if aligned | overlay only | body string | dedicated table, reversed/superseded enum |
| Reminder | **not a table** | — | — | `todos.kind='REMINDER'` | cron, notifications |
| Meeting | `meetings` | UUID | upcoming/in_progress/completed | `prep` jsonb | Capture write path |
| Memory | `memories` | UUID | none | content, `people` jsonb **names** | current truth |
| History | `history_events` | UUID | none | chronology | often not persisted (D-004) |
| Suggestion | `recommendations` | UUID | active/done/dismissed | ✦ Lume noticed | durable accept/dismiss (D-003) |

Overlay on `knowledge_items` (not a second truth DB):

- `kind`: fact | responsibility | decision | risk | date | dependency | availability | open_loop | ambiguity
- `epistemic`: confirmed | pending | informal | suggested | inferred | **conflicting** | unknown | legacy | **null**
- `lifecycle` + `supersedes_id`
- `meta` jsonb (`responsibility.personId`, `availability.awayFromIso`, …)
- `provenance` jsonb

**No table has `version`, `valid_from`, durable `confidence`, or `needs_review`.** Capture High/Medium/Low is session-only.

**Person:** `{ id, name, role, … }` on `Project.stakeholders`. Responsibilities are separate `knowledge_items` with `meta.responsibility.{personId, personName, scope, ownerConfirmed}`. Same human, two projects = two rows. Exact `normalisePersonName` match is the temporary resolver. **A name is not identity.**

**Date:** `milestones` `{ id, label, type, start_on }`. Ocean Important dates = `buildDateRows` over `MissionState.timeline`. Structured `kind=date` is overlay, not the frame authority.

Current vs history: current = domain rows + `lifecycle === "current"`. History/memories/snapshots are evidence or UX compression. HTTP Ask sets `snapshot: null`.

---

## 3. Per-capability

### 1. Capture of messy natural language (not just transcripts)

**IMPLEMENTED.** Typed + voice. No meeting-minutes grammar. No upload UI (session still has `source: "uploaded"`).

### 2. Existing project context supplied on capture

**IMPLEMENTED, two qualities.**

- Legacy: `buildCaptureContext` ranked multi-store dump (knowledge included).
- V2: ID catalogue of person/risk/todo/milestone **titles only**. `buildCaptureContext` still runs in V2 for **metrics**, not the extraction prompt.

“Compares new text to everything it knows” is true-ish for legacy, **false for V2 extraction**.

### 3. Object/entity resolution and identity

**IMPLEMENTED, string-exact. Workspace Person table: V1 COMMITTED, not shipped.**

| Domain | Resolution |
|---|---|
| Person | On-project UUID **and** recorded **full name** as whole phrase in Capture text (`recordedPersonNameAppearsInText`). First name → Needs you if any people exist. Two exact same names → Needs you. Model UUID without name in text → Needs you (`personLinkedIdentityGate`). |
| Risk | UUID, else exact title. No fuzzy. |
| Todo | Update/complete **requires UUID**. Create does not exact-title-dedupe. |
| Milestone | Update **requires UUID**. Create always mints if no ID. |
| Knowledge/decision | **No identity on Capture apply.** Insert. |
| Waiting | `waiting_on` text; later exact name match. Not an FK. |

**Same Sarah across updates:** stable only if stakeholder UUID exists, later text contains that **full recorded name**, and there is not a second exact-name hit. “Sarah said…” does not bind. Cross-project: two people.

### 4. Updates vs creates

See §0.1. Prompt prefers `update_existing`. Knowledge IDs are **not** in the V2 catalogue, so the model cannot legally target a current-position bullet. `update_existing` without `candidateTargetId` → Needs you (`resolve.ts`).

### 5. Corrections and supersession

**PARTIAL.** Real for: `confirmResponsibilityOwner` replace (`lifecycle='superseded'`), `persistRiskStatus`, `persistTimelineUpdate`, manual `alignSectionLines`. **Not** for Capture knowledge writes. Eval fixtures mention “Go-live now 26 August (supersedes 19 August)” as **narrative in seed worlds**, not a Capture write of `supersedes_id`.

### 6. Conflicting information

**SCHEMA + PHILOSOPHY. Capture does not persist conflicts.**

- Philosophy §8: contradictions → Needs you. **V1 COMMITTED.**
- `epistemic='conflicting'` is a CHECK; **no Capture write** of it.
- `NeedsConfirmationItem.kind` includes `"conflict"`; `findUnknownOwnerHints` emits only `unknown_owner`.
- V2 `disposition=ambiguous` → Needs you. Two date creates → two current milestones.

### 7. Uncertainty / Needs You

**IMPLEMENTED as fail-closed planner, not a stored uncertainty graph.** `planCaptureApply` / resolver `{ kind: "needs_you" }` → execute no-op. Confirm Owner is structured Needs you. KC “Needs you” ≈ unconfirmed owner. Legacy cards also have `ready | needs_review | unmatched` (extraction quality, session-only).

### 8. Typed domain writes

**IMPLEMENTED for a closed set:** todo, risk, milestone, person, responsibility, availability, knowledge, memory. Unknown / meeting → Needs you. **No Todo fallback** (`classifyCaptureLegalDomain`). Decisions still land as `section='decisions'` strings. Domain.md To Do OPEN→ARCHIVED is **aspirational**; DB is `done` boolean.

### 9. Persistence / authority vs evidence

**IMPLEMENTED** (Supabase production). `MissionState` is cache. `updated_at` triggers exist; **not** optimistic concurrency. No `version` (D-034). History incomplete (D-004). `capture_sessions` underused (D-013).

### 10. People & Context

**IMPLEMENTED** as project-scoped stakeholders + scoped responsibilities. Global CRM: **V1 COMMITTED later**. Waiting count uses `waitingOn === person.name`. Availability structured only; Capture writes if person+dates clear. D-007: leftover people **prose** may lack a stakeholder.

### 11. Dates

**IMPLEMENTED** as `milestones`. Duplicate label + new date without ID → second row.

### 12. To Dos

**IMPLEMENTED.** Ocean To Do excludes WAITING/CHASE/`waitingOn`. Waiting frame concatenates todos **and** `openLoops` (**D-008 / D-021**). V1 target: todos = actionable waits; openLoops = narrative. **Not implemented as one write rule.**

### 13. Risks

**IMPLEMENTED.** `risks.status` authority. Knowledge `sections.risks` is projection. Recommendations of kind `risk` are not risks until converted.

### 14. Decisions

**IMPLEMENTED as bullets**, not a lifecycle object. Capture `domain: "decision"` → `DOMAIN_TO_LEGAL` knowledge (`resolve.ts`).

### 15. Reminders

**ENUM ONLY.** `TodoKind = "REMINDER"`. No scheduler.

### 16. Tell Me / Ask

See §0.2. **IMPLEMENTED. Structured assembler, not RAG.**

### 17. Meeting Prep

**IMPLEMENTED as stored `meetings.prep` jsonb + UI.** Not generated from Capture. Capture meeting kind = unsupported.

### 18. Advise / Coach

Advise = disabled “Coming soon”. Coach = `/api/coach` with **client MissionState**. Philosophy §26 parks both as V1 product.

### 19. Catch Me Up / briefing

**NOT IMPLEMENTED.** No route/command. MP “evolve KC / briefing” rejected. Current position = `knowledge.sections.now` bullets. Ask can answer if the user types a question. **SPECULATIVE** as a briefing feature.

### 20. New Project / V2

**IMPLEMENTED** Blank + Talk + persist. `LUME_NEW_PROJECT_V2` unset = `assembleFromNarrative`. Flag on = observations → `NewProjectCategorisation` → same `persistNewProject`. Extract-and-file; no existing-person resolution (no project yet).

### 21. Ocean visual language

**IMPLEMENTED as views** (`ocean-frames.ts`). Does not add identity or conflict semantics. Waiting frame concatenates two stores.

---

## 4. What is NOT true despite adjacent language

| Nearby language | Reality |
|---|---|
| AI CPO / second brain (`src/lib/mission.ts`) | Copy. Runtime is Capture→review→tables + Ask-over-prompt. |
| Compare with what Lume already knows | Legacy dump. V2: ID catalogue without knowledge prose. |
| Needs you as epistemic third state | Write refusal + unconfirmed owner. |
| Prefer update over duplicate | Prompted. Knowledge/decisions still insert. |
| Person identity | Exact full name, project UUID. |
| Ask searches notes/transcripts | LLM over assembled records. Substring Search over bullets. |
| Meeting Prep intelligence | CRUD on jsonb. |
| Advise / Catch Me Up / reminders-as-product | No. |
| Capture V2 is production | Flag default off. |
| Omission of a fact in a later Capture supersedes it | Silence does not delete or supersede. |
| `epistemic=conflicting` | Column exists; Capture does not write it. |

---

## 5. Claims a landing page must not make

1. Living knowledge graph / cross-project CRM of people.
2. Resolves “Sarah” by first name, coreference, fuzzy match, or global identity.
3. Automatically supersedes yesterday’s facts when today contradicts them (except targeted risk status / date UUID update / explicit owner replace / manual KC edit).
4. Stores conflicts as first-class objects.
5. Ask is RAG / “searches all your notes and transcripts.”
6. Catch Me Up / auto briefing exists.
7. Advise or Coach is a V1 product.
8. Meeting Prep is generated from live project truth on Capture.
9. Reminders fire or notify.
10. Production Capture is the V2 observation engine (unless `LUME_CAPTURE_V2=1` is actually on).
11. Decisions are first-class typed objects equal to risks.
12. Dependency graph or calendar.
13. “Nothing writes without review” **and** “Lume just remembers everything you paste” without the apply step.
14. History is a complete audit log.
15. Unique / verified person identity.

Safer if you must: messy text in; **proposed** typed changes; human apply; project-scoped people/risks/todos/dates; Ask over **stored project records**; Knowledge Centre inspect/correct.

---

## 6. Strongest real differentiators (copyability = 90 days of engineering)

1. **Fail-closed typed Capture apply (`planCaptureApply` / `executeCaptureApply`).** Copyable as a pattern. The refusal corpus (`src/lib/eval-capture-v2/`) is the slower asset.
2. **Conservative person identity + share-vs-replace.** Copyable as rules. Workspace `people` table is **not built**.
3. **Ask assembler over domain tables, not RAG.** Copyable. Dual Capture engines and waiting/openLoops debt are also copyable as mistakes.
4. **Review-before-write.** Product friction, not a moat.
5. **`alignSectionLines` for KC edits.** Only covers manual correction.
6. **Eval harness around wrong-Sarah writes.** Closest non-trivial advantage; still replicable.

Not a moat: entity resolution you don’t have; RAG you don’t have; conflict engine you don’t have; briefing you don’t have; default **legacy** Capture.

---

## 7. Severity close

Lume **does** have: messy text → model observations → **typed, fail-closed, human-applied** writes into **ordinary tables** → KC views → Ask over `serializeCanonicalTruth` (HTTP). People are IDs once Capture text contains the recorded full name. Risks have `status`. Dates can be updated **in place if targeted by UUID**.

Lume **does not** have: automatic fact supersession, conflict objects, RAG, stable first-name identity, reminders, Catch Me Up, Advise, meeting-prep intelligence, or a single production Capture engine.

If a landing page implies a self-updating project brain that patches the same objects and then RAGs the archive: **the code does not do that.** Capture **appends** knowledge; it **mutates** only a closed set of identified domain rows. Ask **reads those rows** (and knowledge bullets as records). It does not retrieve transcripts.
