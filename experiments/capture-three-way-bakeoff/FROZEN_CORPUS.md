# Frozen three-way bake-off corpus

Frozen **before** any Current / Simplification / AI-first live run.
Do not retune cases, expected outcomes, prompts, or models after seeing outputs.

- Cases: **59**
- Stage 2 subset: **18**
- Stage 3 subset: **7**
- Blind packet: **16**
- SHA-256: `925b3395268d56482b1ce8e0f6fde82a1c4a87f473432fcb73919f809a66cd14`

## Pins

- Current: `920d65d9c0f6e49efca8e26fc8906dbbd11e8f25`
- Simplification: `bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0`
- AI-first Gate 1 v2: `707b704bbf820fcc4492c86155889d6afe5d5bae`

## Category distribution

- no_change_restatement: 7
- clear_ordinary: 15
- identity: 14
- messy_realistic: 6
- unsupported_unplaceable: 8
- uncertainty: 5
- historical_failure: 4

## Expected-outcome sources

- eval-corpus: 21
- gate1-v2-fixture: 2
- holdout: 1
- gate2-fixture: 19
- simplification-observe: 5
- manual-for-experiment: 8
- longhaul-regression: 1
- harbourline-stress: 2

## Cases

| id | category | source | facts | stage2 | stage3 | historical |
| --- | --- | --- | --- | --- | --- | --- |
| existing-person | no_change_restatement | eval-corpus | 1 | yes |  |  |
| new-person | clear_ordinary | eval-corpus | 1 | yes |  |  |
| ambiguous-same-first-name | identity | eval-corpus | 1 | yes |  |  |
| responsibility-continues | clear_ordinary | eval-corpus | 1 |  |  |  |
| responsibility-replacement | clear_ordinary | eval-corpus | 2 |  |  |  |
| share-vs-replace-ambiguous | identity | eval-corpus | 1 | yes | yes |  |
| existing-risk-update | clear_ordinary | eval-corpus | 1 | yes |  |  |
| new-risk | clear_ordinary | eval-corpus | 1 |  |  |  |
| risk-resolution | clear_ordinary | eval-corpus | 1 |  | yes |  |
| milestone-move | clear_ordinary | eval-corpus | 1 |  |  |  |
| unchanged-date | no_change_restatement | eval-corpus | 1 |  |  |  |
| todo-create | clear_ordinary | eval-corpus | 1 |  | yes |  |
| availability | clear_ordinary | eval-corpus | 1 |  |  |  |
| duplicate-observation | no_change_restatement | eval-corpus | 1 |  |  |  |
| correction-of-wording | messy_realistic | eval-corpus | 1 | yes |  |  |
| mixed-domains | messy_realistic | eval-corpus | 3 | yes | yes |  |
| pronoun-ambiguity | identity | eval-corpus | 1 | yes |  | yes |
| irrelevant-commentary | unsupported_unplaceable | eval-corpus | 1 | yes |  |  |
| explicit-no-change | no_change_restatement | eval-corpus | 1 |  |  |  |
| cross-project-bait | identity | eval-corpus | 1 |  |  | yes |
| toyworld-vocabulary-bait | identity | eval-corpus | 1 |  | yes | yes |
| contradict-parade | uncertainty | gate1-v2-fixture | 1 | yes |  |  |
| unsupported-remove | unsupported_unplaceable | gate1-v2-fixture | 1 | yes |  | yes |
| holdout-h6 | historical_failure | holdout | 5 | yes | yes | yes |
| todo-remove-supported | clear_ordinary | gate2-fixture | 1 |  |  |  |
| unsupported-remove-person | unsupported_unplaceable | gate2-fixture | 1 |  |  |  |
| unsupported-remove-risk | unsupported_unplaceable | gate2-fixture | 1 |  |  |  |
| knowledge-water-based | clear_ordinary | gate2-fixture | 1 |  |  |  |
| vague-parade | unsupported_unplaceable | gate2-fixture | 1 | yes |  |  |
| relative-date-parade | uncertainty | gate2-fixture | 1 |  |  |  |
| historic-parade | messy_realistic | gate2-fixture | 1 |  |  |  |
| similar-name-exact | no_change_restatement | gate2-fixture | 1 |  |  |  |
| similar-name-other-brick | identity | gate2-fixture | 1 |  |  |  |
| similar-name-ambiguous-brick | identity | gate2-fixture | 1 | yes |  | yes |
| similar-name-spelling | identity | gate2-fixture | 1 |  |  |  |
| email-unsupported | unsupported_unplaceable | gate2-fixture | 1 |  |  |  |
| todo-complete-jelly | clear_ordinary | gate2-fixture | 1 |  |  |  |
| person-rename-unsupported | unsupported_unplaceable | gate2-fixture | 1 |  |  |  |
| contradict-packaging | messy_realistic | gate2-fixture | 1 |  |  |  |
| todo-dated-canes | clear_ordinary | gate2-fixture | 1 |  | yes |  |
| issue-cert-worse | clear_ordinary | gate2-fixture | 1 |  |  |  |
| chatter-weather | unsupported_unplaceable | gate2-fixture | 1 |  |  |  |
| availability-relative | uncertainty | gate2-fixture | 1 |  |  |  |
| two-token-person-create | identity | simplification-observe | 1 | yes | yes |  |
| ownership-competing-owner | identity | simplification-observe | 1 |  |  | yes |
| explicit-ownership-first | clear_ordinary | simplification-observe | 1 | yes | yes |  |
| mixed-clear-and-unclear | messy_realistic | simplification-observe | 2 |  | yes |  |
| title-only-existing-target | identity | simplification-observe | 1 | yes |  | yes |
| might-ownership | uncertainty | manual-for-experiment | 1 | yes |  |  |
| probably-date | uncertainty | manual-for-experiment | 1 |  |  |  |
| valid-canonical-id | identity | manual-for-experiment | 1 |  |  |  |
| wrong-type-id | identity | manual-for-experiment | 1 |  |  | yes |
| foreign-invented-id | identity | manual-for-experiment | 1 |  | yes | yes |
| c5-timber-floor | historical_failure | longhaul-regression | 2 | yes |  | yes |
| harbourline-sarah-first-name | historical_failure | harbourline-stress | 1 |  |  | yes |
| harbourline-competing-launch | historical_failure | harbourline-stress | 1 |  |  | yes |
| repeated-fact-wording | no_change_restatement | manual-for-experiment | 1 |  |  |  |
| already-current-status | no_change_restatement | manual-for-experiment | 1 |  |  |  |
| noisy-conversational | messy_realistic | manual-for-experiment | 3 | yes | yes |  |
