# Slice 1C — Durable People Entities & Scoped Relationships

**Status:** Implemented  
**Date:** 19 August 2026  
**Authority:** `docs/v1-reference-pack/` + project-truth architecture audit + Known Discoveries  

## Failure class

People identity and Confirm Owner were split and fragile:

- Confirm Owner minted non-UUID `resp-*` responsibility ids (D-001)
- Newly confirmed people were not persisted to `stakeholders` (D-002)
- Confirming a second owner for the same scope silently superseded the first (blocked shared ownership)
- No deterministic person-centred retrieval helper

## Authority model (V1)

| Concern | Home |
| --- | --- |
| Person identity | `stakeholders` (project-scoped UUID) |
| Scoped responsibility | `knowledge_items` `kind=responsibility` with `meta.responsibility.personId` |
| Shared ownership | Multiple **current** responsibility rows for the same scope, different personIds |
| Time-varying ownership | Explicit `replacePersonId` / `resolveTruthItemId` → prior row `lifecycle=superseded` |
| People Knowledge display | Prose projection `"Name — scope"` (compatibility); not identity authority |
| Availability (prepared) | Structured `kind=availability` + `AvailabilityMeta.personId` — not a calendar subsystem |

**No schema migration.** Existing `stakeholders` + knowledge canonical metadata columns suffice.

## Confirm Owner behaviour

- Default = **add/share** (does not supersede other current owners of the same scope)
- Explicit replacement via `replacePersonId` (and/or `resolveTruthItemId`)
- Reuses exact person id/name within project; never fuzzy-merges “Ava Chen” and “Ava Smith”
- Persists stakeholder via `persistEnsureStakeholder` then responsibility bullet + lifecycle updates

## Person-centred retrieval

`getPersonBundle(state, projectId, personId)` returns identity, current/historical responsibilities, shared scopes, linked availability (if present), and matching legacy people bullets — without scanning unrelated project prose.

## Non-goals (unchanged)

Ocean People UI redesign, Capture interpretation, Ask rebuild, Risk authority, RACI, CRM, calendar, Advise, portfolio.

## Verification

```bash
npm run verify:people-entities
npm run verify:knowledge-reconcile
npm run verify:risk-lifecycle
npm run verify:project-truth-safety
npm run typecheck
npm test
```

## Known Discoveries

- Fixed: D-001, D-002 → D-R04, D-R05  
- Partial: D-007 (foundation done; Capture promote / UI remain)  
- Added: D-018 (Tell Me multi-owner answers), D-019 (Confirm Owner replace UI)  
