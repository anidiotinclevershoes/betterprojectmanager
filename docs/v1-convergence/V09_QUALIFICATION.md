# v0.9 Capture engine qualification

Hulk evidence pack. Test and classify only. No production tuning.

The v0.9 safety standard is **not** “every difficult Capture automatically resolves.”

It is: **normal use works very reliably, hard cases fail safely / Needs-you, and there are zero genuine unsafe silent durable writes.**

Needs-you is success. Category E (unsafe / silent durable write) is the blocker.

---

## Status

**Stage 2 (authoritative live qualification) is BLOCKED.**

Do not treat this document, this branch, or current `main` as a freeze.

Authoritative `gpt-4o-mini-2024-07-18` runs happen only after Thor’s:

1. stable-object-identity fix; and
2. Capture V2-only convergence

have landed on the SHA being qualified.

| Item | Value |
| --- | --- |
| Qualification model | `gpt-4o-mini-2024-07-18` (frozen; no bake-off) |
| Current `main` at Stage 1 open | `e5cd9ba8e183f7a42f8f5c74aef73c3c7d73d54f` |
| Qualified SHA | **not yet — Stage 2 blocked** |
| Thor PR | [#89](https://github.com/anidiotinclevershoes/betterprojectmanager/pull/89) (draft) |
| Thor branch | `cursor/v1-capture-identity-v2-only-9524` |
| Verdict | **not issued** |

---

## Stage 1 — deterministic regressions (Nick Fury persistence audit)

Reuse existing verify scripts / FakeWorkspaceClient / stacked runtime. No new persistence platform. No corpus retune. No prompt/scorer/model change.

### A. Stable identity

`scripts/verify-stable-object-identity.ts` (`npm run verify:stable-object-identity`)

Real Capture V2 Analyse → Apply against experimental worlds. Encodes the expected invariant, **not** current broken `title: text` / `label: text` behaviour in `dispatch.ts`.

| Check | Expected after Thor |
| --- | --- |
| Ordinary Todo complete | title stays `Prepare the jelly pack`; `done` becomes true |
| Ordinary Todo due-date UPDATE | title stays; due date moves; transcript is not the title |
| Ordinary milestone date UPDATE | label stays `Parade day`; date moves; transcript is not the label |
| JSON reload | identity still preserved |
| Toyworld / GamingStudio5000 | snapshots unchanged |

**Expected on current `main`:** red. That is the Thor gate. Do not weaken.

Thor already added planner-level identity checks on PR #89 (`verify-phase3b-capture-boundary`, `verify-capture-v2-invariants`). This script is the qualification-facing V2 Apply + reload + isolation gate.

### B. Resurrection

`scripts/verify-resurrection.ts` (`npm run verify:resurrection`)

Shared persist + `loadMissionStateFromSupabase` path:

1. create durable Todo on Project A (same title on Project B)
2. reload — present
3. `persistTodoDelete` (production persist path)
4. immediate absent
5. reload — absent
6. unrelated Todo create on A
7. reload — deleted Todo still absent; B’s same-named Todo untouched

Cheap extras: resolved Risk stays resolved; superseded Knowledge item stays superseded.

### C. Visibility / server parity

`scripts/verify-capture-server-truth.ts` check **L**

After successful Capture V2 Apply:

- returned/adopted state is the committed result
- a subsequent `loadServerCaptureWorld` from that state returns the same relevant project truth
- the tester does not need a hard refresh

### D. Project isolation

Existing stacked + D-035 coverage retained. Sequential strengthen: after **each** stacked step, sibling project snapshots must equal the seed snapshot.

---

## Stage 2 — post-Thor live qualification (not run)

Once Thor’s final converged SHA is on the branch being qualified, record that SHA and run:

1. Frozen original Capture corpus
2. Deep New Project creation
3. 50-event sequential Capture marathon
4. Selected messy PM-handover/correction cases
5. Relevant deterministic persistence/integrity suites (including this Stage 1 pack)
6. Reload / project isolation checkpoints

Harbourline stress journeys live on PR #85 and are reused after Thor, not re-authored here.

Do **not** qualify PR #89 itself as the freeze SHA until it has landed and this pack is green on that SHA.

---

## Safety classification (Stage 2)

| Code | Meaning |
| --- | --- |
| A | Correct autonomous |
| B | Correct Needs-you |
| C | Safe limitation |
| D | UX / wording issue |
| E | Unsafe / silent durable write (**blocker**) |

---

## Results (filled as evidence lands)

See later sections / PR updates. Stage 1 script outcomes are recorded after the first run on this branch.
