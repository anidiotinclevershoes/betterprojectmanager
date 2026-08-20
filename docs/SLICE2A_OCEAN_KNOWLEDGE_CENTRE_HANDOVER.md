# Slice 2A — Knowledge Centre Ocean UI Baseline

**Status:** Implemented  
**Date:** 20 August 2026  
**Authority:** `docs/v1-reference-pack/` (Ocean image + UI baseline) + Slices 1A–1D + Known Discoveries  

## Rule

**Image leads; requirements constrain.**

The approved Ocean Knowledge Centre mockup is the visual parent. This slice implements that screen as the selected-project workspace without redesigning Lume from prose requirements.

## What changed

- Project page is now the Ocean Knowledge Centre workspace by default
- Sidebar: Projects + green `+ New Project`, Master To Do, History, Captures, Account/Help — no Overview / Knowledge / Coaching / mode destinations / health dots
- Compact intelligence strip (truthful counts) + ✦ Refresh + non-button actions-left pill
- Mode selector: Capture (AI glyph) / Knowledge Centre (selected) / Advise Coming soon
- Search Knowledge (deterministic) vs ✦ Ask Lume (existing Tell Me session / flag-respecting)
- Quiet suggested questions
- Three large primary frames (Current position, Risks & blockers, To Do) + secondary frames via scroll
- Risks from `risks.status`; People from stakeholders + responsibilities; Todos from todo domain
- Home `/` with projects redirects into first project Knowledge Centre
- New `/todos` Master To Do page

## Explicitly deferred

| Item | Target |
| --- | --- |
| D-019 Confirm Owner replace UI | People UI follow-up before V1 launch |
| Rich person / item drawers (D-007 remainder, D-023) | People / item-detail UI follow-ups |
| Full Ocean Capture chrome (D-022) | Capture Ocean UI follow-up |
| Dependency graph / availability calendar (D-020) | Later domain modelling |
| Todo vs open-loop authority (D-021 / D-008) | Open-loop architecture slice |
| Canonical Ask production default (D-010 residual) | After Ask UI integration evidence |
| Billing-grade actions meter (D-024) | Billing/entitlement |

## Non-goals confirmed

No Capture interpretation change, Risk/People/Ask authority change, Advise build, portfolio Overview, light-mode project, billing/auth changes, canonical flag flip.

## Verification

```bash
npm run verify:ocean-knowledge-centre
npm run typecheck
npm test
```

## Recommendation

Ocean Knowledge Centre baseline is in place for integrated manual dogfooding after Capture Ocean polish and/or item-detail follow-ups. Next useful slices: People UI (D-019/D-007), item detail (D-023), or Capture Ocean UI (D-022).
