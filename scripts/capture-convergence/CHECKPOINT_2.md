# Checkpoint 2 — Deterministic structural fixes

**Source SHA:** `90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b`  
**Contains current main?:** YES  
Production Capture / New Project adapter changed. Corpus and scoring unchanged.

## Result

| | Checkpoint 1 (unchanged) | After deterministic fixes |
| --- | --- | --- |
| Total | 538 | 538 |
| Pass | 526 | **535** |
| Fail | 12 | **3** |

All 3 remaining failures are **product-model gaps** (family C). No A/B/D leftovers on the frozen-envelope corpus.

## Fixes (one family at a time)

| Family | Bucket | Earliest boundary | Fix | Files |
| --- | --- | --- | --- | --- |
| Transcript-wide identity (5) | B | IDENTITY `identityEvidenceText(transcript)` | Observation-local quoted evidence only. Invented evidence fail-closed. Pronoun+two-name evidence still Needs You. | `src/lib/capture-v2/resolve.ts` |
| NP adapter drops names (3) | B | PRESERVE `parseNewProjectV2Envelope` maps accepted only | Recover usable person name from VALIDATE-rejected raw rows as name-only Person. No invented responsibilities. Capture scoped `foreign_id` unchanged. | `src/lib/new-project-v2/parse.ts` |
| Contradictory risk writes (1) | B | PLANNER sibling writes both Ready | Same-record incompatible write payloads → Needs You. Solo resolve still writes. | `src/lib/capture-v2/resolve.ts` |

## Safety floors preserved

- Ambiguity isolation 56/56
- Malformed isolation 70/70
- Identity matrix 13/13
- Held-out 39/39
- Historical regression 17/17
- Person-identity-safety 28/28
- Intelligence diagnostic: Andris stays incomplete; pronoun stays Needs You

## Not fixed (Phase 4)

See `PRODUCT_MODEL_GAPS.md`. Do not code around these.
