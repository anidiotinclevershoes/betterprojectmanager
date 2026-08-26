# UX findings (entity, truth, review, New Project, themes, a11y, components)

Findings are from **frozen V2 product + live Magic Patterns v8 + 19 Aug visual constitution + stated architecture**, updated by the [Spiderman amendment](./SPIDERMAN_AMENDMENT.md) (V1 product decisions).

The `mp-source/` dump was **not** modified.

Live MP: Knowledge Centre + compact inspector only  
https://www.magicpatterns.com/c/gekwmrddrt3hkx7f1c9gm8/screens  
Unaltered dump: `docs/v1-convergence-mp/mp-source/`

v2 of that file (Evolve KC / briefing prose) is **not** the parent.

**Spiderman (26 Aug):** v8 frame order is the **approved V1 target**. The dump itself was not edited.

## 1. Entity / object experience

Live MP confirms the pattern we already recommended, and names it:

- **Default:** compact selectable card in a frame.
- **On select:** a **compact overlay inspector** (~26rem) over an unmoved Knowledge Centre. Subtle dim. Escape: back along the trail, then close.
- User-facing labels via `typeLabel()`: Person, Risk, To do, Milestone, Date, Decision, Waiting on, Area of work, Current position, Meeting, Issue.
- The word **Entity** is internal only (`types/knowledge.ts`). Do not expose it. Do not build a generic Entity app.
- `issue` exists in the prototype grammar as a **future kind**. Do not implement Issue in V1.

Compact inspector default (v6, preserved in v8): header, RIGHT NOW (3–5 facts), sparse CONNECTED TO, 1–2 contextual actions + More details. Known = no badge. ✦ Lume noticed / Needs you only when relevant. SOURCE hidden on ordinary Known; may show for noticed / needs-you. Why Lume believes this / WHAT CHANGED behind More details.

Needs you: **statement + question**. No speculative AI solution menus.

Person inspector = “why this person matters **now**”, not CRM.

Product already has `KnowledgeItemDetailDrawer`. Later implementation should **evolve that drawer** toward the overlay contract (do not reflow KC; full-width mode bar stays full-width). Do not add a second inspector.

| Object | Inline card enough? | When inspector becomes valuable | Stress vs a future Issue |
| --- | --- | --- | --- |
| Person | Card with `@name · responsibility` + Away | Why they matter now; Owns / Responsible for / Away | Issue assignee = Person **link**, not a text label |
| Risk | Title + open/watch in frame | Status as **current truth**, missing plan, blocks, evidence | Status, owner, dates, linked decisions — as links |
| Decision | Line in Decisions frame | Provenance, decided-by | Often remains a Knowledge object |
| Milestone | Semantic date in Important dates | Move date (popover is UX only), complete (today: Needs you — D-029) | Reuse date language, not a second picker |
| Todo | Title + due | Waiting-on, missing, blocked-by | Issue is **not** a Todo dump |
| Area of work | MP demo only (`a-payments`) | Navigation grouping in the prototype | Do not invent an Area store |
| Waiting | Frame row | Dual authority in product (D-008/D-021) — do not promote to a new architecture | |
| Future Issue | Do not add a frame yet | Would plug into the same inspector | Extension point = inspector + stable id + `@person` |

Deterministic UX (prefer over AI): clickable structured refs, `DatePopover`, `PersonMark`, directional vocabulary (Owner, Owns, Missing, Waiting on, Blocks, Chaired by, Decided by, Due / Away / CAB / Freeze / Release / Starts).

**Extension points to keep (not implement now):** `KnowledgeItemRef`, `resolveKnowledgeItemDetail`, `PersonEntity`, Confirm Owner, MP `Inspector` as the interaction spec.

## 2. Current truth vs history / evidence

Live MP’s compact inspector is aligned with the required distinction:

| What the user is looking at | Should feel like |
| --- | --- |
| RIGHT NOW facts on a domain object | **Current truth** |
| Risk status open/watch/resolved | **Current truth** |
| Important dates row | **Current truth** |
| Why Lume believes this / evidence quotes | **Historical evidence** |
| WHAT CHANGED / previous value | **Not current** |
| History page | **How truth changed** |
| Needs you | **Unresolved**, not maintained |

**Where old prose still competes in the product (D-030):** leftover `knowledge.sections.risks` / current-position sentences can remain after the domain Risk is resolved. The 19 Aug PNG made every card look equally current. v8 improves inspector disclosure but **does not remove** leftover bullets from the shipping KC.

**V1 UX rule (Spiderman) — strengthen, do not reopen:**

1. Domain frames show **maintained current truth**. Knowledge prose that is only a projection is quieter or omitted when a domain row exists.
2. Superseded Capture / prose belongs in More details, evidence, and History — not as a peer card in the current-truth column.
3. Needs you is unresolved / provisional, not saved truth, and must not use the same chrome as Known.
4. Do not reintroduce Capture High/Medium/Low as maintained Knowledge. MP still uses quiet colour dots on Risks — keep them quieter than a badge storm.

Architecture still unifies on canonical-truth / domain stores (D-030 as data). UX follows; do not paint a second “source of truth” chip ontology.

**“Accept as known”** in the MP Why block is prototype-local. **V1 rule:** it is not permission for arbitrary KC writes. If the control survives, it may only resolve an already structured / provisional / Needs-you item through the safe mutation / review path. Architecture owns that path. Do not create a second KC mutation architecture.

## 3. Review / Needs you

Capture Review is **not in the live MP file**. Product V2 still owns this surface.

Needs you **is** designed in MP for the **Knowledge Centre inspector** (Marcus Webb). That is complementary to Capture Review Needs you, not a replacement.

Product Review (independent of MP):

- Atomic observations → compact cards.
- Proposed vs already known vs Needs you vs commentary in the V2 account line.
- Confirm Owner for identity ambiguity.
- Why panel is progressive disclosure.

Gaps unchanged: merged observations omitted from the visible account line; dual engines (D-032); do not grow Review into a giant form.

Do **not** copy MP “Accept as known” as a new write. Review already has Approve / Apply Ready. Any surviving Accept-as-known control must use that same safety boundary.

## 4. New Project V2 mapping into the MP target

**Still no New Project screens in live MP.** Product already has the intended shape when the flag is on:

messy Talk → provisional categorised map → recategorise/edit/remove → Approve categorisation → setup Review → durable project.

Do not invent a marketing onboarding carousel and call it MP. **V1 first-run is New Project Talk** (Spiderman). Categorisation is not a separate onboarding product and must not become a long wizard.

Paste: constitution says out of V1; choose UI already dropped it; API still accepts paste. Remnants are cleanup, not a new first-run choice.

## 5. Onboarding — decided for V1

**Retain New Project Talk as the first-run route.** Do not introduce a fake / sample / tutorial project in V1. Live MP does not draw first-run; that is fine.

MP demo names (Elena, Marcus, Priya, Sarah, Atlas) are **prototype story**, not a sample project to hydrate into production.

Zero-project home already uses `NewProjectExperience variant="first-run"`. Keep that. Do not add a long setup ceremony.

## 6. Ocean + Desert

| Check | Finding |
| --- | --- |
| Ocean remains | Yes. v8 palette is Ocean. PNG is Ocean. Product default `data-theme="dark"`. |
| Desert additive | Yes in product. **Not in live MP.** Same components; token block in `globals.css`. |
| Theme-specific screen forks | None in product. Do not fork Desert screens to “match MP” — MP has no Desert canvas. |
| Contrast | Desert muted text still needs a later pass. |
| Mode bar | v8: full-width working-surface bar; inspector must not narrow it. Product already has `ProjectModeSelector` as tabs. |

Constitution §3 (“V1 dark only, Ocean required”) is **superseded** for V1 by the Spiderman Desert decision. Ocean remains supported; Desert is additive; same screens. Do not revert Desert. Do not invent a Desert MP canvas.

## 7. Responsive / accessibility (mapped to real screens)

| Concern | Where | Finding |
| --- | --- | --- |
| Desktop / laptop | KC grid | Product: primary frames collapse ~1100 / 720 / 640. MP canvas is wide desktop. v8 top row is **two** frames (To Do + Risks). |
| Inspector overlay | MP `w-[26rem]` + dim | Product drawer already goes full-width around 800px. Overlay must keep the mode bar full width (v8 requirement). |
| Keyboard | MP Escape = back then close; DatePopover Escape | Product drawer: Escape, initial focus on Close. Confirm Owner is a dialog. Coach auto-open (D-031) still steals Capture in **current** product — V1 target is to **remove Coach from the active shell**, not redesign it. |
| Focus visibility | MP and product both have `:focus-visible` | Present. |
| Contrast | Desert muted; Ocean `--text-muted` | Later pass. |
| Modal behaviour | MP inspector is overlay not `aria-modal` dialog | Product drawer is `aria-modal`. When evolving the drawer, keep focus trap. Legacy `DetailModal` still has **no** focus trap. |

PNG / MP canvas are not a mobile IA. Do not implement a separate mobile product unless a later MP shows one.

## 8. Component / implementation convergence

**Keep (reuse, do not rewrite):**

- `OceanProjectWorkspace` + `ProjectModeSelector` + `ProjectIntelligenceStrip`
- `KnowledgeItemCard` + `KnowledgeItemDetailDrawer` + `KnowledgeItemRef`
- `PersonEntity`, `ConfirmOwnerDialog`, `EpistemicChip`
- `CompactChangeCard` / `ReviewBadge` / `WhyPanel` / `CorrectionActions`
- `NewProjectCategorisation` + `ProjectSetupReview`
- `LumeThemePicker` + CSS variables in `globals.css`

**MP primitives to extract later (after architecture reconciliation):**

- Overlay inspector behaviour (from existing drawer): width ~26rem, dim, trail back, More details
- `TrustMark` (Known renders nothing; ✦ noticed; Needs you)
- Deterministic `DatePopover` (UX only — persist via existing 3B paths)
- `FrameShell` from `OceanKnowledgeFrames`
- Directional relationship rows (RIGHT NOW / CONNECTED TO)

**Likely to disappear (unchanged):**

- `AppearanceToggle` (unmounted light/dark)
- `/coaching` + Coach auto-open; unmounted `HeaderCoachButton` — **V1 removal / deprecation**
- **Timeline as a date authority.** If retained, projection over milestone/date data; else deletion candidate after MP implementation
- `WorkspaceGrid` / `ProjectWidgetGrid` / `ProjectKnowledgeBrief`
- `CaptureBar` immediate-merge (**deleted Slice 1A**); `TellMePanel`
- Overview (already gone)
- Paste card (already gone from choose)
- Legacy Capture findings UI **after** D-032 chooses V2
- Light theme token block (Ocean + Desert only for V1)
- `/memory`, `/meetings`, `/releases` as destinations if Meeting Prep stays a KC embed

**Do not** start a component-library rewrite. Do not revive `CaptureBar`. Do not port MP Tailwind/framer-motion literally (integrate-magic-patterns rule: codebase wins).

**Premature abstractions:** generic Entity page, design-system package, Desert component forks, new truth-badge ontology, Area-of-work store, Issue object.

### Recommended later implementation sequence (minimise rework)

1. **Architecture reconciliation** (sibling): current-truth authority, Person workspace scope, leftover prose (D-030), Waiting authority, milestone complete, Accept-as-known mutation path. UX follows; do not paint a second truth model.
2. **Apply v8 frame order** on existing frames (To Do + Risks top; Current Position below).
3. **D-032:** one Capture / New Project engine so Review and NP have one language.
4. **Token hygiene:** semantic status colours shared Ocean/Desert; remove unused light toggle; no screen forks.
5. **Evolve existing drawer** toward the compact overlay contract (do not reflow KC; full-width mode bar).
6. **KC current-truth chrome:** stop leftover prose competing (depends on architecture).
7. **Capture Review disclosure:** show merged/commentary as optional, keep default light. (No MP screen — follow product + philosophy.)
8. **New Project categorisation visual** — behaviour already exists; first-run remains Talk.
9. **Remove Coach** from the active V1 shell (D-031, `/coaching`). Do not redesign Coach.
10. **Timeline:** keep only as a projection, or delete if it adds no distinct V1 value.
11. **Then** remaining MP deltas, screen-by-screen, using existing drawers/cards.

## 9. Visual regression targets (after MP + architecture settle)

Do **not** screenshot-baseline this UI now. Sibling Test: Playwright functional tests only.

**Later, ~12 high-value visual states:**

1. Knowledge Centre — Ocean — populated, **v8 order** (To Do + Risks top)
2. Knowledge Centre — Desert — same project (product-only; MP is Ocean-only)
3. Knowledge Centre — empty frames
4. Risk inspector compact (Ocean)
5. Risk · More details
6. Person inspector (Elena-like: why they matter now)
7. Needs you inspector (Marcus-like: statement + question, no solution menu)
8. To Do inspector + date popover (interaction, not persist)
9. Milestone inspector (CAB / semantic date)
10. Capture Review — Apply Ready (V2 account line) — **product, not MP**
11. Capture Review — Needs you / Confirm Owner — **product, not MP**
12. New Project V2 categorisation — **product, not MP**

Optional: Account Appearance (Ocean / Desert); narrow viewport KC + mode bar with inspector open; zero-project first-run (New Project Talk).

Skip: every epistemic chip, evals, Coach, light theme, v2 evolve-KC briefing screens.

## 10. Cross-workstream dependencies

**Architecture sibling owns — do not duplicate:**

- Current-truth authority / canonical-truth unification
- Server trust boundary / persist-first expansion
- Person schema (workspace identity vs project participation)
- Legacy deletion
- D-030 leftover prose as a **data** problem
- Waiting dual authority
- Milestone complete lifecycle (D-029)
- Exact “Accept as known” mutation / review path (UX rule is decided)

**Questions for architecture (implementation boundary, not new UX choices):**

- When leftover Knowledge bullets disagree with `risks` / `milestones`, which row may the KC **show**? (UX rule: leftover must not compete as current truth.)
- Person workspace-scope: V1 schema now, or later? UX copy (`@name`) can stay; identity model cannot be faked in the UI.
- Milestone complete: Needs you forever, or a real status?
- Exact “Accept as known” path: existing 3B apply, Capture Review jump, or omit the control?

**Test sibling owns:** Playwright functional foundation. **Do not** add screenshot baselines on this branch.

**If live MP requires a capability that does not exist** (workspace Person graph, Issue object, Advise, completed milestones, Reminders app, Area store): **flag it** — do not implement.

## 11. Visible tech debt (now vs this design)

**Already visible:** D-030, D-031, D-032, dual Waiting authority, Timeline vs Important dates, unmounted `AppearanceToggle`, leftover `/coaching`, light tokens, History persist gaps, Capture flag default off.

**Debt this design would create if implemented blindly from MP v8 (against Spiderman rules):**

- Shipping “Accept as known” as a KC mutation bypass
- Freezing People as per-project story objects (Elena/Marcus demo)
- Promoting `waiting` / `area` / `issue` to first-class stores
- Copying priority dots + leftover prose as equal current truth
- Theme-forking Desert because MP is Ocean-only
- A generic Entity app because the prototype file is named `Entity`
- A second Review UI while both Capture engines live
- Persisting date-popover clicks without 3B

Those remain reasons **not** to implement the overhaul from this PR. The Spiderman rules are the V1 constraints for a later implementation stream.
