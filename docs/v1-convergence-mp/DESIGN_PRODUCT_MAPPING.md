# Design ↔ product state mapping

**Latest live Magic Patterns:** v8 artifact `30fc8231-32b7-475b-bf5f-d8f6d44c8841`  
https://www.magicpatterns.com/c/gekwmrddrt3hkx7f1c9gm8/screens  
Unaltered source: `docs/v1-convergence-mp/mp-source/`

**19 Aug constitution** (`LUME_V1_UI_BASELINE_OCEAN.png` + `.md`) remains the Ocean visual parent. v8 is the live **Knowledge Centre + inspector** iteration. Desert, Capture V2 accounting, and New Project V2 categorisation are **not** in this MP file.

## Classification key

| Code | Meaning |
| --- | --- |
| MP-YES | Drawn in live v8 (or explicitly specified in the v6/v8 user prompts) |
| MP-MISS | Required V2 / architecture state **not** in this MP file |
| CONST-YES | Represented in the 19 Aug Ocean PNG / UI baseline |
| CONST-STALE | In the constitution, but product, live MP, or architecture has moved on |
| PROD-YES | Exists in frozen V2 product |
| ARCH-CONFLICT | Conflicts with stated V1 architecture / this programme — **do not silently choose** |
| PO | Needs product-owner decision |
| LATER | Ready to implement later once architecture (and remaining PO items) are reconciled |

## Nine live MP screens vs product

| MP screen | Frozen V2 product | Architecture / notes | Class |
| --- | --- | --- | --- |
| 1 · Resting KC | `OceanKnowledgeFrames` + `OceanProjectWorkspace`. Product **primary trio** is Current position, Risks, To Do. v8 top row is **To Do + Risks**; Current position sits below | v8 user prompt: “V1 default scanning hierarchy, not a permanent type ranking.” 19 Aug PNG and shipping CSS still lead with Current position | **PO** (frame order) / MP-YES / PROD-YES / CONST-STALE |
| 2 · Risk inspector compact | `KnowledgeItemDetailDrawer` — body, previous value, provenance, Needs you, related `@person`. Not a 26rem overlay; KC can feel squeezed | Compact overlay (~26rem / 416px) must **not reflow** KC. Known = no badge. Risk `r-build` is ✦ Lume noticed | MP-YES / PROD-YES (drawer parent) / LATER |
| 3 · Risk · More details | Drawer “Why Lume believes this” + history/previous | Why / evidence / WHAT CHANGED behind More details. **Accept as known** on noticed items | MP-YES / **ARCH-CONFLICT** vs review-before-write / Phase 3B / PO |
| 4 · Person · Elena Rostova | People frame + person drawer. Project-scoped stakeholder UUID | Inspector = “why this person matters now”, not CRM. Demo people are project-story objects | MP-YES / **ARCH-CONFLICT** (workspace Person vs project participation) / PO |
| 5 · Connected · Payments pipeline | No first-class “Area of work” object; Dependencies frame is structured `kind=dependency` | `kind: "area"` is prototype grouping. Do not invent an Area store | MP-YES (navigation demo) / MP-MISS as a product type / PO |
| 6 · Connected · Decision | `sections.decisions` cards + drawer | Clickable structured refs; directional labels (`Decided by`) | MP-YES / PROD-YES (partial) / LATER |
| 7 · To Do inspector | Domain todos + drawer | Date popover is UX, not a persist licence. `Mark done` in prototype is local state | MP-YES / PROD-YES / LATER |
| 8 · Milestone · CAB approval | Important dates + **duplicate Timeline**. Complete-milestone has no status (D-029) | Semantic date labels (CAB / Freeze / Release / Away). Date edit in prototype ≠ durable write | MP-YES / PROD-YES (duplicated) / **ARCH** D-029 / PO |
| 9 · Needs you · Marcus Webb | Confirm Owner + Needs you reason in drawer/Review. No speculative AI solution menus in product Review | Statement + question only. Same conflict also lives on the Person card | MP-YES / PROD-YES / LATER |

## Inventory (brief minimum set)

| Surface | Live MP v8 | 19 Aug constitution | Frozen V2 product | Architecture / notes | Class |
| --- | --- | --- | --- | --- | --- |
| Project shell / navigation | Sidebar: projects, + New Project, Master To Do, History, Captures, Tom, Help. No Overview. Mode bar is **full-width** Capture \| KC \| Advise Coming soon | Matches | Matches; Account is a real page (MP shows “Tom”) | Individual-first | MP-YES / CONST-YES / PROD-YES / LATER |
| Capture (compose) | Tab only; no compose internals | Mode in selected project | Ocean Capture mode | Capture V2 is the **target** engine; flag off (D-032) | MP-MISS as a screen / PROD-YES / PO (flag default) |
| Capture observation accounting | Not in file | Philosophy only | V2 compact account line | Keep cognitively light | MP-MISS / PROD-YES (partial) / LATER |
| Capture Review | Not in file | Review-before-write constitution | Compact cards, Why, correction | Phase 3B is the write gate | MP-MISS as a **screen** / PROD-YES / PO |
| Apply Ready | Not in file | Implied | Approve / Apply Ready / Remember | Binding | MP-MISS / PROD-YES / LATER |
| Needs you | Screen 9 + trust marks on cards. Statement + question; **no** AI solution menus | Stronger treatment near top (baseline §14) | Review cards + Confirm Owner + item detail | Ambiguity that could alter truth → ask | MP-YES (KC inspector) / PROD-YES / LATER |
| No-change | Not in file | Not drawn | V2 `alreadyKnown` count | Must not look like a write | MP-MISS / PROD-YES (partial) / LATER |
| Save / error | Not in file | Not drawn | `ocean-save-error` | Persist-first on 3B domains | MP-MISS / PROD-YES / LATER |
| Loading | Not in file | Not drawn | Analyse busy; home loading | Prefer deterministic skeletons | MP-MISS / PROD-YES / LATER |
| Empty states | Dependencies empty copy only | PNG is populated | Per-frame empty copy | Keep quiet | MP-YES (one frame) / PROD-YES / LATER |
| Knowledge Centre | **This is the v8 canvas.** Operational row first (To Do + Risks); Current position below; ten frames including Timeline | PNG primary trio: Current position, Risks, To Do | Same as constitution (Current position first) | Confirm v8 scan order as V1 default | **PO** / MP-YES / CONST-STALE / PROD-YES |
| Compact inspector | Overlay `w-[26rem]`, dim, Escape = back then close, does not reflow KC | Selectable cards + richer detail | Side drawer (`KnowledgeItemDetailDrawer`) | Reuse drawer as parent; do not fork a second inspector | MP-YES / PROD-YES / LATER |
| People | Elena / Marcus / Priya / Sarah as project-story objects; `@` via `PersonMark`; Owns / Responsible for / Away / Chairs | Rich `@person · responsibility` | People frame + `PersonEntity` | **ARCH-CONFLICT:** workspace-scoped Person + project participation. UX language can survive | ARCH-CONFLICT / PO |
| Responsibilities | Directional vocabulary locked in v8 data | Scoped, not generic RACI | Structured `kind=responsibility` | Keep many-to-many; share default | MP-YES / PROD-YES / LATER |
| Availability | Away ranges on Marcus / date object | `Away 1–12 Sep` | Structured availability when present | Under-modelled calendar (D-020) | MP-YES / PROD-YES (partial) / LATER |
| Risks | Frame + compact/more-details screens. Colour dots on cards. `r-build` is noticed | Risks column; PNG Due on risks | Domain `risks.status`; leftover bullets (D-030) | Dots + leftover prose can compete with current Risk truth | MP-YES / ARCH-CONFLICT (visual leftover) / PO |
| Dates / milestones | Important dates + **Timeline still duplicated** (same as product). Semantic labels | Important dates secondary; PNG Due-on-everything | `milestones` + duplicate Timeline. D-029 | Prefer one dates surface | MP-YES (same debt) / PROD-YES / PO |
| Todos | Top-row frame + inspector | To Do column | Domain todos; Master To Do | Waiting todos also in Waiting frame | MP-YES / PROD-YES / LATER |
| Decisions | Frame + connected-decision screen | Secondary frame | `sections.decisions` | Mostly Knowledge-authored | MP-YES / PROD-YES / LATER |
| Reminders | Not in file | Not in PNG | Todo `kind=REMINDER` only | Do not invent a Reminders app | MP-MISS / PROD-YES (data only) / PO |
| Advise / Coach | Coming soon tab only | Coming soon | Same disabled tab; Coach leftover | D-031 overlay is product debt | MP-YES (coming soon) / PROD-YES / PO |
| Tell Me / Ask | Search vs ✦ Ask Lume | Same | Implemented | Do not merge them | MP-YES / PROD-YES / LATER |
| Meeting Prep | Frame present | Optional if stable | KC embed + `/meetings` | Not a truth authority | MP-YES / PROD-YES / LATER |
| History | Sidebar utility | Sidebar utility | `/history` page | Evidence — **not** current truth | MP-YES / PROD-YES / LATER |
| New Project Talk / Paste | `+ New Project` in sidebar only | Lightweight + New Project | Talk + Blank; Paste gone from choose | Messy input → organised map | MP-MISS as a screen / PROD-YES / PO |
| New Project categorisation | **Not in file** | Does not exist in 19 Aug | `NewProjectCategorisation` when V2 flag | Not a wizard | MP-MISS / PROD-YES / LATER |
| Setup review | Not in file | Not in PNG | `ProjectSetupReview` | Do not flatten | MP-MISS / PROD-YES / LATER |
| Blank New Project | Not in file | Not in PNG | Name + code | Keep fast path | MP-MISS / PROD-YES / LATER |
| Account / Appearance | “Tom” / Sign out only | Account in sidebar; Ocean-only text | Account + Ocean/Desert picker | **ARCH/CONST:** Desert accepted 25 Aug | ARCH-CONFLICT (doc vs programme) / PO |
| Ocean | **The v8 file.** Palette locked | **The PNG** | Default `data-theme="dark"` | Remains a full supported theme | MP-YES / CONST-YES / PROD-YES / LATER |
| Desert | Not drawn | “Desset” only if trivial token swap | Additive token theme | No theme-specific screen forks | MP-MISS (visual) / PROD-YES / LATER |
| Onboarding / first-run | Not in file | Not a separate product | Zero projects = New Project first-run | **Unresolved V1 decision** | MP-MISS / PROD-YES (defaulted to NP) / PO |
| Entity / Issue-like object | Shared `Entity` grammar **including `issue`**. User never sees the word; `typeLabel()` says Person / Risk / To do / Issue | Selectable cards + detail | Drawer for current kinds; no Issue type | Do **not** force a generic Entity page. Do not implement Issue. Inspector is the extension point | MP-YES (hidden grammar) / ARCH-CONFLICT if taken as a public Entity app / PO |
| Current vs historical truth | RIGHT NOW vs More details (Why / WHAT CHANGED). Ordinary Known has no SOURCE up front | Evidence links; items look equally present | Domain frames vs leftover bullets (D-030) | Architecture owns the store; UX should stop leftover prose competing | ARCH-CONFLICT (leftover prose) / PO |
| “Accept as known” | Inspector Why block, noticed items | Review-before-write | Capture Review + Phase 3B apply | Prototype local `accept()` is **not** a 3B write. Do not ship a KC bypass | ARCH-CONFLICT / PO |
| Waiting as its own kind | `kind: "waiting"` objects in a frame | Waiting & open loops frame | Dual authority (todos + `sections.openLoops`) D-008/D-021 | v6 prompt: do not invent a major Waiting architecture | MP-YES (prototype kind) / ARCH-CONFLICT (authority) / PO |
| Date popover | Deterministic `DatePopover` / `DateEditor` on cards | Not this interaction | No in-card calendar; dates in drawer / Capture | UX pattern only — D-029 / persist-first still apply | MP-YES / PROD-MISS interaction / LATER |

## Conflicts flagged for lead / product owner (not resolved here)

1. **Frame order:** v8 (To Do + Risks first) vs 19 Aug constitution **and** shipping product (Current position, Risks, To Do). v6 also said do not create a permanent Risks+To Do hierarchy that demotes future Issues. v8 is the latest user surgical pass — confirm it is the V1 default.
2. **Person identity:** workspace-scoped (programme) vs project-scoped stakeholders (code) vs MP demo people as project-story objects. Language (`Owns`, Away) can survive; schema is Architecture’s.
3. **Desert vs constitution “Ocean only / dark only”.** Programme accepted Desert; this MP file is Ocean-only. Same screens, not forks.
4. **“Accept as known”** on noticed KC items vs review-before-write / Phase 3B. Flag. Do not implement a KC write bypass.
5. **Date edit in the prototype** vs D-029 (milestone complete has no durable status) and “don’t invent persistence.”
6. **Waiting as its own kind** in MP data vs dual Waiting authority in product. Do not invent a major Waiting architecture.
7. **Timeline still duplicated** with Important dates in both MP `App.tsx` and the product.
8. **Shared `Entity` type including `issue`** vs “do not assume everything is one Entity.” Word is hidden; do not implement Issue; do not build a generic Entity page.
9. **Capture / New Project / Desert / onboarding missing from this MP file** — still missing; do not invent screens.
10. **Dual Capture engines (D-032)** unchanged.
11. **D-030 leftover Knowledge prose** vs authoritative Risk/date frames — old sentences compete with current truth **in the shipping UI**.
12. **Advise vs leftover Coach** — MP says Coming soon; product still has a Coach overlay.
13. **PNG Due dates + colour dots** — v8 still shows priority dots on Risks. Confirm they stay quiet enough.

## Mapping stop rule

This table is **not** a licence to implement the visual overhaul in this PR. It is the live MP ↔ V2 ↔ architecture map. Paint follows Architecture reconciliation plus the PO items above.
