# Slice 1A — Durable Knowledge Corrections

**Status:** Implemented (+ Slice 1A.1 Stable Knowledge Identity)  
**Date:** 19 August 2026 (1A); 24 July 2026 (1A.1 stable identity)  
**Authority:** `docs/v1-reference-pack/` + project-truth architecture audit  

## Failure class (1A)

Knowledge Centre corrections updated MissionState only; Supabase `knowledge_items` were unchanged, so reload restored the previous value.

## Strategy (1A)

Reconcile (not wipe/recreate):

1. Load existing `knowledge_items` for the project (section-scoped for `updateKnowledgeSection`).
2. Match desired bullets (see 1A.1 identity rules below).
3. **UPDATE** matched rows: `body` + `position` only; append `manual_edit` provenance; keep `kind` / `epistemic` / `lifecycle` / `supersedes_id` / `meta`.
4. **INSERT** unmatched desired bullets (empty metadata — never inherit from an unrelated prior row).
5. **DELETE** unmatched existing rows in reconciled sections only.
6. Do **not** write the `risks` table in this slice.

## Slice 1A.1 — Stable Knowledge Identity

**Failure class:** Same list/index position was treated as semantic identity, so an unrelated replacement (or a shifted neighbour after delete) could inherit the previous row’s id, provenance, kind, epistemic status, lifecycle, and supersession links.

**Rule:** Never use array index alone as semantic identity.

**Matching order (per section):**

1. Exact body match (order-independent) — covers reorder and unchanged lines.
2. Stable id from `sectionItemIds` / structured UUID when present.
3. Unique deterministic wording-edit pairs among leftovers (`isLikelyWordingEdit` / Jaccard + prefix overlap) — covers genuine corrections.
4. Otherwise INSERT new + DELETE unmatched — prefer safe loss of inferred identity over incorrect metadata transfer.

**Client path:** Load always populates `sectionItemIds` (and structured) from `knowledge_items`. Knowledge Edit Save aligns ids via `alignSectionItemIds` before `replaceKnowledge` / reconcile.

**Legacy string-only knowledge:** Without persistent ids and without enough wording overlap, an edit may create a new row rather than update the old one. That is intentional and safer than transferring metadata.

## Non-goals (unchanged)

People/stakeholders, Confirm Owner, Capture extraction, Ask/Tell Me, canonical flag, UI redesign, Advise, portfolio.

Risks table / `[Resolved]` authority → addressed in Slice 1B (`docs/SLICE1B_RISK_LIFECYCLE_AUTHORITY_HANDOVER.md`).

## Verification

```bash
npm run verify:knowledge-reconcile
npm run verify:project-truth-safety
npm run typecheck
```
