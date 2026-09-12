# Lume V1 Reference Pack

**Date:** 19 August 2026  
**Location:** `docs/v1-reference-pack/`  
**Role:** Product / trust / Ocean UI / development-evaluation constitution. High-order architectural invariants now live in `docs/LUME_CONSTITUTION.md` and the specialist contracts named from `docs/README.md`.

This folder contains the canonical product, UI, development and evaluation references for Lume V1.

## Files

1. **`LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md`**  
   The product constitution: what Lume is, trust model, Capture/Knowledge Centre architecture, V1 scope, current-state strengths/debt, AI/deterministic/human boundaries and Cursor operating principles.

2. **`LUME_V1_UI_BASELINE_OCEAN.md`**  
   The UI contract that accompanies the approved Ocean Knowledge Centre mockup. It records the visual source-of-truth decisions and the functional rules that other V1 screens should inherit.

3. **`LUME_DEVELOPMENT_AND_EVALUATION_ROADMAP_V1.md`**  
   The anti-whack-a-mole development process, workstreams, evaluation strategy, **test-driven / behaviour-first rules**, Cursor task template, **Plain-English completion-report standard**, success measures and stopping/reassessment rules.

4. **`LUME_V1_UI_BASELINE_OCEAN.png`**  
   The approved Knowledge Centre visual baseline. Treat this image as the visual parent for other V1 screens. Functional requirements should be applied as controlled deltas rather than used to redesign the visual language.

## Relationship to other docs

This pack is the **product / trust / UI constitution**. High-order architectural invariants are in `docs/LUME_CONSTITUTION.md` and the specialist contracts. This pack is not a second current-architecture map.

Implementation reality is the code on current `main`. The 26 Aug architecture memory handoff is historical.

Start at `docs/README.md` for the full authority map.

| Document | Role |
| --- | --- |
| `docs/README.md` | Authority map. Start here. |
| `docs/LUME_CONSTITUTION.md` | Durable high-order product / architecture rules |
| `docs/LUME_CANONICAL_PROJECT_TRUTH.md` | Write-then-project contract |
| `docs/LUME_DURABLE_PROJECT_TRUTH.md` | Existing-project compatibility / migration STOP rules |
| `docs/LUME_CAPTURE_STATUS.md` | Current accepted Capture position |
| This pack | Product philosophy, Ocean UI baseline, development/evaluation process |
| `docs/LUME_V1_KNOWN_DISCOVERIES.md` | Living defect/debt authority (open vs resolved) |
| `docs/LUME_V09_TO_V1_HANDOFF.md` | v0.9 closure operating picture (shipped scope, leftovers, isolation) |
| `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` | **HISTORICAL** 26 Aug desert-era snapshot. Do not start work from it. |
| `docs/LUME_V1_PROJECT_TRUTH_ARCHITECTURE_AUDIT.md` | **HISTORICAL** 19 Aug 2026 snapshot. Keep for original failure analysis. |
| `docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md` | Ask / eval scoring contract; do not silently replace it |
| `docs/LUME_TEST_SAFETY_NET_AUDIT.md` | Regression safety-net audit, coverage map, and commands |
| Historical phase/slice handovers under `docs/` | Context only; prefer this pack for product intent and current `main` for what the code does now |

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

See the Development & Evaluation Roadmap for the **test-driven / behaviour-first** Cursor task template and the **Plain-English** standard for completion reports and checkpoints (§19).
