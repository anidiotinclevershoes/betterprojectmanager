# Slice 2D — People & Context UI

**Status:** Implemented  
**Date:** 20 August 2026  
**Authority:** `docs/v1-reference-pack/` + Slice 1C People + Slice 2C detail drawer  
**Base:** `main` (2A–2C merged)

## Objective

Make People & Context use the durable People model: stable identities, shared ownership, explicit share-vs-replace handover, historical responsibilities, and structured availability — without redesigning People authority.

## What changed

- `ConfirmOwnerDialog`: when other current owners exist, **Needs you** share vs replace choice; replace targets a specific owner via `replacePersonId`
- Pure helpers: `src/lib/people/confirm-owner-choice.ts`
- People frame (`buildPeopleRows`): durable stakeholder rows; Shared label; availability/waiting meta when trustworthy
- Person detail (2C drawer): assign ownership, per-scope hand over, waiting lines, legacy notes, availability, dependencies only when named
- Save-error surface retained on Confirm Owner (D-005 partial)

## Known Discoveries

| Item | Outcome |
| --- | --- |
| D-019 | **Fixed** → D-R10 |
| D-007 | **Partial** — UI convergence done; Capture promote remains Capture hardening |
| D-020 | **Partial** — structured availability displayed; Ask/ingestion modelling remains |
| D-004 | Deferred — honesty notes only |
| D-005 | Partial — confirm/drawer surfaces; app-wide remains V1 product hardening |
| D-008 / D-021 | Deferred — not solved opportunistically |

## Non-goals confirmed

No Capture semantics, Risk/Todo/Ask authority, canonical default flip, CRM/rota/calendar, portfolio, Advise, History rewrite, app-wide save redesign.

## Verification

```bash
npm run verify:people-context-ui
npm run verify:people-entities
npm run verify:ocean-item-detail
npm run typecheck
npm test
```

## Recommendation

People & Context is V1-usable for inspection, shared ownership, and explicit handover. D-019 closed. D-007 Capture promotion still open. Integrated manual regression (New Project → Capture → KC → Person share/replace → Ask → reload) is now worthwhile.
