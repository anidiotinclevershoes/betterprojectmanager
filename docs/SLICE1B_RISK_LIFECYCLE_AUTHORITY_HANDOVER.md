# Slice 1B — Risk Lifecycle Authority

**Status:** Implemented  
**Date:** 19 August 2026  
**Authority:** `docs/v1-reference-pack/` + project-truth architecture audit + Slice 1A/1A.1  

## Failure class

Resolving a genuine Risk updated Knowledge prose (`[Resolved] …`) but left `risks.status` open/watch. On Supabase reload, open/watch rows were folded back into Knowledge and the Risk reappeared.

## Authority rule

- **`risks` table / `MissionState.risks`** is the lifecycle authority for genuine Risk records (`open | watch | resolved | accepted`).
- Knowledge Centre **projects** open Risk titles for Capture/Tell Me/KC display.
- Recommendations of kind `risk` remain suggestions until explicitly converted via existing add behaviour — they are not maintained Risks.
- Legacy Knowledge-only risk bullets (no matching `risks` row) may be resolved in Knowledge without fabricating a Risk-domain history.

## Strategy

1. Load all `risks` into `MissionState.risks` with stable UUIDs.
2. Fold only `open`/`watch` titles into Knowledge (unchanged skip of resolved/accepted).
3. RiskFrame prefers domain rows by `risks.id`; Knowledge-only bullets are residual.
4. Resolve/reopen genuine Risks via `setRiskStatus` → `persistRiskStatus` + Knowledge projection sync (remove/restore title — not `[Resolved]` as authority).
5. New Risk adds (frame / Capture) mint a client UUID and dual-write `knowledge_items` + `risks` with that id.
6. Capture complete uses **exact title match** against domain risks only (no fuzzy matching).

## Migration

None. Schema already had `risks.status`.

## Non-goals (unchanged)

People/stakeholders, Confirm Owner UUID, Capture interpretation redesign, Ask/Tell Me, canonical flag, Ocean UI redesign, Advise, portfolio.

## Verification

```bash
npm run verify:risk-lifecycle
npm run verify:knowledge-reconcile
npm run verify:project-truth-safety
npm run typecheck
npm test
```

## Adjacent discoveries

Not fixed in this slice — tracked in `docs/LUME_V1_KNOWN_DISCOVERIES.md` (e.g. D-001 Confirm Owner UUID, D-003 suggestion persist, D-006 `source: "setup"`, D-015 historical `[Resolved]` open rows).
