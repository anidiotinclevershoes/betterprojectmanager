# Lume V1 UX / Magic Patterns convergence

**Workstream C** — target-state clarification. Not the UX overhaul.

| Frozen HEAD | Isolated branch |
| --- | --- |
| `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4` on `cursor/capture-v2-desert-new-project-56c9` | `cursor/v1-convergence-mp-08a0` |

- [Frozen base](./FROZEN_BASE.md)
- [MP retrieval](./MP_RETRIEVAL.md)
- [Product surface inventory](./PRODUCT_SURFACE_INVENTORY.md)
- [Design ↔ product mapping](./DESIGN_PRODUCT_MAPPING.md)
- [UX findings](./UX_FINDINGS.md)

---

# PLAIN-ENGLISH CHECKPOINT — FOR THE PRODUCT OWNER

This branch does **not** restyle Lume. It records what design we could actually get hold of, what the shipping V2 product already does, and where those two disagree with the architecture you already chose.

The important limitation is at the top: **we could not open your latest Magic Patterns file.** The plugin can talk to Magic Patterns, but only if we already know the link. There is no “list my Lume designs” tool, and nothing in this git repo stores an editor URL. So this pack does **not** pretend we saw a newer mockup.

## 1. What MP artefacts were successfully retrieved

**Live Magic Patterns designs: none.**

**In git, versioned and reviewable:**

- The approved Ocean Knowledge Centre image: `docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.png` (uploaded 19 Aug 2026).
- The written UI contract that goes with it: `LUME_V1_UI_BASELINE_OCEAN.md`.
- The product constitution: `LUME_PRODUCT_INTELLIGENCE_PHILOSOPHY_V1.md`.
- Older product screenshots under `docs/current-state/` (11 Aug, pre-Ocean) and later seam packs (intelligence header, Tell Me). Those are history, not the V1 parent.

## 2. Which version/design was treated as latest

**Not claimed as latest live MP.**

Used only as the **last versioned visual constitution in the repository**: the 19 Aug Ocean Knowledge Centre PNG + UI baseline.

Desert, Capture V2 observation accounting, and New Project categorisation **are not in that PNG**. They landed on this frozen V2 branch later (25 Aug).

If you have a newer Magic Patterns canvas, paste the `magicpatterns.com/c/…` link and this mapping should be redone against that file — not against memory.

## 3. What was inspected in the existing product

Frozen HEAD including Phase 3B and the Experimental Programme (Capture V2, New Project V2, Desert).

Inspected in code (not a production-data browser dogfood): project shell, Knowledge Centre frames, item drawer, Capture Review (including V2 account line), New Project Talk/Blank/categorisation/review, Account appearance, Ocean/Desert tokens, People/`@person`, History, Tell Me/Ask, Coach leftover, a11y/responsive CSS.

PR **#64 is in ancestry** but not merged to `main`. This PR does not merge #64 or #66.

## 4. MP screens already compatible with V2

Using the 19 Aug constitution (live MP unknown):

- Selected-project shell: Capture / Knowledge Centre / Advise Coming soon as **modes**, not sidebar apps.
- Sidebar: projects, + New Project, Master To Do, History, Captures, Account — no Overview.
- Knowledge Centre primary trio: Current position, Risks & blockers, To Do; more frames by scroll.
- Search Knowledge vs ✦ Ask Lume.
- Selectable cards + richer detail (the product already has a drawer).
- `@person · scoped responsibility` language.
- Ocean as a full theme.

Those are already largely **in the product**. They are the parts you should not casually replace.

## 5. Missing V2 / Needs-you / current-truth states

Not in the 19 Aug PNG (and live MP unknown):

- Capture Review as a screen (Apply Ready, Needs you, no-change, commentary, merged, observation accounting).
- Persist/save error, loading, honest empty states.
- New Project provisional categorisation.
- Desert.
- First-run onboarding as its own problem.
- A visual distinction between **current Risk/date truth** and **old Capture sentences**.

The **shipping UI** already has several of those states (V2 account line, Needs you, save-error). The gap is “MP never drew them”, not “the product forgot them”.

**Needs you is not missing as a product idea.** It is missing as a designed MP screen.

## 6. New Project V2 mapping

When `LUME_NEW_PROJECT_V2=1`, the product already does:

talk through the mess → provisional buckets (People / Risks / Dates / Todos / Knowledge / not-project) → you correct categories → approve map → existing setup review → real project.

That is the right shape: fast “organised my mess”, not a wizard. Blank New Project stays a short form.

The 19 Aug MP/PNG has **no** drawing of this step. Do not invent a long onboarding form and call it the MP target.

## 7. Entity / object UX findings

Keep cards in frames for the list. Open a **drawer** when someone needs relationships, evidence, history, or correction. Do not build a generic Entity app.

A future Issue/JIRA-like object should reuse: stable id, `@person` links, drawer sections (status, people, dates, risks, decisions, todos, evidence). It should **not** flatten People into text labels.

## 8. People / relationship implications

Today: a Person is a **project** stakeholder UUID.

Your architecture direction: **workspace** Person identity + **project** participation/responsibility.

The UI already speaks `@Ava · UX sign-off` and Confirm Owner (share vs replace). That language can survive. What must **not** happen is designing People as throwaway per-project labels.

This is an **architecture decision**, not a skin. Flagged, not chosen.

## 9. Current truth vs history UX findings

Users can already be misled **in the current product** (Known Discovery D-030): a Risk can be resolved in the real Risks list while an old sentence still sits in Knowledge.

The 19 Aug PNG makes that easier to get wrong: every card looks current, and Risks/Current position show Due dates like todos.

Recommended convention (no new state model):

- Domain frames = current truth.
- Old Capture wording = evidence in the drawer / History.
- Needs you = unresolved, not saved truth.

Architecture sibling should retire leftover bullets; UX should stop giving them equal visual weight.

## 10. Ocean / Desert findings

Ocean stays. Desert is a second coat of paint on the **same** screens (Account → Appearance). No Desert-only layouts found.

The 19 Aug constitution still says “V1 is dark/Ocean only”. The Experimental Programme **accepted Desert**. That is a documentation conflict for you, not a reason to fork the UI.

Watch later: muted Desert text contrast, leftover light-theme CSS, unused light/dark toggle code.

## 11. Onboarding decisions still required

**Smallest decision:** keep first-run as New Project Talk (what ships today), **or** add one obviously-fake sample project that Capture is forbidden from treating as real people.

Do not build a long setup ceremony. Do not treat New Project V2 categorisation as onboarding.

## 12. Accessibility / responsive issues

Real ones, on real screens:

- Coach can auto-open over Capture (D-031) — keyboard and first-use failure.
- Knowledge Centre is a wide three-column design; it stacks on laptop/narrow, but the PNG is desktop-only.
- Focus-visible, dialog Escape, Capture `aria-live` / `role="alert"`, theme radiogroup: already present.
- Collapsed sidebar icon links are thin for screen readers.
- Desert muted text needs a contrast pass.

Not a generic WCAG project.

## 13. Reusable component opportunities

Keep: project workspace, mode selector, knowledge cards + drawer, `@person`, Capture compact review cards, New Project categorisation, theme picker, CSS variables.

Extract later, only after the real MP is in git: one Frame shell, one Needs-you/Known chip, the V2 account line.

Do **not** start a design-system rewrite. The CSS file is large; the cheap path is tokens + those few pieces.

## 14. Existing UI paths likely to be deleted

- Unmounted light/dark `AppearanceToggle`
- `/coaching` as a place people go (and Coach auto-open)
- Duplicate Timeline embed next to Important dates
- Legacy Capture engine **after** you pick V2 (D-032)
- Paste New Project card (already gone from the chooser)
- Overview (already gone)
- Light theme as a product offering

## 15. Recommended implementation order

1. You confirm the live MP link **or** confirm the 19 Aug PNG is still the picture.
2. Architecture reconciliation (truth + Person). Paint follows.
3. One Capture / New Project engine (D-032).
4. Shared tokens (Ocean + Desert), no screen forks.
5. Capture Review stays compact; show “the rest” only if asked.
6. Stop leftover sentences looking as true as Risks.
7. New Project map visual — behaviour is already there.
8. Kill Coach overlay.
9. Only then remaining MP deltas, screen by screen.

## 16. Visual regression targets for later

Do not screenshot-baseline this UI now. After MP + architecture settle, about twelve states: KC Ocean, KC Desert, KC empty, Capture compose, Review Apply Ready, Review Needs you, Person drawer, Risk drawer, NP categorisation, NP setup review, Account appearance, narrow KC.

## 17. Cross-workstream dependencies

Architecture: current truth, Person schema, leftover prose, milestone complete.  
Test: Playwright functional net — **no** screenshot farm on this branch.  
UX: will not invent Issue, Advise, Reminders, or workspace Person tables ahead of those decisions.

## 18. Risks

- Implementing from the 19 Aug PNG while a newer MP exists.
- Painting a second “source of truth” instead of following canonical-truth.
- Freezing People as per-project labels.
- Two Review UIs while both Capture engines live.
- Desert vs “Ocean only” constitution left unresolved.

## 19. Tech debt currently visible

D-030 leftover prose, D-031 Coach overlay, D-032 dual engines, Waiting dual authority, Timeline vs dates, unused light toggle, leftover coaching page, History not fully persisted, Capture V2 off by default.

## 20. Tech debt this design would create, if any

If we copied the 19 Aug PNG literally: Due-on-everything, prose competing with Risks, possible Overview nostalgia from even older shots, a generic Entity page. **That is why this branch does not implement the overhaul.**

## 21. Exact files / artefacts changed

| File | Role |
| --- | --- |
| `docs/v1-convergence-mp/README.md` | This checkpoint |
| `docs/v1-convergence-mp/FROZEN_BASE.md` | SHA / 3B ancestry |
| `docs/v1-convergence-mp/MP_RETRIEVAL.md` | What we could and could not fetch |
| `docs/v1-convergence-mp/PRODUCT_SURFACE_INVENTORY.md` | Shipping surfaces |
| `docs/v1-convergence-mp/DESIGN_PRODUCT_MAPPING.md` | Mapping table |
| `docs/v1-convergence-mp/UX_FINDINGS.md` | Entity, truth, review, NP, themes, a11y, components |
| `docs/README.md` | Pointer only |

No production React/API/schema changes.

## 22. Recommendation

**Merge this reference pack** so Architecture and Test have a shared UX map.  
**Do not** start the visual overhaul from this PR.  
**Do not** reject the pack: the retrieval gap is documented, not hidden.

**You still need to:** paste the latest Magic Patterns URL(s), or confirm the 19 Aug Ocean PNG is the approved V1 picture.

---

# MP V1 CONVERGENCE VERDICT

**READY WITH PRODUCT-OWNER DECISIONS**

Not “ready to implement the look”. Ready to reconcile, once you:

1. Confirm or supply the latest Magic Patterns design (the missing piece).
2. Choose first-run onboarding (keep New Project vs marked sample).
3. Let Architecture settle Person scope and current-truth vs leftover prose — UX will follow, not invent a third model.
4. Acknowledge Desert as additive despite the older “Ocean only” sentence, or tell us to challenge Desert.

**Not chosen:** `READY TO IMPLEMENT AFTER ARCHITECTURE RECONCILIATION` — live MP was not in hand.  
**Not chosen:** `NOT READY — DESIGN/ARCHITECTURE CONFLICT FOUND` — conflicts are **flagged** (Person scope, leftover prose, constitution vs Desert), not silent blockers to keeping this reference.
