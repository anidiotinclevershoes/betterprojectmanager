# Production long-run dogfood — frozen specification

**Suite id:** `hosted-longrun-v1`  
**Seed:** `lume-longrun-v1-20260912-a3db`  
**Status:** FROZEN before first production execution  
**Integration baseline:** `origin/main` `9f24a65c7ea38d1dabb2d513a87503fb9e7a4cd6`  
**Machine source of truth:** [`frozen-manifest.ts`](./frozen-manifest.ts)

Do not run Lume and then edit this file or the manifest to match behaviour.

---

## Why this programme exists

The hosted vertical 6 and the independent holdout 6 prove short journeys. They cannot prove accumulated-state failure: identity pressure over weeks, the same milestone updated three times, leftover Knowledge vs domain status, Review manipulation, reload after a large world, or sibling isolation under serial Applies.

This programme asks:

> Would a normal user trust Lume with one ordinary professional project across ~50 real Captures?

## Required path

Every Capture must travel:

```text
browser
→ production Lume (main)
→ production auth
→ real UI
→ live OpenAI (Prompt A)
→ deterministic validate / resolve
→ Review + planned user Review interaction
→ Apply
→ production canonical Supabase
→ hard reload / navigate / new context where planned
→ authoritative UI projection
```

Frozen envelopes, resolver calls, mocked providers, and API-only writes cannot make a journey pass. They are diagnosis-only after a failure.

## Standing product contracts (current main)

Source: constitution, Capture status, Review/Apply code — not historical handovers.

- AI extracts; deterministic Lume validates; Review stages; Apply writes and revalidates.
- Needs You is success for genuine unsafe ambiguity. Missing optional data is not Needs You.
- Name-only Person is complete. A model UUID is not identity.
- First-name-only restatement of an existing Person is Needs You (Pippa-class).
- Observation-local identity evidence. Sibling names must not poison an unrelated observation.
- Contradictory sibling writes on the same record stay Needs You.
- Ready means the same production Apply path can execute that change.
- Exclude change dismisses a pending card. It must not be written. Apply count is pending Ready only.
- **Re-include after Exclude is not a shipped control** (D-025 remainder). The suite attempts it and records `PRODUCT_MODEL_GAP` if absent. That is not a silent rewrite of expected writes.
- Candidate free-text title edit is not a shipped Review control. Legal candidate edits are: provide date, change entity kind, choose target, ownership share/replace. `onResolve`, `onProvideDate`, and ownership share/replace **may write immediately** in current CaptureWorkspace. Selection via Use this / Create new / entity kind **stages only**.
- Apply still revalidates. After a successful write, never adopt pre-write state.
- Capture session binds to the open project.

### Legal mutations (expected-success)

| Domain | Legal ops |
| --- | --- |
| To Do | create, update, complete, archive, delete, remove |
| Risk | create, update, complete |
| Person | create / ensure only |
| Milestone | create, update (date move) |
| Knowledge / memory | create, update |
| Responsibility / availability | create, update |

### Product-model gaps (Needs You is success; do not invent destruction)

- Milestone cancel / complete / remove (D-029)
- Knowledge retire / supersede
- Person update / remove / end involvement
- Cancellation represented only as Knowledge

## Review plan (pre-committed)

| Interaction | Captures |
| --- | --- |
| Exclude | 7, 17, 20, 22, 35, 40 |
| Exclude then attempt re-include | 22 |
| Needs You resolve (if UI offers a legal control) | 9, 27, 42 |
| Needs You exclude | 15, 20, 38, 41 |
| Candidate date edit | 12 |
| Candidate entity-kind edit | 31 |
| Mixed Review | 20, 38 |

## Reload / session checkpoints

After New Project; after captures 5, 10, 12, 18, 20, 30, 33, 40, 48, 50; plus search/nav as tagged on the capture.

## First-run rule

The first complete frozen production run is diagnostic.

- Do not fix production code during it.
- Do not rewrite frozen expectations after observing Lume.
- Continue after ordinary failures so families can recur.
- Stop immediately only for: active data corruption; unexpected destructive mutation; cross-project/customer mutation; security/privacy issue; isolation failure.

## Scoring

Do not reduce this programme to a percentage. Integrity categories have zero tolerance:

- silent wrong write
- cross-project mutation
- unexplained deletion
- stable-ID corruption
- excluded candidate written
- unresolved Needs You entering canonical truth
