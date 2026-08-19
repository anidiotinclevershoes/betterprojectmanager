# Lume V1 Reference Pack

**Date:** 19 August 2026  
**Location:** `docs/v1-reference-pack/`

This folder contains the canonical product, UI, development and evaluation references for the next phase of Lume.

## Files

1. **`LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md`**  
   The product constitution: what Lume is, trust model, Capture/Knowledge Centre architecture, V1 scope, current-state strengths/debt, AI/deterministic/human boundaries and Cursor operating principles.

2. **`LUME_V1_UI_BASELINE_OCEAN.md`**  
   The UI contract that accompanies the approved Ocean Knowledge Centre mockup. It records the visual source-of-truth decisions and the functional rules that other V1 screens should inherit.

3. **`LUME_DEVELOPMENT_AND_EVALUATION_ROADMAP_V1.md`**  
   The anti-whack-a-mole development process, workstreams, current benchmark interpretation, longitudinal Lume-vs-GPT evaluation strategy, success measures and stopping/reassessment rules.

4. **`LUME_V1_UI_BASELINE_OCEAN.png`**  
   The approved Knowledge Centre visual baseline. Treat this image as the visual parent for other V1 screens. Functional requirements should be applied as controlled deltas rather than used to redesign the visual language.  
   **Status:** Not yet committed in this pack. Add the approved Ocean mockup binary at this exact path when available; until then, follow `LUME_V1_UI_BASELINE_OCEAN.md` and do not invent a substitute visual source of truth.

## Relationship to other docs

| Document | Role |
| --- | --- |
| This pack | Canonical authority for V1 product philosophy, Ocean UI baseline, and development/evaluation process |
| `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md` | Existing behavioural contract for intelligence/eval work; do not silently replace it — reconcile conflicts by stopping and reporting |
| Historical phase handovers under `docs/` | Context only; prefer this pack for new V1 work |

## How to use this pack with Cursor

Future Cursor tasks should reference these documents rather than restating or reinventing Lume's philosophy.

A useful preamble is:

> This task must comply with `LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md`, `LUME_V1_UI_BASELINE_OCEAN.md`, and `LUME_DEVELOPMENT_AND_EVALUATION_ROADMAP_V1.md`. If the requested implementation conflicts with them, stop and report the conflict rather than silently redefining the product.

Individual tasks should still be narrow and should state the exact problem, evidence, target layer, success condition, non-goals and rollback path.
