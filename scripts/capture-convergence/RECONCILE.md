# Convergence reconstructed on holdout baseline

**Not a wholesale merge of `cursor/experiment-capture-convergence-30ae`.**

`origin/main` at reconstruction: `90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b` (PR #162).  
Independent hosted holdout PR #164 was **still open**. This branch starts from holdout HEAD `b354f6a` so holdout deterministic fixes are the baseline.

## Kept from holdout (do not regress)

- rematerialize independently complete dated creates
- foreign-target dated create acceptance
- ambiguous ownership stays Needs You
- New Project persist-before-hydrate / `hydrated` gate
- hosted holdout harness and original-six precommit lock

## Ported from convergence experiment (not superseded)

- observation-local identity evidence + trailing-punctuation quote match
- contradictory same-record sibling writes → Needs You
- D-052 name-only Person recovery in New Project parse

## Experiment-only on this branch

`scripts/capture-convergence/**`, prompt-experiment runner, 538-case corpus, this note.
