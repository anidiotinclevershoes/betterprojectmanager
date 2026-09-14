# Simplification + Astra control report

Non-mergeable experiment. Did not modify `main`, Simplification integration, AI-first, or bake-off results. Frozen corpus and expected outcomes were not retuned.

**Branch:** `experiment/simplification-astra-control`  
**HEAD:** `28f940229adcefae3dcbd53a6b60a324ceccd3fb`  
**Safe to merge:** NO  
**Contains current main?:** YES (`920d65d`)

---

## Setup

| Item | Value |
| --- | --- |
| Architecture | Pinned Simplification `bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0` |
| Worktree | `/tmp/lume-bakeoff/simplification-astra` |
| Frozen corpus SHA | `925b3395268d56482b1ce8e0f6fde82a1c4a87f473432fcb73919f809a66cd14` (verified) |
| Prompt | Prompt A `capture-v2-eval-baseline-v2` (unchanged text) |
| Model | `gpt-6-astra` requested and returned on every live case (0 silent substitutions) |
| AI-first code | not imported |
| Bake-off results | read-only |

### Adapter (required, recorded)

Unmodified Prompt A extract (`temperature: 0.2`) **cannot** call Astra:

`Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.`

The experiment-only runner omitted `temperature` (same as accepted AI-first Astra calls) and kept `response_format: json_object` plus Prompt A messages. Recorded as `adapter: omit-temperature-for-gpt-6-astra`. This is a request-field adapter, not a Prompt A rewrite. After that, the existing Simplification validate → resolve → leftover coverage → `planCaptureApply` spine ran without production modification.

---

## Four-column Stage 1 (59 cases, 70 facts)

| Metric | Current+4o-mini | Simplification+4o-mini | Simplification+Astra | AI-first+Astra |
| --- | --- | --- | --- | --- |
| material fact recall | 69/70 (98.6%) | 67/70 (95.7%) | 69/70 (98.6%) | 69/70 (98.6%) |
| false material facts | 5/70 (7.1%) | **3/70 (4.3%)** | 5/70 (7.1%) | 7/70 (10.0%) |
| false / unsafe writes | 5/70 (7.1%) | **3/70 (4.3%)** | 6/70 (8.6%) | 10/70 (14.3%) |
| wrong identity | **0** | **0** | 1/70 (1.4%) | 3/70 (4.3%) |
| silent omissions | 1 | 3 | **0** | **0** |
| evidence grounding | 97.1% | 96.9% | **100%** | **100%** |
| ambiguity safety | 81.8% | 81.8% | 86.4% | **90.9%** |
| clear-input automation | 86.1% | 75.0% | 63.9% | **91.7%** |
| justified intervention | 23 | 23 | 23 | 20 |
| unnecessary intervention | 7 | 9 | 14 | **2** |
| extra unmatched writes | 3 | 2 | 5 | 5 |
| median latency | 1.9s | 1.9s | 6.6s | 6.0s |
| prompt / completion tokens | 67.3k / 11.0k | 67.3k / 10.8k | 67.3k / 17.7k | 51.4k / 14.5k |

Primary comparison is the two Simplification columns. Architecture is identical; only the extract model (plus omitted temperature) changed.

Extract shape (Stage 1):

| | Simplification+4o-mini | Simplification+Astra |
| --- | --- | --- |
| observations emitted | 78 | 97 |
| `truthIntent=uncertain` | 17 | **8** |
| omit-like `candidateTargetId` | 3 | **0** |
| resolved writes proposed | 28 | 31 |
| `needs_you` items | 24 | 31 |
| `left_untouched` items | 24 | 27 |
| `no_change` items | 8 | 10 |

---

## Stage 2 (20 × 3)

| Metric | Current+4o-mini | Simplification+4o-mini | Simplification+Astra | AI-first+Astra |
| --- | --- | --- | --- | --- |
| false / unsafe writes | 9/87 | **6/87** | 9/87 | 12/87 |
| wrong identity | 0 | 0 | 3 | 3 |
| clear automation | 72.5% | 60.8% | 66.7% | **94.1%** |
| unnecessary intervention | 14 | 20 | 17 | **3** |
| unstable cases | 5 | 4 | 4 | **1** |
| median latency | 2.0s | 1.8s | 8.4s | 7.2s |

Simplification+Astra unstable: `ambiguous-same-first-name`, `correction-of-wording`, `pronoun-ambiguity`, `c5-timber-floor`. Count matches Simplification+4o-mini (4). It does **not** reproduce AI-first’s near-stability.

---

## Stage 3 in-memory Apply

Compatible with the existing Simplification write spine. Hosted Vercel was not used (different SHA). AI-first is not in Apply.

Executed when proposed:

- Recovered vs Simplification+4o-mini: mixed-domains fountain **create** (2 writes); mixed-clear sprinkles **create**
- H6: 3 writes (workshop + person + todo)
- todo/person creates: executed
- share-vs-replace, Toyworld bait, foreign-id: **0 writes**
- **Regressions vs both bake-off Apply pins:** `risk-resolution` **0 writes** (Astra split melted+closed into two sibling updates; Simplification Needs You both); `explicit-ownership-first` **ensure_person** for Sarah Kim as `create_new`

---

## Watch cases

| Case | Simplification+4o-mini | Simplification+Astra | Comment |
| --- | --- | --- | --- |
| C5 timber | asbestos update; timber **Needs You** | timber **create** recovered; extra knowledge update with omitted id (scored wrong-identity) plus todo-asbestos extra write | Good automation reopened a messy extra write |
| mixed fountain | withheld | **create** (same as Current) | Recovered; mechanical scorer still flags eval-corpus default |
| mixed sprinkles | Stage 1 create (Stage 3 4o-mini withheld) | create + Stage 3 apply | Recovered on Apply |
| Brick exact/spelling | silent omit | **Needs You** (not no_change) | Silent-loss fixed; still not Current/AI-first restatement |
| `responsibility-continues` | Needs You | Needs You | Extract said `no_change` + `ownershipSemantics=continue`; resolver still Needs You |
| `explicit-ownership-first` | Needs You, 0 writes | **create_new Sarah Kim** | Existing person not bound; bad create |
| contradict-packaging | Needs You | Needs You | Did **not** reopen Current’s unsafe write |
| correction-of-wording | audio-bus create | left_untouched / Needs You | Lost the clear create; Stage 2 unstable |
| title-only Parade | update `ms-parade` | update `ms-parade` | Same unique-title bind as both bake-off pins |
| relative-date / contradict-parade | 4o-mini wrote a date | Astra also **wrote** `ms-parade` | Did not inherit AI-first’s leave-unresolved behaviour |
| cross-project-bait | no write | **create Pixel Ramos** | New unsafe write |
| email-unsupported | no write | **create** | New unsafe write |
| risk-resolution Apply | wrote resolved | **0 writes** | Sibling-split vs conservative resolver |

---

## Answers

1. **Does Astra materially increase Simplification’s explicit-fact recall?** Yes, modestly: 67/70 → 69/70. Silent omissions 3 → 0.

2. **Does it recover the clear automation Simplification lost?** Only some of it, and not net. Fountain and C5 timber creates return. Clear-input automation **falls** 75.0% → 63.9%. Unnecessary intervention 9 → 14. `responsibility-continues` stays Needs You. Correction-of-wording **loses** the audio-bus create. Stage 3 risk-resolution Apply **fails** where 4o-mini succeeded.

3. **Does it reduce unnecessary Needs You?** **No.** Needs You items 24 → 31. Unnecessary intervention 9 → 14. Astra emits more observations (78 → 97); Simplification’s conservative resolver then asks more often.

4. **Does it reduce `truthIntent=uncertain` on otherwise explicit instructions?** **Yes.** 17 → 8. omit-like target ids 3 → 0. That does not translate into more safe automatic writes.

5. **Does it improve Person/responsibility extraction?** Mixed. Brick silent-loss becomes Needs You. `responsibility-continues` extract is a clean `no_change`/`continue` but the resolver still Needs You. Sarah Kim is extracted as **create_new** instead of the existing person.

6. **Does it preserve Simplification’s lower false-write rate?** **No.** 3/70 → 6/70, worse than Current (5/70). New unsafe writes: Pixel create, email create, C5 knowledge/wrong-id, Sarah Kim create. contradict-packaging safety **is** preserved.

7. **Does it introduce new wrong-identity behaviour?** **Yes.** Stage 1 1/70 (C5). Stage 2 3/87. Simplification+4o-mini had zero.

8. **Does it remain compatible with the existing deterministic safety/write spine?** **Yes**, after omitting temperature. Apply executed proposed writes without production changes. Compatibility is not the same as better outcomes: the spine **blocks** some Astra splits (risk-resolution) and **accepts** some Astra creates (Sarah Kim, Pixel).

9. **Is repeated-run stability materially better than Simplification+4o-mini?** **No.** 4 unstable cases vs 4. AI-first+Astra remains the stability outlier (1). Prompt A + Astra is not AI-first + Astra.

10. **Latency/cost penalty?** Median 1.9s → 6.6s (Stage 1), 8.4s Stage 2. Completion tokens ~1.6× Simplification+4o-mini (10.8k → 17.7k) plus reasoning tokens. No frozen public `gpt-6-astra` list price.

11. **Does Simplification+Astra outperform Current strongly enough that Current’s recovery machinery is clearly unnecessary?** **No.** Unsafe writes and wrong identity are worse than Current. Clear automation is worse than both Current and Simplification+4o-mini. Current’s extra recovery is not shown to be redundant by this swap.

12. **Does Simplification+Astra approach AI-first semantic quality while remaining safer because of the resolver/planner boundary?** Safer than AI-first on false writes (6 vs 10) and unsupported deletes (Astra-on-Prompt-A did not emit Gate 1 `remove` ops). It does **not** approach AI-first automation (63.9% vs 91.7%), unnecessary-intervention (14 vs 2), or stability. The resolver boundary also **prevents** some good Astra facts from becoming writes.

13. **Most promising combination on this evidence?** Unchanged from the three-way bake-off: **Simplification + 4o-mini** as the production-shaped candidate; **AI-first + Astra** as Gate 1 semantic winner needing Gate 2. **Simplification + Astra is not a promising production extract swap.** It shows that Simplification’s extra human burden is not mainly 4o-mini weakness. A stronger model under unchanged Prompt A produces a larger, more split envelope that the conservative resolver treats as more Needs You **and** sometimes as extra creates.

Hypothesis only (not implemented): Astra interpretation with a **different** contract (AI-first Gate 1 / a future Gate 2 legal matrix), not Prompt A + Astra.

---

**SIMPLIFICATION + ASTRA NOT WORTH PURSUING**
