# UX findings (entity, truth, review, New Project, themes, a11y, components)

Findings are from **frozen V2 product + 19 Aug visual constitution + stated architecture**.  
They are **not** claims about unseen live Magic Patterns screens.

## 1. Entity / object experience

People are already durable objects (project-scoped UUID today). The KC pattern is:

- **Default:** compact selectable card in a frame (inline/table/card is enough).
- **On select:** side drawer with body, previous value, provenance, Needs you, related `@person`, correction — **without leaving KC**.

That is the right extension point for richer objects. Do **not** force every row onto an entity page.

| Object | Inline card enough? | When drawer/detail becomes valuable | Stress vs a future Issue |
| --- | --- | --- | --- |
| Person | Card with `@name · responsibility` + Away | Roles, scoped responsibilities, share vs replace, evidence | Issue would need assignee = Person **link**, not a text label |
| Risk | Title + open/watch in frame | Status as **current truth**, evidence, history, linked people | Issue-like: status, owner, dates, linked risks/decisions |
| Decision | Line in Decisions frame | Provenance, superseded wording | Often remains a Knowledge object |
| Milestone | Date label in Important dates | Move date, complete (today: Needs you — D-029) | Dates on an Issue should reuse this, not a second date picker language |
| Todo | Title + due | Waiting-on, kind, complete | Issue is **not** a Todo dump |
| Future Issue | Do not add a frame yet | Would need relationships, People, responsibilities, evidence, history, dates, Risks, Decisions, Todos **as links** | Recommend **object detail drawer + stable id + `@person`**, not a new app |

Deterministic UX (prefer over AI): `@person` (`PersonEntity` already), clickable dates (`formatDueLabel`), relationship/status chips, inline edit in drawer, move/reclassify on Capture Review and NP categorisation, stable item ids (Slice 1A.1).

**Extension points to keep (not implement now):** `KnowledgeItemRef` union, `resolveKnowledgeItemDetail`, `PersonEntity`, Confirm Owner. A future Issue should plug into those, not a parallel CRM.

## 2. Current truth vs history / evidence

**User-facing distinction required (architecture sibling owns the store):**

| What the user is looking at | Should feel like |
| --- | --- |
| Risk status open/watch/resolved | **Current truth** |
| Important dates row | **Current truth** |
| Capture transcript / old finding text | **Historical evidence** |
| `lifecycle=superseded` / previous-value in drawer | **Not current** |
| History page | **How truth changed** |
| Needs you / unconfirmed | **Unresolved / provisional**, not maintained |

**Where old prose competes today (do not invent a new state model):**

- **D-030:** leftover `knowledge.sections.risks` / current-position sentences can still show after the domain Risk is resolved or a date moved. Intelligence strip can say “I see 0 risks” while a leftover bullet remains. Testers (and users) will trust the sentence.
- The 19 Aug PNG makes every card look equally current, with Due dates on Current position and Risks. Copied literally, that would **worsen** competition between prose and domain truth.

**Recommended deterministic conventions (UX, not a new ontology):**

1. Domain frames (Risks, Dates, Todos, People) are visually **primary**. Knowledge prose that is only a projection is quieter or omitted when a domain row exists.
2. Historical evidence lives in the drawer (“Why Lume believes this”, previous value) and History — not as a peer card in the current-truth column.
3. Needs you uses the existing attention treatment; it must not use the same chrome as Known.
4. Do not reintroduce Capture High/Medium/Low badges on maintained Knowledge.

Flag for architecture: unify on existing canonical-truth / domain stores; UX should follow that unification, not invent “source of truth” chips.

## 3. Review / Needs you

Capture Review is the trust surface. Current V2 product **mostly** supports the candidate principle (“account for what it heard”) **without** a bureaucratic wall:

- Atomic observations → compact cards.
- Proposed vs already known vs Needs you vs commentary in the **account line** (V2).
- Current vs new via diff layouts.
- Target object via `TargetPicker` / Choose this / Create new.
- Confirm Owner for identity ambiguity.
- Why panel is progressive disclosure.

**Gaps (product, independent of MP):**

- Merged observations are counted in `accountObservations` but **omitted from the visible account line**.
- Rejected/ignored are easy to hide — good — but should remain disclosable.
- Legacy pipeline has **no** account line — two engines (D-032) means two honesty languages.
- Review denominator / restore-dismissed remain Known Discovery (Phase 3D visual).

**Do not** grow Review into a giant form. Default stays the compact card + one account sentence. Uncertain/merged/commentary behind Why / “show the rest”.

## 4. New Project V2 mapping into the MP target

Product already has the intended shape when the flag is on:

messy Talk → provisional categorised map → deterministic recategorise/edit/remove → Approve categorisation → existing setup Review → durable project.

Preserve:

- Fast “organised my mess”.
- Explicit “this is not maintained truth yet”.
- Blank path unchanged (no map).

Avoid (not present as a wizard today — do not add):

- Giant form, setup wizard, huge flat Review, forcing exhaustive correction before value.

**MP gap:** 19 Aug PNG has no New Project flow. Live MP unknown. Do not invent a marketing onboarding carousel and call it MP.

Paste: constitution says out of V1; choose UI already dropped it; API still accepts paste. PO: delete remnants or keep as hidden power path — do not silently restore the card.

## 5. Onboarding (unresolved — do not choose)

**Current default:** zero projects render the same New Project experience (`variant="first-run"`). There is no sample project, no tutorial Capture, no separate onboarding IA.

| Option | MP (unknown) | Product today | Time-to-value | Risk |
| --- | --- | --- | --- | --- |
| Direct New Project | ? | **This is what ships** | Fast if Talk works | Empty KC after blank; first Capture is the real “aha” |
| Prebuilt example / tutorial project | ? | Seed data exists in local mode only; production hydrate must not silent-seed | Fast demo | Demo names (Sarah/Marcus) are exactly what 3B banned from Capture |
| Guided first Capture | ? | Not a first-run flow | Teaches review-before-write | Delays project identity |
| Lightweight sample | ? | Not productised | Fast | Must be obviously fake; must not train Capture on demo identities |

**Smallest PO decision needed:**  
Keep first-run = New Project Talk, **or** add one disposable sample project that is visually marked as example and excluded from Capture identity matching.

Do **not** implement a long configuration ceremony. Do not conflate with New Project V2 categorisation.

## 6. Ocean + Desert

| Check | Finding |
| --- | --- |
| Ocean remains | Yes. Default. PNG is Ocean. |
| Desert additive | Yes. Same components. Token block in `globals.css`. |
| Theme-specific screen forks | None found. |
| Contrast | Desert text `#f6eee4` on `#16110d` is generally fine; muted `#8f7d6c` on espresso surfaces needs a later contrast pass on chips/empty copy. Not implemented here. |
| Hard-coded colour leakage | Production TSX is largely token-driven. One hex in `AiCockpitClient` (dev). Large `globals.css` still has many component-specific colours; Desert remaps the **root tokens**, not every leftover rule. Light theme tokens remain unused. |
| Token gaps | `--accent-risk` and workspace-owned mixes exist on Desert; Ocean risk accent is mostly CSS class `accent-risks`. Worth unifying **later**, not a library rewrite. |
| Surfaces missing in one theme | None by fork; any hard-coded navy in CSS would leak Ocean into Desert — grep-on-implementation later. |
| Hydration / selection | Boot script sets `data-theme` from `mc-appearance-v1` before paint. Picker shows Ocean until `hydrated` (avoids wrong radio). FOUC largely addressed. `AppearanceToggle` (light/dark) is unmounted leftover. |

Constitution §3 (“V1 dark only, Ocean required”) **conflicts** with accepted Desert. Flag for PO; do not revert Desert here.

## 7. Responsive / accessibility (mapped to real screens)

Not a generic WCAG pamphlet.

| Concern | Where | Finding |
| --- | --- | --- |
| Desktop / laptop | KC three columns | Primary frames collapse in CSS at ~1100 / 720 / 640. PNG is a wide desktop composition. |
| Narrow / mobile | Sidebar | Backdrop + mobile open; Capture/Tell Me have dedicated narrow CSS. Drawer is a side panel — on narrow it must become full-width (CSS exists around 800px). |
| Keyboard | Mode tabs, cards, drawer | Mode selector is `tablist`. Drawer: Escape, initial focus on Close, restore trigger. Confirm Owner is a dialog. |
| Focus visibility | Global `:focus-visible` in `globals.css` | Present. Why-panel and delete-project have extra rules. |
| Semantic controls | Theme picker | `radiogroup` / `role="radio"`. Some icon-only sidebar links rely on `title` when collapsed. |
| Contrast | Desert muted text; Ocean `--text-muted` | Needs a later pass on empty frames and commentary. |
| SR labels | Capture textarea | `sr-only` label. Analyse live region `aria-live="polite"`. Capture error `role="alert"`. Theme picker labelled. Item detail `aria-label`. |
| Modal behaviour | Item drawer, Confirm Owner, Coach | Drawer is `aria-modal`. Coach auto-open (D-031) **steals** the Capture path — a11y and UX failure. |
| Error announcements | Persist / Capture / New Project | Mix of `role="alert"` and inline `error` strings. Save-error banner is the Ocean pattern to reuse. |
| Loading | Home / Analyse / NP build | Textual; no shared skeleton primitive. |

PNG itself is not a responsive spec. Do not implement a separate mobile IA unless latest MP shows one.

## 8. Component / implementation convergence

**Keep (reuse, do not rewrite):**

- `OceanProjectWorkspace` + `ProjectModeSelector` + `ProjectIntelligenceStrip`
- `KnowledgeItemCard` + `KnowledgeItemDetailDrawer` + `KnowledgeItemRef`
- `PersonEntity`, `ConfirmOwnerDialog`, `EpistemicChip`
- `CompactChangeCard` / `ReviewBadge` / `WhyPanel` / `CorrectionActions`
- `NewProjectCategorisation` + `ProjectSetupReview`
- `LumeThemePicker` + CSS variables in `globals.css`
- Frame empty copy pattern

**Likely to disappear (or stop being product chrome):**

- `AppearanceToggle` (unmounted light/dark)
- `/coaching` page as a destination; Coach auto-open
- Duplicate **Timeline** embed beside Important dates
- `WorkspaceGrid` / old dashboard chrome if still reachable
- Overview (already gone)
- Paste card (already gone from choose)
- Legacy Capture findings UI **after** D-032 chooses V2
- Light theme token block if PO confirms Ocean+Desert only

**MP patterns that would justify shared primitives later** (only after live MP is in git):

- One `FrameShell` extracted from the local function in `OceanKnowledgeFrames` (already duplicated conceptually with `WorkspaceFrame` / `frames/*`)
- Trust chip: Known / ✦ noticed / Needs you
- Object-link + `@person`
- Review account line as a small status component

**Do not** start a component-library rewrite. `globals.css` is ~8k lines of bespoke CSS; the cheap path is **tokens + a handful of existing components**, screen-by-screen after architecture reconciliation.

**Premature abstractions:** generic Entity page, design-system package, forking Desert components, new “truth badge” ontology.

### Recommended later implementation sequence (minimise rework)

1. **PO:** confirm live MP URLs **or** confirm 19 Aug PNG remains the visual parent; decide onboarding; decide Desert-vs-constitution text.
2. **Architecture reconciliation** (sibling): current-truth authority, Person workspace scope, leftover prose (D-030). UX follows; do not paint a second truth model.
3. **D-032:** one Capture / New Project engine so Review and NP have one language.
4. **Token hygiene:** semantic status colours shared Ocean/Desert; remove unused light toggle; no screen forks.
5. **Extract only proven duplicates:** `FrameShell`, trust/Needs-you chip, account line — after MP screens exist in-repo.
6. **Capture Review disclosure:** show merged/commentary as optional, keep default light.
7. **KC current-truth chrome:** stop leftover prose competing (depends on architecture).
8. **New Project categorisation visual** to match confirmed MP — behaviour already exists.
9. **Coach overlay (D-031)** and leftover `/coaching`.
10. **Then** any remaining MP deltas, screen-by-screen, using existing drawers/cards.

## 9. Visual regression targets (after MP convergence stabilises)

Do **not** baseline screenshots against UI that is about to change. Sibling Test workstream: Playwright functional tests only for now.

**Later, ~12 high-value visual states** (not hundreds):

1. Knowledge Centre — Ocean — populated primary trio  
2. Knowledge Centre — Desert — same project (theme parity)  
3. Knowledge Centre — empty frames  
4. Capture compose (Ocean)  
5. Capture Review — Apply Ready (V2 account line visible)  
6. Capture Review — Needs you / Confirm Owner  
7. Item detail drawer — Person with responsibility + Away  
8. Item detail drawer — Risk **current** vs previous  
9. New Project V2 categorisation map  
10. New Project setup review  
11. Account — Appearance picker (Ocean selected / Desert selected)  
12. Narrow viewport (~720px) Knowledge Centre + mode selector  

Optional 13th if onboarding is chosen: zero-project first-run.  
Skip: every epistemic chip, every evals page, Coach, light theme.

## 10. Cross-workstream dependencies

**Architecture sibling owns — do not duplicate:**

- Current-truth authority / canonical-truth unification  
- Server trust boundary / persist-first expansion  
- Person schema (workspace identity vs project participation)  
- Legacy deletion  
- D-030 leftover prose as a **data** problem  

**Questions for architecture (UX blocked on answers, not on painting):**

- When leftover Knowledge bullets disagree with `risks` / `milestones`, which row may the KC **show**?
- Is Person becoming workspace-scoped in V1 or later? UX copy (`@name`) can stay; identity model cannot be faked in the UI.
- Milestone complete: Needs you forever, or a real status?

**Test sibling owns:**

- Playwright functional foundation, benchmarks, property tests  
- **Do not** add screenshot baselines on this branch  

**If live MP requires a capability that does not exist** (workspace Person graph, Issue object, Advise, completed milestones, Reminders frame): **flag it** — do not implement.

## 11. Visible tech debt (now vs this design)

**Already visible:** D-030, D-031, D-032, dual Waiting authority, Timeline vs Important dates, unmounted `AppearanceToggle`, leftover `/coaching`, light tokens, History persist gaps, Capture flag default off.

**Debt this design would create if implemented blindly from the 19 Aug PNG:**

- Re-introducing Due-on-everything and badge dots as current truth  
- Re-introducing Overview (PNG does not; old screenshots do — do not)  
- Theme-specific mockups if a newer MP forked Desert  
- A generic Entity app that blocks rich objects  
- A second Review if MP shows a wizard  

Those are reasons **not** to implement the overhaul from the PNG alone.
