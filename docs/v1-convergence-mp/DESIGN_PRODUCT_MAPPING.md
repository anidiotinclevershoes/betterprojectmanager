# Design ↔ product state mapping

**Latest live Magic Patterns:** not retrieved (see `MP_RETRIEVAL.md`).  
**Do not read the MP column as “MP has no such screen”.** It means **unknown**.

**Repo visual constitution used as a provisional parent only:**  
`docs/v1-reference-pack/LUME_V1_UI_BASELINE_OCEAN.png` + `LUME_V1_UI_BASELINE_OCEAN.md` (19 Aug 2026).  
Desert, Capture V2 accounting, and New Project V2 categorisation **did not exist** when that PNG was uploaded.

## Classification key

| Code | Meaning |
| --- | --- |
| MP-UNK | Latest live MP unknown |
| CONST-YES | Represented in the 19 Aug Ocean PNG / UI baseline |
| CONST-STALE | In the constitution, but product or architecture has moved on |
| CONST-MISS | Required V2 / architecture state not in the PNG/baseline |
| PROD-YES | Exists in frozen V2 product |
| ARCH-CONFLICT | Conflicts with stated V1 architecture / this programme — **do not silently choose** |
| PO | Needs product-owner decision |
| LATER | Ready to implement later once design source + architecture are reconciled |

## Inventory (minimum set from the brief)

| Surface | Latest MP | 19 Aug constitution | Frozen V2 product | Architecture / notes | Class |
| --- | --- | --- | --- | --- | --- |
| Project shell / navigation | MP-UNK | Sidebar: projects, + New Project, Master To Do, History, Captures, Account, Help. No Overview / KC / Capture / Advise in sidebar | Matches constitution | Individual-first, selected-project centred | CONST-YES / PROD-YES / LATER |
| Capture (compose) | MP-UNK | Mode in selected project; PNG shows Capture tab, not compose internals | Ocean Capture mode in project workspace | Capture V2 is the **target** engine; flag still off by default (D-032) | CONST-STALE vs V2 / PO (flag default) |
| Capture observation accounting | MP-UNK | Not in PNG. Philosophy: account for what was heard | V2-only compact line: total / proposed / already known / Needs you / commentary. Merged counted in library, **not shown in the UI line** | Candidate principle: account for what it heard, not only what it will save. Keep cognitively light | CONST-MISS / PROD-YES (partial) / LATER |
| Capture Review | MP-UNK | Review-before-write is constitution; PNG is KC not Review | Compact cards, Current vs Suggested, Why panel, correction actions | Phase 3B is the write gate. Dual review language if flags stay dual (D-032) | CONST-MISS as a **screen** / PROD-YES / PO |
| Apply Ready | MP-UNK | Implied by review-before-write | Approve / Apply Ready / Remember | Binding | CONST-MISS as visual / PROD-YES / LATER |
| Needs you | MP-UNK | Allowed stronger treatment near top (baseline §14) | Review cards + Confirm Owner + item detail | Ambiguity that could alter truth → ask. Do not dump to Todo | CONST-YES (principle) / PROD-YES / LATER |
| No-change | MP-UNK | Not drawn | V2 `alreadyKnown` count; cards may still appear on legacy path | Must not look like a write | CONST-MISS / PROD-YES (partial) / LATER |
| Save / error | MP-UNK | Not drawn | `ocean-save-error` + reconcile | Phase 3A/3B persist-first on selected domains | CONST-MISS / PROD-YES / LATER |
| Loading | MP-UNK | Not drawn | Analyse busy; home “Loading workspace…” | Prefer deterministic skeletons over AI spinners where possible | CONST-MISS / PROD-YES / LATER |
| Empty states | MP-UNK | PNG is a populated Meridian project | Per-frame empty copy (“No open risks.” etc.) | Keep quiet; no giant slogan empties (baseline) | CONST-STALE / PROD-YES / LATER |
| Knowledge Centre | MP-UNK | **This is the PNG.** Three columns, Search vs Ask, suggested questions | Implemented Slice 2A; secondary frames by scroll | Image leads; do not redesign IA because a newer mockup *might* exist — **confirm latest MP first** | CONST-YES / PROD-YES / PO |
| People | MP-UNK | Rich `@person · responsibility` cards, Away ranges, Confirm owner | People & context frame + person detail drawer | **ARCH-CONFLICT:** current people are **project-scoped** stakeholders; programme wants **workspace-scoped Person + project participation**. UX must not treat people as disposable labels | ARCH-CONFLICT / PO |
| Responsibilities | MP-UNK | Scoped, not generic RACI | Structured `kind=responsibility` + `personId`; share vs replace | Keep many-to-many; share default | CONST-YES / PROD-YES / LATER |
| Availability | MP-UNK | `Away 1–12 Sep` on person cards | Structured availability when present; Capture writes or Needs you | Under-modelled calendar (D-020). Do not invent Away labels | CONST-YES / PROD-YES (partial) / LATER |
| Risks | MP-UNK | Risks & blockers column; PNG items have **Due dates** and colour dots | Domain `risks.status`; open/watch in frame; resolved must not resurrect | **CONST-STALE / ARCH:** PNG “Due” on risks can confuse current Risk status with dates. D-030 leftover prose can **visually compete** with current Risk truth | ARCH-CONFLICT (visual) / PO |
| Dates / milestones | MP-UNK | Important dates as a secondary frame in prose; PNG primary trio has Due on every card | `milestones` + Important dates frame + **duplicate Timeline embed**. Complete-milestone has no status (D-029) | Prefer one dates surface. Milestone complete = Needs you until architecture adds lifecycle | CONST-STALE / PROD-YES (duplicated) / PO |
| Todos | MP-UNK | To Do column with Due + dots | Domain todos; Master To Do page | Waiting todos also in Waiting frame | CONST-YES / PROD-YES / LATER |
| Decisions | MP-UNK | Secondary frame in baseline | `sections.decisions` cards + detail | Mostly Knowledge-authored; not a separate object store | CONST-YES / PROD-YES / LATER |
| Reminders | MP-UNK | Not in PNG | Todo `kind=REMINDER` only; setup-review option | Do not invent a Reminders app | CONST-MISS / PROD-YES (data only) / PO |
| Advise / Coach | MP-UNK | Advise Coming soon in PNG | Same disabled tab; Coach drawer + leftover `/coaching` | Advise is a selected-project mode, not a sidebar app. D-031 overlay is product debt | CONST-YES (coming soon) / PROD-YES / PO (Coach leftover) |
| Tell Me / Ask | MP-UNK | ✦ Ask Lume vs Search Knowledge | Implemented | Deterministic search; AI ask. Do not merge them | CONST-YES / PROD-YES / LATER |
| Meeting Prep | MP-UNK | Optional if stable | KC embed + `/meetings` | Not a truth authority | CONST-YES / PROD-YES / LATER |
| History | MP-UNK | Sidebar utility in baseline | `/history` page | Evidence/chronology — **not** current truth. Persist gaps D-004 | CONST-YES / PROD-YES / LATER |
| New Project Talk / Paste | MP-UNK | Lightweight + New Project in sidebar; PNG does not show the flow | Talk + Blank on choose. Paste **removed from choose** (still in API) | Messy input → organised map. Paste out of V1 constitution | CONST-MISS as a screen / PROD-YES / PO (paste remnants) |
| New Project categorisation | MP-UNK | **Does not exist** in 19 Aug artefacts | `NewProjectCategorisation` when V2 flag + OpenAI | Must stay light: recategorise / approve → setup review → durable. Not a wizard | CONST-MISS / PROD-YES / LATER |
| Setup review | MP-UNK | Not in PNG | `ProjectSetupReview` | Existing step; do not flatten into giant Review | CONST-MISS / PROD-YES / LATER |
| Blank New Project | MP-UNK | Not in PNG | Name + code; no V2 map | Keep fast path | CONST-MISS / PROD-YES / LATER |
| Account / Appearance | MP-UNK | Account in sidebar; **V1 dark-only / Ocean required** in baseline §3 | Account page + Ocean/Desert picker | **ARCH/CONST conflict:** Desert was **accepted** 25 Aug as additive. Constitution text still says Ocean-only. Themes must not fork screens | ARCH-CONFLICT (doc vs programme) / PO |
| Ocean | MP-UNK | **The PNG** | Default `data-theme="dark"` | Remains a full supported theme | CONST-YES / PROD-YES / LATER |
| Desert | MP-UNK | Explicitly “Desset” only if trivial token swap; not drawn | Additive token theme; same CSS/components | Do not replace Ocean. No theme-specific screen forks | CONST-MISS (visual) / PROD-YES / LATER |
| Onboarding / first-run | MP-UNK | Not a separate product in PNG | Zero projects = New Project first-run variant | **Unresolved V1 decision.** Related to NP, not the same problem | CONST-MISS / PROD-YES (defaulted to NP) / PO |
| Entity / Issue-like object | MP-UNK | Selectable cards + detail drawer in baseline | Drawer for current kinds; no Issue type | Do **not** force a generic Entity page. Extension points only | CONST-YES (pattern) / PROD-YES (partial) / PO (future Issue) |
| Current vs historical truth | MP-UNK | Evidence links on PNG frames; items look equally “present” | Domain frames vs leftover knowledge bullets (D-030); History page | PNG items can look like current truth even when they are dated prose. Needs a deterministic visual convention — architecture sibling owns the store | ARCH-CONFLICT (UX of leftover prose) / PO |

## Conflicts flagged for lead / product owner (not resolved here)

1. **Is the 19 Aug Ocean PNG still the approved MP V1?** If a newer live MP exists, this mapping is provisional.
2. **Person identity:** workspace-scoped (programme) vs project-scoped stakeholders (code). UX must not freeze the wrong model.
3. **Desert vs constitution “Ocean only / dark only”.** Programme accepted Desert; baseline text does not. Same screens, not forks — but the constitution should be updated or Desert should be challenged. Not silently chosen.
4. **PNG Due dates + colour dots on Current position / Risks** vs product rules (don’t call non-due dates Due; don’t badge-storm; Risk status is current truth).
5. **D-030 leftover Knowledge prose** vs authoritative Risk/date frames — old sentences compete with current truth **in the shipping UI**, constitution PNG would make that worse if copied literally.
6. **Dual Capture engines (D-032)** vs one Review language.
7. **Onboarding strategy** — currently implicit “just New Project”.
8. **Advise vs leftover Coach** — PNG says Coming soon; product still has a Coach overlay.

## Mapping stop rule

Per the brief: because live MP could not be retrieved, **this table is not a licence to implement a visual overhaul**. It is a product/architecture readiness map plus a constitution delta, waiting for the real MP identifiers.
