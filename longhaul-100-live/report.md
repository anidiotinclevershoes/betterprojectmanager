# LUME v0.9 LIVE 100 — FINAL QUALIFICATION

**TEST / RELEASE QUALIFICATION ONLY. Production was not modified. Do not merge.**

| | |
| --- | --- |
| Candidate | PR **#113** `cursor/v09-ready-apply-parity-9524` @ `1919c74` |
| Harness | `cursor/v1-v09-live-100-113-610b` @ `91eba9d` / CI merge `841f42d` |
| CI | [run 33323265425](https://github.com/anidiotinclevershoes/betterprojectmanager/actions/runs/33323265425) **live-100 SUCCESS** (~8 min). All 6 checks green after the `npx tsx` harness fix. |
| Mode | **live** `gpt-4o-mini-2024-07-18` + disposable Supabase |
| Fake / envelopes / observation repair | **false** |
| Scenario / oracle | unchanged Northstar 100 from #108 / #112 |
| Captures | **100 / 100**. `stoppedAt` null. Reload OK at every checkpoint. |
| AI calls | 100 extract + 30 Ask + 12 analyse-only = 142 |

Oracle `divergenceCount: 100` is **not** the verdict.

---

## Executive verdict

**ONE P0/P1 BLOCKER REMAINS**

#113 fixed the holes that emptied the #112 board. People can be born. Required semantic fields are requested and gated. Ambiguous Sarah stays Needs You. Ask no longer gives `direct_confirmation` from knowledge/decision prose. Analyse restatements no longer want to write. Isolation, reload, and History/current separation hold.

That is not enough for a release candidate.

**Ready still does not mean Apply will execute.** 77 Resolve-Ready items; **38 wrote; 39 returned `no_change` — every one with `This approved create was already applied.`** Receipts are keyed by `v2-${observation.id}`. Live extract reuses `obs-1` / `obs-2` across captures. After the first write of that id, later Ready creates are treated as replays and discarded. C11 is the exhibit: three distinct milestone creates (UAT 14 / CAB 18 / Release 27); one landed; two were “already applied.” Most later todos never existed.

**A = 6** silent/stale captures wrote current truth, including ISO dates in **2023**. The release bar wants A/B at zero. B is zero. A is not.

Do not merge #113 or #114.

---

## Ready→Apply parity

| | |
| --- | ---: |
| Resolve-Ready items Applied | 77 |
| `executed.kind === "wrote"` | **38** |
| Non-effects | **39** |
| Non-effect kinds | `no_change` × 39 |
| Thrown exceptions | 0 |
| Wrong-project blocks | 0 |
| Apply `needs_you` / `failed` after Ready | 0 |

Every non-effect reason is the same: **`This approved create was already applied.`**

That is `applyApprovedCaptureSuggestion` hitting `findApplyReceipt` on `applyOperationId === item.id === "v2-" + observation.id` (`resolve.ts` + `apply-approved.ts`).

This is **not** the old missing-field hole. `missingReadySemantics` fired on only 6 current create/update rows (risk/todo updates without a legal status). Those never became Ready. The 39 Ready items had complete fields. Apply then no-op’d because a **previous capture** had already stored a receipt for the same recycled model id.

Domain split of the 39: todo 27, risk 7, milestone 5.

C11 (clear, complete, confident — should execute):

| Observation | proposedValues | Apply |
| --- | --- | --- |
| UAT Start / 2026-10-14 | complete | `no_change` already applied |
| CAB Date / 2026-10-18 | complete | **wrote** |
| Target Release / 2026-10-27 | complete | `no_change` already applied |

**Systemic Ready-but-unexecutable contract gap: yes.** This alone blocks `READY FOR v0.9 RELEASE CANDIDATE`.

---

## A/B unsafe truth failures

| Letter | n | Release bar |
| --- | ---: | --- |
| **A** | **6** | Must be 0 unless misclassified |
| **B** | **0** | Pass |

**B is clean.** No duplicate people. No split-brain. C42 “Sarah said… threat model” stayed Needs You. C51 “Sarah said… member comms” stayed `no_change` (did **not** write a decision). Sarah Kim was created as her own row (C33) without merging into anyone.

**A is real, not a scorer misfire:**

| Cap | What wrote | Why it is A |
| ---: | --- | --- |
| 30 | Risk update on “API timeout is still open… not changing it” | Explicit no-change wrote current truth (onto “Last renewal got bounced”) |
| 55 | Created Priya Shah and Elena Voss | “No new owners” / attendance chatter wrote people |
| 71 | CAB Date → `2023-10-18` | Stale steering-notes capture; model marked one row `current` and Apply wrote |
| 75 | Knowledge update “NimbusPay no longer supplies the export” | Oracle silent; wrote |
| 81 | Person update “Sarah Kim is covering security” | Oracle silent (don’t reassign); wrote |
| 82 | CAB Date → `2023-11-18` | Template-cruft capture; wrote a **wrong year** |

C71 and C82 are also **E**. They are A because current truth moved.

---

## Needs You quality

**C = 17.** Truth-safe. Desired when uncertain.

Correct conservative: **C42, C50** (ambiguous first-name / unclear owner).

Missed automation (clear names, model used `update_existing` against the seed to-do or an existing person, Resolve Needs You’d): Liam Brooks (C2), Sarah Okonkwo (C3), Marcus (C4/C5 path), later ownership transfers (C65/C66, C91/C92). Those people **never appear** on the board except where a later `create_new` recovered them (Priya/Elena at C55).

This is acceptable under the 75/25 bar. It is **not** a Ready→Apply hole. Do not treat it as a failure merely because automation did not occur.

---

## Extraction misses

**D = 1** (C69 UAT script update). Recall is dramatically better than #112 (D=14).

The model now puts `proposedValues.name` / `title` / `label` / `date` on clear creates. Person-name contract from #113 is live-proven.

C1 observed Priya with `name: "Priya Shah"` but as `update_existing` (no person to update) → resolve `no_change`. Not a D (the fact was extracted). She was created later at C55. Scorer marked C1 `correct`; oracle still diverged at C1. That is missed automation / disposition, not a blank extract.

---

## truthIntent quality

**E = 5** (71, 73, 76, 77, 82). C63 and C78 scored correct.

| Cap | Intents | Wrote? | Notes |
| ---: | --- | --- | --- |
| 63 | current | yes | agreed UAT move — correct |
| 71 | current, non_current | **yes** | stale 22nd — **A+E**; wrote `2023-10-18` |
| 73 | current, uncertain | no | discussed 30th; safe |
| 76 | current, current | no | receipt blocked the 27th create |
| 77 | current | no | explicit no-change; safe |
| 78 | current, non_current, current | no | quoted 14th; did not roll back |
| 82 | current, non_current | **yes** | template 12th — **A+E**; wrote `2023-11-18` |

`non_current` appears and is respected when it is the write row. The failures are rows the model still marked `current` on stale/template text **with a complete ISO date**. Prompt tightening did not stop those. Proportionate P1/P2 — except they produced A writes, which the release bar does not allow.

---

## Identity results

| Person | Landed? | How |
| --- | --- | --- |
| Priya Shah | **yes** (CK75+) | C1 did not create; C55 chatter create |
| Liam Brooks | **no** | C2 `update_existing` → Needs You |
| Sarah Okonkwo | **no** | C3 `update_existing` → Needs You |
| Sarah Kim | **yes** (CK50+) | C33 `create_new` with `name` — wrote. Distinct row |
| Marcus Chen | **no** | never a successful create_new |
| Jordan Hale, Dev Patel, Amira Rahman, Tomiko Sato, Chris Bell, Elena Voss, Nadia Qureshi | **yes** | create_new + name |

People at C100: **9**. #112 had **0**. #108 deterministic had 11 (no Sarah Kim).

Ambiguous Sarah: C42 Needs You; C51 no write. **B = 0.**

Identity map bound Sarah Kim, Jordan, Dev, Amira, Tomiko, Chris, Nadia, plus a few todos. `milestone:uat-start` still points at the **CAB Date** row — the only milestone that survived receipts.

No duplicate people. Atlas Quinn Adler + ledger to-do untouched.

---

## Ask authority

30 live Ask calls. Ask did not mutate truth.

**Scheduled-date fix is live-proven.**

| CK | Release-date confidence | Answer |
| ---: | --- | --- |
| 1, 10, 25, 75 | `not_found` | no release row — honest |
| 50 | **`related_context`** | “October 16, 2026” from the CAB milestone |
| 100 | **`related_context`** | “November 18, 2023” from the CAB milestone |

No `direct_confirmation` from knowledge/decision prose (the #112 C100 “27 October” `direct_confirmation` path is gone).

Residual: Ask still *answers* with the only timeline row (CAB) as if it were the release, just at `related_context`. Sources arrays on the recorded answers were empty. Why-moved still invents SSO/steering causal stories and, by CK75/100, repeats the **2023** CAB date with `direct_confirmation` (historical probe, not the scheduled-date gate).

UAT owner: `not_found` throughout (Jordan’s UAT responsibility never stuck; Sarah Okonkwo absent). Honest given the board.

---

## Final project coherence

Better than #112. Still not “the project we spent 100 updates building.”

**People (9):** Jordan Hale, Dev Patel, Amira Rahman, Tomiko Sato, Chris Bell, Sarah Kim, Priya Shah, Elena Voss, Nadia Qureshi. Missing Liam, Sarah Okonkwo, Marcus. Roles all `Stakeholder`.

**Todos (5):** seed baseline (due **2023-10-26**); Login error handling (**done**, due 2023-10-15); Vendor contract check; a dump title “Mark pen-test findings, accessibility pass, and perf budget as complete.”; Feature-flag cleanup. Most Ready todo creates never landed (receipts).

**Risks (1):** “Last renewal got bounced” → resolved. API timeout never got its own row.

**Milestones (1):** `CAB Date` wandered **18 Oct 2026 → 16 Oct 2026 → 18 Oct 2023 → 18 Nov 2023**. No UAT row. No Release row.

**History:** 39 generic apply titles. Not in the V2 extract prompt. Reload matched at CK1/10/25/50/75/100.

This is a thin, date-corrupted board with a usable people list — not a trustworthy 100-capture project.

---

## Token/cost growth

**LIVE-PROVEN** OpenAI `usage`.

| | 1–20 | 81–100 | Ratio |
| --- | ---: | ---: | ---: |
| Extract prompt chars | 4542 | 5332 | **1.17×** |
| tiktoken input | 1051 | 1393 | **1.33×** |
| projectBlock chars | 570 | 1329 | **2.33×** |
| current objects | 9.25 | 22.75 | **2.46×** |
| History events | 6.95 | 36.3 | **5.22×** |

Provider extract: input median 1302 / max 1535; output median 314 / max 1112; total mean **1619**.

Ask context 1691 → 2939 chars (**1.74×**).

History is still out of the V2 extract prompt. Growth is modest on a **thin** board. If receipts were fixed and todos/milestones actually accumulated, this curve would need another look. It is not a 2000-capture proof. It is also not the #108 5× title-bloat disaster.

---

## Remaining P0

**Ready→Apply receipt identity.** Receipts keyed by recycled live observation ids (`v2-obs-1`, …) cause Ready creates to no-op as “already applied.” 39/77 Ready items. C11 dropped UAT and Release. The #113 claim “Ready means Apply can execute the reviewed semantic item” is **not** live-true.

This is a product contract bug, not model quality.

---

## Remaining P1

**A = 6** wrong current-truth writes, including C71/C82 writing **2023** ISO dates onto the only milestone. Release bar: A must be 0.

The year errors are model-proposed complete dates that Apply correctly executed. That is Ready→Apply working — and current truth being wrong.

---

## Remaining P2

- Liam / Sarah Okonkwo / Marcus never created (`update_existing` → Needs You). Safe; missed automation.
- E without write (73, 76, 77): model still marks restatements `current`.
- G = 12 domain mismatches (oracle todo extracted as knowledge/person). Product/oracle, not unsafe truth.
- Ask uses the CAB row as `related_context` for “release date.”
- Why-moved invents causal stories.
- New Project seed to-do still present.
- Titles mostly concise when they land (`Login error handling`, `CAB Date`) — #113 identity mapping works when Apply actually writes.
- One dump to-do title at C100.

---

## Recommendation

**ONE P0/P1 BLOCKER REMAINS**

Not `READY FOR v0.9 RELEASE CANDIDATE` — Ready→Apply is still systematically dishonest, and A is not zero.

Not `MODEL BEHAVIOUR BELOW ACCEPTABLE 75/25 BAR` — extract quality is acceptable (D=1, names present, 63 correct, 17 safe C, B=0). Do not chase perfect model behaviour.

Not `STRUCTURAL PROBLEM REAPPEARED` as a wholesale return of the #112 empty-people / missing-field architecture. Those shared contracts held. The leftover structure is **receipt keying**.

**Production changes from this PR: NONE.**

**Do not merge** #108, #110, #111, #112, #113, or #114.

---

## vs #112 (same scenario, live OpenAI)

| | #112 on #110 | this run on #113 |
| --- | --- | --- |
| People at 100 | 0 | **9** (incl. Priya, Sarah Kim) |
| Ready non-effects | 37 (kind unknown) | 39, all receipt `no_change` |
| A / B | 5 / 1 | **6 / 0** |
| D | 14 | **1** |
| Ask release `direct_confirmation` from prose | yes (C100) | **no** (`related_context` / `not_found`) |
| Analyse `repeat-release` wouldMutate | yes | **no** |
| CAB date | 18 Oct 2026 (label dump) | label `CAB Date`, year **corrupted to 2023** |

#113 moved the failure from “cannot create people / Ready lacks fields” to “Ready is blocked by receipts, and stale complete dates still write.”

---

## Artefacts

`longhaul-100-live/` from CI artefact `v09-live-100-evidence` on run `33323265425`, including `ready-apply.json`, `semantic-fields.json`, `live-observations.json`, `checkpoints.json`, `truth-final.json`, `token-growth.json`.
