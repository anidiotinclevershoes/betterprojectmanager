# Current Capture status

**Status:** Living accepted position for Capture V2  
**Date:** 12 September 2026  
**Production SHA this position was accepted against:** `91fabf8d1627e89538f26e00b9b3343b9d577cdb` (PR #167)  
**Current `main` this living file was last reconciled against:** `e0f140d67b3be7ecc51dd5c4056338a12b4d244c` (PR #170 dogfood programme; Capture rules unchanged)  
**Owned by:** [`docs/LUME_CONSTITUTION.md`](./LUME_CONSTITUTION.md) §4  
**Docs entry:** [`docs/README.md`](./README.md)

This file is the **current Capture position**. Historical qualification, experiment harnesses and prompt bake-offs do not override it.

Correct reading:

> **Deterministic routing is sufficiently converged for V1. Live model imperfections remain guarded by deterministic safety.**

Do not read this as “AI extraction is perfect.”  
Do not read this as “Capture is fundamentally unfinished.”

---

## 1. Architecture (unchanged)

```text
human language
  → AI extraction
  → deterministic Lume validation / resolution
  → Review
  → Apply
  → canonical project truth
  → authoritative reprojection
```

- Production engine: Capture V2 only (`isCaptureV2Enabled()` always returns true).
- Production model: `gpt-4o-mini-2024-07-18`.
- Production prompt: **Prompt A** (`src/lib/capture-v2/prompt.ts`, id `capture-v2-observations`, version `capture-v2-eval-baseline-v1`).
- AI does not write project truth. Apply does, and still revalidates.
- Ready means the same production Apply path can execute that reviewed change.

New Project Organise uses the **same extractor**, then a New Project adapter (`parse` + `draftFromProvisional`). It is not a second Capture engine.

---

## 2. Deterministic routing — accepted convergence

Accepted result on the 538-case observe-only map, measured on production `91fabf8`:

> **534 / 538**

The four remainder cases are:

| Remainder | Classification | Do not |
| --- | --- | --- |
| `id-pippa-first-on-candy` | Intentional first-name identity-safety. A first-name-only restatement is Needs You, not silent `no_change`. | Weaken identity safety merely to restore the older **535** score. |
| Milestone cancel / remove | Product-model gap | Treat as an extraction bug |
| Knowledge supersede / retire | Product-model gap | Invent retire/supersede semantics in passing |
| Cancellation represented as Knowledge | Product-model gap | Invent how that Knowledge should mutate domain state |

The 538-case corpus and `verify:capture-convergence` harness are **experiment-only**. They were deliberately kept off `main` (PR #167). Do not merge that corpus as ordinary regression.

Evidence of the accepted score: experiment PR #168 (Prompt E observe-only on post-#167 `main`) and the reconstruct notes on `cursor/capture-prompt-e-6709`. Unique production rules from that work already landed in #167.

Earlier maps (526/538 on #156; 535/538 on a pre-holdout experiment) are chronology only.

---

## 3. Production prompt — A retained, E rejected

**Prompt A remains production.**

A live Prompt E experiment was run on post-#167 `main` (PR #168, `cursor/capture-prompt-e-6709`). It is **not** a merge candidate.

Observed on the frozen 10-case holdout (`gpt-4o-mini-2024-07-18`, temperature 0.2, A×3 and E×3):

- Prompt E dramatically reduced invented / foreign target IDs (15 → 1);
- Prompt E preserved valid Creates and name-only People;
- Prompt E did **not** improve the target ambiguous-pronoun behaviour (unsafe pronoun binds stayed 6 = 6);
- Prompt E materially increased Needs You (22 → 28);
- therefore Prompt E did **not** earn promotion.

Future agents must **not** assume Prompt E is the next implementation task.

Any future prompt experiment starts from current production A and requires new evidence. Do not retune A against the 538-case corpus.

---

## 4. Accepted live-model limitations

The live extractor remains imperfect. Known behaviour includes:

- occasional invented / foreign target IDs;
- imperfect pronoun / reference binding;
- occasional omission of an important field such as a date;
- occasional attachment to the wrong candidate target.

The deterministic layer exists specifically to stop these imperfections becoming unsafe canonical writes.

Do not retune Capture because model-level metrics are imperfect. Needs You is success for genuine unsafe ambiguity.

---

## 5. Product-model gaps are not Capture defects

The three remainder gaps above need **deliberate product decisions**. Do not invent:

- milestone cancellation / removal semantics;
- Knowledge supersede / retire semantics;
- how cancellation represented as Knowledge should interact with canonical domain state.

Do not casually “fix” them as extraction bugs.

---

## 6. What is historical / experimental (do not drive implementation)

| Material | Role |
| --- | --- |
| [`docs/v1-convergence/V09_QUALIFICATION.md`](./v1-convergence/V09_QUALIFICATION.md) | Chronology. The “Stage 2 BLOCKED” heading is **historical**. |
| v0.9 freeze metrics in the v0.9 handoff | Historical freeze evidence (LUME FAILURE 0 / CATCH 22). Still true as freeze evidence; not the current 534/538 routing map. |
| `docs/EXPERIMENTAL_PROGRAMME.md` | HISTORICAL. Capture V2 is not experimental. |
| PRs #156, #163, #165, #166, #168 | Experiment / reconstruct / observe-only. Salvage sources. Do not merge wholesale. |
| 538-case corpus / prompt-experiment tooling | Off `main` by design. |

---

## 7. Production long-run supersedes “0 P0 blockers”

A later untouched production 50-Capture E2E (`lr-20260912T2212Z`, D-053) demonstrated wrong-target Apply, silent empty Reviews, zero persisted responsibilities, unmatched Creates, and first-paint lag.

The 534/538 routing score and Prompt A decision still stand. They are **not** V1 trust clearance. Current families: [`docs/LUME_V1_TRUST_ISSUE_MAP.md`](./LUME_V1_TRUST_ISSUE_MAP.md).

---

## 8. Related closed integrity (do not reopen as Capture work)

- Ready → Apply (D-037 / PR #126)
- Apply reload (D-045), fingerprint completeness (D-046), session/project bind (D-047), apply receipts (D-048)
- Observation-local identity evidence and contradictory-sibling Needs You (PR #167)
- New Project name-only recovery from remaining VALIDATE rejects (D-052 / PR #167)
