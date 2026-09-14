# Current Capture status

**Status:** Living accepted position for Capture V2  
**Date:** 14 September 2026  
**Production SHA this position was accepted against:** `91fabf8d1627e89538f26e00b9b3343b9d577cdb` (PR #167)  
**Current production baseline (`origin/main`):** `29acea5149c1c56dcb18375fd22025c072931a24` (PR #184 merge)  
**Current `main` this living file was last reconciled against:** `29acea5149c1c56dcb18375fd22025c072931a24`  
**Capture Simplification:** **CLOSED** architecturally. Merged via PR #184. Validated HEAD `d06c07eba63bd018474a2b2ee943016faf3ed3ca` onto `920d65d9c0f6e49efca8e26fc8906dbbd11e8f25`. Hosted Capture → Apply → canonical Supabase reread proved on that exact SHA. Schema, RLS, persistence, and write spine unchanged. AI-first remains parked (PRs #181–#183 evidence only; do not merge).  
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
- Production prompt: **Prompt A** (`src/lib/capture-v2/prompt.ts`, id `capture-v2-observations`, version `capture-v2-eval-baseline-v2`).
- AI does not write project truth. Apply does, and still revalidates.
- Ready means the same production Apply path can execute that reviewed change.
- **Left untouched** is Review-only. It is never canonical truth, never Apply-eligible, and never a substitute write. Prompt A now includes `left_untouched` as the escape hatch when a supported operation cannot be safely identified from explicit wording. A deterministic evidence-span coverage backstop can still surface leftover source text the model did not account for, with generic wording.
- Capture dispositions: **Create / Update / Remove** (explicit, planner-executable), **Needs You** (known operation + one bounded answer), **Left untouched** (cannot safely determine or support the operation), **No change** (explicit statement already true).
- The production resolver is the **Simplification** contract. Removed: uncertain→write rematerialisation; suspicious no_change→write rematerialisation; foreign-ID+title Create rescue; linguistic hydration; unique-title identity bind; inferred default responsibility `share`. Retained: explicit ownership mapping, observation-local evidence, identity gates, contradictory siblings, `planCaptureApply`.
- AI-first Capture is **parked**. Do not import Gate 1/2, Astra-control, or bake-off experiment code into production.

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

**Prompt A remains production.** The v2 freeze only adds the Left untouched escape hatch and explicit-facts wording. It is not a Prompt E revival and is not a retune against the 538-case corpus.

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

The 534/538 routing score and Prompt A decision still stand. They are **not** V1 trust clearance.

Deterministic guards for those families now live on `cursor/v1-trust-convergence-df02` (see the issue map). They are **not** production-E2E proof. Current families: [`docs/LUME_V1_TRUST_ISSUE_MAP.md`](./LUME_V1_TRUST_ISSUE_MAP.md).

---

## 8. Related closed integrity (do not reopen as Capture work)

- Ready → Apply (D-037 / PR #126)
- Apply reload (D-045), fingerprint completeness (D-046), session/project bind (D-047), apply receipts (D-048)
- Observation-local identity evidence and contradictory-sibling Needs You (PR #167)
- New Project name-only recovery from remaining VALIDATE rejects (D-052 / PR #167)

---

## 9. Architecture closeout (14 September 2026)

Capture Simplification is the canonical production architecture on `main`.

This baseline contains: Simplification resolver; Left untouched; narrowed Needs You; removed semantic rescue stack; unchanged canonical persistence model; unchanged database schema; unchanged write spine; AI-first excluded.

Accepted conservative behaviours (do not restore lost automation unless a future validated user problem justifies it):

- some restated Person facts → Needs You
- “responsibility continues” may → Needs You
- unsupported/uncertain semantics → Left untouched / Needs You rather than rescue

Future work should focus on 0.9 tester UX, Review usability, Left untouched clarity/recovery, manual recovery flows, and product polish — not resolver cleverness.

Do not merge Gate 1, Gate 2, Astra control, or the three-way bake-off.
