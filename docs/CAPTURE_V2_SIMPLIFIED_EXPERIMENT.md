# Capture V2 — Simplified layout experiment

**Status:** Experiment (opt-in)  
**Date:** 25 August 2026  
**Authority:** `docs/v1-reference-pack/` (Capture review-before-write, Ocean shell)  
**Does not replace Classic Capture.**

## Problem

Classic Capture is a working write/propose surface, but the compose and review chrome is heavy: multi-block notes, a Best Practice sidebar, a second “What Lume Understood” list, usage meter, and dense change cards for items that are already Ready. New Capture can also restore the previous transcript because classic compose keeps a local block list that can push back into session content.

## Failure class / layer

UI / trust-workflow — presentation only. Not Capture interpretation, not apply mutation boundary, not persistence.

## Proposed correction (experiment)

A **Simplified** layout behind `Classic | Simplified (experiment)`:

- one textarea bound directly to the Capture session (New Capture actually clears);
- Record + ✦ Analyse, no Best Practice panel, no in-Capture usage meter;
- after Analyse: collapsed “Your note”, counts `ready · need review · needs you`;
- Needs you / Needs review keep the existing correction cards;
- Ready items are dense Approve / Dismiss rows plus **Apply ready**;
- Remember-for-later stays;
- same `analyse` → review → `applyOne` pipeline.

Default remains **Classic**. Preference is `localStorage` key `lume-capture-layout-experiment-v1`. Switching layouts does not change an in-flight session’s findings.

## Success condition

A PM can Capture → Analyse → review Ready vs Needs you → approve, with less chrome, without silent writes. Classic remains one click away.

## Non-goals

No Capture prompt/extraction/apply changes. No Phase 3D session-table authority. No Knowledge Centre / Ask / Coach changes. D-025 Classic §16 visual depth is **not** claimed fixed. D-013 session durability is **not** claimed fixed (only the compose-block restore bug is avoided on the Simplified path).

## Regression guard

Classic Capture, Ocean mode embed, review-before-write, and `applyOne` stay the product path unless Simplified is chosen.

## Rollback

Choose **Classic**, or clear `lume-capture-layout-experiment-v1`. Delete the simplified components to remove the experiment.

## Verification

```bash
npm run verify:capture-v2-simplified
npm run verify:ocean-capture
npm run verify:capture-trust-boundary
npx tsc --noEmit
npm test
```
