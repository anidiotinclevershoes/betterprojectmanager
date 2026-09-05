# Spiderman amendment — V1 product decisions

**Date:** 26 August 2026  
**PR:** #67  
**Branch:** `cursor/v1-convergence-mp-08a0`  
**Scope:** documentation / reference only. No production UI. No Magic Patterns source edits. No merge.

These decisions **supersede** earlier “unresolved PO” flags in this pack. They do **not** implement schema, Capture, or screens.

The unaltered v8 dump in `docs/v1-convergence-mp/mp-source/` was **not** modified.

## 1. V8 frame order — approved

V1 Knowledge Centre target order:

- **To Dos + Risks** prioritised at the top;
- **Current Position** below them.

Treat as the V1 target unless later implementation or usability testing materially challenges it. Shipping product and the 19 Aug PNG still lead with Current position; that is **current implementation / older constitution**, not the V1 target.

Do not treat v6’s “do not create a permanent type ranking” as a veto of this scanning hierarchy. It remains a V1 default scan order, not a claim that these types outrank a future Issue forever.

## 2. V1 first-run onboarding — decided

Retain **New Project Talk** as the first-run route.

Do **not** introduce a fake / sample / tutorial project in V1. Do not hydrate MP Atlas demo people into production.

New Project V2 should deliver “organised my mess” without becoming a long setup wizard. Categorisation is not a separate onboarding product.

## 3. Desert — decided

Ocean remains supported. Desert is **additive**. Both use the same screens, components, and semantic states. No theme-specific screen forks.

The Ocean-only wording in older design authority (`LUME_V1_UI_BASELINE_OCEAN.md` §3) is **superseded** by this V1 decision. The live MP file remaining Ocean-only does not forbid Desert in product.

## 4. “Accept as known” — decided (UX rule); Architecture owns the path

Do **not** treat the MP prototype wording as permission for arbitrary Knowledge Centre writes.

If an “Accept as known” interaction survives into V1, it may **only** resolve an already structured / provisional / Needs-you item through the appropriate **safe product mutation / review path**.

It must not:

- promote arbitrary prose directly into maintained truth;
- bypass Capture / Review safety;
- create a second KC mutation architecture.

Architecture owns the exact implementation boundary (Phase 3B / Capture Review / existing apply). This workstream does not invent that path.

## 5. Timeline — decided

> **Later product decision (5 September 2026):** Timeline **remains** a projection of dated project truth and may later grow an Add action that writes canonical records. The legacy writable Gantt is retired from the intended product (hide the surface; do not delete data/helpers until proven unused). See `docs/LUME_V09_TO_V1_HANDOFF.md` §3. Do not treat the older “deletion candidate” line below as a licence to remove Timeline, and do not keep Gantt as a second store.

Timeline must **never** become another date authority.

If retained: **Timeline is a projection / view over authoritative milestone / date data.**

If it provides no distinct V1 value after MP implementation, it is a **deletion candidate**. Do not duplicate Important dates as a second store.

## 6. Coach / Advise — decided

Advise is **parked** for V1 (Coming soon stays Coming soon).

Coach should **leave the active V1 shell**, including the known auto-open overlay (D-031). Do not redesign Coach in this workstream.

Existing coaching surfaces (`CoachDrawer`, `/coaching`, unmounted `HeaderCoachButton`) are **removal / deprecation candidates** unless later explicitly reactivated.

## 7. Current truth / evidence — decided (UX rule)

Strengthen and keep:

- domain frames show **maintained current truth**;
- Needs you is **unresolved / provisional**, not saved truth;
- superseded Capture / prose belongs in History / evidence / detail;
- old prose must **not** visually compete as equivalent current truth.

Architecture still owns leftover-prose as a **data** problem (D-030) and canonical-truth unification. UX must not paint leftover bullets as peer current-truth cards.

## 8. People / Entity — target direction, not current implementation

Keep as **target direction** (do not implement schema/UI on this branch):

- workspace Person identity;
- project participation / responsibility;
- stable IDs;
- no generic Entity UI;
- no exposure of “Entity” as product terminology;
- future rich Issue-like objects remain an **extension point only**.

Current code remains project-scoped stakeholders. Architecture owns the schema. UX language (`@person`, Owns, Away) can survive.
