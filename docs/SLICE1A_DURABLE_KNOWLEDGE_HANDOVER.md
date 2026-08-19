# Slice 1A — Durable Knowledge Corrections

**Status:** Implemented  
**Date:** 19 August 2026  
**Authority:** `docs/v1-reference-pack/` + project-truth architecture audit  

## Failure class

Knowledge Centre corrections updated MissionState only; Supabase `knowledge_items` were unchanged, so reload restored the previous value.

## Strategy

Reconcile (not wipe/recreate):

1. Load existing `knowledge_items` for the project (section-scoped for `updateKnowledgeSection`).
2. Match desired bullets by exact body, then structured UUID hint, then positional leftover.
3. **UPDATE** matched rows: `body` + `position` only; append `manual_edit` provenance; keep `kind` / `epistemic` / `lifecycle` / `supersedes_id` / `meta`.
4. **INSERT** unmatched desired bullets.
5. **DELETE** unmatched existing rows in reconciled sections only.
6. Do **not** write the `risks` table in this slice.

## Limitation (legacy string sections)

MissionState section arrays have no stable client IDs. An in-place edit at the same index is treated as an UPDATE of that row (identity preserved). Replacing bullet A with unrelated bullet B at the same index therefore keeps A’s row id/metadata — acceptable for Slice 1A; richer identity belongs in later foundation work.

## Non-goals (unchanged)

Risks table / `[Resolved]` authority, People/stakeholders, Confirm Owner, Capture extraction, Ask/Tell Me, canonical flag, UI redesign, Advise, portfolio.
