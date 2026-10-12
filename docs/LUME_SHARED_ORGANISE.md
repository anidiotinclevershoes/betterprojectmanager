# Shared Organise

**Status:** Feature-flagged production module. Default off.  
**Harvested from:** `cursor/shared-organise-engine-5508` form v4  
**Contract commit:** `007e624121f8ada873937f4d0526358e63e19999`  
**Validated experiment HEAD:** `cb1400a1a51ce4e946ca8aac585746195d73cf51`  
**Prompt:** `shared-organise-form-v4`  
**Model when the flag is on:** `gpt-6-luna`  
**Owned by:** [`docs/LUME_CONSTITUTION.md`](./LUME_CONSTITUTION.md) §4 and [`docs/LUME_CAPTURE_STATUS.md`](./LUME_CAPTURE_STATUS.md)

This file is the engineering contract for the flagged path. It is not a second architecture memory. The observation Capture path remains the default and the rollback.

## Architecture

```text
Capture
  → load real canonical project truth
  → Shared Organise
  → GPT-6 Luna proposes a Project Change Form
  → deterministic structural validation
  → existing Review
  → existing Apply (planCaptureApply)
  → canonical database
  → fresh reload
```

Luna understands language and proposes changes. Lume validates the proposal and controls canonical truth. Luna never writes.

There is one Apply. The flag selects the semantic path only.

```text
LUME_SHARED_ORGANISE=1
```

Unset, `0`, or any other value keeps observation Capture (`capture-v2-observations`, `gpt-4o-mini-2024-07-18`).

## Canonical context

`buildSharedOrganiseContext` reads a `CaptureApplyWorld` for one project.

- Targetable ids: people, to-dos, risks, milestones.
- Context-only ids: responsibility rows, availability rows, knowledge rows. They must not be `targetId`.
- The reference date is the server's current UTC civil date. Tests may pass `2026-10-03`.

The same context shape is used for a later Capture and for a New Project onboarding packet.

## Project Change Form

Operations are the existing `CaptureLegalOperation` names. Decisions are `write_knowledge` with `section: "decisions"`.

`materialUncertainty: string[]` lists unresolved assumptions that would make the operation unsafe to apply. Lume does not read the strings. A non-empty list cannot be Ready. The suggestion is marked `truthIntent: "uncertain"`, and Apply refuses it.

## Dates

`dateIntent` is `set_explicit`, `move_relative`, `historical`, or `uncertain`.

- `set_explicit`: Luna supplies the civil date. Lume checks that the month and day are in the evidence, and that a stated year matches. A missing year is only the next occurrence on or after the reference date.
- `move_relative`: Luna supplies `direction` (`earlier`, `later`, or `unresolved`), `amount`, and `days` or `weeks`. Lume adds or subtracts that many days from the canonical milestone date. An ISO date on the same change is ignored. `unresolved` is not calculated.
- `historical`: No change. It cannot become a current milestone write.
- No canonical date: Needs You. Lume does not invent one.

Lume does not decide what “back”, “forward”, “was”, or “maybe” mean.

## People

A role is `ensure_person.roleHint` on a new person. A responsibility is `confirm_responsibility.scope`. They are different writes.

`ensure_person` does not edit an existing person's role. That proposal is Needs You. This is the existing executability gap, not a new product decision.

A generic reference (`someone`, `somebody`, `they`, `one of the`) is not a Person. A to-do can still be created with no owner.

Identity still requires the recorded name in the evidence quote. A foreign, stale, or context-only id is not identity.

Knowledge cannot carry ownership or sign-off authority. That bypass is the existing responsibility check.

## Capture adapter

`POST /api/capture` when the flag is on:

1. Rejects a missing project.
2. Loads canonical truth with `loadServerCaptureWorld`. Client-posted state is ignored.
3. Calls Luna.
4. Validates the form.
5. Returns the existing `CaptureResult` so Review and Apply are unchanged.

Ready is still subject to `planCaptureApply`. Apply revalidates, checks the expected-target fingerprint, writes through the existing hooks, records History, and reloads.

## New Project adapter

`organiseNewProjectPacket` prepends the project name and code to collated notes and calls the same `runSharedOrganiseFromModelJson`. It does not use a second prompt.

The production `POST /api/new-project` route still returns the observation draft. Switching that UI is a product decision: the current response is a draft, not Capture Review. Do not replace it until that journey is approved.

## Round-trip invariant

For every supported write:

```text
Capture N writes
  → canonical state
  → fresh reload
  → Capture N+1 context contains that truth
```

`scripts/verify-shared-organise.ts` proves the same planner and Apply seam with the in-memory executor.

`scripts/verify-shared-organise-supabase.ts` proves the production loader, `supabaseCaptureApplyHooks`, and a fresh database read against Supabase. It creates two throwaway users on the configured project and deletes them afterwards. It is not part of `npm test`. Missing URL, anon key, or service role key exits 2.

Supported round trips in that script: person create with role, responsibility then share, responsibility replace of the named current owner, to-do create and complete, risk create and resolve, explicit milestone date, relative milestone date, availability, knowledge, decision.

Not a write: existing role edit, historical date, unresolved direction, generic person, foreign id, material uncertainty, delete without an explicit remove, missing milestone baseline, stale target, replayed duplicate to-do.

## Rollback

Turn the flag off. Observation Capture, Prompt A, and the existing Apply path remain in the tree. Nothing in this module deletes them.

## Cleanup later

Do not delete these until a flagged production period has been accepted:

- observation envelope and disposition machinery
- observation extraction prompt
- ownership phrase rewrite inside the observation resolver
- New Project observation draft adapter
- duplicated semantic helpers that only exist to feed the observation path

Shared Organise must keep calling the existing identity, title, and Apply contracts. Do not replace those with a phrase list.
