# v0.9 Capture engine qualification

Hulk evidence pack. Test and classify only. No production tuning.

The v0.9 safety standard is **not** “every difficult Capture automatically resolves.”

It is: **normal use works very reliably, hard cases fail safely / Needs-you, and there are zero genuine unsafe silent durable writes.**

Needs-you is success. Category E (unsafe / silent durable write) is the blocker.

---

## Status (current — 28 August 2026)

**Stage 2 live qualification is COMPLETE. Capture is frozen for closed alpha.**

| Item | Value |
| --- | --- |
| Qualification model | `gpt-4o-mini-2024-07-18` (frozen; no bake-off) |
| Qualified engine SHA | `2131444c77c3b06b666df393362a50112d2de56f` |
| Merged `main` (PR #95) | `2e024d0bd04db87e7375a4c5b0106ccf4d4de31a` |
| Scorer | **v3** (`src/lib/eval-capture-v2/scorer.ts`) |
| Live result | LUME FAILURE **0** · LUME CATCH **22** · domain 100% · target-ID 100% |
| Verdict | **PASS for closed-alpha freeze** |

The model still makes mistakes. Lume prevented those from becoming genuine unsafe/silent durable writes. That is the product standard. Do **not** reopen Capture tuning because model-level metrics are imperfect.

**Do not treat scorer-v1 historical failure counts as current product safety.** Those rows remain in artifacts as chronology, not as the freeze verdict.

Operating picture: [`docs/LUME_V09_TO_V1_HANDOFF.md`](../LUME_V09_TO_V1_HANDOFF.md).

The remainder of this file is the **qualification programme as originally written**. Stages 1–2 below describe the work that has now happened; their “blocked / not yet” language is historical.

---

## Status (historical — as of Stage 2 blocked)

**Stage 2 (authoritative live qualification) was blocked until Thor’s identity + V2-only work landed.** That work is now on `main` (PR #95). Keep the table below for chronology only. The freeze language in this historical block is **no longer current** — see Status (current) above.

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

`scripts/verify-capture-server-truth.ts` check **visibility**

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

## Results — Stage 1 on `main` `e5cd9ba`

Prep branch: `cursor/v1-v09-qualification-prep-610b` (PR #92).

No production files were changed. `npx tsc --noEmit` passed.

| Suite | Result |
| --- | --- |
| `verify-stable-object-identity` | **1 passed, 2 failed** (Thor gate; expected) |
| `verify-resurrection` | **3/3 passed** |
| `verify-capture-server-truth` | **18 passed** (includes new visibility check) |
| `verify-stacked-capture` | **3 stories passed** (per-step sibling isolation) |

### Stable identity — exact evidence

Ordinary Todo **complete** already preserves title (`Prepare the jelly pack`, `done: true`). That path uses `complete_todo` and does not copy the transcript.

Ordinary Todo **UPDATE** (due date → 20 Oct) currently writes the full Capture sentence as the title:

```
actual:   Please update Prepare the jelly pack so the due date is 20 October 2026 after the liquorice shipment slipped a week and the parade committee asked us to hold the pack until the banners are painted.
expected: Prepare the jelly pack
```

Ordinary milestone **UPDATE** (Parade day → 29 Oct) currently writes the full Capture sentence as the label:

```
actual:   Parade day has moved to 29 October 2026 because the council moved the road closure and the float cannot leave the depot until the new date.
expected: Parade day
```

Production hole (not patched here): `src/lib/capture/apply/dispatch.ts` `update_todo` sets `title: text`; `update_milestone` sets `label: text \|\| byId.label`.

Classification: **E — unsafe / silent durable write** (identity destruction). This is Thor’s assigned structural fix (PR #89). Hulk does not patch it.

`npm run verify:stable-object-identity` stays out of the aggregated `npm test` suite until Thor lands, so Stage 1 persistence/parity coverage can stay green. The script itself is not weakened.

Cross-check (not a freeze): the same script is **3/3 green** on Thor PR #89 head `be3c76e4a579b4c278fcfc9e1ddafcf06527f331`. That SHA is still draft / unlanded and is **not** the qualified freeze SHA.

### Resurrection / parity / isolation

- Deleted Todo remains absent after reload and after an unrelated persist. Project B’s same-named Todo is untouched.
- Resolved Risk stays resolved; sibling Risk untouched.
- Superseded Knowledge item stays superseded; sibling untouched.
- After Apply, adopted state is the committed result; subsequent server load matches without a hard refresh.
- After each stacked Candyland / Toyworld / GamingStudio5000 step, the other two project snapshots equal seed.

### Stage 2 items (not run)

1. Qualified SHA — **blocked**
2. Thor PR included — **#89 draft, not landed**
3. Frozen corpus / Deep New Project / 50-event marathon / messy handover — **blocked**
4. Counts A–E for live model — **blocked**
5. Freeze verdict — **not issued**

Do not use FAIL merely because an adversarial sentence required Needs-you. Do not issue PASS until Stage 2 on the Thor-landed SHA shows **zero genuine unsafe silent durable writes**.

