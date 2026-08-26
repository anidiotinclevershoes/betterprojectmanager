# Lume V1 UX / Magic Patterns convergence

**Workstream C** — target-state clarification. Not the UX overhaul.

| Frozen HEAD | Isolated branch |
| --- | --- |
| `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4` on `cursor/capture-v2-desert-new-project-56c9` | `cursor/v1-convergence-mp-08a0` |

- [Frozen base](./FROZEN_BASE.md)
- [MP retrieval](./MP_RETRIEVAL.md)
- [Unaltered v8 source](./mp-source/PROVENANCE.md)
- [Spiderman amendment — V1 product decisions](./SPIDERMAN_AMENDMENT.md)
- [Product surface inventory](./PRODUCT_SURFACE_INVENTORY.md)
- [Design ↔ product mapping](./DESIGN_PRODUCT_MAPPING.md)
- [UX findings](./UX_FINDINGS.md)

---

# PLAIN-ENGLISH CHECKPOINT — FOR THE PRODUCT OWNER

This branch does **not** restyle Lume. It records the live Magic Patterns file, what the shipping V2 product already does, and the **V1 product decisions** recorded in the [Spiderman amendment](./SPIDERMAN_AMENDMENT.md).

Live design (read-only, unaltered dump in git):  
https://www.magicpatterns.com/c/gekwmrddrt3hkx7f1c9gm8/screens  
**v8 — Knowledge Centre Frame Reordering Cleanup.**  
This file is **Knowledge Centre + compact inspector only.** It does not draw Capture Review, New Project, Desert, Account, Advise, or onboarding.

## 1. What MP artefacts were successfully retrieved

**Live Magic Patterns:** yes.

- Editor `gekwmrddrt3hkx7f1c9gm8`, artifact `30fc8231-32b7-475b-bf5f-d8f6d44c8841`, generating false.
- 21 prototype files exported unaltered to `docs/v1-convergence-mp/mp-source/`. **The dump was not modified by the Spiderman amendment.**
- Nine canvas screens (resting KC, risk compact, risk more-details, person, connected area, connected decision, to-do, milestone, Needs you).
- Hosted screenshots were **not** captured (Magic Patterns login). Source + canvas manifest are the reviewable copy.

**Still in git as Ocean visual constitution (parent, not replaced):**

- `docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.png` (19 Aug 2026)
- `LUME_V1_UI_BASELINE_OCEAN.md` + product philosophy

v2 of the live file (“Evolve KC”) is **not** treated as approved. Ocean-only wording in that baseline is **superseded for V1 themes** by the Spiderman Desert decision.

## 2. Which version/design was treated as latest

**v8 — Knowledge Centre Frame Reordering Cleanup** on the URL above.

Governing earlier prompt in the same file: **v6 Compact Object Inspector** (Ocean locked; inspector is an overlay ~26rem that does not reflow the KC).

**V1 target (Spiderman):** To Dos + Risks at the top; Current Position below. Full-width mode bar; directional relationship language; no SOURCE on ordinary Known.

Desert, Capture V2 observation accounting, and New Project categorisation **are not in this MP file**. They exist in the frozen V2 product. Desert is a decided additive theme; NP Talk is the decided first-run route.

## 3. What was inspected in the existing product

Frozen HEAD including Phase 3B and the Experimental Programme (Capture V2, New Project V2, Desert).

Inspected in code (not a production-data browser dogfood): project shell, Knowledge Centre frames, item drawer, Capture Review (including V2 account line), New Project Talk/Blank/categorisation/review, Account appearance, Ocean/Desert tokens, People/`@person`, History, Tell Me/Ask, Coach leftover, a11y/responsive CSS.

PR **#64 is in ancestry** but not merged to `main`. This PR does not merge #64 or #66.

## 4. MP screens already compatible with V2

These are already largely **in the product**. Do not casually replace them.

- Selected-project shell: Capture / Knowledge Centre / Advise Coming soon as **modes**, not sidebar apps. v8 restores the **full-width** mode bar (inspector must not narrow it). Advise stays parked.
- Sidebar: projects, + New Project, Master To Do, History, Captures, Account/Help — no Overview.
- Knowledge Centre frames (same ten names). **V1 scan order** is To Do + Risks first; Current position below. Shipping product still leads with Current position until a later implementation PR.
- Search Knowledge vs ✦ Ask Lume.
- Selectable cards + richer detail (product already has a drawer; MP specifies overlay behaviour).
- `@person` / scoped responsibility language (Owns, Responsible for, Away, Chairs).
- Ocean as a full theme; Desert additive on the same screens.
- Known looks ordinary; ✦ Lume noticed / Needs you only when relevant.
- Needs you = statement + question; no AI solution menus.

## 5. Missing V2 / Needs-you / current-truth states

**Now drawn in live MP (KC only):** Needs you inspector (Marcus), noticed risk (build stability), compact vs More details, person “why they matter now”, connected navigation, to-do, milestone with semantic dates.

**Still not in this MP file** (product already has several):

- Capture Review as a screen (Apply Ready, Needs you, no-change, commentary, merged, observation accounting).
- Persist/save error, loading, honest empty states (except Dependencies empty copy).
- New Project provisional categorisation (behaviour exists; no MP drawing).
- Desert as a canvas (product has the theme; MP is Ocean-only — **not** a reason to fork screens).
- A visual distinction that **stops leftover Capture sentences competing with current Risk/date truth** (D-030 is still Architecture’s data problem; UX rule is decided).

First-run onboarding is **decided** (New Project Talk), not missing as a product choice.

## 6. New Project V2 mapping

When `LUME_NEW_PROJECT_V2=1`, the product already does:

talk through the mess → provisional buckets (People / Risks / Dates / Todos / Knowledge / not-project) → you correct categories → approve map → existing setup review → real project.

That is the right shape. Blank New Project stays a short form. **V1 first-run = this Talk route.** Do not add a sample project. Do not turn categorisation into a long wizard.

Live MP has **no** drawing of this step — only `+ New Project` in the sidebar.

## 7. Entity / object UX findings

Keep cards in frames for the list. Open a **compact overlay inspector** when someone needs relationships, evidence, history, or correction. Do not leave KC. Do not build a generic Entity app. Do not expose the word Entity.

The prototype uses one internal `Entity` grammar, including a future **`issue`** kind. **Do not implement Issue.** Future rich Issue-like objects remain an extension point only (stable IDs, `@person` links, inspector sections).

## 8. People / relationship implications

**Target direction (Spiderman; not current implementation):** workspace Person identity + project participation/responsibility + stable IDs.

**Today in code:** a Person is a **project** stakeholder UUID. Architecture owns the schema. This workstream does not implement it.

MP people (Elena, Marcus, Priya, Sarah) are **project-story demo objects**. UX language (`Owns`, `Responsible for`, Away, Chairs) can survive. Do not hydrate those demo names into production.

## 9. Current truth vs history UX findings

**V1 UX rule (Spiderman):**

- domain frames show maintained current truth;
- Needs you is unresolved / provisional, not saved truth;
- superseded Capture / prose belongs in History / evidence / detail;
- old prose must not visually compete as equivalent current truth.

Users can already be misled **in the current product** (D-030). Live MP helps the inspector (SOURCE off ordinary Known; Why/history behind More details). Architecture still owns leftover bullets as data.

**“Accept as known”:** prototype wording is not a KC write licence. If the control survives, it may only resolve an already structured / provisional / Needs-you item through the safe mutation / review path. Architecture owns that path. No second KC mutation architecture.

## 10. Ocean / Desert findings

**V1 decided:** Ocean remains supported. Desert is additive. Same screens, components, semantic states. No theme-specific forks.

The 19 Aug constitution “V1 is dark/Ocean only” is **superseded**. The live MP file is Ocean-only; that does not forbid Desert in product.

Watch later: muted Desert text contrast, leftover light-theme CSS, unused light/dark toggle code.

## 11. Onboarding — decided for V1

**Retain New Project Talk as the first-run route.** Do not introduce a fake / sample / tutorial project in V1. Do not treat New Project V2 categorisation as a separate onboarding product. Do not ship the MP Atlas demo as a tutorial project.

## 12. Accessibility / responsive issues

Real ones, on real screens:

- Coach auto-open over Capture (D-031) — **V1: Coach leaves the active shell**; do not redesign it here.
- Knowledge Centre is a wide design; it stacks on laptop/narrow. MP is desktop canvas. V1 top row is two frames (To Do + Risks).
- Overlay inspector (~26rem) must keep the mode bar full width; on narrow, the existing drawer-full-width behaviour should remain.
- Focus-visible, dialog Escape, Capture `aria-live` / `role="alert"`, theme radiogroup: already present in product.
- Collapsed sidebar icon links are thin for screen readers.
- Desert muted text needs a contrast pass.
- `DetailModal` has no focus trap.

Not a generic WCAG project.

## 13. Reusable component opportunities

Keep: project workspace, mode selector, knowledge cards + **existing drawer as the parent** of the compact inspector, `@person`, Capture compact review cards, New Project categorisation, theme picker, CSS variables.

Extract later, after architecture reconciliation: overlay inspector behaviour, `TrustMark`, deterministic date popover (UX only), one Frame shell.

Do **not** start a design-system rewrite. Do not port MP Tailwind/framer-motion literally. Do not revive `CaptureBar`.

## 14. Existing UI paths likely to be deleted

- Coach in the active V1 shell (auto-open overlay, `/coaching`, unmounted `HeaderCoachButton`) — **decided removal / deprecation** unless later reactivated. Advise stays parked.
- Unmounted light/dark `AppearanceToggle`
- Unmounted `CaptureBar` was **deleted in Slice 1A**. Unwired `TellMePanel` remains.
- Timeline **as a date authority**. If retained, it is a projection over milestone/date data; otherwise a deletion candidate after MP implementation
- Legacy Capture engine **after** D-032 chooses V2
- Paste New Project card (already gone from the chooser; Talk still tags paste as `"talk"`)
- Overview (already gone)
- Light theme as a product offering
- Leftover `/memory`, `/meetings`, `/releases` if they stay out of Ocean nav

## 15. Recommended implementation order

1. Architecture reconciliation (truth store, Person schema, leftover prose, Waiting authority, milestone complete, Accept-as-known mutation path). Paint follows.
2. Apply **v8 frame order** (To Do + Risks top; Current Position below) on existing frames.
3. One Capture / New Project engine (D-032).
4. Shared tokens (Ocean + Desert), no screen forks.
5. Evolve the existing drawer toward the compact overlay (do not reflow KC).
6. Stop leftover sentences looking as true as Risks (depends on Architecture for data).
7. Capture Review stays compact; show “the rest” only if asked. (No MP screen — follow product.)
8. New Project map visual — behaviour is already there; still no MP drawing. First-run remains Talk.
9. Remove Coach from the active V1 shell (do not redesign).
10. Timeline: keep only as a projection, or delete if it adds no V1 value.
11. Only then remaining deltas, screen by screen.

## 16. Visual regression targets for later

Do not screenshot-baseline this UI now. After architecture settles, about twelve states: KC Ocean resting **in v8 order**, KC Desert (same screens), Risk compact, Risk more-details, Person, Needs you, To Do, Milestone, Capture Review Apply Ready, Capture Review Needs you, NP categorisation, narrow KC with inspector.

## 17. Cross-workstream dependencies

Architecture: current-truth store, Person schema, leftover prose as data, Waiting authority, milestone complete, exact “Accept as known” mutation path.  
Test: Playwright functional net — **no** screenshot farm on this branch.  
UX: will not invent Issue, Advise, Reminders, Area-of-work store, or workspace Person tables on this branch.

## 18. Risks

- Shipping “Accept as known” as a Knowledge Centre write that bypasses Capture / Review / Phase 3B.
- Painting leftover prose as peer current truth instead of following canonical-truth.
- Freezing People as per-project demo labels (Elena/Marcus) instead of waiting for workspace Person.
- Two Review UIs while both Capture engines live (D-032).
- Letting Timeline become a second date store.
- Treating MP `Entity` / `issue` / `waiting` / `area` as stores to build.
- Redesigning Coach instead of removing it from the V1 shell.

## 19. Tech debt currently visible

D-030 leftover prose, D-031 Coach overlay (now a V1 removal candidate), D-032 dual engines, Waiting dual authority, Timeline vs dates (also in live MP), unused light toggle, leftover coaching page, History not fully persisted, Capture V2 off by default.

## 20. Tech debt this design would create, if any

If we copied v8 literally into production **against** the Spiderman rules: KC “Accept as known” writes, demo people as identity, Issue/Area/Waiting stores, leftover prose competing with Risks, Desert ignored or forked, date popover persisting unsafely, Timeline as a second authority. **That is why this branch does not implement the overhaul.**

## 21. Exact files / artefacts changed

| File | Role |
| --- | --- |
| `docs/v1-convergence-mp/README.md` | This checkpoint |
| `docs/v1-convergence-mp/SPIDERMAN_AMENDMENT.md` | V1 product decisions (this amendment) |
| `docs/v1-convergence-mp/FROZEN_BASE.md` | SHA / 3B ancestry |
| `docs/v1-convergence-mp/MP_RETRIEVAL.md` | Live retrieval (v8) |
| `docs/v1-convergence-mp/mp-source/` | Unaltered v8 export — **untouched by this amendment** |
| `docs/v1-convergence-mp/PRODUCT_SURFACE_INVENTORY.md` | Shipping surfaces |
| `docs/v1-convergence-mp/DESIGN_PRODUCT_MAPPING.md` | Nine screens + inventory vs V2 vs architecture |
| `docs/v1-convergence-mp/UX_FINDINGS.md` | Entity, truth, review, NP, themes, a11y, components |
| `docs/README.md` | Pointer only |

No production React/API/schema changes.

## 22. Recommendation

**This reference pack is ready for the lead merge workflow** (Architecture/Test share the live MP map plus decided V1 rules).  
**Do not** start the visual overhaul from this PR.  
**Do not merge from this workstream.**

Product-owner scan-order, onboarding, Desert, Accept-as-known UX rule, Timeline rule, Coach/Advise, current-truth chrome, and People/Entity direction are **recorded**. Remaining work is Architecture reconciliation and later implementation PRs — not more silent UX choices.

---

# MP V1 CONVERGENCE VERDICT

**READY TO IMPLEMENT AFTER ARCHITECTURE RECONCILIATION**

Not “ready to paint from this PR”. Ready for a later implementation stream **after** Architecture settles the store, Person schema, leftover prose, Waiting, milestone complete, and the Accept-as-known mutation path.

**Not chosen:** `READY WITH PRODUCT-OWNER DECISIONS` — the Spiderman items that were blocking UX are now decided.  
**Not chosen:** `NOT READY — DESIGN/ARCHITECTURE CONFLICT FOUND` — remaining gaps are Architecture-owned or deferred implementation judgment (Timeline keep-as-projection vs delete after MP implementation), not hidden design conflicts.
