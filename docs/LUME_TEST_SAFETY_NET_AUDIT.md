# Lume Test Safety Net — Audit & Baseline

**Date:** 19 August 2026  
**Status:** Baseline established  
**Authority:** `docs/v1-reference-pack/`  

This document records Stage 1 (existing audit) and Stage 2 (safety net) outcomes. It does not change product behaviour.

---

## A. Existing test tools (before this work)

| Tool | Role |
| --- | --- |
| `scripts/verify-*.ts` (tsx + `node:assert`) | Primary product / pipeline regression |
| `scripts/run-pre-intelligence-baseline.ts` + evals | Live AI benchmark (OpenAI) |
| `scripts/verify-tenant-isolation.ts` / `verify-phase2-persistence.ts` | Live Supabase (skip without creds) |
| `tsc --noEmit` | Static TypeScript |
| `eslint` | Lint |
| GitHub Actions | **None previously** |
| vitest / jest / playwright | **Not used** (no framework migration) |

### Separation

| Class | Purpose |
| --- | --- |
| **Product regression** | Deterministic guarantees (truth, isolation, Capture boundary, Search) |
| **AI evaluation** | Probabilistic model quality (45-case suite, calibration, token estimates) |

A green benchmark does **not** prove product safety. A deterministic regression does **not** require OpenAI.

---

## B. Coverage map (after baseline)

| Behaviour | Rating | Evidence |
| --- | --- | --- |
| authentication / project isolation | PARTIAL | RLS static + live tenant (creds); app-level isolation in new safety scripts |
| project creation | PARTIAL | `verify-new-project`; live persist when creds |
| Supabase hydration | PARTIAL | `verify-hydrate-session` (source/unit); live load when creds |
| MissionState persistence | PARTIAL | Local seed-reset; live phase2; not full entity matrix offline |
| Knowledge add | PARTIAL | Capture remember + live; reconcile inserts characterised |
| Knowledge edit | STRONG | `verify-knowledge-reconcile` + `verify-project-truth-safety` |
| Knowledge delete/reconcile | STRONG | Same |
| Knowledge stable identity | COVERED | Exact body + stable id + unique wording-edit; unrelated same-index → insert+delete (Slice 1A.1) |
| Risk lifecycle authority | COVERED | `risks.status` authoritative; resolve → reload does not resurrect (Slice 1B) |
| provenance/metadata preservation | STRONG | Reconcile + remap tests |
| Capture input | PARTIAL | Context/prompt verifies |
| Capture analysis boundary | PARTIAL→STRONG | Findings/golden + new trust-boundary characterisation |
| Capture review-before-write | STRONG | Review counts/ready + trust-boundary |
| Capture apply | PARTIAL | Local review; live apply round-trip = known gap without creds |
| To Do CRUD | PARTIAL | Findings/workspace; live todo when creds |
| Risk lifecycle | COVERED | `verify:risk-lifecycle` + project-truth-safety (Slice 1B) |
| People/stakeholders | PARTIAL | Onboarding + confirm-owner scope tests |
| scoped responsibility | STRONG | `verify-canonical-truth` + safety script |
| milestones/dates | PARTIAL | Context/Tell Me; no dedicated CRUD suite |
| History | PARTIAL | Tell Me / seed; persist gaps known |
| Search | STRONG | Tell Me + safety script |
| Tell Me/Ask context | STRONG | tell-me / trust / context-integrity / canonical |
| canonical assembler | STRONG | `verify-canonical-truth` |
| snapshots | PARTIAL | Tell Me deterministic snapshot |
| local persistence mode | STRONG | Mode switch tests + most verifies local |
| cross-project contamination | STRONG | Capture context + reconcile + suggestions isolation |

---

## C. Trust-critical gaps (prioritised)

Living detail: **`docs/LUME_V1_KNOWN_DISCOVERIES.md`**.

1. Confirm Owner non-UUID persist + stakeholders dual-write (D-001, D-002)  
2. Suggestion accept/dismiss memory-only (D-003)  
3. Invisible save failures (D-005)  
4. Live hydrate/edit / Capture apply round-trip without credentials in CI (D-014)  
5. ~~Slice 1A.1 unrelated replacement identity~~ — fixed  
6. ~~Slice 1B resolved risk resurrection~~ — fixed  

When a slice finds a new adjacent defect, add it to the Known Discoveries backlog (do not greenwash).  

---

## D. Testing architecture (chosen)

Keep **tsx verify scripts** (no framework rebuild).

Layers:

1. **Unit / domain** — reconcile, serialize, confirm-owner, search, persistence mode  
2. **Characterization** — Capture review readiness, known gaps as skips  
3. **Integration (optional live)** — tenant isolation / phase2 persistence when creds  
4. **Workflow** — Capture trust boundary + Knowledge reconcile plans  
5. **E2E** — deferred (no Playwright suite yet)  
6. **AI eval** — separate `evals:*` / `verify:evals*` — not in default `npm test`

Default command: **`npm test`** (= `npm run verify:regression`).
