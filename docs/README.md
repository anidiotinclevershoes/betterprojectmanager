# Lume documentation

**Status:** Documentation authority map (28 August 2026)  
**Scope:** How to read Lume docs. This file does not replace product philosophy or current architecture.

Use this page first. Then read only what the task needs.

**v0.9 closed-alpha operating picture:** [`docs/LUME_V09_TO_V1_HANDOFF.md`](./LUME_V09_TO_V1_HANDOFF.md). That file is the current answer to what shipped, what is frozen, what debt remains, and the path to public V1. It does not replace the product constitution.

---

## Authority hierarchy

Later files do **not** automatically win. “Newest file wins” is **not** the rule.

### 0. v0.9 operating picture (closed alpha → V1)

`docs/LUME_V09_TO_V1_HANDOFF.md`

Governs:

- what v0.9 actually is;
- Capture freeze and qualification SHA;
- parked surfaces (Coach hidden, Advise coming soon);
- live two-account isolation evidence (including D-036);
- remaining debt classifications;
- tester-learning questions;
- the compact v0.9 → V1 roadmap.

If this file and an older PHASE / SLICE / experimental / architecture-flag table disagree on *current product reality*, **this file + the code win**.

### 1. Stable product / trust / UI constitution

`docs/v1-reference-pack/`

Governs:

- what Lume is;
- V1 product scope;
- trust principles;
- Capture review-before-write;
- Known / ✦ Lume noticed / Needs you;
- Ocean visual/interaction principles;
- development/evaluation governance, including the Plain-English standard for completion reports and checkpoints.

Stable product principles override historical *implementation* descriptions. They do **not** invent current code paths.

### 2. Current implementation architecture

`docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md`

Governs:

- what exists in the repository now;
- current truth authorities;
- runtime/persistence paths;
- feature flags;
- legacy/transitional systems;
- reusable helpers;
- current technical seams;
- **Part C** — binding V1 Architectural Convergence *target* decisions (26 Aug 2026). If Part A/B and Part C disagree on a target, Part C wins. If they disagree on what the code does now, the code wins.

If this handoff and the code disagree, **the code wins** and the handoff should be updated.

### 3. Living Known Discoveries

`docs/LUME_V1_KNOWN_DISCOVERIES.md`

Governs:

- what is currently open;
- what is resolved;
- known defects/debt;
- target resolution / validation points.

### 4. Relevant current operational / test documents

Use only when the task needs them (for example test safety-net, Supabase setup, Vercel production, Intelligence Contract, or the Lume Test Dashboard).

They do not override (1)–(3) unless they are the specific contract for that seam (Ask/eval scoring → Intelligence Contract).

Test evidence / model comparison: `docs/TEST_DASHBOARD.md`. This is an engineering Issue + Actions summary, not a Lume product surface.

### 5. Active plans

Plans describe **intended future work**. They do not override current architecture or code.

`docs/v1-convergence-mp/` is the Magic Patterns / V1 UX convergence **reference** (Workstream C). Live MP v8 is dumped unaltered under `docs/v1-convergence-mp/mp-source/`. V1 product decisions are in `docs/v1-convergence-mp/SPIDERMAN_AMENDMENT.md`. This pack does not replace the visual constitution in `docs/v1-reference-pack/` and it is not a licence to implement a UX overhaul. For V1 themes and KC scan order, the Spiderman amendment supersedes older Ocean-only / Current-position-first constitution wording.

### 6. Historical handovers / audits / screenshots

These explain why a change was made, previous architecture, historical testing/evaluation, and previous UI state.

They must **not** override current implementation reality.

> Historical documentation may explain why the implementation evolved but must not be treated as current implementation authority unless current code/current architecture documentation confirms it.

---

## Cursor / future-agent rule

Start with the documentation authority map. Read canonical product intent, current implementation architecture and Known Discoveries first. Read historical handovers only when relevant to the seam being extended. If historical documentation conflicts with current architecture or code, do not silently choose the historical description.

Product/trust constitution governs intended behaviour; current code/architecture handoff governs implementation reality; Known Discoveries governs known debt.

Completion reports, PR checkpoints, and slice handovers must include a Plain-English section written for the product owner. See `docs/v1-reference-pack/LUME_DEVELOPMENT_AND_EVALUATION_ROADMAP_V1.md` §19. Do not rewrite historical reports to match.

---

## Normal first-read set

For ordinary development:

1. `docs/README.md` (this file)
2. `docs/LUME_V09_TO_V1_HANDOFF.md` (what v0.9 is, freeze, isolation, remaining debt, V1 path)
3. `docs/v1-reference-pack/README.md`
4. `docs/LUME_V1_KNOWN_DISCOVERIES.md`
5. `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` (implementation map — **Part A flag tables that still describe `LUME_CAPTURE_V2` as optional are stale**; code + v0.9 handoff win)
6. only the relevant historical `SLICE*` handover when extending that particular seam
7. Intelligence Contract (`docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md`) when doing Ask / eval / intelligence-scoring work
8. `docs/v1-convergence/V09_QUALIFICATION.md` when citing Capture eval evidence (scorer **v3**; historical v1 counts are not current safety)
9. `docs/v1-convergence-mp/README.md` (and `SPIDERMAN_AMENDMENT.md`) when reconciling Magic Patterns / V1 UX (reference only; not an implementation licence)

`docs/EXPERIMENTAL_PROGRAMME.md` is **superseded** as current-engine guidance. Capture V2 is the sole live Analyse → Review → Apply engine. New Project V2 remains env-flagged (`LUME_NEW_PROJECT_V2`) and is on in current Production.

Then open operational docs only if the task is about tests, deploy, or persistence setup.

---

## If documents conflict

| Kind of question | Trust this | Do not silently prefer |
| --- | --- | --- |
| What should the product do? (trust, Capture, Ocean, V1 scope) | `docs/v1-reference-pack/`, except V1 KC scan order / Desert / first-run / Coach / Timeline / Accept-as-known UX rule → `docs/v1-convergence-mp/SPIDERMAN_AMENDMENT.md` | Historical handovers, old UI snapshots, root README product copy |
| What does the code do now? | The code, then the v0.9 handoff, then the Current Architecture Handoff (with stale Capture-flag caveat) | 19 Aug Project Truth Audit; `docs/current-state/`; SLICE/PHASE bodies; `docs/EXPERIMENTAL_PROGRAMME.md` flag tables |
| What is in v0.9 / what is frozen / what is next? | `docs/LUME_V09_TO_V1_HANDOFF.md` | Phase 3 “unfinished programme” language; old scorer-v1 counts; Coach-as-live-surface docs |
| What debt is open vs fixed? | Known Discoveries (open vs resolved sections) + v0.9 handoff §10 | Duplicate headings, historical “still missing” notes, plans |
| How should Ask/evals score? | Intelligence Contract, reconciled with the pack | Benchmark-chasing notes in old phase handovers |

A newer historical handover does **not** outrank the constitution, the current architecture handoff, or Known Discoveries.

---

## Historical (keep; do not treat as current)

Left in place on purpose. They record *why* the architecture evolved.

| Area | Examples | Role |
| --- | --- | --- |
| Pre-slice architecture snapshot | `docs/LUME_V1_PROJECT_TRUTH_ARCHITECTURE_AUDIT.md` (19 Aug 2026) | Original failure analysis; **superseded as an implementation map** |
| UI/application snapshot | `docs/current-state/` (11 Aug 2026) | Screenshots and pre-Ocean / pre-Supabase UI evidence |
| Slice / phase handovers | `docs/SLICE*.md`, `docs/PHASE*.md`, completion reports, `docs/V1_CONVERGENCE_ARCHITECTURE_COMPLETION.md` | Seam history when extending that slice; architecture review checkpoint |
| Older product copy | repository root `README.md` (corrected enough to point here; remaining Mission Control copy is historical) | Setup remnants; not current product/architecture authority |
| Experimental programme | `docs/EXPERIMENTAL_PROGRAMME.md` | Decision record from 25 Aug 2026. **Capture V2 is no longer experimental.** |
| Capture qualification (pre-freeze) | Historical “Stage 2 blocked” sections inside `docs/v1-convergence/V09_QUALIFICATION.md` | Chronology only; current status is at the top of that file |

Do not move or delete these in ordinary work. Do not rewrite them to pretend they always described today’s system.

---

## Maintenance (lightweight)

Not every PR must touch every document.

When a **substantive development slice** changes architecture:

- update `LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` if the current architecture map materially changed (including Part C if a convergence decision is completed or reversed);
- update `LUME_V1_KNOWN_DISCOVERIES.md` if open/resolved debt changed;
- create/update that slice’s handover, with a Plain-English section for the product owner (Roadmap §19);
- avoid copying mutable implementation status (feature flags, “not yet persisted”, Capture promotion state) into stable philosophy documents.

The goal is to minimise future documentation drift.
