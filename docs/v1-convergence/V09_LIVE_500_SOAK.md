# LUME v0.9 — LIVE 500 TWO-PROJECT DURABILITY REPORT

Hulk classification only. Production runtime unchanged. Do not merge this harness PR. Do not reopen v0.9 hardening for P2 / model-quality issues.

The v0.9 truth engine is **qualified and frozen** on main. This soak is long-run durability and project isolation, not a contract retest.

---

## Executive verdict

**DURABILITY PASS WITH P2 OBSERVATIONS**

Five hundred interleaved live Captures completed against two projects on disposable Supabase. Ready items wrote. Receipts did not collide. Reload matched in-memory state at every 25-capture checkpoint. Authoritative rows did not cross project ids. Ask never cited the other project.

The harness reported `silentFailures: 6` and `bleedEvents: 500`. Both counters are **false**. The six “silent” rows are status/close writes whose new Review wording does not substring-match the existing title. The 500 “bleed” rows are the other project’s own todos, flagged by an inverted `foreignRows()` check. Denoised: **A=0, B=0, C=0, D=0**.

---

## Recommendation

**V0.9 QUALIFIED — P2 LONG-RUN IMPROVEMENTS ONLY**

Ship remains **main @ `b448d51`**. Do not merge #118. Do not reopen shared-seam hardening. Later work (not a v0.9 blocker) can tighten extract recovery of kickoff people, year-less ISO dates, and duplicate-title extras under Review.

---

## Production candidate and run identity

| Item | Value |
| --- | --- |
| Production candidate | `main` @ `b448d51ad870ed0ce267a12bfaa7654da20c58c0` (merge of #116) |
| Harness branch | `cursor/v1-v09-live-500-soak-610b` @ `fd5b08d` |
| CI merge checkout SHA | `cb4a274e1d367ac080bdfb12c28bc23c3f332650` |
| Mode | live OpenAI extract + disposable local Supabase |
| Model | `gpt-4o-mini-2024-07-18` |
| Production unchanged | yes — no `src/` edits; no observation repair; no oracle envelopes; no fake workspace client |
| CI | [run 33341276219](https://github.com/anidiotinclevershoes/betterprojectmanager/actions/runs/33341276219) SUCCESS |
| Artifact | `v09-live-500-soak-evidence` (`9741068941`), copied to `longhaul-500-soak/` |
| Captures | 500/500, `stoppedAt: null` |
| Interleave | exactly 4:1, 100 times — TW, TW, TW, TW, TC |
| Elapsed | 2,017,677 ms (~33.6 min after Supabase start) |
| Persist user | `hulk-live-500-soak@example.test` |
| Toyworld id | `aaaaaaaa-aaaa-4aaa-8aaa-000000000010` |
| Toycity id | `aaaaaaaa-aaaa-4aaa-8aaa-000000000020` |

---

## Ready → Apply

| Board | Ready | Wrote | Legitimate no_change | Receipt replay | Thrown |
| --- | ---: | ---: | ---: | ---: | ---: |
| Toyworld (400 captures) | 80 | 80 | 0 | 0 | 0 |
| Toycity (100 captures) | 16 | 16 | 0 | 0 | 0 |
| **Total** | **96** | **96** | **0** | **0** | **0** |

Every Ready suggestion that reached Apply wrote. There is no Ready→disappear on the ledger. `uniqueOperationIds: 96` equals `ledgerWrote: 96`.

---

## Receipt identity

`obs-1` (and other observation ids) are reused across Captures. All 96 Apply operations received distinct system UUIDs. Receipt-replay (`already applied`) is **0**. The #114 / #115 collision (`v2-${obs.id}`) did not return across 500 live Captures.

---

## A — Silent durable-state

**0 real.** Harness listed 6. All six are matcher false positives on identity-preserving updates.

| C | Project | Review text | What actually persisted |
| --- | --- | --- | --- |
| 254 | Toyworld | Vendor delay on wallet sandbox | Worldpay risk `353b0d82` stayed; status **open → watch** by C275 |
| 320 | Toycity | Wifi risk is reducing. | Wifi risk `fc08f929` stayed; status **open → watch** by C325 |
| 329 | Toyworld | Search performance is acceptable on the tuned index. | Search risk `b77c8169` stayed; status **open → resolved** by C350 |
| 400 | Toycity | Colleague briefing is out. | Todo `fa44581b` stayed; **done=true** |
| 404 | Toyworld | Pen-test findings are closed. | Pen-test risk `ef6b3208` stayed; status **open → resolved** by C425 |
| 470 | Toycity | Hanna is happy to close the wifi risk. | Wifi risk `fc08f929` stayed; status **watch → resolved** by C475 |

The matcher requires the Review title to substring-match the durable title. Closure language (“are closed”, “is reducing”, “is out”) does not match the original RAID/todo wording, so the harness recorded a miss after a successful write. Checkpoint `ledgerMissing` is **0** at every 25-capture mark: no ledger entity id vanished later.

Silent Ready→disappear: **none**.

---

## B — Cross-project bleed

**0 real.** Harness listed 500. All 500 are the same inverted check.

`foreignRows()` walks every todo whose `projectId` is the *other* project and reports `todo <id> owned by other project`. That is correct ownership of the other board, not bleed. Unique detail strings: 25 growing prefixes of the same pattern. Zero events mention foreign sentinels, shared people, Ask sources, or a cross-project write target.

Real isolation checks (all zero):

| Check | Count |
| --- | ---: |
| Apply targeting the other project id | 0 |
| Shared person name on both boards | 0 |
| Foreign sentinel in Capture context / project block | 0 |
| Ask `sourceBleed` (source.projectId ≠ asked project) | 0 / 100 |
| Ask `answerBleed` (Priya/Worldpay/Manhattan/National DC ↔ Maya/Eagle Eye/Meadowhall) | 0 / 100 |
| Toyworld sentinels on the Toycity board | 0 |
| Toycity sentinels on the Toyworld board | 0 |

Final boards:

- Toyworld has Worldpay, National DC, 27 October / `2026-10-27`. It does not have Maya Chen, Eagle Eye, Meadowhall, or 21 September.
- Toycity has Eagle Eye, Meadowhall, Store Pilot `2023-09-21`. It does not have Priya, Worldpay, Manhattan, National DC, or 27 October.

Ask answers stayed inside the asked project. Toyworld launch answers cite 27 October 2026. Toycity answers cite Store Pilot / Meadowhall / wifi — never Worldpay or Priya.

---

## C — Identity / duplicate / split-brain

**0 system-id collisions.** 96 unique operation ids. Stable ids held across the soak:

| Object | Id | Life |
| --- | --- | --- |
| Worldpay sandbox risk | `353b0d82-…` | created early; open → watch at C254; still present at C500 |
| Search performance risk | `b77c8169-…` | created mid-run; open → resolved at C329; still present |
| Pen-test risk | `ef6b3208-…` | created mid-run; open → resolved at C404; still present |
| Target Launch | `e61d601c-…` | `2026-10-27` from C25 through C500 |
| CAB Date (first) | `39950bf5-…` | `2026-10-18` from C25 through C500 |
| UAT Start (first) | `37033f1f-…` | date moved on the **same** id (14 Oct 2026 → 16 Oct → 14 Oct) |
| National DC drop | `cfd3bfa0-…` | 8 Sep → 12 Sep on the same id |
| Store Pilot | `7c0049a2-…` | 14 Sep 2026 → 21 Sep on the same id |
| Meadowhall wifi | `fc08f929-…` | open → watch → resolved on the same id |

Review-gated **extra** rows with the same *label* and new ids are model extras, not split-brain of one system object:

- Toyworld todos: “Notify Amira about the rollback page” ×4; “National DC is the warehouse thread” ×3; “Member communications preparation” ×2
- Toyworld milestones: “UAT Start” ×3; “CAB Date” ×2 (second copies appear late, C300 and C500)
- Toyworld knowledge: “National DC is the warehouse thread.” ×11

These are accepted v0.9 P2 / model-quality extras under Review. They are not receipt reuse and not one id pointing at two facts.

---

## D — Reload / persistence

**0 mismatches.** Twenty checkpoints (C25…C500). Every checkpoint `reloadOk: true`. `reload-mismatches.json` is `[]`. In-memory snap after Apply equalled `backend.load()` for both projects.

History counts grew only by writes: Toyworld 17 → 81; Toycity 2 → 17. No wipe, no swap, no silent truncation.

---

## E — Needs You

Safe. Not a durability failure.

| | Captures with ≥1 Needs You | Needs You rows |
| --- | ---: | ---: |
| Toyworld | 170 | 209 |
| Toycity | 90 | 96 |
| **Total** | **260** | **305** |

Dominant reasons (rows):

| Reason | n |
| --- | ---: |
| Person identity is not established / supplied record id is not enough | 113 |
| Cannot tell which person this refers to | 63 |
| This person is not on this project | 36 |
| Unclear whether this should change current truth | 30 |
| Name is not a confirmed existing Person identity | 30 |
| To-do update not specific enough | 22 |

This is the same conservative person-identity gate seen on the live 100 (#117). Kickoff leads that never became stakeholders (Priya, Liam, Jordan, Maya, Owen, …) caused later mentions to Needs You rather than invent a person. That is success under the v0.9 safety standard.

---

## F — Extract misses

Present. Not a durability failure.

Named people who were spoken and never became a stakeholder row:

- Toyworld: Priya Shah (delivery lead), Liam Brooks (sponsor), Jordan Hale (test lead)
- Toycity: Maya Chen, Owen Blake, Rita Kapoor, Felix Nguyen, Hanna Okafor — **zero people** on the final Toycity board

Toyworld did persist Dev Patel, Amira Rahman, Nadia Qureshi, Tomiko Sato, Chris Bell, Sarah Kim.

Manhattan Associates never appears as durable text. Worldpay, National DC, Eagle Eye, and Meadowhall did land.

Same class as #117 (Priya / Liam never recovered after the safe refusal). Do not reopen hardening for this.

---

## G — Review-visible model errors

Present. Not a durability failure. Apply saved what Review showed.

Year-less spoken dates became `2023-*` on several rows:

- Extra milestone “27 October” at `2023-10-27` beside correct Target Launch `2026-10-27`
- National DC interface drop first stored as `2023-09-08`, then updated to `2023-09-12` (day move is correct; year is wrong)
- Extra “12 September” milestone at `2023-09-12`
- UAT Start id `37033f1f` moved from `2026-10-14` → `2023-10-16` → `2023-10-14`
- Store Pilot id `7c0049a2` moved from `2026-09-14` → `2023-09-21` (day move 14→21 is the intended slip; year flip is the model error)
- Sarah Kim availability stored as `2023-10-27`

Late restatements also created extra UAT Start (`2023-10-23`, then another `2026-10-14`) and a second CAB Date (`2026-10-18`). Review-gated extras, same family as #117 C45 / C64 / C71.

---

## H — Wording

Present. Not a durability failure.

Examples: todo titles that quote the instruction (“Add a to-do for Meadowhall till overlay”, “National DC is the warehouse thread”) rather than a clean action name; knowledge bullets that repeat the same warehouse sentence. The durable fact is still on the correct project.

---

## Ask isolation and confidence

100 Ask turns (5 questions × 2 projects × 10 checkpoints).

| Confidence | n |
| --- | ---: |
| `related_context` | 58 |
| `not_found` | 41 |
| `direct_confirmation` | 1 |

- **No** knowledge/history → `direct_confirmation` of a current date, owner, or risk. The single `direct_confirmation` (C450 Toycity, “What has changed recently?”) says there have been no recent changes — not a current-date claim.
- Current release date on Toyworld stayed `related_context` and answered **2026-10-27** at C50, C100, C150, C200, C250, C300, C350, C400, C450, C500.
- Toycity release answers followed the Store Pilot row: 14 September 2026 while that date was stored, then 21 September 2023 after the Review-visible year flip. C200 and C300 answered `not_found` despite the milestone existing — Ask miss, P2.
- “Who's involved in UAT?” is `not_found` on both boards (no UAT owners persisted). Correct under missing people.
- “What has changed recently?” is almost always `not_found`. Conservative, not bleed.

Context size grew with the board (Toyworld Ask ~4.4k → ~8.9k chars; Toycity ~1.5k → ~4.9k). No foreign sources entered the bundle.

---

## Token / cost growth

Extract prompt tokens grew with Toyworld board size and stayed flat on the smaller Toycity board. No runaway, no late-run collapse.

| Capture | Project | Provider in | Provider out | Request chars | Project block | Objects (P/T/R/M/K) |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Toyworld | 967 | 421 | 4330 | 269 | 0/1/0/0/2 |
| 49 | Toyworld | 1588 | 458 | 5822 | 1802 | 6/5/4/4/12 |
| 99 | Toyworld | 1809 | 402 | 6313 | 2333 | 6/9/5/5/14 |
| 199 | Toyworld | 2004 | 335 | 6841 | 2820 | 6/13/5/6/20 |
| 299 | Toyworld | 2121 | 182 | 7070 | 3067 | 6/15/5/7/27 |
| 399 | Toyworld | 2296 | 454 | 7566 | 3545 | 6/20/5/7/30 |
| 499 | Toyworld | 2525 | 437 | 8161 | 4086 | 6/24/5/9/30 |
| 50 | Toycity | 1035 | 395 | 4450 | 446 | 0/2/0/1/2 |
| 100 | Toycity | 1075 | 331 | 4553 | 549 | 0/2/1/1/6 |
| 200 | Toycity | 1116 | 371 | 4657 | 653 | 0/3/1/1/7 |
| 300 | Toycity | 1116 | 348 | 4657 | 653 | 0/3/1/1/8 |
| 400 | Toycity | 1106 | 392 | 4624 | 653 | 0/3/1/1/10 |
| 500 | Toycity | 1119 | 298 | 4695 | 653 | 0/3/1/1/11 |

Toyworld provider input **2.61×** from C1→C499 (967→2525). Output tokens stayed ~400. Quartile averages 1611 / 1965 / 2118 / 2364. Toycity provider input sat at ~1116 after C100.

Late Captures still produced Ready writes (C404, C470, C499 still extracting). No systemic later-capture degradation of the Apply path.

---

## Longitudinal examples

Intended life-cycles vs durable truth. Day moves that kept identity are durability passes. Wrong years and missing people are G/F.

### Toyworld launch — 27 October 2026

Spoken from C9 and restated through C400. Target Launch `e61d601c` is `2026-10-27` at C25 and still `2026-10-27` at C500. Ask agrees at every 50-capture mark. Extra “27 October” milestone at `2023-10-27` is Review-gated G.

### Toyworld warehouse — 8 September → 12 September

National DC drop `cfd3bfa0` is `2023-09-08` at C50 and `2023-09-12` at C100–C500. Same id. Year is wrong; the 8→12 slip is the intended move.

### Toyworld UAT — 14 October → 16 October → 14 October

Same id `37033f1f` moved 2026-10-14 → 2023-10-16 → 2023-10-14. Identity-preserving updates. Extra UAT rows later (G).

### Toyworld Worldpay

Created as open risk. C254 “keep it on watch, don't close yet” moved the **same** row to `watch`. Still `watch` at C500. Not closed, not lost, not copied onto Toycity.

### Toyworld search / pen-test

Both closed on their original ids (C329 / C404). Still present and `resolved` at C500.

### Toycity pilot — 14 September → 21 September

Store Pilot `7c0049a2` is `2026-09-14` through C175, then `2023-09-21` from C200 through C500. Same id. Day slip is intended (TC beat 36 / global ~C180). Year flip is G. No second Store Pilot row.

### Toycity wifi

One risk id from first write (~C60) through close (C470): open → watch → resolved. Ask at C500 reports the wifi risk resolved.

### Cutover runbook / colleague briefing

Spoken close became `done=true` on the existing todo ids. Not deleted.

---

## Final project coherence

### Toyworld @ C500

6 people, 24 todos, 5 risks, 9 milestones, 30 knowledge, 81 history.

People: Dev Patel, Amira Rahman, Nadia Qureshi, Tomiko Sato, Chris Bell, Sarah Kim.

Risks: login error (open), API timeout (open), Worldpay sandbox (watch), search (resolved), pen-test (resolved).

Authoritative launch row is still 27 October 2026. Board is a Toyworld ecommerce/customer-platform RAID, not a store-ops board.

### Toycity @ C500

0 people, 3 todos, 1 risk (wifi resolved), 1 milestone (Store Pilot), 11 knowledge, 17 history.

Knowledge includes Eagle Eye, Meadowhall, till overlay, colleague briefing. No Toyworld people, payments, or warehouse.

The two boards are smaller and less named than the spoken programmes (F). They are **not** mixed.

---

## Harness noise (do not treat raw counters as verdict)

| Raw counter | Denoised | Cause |
| --- | --- | --- |
| `silentFailures: 6` | **0** | Title matcher misses status/close writes |
| `bleedEvents: 500` | **0** | `foreignRows()` flags the other board’s own todos |
| `reloadMismatches: 0` | **0** | True |
| `receiptReplay: 0` | **0** | True |

Classification detail: `longhaul-500-soak/classification.json`.

---

## Remaining P0

**NONE**

---

## Remaining P1

**NONE**

---

## Remaining P2 (long-run / model quality — not v0.9 blockers)

1. Kickoff people still fail safe and never recover (Priya, Liam, Jordan, entire Toycity roster).
2. Year-less dates still become `2023-*` on Review cards; Apply stores them.
3. Restatements spawn extra todos / milestones / knowledge with the same label and a new id.
4. Ask is conservative (`related_context` / `not_found`) and occasionally misses a stored milestone date.
5. Extract prompt tokens grow with board size (~2.6× / 400 Toyworld Captures). Linear, not runaway; watch on longer soaks.
6. Soak harness `foreignRows` / silent-title matchers are too loud for a future 500. Fix the harness, not production.

---

## What this soak is not

- Not a reason to reopen #116 seams.
- Not a reason to retune extract or Needs You.
- Not a merge to main.
- Not a failure because Needs You was common, Priya is missing, or a Review card showed 2023.

---

## Evidence

`longhaul-500-soak/` — `run-summary.json`, `ledger.json`, `silent-failures.json`, `bleed-events.json`, `reload-mismatches.json`, `checkpoints.json`, `checkpoints/state-*.json`, `ask.json`, `calls.json`, `token-growth.json`, `final-state.json`, `needs-you.json`, `scenario.json`, `classification.json`.
