# Slice 2C — Knowledge Item Detail & Evidence

**Status:** Implemented  
**Date:** 20 August 2026  
**Authority:** `docs/v1-reference-pack/` + Ocean baseline §12 + prior slice handovers  
**Depends on:** Slice 2B branch (`cursor/slice-2b-capture-ocean-c9f3`) — not yet on main at authoring time  

## Objective

A concise Knowledge card can be selected to reveal why Lume believes it, where it came from, what it relates to, what changed, and how the user can correct it — without a second truth system.

## What changed

- Pure resolver: `src/lib/knowledge-centre/knowledge-item-detail.ts`
  - Stable refs (structured / section / risk / knowledge_risk / todo / person / timeline / unconfirmed_owner)
  - Humanized provenance from stored `ProvenanceEntry` only
  - Current vs superseded via `supersedesId`
  - Person bundle: current / historical / shared
  - Project-scoped resolve (A cannot inspect B)
- UI: `KnowledgeItemDetailDrawer` — Ocean side panel (Escape / backdrop / Close)
- `OceanKnowledgeFrames` wires selectable cards; To Do no longer toggles on card click (toggle lives in drawer)
- Corrections reuse durable store paths: `updateKnowledgeSection`, `updateTodo`, `toggleTodo`, `setRiskStatus`, `setKnowledgeOnlyRiskResolved`, `ConfirmOwnerDialog`
- Drawer surfaces `saveStatus` / `saveError` (D-005 partial)
- Honesty notes when provenance / History may be incomplete (D-004)

## Known Discoveries

| Item | Outcome |
| --- | --- |
| D-023 | **Fixed** → D-R09 |
| D-005 | **Partial** — drawer shows save error; app-wide toast/rollback remains V1 product hardening |
| D-004 | **Partial honesty** — no History rewrite; UI does not invent evidence |
| D-007 | **Partial** — person detail via `getPersonBundle`; Capture promote + People polish remain |
| D-019 | **Deferred** — Confirm Owner still shares by default; replace UI → People UI follow-up |
| D-020 | **Deferred** — structured deps shown only when present |
| D-008 / D-021 | **Deferred** — waiting/todo authority unchanged |

## Non-goals confirmed

No Capture semantics change, Risk/People/Todo/Ask authority change, canonical Ask default flip, Advise, portfolio, graph DB, History rewrite, full save-system redesign, KC visual redesign.

## Verification

```bash
npm run verify:ocean-item-detail
npm run verify:ocean-knowledge-centre
npm run verify:ocean-capture
npm run typecheck
npm test
```

## Recommendation

Knowledge items now have a trustworthy inspection/correction surface. Next: **People & Context UI** (D-019 handover / replace-vs-share) on this foundation. Integrated manual regression is worthwhile after 2A+2B+2C land together — still optional until then if automated suite stays green.
