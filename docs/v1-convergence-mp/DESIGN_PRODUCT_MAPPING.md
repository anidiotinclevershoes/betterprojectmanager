# Design ↔ product state mapping

**Latest live Magic Patterns:** v8 artifact `30fc8231-32b7-475b-bf5f-d8f6d44c8841`  
https://www.magicpatterns.com/c/gekwmrddrt3hkx7f1c9gm8/screens  
Unaltered source: `docs/v1-convergence-mp/mp-source/`

**19 Aug constitution** (`LUME_V1_UI_BASELINE_OCEAN.png` + `.md`) remains the Ocean visual parent. v8 is the live **Knowledge Centre + inspector** iteration. Desert, Capture V2 accounting, and New Project V2 categorisation are **not** in this MP file.

**Spiderman V1 decisions** (26 Aug): [SPIDERMAN_AMENDMENT.md](./SPIDERMAN_AMENDMENT.md). Frame order, onboarding, Desert, Accept-as-known UX rule, Timeline, Coach/Advise, current-truth chrome, and People/Entity direction are **decided**. `mp-source/` is unaltered.

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
| V1-DECIDED | Product-owner decision recorded in the Spiderman amendment |
| LATER | Ready to implement later once architecture is reconciled |

## Nine live MP screens vs product

| MP screen | Frozen V2 product | Architecture / notes | Class |
| --- | --- | --- | --- |
| 1 · Resting KC | `OceanKnowledgeFrames` + `OceanProjectWorkspace`. Product **primary trio** is still Current position, Risks, To Do. v8 top row is **To Do + Risks**; Current position sits below | **V1-DECIDED:** v8 order is the target. Shipping CSS / 19 Aug PNG remain Current-position-first until a later implementation PR | V1-DECIDED / MP-YES / PROD-YES / CONST-STALE |
| 2 · Risk inspector compact | `KnowledgeItemDetailDrawer` — body, previous value, provenance, Needs you, related `@person`. Not a 26rem overlay; KC can feel squeezed | Compact overlay (~26rem / 416px) must **not reflow** KC. Known = no badge. Risk `r-build` is ✦ Lume noticed | MP-YES / PROD-YES (drawer parent) / LATER |
| 3 · Risk · More details | Drawer “Why Lume believes this” + history/previous | Why / evidence / WHAT CHANGED behind More details. **Accept as known** is not a KC write licence — Architecture owns the safe path | MP-YES / V1-DECIDED (UX rule) / ARCH (mutation path) |
| 4 · Person · Elena Rostova | People frame + person drawer. Project-scoped stakeholder UUID | Inspector = “why this person matters now”, not CRM. Demo people are project-story objects. **Target:** workspace Person + project participation — Architecture owns schema | MP-YES / V1-DECIDED (direction) / ARCH |
| 5 · Connected · Payments pipeline | No first-class “Area of work” object; Dependencies frame is structured `kind=dependency` | `kind: "area"` is prototype grouping. Do not invent an Area store | MP-YES (navigation demo) / MP-MISS as a product type / PO |
| 6 · Connected · Decision | `sections.decisions` cards + drawer | Clickable structured refs; directional labels (`Decided by`) | MP-YES / PROD-YES (partial) / LATER |
| 7 · To Do inspector | Domain todos + drawer | Date popover is UX, not a persist licence. `Mark done` in prototype is local state | MP-YES / PROD-YES / LATER |
| 8 · Milestone · CAB approval | Important dates + **duplicate Timeline**. Complete-milestone has no status (D-029) | Semantic date labels (CAB / Freeze / Release / Away). Timeline must never be a date authority. Date edit in prototype ≠ durable write | MP-YES / PROD-YES / V1-DECIDED (Timeline rule) / ARCH D-029 |
| 9 · Needs you · Marcus Webb | Confirm Owner + Needs you reason in drawer/Review. No speculative AI solution menus in product Review | Statement + question only. Same conflict also lives on the Person card | MP-YES / PROD-YES / LATER |

## Inventory (brief minimum set)

| Surface | Live MP v8 | 19 Aug constitution | Frozen V2 product | Architecture / notes | Class |
| --- | --- | --- | --- | --- | --- |
| Project shell / navigation | Sidebar: projects, + New Project, Master To Do, History, Captures, Tom, Help. No Overview. Mode bar is **full-width** Capture \| KC \| Advise Coming soon | Matches | Matches; Account is a real page (MP shows “Tom”) | Individual-first | MP-YES / CONST-YES / PROD-YES / LATER |
| Capture (compose) | Tab only; no compose internals | Mode in selected project | Ocean Capture mode | Capture V2 is the **target** engine; flag off (D-032) | MP-MISS as a screen / PROD-YES / ARCH (D-032) |
| Capture observation accounting | Not in file | Philosophy only | V2 compact account line | Keep cognitively light | MP-MISS / PROD-YES (partial) / LATER |
| Capture Review | Not in file | Review-before-write constitution | Compact cards, Why, correction | Phase 3B is the write gate | MP-MISS as a **screen** / PROD-YES / LATER |
| Apply Ready | Not in file | Implied | Approve / Apply Ready / Remember | Binding | MP-MISS / PROD-YES / LATER |
| Needs you | Screen 9 + trust marks on cards. Statement + question; **no** AI solution menus | Stronger treatment near top (baseline §14) | Review cards + Confirm Owner + item detail | Ambiguity that could alter truth → ask | MP-YES (KC inspector) / PROD-YES / LATER |
| No-change | Not in file | Not drawn | V2 `alreadyKnown` count | Must not look like a write | MP-MISS / PROD-YES (partial) / LATER |
| Save / error | Not in file | Not drawn | `ocean-save-error` | Persist-first on 3B domains | MP-MISS / PROD-YES / LATER |
| Loading | Not in file | Not drawn | Analyse busy; home loading | Prefer deterministic skeletons | MP-MISS / PROD-YES / LATER |
| Empty states | Dependencies empty copy only | PNG is populated | Per-frame empty copy | Keep quiet | MP-YES (one frame) / PROD-YES / LATER |
| Knowledge Centre | **This is the v8 canvas.** Operational row first (To Do + Risks); Current position below; ten frames including Timeline | PNG primary trio: Current position, Risks, To Do | Same as constitution (Current position first) | **V1-DECIDED:** v8 scan order is the target | V1-DECIDED / MP-YES / CONST-STALE / PROD-YES |
| Compact inspector | Overlay `w-[26rem]`, dim, Escape = back then close, does not reflow KC | Selectable cards + richer detail | Side drawer (`KnowledgeItemDetailDrawer`) | Reuse drawer as parent; do not fork a second inspector | MP-YES / PROD-YES / LATER |
| People | Elena / Marcus / Priya / Sarah as project-story objects; `@` via `PersonMark`; Owns / Responsible for / Away / Chairs | Rich `@person · responsibility` | People frame + `PersonEntity` | **V1-DECIDED direction:** workspace Person + project participation. Schema is Architecture’s. UX language can survive | V1-DECIDED / ARCH |
| Responsibilities | Directional vocabulary locked in v8 data | Scoped, not generic RACI | Structured `kind=responsibility` | Keep many-to-many; share default | MP-YES / PROD-YES / LATER |
| Availability | Away ranges on Marcus / date object | `Away 1–12 Sep` | Structured availability when present | Under-modelled calendar (D-020) | MP-YES / PROD-YES (partial) / LATER |
| Risks | Frame + compact/more-details screens. Colour dots on cards. `r-build` is noticed | Risks column; PNG Due on risks | Domain `risks.status`; leftover knowledge bullets (D-030) | Leftover prose must not compete as current truth (V1 UX rule). Architecture owns D-030 data | MP-YES / V1-DECIDED (chrome) / ARCH (data) |
| Dates / milestones | Important dates + Timeline in the prototype (same as product). Semantic labels | Important dates secondary; PNG Due-on-everything | `milestones` + duplicate Timeline. D-029 | **V1-DECIDED:** Timeline is never a date authority — projection or deletion candidate. Milestone complete remains Architecture (D-029) | MP-YES / PROD-YES / V1-DECIDED / ARCH |
| Todos | Top-row frame + inspector | To Do column | Domain todos; Master To Do | Waiting todos also in Waiting frame | MP-YES / PROD-YES / LATER |
| Decisions | Frame + connected-decision screen | Secondary frame | `sections.decisions` | Mostly Knowledge-authored | MP-YES / PROD-YES / LATER |
| Reminders | Not in file | Not in PNG | Todo `kind=REMINDER` only | Do not invent a Reminders app | MP-MISS / PROD-YES (data only) / LATER |
| Advise / Coach | Coming soon tab only | Coming soon | Same disabled tab; Coach leftover | **V1-DECIDED:** Advise parked. Coach leaves the active shell (incl. D-031 auto-open). Do not redesign Coach here | MP-YES (coming soon) / PROD-YES / V1-DECIDED |
| Tell Me / Ask | Search vs ✦ Ask Lume | Same | Implemented | Do not merge them | MP-YES / PROD-YES / LATER |
| Meeting Prep | Frame present | Optional if stable | KC embed + `/meetings` | Not a truth authority | MP-YES / PROD-YES / LATER |
| History | Sidebar utility | Sidebar utility | `/history` page | Evidence — **not** current truth | MP-YES / PROD-YES / LATER |
| New Project Talk / Paste | `+ New Project` in sidebar only | Lightweight + New Project | Talk + Blank; Paste gone from choose | **V1-DECIDED:** Talk is first-run. Messy input → organised map, not a wizard | MP-MISS as a screen / PROD-YES / V1-DECIDED |
| New Project categorisation | **Not in file** | Does not exist in 19 Aug | `NewProjectCategorisation` when V2 flag | Not a wizard | MP-MISS / PROD-YES / LATER |
| Setup review | Not in file | Not in PNG | `ProjectSetupReview` | Do not flatten | MP-MISS / PROD-YES / LATER |
| Blank New Project | Not in file | Not in PNG | Name + code | Keep fast path | MP-MISS / PROD-YES / LATER |
| Account / Appearance | “Tom” / Sign out only | Account in sidebar; Ocean-only text in baseline §3 | Account + Ocean/Desert picker | **V1-DECIDED:** Ocean remains; Desert additive; same screens. Baseline Ocean-only wording is superseded | V1-DECIDED / PROD-YES |
| Ocean | **The v8 file.** Palette locked | **The PNG** | Default `data-theme="dark"` | Remains a full supported theme | MP-YES / CONST-YES / PROD-YES / LATER |
| Desert | Not drawn | “Desset” only if trivial token swap — **superseded** | Additive token theme; same CSS/components | Do not replace Ocean. No theme-specific screen forks | MP-MISS (visual) / PROD-YES / V1-DECIDED |
| Onboarding / first-run | Not in file | Not a separate product | Zero projects = New Project first-run variant | **V1-DECIDED:** retain New Project Talk. No sample/tutorial project | MP-MISS / PROD-YES / V1-DECIDED |
| Entity / Issue-like object | Shared `Entity` grammar **including `issue`**. User never sees the word; `typeLabel()` says Person / Risk / To do / Issue | Selectable cards + detail | Drawer for current kinds; no Issue type | **V1-DECIDED:** no generic Entity UI; no “Entity” in product language; Issue is an extension point only | MP-YES (hidden grammar) / V1-DECIDED |
| Current vs historical truth | RIGHT NOW vs More details (Why / WHAT CHANGED). Ordinary Known has no SOURCE up front | Evidence links; items look equally present | Domain frames vs leftover knowledge bullets (D-030); History page | **V1-DECIDED UX rule.** Architecture owns leftover prose as data | V1-DECIDED / ARCH |
| “Accept as known” | Inspector Why block, noticed items | Review-before-write | Capture Review + Phase 3B apply | **V1-DECIDED:** not a KC write licence. If kept, only structured/provisional/Needs-you via the safe mutation/review path. Architecture owns the boundary | V1-DECIDED / ARCH |
| Waiting as its own kind | `kind: "waiting"` objects in a frame | Waiting & open loops frame | Dual authority (todos + `sections.openLoops`) D-008/D-021 | v6 prompt: do not invent a major Waiting architecture. **Still Architecture** | MP-YES (prototype kind) / ARCH |
| Date popover | Deterministic `DatePopover` / `DateEditor` on cards | Not this interaction | No in-card calendar; dates in drawer / Capture | UX pattern only — D-029 / persist-first still apply | MP-YES / PROD-MISS interaction / LATER |

## Conflicts — Spiderman resolved vs still Architecture

**Resolved for V1 (do not reopen as UX choices):**

1. **Frame order** — v8 (To Do + Risks first) is the V1 target. Constitution/product Current-position-first is current implementation until a later PR.
2. **Desert** — additive; Ocean remains; same screens. Baseline Ocean-only wording is superseded.
3. **Onboarding** — New Project Talk; no sample project.
4. **“Accept as known”** — not a KC write licence; Architecture owns the safe path.
5. **Timeline** — never a date authority; projection or deletion candidate.
6. **Advise / Coach** — Advise parked; Coach leaves the active V1 shell.
7. **Current-truth chrome** — domain frames vs Needs you vs History/evidence. Architecture still owns leftover-prose **data**.
8. **People / Entity** — workspace Person + project participation is **target direction**; no generic Entity UI; Issue is an extension point only. Architecture owns schema.

**Still Architecture (or later implementation), not product-owner UX:**

1. **Date edit in the prototype** vs D-029 (milestone complete has no durable status) and persist-first.
2. **Waiting dual authority** (D-008/D-021). Do not invent a major Waiting architecture.
3. **Capture / New Project screens missing from this MP file** — do not invent MP canvases; product behaviour already exists.
4. **Dual Capture engines (D-032).**
5. **D-030 leftover Knowledge prose as data** vs authoritative Risk/date frames.
6. **PNG / v8 priority dots on Risks** — keep quieter than a badge storm at implementation time; not a new store.
7. **Timeline keep-as-projection vs delete** — judged after MP implementation if it adds no distinct V1 value.

## Mapping stop rule

This table is **not** a licence to implement the visual overhaul in this PR. Paint follows Architecture reconciliation. The Spiderman product decisions are recorded so later implementation does not re-litigate them.
