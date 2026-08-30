# v0.9 MODEL↔DETERMINISTIC SEAM REPORT

**Role:** Hulk (qualification only).  
**Production candidate:** PR #113 `cursor/v09-ready-apply-parity-9524` @ `1919c745664884356bdd122c0270100f7a41c256`.  
**Live envelopes:** PR #114 run `33323265425` (uncleaned), frozen in `scripts/seams/live-envelopes.json`.  
**Pack:** PR #115 `cursor/v1-v09-seam-torture-610b`. Command: `npm run verify:v09-seams`.  
**Not wired into `npm test`.** No production changes. Do not merge.

Machine results: `docs/v1-convergence/seam-results.json`.

---

## Executive verdict

**ADDITIONAL SHARED SEAM FAILURES FOUND**

The known receipt collision is real and still P0. Capture Review→Apply parity, required-field gating, invalid-combo fail-closed, cross-domain non-execution, and the scheduled-date Ask gate all hold on #113.

Two more shared seams are confirmed, not just that receipt:

1. New Project maps validate-accepted model JSON to a draft **without** Capture resolve / Ready semantics / `truthIntent`.
2. Ask’s source-kind authority bound is **date-only**. Owner and open-risk questions still label knowledge prose as `direct_confirmation`.

This is not a collapsed Ready/Apply contract. It is not “receipt only.”

---

## Test count

**15 journeys. PASS 10 / EXPECTED RED 3 / UNEXPECTED RED 2.**

| Bucket | Journeys |
| --- | --- |
| EXPECTED_RED | S1-receipt-obs-1, S1-dup-in-envelope, S10-durable-identity-scan |
| UNEXPECTED_RED | S8-new-project-adapter, S9-ask-authority |
| PASS | S1-missing-id, S1-live-c1-project-as-person-target, S2-required-fields, S3-invalid-combos, S4-person-review-vs-transcript, S4-date-review-vs-transcript, S5-order-independence, S6-cross-domain-targets, S7-partial-extract, S3-live-c71-2023-iso |

---

## Model-generated ID assumptions

Every confirmed runtime use. Display text is not listed.

| Location | What the model string becomes | Durable? |
| --- | --- | --- |
| `src/lib/capture-v2/resolve.ts` | `suggestion.id = \`v2-${observation.id}\`` | **Yes — Apply receipt / idempotency key** |
| `src/lib/capture/apply/dispatch.ts` | `applyOperationId: item.id` on todo / risk / milestone **create** | **Yes — written to `capture_apply_receipts.operation_id`** |
| `src/lib/capture/apply/apply-approved.ts` + `persist-execute.ts` | Receipt short-circuit on that operation id | **Yes — cross-request lookup** |
| `src/lib/data/supabase/persist-mutations.ts` | `eq("operation_id", key)` | **Yes — DB unique identity for “already applied”** |
| `src/lib/capture-v2/toResult.ts` | `find-${observation.id}`, `v2op-${observation.id}` | Session Review keys only. Collide inside one envelope. Not the Apply receipt. |
| `src/lib/new-project-v2/parse.ts` | Provisional item `id = obs.id` | Session lookup key (`recategoriseItem`). Duplicate `obs-1` recategorises **both** rows. `clientKey` for create is `newSetupClientKey()` (random) — not model. |

**Not confirmed as model-durable identity**

- Entity row primary keys: `crypto.randomUUID()`.
- New Project `clientKey`: random `setup-*`.
- Review `item.content` / proposed titles: display / reviewed semantics, not keys.

Live #114 reuse: every capture uses `obs-1`…`obs-9`. That is why C9’s todo receipt blocks C11’s UAT create.

---

## Optional→required mismatches

Domain matrix from S2 (Capture validate → resolve → Apply) plus S8 (New Project adapter).

| Domain | Missing proposed field | Capture on #113 | New Project adapter |
| --- | --- | --- | --- |
| person | `name` | Needs You | Drafts `name = statement`, `needsReview: true` |
| todo | `title` + empty statement | Rejected (`missing_statement`) | n/a in this row |
| risk | `title` (statement present) | Ready — statement used as title; Review content = statement | Same statement fallback |
| milestone | `label` (statement + ISO date) | Ready — statement used as label | Statement/label fallback |
| milestone | ISO `date` | Needs You | Drafts `importantDates` with label, **no date**, `needsReview: false` |
| availability | `personName` | Needs You | (not in NP person map) |
| availability | `awayFromIso` (label only) | Needs You | n/a |
| responsibility | `personName` | Needs You | n/a |
| responsibility | `scope` | Needs You | n/a |
| knowledge | empty statement | Rejected | n/a |
| person | `truthIntent: uncertain` + name | Needs You (S3) | Drafts ready person, `needsReview: false` (S8 Liam Brooks) |

No Capture case became Ready with **no** usable identity. Statement-as-title/label is Review-consistent (P2). New Project skipping `missingReadySemantics` / `truthIntent` is the optional→required hole.

---

## Invalid semantic combinations

S3 against a seeded board. Zero writes.

| Combination | Decision |
| --- | --- |
| `non_current` + `update_existing` + date | `no_change` (“Not asserting current project truth”) |
| `uncertain` + `create_new` | `needs_you` |
| `create_new` + `candidateTargetId` of an existing todo | `no_change` (“already on the project”) |
| `no_change` + proposed `status: resolved` | `no_change` (disposition wins) |
| `commentary` + person target | `no_change` |
| risk `update_existing` + illegal `status: spicy` | `needs_you` |

Live C71 (`current` + ISO `2023-10-18` on CAB) **wrote 2023**. That is a complete model assertion, not a seam. Apply executed the reviewed ISO.

---

## Review→Apply parity

No mismatch.

- Reviewed **Sarah Kim** in a transcript that also names Sarah Okonkwo → persisted Sarah Kim only.
- Reviewed CAB **2026-10-20** in a transcript that also says 18 Oct 2023 / the 12th → persisted `2026-10-20`.

Apply consumes reviewed `content` / `proposedValues` / `personName` / `date`. Transcript is evidence that the reviewed name appears, not a second name scan.

---

## Ordering assumptions

S5: original / reversed / commentary-first of the same person+todo pair all persist `Jordan Hale` + `UAT script`. Outcome follows observation ids and semantics, not list order.

---

## Cross-domain targeting

S6: person→todo id, todo→milestone id, milestone→risk id, risk→person id.

- **Validate accepted all four.** `candidateTargetId` is checked for “exists in project catalogue” and same project. **No `entityType` match.**
- **Resolve/Apply wrote none.** Person gate: “not on this project.” Todo/milestone/risk planners look up their own tables and Needs You.

Live C1 person `update_existing` targeting the **project UUID** is `foreign_id` (projects are not in the ID catalogue). Rejected. No write.

Wrong-domain execute is not confirmed. The missing validate check is a missing belt; the planner is the suspender.

---

## New Project contract

S8 UNEXPECTED_RED. Same hostile envelope through `parseNewProjectV2Envelope` + `draftFromProvisional` only (not Phase 3B Apply).

| Input | Capture would | New Project did |
| --- | --- | --- |
| Person, no `name`, statement “Someone important joined.” | Needs You | Stakeholder named the statement, `needsReview: true` |
| Two items both `id: obs-1` | Receipt collision on Apply | Both kept; `recategoriseItem("obs-1")` would retarget both |
| Milestone label CAB, no date | Needs You | `importantDates[{ label: "CAB" }]`, `needsReview: false` |
| Person Liam Brooks, `truthIntent: uncertain` | Needs You | Stakeholder Liam Brooks, `needsReview: false` |

`clientKey` is not the leak. The leak is: New Project never runs `resolveObservations` / `missingReadySemantics`.

---

## Ask authority/confidence

Scheduled-date gate **holds** (`constrainScheduledDateConfidence`):

- “What is the current target release date?” + knowledge source → `related_context`
- Same question + timeline source → `direct_confirmation`
- Local Ask (no OpenAI) for that date question → `not_found` (no local date path). Conservative. Safe.

That function is date-shaped only. Owner / risk / todo questions pass through unchanged. Representative Ask on a board with **no** first-class risk rows and **no** confirmed responsibility:

| Question | Source on the board | Confidence |
| --- | --- | --- |
| Current target release date | Timeline exists; local path unused | `not_found` |
| Who currently owns UAT? | Knowledge people bullet “Priya owns UAT according to an old email” | **`direct_confirmation` / knowledge** |
| Main open risks right now? | Knowledge risks title containing “risk”; empty `risks` table | **`direct_confirmation` / no sources** |
| Current status of login error handling? | Open todo + knowledge “is done” prose | `not_found` |

Owner: `localGroundedAnswer` treats a knowledge/todo **prose** ownership mention as `direct_confirmation`. That is not `findConfirmedOwners` (structured responsibility). Same class as the old scheduled-date prose confirmation.

Risk: knowledge titles matching `/risk/` become “Open risks I can see” at `direct_confirmation` even when no risk-row sources are attached.

Todo/status: no local over-claim.

---

## Confirmed P0

- Live C9 `obs-1` todo create then C11 `obs-1` UAT create → UAT `no_change` “This approved create was already applied.” No UAT milestone. Valid reviewed create silently dropped because a **different** capture reused the model-local id.
- Two different creates sharing `obs-1` in **one** envelope: second create dropped on the same receipt.

## Confirmed P1

- Ask current-owner question labelled `direct_confirmation` from knowledge prose (not a confirmed responsibility row).
- Ask open-risks question labelled `direct_confirmation` from knowledge risk titles with no risk-domain source.
- New Project drafts an `uncertain` person as a ready stakeholder (`needsReview: false`).
- New Project drafts a dateless milestone as a ready important date (`needsReview: false`).

## P2 / safe behaviour

- Capture statement-as-title/label when `proposedValues` omit title/label (Review content = statement; Apply writes that).
- Missing `observation.id` defaulted to `obs-N` (still a local id; feeds the receipt bug if those collide).
- Live C1 project UUID as person target: `foreign_id`, no write.
- Invalid enum combinations: no write.
- Cross-domain ids: validate accepts, Apply does not execute.
- Partial extract (2 of 10): no invented siblings. Priya create Needs You because the name is not in the capture text (identity gate). Conservative.
- Scheduled-date Ask gate; local date/todo-status `not_found`.
- New Project nameless person: statement used as name **and** `needsReview: true` (Review can still stop it).
- Live C71 writing 2023 ISO: model-complete current value, not Review≠Apply.
- Finding / proposed-op ids derived from `observation.id`: session keys only.

---

## Root-cause clusters

Three primitives. Not twenty patches.

### 1. Model-local `observation.id` is treated as a globally durable Apply identity

`v2-${observation.id}` is the suggestion id and the create receipt key. The model contract never promised uniqueness across captures or even inside one envelope. Live #114 reused `obs-1` on every capture. That is the #114 Ready→Apply `no_change` storm.

Same primitive: New Project provisional `id = obs.id` (session collision, not the DB receipt).

### 2. New Project stops at validate; Capture Ready lives in resolve

Capture Ready is `missingReadySemantics` + `truthIntent` + person identity gate + `planCaptureApply`. New Project copies accepted observations into `CreateProjectInput` and fills holes with `statement`. Uncertain / dateless / nameless items can look ready. This is the same “optional upstream, required downstream” family, on the other adapter.

### 3. Ask source-kind authority is implemented only for scheduled dates

`constrainScheduledDateConfidence` is correct and narrow. Owner and open-risk local answers still mint `direct_confirmation` from knowledge prose. First-class current owner / open risk is a structured row (confirmed responsibility, `risks` table), not a knowledge bullet.

Validate’s missing `entityType` check is **not** a fourth cluster: planners fail closed. Do not spend a hardening pass on it unless cluster 1/2/3 are done and a write path appears.

---

## Recommendation

**ONE BOUNDED SHARED SEAM HARDENING PASS**

Not receipt-only: New Project and Ask owner/risk are the same “model value implied a stronger contract than the source” family.

Not a deeper rewrite of Ask or Capture. The Capture Ready/Apply/review identity contract on #113 holds.

Bounded pass, if taken:

1. Apply receipt / operation id must be allocated by the system (per capture, per approved item) — not `v2-${model obs id}`.
2. New Project draft must apply the same Ready / `truthIntent` / required-field rules, or force `needsReview` wherever Capture would Needs You.
3. Ask: do not emit `direct_confirmation` for current owner / open risk unless the cited source is the first-class row those questions already treat as authoritative (structured responsibility, risk row). Same shape as the scheduled-date gate. Do not redesign Ask.

Then another live 100. Do not merge this pack. Do not merge #113 until cluster 1 is fixed at minimum.
