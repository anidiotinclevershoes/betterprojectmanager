# Simplification + Astra control comparison

Bake-off results are read-only. Expected outcomes were not retuned.

Model mismatches (requested/response ≠ gpt-6-astra): 0

## Stage 1 — full frozen corpus

| Metric | Current+4o-mini | Simplification+4o-mini | Simplification+Astra | AI-first+Astra |
| --- | --- | --- | --- | --- |
| material fact recall | 69/70 (98.6%) | 67/70 (95.7%) | 69/70 (98.6%) | 69/70 (98.6%) |
| false material facts | 5/70 (7.1%) | 3/70 (4.3%) | 5/70 (7.1%) | 7/70 (10.0%) |
| false / unsafe writes | 5/70 (7.1%) | 3/70 (4.3%) | 6/70 (8.6%) | 10/70 (14.3%) |
| wrong identity | 0/70 (0.0%) | 0/70 (0.0%) | 1/70 (1.4%) | 3/70 (4.3%) |
| silent omissions | 1/70 (1.4%) | 3/70 (4.3%) | 0/70 (0.0%) | 0/70 (0.0%) |
| evidence grounding | 66/68 (97.1%) | 63/65 (96.9%) | 69/69 (100.0%) | 69/69 (100.0%) |
| ambiguity safety | 18/22 (81.8%) | 18/22 (81.8%) | 19/22 (86.4%) | 20/22 (90.9%) |
| clear-input automation | 31/36 (86.1%) | 27/36 (75.0%) | 23/36 (63.9%) | 33/36 (91.7%) |
| justified intervention | 23 | 23 | 23 | 20 |
| unnecessary intervention | 7 | 9 | 14 | 2 |
| extra unmatched writes | 3 | 2 | 5 | 5 |
| malformed cases | 0 | 0 | 0 | 0 |
| median latency ms | 1884 | 1925 | 6622 | 5968 |
| latency range ms | 1180–4934 | 1088–6871 | 3602–28276 | 3969–20082 |
| prompt tokens | 67335 | 67335 | 67276 | 51404 |
| completion tokens | 10969 | 10828 | 17712 | 14475 |

## Stage 2 — repeated live

| Metric | Current+4o-mini | Simplification+4o-mini | Simplification+Astra | AI-first+Astra |
| --- | --- | --- | --- | --- |
| material fact recall | 87/87 (100.0%) | 87/87 (100.0%) | 87/87 (100.0%) | 87/87 (100.0%) |
| false material facts | 9/87 (10.3%) | 6/87 (6.9%) | 6/87 (6.9%) | 9/87 (10.3%) |
| false / unsafe writes | 9/87 (10.3%) | 6/87 (6.9%) | 9/87 (10.3%) | 12/87 (13.8%) |
| wrong identity | 0/87 (0.0%) | 0/87 (0.0%) | 3/87 (3.4%) | 3/87 (3.4%) |
| silent omissions | 0/87 (0.0%) | 0/87 (0.0%) | 0/87 (0.0%) | 0/87 (0.0%) |
| evidence grounding | 81/85 (95.3%) | 81/86 (94.2%) | 87/87 (100.0%) | 87/87 (100.0%) |
| ambiguity safety | 21/24 (87.5%) | 21/24 (87.5%) | 24/24 (100.0%) | 24/24 (100.0%) |
| clear-input automation | 37/51 (72.5%) | 31/51 (60.8%) | 34/51 (66.7%) | 48/51 (94.1%) |
| justified intervention | 24 | 24 | 27 | 24 |
| unnecessary intervention | 14 | 20 | 17 | 3 |
| extra unmatched writes | 2 | 1 | 6 | 10 |
| malformed cases | 0 | 0 | 0 | 0 |
| median latency ms | 2003.5 | 1823.5 | 8402 | 7247 |
| latency range ms | 1081–12262 | 1117–7511 | 3652–35984 | 4403–27198 |
| prompt tokens | 68733 | 68733 | 68673 | 52734 |
| completion tokens | 14024 | 13713 | 24872 | 18208 |

## Stage 3 — in-memory Apply (Current / Simplification / Simplification+Astra only)

AI-first is Gate 1 semantic interpretation only and is not Apply-capable.

| Metric | Current+4o-mini | Simplification+4o-mini | Simplification+Astra | AI-first+Astra |
| --- | --- | --- | --- | --- |
| material fact recall | 21/21 (100.0%) | 21/21 (100.0%) | 21/21 (100.0%) | 0/0 (n/a) |
| false material facts | 2/21 (9.5%) | 1/21 (4.8%) | 2/21 (9.5%) | 0/0 (n/a) |
| false / unsafe writes | 2/21 (9.5%) | 1/21 (4.8%) | 2/21 (9.5%) | 0/0 (n/a) |
| wrong identity | 0/21 (0.0%) | 0/21 (0.0%) | 0/21 (0.0%) | 0/0 (n/a) |
| silent omissions | 0/21 (0.0%) | 0/21 (0.0%) | 0/21 (0.0%) | 0/0 (n/a) |
| evidence grounding | 20/21 (95.2%) | 21/21 (100.0%) | 21/21 (100.0%) | 0/0 (n/a) |
| ambiguity safety | 5/5 (100.0%) | 5/5 (100.0%) | 5/5 (100.0%) | 0/0 (n/a) |
| clear-input automation | 11/14 (78.6%) | 9/14 (64.3%) | 11/14 (78.6%) | 0/0 (n/a) |
| justified intervention | 5 | 5 | 5 | 0 |
| unnecessary intervention | 4 | 5 | 4 | 0 |
| extra unmatched writes | 0 | 0 | 0 | 0 |
| malformed cases | 0 | 0 | 0 | 0 |
| median latency ms | 1527.5 | 1833 | 8211 | n/a |
| latency range ms | 1298–5365 | 1157–6046 | 4048–31173 | n/a |
| prompt tokens | 13775 | 13775 | 13763 | 0 |
| completion tokens | 2866 | 2612 | 5381 | 0 |

## Watch cases (Stage 1 notes)

### c5-timber-floor

- Current: update write=yes id=todo-asbestos | create write=yes id=omitted writes=["update:todo:todo-asbestos","create:risk:omitted"]
- Simplification+4o-mini: update write=yes id=todo-asbestos | needs_you write=no id=omitted writes=["update:todo:todo-asbestos"]
- Simplification+Astra: update write=yes id=omitted | create write=yes id=omitted writes=["update:knowledge:omitted","update:todo:todo-asbestos","create:risk:omitted"]
- AI-first+Astra: create write=yes id=omitted | create write=yes id=omitted writes=["create:knowledge:omitted","update:todo:todo-asbestos","create:risk:omitted"]

### mixed-domains

- Current: no_change write=no id=person-gumdrop | update write=yes id=ms-parade | create write=yes id=omitted writes=["update:milestone:ms-parade","create:risk:omitted"]
- Simplification+4o-mini: needs_you write=no id=person-gumdrop | update write=yes id=ms-parade | needs_you write=no id=omitted writes=["update:milestone:ms-parade"]
- Simplification+Astra: no_change write=no id=person-gumdrop | update write=yes id=ms-parade | create write=yes id=omitted writes=["update:milestone:ms-parade","create:risk:omitted"]
- AI-first+Astra: no_change write=no id=resp-uat | update write=yes id=ms-parade | create write=yes id=omitted writes=["update:milestone:ms-parade","create:risk:omitted"]

### mixed-clear-and-unclear

- Current: create write=yes id=omitted | left_untouched write=no id=omitted writes=["create:todo:omitted"]
- Simplification+4o-mini: create write=yes id=omitted | left_untouched write=no id=omitted writes=["create:todo:omitted"]
- Simplification+Astra: create write=yes id=omitted | left_untouched write=no id=omitted writes=["create:todo:omitted"]
- AI-first+Astra: create write=yes id=omitted | left_untouched write=no id=omitted writes=["create:todo:omitted"]

### similar-name-exact

- Current: no_change write=no id=person-brick writes=[]
- Simplification+4o-mini: No matching item writes=[]
- Simplification+Astra: needs_you write=no id=person-brick writes=[]
- AI-first+Astra: no_change write=no id=person-brick writes=[]

### similar-name-spelling

- Current: needs_you write=no id=person-brick writes=[]
- Simplification+4o-mini: No matching item writes=[]
- Simplification+Astra: needs_you write=no id=person-brick writes=[]
- AI-first+Astra: no_change write=no id=person-brick writes=[]

### responsibility-continues

- Current: no_change write=no id=person-pixel writes=[]
- Simplification+4o-mini: needs_you write=no id=person-pixel writes=[]
- Simplification+Astra: needs_you write=no id=person-pixel writes=[]
- AI-first+Astra: no_change write=no id=person-pixel writes=[]

### explicit-ownership-first

- Current: needs_you write=no id=person-gumdrop writes=[]
- Simplification+4o-mini: needs_you write=no id=person-gumdrop writes=[]
- Simplification+Astra: create write=yes id=omitted writes=["create:person:omitted"]
- AI-first+Astra: create write=yes id=omitted writes=["create:person:omitted","create:responsibility:omitted"]

### contradict-packaging

- Current: update write=yes id=risk-packaging writes=["update:risk:risk-packaging"]
- Simplification+4o-mini: needs_you write=no id=risk-packaging writes=[]
- Simplification+Astra: needs_you write=no id=risk-packaging writes=[]
- AI-first+Astra: needs_you write=no id=risk-packaging writes=[]

### correction-of-wording

- Current: create write=yes id=omitted writes=["create:risk:omitted","create:risk:omitted"]
- Simplification+4o-mini: create write=yes id=omitted writes=["create:risk:omitted"]
- Simplification+Astra: left_untouched write=no id=risk-console writes=[]
- AI-first+Astra: create write=yes id=omitted writes=["create:risk:omitted"]

### title-only-existing-target

- Current: update write=yes id=ms-parade writes=["update:milestone:ms-parade"]
- Simplification+4o-mini: update write=yes id=ms-parade writes=["update:milestone:ms-parade"]
- Simplification+Astra: update write=yes id=ms-parade writes=["update:milestone:ms-parade"]
- AI-first+Astra: update write=yes id=ms-parade writes=["update:milestone:ms-parade"]


## Stage 2 uniqueness (Simplification+Astra)

- ambiguous-same-first-name: 2 distinct judgement signatures
- correction-of-wording: 3 distinct judgement signatures
- pronoun-ambiguity: 2 distinct judgement signatures
- c5-timber-floor: 2 distinct judgement signatures
