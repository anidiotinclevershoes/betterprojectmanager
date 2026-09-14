# AI-first Capture Gate 2 — final architecture audition

Non-mergeable experiment. Stopped for human architectural decision.  
Do not merge. Do not start Gate 3. Do not modify Simplification, Current, or bake-off results.

## Preflight

```text
Working branch: experiment/ai-first-capture-gate2
Gate 1 accepted base: 707b704bbf820fcc4492c86155889d6afe5d5bae
Simplification pin: bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0
Current pin: 920d65d9c0f6e49efca8e26fc8906dbbd11e8f25
origin/main: 920d65d9c0f6e49efca8e26fc8906dbbd11e8f25
Contains current main?: NO (intentional isolation)
Frozen corpus SHA: 925b3395268d56482b1ce8e0f6fde82a1c4a87f473432fcb73919f809a66cd14
Branch classification: EXPERIMENT
```

Pins verified as commits. Worktrees `/tmp/lume-bakeoff/{current,simplification,ai-first,bakeoff}` were not modified. Production Capture routes were not modified.

---

## A. Experiment branch + HEAD

`experiment/ai-first-capture-gate2`  
HEAD is the commit that lands this report (see git). Base of this line is Gate 1 v2 `707b704`.

## B. Gate 1 base SHA

`707b704bbf820fcc4492c86155889d6afe5d5bae`

## C. Simplification comparison SHA

`bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0` (`integration/capture-simplification-v1`)

## D. Exact Astra model / config

- Model: `gpt-6-astra` (requested and returned; no silent substitution)
- Calls per Capture: **one**
- `response_format`: `json_schema` `ai_first_capture_gate1_v2` (Gate 1 contract unchanged)
- No temperature override (Astra rejects `0.2`; provider default)
- No retry, no second verification call, no fallback model
- After the call: mechanical `inspectEnvelope` + Gate 2 `materialiseGate2` → existing `planCaptureApply`

Live Stage 1: 59/59 `gpt-6-astra` / `gpt-6-astra`.  
Live Stage 2: 60/60 `gpt-6-astra` / `gpt-6-astra`.

## E. Gate 2 materialisation architecture

```
raw Capture + compact canonical snapshot
        → one Astra interpretation (Gate 1 envelope)
        → inspectEnvelope (schema / enum / keep unknown ids)
        → materialiseGate2 (this audition)
              typed ID existence + type check
              applySupportsOperation (no capability expansion)
              map explicit fields onto PendingSuggestion
              planCaptureApply
              adopt write | needs_you | no_change
              reject planner write to a different id than Astra named
        → experiment-only optional in-memory Apply
```

The materialiser does **not** parse English, infer IDs from titles, fuzzy-match, retry the model, or rewrite unsupported ops into nearby supported ones (todo `update`+`status=done` is **not** mapped to `complete`).

Previous `src/lib/experiments/ai-first-capture-gate2/legal-boundary.ts` is unchanged historical code (consulted the planner, did not adopt Needs You / rewritten writes). This audition lives under `experiments/ai-first-capture-gate2/`.

## F. Production code modified?

**NO.** Experiment files only. No production Capture wiring. No Simplification / Current / bake-off edits.

## G. New experimental LOC

| Piece | LOC |
| --- | --- |
| `materialise.ts` (thin boundary) | 428 |
| `worktree-runner.ts` | 218 |
| Harness (`run.ts` + `compare.ts` + copied `score.ts`/`types.ts`) | 821 |
| Historical Gate 1 interpreter + inspect + contract (already on the SHA) | 376 |
| Historical `legal-boundary.ts` (not used by this audition) | 214 |

Semantic/materialisation layer for the decision: **428 LOC**, **8** documented special-case rules, all mapping/safety — not a resolver.

---

## H. Full 59-case comparison (Stage 1)

Primary paired test of the **boundary**: replay frozen Gate 1 envelopes (same Astra JSON, no retune).  
Live column is one new `gpt-6-astra` call plus the same boundary.

| Metric | Simplification + 4o-mini | AI-first Gate 2 replay | AI-first Gate 2 live | Current + 4o-mini | AI-first Gate 1 |
| --- | --- | --- | --- | --- | --- |
| recall | 67/70 (95.7%) | 69/70 (98.6%) | 69/70 (98.6%) | 69/70 (98.6%) | 69/70 (98.6%) |
| false facts | 3/70 (4.3%) | 3/70 (4.3%) | 2/70 (2.9%) | 5/70 (7.1%) | 7/70 (10.0%) |
| unsafe executable proposals | 3/70 (4.3%) | 4/70 (5.7%) | 3/70 (4.3%) | 5/70 (7.1%) | 10/70 (14.3%) |
| wrong identity | 0/70 | 1/70 | 1/70 | 0/70 | 3/70 |
| silent omissions | 3/70 | 0/70 | 0/70 | 1/70 | 0/70 |
| evidence grounding | 63/65 (96.9%) | 69/69 (100%) | 69/69 (100%) | 66/68 (97.1%) | 69/69 (100%) |
| ambiguity safety | 18/22 (81.8%) | 20/22 (90.9%) | 21/22 (95.5%) | 18/22 (81.8%) | 20/22 (90.9%) |
| clear-input automation | 27/36 (75.0%) | 29/36 (80.6%) | 28/36 (77.8%) | 31/36 (86.1%) | 33/36 (91.7%) |
| Needs You items | 24 | 24 | 26 | 22 | 17 |
| Left untouched items | 24 | 18 | 19 | 24 | 12 |
| unnecessary intervention | 9 | 8 | 9 | 7 | 2 |
| extra unmatched writes | 2 | 3 | 2 | 3 | 5 |
| median latency ms | 1925 | 5968 (Astra, copied) | 6592 | 1884 | 5968 |
| prompt / completion tokens | 67335 / 10828 | 51404 / 14475 | 51404 / 14365 | 67335 / 10969 | 51404 / 14475 |

Scorer caveat (frozen, not retuned): some eval-corpus rows default `expectedDisposition` to Needs You / Left untouched. `mixed-domains` parade-date and fountain-risk writes are **fixture-intent correct** and count as mechanical unsafe for every contender that writes them.

## I. Repeated-live comparison (Stage 2, 20 × 3)

| Metric | Simplification | AI-first Gate 2 live | AI-first Gate 1 |
| --- | --- | --- | --- |
| recall | 87/87 | 87/87 | 87/87 |
| unsafe writes | 6/87 (6.9%) | 9/87 (10.3%) | 12/87 (13.8%) |
| wrong identity | 0 | 3 (all `c5-timber-floor` × 3; see L) | 3 |
| unnecessary intervention | 20 | 14 | 3 |
| clear automation | 31/51 (60.8%) | 37/51 (72.5%) | 48/51 (94.1%) |
| extra writes | 1 | 6 | 10 |
| judgement-identical repeats | 16/20 | 18/20 | 19/20 |
| median latency ms | 1824 | 7028 | 7247 |

Gate 2 Stage 2 remaining mechanical unsafe: `mixed-domains` parade+fountain × 3 (scorer default) and `c5-timber-floor` asbestos-close × 3 (token collision with knowledge create). Extra writes: H6 contractor-lead responsibility × 3; Jordan Hale lighting-lead responsibility × 3.

Simplification Stage 2 unsafe is `mixed-domains` parade × 3 **plus** `contradict-parade` date write × 3 (a real false fact Gate 2 still avoids).

## J. Optional Apply proof

Run: replay of frozen Gate 1 envelopes → Gate 2 → existing `planCaptureApply` → `applyCaptureOperationInMemory` on disposable worlds. **Not deployed. No production routes.**

| Case | Proposed writes | Executed | Authoritative reread |
| --- | --- | --- | --- |
| `todo-create` | 1 | 1 | new To Do “Polish the candy-cane banners…” |
| `todo-dated-canes` | 1 | 1 | new To Do “Collect the candy canes” |
| `two-token-person-create` | 2 | 2 | Jordan Hale person **and** extra lighting-lead responsibility |
| `explicit-ownership-first` | 1 | 1 | Sarah Kim person; responsibility stayed Needs You |
| `mixed-domains` | 2 | 2 | Parade day → 22 Oct; fountain-pump risk created |
| `noisy-conversational` | 2 | 2 | sprinkles To Do; Gumdrop Bridge → resolved |
| `holdout-h6` | 4 | 4 | workshop date, Kwame person, void-keys To Do, extra contractor-lead responsibility |
| `share-vs-replace-ambiguous` | 0 | 0 | no write |
| `foreign-invented-id` | 0 | 0 | no write |
| `risk-resolution` | 0 | 0 | Needs You (planner: risk update not specific — `status=resolved` is not `complete`) |
| `toyworld-vocabulary-bait` | 1 | 1 | **created** “Toyworld's packaging delay” on Candyland |
| `mixed-clear-and-unclear` | 1 | 1 | sprinkles To Do; worry left untouched |

The pipeline is real: accepted proposals write; ambiguity / invented IDs / unsupported removes do not. Residual bad Gate 1 creates that the thin boundary cannot see (Toyworld copy, extra responsibilities) **do** land if Apply is connected.

## K. False executable proposals

Replay: 4/70. Live: 3/70. Simplification: 3/70.

Qualitative remaining after Gate 2:

- Replay `toyworld-vocabulary-bait`: planner-accepted `create_risk`. Live Astra independently chose `needs_you` (variance, not the boundary).
- `mixed-domains` parade + fountain: scorer-default “unsafe”; product-intent they are ordinary writes.
- `c5-timber-floor` asbestos-close: knowledge **create** matched tokens `["asbestos"]` before the todo; todo complete was planner-blocked.

Gate 2 **removed** Gate 1’s unsupported milestone/person/risk **remove** writes and the Pippa rename update.

## L. Wrong identity

Gate 1 Stage 1: 3 (`availability` omitted id, `similar-name-other-brick` Brick Willow, `c5` asbestos).

Gate 2:

- `availability`: planner `write_availability` bound `person-fizz` — mechanical wrong-id **gone**.
- `similar-name-other-brick`: planner Needs You — write **gone**.
- `c5-timber-floor`: still 1 mechanical wrong-id because knowledge create (omitted id) is the first token hit for `asbestos-close` (`targetId=todo-asbestos`). Not a write to a different existing row. Todo complete was **not** executed.

Typed unknown-id / wrong-type intercepts fired as designed. No fuzzy rescue. No replacement create for a failed reference.

**Effectively:** Gate 1’s real wrong-target writes are gone. One frozen-scorer leftover remains. Simplification stays at 0/70.

## M. Silent omissions

Gate 2: **0**. Simplification: 3 (`similar-name-exact`, `similar-name-spelling`, `wrong-type-id` token miss). Advantage retained.

## N. Fact recall

69/70 vs Simplification 67/70. Same as Gate 1. Not a large delta.

## O. Clear automation

Gate 1 91.7% → Gate 2 replay 80.6% / live 77.8% vs Simplification 75.0%.

The safety boundary ate most of the Gate 1 automation lead. Over-blocks on ordinary clears:

- `new-person` (Velvet Sprocket / paint lead) → planner “looks like an ownership change”
- `todo-complete-jelly` / C5 close-chase → todo `update` is not `complete` in the legal matrix; mapping that would be converting to a nearby op (forbidden)
- `risk-resolution` → same (`status=resolved` not adopted as complete)
- `existing-risk-update` → “not specific enough”
- `existing-person` continue-UAT → TARGET_MISMATCH (`confirm_responsibility` id ≠ `resp-uat`)

## P. Needs You / Left untouched

Live Stage 1: Needs You 26, Left untouched 19 vs Simplification 24 / 24. Burden similar, slightly more Needs You.

## Q. Unnecessary intervention

Gate 1: 2. Gate 2 live: **9**. Simplification: **9**.  
The Gate 1 “low human burden” advantage **does not survive** fail-closed materialisation.

## R. Stability

Stage 2 judgement-identical: Gate 2 18/20, Gate 1 19/20, Simplification 16/20.  
Still more stable than Simplification. Slightly worse than Gate 1 (`explicit-ownership-first`, `two-token-person-create` item-shape drift). Boundary is deterministic given the envelope; remaining variance is Astra.

## S. Latency / cost

Astra median ~6.6s Stage 1 live (3.7–20.5s). Simplification 4o-mini ~1.9s.  
Tokens: ~51k prompt / ~14k completion Stage 1 (compact snapshot). No frozen public price for `gpt-6-astra`. 4o-mini Stage 1 was ~$0.017 on list price in the bake-off.

## T. Special-case count

**8** (listed in `materialise.ts` / comparison.md). No English recovery, no regex, no embeddings, no second AI pass.

---

## U. Examples where Gate 2 blocked bad Gate 1 output

- `unsupported-remove` / `-person` / `-risk`: remove → Left untouched (`applySupportsOperation`)
- `person-rename-unsupported`: person update → Left untouched (person update is not in the matrix)
- `similar-name-other-brick`: Brick Willow responsibility create → Needs You (planner unsupported / identity)
- `availability`: omitted-id create → planner-bound `person-fizz` (or would Needs You if unbound)
- `foreign-invented-id`: stayed Needs You; Apply wrote nothing
- `share-vs-replace-ambiguous`: stayed Needs You; Apply wrote nothing

## V. Examples where Gate 2 unnecessarily blocked good Gate 1 output

- `new-person`: clear Velvet Sprocket create → Needs You
- `todo-complete-jelly`: proven `todo-pack` + explicit “mark done” → Needs You
- `risk-resolution`: proven `risk-bridge` + explicit closed → Needs You
- `existing-risk-update`: packaging delay worse → Needs You
- `existing-person`: continue UAT on `resp-uat` → Left untouched (target mismatch vs confirm_responsibility item id)
- C5 close-chase: proven `todo-asbestos` → Needs You

Fixing these without a resolver means operation-specific DTO exceptions (`update`+`done`→`complete`, strip role from person create). That is the automatic-fail “exception proliferation” path. Not taken.

## W. Cases where Simplification clearly wins

- Toyworld vocabulary bait (replay / Apply): Simplification no write; Gate 2 **creates** the copied risk when Astra proposes create
- Cross-project Pixel Ramos create still lands as an extra write
- Extra sibling responsibilities (H6 contractor lead, Jordan lighting lead) still Apply
- Ordinary complete/resolve Capture (`todo-complete-jelly`, `risk-resolution`, C5 close-chase)
- Clear `new-person`
- Wrong-identity mechanical score 0 vs 1
- 4o-mini latency / known cost
- Already a production-shaped pin with −516 recovery LOC vs Current

## X. Cases where AI-first Gate 2 clearly wins

- Contradictory parade / relative-date parade: still fail-closed; Simplification still writes a date
- Evidence grounding 100% vs ~97%
- Ambiguity safety higher (Harbourline Sarah, competing launch, share-vs-replace, pronoun)
- Silent omissions 0 vs 3
- Messy H6 / noisy conversational recall without Simplification’s withheld timber/fountain caution (double-edged)
- Unsupported deletes no longer proposed as executable
- Stability still better than Simplification on the 20×3 subset

## Y. Evidence-based final recommendation

Gate 2 **did** what it was asked: a thin deterministic proof/materialisation layer over existing `planCaptureApply`, with no new semantic resolver.

That layer:

1. Eliminated Gate 1’s unsupported Remove / person-update writes.
2. Eliminated Gate 1’s real wrong-target writes.
3. Connected interpretation to the legal planner and in-memory Apply.
4. Did **not** restore Gate 1’s automation / low-intervention lead.
5. Cannot block Toyworld-copy / extra-responsibility creates without English or special-case tables.
6. Ties Simplification on live Stage 1 unsafe writes (3/70) and unnecessary intervention (9), and loses Stage 2 unsafe (9 vs 6) once extras and C5 scoring are included.

Win condition is asymmetric. Simplification is already a viable production candidate. A tie is not an AI-first win. “Promising, iterate the DTO map” is not an AI-first win: the leftover holes are either planner-impedance special cases or semantic bait that would rebuild recovery.

**Park the AI-first programme.** Promote Simplification as the production direction (still not merged by this experiment).

---

## Decision questions

1. Did the thin boundary eliminate AI-first’s wrong-identity problem?  
   **The real wrong-target writes, yes. Mechanical 1/70 leftover is a scorer collision, not a wrong-row write.**

2. Did it reduce unsafe executable proposals to Simplification-level safety?  
   **Live Stage 1: tied 3/70. Replay 4/70. Stage 2: worse (9 vs 6), largely extras + scorer. Toyworld still writes when Astra proposes create.**

3. Did AI-first retain its semantic recall advantage after fail-closed materialisation?  
   **Yes, 69/70 vs 67/70 — small, not material.**

4. Did it retain lower unnecessary human intervention?  
   **No. 9 vs Simplification 9 (Gate 1 was 2).**

5. Did it remain more stable across repeated runs?  
   **Yes vs Simplification (18/20 vs 16/20). Slightly worse than Gate 1 (19/20).**

6. How much new Gate 2 code was required?  
   **428 LOC materialiser + experiment harness. 8 mapping rules.**

7. Is that code genuinely thin mapping/safety, or are we rebuilding a resolver?  
   **Thin mapping/safety. Stopping here is the evidence.**

8. Does AI-first now clearly outperform Simplification as the best future Capture architecture?  
   **No.**

9. If AI-first does NOT clearly win, should the AI-first programme now be parked?  
   **Yes.**

10. If parked, is Simplification the recommended production direction?  
    **Yes.** (Port from current `main` when production work starts. This branch does not contain current `main` and must not be merged.)

---

SIMPLIFICATION WINS — PARK AI-FIRST
