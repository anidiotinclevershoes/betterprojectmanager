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
   The anti-whack-a-mole development process, workstreams, evaluation strategy, **test-driven / behaviour-first rules**, Cursor task template, **always-on Plain-English completion voice**, success measures and stopping/reassessment rules.

4. **`LUME_V1_UI_BASELINE_OCEAN.png`**  
   The approved Knowledge Centre visual baseline. Treat this image as the visual parent for other V1 screens. Functional requirements should be applied as controlled deltas rather than used to redesign the visual language.

## Relationship to other docs

This pack is the **product / trust / UI constitution**. It is not replaced by the architecture handoff.

The architecture handoff describes **implementation reality**. It does not replace this constitution.

Start at `docs/README.md` for the full authority map.

| Document | Role |
| --- | --- |
| This pack | Canonical authority for V1 product philosophy, Ocean UI baseline, and development/evaluation process |
| `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` | **CURRENT** implementation architecture map (stores, paths, flags, seams as of Slice 2D / 21 Aug 2026) |
| `docs/LUME_V1_PROJECT_TRUTH_ARCHITECTURE_AUDIT.md` | **HISTORICAL** architecture snapshot from 19 August 2026, before Slices 1A–2D. Keep for original failure analysis. Do **not** use as the current implementation map. |
| `docs/LUME_V1_KNOWN_DISCOVERIES.md` | Living defect/debt authority (open vs resolved) |
| `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md` | Existing behavioural contract for intelligence/eval work; do not silently replace it — reconcile conflicts by stopping and reporting |
| `docs/LUME_TEST_SAFETY_NET_AUDIT.md` | Regression safety-net audit, coverage map, and commands |
| Historical phase/slice handovers under `docs/` | Context only; prefer this pack for product intent and the Current Architecture Handoff for what the code does now |

## How to use this pack with Cursor

Future Cursor tasks should reference these documents rather than restating or reinventing Lume's philosophy.

A useful preamble is:

> This task must comply with `LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md`, `LUME_V1_UI_BASELINE_OCEAN.md`, and `LUME_DEVELOPMENT_AND_EVALUATION_ROADMAP_V1.md`. If the requested implementation conflicts with them, stop and report the conflict rather than silently redefining the product.

Individual tasks should still be narrow and should state the exact problem, evidence, target layer, success condition, non-goals and rollback path.

## Pre-merge checks (deterministic)

Before merging meaningful behaviour changes:

```bash
npm test              # deterministic regression suite (no OpenAI)
npm run typecheck     # tsc --noEmit
```

Optional / separate:

```bash
npm run verify:phase2-persistence   # live Supabase (skips without creds)
npm run verify:tenant-isolation     # live Supabase
npm run verify:evals                # eval harness shape (not live model)
npm run evals:pre-baseline          # live AI benchmark (OpenAI required)
```

Do **not** treat benchmark score, trust=0 alone, or token reduction as proof that product regressions are safe.

See the Development & Evaluation Roadmap for the **test-driven / behaviour-first** Cursor task template and the **always-on Plain-English** standard for every user-facing completion (§19). `AGENTS.md` restates that opening rule so agents apply it even when the prompt is silent.
