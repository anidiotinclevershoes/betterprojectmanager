# Capture three-way bake-off report

Non-mergeable experiment. Contenders were not modified. Expected outcomes were frozen before live runs.

## A. Experiment branch

- branch: `experiment/capture-three-way-bakeoff`
- frozen corpus cases: 59

## B. Pinned contender SHAs

- Current: `920d65d9c0f6e49efca8e26fc8906dbbd11e8f25`
- Simplification: `bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0`
- AI-first Gate 1 v2: `707b704bbf820fcc4492c86155889d6afe5d5bae`

## C. Models

- Current: `gpt-4o-mini-2024-07-18` / Prompt A capture-v2-eval-baseline-v2
- Simplification: `gpt-4o-mini-2024-07-18` / Prompt A capture-v2-eval-baseline-v2 (same extract as Current)
- AI-first: `gpt-6-astra` / Gate 1 v2 contract + dumb current canonical snapshot

## D. Frozen corpus

See `FROZEN_CORPUS.md`.

## E. Stage 1 semantic comparison

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

| metric | current | simplification | ai-first |
| --- | --- | --- | --- |
| facts scored | 87 | 87 | 87 |
| material fact recall | 87/87 (100.0%) | 87/87 (100.0%) | 87/87 (100.0%) |
| false material facts | 9/87 (10.3%) | 6/87 (6.9%) | 9/87 (10.3%) |
| false / unsafe writes | 9/87 (10.3%) | 6/87 (6.9%) | 12/87 (13.8%) |
| wrong identity | 0/87 (0.0%) | 0/87 (0.0%) | 3/87 (3.4%) |
| silent omissions | 0/87 (0.0%) | 0/87 (0.0%) | 0/87 (0.0%) |
| evidence grounding | 81/85 (95.3%) | 81/86 (94.2%) | 87/87 (100.0%) |
| ambiguity safety | 21/24 (87.5%) | 21/24 (87.5%) | 24/24 (100.0%) |
| clear-input automation | 37/51 (72.5%) | 31/51 (60.8%) | 48/51 (94.1%) |
| justified intervention | 24 | 24 | 24 |
| unnecessary intervention | 14 | 20 | 3 |
| extra unmatched writes | 2 | 1 | 10 |
| malformed cases | 0 | 0 | 0 |
| median latency ms | 2003.5 | 1823.5 | 7247 |
| latency range ms | 1081–12262 | 1117–7511 | 4403–27198 |
| prompt tokens | 68733 | 68733 | 52734 |
| completion tokens | 14024 | 13713 | 18208 |

## G. Stage 3 Current vs Simplification Apply (in-memory production path)

AI-first is **not** included: Gate 1 does not define a production write materialiser. Hosted Vercel preview was **not** used because it is a different git SHA than the pinned Current/Simplification checkouts.

| metric | current | simplification | ai-first |
| --- | --- | --- | --- |
| facts scored | 21 | 21 | 0 |
| material fact recall | 21/21 (100.0%) | 21/21 (100.0%) | 0/0 (n/a) |
| false material facts | 2/21 (9.5%) | 1/21 (4.8%) | 0/0 (n/a) |
| false / unsafe writes | 2/21 (9.5%) | 1/21 (4.8%) | 0/0 (n/a) |
| wrong identity | 0/21 (0.0%) | 0/21 (0.0%) | 0/0 (n/a) |
| silent omissions | 0/21 (0.0%) | 0/21 (0.0%) | 0/0 (n/a) |
| evidence grounding | 20/21 (95.2%) | 21/21 (100.0%) | 0/0 (n/a) |
| ambiguity safety | 5/5 (100.0%) | 5/5 (100.0%) | 0/0 (n/a) |
| clear-input automation | 11/14 (78.6%) | 9/14 (64.3%) | 0/0 (n/a) |
| justified intervention | 5 | 5 | 0 |
| unnecessary intervention | 4 | 5 | 0 |
| extra unmatched writes | 0 | 0 | 0 |
| malformed cases | 0 | 0 | 0 |
| median latency ms | 1527.5 | 1833 | n/a |
| latency range ms | 1298–5365 | 1157–6046 | n/a |
| prompt tokens | 13775 | 13775 | 0 |
| completion tokens | 2866 | 2612 | 0 |

## I. Architectural complexity

```json
{
  "current": {
    "sha": "920d65d9c0f6e49efca8e26fc8906dbbd11e8f25",
    "extractModel": "gpt-4o-mini-2024-07-18",
    "prompt": "Prompt A capture-v2-eval-baseline-v2",
    "aiCallsPerCapture": 1,
    "semanticPasses": "extract → validate → leftover coverage → resolve (hydrate/rematerialise) → planCaptureApply",
    "resolveLoc": 1509,
    "recoveryFunctions": [
      "uniqueTitledRecord",
      "rematerializeOwnershipAsResponsibility",
      "rematerializeTitle",
      "isoDateFromLocalText",
      "looksLikeRestatement",
      "looksLikeNewAssignment",
      "existingEvidencedPerson",
      "twoTokenNameFromLocalText",
      "statusTokenFromLocalText",
      "hydrateFromLocalEvidence",
      "rematerializeTrustedNoChange",
      "rematerializeAbsentPerson",
      "rematerializeIndependentDatedCreate"
    ],
    "majorSpecialCases": [
      "unique-title bind",
      "linguistic hydration",
      "no_change rematerialise",
      "foreign-ID create rescue",
      "two-token name recovery",
      "date regex fill",
      "contradictory-sibling Needs You",
      "identity evidence gates"
    ]
  },
  "simplification": {
    "sha": "bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0",
    "extractModel": "gpt-4o-mini-2024-07-18",
    "prompt": "Prompt A capture-v2-eval-baseline-v2 (same extract as Current)",
    "aiCallsPerCapture": 1,
    "semanticPasses": "extract → validate → leftover coverage → resolve (reduced) → planCaptureApply",
    "resolveLoc": 993,
    "recoveryFunctionsRemovedRelativeToCurrent": [
      "uniqueTitledRecord",
      "rematerializeTitle",
      "isoDateFromLocalText",
      "looksLikeRestatement",
      "looksLikeNewAssignment",
      "existingEvidencedPerson",
      "twoTokenNameFromLocalText",
      "statusTokenFromLocalText",
      "hydrateFromLocalEvidence",
      "rematerializeTrustedNoChange",
      "rematerializeAbsentPerson",
      "rematerializeIndependentDatedCreate"
    ],
    "stillPresent": [
      "contradictory-sibling Needs You",
      "rematerializeOwnershipAsResponsibility",
      "identity evidence gates",
      "unexplainedCurrentNoChangeReason"
    ],
    "netResolveDeltaVsCurrent": -516
  },
  "aiFirst": {
    "sha": "707b704bbf820fcc4492c86155889d6afe5d5bae",
    "extractModel": "gpt-6-astra",
    "prompt": "Gate 1 v2 contract + dumb current canonical snapshot",
    "aiCallsPerCapture": 1,
    "semanticPasses": "serialize snapshot → one structured call → mechanical inspect",
    "resolveLoc": 0,
    "productionResolverUsed": false,
    "inspectOnly": true,
    "note": "Gate 1 semantic interpretation only. No Review materialiser, Apply, receipts, or persistence."
  }
}
```
