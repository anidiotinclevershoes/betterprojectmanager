# Slice 1D — Ask Context Authority Convergence

**Status:** Implemented  
**Date:** 20 August 2026  
**Authority:** `docs/v1-reference-pack/` + project-truth architecture audit + Slices 1A–1C + Known Discoveries  

## Failure class

Ask/Tell Me still had a dual path:

- **Legacy:** Capture-style context with History often competing as current truth
- **Canonical (flagged):** narrower serializer that could invent false “owner not recorded” gaps and collapse multi-owner scopes

Ask needed to consume the same maintained project truth as Knowledge Centre — without flipping production default or redesigning UI.

## What changed

Evolved `serializeCanonicalTruth` into the authoritative Ask assembler (no second truth store):

| Domain | Source in canonical context |
| --- | --- |
| Project metadata | `projects` (name/code/status/focus/objective) |
| Knowledge / facts / decisions | maintained `knowledge_items` / structured + legacy section projection |
| Risks | `risks.status` lifecycle (open/watch for current; closed excluded) |
| People | `stakeholders` person identity |
| Responsibilities | structured `kind=responsibility` (multi-owner + superseded) |
| Todos / waiting | `todos` (open general + WAITING/CHASE) |
| Dates | `timeline` milestones |
| Dependencies / availability | structured Knowledge kinds when present (no new graph/calendar) |
| Ambiguity | **stored** unconfirmed responsibilities only |
| History | evidence block **only** when `questionLooksHistorical` |

Supporting changes:

- `findUnknownOwnerHints` — D-009: never invent gaps from topic-token absence
- Ownership fast-path — D-018: `findConfirmedOwners` multi-owner phrasing
- Historical heuristic expanded for “what changed?”, prior owner, old date, etc.
- History evidence selection scoped by question tokens when practical
- Prompt alignment only: “STORED AMBIGUITIES” / no invent-from-absence (not behaviour tuning)

## Feature flag

`LUME_CANONICAL_TRUTH`:

| Value | Behaviour |
| --- | --- |
| unset | **Production default unchanged: legacy path** (eval/`forEval` still enables canonical) |
| `1` / `true` / `on` | Force canonical assembler |
| `0` / `false` / `off` | Force legacy rollback |

**Production default did not change.** Evidence required before flipping default: Ask UI integration smoke, trust/context-integrity evals on canonical, no scorer-greenwash regressions, product review of residual D-010 legacy path removal plan.

## Non-goals (unchanged)

Ocean UI, Capture interpretation, People UI, Advise, portfolio, vector/agent multi-pass, token optimisation, removing legacy path, enabling canonical as unconditional production default.

## Verification

```bash
npm run verify:ask-context-authority
npm run verify:canonical-truth
npm run verify:knowledge-reconcile
npm run verify:risk-lifecycle
npm run verify:people-entities
npm run verify:project-truth-safety
npm run typecheck
npm test
```

## Known Discoveries

- Fixed: D-009 → D-R06; D-018 → D-R07  
- Partial: D-010 (canonical History rule validated; legacy residual until default flip)  
- Deferred: D-008 (+ D-021 Ask overlap note)  
- Added: D-020 (dependencies/availability under-modelled), D-021 (todo/open-loop Ask overlap)
