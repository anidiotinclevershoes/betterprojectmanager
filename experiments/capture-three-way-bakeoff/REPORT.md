# Capture three-way bake-off report

Non-mergeable experiment. Contenders were not modified. Expected outcomes were frozen before live runs. Normalization copied present fields only.

**Branch:** `experiment/capture-three-way-bakeoff`  
**HEAD after results:** recorded in the results commit on this branch  
**Safe to merge:** NO  
**Contains current main?:** YES (`920d65d`). Not mergeable: experiment-only evaluation infrastructure.

---

## A. Experiment branch + HEAD

- branch: `experiment/capture-three-way-bakeoff`
- created from `origin/main` `920d65d9c0f6e49efca8e26fc8906dbbd11e8f25`
- contains current `main`?: YES
- classification: `LUME_EXPERIMENT=1` / `experiment/` — do not merge

Worktrees (unmodified pinned checkouts):

- `/tmp/lume-bakeoff/current` @ `920d65d`
- `/tmp/lume-bakeoff/simplification` @ `bd76bbf`
- `/tmp/lume-bakeoff/ai-first` @ `707b704`

## B. Pinned contender SHAs

| Contender | SHA | Notes |
| --- | --- | --- |
| Current | `920d65d9c0f6e49efca8e26fc8906dbbd11e8f25` | Equals `origin/main` at freeze. Pre-simplification production baseline. |
| Simplification | `bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0` | `integration/capture-simplification-v1`. Contains current main plus rescue-removal. Not on `main`. |
| AI-first | `707b704bbf820fcc4492c86155889d6afe5d5bae` | Gate 1 v2 accepted comparison candidate. |

### AI-first candidate selection (not recency)

| SHA | Branch | What changed | Existing verdict |
| --- | --- | --- | --- |
| `56d9148` | `experiment/ai-first-capture-gate1` | Five-case Astra spike | **PROMISING**. Stop for human review. Gate 2 not started. |
| `707b704` | `experiment/ai-first-capture-gate1-v2` | Twelve-case Astra vs production; rematerialise/hydrate bypassed | **AI-FIRST PROMISING WITH CONDITIONS**. Do not proceed automatically to Gate 2. |

`707b704` is the accepted Gate 1 comparison candidate because `experiment/ai-first-capture-gate2` PREFLIGHT explicitly names it as the Gate 1 v2 base. This bake-off used **Gate 1 architecture only** (raw Capture + dumb snapshot + one Astra call). Gate 2’s legal-write boundary was not applied.

## C. Exact model / config

| Contender | Requested | Returned on every Stage 1 case | Silent substitution |
| --- | --- | --- | --- |
| Current | `gpt-4o-mini-2024-07-18` | `gpt-4o-mini-2024-07-18` | none |
| Simplification | `gpt-4o-mini-2024-07-18` | `gpt-4o-mini-2024-07-18` | none |
| AI-first | `gpt-6-astra` | `gpt-6-astra` | none |

Current and Simplification share Prompt A (`capture-v2-eval-baseline-v2`) and the same extract path. Differences are the deterministic resolve/recovery layer.

No model-normalized control was run. The existing harness cannot swap models without changing contender config.

## D. Frozen corpus

59 cases. SHA-256 `925b3395268d56482b1ce8e0f6fde82a1c4a87f473432fcb73919f809a66cd14`. Frozen before any three-way live run.

| Category | N |
| --- | --- |
| clear_ordinary | 15 |
| identity | 14 |
| unsupported_unplaceable | 8 |
| no_change_restatement | 7 |
| messy_realistic | 6 |
| uncertainty | 5 |
| historical_failure (category) | 4 |

Additional cases carry `historical: true` inside other categories (H6, C5, title-bind, Harbourline, foreign-id, pronoun).

Expected-outcome sources: eval-corpus 21, gate2-fixture 19, manual-for-experiment 8, simplification-observe 5, harbourline-stress 2, gate1-v2-fixture 2, holdout 1, longhaul-regression 1.

Stage 2: 20 representative cases × 3 live repeats (filter included extras flagged `stage2` as well as the 18-id list).  
Stage 3: 12 Current vs Simplification Apply cases on disposable in-memory worlds.

### Scorer note (not a retune)

Some eval-corpus materials omit `expectedDisposition`. The freeze mapper defaulted those to `needs_you` / `left_untouched`. That over-penalizes correct ordinary writes (notably mixed-domains parade + fountain). Frozen expectations were **not** edited after seeing outputs. Tables below are mechanical. Qualitative comments use original fixture intent where that default fired.

## E. Stage 1 semantic comparison (mechanical)

| metric | current | simplification | ai-first |
| --- | --- | --- | --- |
| facts scored | 70 | 70 | 70 |
| material fact recall | 69/70 (98.6%) | 67/70 (95.7%) | 69/70 (98.6%) |
| false material facts | 5/70 (7.1%) | 3/70 (4.3%) | 7/70 (10.0%) |
| false / unsafe writes | 5/70 (7.1%) | 3/70 (4.3%) | 10/70 (14.3%) |
| wrong identity | 0/70 (0.0%) | 0/70 (0.0%) | 3/70 (4.3%) |
| silent omissions | 1/70 (1.4%) | 3/70 (4.3%) | 0/70 (0.0%) |
| evidence grounding | 66/68 (97.1%) | 63/65 (96.9%) | 69/69 (100.0%) |
| ambiguity safety | 18/22 (81.8%) | 18/22 (81.8%) | 20/22 (90.9%) |
| clear-input automation | 31/36 (86.1%) | 27/36 (75.0%) | 33/36 (91.7%) |
| justified intervention | 23 | 23 | 20 |
| unnecessary intervention | 7 | 9 | 2 |
| extra unmatched writes | 3 | 2 | 5 |
| malformed cases | 0 | 0 | 0 |
| median latency ms | 1884 | 1925 | 5968 |
| latency range ms | 1180–4934 | 1088–6871 | 3969–20082 |
| prompt tokens | 67335 | 67335 | 51404 |
| completion tokens | 10969 | 10828 | 14475 |

## F. Stage 2 repeated-live comparison

20 cases × 3 runs × 3 contenders = 180 calls. Same prompts/settings.

| metric | current | simplification | ai-first |
| --- | --- | --- | --- |
| facts scored | 87 | 87 | 87 |
| material fact recall | 87/87 (100.0%) | 87/87 (100.0%) | 87/87 (100.0%) |
| false / unsafe writes | 9/87 (10.3%) | 6/87 (6.9%) | 12/87 (13.8%) |
| wrong identity | 0/87 (0.0%) | 0/87 (0.0%) | 3/87 (3.4%) |
| silent omissions | 0/87 (0.0%) | 0/87 (0.0%) | 0/87 (0.0%) |
| evidence grounding | 81/85 (95.3%) | 81/86 (94.2%) | 87/87 (100.0%) |
| ambiguity safety | 21/24 (87.5%) | 21/24 (87.5%) | 24/24 (100.0%) |
| clear-input automation | 37/51 (72.5%) | 31/51 (60.8%) | 48/51 (94.1%) |
| unnecessary intervention | 14 | 20 | 3 |
| extra unmatched writes | 2 | 1 | 10 |
| median latency ms | 2004 | 1824 | 7247 |

Materially disagreeing repeats (unique judgement signatures):

- Current: 5 cases (`ambiguous-same-first-name`, `correction-of-wording`, `explicit-ownership-first`, `holdout-h6`, `similar-name-ambiguous-brick`)
- Simplification: 4 cases (`correction-of-wording`, `might-ownership`, `noisy-conversational`, `similar-name-ambiguous-brick`)
- AI-first: 1 case (`holdout-h6` — extra unbound contractor-lead responsibility on 1/3 runs)

Most Current/Simplification variance is Needs You vs Left untouched, not write vs no-write. `correction-of-wording` is the exception: create vs leftover shader sibling vs Needs You across repeats (shared extract noise).

## G. Current vs Simplification hosted / Apply

AI-first is **not** in Apply. Gate 1 has no production write materialiser. **Do not read Level 1 as production-ready.**

Hosted Vercel (`LUME_E2E_BASE_URL`) is a different git SHA (`cursor-vis-c19eaf`), not the pinned Current or Simplification checkouts. Using it would not be a fair pin comparison. Stage 3 used each pin’s in-memory production Apply path (`planCaptureApply` + `applyCaptureOperationInMemory`) on disposable worlds, then reread.

| metric | current | simplification |
| --- | --- | --- |
| facts scored | 21 | 21 |
| recall | 21/21 | 21/21 |
| false / unsafe writes (mechanical) | 2/21 | 1/21 |
| wrong identity | 0 | 0 |
| silent omissions | 0 | 0 |
| clear-input automation | 11/14 (78.6%) | 9/14 (64.3%) |
| Apply writes executed when proposed | yes | yes |

Reread-confirmed Apply behaviour:

- Both: risk resolve (Gumdrop Bridge → resolved); todo create (banners, candy canes); person create (Jordan Hale); H6 workshop date + Kwame + void keys; noisy Capture (sprinkles todo + bridge resolved).
- Both: share-vs-replace, Toyworld bait, foreign-id → **no write**.
- Current only: mixed-domains fountain-pump **create** plus parade date update; mixed-clear-and-unclear sprinkles **create**.
- Simplification: mixed-domains **parade date only** (fountain withheld); mixed-clear-and-unclear **no write** on this run.
- Both: `explicit-ownership-first` (Sarah Kim owns float safety) proposed **zero** Apply writes.

## H. Per-contender (Stage 1 mechanical, then qualitative)

### Current

- False facts / unsafe writes: 5 mechanical. Qualitative: contradict-parade date write; relative-date parade write; contradict-packaging write; extra retracted shader risk; extra new-risk sibling. Mixed-domains parade/fountain writes are **fixture-intent correct** (scorer default).
- Wrong identity: 0
- Silent omissions: 1 mechanical (`wrong-type-id` token miss) while still updating `ms-parade`
- Recall 69/70; evidence 97.1%; ambiguity 81.8%; clear automation 86.1%; unnecessary intervention 7
- Stability: 5/20 Stage 2 cases varied
- Latency median 1.9s; ~67.3k / 11.0k tokens; ~$0.017 on frozen 4o-mini list price for Stage 1
- Complexity: 1509 LOC `resolve.ts`, ~12 recovery helpers

### Simplification

- False facts / unsafe writes: 3 mechanical. Qualitative: same extract-driven contradict-parade and relative-date writes as Current; **did not** write contradict-packaging; **did not** keep the retracted shader sibling on Stage 1
- Wrong identity: 0
- Silent omissions: 3 (`similar-name-exact`, `similar-name-spelling`, plus `wrong-type-id` token miss). Also withheld C5 timber-risk create and mixed fountain create (Needs You)
- Recall 67/70; clear automation 75.0%; unnecessary intervention 9
- Stability: 4/20 Stage 2 cases varied
- Latency/cost: same model family as Current
- Complexity: 993 LOC `resolve.ts` (−516 vs Current). Removed unique-title bind, hydration, no_change rematerialise, foreign-ID create rescue, two-token/date regex recovery

### AI-first (Gate 1)

- False facts / unsafe writes: 10 mechanical. Qualitative: proposed **remove** on milestone, person, and risk (unsupported product ops); renamed Pippa via update; unbound creates that missed existing ids (availability, Brick Willow); C5 asbestos as create rather than update of `todo-asbestos`; extra sibling responsibilities (Kwame/Jordan/Sarah); Pixel create on Candyland bait
- Wrong identity: 3
- Silent omissions: 0
- Recall 69/70; evidence 100%; ambiguity 90.9%; clear automation 91.7%; unnecessary intervention 2
- Stability: best of the three on the 20-case subset except H6 extra responsibility
- Latency median ~6.0s (range to 20s); fewer prompt tokens (compact snapshot), more completion tokens; **no frozen public price for `gpt-6-astra`**
- Complexity: 0 production resolve LOC; one call; inspect-only. **Not Apply-capable**

## I. Architectural complexity

See tables in C and H. LOC is not a proxy for correctness.

| | Current | Simplification | AI-first Gate 1 |
| --- | --- | --- | --- |
| Semantic/recovery production LOC (`resolve.ts`) | 1509 | 993 | 0 (experiment interpreter only) |
| AI calls per Capture | 1 | 1 | 1 |
| Semantic/recovery stages | extract → validate → leftover coverage → hydrate/rematerialise resolve → planCaptureApply | extract → validate → leftover coverage → reduced resolve → planCaptureApply | snapshot serialize → one structured call → inspect |
| Major special-case machinery | unique-title bind, linguistic hydration, no_change rematerialise, foreign-ID create rescue, two-token name, date regex, contradictory siblings, identity gates | contradictory siblings, ownership rematerialise, identity gates | none in production; unsupported ops still emitted by the model |

## J. Historical-regression performance

| Case | Current | Simplification | AI-first |
| --- | --- | --- | --- |
| H6 messy paste | 5/5 facts; workshop+Kwame+void keys Apply in Stage 3 | same writes; policy Left untouched vs Current Needs You | 5/5; extra responsibility sibling in some runs |
| C5 timber-floor | asbestos complete + timber risk create | asbestos complete; **timber risk Needs You** | timber create; asbestos **wrong-id create** plus separate update |
| Title-only Parade day | update `ms-parade` | update `ms-parade` | update `ms-parade` |
| Harbourline Sarah | Needs You | Left untouched | Needs You / Left untouched — no Hannah bind |
| Harbourline competing launch | Needs You | Needs You | Needs You |
| Pronoun `she` | fail-closed | fail-closed | fail-closed |
| Toyworld vocabulary bait | no write | no write | **create** packaging-shaped fact on Candyland |
| Unsupported milestone delete | Left untouched / Needs You | same | **remove `ms-parade`** |
| Ownership competing Fizz/UAT | Needs You | Needs You | Needs You |

## K. Cases where CURRENT clearly wins

- `correction-of-wording` Stage 1: kept the audio-bus create; Simplification also created it but Current’s recovery still sometimes keeps the retracted shader (a Current *loss* on that sibling). Current wins `c5-timber-floor` timber-risk **create** vs Simplification Needs You.
- `similar-name-exact` / `similar-name-spelling`: Current restates or Needs You Brick Oakley; Simplification omitted.
- `mixed-domains` fountain create and Stage 3 mixed-clear sprinkles create: Current automates; Simplification withholds.
- `responsibility-continues`: Current `no_change`; Simplification `needs_you`.

## L. Cases where SIMPLIFICATION clearly wins

- `contradict-packaging`: Current wrote an update; Simplification Needs You.
- `correction-of-wording` Stage 1 extra: Simplification dropped the retracted shader sibling.
- Mechanical false-write rate lowest of the three.
- Same H6 Apply success as Current with less recovery machinery.

## M. Cases where AI-FIRST clearly wins

- `contradict-parade` and `relative-date-parade`: Astra left unresolved; Current/Simplification **wrote a date**.
- `wrong-type-id`: Astra stayed fail-closed; Current/Simplification still wrote `ms-parade`.
- `new-risk`: cleaner single create vs extract sibling extras.
- Evidence always a Capture quote; lowest unnecessary intervention; highest clear-input automation.

## N. Cases where all three fail (or share a miss)

- Mechanical `mixed-domains` (scorer default). Qualitatively all three understood the paste; Simplification dropped the fountain create.
- Extract-shared Current/Simplification: `contradict-parade`, `relative-date-parade` unsafe date writes.
- `explicit-ownership-first`: none of the Apply-capable systems wrote Sarah Kim / float safety in Stage 3.
- AI-first unsupported-remove family: Current/Simplification correctly withheld; Astra proposed deletes.

## O. Model variance

- No silent model substitution.
- Astra more stable across repeats except H6 extra sibling.
- 4o-mini extract variance on correction/ambiguous identity is visible in both Current and Simplification because they share Prompt A.
- Temperature remains 0.2 on production extract; Astra uses Gate 1 v2 defaults (no temperature field in that runner).

## P. Blind-review packet

`experiments/capture-three-way-bakeoff/BLIND_PACKET.md`  
16 cases. Systems labeled X/Y/Z. Mapping not inlined.

## Q. Blind mapping (facilitators only — withhold until review is done)

`experiments/capture-three-way-bakeoff/BLIND_MAPPING.json`

Do not publish this path to blind readers.

## R. Evidence-based architectural conclusion

Level 1 (semantic): AI-first understands explicit Capture best (recall, evidence, ambiguity, ordinary automation) and is **not** safest.

Level 2 (Apply): only Current and Simplification. Simplification is the safer write engine; Current’s extra recovery still automates some clear creates Simplification now withholds.

Hybrid “Astra semantics + simplified write safety” is a **hypothesis only**. Not designed or implemented here.

---

### Explicit answers

1. **Safest?** Simplification (fewest false/unsafe writes, zero wrong identity). Current close. AI-first is not safest (unsupported deletes + wrong identity).
2. **Understands explicit project information best?** AI-first, then Current, then Simplification.
3. **Best on clear ordinary Capture?** AI-first (91.7% mechanical clear automation). Current next. Simplification withholds more.
4. **Messy Capture?** Split. AI-first on H6 facts and evidence; extra siblings. Current automates mixed fountain/C5 timber. Simplification is cleaner on contradictions, weaker on mixed creates.
5. **Ambiguity most safely?** AI-first (90.9% / Stage 2 100%). Current and Simplification tied at 81.8%, and both still guess some dates.
6. **Least unnecessary user work?** AI-first (2). Simplification creates the most (9).
7. **Most stable across repeats?** AI-first (1 unstable case vs 5 / 4). Shared 4o-mini extract is the main Current/Simplification variance source.
8. **Simplest architecturally?** AI-first Gate 1, then Simplification, then Current.
9. **Is Current’s extra complexity earning its keep?** Partially. It recovers Brick restatement, C5 timber-risk create, mixed fountain create. It also enables contradict-packaging writes and retracted-shader extras. Not a clean win for keeping the full rescue stack.
10. **Is Simplification’s reduced automation worth it?** On Tier 1 safety, yes modestly. It is not free: C5 timber-risk, mixed fountain, and some Brick restatements become human work.
11. **Does AI-first outperform enough of the semantic layer to justify Gate 2?** **Yes, as a semantic winner / Gate 2 justified** — not as production Capture. Unsupported-op writes remain a Gate 2 legal-boundary problem, which this run reproduced on purpose by using Gate 1 only.
12. **Promote Simplification to `main` BEFORE AI-first Gate 2?** **Not automatically.** It is the recommended *production candidate*, but C5/fountain/Brick regressions need human sign-off. AI-first cannot replace Apply yet, so waiting on Gate 2 is not required before a Simplification decision — it is required before any AI-first production claim.
13. **Single next step supported by the evidence:** Human review of this packet (including the blind set). Do not merge. If the owner wants a production architecture decision now, inspect Simplification’s withheld-create regressions, then approve or reject promotion from a **fresh branch off current `main`**. If the owner wants the semantic architecture decision, run existing Gate 2 (do not build a new one here) against this same frozen corpus.

Hypothesis only (not implemented): Astra interpretation plus Simplification/Apply legal matrix.

---

**SIMPLIFICATION RECOMMENDED**

(Production candidate, not merged. AI-first is the Level 1 semantic winner and **Gate 2 is justified**; it is not production-ready.)
