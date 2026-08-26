# Lume V1 UX / Magic Patterns convergence

**Workstream C** — target-state clarification. Not the UX overhaul.

| Frozen HEAD | Isolated branch |
| --- | --- |
| `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4` on `cursor/capture-v2-desert-new-project-56c9` | `cursor/v1-convergence-mp-08a0` |

- [Frozen base](./FROZEN_BASE.md)
- [MP retrieval](./MP_RETRIEVAL.md)
- [Unaltered v8 source](./mp-source/PROVENANCE.md)
- [Product surface inventory](./PRODUCT_SURFACE_INVENTORY.md)
- [Design ↔ product mapping](./DESIGN_PRODUCT_MAPPING.md)
- [UX findings](./UX_FINDINGS.md)

---

# PLAIN-ENGLISH CHECKPOINT — FOR THE PRODUCT OWNER

This branch does **not** restyle Lume. It records the live Magic Patterns file you pointed us at, what the shipping V2 product already does, and where those two disagree with the architecture you already chose.

Live design (read-only, unaltered dump in git):  
https://www.magicpatterns.com/c/gekwmrddrt3hkx7f1c9gm8/screens  
**v8 — Knowledge Centre Frame Reordering Cleanup.**  
This file is **Knowledge Centre + compact inspector only.** It does not draw Capture Review, New Project, Desert, Account, Advise, or onboarding.

## 1. What MP artefacts were successfully retrieved

**Live Magic Patterns:** yes.

- Editor `gekwmrddrt3hkx7f1c9gm8`, artifact `30fc8231-32b7-475b-bf5f-d8f6d44c8841`, generating false.
- 21 prototype files exported unaltered to `docs/v1-convergence-mp/mp-source/`.
- Nine canvas screens (resting KC, risk compact, risk more-details, person, connected area, connected decision, to-do, milestone, Needs you).
- Hosted Screenshots were **not** captured (Magic Patterns login). Source + canvas manifest are the reviewable copy.

**Still in git as Ocean visual constitution (parent, not replaced):**

- `docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.png` (19 Aug 2026)
- `LUME_V1_UI_BASELINE_OCEAN.md` + product philosophy

v2 of the live file (“Evolve KC”) is **not** treated as approved.

## 2. Which version/design was treated as latest

**v8 — Knowledge Centre Frame Reordering Cleanup** on the URL above.

Governing earlier prompt in the same file: **v6 Compact Object Inspector** (Ocean locked; inspector is an overlay ~26rem that does not reflow the KC).

v8 is the latest **user surgical pass**: To Do + Risks & blockers as the top operational row; Current Position below; full-width mode bar; directional relationship language; no SOURCE on ordinary Known.

Desert, Capture V2 observation accounting, and New Project categorisation **are not in this MP file**. They exist in the frozen V2 product.

## 3. What was inspected in the existing product

Frozen HEAD including Phase 3B and the Experimental Programme (Capture V2, New Project V2, Desert).

Inspected in code (not a production-data browser dogfood): project shell, Knowledge Centre frames, item drawer, Capture Review (including V2 account line), New Project Talk/Blank/categorisation/review, Account appearance, Ocean/Desert tokens, People/`@person`, History, Tell Me/Ask, Coach leftover, a11y/responsive CSS.

PR **#64 is in ancestry** but not merged to `main`. This PR does not merge #64 or #66.

## 4. MP screens already compatible with V2

These are already largely **in the product**. Do not casually replace them.

- Selected-project shell: Capture / Knowledge Centre / Advise Coming soon as **modes**, not sidebar apps. v8 restores the **full-width** mode bar (inspector must not narrow it).
- Sidebar: projects, + New Project, Master To Do, History, Captures, Account/Help — no Overview.
- Knowledge Centre frames (same ten names): Current position, Risks, To Do, People, Dependencies, Decisions, Important dates, Waiting, Meeting Prep, Timeline.
- Search Knowledge vs ✦ Ask Lume.
- Selectable cards + richer detail (product already has a drawer; MP specifies overlay behaviour).
- `@person` / scoped responsibility language (Owns, Responsible for, Away, Chairs).
- Ocean as a full theme.
- Known looks ordinary; ✦ Lume noticed / Needs you only when relevant.
- Needs you = statement + question; no AI solution menus.

## 5. Missing V2 / Needs-you / current-truth states

**Now drawn in live MP (KC only):** Needs you inspector (Marcus), noticed risk (build stability), compact vs More details, person “why they matter now”, connected navigation, to-do, milestone with semantic dates.

**Still not in this MP file** (product already has several):

- Capture Review as a screen (Apply Ready, Needs you, no-change, commentary, merged, observation accounting).
- Persist/save error, loading, honest empty states (except Dependencies empty copy).
- New Project provisional categorisation.
- Desert.
- First-run onboarding as its own problem.
- A visual distinction that **stops leftover Capture sentences competing with current Risk/date truth** (D-030 is still a product data/UX problem).

The gap for Capture/NP/Desert is “MP never drew them”, not “the product forgot them”.

## 6. New Project V2 mapping

When `LUME_NEW_PROJECT_V2=1`, the product already does:

talk through the mess → provisional buckets (People / Risks / Dates / Todos / Knowledge / not-project) → you correct categories → approve map → existing setup review → real project.

That is the right shape. Blank New Project stays a short form.

Live MP has **no** drawing of this step — only `+ New Project` in the sidebar. Do not invent a long onboarding form and call it the MP target.

## 7. Entity / object UX findings

Keep cards in frames for the list. Open a **compact overlay inspector** when someone needs relationships, evidence, history, or correction. Do not leave KC. Do not build a generic Entity app.

The prototype uses one internal `Entity` grammar, including a future **`issue`** kind. Users see Person / Risk / To do / Issue via labels. **Do not implement Issue. Do not expose the word Entity.**

A future Issue should reuse: stable id, `@person` links, inspector sections (RIGHT NOW, CONNECTED TO, Why, history). It should **not** flatten People into text labels.

## 8. People / relationship implications

Today: a Person is a **project** stakeholder UUID.

Your architecture direction: **workspace** Person identity + **project** participation/responsibility.

MP people (Elena, Marcus, Priya, Sarah) are **project-story demo objects**. The UI language (`Owns`, `Responsible for`, Away, Chairs, Decided by) can survive. What must **not** happen is designing People as throwaway per-project labels or hydrating those demo names into production.

This is an **architecture decision**, not a skin. Flagged, not chosen.

## 9. Current truth vs history UX findings

Users can already be misled **in the current product** (D-030): a Risk can be resolved in the real Risks list while an old sentence still sits in Knowledge.

Live MP helps the **inspector**: ordinary Known does not show SOURCE up front; Why / history sit behind More details. It does **not** fix leftover bullets in the frames.

Recommended convention (no new state model):

- Domain frames = current truth.
- Old Capture wording = evidence in More details / History.
- Needs you = unresolved, not saved truth.
- “Accept as known” in the prototype is **not** a licence to write from the KC — Phase 3B / Capture Review remain the gate.

Architecture sibling should retire leftover bullets; UX should stop giving them equal visual weight.

## 10. Ocean / Desert findings

Ocean stays. This MP file is Ocean-only. Desert is a second coat of paint on the **same** screens (Account → Appearance). No Desert-only layouts found.

The 19 Aug constitution still says “V1 is dark/Ocean only”. The Experimental Programme **accepted Desert**. That is a documentation conflict for you, not a reason to fork the UI or to invent a Desert MP canvas.

Watch later: muted Desert text contrast, leftover light-theme CSS, unused light/dark toggle code.

## 11. Onboarding decisions still required

**Smallest decision:** keep first-run as New Project Talk (what ships today), **or** add one obviously-fake sample project that Capture is forbidden from treating as real people.

Do not build a long setup ceremony. Do not treat New Project V2 categorisation as onboarding. Do not ship the MP Atlas demo as a tutorial project.

## 12. Accessibility / responsive issues

Real ones, on real screens:

- Coach can auto-open over Capture (D-031) — keyboard and first-use failure.
- Knowledge Centre is a wide design; it stacks on laptop/narrow. MP is desktop canvas.
- Overlay inspector (~26rem) must keep the mode bar full width; on narrow, the existing drawer-full-width behaviour should remain.
- Focus-visible, dialog Escape, Capture `aria-live` / `role="alert"`, theme radiogroup: already present in product.
- Collapsed sidebar icon links are thin for screen readers.
- Desert muted text needs a contrast pass.
- `DetailModal` has no focus trap.

Not a generic WCAG project.

## 13. Reusable component opportunities

Keep: project workspace, mode selector, knowledge cards + **existing drawer as the parent** of the compact inspector, `@person`, Capture compact review cards, New Project categorisation, theme picker, CSS variables.

Extract later, after architecture + your frame-order call: overlay inspector behaviour, `TrustMark`, deterministic date popover (UX only), one Frame shell.

Do **not** start a design-system rewrite. Do not port MP Tailwind/framer-motion literally. Do not revive `CaptureBar`.

## 14. Existing UI paths likely to be deleted

- Unmounted light/dark `AppearanceToggle`
- `/coaching` as a place people go (and Coach auto-open)
- Unmounted `CaptureBar` (immediate merge — do not revive) and unwired `TellMePanel`
- Duplicate Timeline embed next to Important dates (**still in live MP as well as the product**)
- Legacy Capture engine **after** you pick V2 (D-032)
- Paste New Project card (already gone from the chooser; Talk still tags paste as `"talk"`)
- Overview (already gone)
- Light theme as a product offering
- Leftover `/memory`, `/meetings`, `/releases` if they stay out of Ocean nav

## 15. Recommended implementation order

1. You confirm v8 as the KC + inspector target, **including** whether To Do + Risks stay the top row.
2. Architecture reconciliation (truth + Person + leftover prose + Waiting + milestone complete). Paint follows.
3. One Capture / New Project engine (D-032).
4. Shared tokens (Ocean + Desert), no screen forks.
5. Evolve the existing drawer toward the compact overlay (do not reflow KC).
6. Stop leftover sentences looking as true as Risks.
7. Capture Review stays compact; show “the rest” only if asked. (No MP screen — follow product.)
8. New Project map visual — behaviour is already there; still no MP drawing.
9. Kill Coach overlay.
10. Only then remaining deltas, screen by screen.

## 16. Visual regression targets for later

Do not screenshot-baseline this UI now. After architecture settles, about twelve states: KC Ocean resting (confirmed frame order), KC Desert (product-only), Risk compact, Risk more-details, Person, Needs you, To Do, Milestone, Capture Review Apply Ready, Capture Review Needs you, NP categorisation, narrow KC with inspector.

## 17. Cross-workstream dependencies

Architecture: current truth, Person schema, leftover prose, Waiting authority, milestone complete, whether “Accept as known” is ever a write.  
Test: Playwright functional net — **no** screenshot farm on this branch.  
UX: will not invent Issue, Advise, Reminders, Area-of-work store, or workspace Person tables ahead of those decisions.

## 18. Risks

- Implementing v8 frame order without confirming it against the 19 Aug constitution and the shipping product.
- Shipping “Accept as known” as a Knowledge Centre write that bypasses Phase 3B.
- Painting a second “source of truth” instead of following canonical-truth.
- Freezing People as per-project demo labels (Elena/Marcus).
- Two Review UIs while both Capture engines live.
- Desert vs “Ocean only” constitution left unresolved.
- Treating MP `Entity` / `issue` / `waiting` / `area` as stores to build.

## 19. Tech debt currently visible

D-030 leftover prose, D-031 Coach overlay, D-032 dual engines, Waiting dual authority, Timeline vs dates (also in live MP), unused light toggle, leftover coaching page, History not fully persisted, Capture V2 off by default.

## 20. Tech debt this design would create, if any

If we copied v8 literally into production: KC “Accept as known” writes, demo people as identity, Issue/Area/Waiting stores, priority dots competing with Risk status, Desert ignored or forked, date popover persisting unsafely, Timeline still duplicated. **That is why this branch does not implement the overhaul.**

## 21. Exact files / artefacts changed

| File | Role |
| --- | --- |
| `docs/v1-convergence-mp/README.md` | This checkpoint |
| `docs/v1-convergence-mp/FROZEN_BASE.md` | SHA / 3B ancestry |
| `docs/v1-convergence-mp/MP_RETRIEVAL.md` | Live retrieval (v8) |
| `docs/v1-convergence-mp/mp-source/` | Unaltered v8 export + provenance |
| `docs/v1-convergence-mp/PRODUCT_SURFACE_INVENTORY.md` | Shipping surfaces |
| `docs/v1-convergence-mp/DESIGN_PRODUCT_MAPPING.md` | Nine screens + inventory vs V2 vs architecture |
| `docs/v1-convergence-mp/UX_FINDINGS.md` | Entity, truth, review, NP, themes, a11y, components |
| `docs/README.md` | Pointer only |

No production React/API/schema changes.

## 22. Recommendation

**Merge this reference pack** so Architecture and Test have a shared UX map against the **live** MP file.  
**Do not** start the visual overhaul from this PR.  
**Do not** reject the pack: the design is now in git, conflicts are flagged, not hidden.

**You still need to:**

1. Confirm v8 frame order (To Do + Risks on top) as the V1 default, or keep Current position first (constitution + shipping product).
2. Choose first-run onboarding (keep New Project vs marked sample).
3. Let Architecture settle Person scope, leftover prose vs current truth, Waiting authority, and that KC “Accept as known” is not a 3B bypass.
4. Acknowledge Desert as additive despite the older “Ocean only” sentence and the Ocean-only MP file.

---

# MP V1 CONVERGENCE VERDICT

**READY WITH PRODUCT-OWNER DECISIONS**

Not “ready to implement the look”. Ready to reconcile, now that live MP is in hand, once you:

1. Confirm v8 (including operational frame order) as the Knowledge Centre + inspector target.
2. Choose first-run onboarding (keep New Project vs marked sample).
3. Let Architecture settle Person scope, current-truth vs leftover prose, Waiting, milestone complete, and the “Accept as known” write boundary — UX will follow, not invent a third model.
4. Acknowledge Desert as additive despite the older “Ocean only” sentence, or tell us to challenge Desert.

**Not chosen:** `READY TO IMPLEMENT AFTER ARCHITECTURE RECONCILIATION` — live MP is retrieved, but frame order, Accept-as-known, Person scope, and missing Capture/NP screens still need you (and Architecture), not a silent paint job.  
**Not chosen:** `NOT READY — DESIGN/ARCHITECTURE CONFLICT FOUND` — conflicts are **flagged** (frame order, Person, leftover prose, Accept as known vs 3B, constitution vs Desert, Waiting, Timeline duplicate), not used as a reason to hide the map.
