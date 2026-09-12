# Checkpoint 3 — Prompt A/B/C/D

**Status:** Live comparison run on this VM. Holdout frozen before scoring. Production `src/lib/capture-v2/prompt.ts` unchanged (Prompt A).

**Run:** `2026-09-12T03:32:56.869Z`  
**Holdout frozen at:** `2026-09-11T23:30:00.000Z` (`holdout.ts`, 10 cases, not edited)  
**Model:** `gpt-4o-mini-2024-07-18` (pinned; `OPENAI_MODEL` unset)  
**Temperature:** `0.2`  
**Downstream:** current branch `runPipeline` (resolve/plan unchanged for this slice)  
**Scoring:** `SCORING.md`  
**Machine record:** `scripts/capture-convergence/prompt-experiment/holdout-results.json` (also `test-results/prompt-experiment-holdout.json`). No raw transcripts.

B/C/D were called from `scripts/capture-convergence/prompt-experiment/extract-variant.ts` only. Not wired into `/api/capture`.

## Per-variant totals (10 holdout cases)

| Variant | Recall | Invent | foreign_id | Contam / wrong attach | Unsafe pronoun | Ambiguity preserved | Writes | Needs You | Obs | parseMalformed | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A current production | 18/18 | 0 | 5 | 0 / 0 | 2 | 0/1 | 7 | 6 | 28 | 0 | 0 |
| B typed schema | 18/18 | 0 | 3 | 0 / 0 | 1 | 0/1 | 8 | **0** | 26 | 0 | 0 |
| C uncertainty / reference | 18/18 | 0 | 2 | 0 / 0 | **0** | **1/1** | 5 | 2 | 26 | 0 | 0 |
| D example-guided | 18/18 | 0 | **0** | 0 / 0 | 2 | 0/1 | 10 | 3 | 26 | 0 | 0 |

Create / update / name-only (scored on envelope, not Apply):

| Variant | Create suitable | Update / no-duplicate | Name-only survived |
| --- | ---: | ---: | ---: |
| A | 1/1 | 2/2 | 2/2 |
| B | 1/1 | 2/2 | 2/2 |
| C | 1/1* | 2/2 | 2/2 |
| D | 1/1 | 2/2 | 2/2 |

\*C named Nova Quill / Remy Volt as `create_new` but invented `candidateTargetId`s; VALIDATE rejected both (`foreign_id=2`, `writes=0` on that case). Envelope create shape ≠ executable write.

## Per-case (recall / foreign_id / writes / needs_you / pronoun)

| Case | A | B | C | D |
| --- | --- | --- | --- | --- |
| held-mixed-people-dates-risk | 3/3 · fid 4 · w 0 · ny 0 | 3/3 · fid 1 · w 2 · ny 0 | 3/3 · fid 0 · w 3 · ny 0 | 3/3 · fid 0 · w 3 · ny 0 |
| held-two-names-update | 2/2 · fid 0 · w 0 · ny 1 | 2/2 · fid 0 · w 1 · ny 0 | 2/2 · fid 0 · w 0 · ny 0 | 2/2 · fid 0 · w 1 · ny 0 |
| held-unsupported-complete-todo | 1/1 · fid 0 · w 1 · ny 0 | 1/1 · fid 0 · w 1 · ny 0 | 1/1 · fid 0 · w 0 · ny 0 | 1/1 · fid 0 · w 1 · ny 0 |
| held-irrelevant-weather | 2/2 · fid 0 · w 1 · ny 0 | 2/2 · fid 0 · w 1 · ny 0 | 2/2 · fid 0 · w 1 · ny 0 | 2/2 · fid 0 · w 1 · ny 0 |
| held-two-new-people | 2/2 · fid 0 · w 2 · ny 0 | 2/2 · fid 0 · w 2 · ny 0 | 2/2 · fid 2 · w 0 · ny 0 | 2/2 · fid 0 · w 1 · ny 0 |
| held-cross-project-mention | 1/1 · fid 1 · w 0 · ny 1 | 1/1 · fid 1 · w 0 · ny 0 | 1/1 · fid 0 · w 1 · ny 0 | 1/1 · fid 0 · w 1 · ny 1 |
| held-busy-aurora-ops | 3/3 · fid 0 · w 1 · ny 2 | 3/3 · fid 0 · w 1 · ny 0 | 3/3 · fid 0 · w 0 · ny 1 | 3/3 · fid 0 · w 1 · ny 0 |
| held-they-pronoun-two-people | 1/1 · pronoun 2 · w 0 · ny 2 · ambig **no** | 1/1 · pronoun 1 · w 0 · ny 0 · ambig **no** | 1/1 · pronoun 0 · w 0 · ny 1 · ambig **yes** | 1/1 · pronoun 2 · w 0 · ny 2 · ambig **no** |
| held-person-role-not-scope | 1/1 · fid 0 · w 1 · ny 0 | 1/1 · fid 0 · w 0 · ny 0 | 1/1 · fid 0 · w 0 · ny 0 | 1/1 · fid 0 · w 0 · ny 0 |
| held-fizz-and-pippa-independent | 2/2 · fid 0 · w 1 · ny 0 | 2/2 · fid 1 · w 0 · ny 0 | 2/2 · fid 0 · w 0 · ny 0 | 2/2 · fid 0 · w 1 · ny 0 |

## Reading

- All four variants recalled every `mustRecall` needle. No `mustNotInvent` hits. No sibling-name contamination or wrong-entity attachment on this holdout. No malformed envelopes. No OpenAI 401/429/network failures.
- **A** is the only variant that kept a meaningful Needs You volume (6). It is also the worst ID citizen: 5 invented/foreign targets, including 4 rejected rows on the mixed-domain paste (0 writes). Pronoun case: model bound names into `They` evidence; Needs You still fired (2) but ambiguity scored fail.
- **B** is unsafe to promote. Needs You collapsed to **0**. Pronoun case became `no_change` with an unsafe bind and no hold. Still 3 foreign ids.
- **C** is the only variant that preserved the frozen pronoun/ambiguity case (0 unsafe binds, 1 Needs You). Mixed-domain and cross-project pastes used supplied ids (3 + 1 writes, 0 foreign). Cost: invented ids on clear new-person creates (2 rejects, 0 writes); fewer executable writes overall (5), including lost Fizz availability and busy-ops writes.
- **D** has the cleanest id hygiene (0 foreign) and the most writes (10), with 3 Needs You. Pronoun discipline matches A (2 unsafe binds). One of two new-person creates did not become a write.

Optional production Prompt A sample (`LUME_CAPTURE_LIVE=1 npm run eval:capture-live`): 8/8 calls succeeded on `gpt-4o-mini-2024-07-18`, `promptVersion=capture-v2-eval-baseline-v1`. Provenance only in `test-results/capture-live-held-out.json` (gitignored). Not used to pick a winner.

Do not treat write-count as a win. Prefer fewer cleaner observations over unsafe certainty. Recommendation in `CHECKPOINT_4.md`.
