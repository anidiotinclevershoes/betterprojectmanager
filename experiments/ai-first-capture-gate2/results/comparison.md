# Gate 2 vs Simplification

Special-case rules: 8
- decision→knowledge domain alias
- applySupportsOperation intercept (no capability expansion)
- typed canonical-id existence for update/remove
- unknown-id writes fail closed (no replacement create)
- required create fields from explicit proposedValues only
- ownershipSemantics passed only when it is an exact legal enum
- adopt planCaptureApply write / needs_you / no_change
- reject planner write to a different id than Astra named

## Replay of frozen Gate 1 envelopes through Gate 2 (paired)

| Metric | Simplification | AI-first Gate 2 | Current+4o-mini | AI-first Gate 1 |
| --- | --- | --- | --- | --- |
| material fact recall | 67/70 (95.7%) | 69/70 (98.6%) | 69/70 (98.6%) | 69/70 (98.6%) |
| false material facts | 3/70 (4.3%) | 3/70 (4.3%) | 5/70 (7.1%) | 7/70 (10.0%) |
| false / unsafe writes | 3/70 (4.3%) | 4/70 (5.7%) | 5/70 (7.1%) | 10/70 (14.3%) |
| wrong identity | 0/70 (0.0%) | 1/70 (1.4%) | 0/70 (0.0%) | 3/70 (4.3%) |
| silent omissions | 3/70 (4.3%) | 0/70 (0.0%) | 1/70 (1.4%) | 0/70 (0.0%) |
| evidence grounding | 63/65 (96.9%) | 69/69 (100.0%) | 66/68 (97.1%) | 69/69 (100.0%) |
| ambiguity safety | 18/22 (81.8%) | 20/22 (90.9%) | 18/22 (81.8%) | 20/22 (90.9%) |
| clear-input automation | 27/36 (75.0%) | 29/36 (80.6%) | 31/36 (86.1%) | 33/36 (91.7%) |
| justified intervention | 23 | 24 | 23 | 20 |
| unnecessary intervention | 9 | 8 | 7 | 2 |
| Needs You items | 24 | 24 | 22 | 17 |
| Left untouched items | 24 | 18 | 24 | 12 |
| No change items | 8 | 9 | 12 | 10 |
| extra unmatched writes | 2 | 3 | 3 | 5 |
| malformed cases | 0 | 0 | 0 | 0 |
| median latency ms | 1925 | 5968 | 1884 | 5968 |
| prompt tokens | 67335 | 51404 | 67335 | 51404 |
| completion tokens | 10828 | 14475 | 10969 | 14475 |

## Live Astra + Gate 2 Stage 1

| Metric | Simplification | AI-first Gate 2 | Current+4o-mini | AI-first Gate 1 |
| --- | --- | --- | --- | --- |
| material fact recall | 67/70 (95.7%) | 69/70 (98.6%) | 69/70 (98.6%) | 69/70 (98.6%) |
| false material facts | 3/70 (4.3%) | 2/70 (2.9%) | 5/70 (7.1%) | 7/70 (10.0%) |
| false / unsafe writes | 3/70 (4.3%) | 3/70 (4.3%) | 5/70 (7.1%) | 10/70 (14.3%) |
| wrong identity | 0/70 (0.0%) | 1/70 (1.4%) | 0/70 (0.0%) | 3/70 (4.3%) |
| silent omissions | 3/70 (4.3%) | 0/70 (0.0%) | 1/70 (1.4%) | 0/70 (0.0%) |
| evidence grounding | 63/65 (96.9%) | 69/69 (100.0%) | 66/68 (97.1%) | 69/69 (100.0%) |
| ambiguity safety | 18/22 (81.8%) | 21/22 (95.5%) | 18/22 (81.8%) | 20/22 (90.9%) |
| clear-input automation | 27/36 (75.0%) | 28/36 (77.8%) | 31/36 (86.1%) | 33/36 (91.7%) |
| justified intervention | 23 | 25 | 23 | 20 |
| unnecessary intervention | 9 | 9 | 7 | 2 |
| Needs You items | 24 | 26 | 22 | 17 |
| Left untouched items | 24 | 19 | 24 | 12 |
| No change items | 8 | 10 | 12 | 10 |
| extra unmatched writes | 2 | 2 | 3 | 5 |
| malformed cases | 0 | 0 | 0 | 0 |
| median latency ms | 1925 | 6592 | 1884 | 5968 |
| prompt tokens | 67335 | 51404 | 67335 | 51404 |
| completion tokens | 10828 | 14365 | 10969 | 14475 |

## Live Stage 2

| Metric | Simplification | AI-first Gate 2 | Current+4o-mini | AI-first Gate 1 |
| --- | --- | --- | --- | --- |
| material fact recall | 87/87 (100.0%) | 87/87 (100.0%) | 87/87 (100.0%) | 87/87 (100.0%) |
| false material facts | 6/87 (6.9%) | 6/87 (6.9%) | 9/87 (10.3%) | 9/87 (10.3%) |
| false / unsafe writes | 6/87 (6.9%) | 9/87 (10.3%) | 9/87 (10.3%) | 12/87 (13.8%) |
| wrong identity | 0/87 (0.0%) | 3/87 (3.4%) | 0/87 (0.0%) | 3/87 (3.4%) |
| silent omissions | 0/87 (0.0%) | 0/87 (0.0%) | 0/87 (0.0%) | 0/87 (0.0%) |
| evidence grounding | 81/86 (94.2%) | 87/87 (100.0%) | 81/85 (95.3%) | 87/87 (100.0%) |
| ambiguity safety | 21/24 (87.5%) | 24/24 (100.0%) | 21/24 (87.5%) | 24/24 (100.0%) |
| clear-input automation | 31/51 (60.8%) | 37/51 (72.5%) | 37/51 (72.5%) | 48/51 (94.1%) |
| justified intervention | 24 | 27 | 24 | 24 |
| unnecessary intervention | 20 | 14 | 14 | 3 |
| Needs You items | 39 | 29 | 30 | 15 |
| Left untouched items | 42 | 30 | 38 | 24 |
| No change items | 6 | 9 | 12 | 9 |
| extra unmatched writes | 1 | 6 | 2 | 10 |
| malformed cases | 0 | 0 | 0 | 0 |
| median latency ms | 1823.5 | 7028 | 2003.5 | 7247 |
| prompt tokens | 68733 | 52734 | 68733 | 52734 |
| completion tokens | 13713 | 18771 | 14024 | 18208 |

## Stage 3 in-memory Apply

| Metric | Simplification | AI-first Gate 2 | Current+4o-mini | AI-first Gate 1 |
| --- | --- | --- | --- | --- |
| material fact recall | 21/21 (100.0%) | 21/21 (100.0%) | 21/21 (100.0%) | 0/0 (n/a) |
| false material facts | 1/21 (4.8%) | 3/21 (14.3%) | 2/21 (9.5%) | 0/0 (n/a) |
| false / unsafe writes | 1/21 (4.8%) | 3/21 (14.3%) | 2/21 (9.5%) | 0/0 (n/a) |
| wrong identity | 0/21 (0.0%) | 0/21 (0.0%) | 0/21 (0.0%) | 0/0 (n/a) |
| silent omissions | 0/21 (0.0%) | 0/21 (0.0%) | 0/21 (0.0%) | 0/0 (n/a) |
| evidence grounding | 21/21 (100.0%) | 21/21 (100.0%) | 20/21 (95.2%) | 0/0 (n/a) |
| ambiguity safety | 5/5 (100.0%) | 4/5 (80.0%) | 5/5 (100.0%) | 0/0 (n/a) |
| clear-input automation | 9/14 (64.3%) | 13/14 (92.9%) | 11/14 (78.6%) | 0/0 (n/a) |
| justified intervention | 5 | 4 | 5 | 0 |
| unnecessary intervention | 5 | 2 | 4 | 0 |
| Needs You items | 7 | 4 | 6 | 0 |
| Left untouched items | 10 | 6 | 8 | 0 |
| No change items | 0 | 3 | 1 | 0 |
| extra unmatched writes | 0 | 2 | 0 | 0 |
| malformed cases | 0 | 0 | 0 | 0 |
| median latency ms | 1833 | 8701.5 | 1527.5 | n/a |
| prompt tokens | 13775 | 10797 | 13775 | 0 |
| completion tokens | 2612 | 4529 | 2866 | 0 |
