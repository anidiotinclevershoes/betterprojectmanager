# Lume documentation

**Status:** Documentation authority map (12 September 2026)  
**Scope:** What to read, and what is allowed to govern implementation.  
**Current integration line:** `main`.  
**Baseline this map was reconciled against:** `e0f140d67b3be7ecc51dd5c4056338a12b4d244c` (PR #170 on `9f24a65`).

**Use this page first.** Then read only what the task needs.

A new Cursor agent should recover Lume’s product, architecture, safety and data-durability rules from this hierarchy without external conversation history.

`cursor/capture-v2-desert-new-project-56c9` and historical experiment PRs #119–#123 / #120 are salvage/reference only. Do not merge them.

Before substantial implementation: `npm run git:preflight`. **MATERIALLY STALE = STOP.**

Before material schema / domain / persistence work: answer the ten questions in [`docs/LUME_DURABLE_PROJECT_TRUTH.md`](./LUME_DURABLE_PROJECT_TRUTH.md) §6. If a real user could lose data, need to recreate a project, or have truth silently reinterpreted: **STOP AND ESCALATE TO PRODUCT OWNER.**

---

## Authority hierarchy

Later files do **not** automatically win. “Newest file wins” is **not** the rule.

There is **one** current architecture constitution. Specialist contracts own detail for one subject. Historical files keep history.

### 1. Concise entry (this file)

What to read. What is authoritative. What is historical.

### 2. Product / architecture constitution

[`docs/LUME_CONSTITUTION.md`](./LUME_CONSTITUTION.md)

Durable high-order rules: thesis, core V1 modes, the two peer invariants, Capture AI/deterministic boundary, Review vs domain, tags, New Project rules, operating principles, data-model preflight, destructive-change STOP.

Longer product / trust / Ocean UI philosophy remains in [`docs/v1-reference-pack/`](./v1-reference-pack/). For V1 KC scan order / Desert / first-run / Coach / Timeline / Accept-as-known UX, [`docs/v1-convergence-mp/SPIDERMAN_AMENDMENT.md`](./v1-convergence-mp/SPIDERMAN_AMENDMENT.md) supersedes older Ocean-only wording. The amendment is not a licence to implement a UX overhaul.

### 3. Specialist contracts

| Subject | Document |
| --- | --- |
| Canonical Project Truth (write then project) | [`docs/LUME_CANONICAL_PROJECT_TRUTH.md`](./LUME_CANONICAL_PROJECT_TRUTH.md) |
| Durable Project Truth (existing-project compatibility) | [`docs/LUME_DURABLE_PROJECT_TRUTH.md`](./LUME_DURABLE_PROJECT_TRUTH.md) |
| Current Capture position | [`docs/LUME_CAPTURE_STATUS.md`](./LUME_CAPTURE_STATUS.md) |
| V1 trust families (reconciled) | [`docs/LUME_V1_TRUST_ISSUE_MAP.md`](./LUME_V1_TRUST_ISSUE_MAP.md) |
| Deferred product semantics | [`docs/LUME_PRODUCT_DECISIONS.md`](./LUME_PRODUCT_DECISIONS.md) |
| Ask / eval scoring | [`docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md`](./LUME_INTELLIGENCE_CONTRACT_V0.2.md) |

### 4. Living status / discoveries

[`docs/LUME_V1_KNOWN_DISCOVERIES.md`](./LUME_V1_KNOWN_DISCOVERIES.md) — open vs resolved debt.

[`docs/LUME_V09_TO_V1_HANDOFF.md`](./LUME_V09_TO_V1_HANDOFF.md) — v0.9 closure operating picture: what shipped, parked surfaces, leftover inventory, isolation evidence. High-order invariants now live in the constitution and specialist contracts. If they disagree, **constitution + specialist contracts + current code win**.

The code on current `main` is the implementation map. [`docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md`](./LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md) is **HISTORICAL**.

### 5. Historical / experimental

Slice, phase, current-state, experimental-programme, old qualification and architecture-review files. Useful context. They must not drive implementation.

---

## Current contracts to honour (short)

- **Canonical truth:** UI action → canonical truth → projections refresh. No parallel stores.
- **Durable truth:** never strand persisted project truth. Prefer additive evolution; otherwise an explicit deterministic migration.
- **Capture:** AI extracts; deterministic Lume validates; Review stages; Apply writes. Prompt A is production. Deterministic routing accepted at **534/538**. See Capture status.
- **Timeline / Catch Me Up:** projections over project truth. Catch Me Up is a derived briefing surface (it may appear as a project-page tab). Neither is a source of truth.
- **Tags:** retrieval metadata only.
- **Ready → Apply:** Ready means the same production Apply path can execute that change. Apply still revalidates.
- After a successful Apply, never adopt pre-write state. Capture session binds to the open project.

---

## Normal first-read set

For ordinary development:

1. `docs/README.md` (this file)
2. `npm run git:preflight` and `AGENTS.md`
3. `docs/LUME_CONSTITUTION.md`
4. the specialist contract the task touches (canonical / durable / Capture)
5. `docs/LUME_V1_KNOWN_DISCOVERIES.md`
6. the code on current `main`
7. `docs/LUME_V09_TO_V1_HANDOFF.md` when you need leftovers, isolation evidence, or v0.9 shipped scope
8. `docs/v1-reference-pack/` when you need product/trust/UI philosophy
9. only the relevant historical `SLICE*` / `PHASE*` handover when extending that seam
10. Intelligence Contract when doing Ask / eval / scoring work

Then open operational docs only if the task is about tests, deploy, or persistence setup.

Human-only dashboard/credential actions: [`docs/V1_USER_ACTIONS.md`](./V1_USER_ACTIONS.md). Not an architecture map.

Test evidence / model comparison: `docs/TEST_DASHBOARD.md`. Engineering Issue + Actions summary, not a Lume product surface.

Hosted live-OpenAI vertical journeys (opt-in, never `npm test`): [`e2e-hosted-vertical/README.md`](../e2e-hosted-vertical/README.md).

Production long-run dogfood (opt-in, never `npm test`): [`e2e-hosted-longrun/README.md`](../e2e-hosted-longrun/README.md).

Integrity probes (read-only / in-memory; no production daemon):

```bash
npm run verify:adversarial-integrity
npm run verify:dogfood-integrity-gate
```

SQL printed by the adversarial script is for operators on a copy of dogfood data. Do not run it as a migration.

---

## If documents conflict

| Kind of question | Trust this | Do not silently prefer |
| --- | --- | --- |
| High-order product / architecture rule | `docs/LUME_CONSTITUTION.md` + the named specialist contract | Historical handovers, root README, `MISSION.md` |
| Product / trust / Ocean UI philosophy | `docs/v1-reference-pack/`, except the Spiderman amendment deltas | Historical UI snapshots |
| Current Capture position | `docs/LUME_CAPTURE_STATUS.md` | `V09_QUALIFICATION.md` “Stage 2 BLOCKED”; experiment PRs; Prompt E |
| What the code does now | The code on current `main` | Architecture Memory Handoff (26 Aug); 19 Aug Project Truth Audit; `docs/current-state/`; SLICE/PHASE bodies |
| What shipped in v0.9 / leftovers / isolation | `docs/LUME_V09_TO_V1_HANDOFF.md` | Phase 3 “unfinished programme” language; Coach-as-live-surface docs |
| What debt is open vs fixed | Known Discoveries | Duplicate headings, historical “still missing” notes |
| Ask / eval scoring | Intelligence Contract | Benchmark-chasing notes in old phase handovers |
| Existing-project compatibility | `docs/LUME_DURABLE_PROJECT_TRUTH.md` | “Start again”; backups-as-migration |

---

## Historical (keep; do not treat as current)

Left in place on purpose. They record *why* the architecture evolved.

| Area | Examples | Role |
| --- | --- | --- |
| Pre-slice architecture snapshot | `docs/LUME_V1_PROJECT_TRUTH_ARCHITECTURE_AUDIT.md` (19 Aug 2026) | Original failure analysis |
| Architecture memory handoff | `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` | 26 Aug desert-era snapshot. **HISTORICAL.** Part C targets may still inform V1. |
| Adversarial integrity audit | `docs/LUME_ADVERSARIAL_INTEGRITY_AUDIT.md` | Findings plus CLOSED D-045–D-048. Not a second architecture map. |
| UI/application snapshot | `docs/current-state/` (11 Aug 2026) | Pre-Ocean / pre-Supabase UI evidence |
| Slice / phase handovers | `docs/SLICE*.md`, `docs/PHASE*.md`, `docs/V1_CONVERGENCE_ARCHITECTURE_COMPLETION.md` | Seam history |
| Older product copy | root `README.md`, `docs/MISSION.md` | Mission Control framing. Not current product definition. |
| Experimental programme | `docs/EXPERIMENTAL_PROGRAMME.md` | 25 Aug 2026 decision record. Capture V2 is no longer experimental. |
| Capture qualification (pre-freeze) | `docs/v1-convergence/V09_QUALIFICATION.md` | Chronology. “Stage 2 BLOCKED” is not current. |
| v0.9 test / UX convergence packs | `docs/v1-convergence/`, `docs/v1-convergence-mp/` | Test foundation and UX reference. Not implementation licences. |
| Desert / experiment branches | `cursor/capture-v2-desert-new-project-56c9`; PRs #156 #163 #165 #166 #168 | Salvage / observe-only. Do not merge wholesale. |

Do not move or delete these in ordinary work. Do not rewrite them to pretend they always described today’s system.

---

## Cursor / future-agent rule

Start here. Read the constitution, the specialist contract you are touching, Known Discoveries, then code. Read historical handovers only when relevant to that seam.

If historical documentation conflicts with the constitution, a specialist contract, or current code, do not silently choose the historical description.

Completion reports, PR checkpoints, and slice handovers must include a Plain-English section for the product owner. See `docs/v1-reference-pack/LUME_DEVELOPMENT_AND_EVALUATION_ROADMAP_V1.md` §19.

---

## Maintenance (lightweight)

Not every PR must touch every document.

When a **substantive development slice** changes architecture or product rules:

- update `docs/LUME_CONSTITUTION.md` or the owning specialist contract if a durable rule changed;
- update `docs/LUME_CAPTURE_STATUS.md` if the accepted Capture position changed;
- update `docs/LUME_V1_KNOWN_DISCOVERIES.md` if open/resolved debt changed;
- update `docs/LUME_V09_TO_V1_HANDOFF.md` only if leftover inventory / shipped v0.9 reality changed;
- create/update that slice’s handover, with a Plain-English section (Roadmap §19);
- do **not** revive `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` as the current architecture map;
- avoid copying mutable implementation status into the constitution or the v1-reference-pack philosophy.

The goal is one spine, not many documents each claiming to be current architecture.
