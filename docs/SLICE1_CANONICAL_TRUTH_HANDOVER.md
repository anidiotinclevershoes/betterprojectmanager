# Slice 1 Handover — Canonical Truth + Knowledge Centre Foundation

**Branch:** `cursor/slice1-canonical-truth-c9f3`  
**Plan:** `docs/SLICE1_CANONICAL_TRUTH_IMPLEMENTATION_PLAN.md`  
**Date:** 2026-08-18  

---

## Implementation plan

Executed as planned. No blocking architectural issue. Key design choice: keep legacy `sections: string[]` and add optional `structured: CanonicalTruthItem[]` overlay (avoids Capture/UI blast radius).

## Changes made

| Area | Files |
| --- | --- |
| Schema | `supabase/migrations/20260818230000_knowledge_canonical_metadata.sql` — additive columns on `knowledge_items` |
| Types | `src/lib/canonical-truth/*`, `ProjectKnowledge.structured`, `database.ts`, `CreateKnowledgeInput` |
| Load/persist | `load-mission-state.ts`, `persist-mutations.ts`, `repositories.ts` |
| Read path | `serializeCanonicalTruth`, flagged in `buildTellMeContext` / `answerTellMeQuestion` |
| Output | `noticed`, `needsConfirmation` on `TellMeAnswer` + `TELL_ME_SYSTEM_CANONICAL` |
| Confirm owner | `confirmResponsibilityOwner` pure + store + `ConfirmOwnerDialog` in Tell Me UI |
| Entity UI | `PersonEntity`, `EpistemicChip`, `EvidenceReveal`; Knowledge people + structured panel |
| Suggestions | `buildCanonicalSuggestions` merged ahead of legacy (no OpenAI) |
| Flag | `LUME_CANONICAL_TRUTH=1\|0`; evals force ON via `useCanonicalTruth: true` / `forEval` |
| Tests | `npm run verify:canonical-truth` (10 checks) |

**Rollback:** set `LUME_CANONICAL_TRUTH=0` (or leave unset in production — default off). Legacy prompt builder intact.

## Canonical state (Slice 1)

**Authoritative for Q&A when flag ON:**

1. `knowledge.structured[]` items with `lifecycle=current` (responsibilities, epistemic, provenance)
2. Else derived once from legacy section bullets as `epistemic=null` / legacy (no fake “confirmed”)
3. Thin milestones + waiting todos appended
4. History **excluded by default** for current-state questions; included for historical questions

Legacy section strings remain the Capture/display body store. Risk-table unification and snapshot demotion are **out of scope**.

## Knowledge UI foundation

- `@Person · scope` via `PersonEntity` (people table + confirmed responsibilities)
- Sparse `EpistemicChip` (not on confirmed/legacy)
- On-demand `EvidenceReveal` (“Why does Lume think this?”)
- Confirmed responsibilities panel on Knowledge brief
- Tell Me: Answer / Lume noticed / Needs confirmation + Confirm owner

## Deterministic suggestions

`buildCanonicalSuggestions` — template registry over structured responsibilities, milestones, waiting todos. Source-scanned: no OpenAI imports / no `fetch`. Merged first in `TellMeSessionContext`. Project-scoped isolation verified.

## Tell Me / Knowledge Q&A

- Read-only engine; mutations only via `confirmResponsibilityOwner` UI action
- Structured JSON: `answer`, `noticed[]`, `needsConfirmation[]`, `sourceIds`, `confidence`
- Confirmed scoped owner answered **deterministically** from structured truth (no inventing)

## Confirmation flow

Unknown owner → Needs confirmation → Confirm owner → `@Person → scope` confirmed responsibility + people bullet + provenance `user_confirmation` → subsequent “Who owns …?” answers from stored truth; prior unknown/superseded retained in structured history.

## Benchmark

### Offline input estimate (45 cases)

| Path | Est. input tokens |
| --- | --- |
| Legacy Lume | ~44,731 |
| **Canonical Lume** | **~32,006** (~**0.72×** legacy) |
| GPT baseline | ~19,546 |
| Canonical vs GPT | ~**1.64×** (was ~2.29× live) |

System tokens almost unchanged (~424 vs ~432); savings mainly from compact truth + History-by-default off.

### Live run — founder

Agent has no `OPENAI_API_KEY`. Please run Official V1 with label **`Canonical Truth Slice 1`** (`npm run evals:canonical-slice1` or UI) and compare to MODEL TIDY PR37:

| | MODEL TIDY PR37 |
| --- | --- |
| Lume pass | 30/45 |
| GPT pass | 32/45 |
| Trust / critical | 0 / 0 |
| Lume / GPT tokens | 49,157 / 21,470 (~2.29×) |

Expect lower Lume tokens; watch multi-hop completeness.

## Regressions (manual)

- Offline trust/context verifies still green
- Canonical path may answer more narrowly on open synthesis (monitor live)
- Production default remains **legacy** until live run validates

## Remaining duplication (do not fix in Slice 1)

- Risk table ↔ knowledge risks
- Snapshot still exists (not used on canonical hot path)
- People bullets ↔ stakeholders ↔ structured responsibilities can still overlap until Capture writes structured consistently

## Recommendation

### `SLICE 1 SUCCESS — PROCEED TO KNOWLEDGE CENTRE PRODUCT SLICE`

Foundation is in place: flagged canonical read, structured output, confirm-owner loop, deterministic suggestions, additive schema, offline token cut ~28% vs legacy. Enable production default only after live **Canonical Truth Slice 1** confirms trust/critical remain 0.

**Do not autonomously start Slice 2.**
