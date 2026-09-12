# Lume V1 — Trust issue map

**Status:** Living reconciliation (12 September 2026)  
**Integration line:** `cursor/v1-trust-convergence-df02`  
**Clean main this map starts from:** `e0f140d67b3be7ecc51dd5c4056338a12b4d244c` (PR #170 merged onto `9f24a65`)  
**Immutable Before baseline:** `e2e-hosted-longrun/baselines/first-complete-run/` run `lr-20260912T2212Z`  
**Docs entry:** [`docs/README.md`](./README.md)

This is the **one** current issue map for V1 trust. It reconciles prior parallel diagnosis, D-053 production long-run, Known Discoveries, current code, and current tests.

It is **not** a second architecture constitution. High-order rules stay in [`LUME_CONSTITUTION.md`](./LUME_CONSTITUTION.md) and the specialist contracts.

---

## Evidence hierarchy (when sources conflict)

1. Current production evidence (`lr-20260912T2212Z` + SQL audit)
2. Current production code on `main`
3. Authoritative Lume contracts
4. Latest deterministic / hosted tests
5. Historical diagnoses and handoffs

The earlier parallel conclusion «no remaining P0 integrity blockers / mostly hardening» is **superseded** by the untouched production 50-Capture E2E. Individual investigations from that diagnosis remain useful where not contradicted.

---

## Repository authority (this checkpoint)

| Item | Value |
| --- | --- |
| `origin/main` | `e0f140d` — PR #169 docs + PR #170 long-run programme |
| Open implementation PRs | none (competing experiment / stale visual / reconstruct PRs closed) |
| Retained historical branches | experiment / salvage only (`#156` `#163` `#165` `#166` `#168` `#155` families). Do not merge wholesale. |
| One integration line | this branch. Specialists investigate; implementation lands serially here. |

---

## Families

| Family | Evidence | Current behaviour | Root boundary (working) | Severity | Product decision? | Fix required? | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A. Wrong-target / entity resolution** | C18 Ready-applied DDA ramp `fb74aa0f` open→resolved after timber-floor create never existed | **Fixed on this branch (deterministic).** Resolve/complete of a model UUID now requires observation-local title evidence; competing proposed titles fail closed. | `scopedEntityIdentityGate` + rematerialise. Model IDs are not identity. | **P0** | No | Landed — `scripts/verify-wrong-target-identity.ts` | Identity suite + long-run After still required |
| **B. Silent empty Capture / Review** | C31–C50: SQL hash frozen after C30; empty Review not Needs You | **Fixed on this branch (deterministic).** Meaningful empty extraction or unsupported cancel/retire becomes Needs You. Already-known no_change stays accounted. | `toResult` empty-Review guard. Do not invent writes. | **P0** | Partial (cancel/retire semantics still deferred — now voiced) | Landed — `scripts/verify-empty-capture-honesty.ts` | Long-run After still required |
| **C. Responsibility canonical path** | State 0 + ownership Captures → `0` `knowledge_items.kind=responsibility` | **Fixed on this branch (deterministic).** NP notes keep explicit scopes; C8-class wrong-type id binds evidenced Tomos. Role-only and Pippa stay fail-closed. | NP adapter + person identity fall-through + ownership rematerialise. One `knowledge_items.kind=responsibility` path. | **P0** | No | Landed — `scripts/verify-responsibility-canonical-path.ts` | NP Person+resp; existing Person+resp; long-run After |
| **D. Clear Create / false Needs You** | C5, C11, C16 — “Which existing item?” + Create-new offered | **Fixed on this branch (deterministic) with A.** Risk + undated To Do rematerialise as Create; first-name Create allowed only when no existing first-name collision (Pippa stays Needs You). | Shared rematerialise root with A | **P1** | No | Landed — same verify script | C5/C11/C16 fixtures green; Pippa still Needs You |
| **E. Update receipts / idempotency** | Creates had receipts; updates of existing State 0 rows had history only | **Contract established.** Receipts protect create/mint identity. Existing-row updates are idempotent by stable id — replay does not duplicate. | `memory-execute` identity updates | **P2 accepted** | No | Landed — `scripts/verify-update-idempotency.ts` | No broad receipt schema change |
| **F. Persist-trust remainder (D-005)** | Known: Confirm Owner / some To Do still optimistic-then-persist | **Fixed on this branch.** Mounted V1 edits persist before paint. Failed persist leaves prior UI state. | `store.tsx` persist-first | **P1** | No | Landed — `scripts/verify-mounted-persist-trust.ts` | Force persist error; UI must not show durable success |
| **G. Projection authority** | D-030 leftover Knowledge still `current` after DDA resolve; D-008/D-021 waiting + open_loop | **D-030 presentation already landed; proved here.** Resolved domain risks are not current KC/Search cards. Historical prose may remain. Waiting vs open_loop authority remains D-008 (not this slice). | Existing KC builders | **P2** | Yes for general Knowledge supersede — **deferred** | Presentation proof only — `scripts/verify-projection-authority.ts` | Do not invent retire semantics |
| **H. Hydration / first paint** | C10/C30 thin first paint, correct after reload/SQL | **Existing Family 1 protection stands.** `adoptAppliedState` writes confirmed Apply state into the paint cache (`verify-apply-authoritative-first-paint`). No extra client cache invented. | Apply reload + paint cache | **P1 closed in code; After-run still required** | No | No additional product change | Apply then first paint vs SQL on After-run |
| **Harbourline / Quinn CI** | `e2e/stress-journeys` h1: Quinn not painted | Frozen envelope used paraphrased evidence; D-051 fail-closed | Fixture, not identity weakening | **P1 CI** | No | Yes — verbatim quote in fixture | `verify:eval-stress` + Harbourline e2e |
| **D-050 hosted schema** | Later long-run SQL proved runtime | Not an active hosted mystery | Operator docs only | closed | No | Docs only | Audit optional; do not replay history |

Clustered roots:

1. **Unmatched create → false Needs You → later same-domain bind** (A + D, C18 depends on C5)
2. **Responsibility never written** (C; D-051/D-007 remainder)
3. **Empty Review honesty** (B; plus deferred product-model gaps)
4. **Persist / paint confirmation** (F + H)
5. **Projection precedence** (G; no new supersede semantics)

---

## What the earlier “0 P0” diagnosis still got right

- D-045–D-048 Apply reload / fingerprint / session bind / create receipts remain closed.
- Observation-local identity (D-051) is a real protection; C18 is not licence to weaken it.
- Prompt A stays production; Prompt E stays rejected.
- Milestone cancel / Knowledge retire / cancellation-as-Knowledge remain product-model gaps, not extraction bugs.
- Hosted runtime objects were already aligned despite ledger drift (D-050).

## What production E2E superseded

- “No remaining P0 integrity blockers”
- Confidence that Ready→Apply cannot write a wrong same-domain target
- Confidence that unmatched creates rematerialize for every domain
- Confidence that responsibilities persist from Organise or Capture
- Confidence that empty Review is an acceptable fail-closed

---

## Product decisions (do not invent)

See [`LUME_PRODUCT_DECISIONS.md`](./LUME_PRODUCT_DECISIONS.md). These do **not** block Families A–D engineering.

---

## Shared-file ownership (this line)

While this branch is open, it owns:

- `src/lib/capture/**` and `src/lib/capture-v2/**`
- persist / load paths and `src/lib/store.tsx` if a slice needs them
- shared authoritative types
- no schema/migrations unless a later slice answers the ten durable-truth questions with #10 = NO
