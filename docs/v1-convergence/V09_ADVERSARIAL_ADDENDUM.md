# V0.9 ADVERSARIAL ADDENDUM

**TEST ONLY. Production was not modified. Do not merge as a fix.**

Baseline: `09d85c07dec44a7a68be02cb98e0deffd96a4c1a`

Parent pack: `docs/v1-convergence/V09_ADVERSARIAL_QUALIFICATION.md` (draft PR #109)

This addendum closes three structural gaps from reconciling that pack with Nick Fury's audit. It is not another broad qualification pass.

```bash
npm run verify:v09-adversarial-addendum
```

Not on `npm test`. Does not edit long-haul PR #108.

---

## Person + responsibility partial write

**EXPECTED RED**

Production composition: `supabaseCaptureApplyHooks.confirmResponsibility` → `persistEnsureStakeholder` then `persistKnowledgeBullet` (`people` / responsibility). History is not in this sequence.

Injected failure: `knowledge_items` insert, **after** seed, so the first authoritative write (stakeholders) succeeds and the second fails.

Request: `executed.kind = failed` after a planned `confirm_responsibility` write (`Nadia Qureshi` / `UAT`).

**Exact rows left behind after failure + reload** (this run):

| Table | id | Fields |
| --- | --- | --- |
| `stakeholders` | `5a8d4144-be40-41ea-ae00-ab65ebdcaebf` | `project_id=aaaaaaaa-aaaa-4aaa-8aaa-ad00000000c1`, `name=Nadia Qureshi`, `role=UAT` |
| `knowledge_items` | — | **none added** |

Reload MissionState: person `Nadia Qureshi` is on the project. `sections.people` is empty. No structured `responsibility` row.

Half of the intended authoritative mutation survived. Not atomic.

---

## Risk dual-write partial write

**EXPECTED RED**

Production composition: `persistKnowledgeBullet(..., "risks")` inserts `knowledge_items` first, then `risks`. The second insert throw does not roll back the first.

Injected failure: `risks` insert (second authoritative write).

Request: `executed.kind = failed` for create `ALPHA-RISK-CANARY-split-brain`.

**Exact rows left behind after failure + reload** (this run):

| Table | id | Fields |
| --- | --- | --- |
| `knowledge_items` | `1237806a-4875-4563-ab0b-ac3d32315e89` | `project_id=aaaaaaaa-aaaa-4aaa-8aaa-ad00000000c1`, `section=risks`, `body=ALPHA-RISK-CANARY-split-brain` |
| `risks` | — | **none added** |

After reload:

- Knowledge / current-position risk prose: `["ALPHA-RISK-CANARY-split-brain"]`
- Domain `risks` table / `state.risks`: empty
- KC Risks & blockers (`buildOpenRiskRows`): card `kr-0` / `ALPHA-RISK-CANARY-split-brain` (knowledge fallback because domain is empty)
- Search: hits **Risks & blockers** and **Current position** for the canary
- Canonical Ask (`buildTellMeContext`, `useCanonicalTruth: true`): prompt mentions the canary

Lume can reach: knowledge says the risk exists **and** domain Risk authority says it does not.

---

## Stale Review / project switch

**PASS**

Smallest production path (no browser):

1. Analyse Capture on `ALPHA-CANARY-771` (`aaaaaaaa-aaaa-4aaa-8aaa-ad00000000a1`) — V2 resolve only, **no Apply**.
2. Ready CREATE item: `ALPHA-CANARY-771-CLOSE-CAB` with `item.projectId = A`.
3. Switch Apply request to `BETA-CANARY-992` (`aaaaaaaa-aaaa-4aaa-8aaa-ad00000000b2`) without re-analysing — the Ocean embed path `applyOne(item, defaultProjectId)` after the active project becomes B.
4. Apply the old Review item.

**Where the write landed:** nowhere.

`executed.kind = needs_you`  
`reason = "This finding's project is not in the current workspace."`

Planner world is project-scoped to B. `item.projectId` is A, so `resolveCaptureProjectScope` refuses. No new todo on A or B (only the New Project seed todos `Confirm project baseline with key stakeholders`).

This is stale Review refusal / project-bound Apply. It does **not** write to B because B is active. It also does **not** write back to A.

The reason string says “workspace” because scoped `world.projectIds` is what Apply passes into `resolveCaptureProjectScope`. Behaviour is still refuse-closed.

---

## Generic sibling loss

**NO**

The parent pack already persisted:

- five mixed-domain siblings (2 todos + risk + date + decision) with distinct titles / IDs
- 30 uniquely titled todos from one Capture, 30/30/30

There is no evidence of a generic sibling-Apply sequencing defect independent of create identity.

Long-haul sibling *loss* is explained by shared transcript-shaped durable identity plus existing exact-title / no-change (risk) and person identity-gate behaviour, not by Apply dropping later siblings.

PR #108 was not modified.

---

## Revised release blockers

**P0**

- Person + responsibility persist is not atomic: stakeholder row can survive a failed responsibility knowledge write.
- Risk create dual-write is not atomic: `knowledge_items` risk prose (and therefore KC / Search / Ask) can exist with no domain `risks` row.
- Still open from the parent pack: create titles = Apply `text`; transcript-as-`text` footgun; stale ISO date overwrite.

**P1**

- Still open from the parent pack: todo create replay duplicates; milestone create without ISO invents today.

**P2**

- Still open from the parent pack: empty-project seed todo / `thin=false`.
- Stale Review after project switch is **not** a new blocker (PASS).

---

## Recommendation

**READY FOR BOUNDED HARDENING**

Both new reds are local persist composition (no transaction / no compensating delete). Stale Review is already fail-closed on the production Apply path. Do not start a rewrite. Do not edit the long-haul oracle.

---

## Artefacts

- `scripts/verify-v09-adversarial-addendum.ts`
- `scripts/lib/fake-supabase-workspace.ts` (`armFailOnTable` — test seam only)
- `docs/v1-convergence/adversarial-addendum-results.json`
