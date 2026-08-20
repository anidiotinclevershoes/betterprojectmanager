# Slice 2B — Capture Ocean Workspace Integration

**Status:** Implemented  
**Date:** 20 August 2026  
**Authority:** `docs/v1-reference-pack/` + Slice 2A Ocean workspace + Capture trust boundary  
**Depends on:** Slice 2A branch (`cursor/slice-2a-ocean-knowledge-centre-c9f3`) — not yet on main at authoring time  

## Objective

Make Capture a first-class **mode** of the Ocean project workspace (same shell as Knowledge Centre), without changing Capture intelligence, review-before-write, or domain authority.

## What changed

- `CaptureWorkspace` accepts `variant="ocean"` when embedded from `OceanProjectWorkspace`
- Ocean Capture chrome: ✦ Capture title, calm support copy, ✦ Analyse, Minimise/Expand (not window glyphs), review-boundary note
- Shared shell: remove AppearanceToggle; force dark-only V1
- CSS: nested Capture avoids double frame; Ocean surfaces/borders
- Lifecycle unchanged: Analyse → proposals → Approve / Apply Ready / Remember → `applyOne` writes

## Known Discoveries

| Item | Outcome |
| --- | --- |
| D-022 | **Fixed** → D-R08 |
| D-011 | Deferred — Capture hardening (semantics), not UI |
| D-014 | Deferred — Capture V1-ready live/fake persist round-trip |
| D-005 | Deferred — V1 product hardening |
| Dark toggle | Fixed in shared shell (2B) |
| D-025 | **New** — residual §16 discrete visual depth |

## Non-goals confirmed

No Capture prompt/extraction changes, Risk/People/Ask architecture changes, Advise, portfolio, billing, canonical Ask default flip.

## Verification

```bash
npm run verify:ocean-capture
npm run verify:capture-trust-boundary
npm run verify:ocean-knowledge-centre
npm run typecheck
npm test
```

## Recommendation

Capture↔Knowledge Centre now feel like one product shell. Next: People UI (D-019), item detail (D-023), or Capture hardening (D-014/D-011). Integrated manual dogfooding is worthwhile once 2A+2B are on main together.
