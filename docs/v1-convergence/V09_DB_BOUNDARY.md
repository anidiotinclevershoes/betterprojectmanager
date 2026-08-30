# V0.9 DATABASE BOUNDARY QUALIFICATION

**TEST / RELEASE QUALIFICATION ONLY. Production was not modified. Do not merge.**

Candidate production: PR #110 (`cursor/v09-shared-truth-hardening-9524`, SHA `17ee289ceb609ae3daca6a72b515f9531c377234`)

This branch: `cursor/v1-v09-db-boundary-qual-610b`

```bash
npm run verify:v09-db-boundary
```

GitHub Actions (disposable local Supabase, no customer/prod credentials):

`.github/workflows/v09-db-boundary.yml`

Live run: https://github.com/anidiotinclevershoes/betterprojectmanager/actions/runs/33305388717  
HEAD: `092dfc8b15afa0be806be6fc22548472271621cc`  
Job `db-boundary`: **SUCCESS**. Verdict **PASS**. 20 PASS / 0 RED / 0 BLOCKED.  
`FakeWorkspaceClient`: not used.

The Cursor VM remains BLOCKED (no Docker). CI is the live path.

---

## Real DB qualification

**PASS** — disposable local Supabase on `ubuntu-latest`. Official #110 SQL files applied. Real `persist_*` RPCs called via `psql`.

| Check | Result |
| --- | --- |
| Environment | PASS — `postgresql://postgres:***@127.0.0.1:54322/postgres` |
| Migration | PASS — official files applied; seed checksum unchanged (`45318789549c70382c9453bd6f866cb1`) |
| Person | PASS — stakeholder + knowledge commit; injected knowledge-insert failure rolls both back |
| Risk | PASS — knowledge + risk commit; injected risks-insert failure rolls both back |
| Receipt | PASS — todo + receipt commit; receipt-insert failure rolls todo; same `operation_id` → `unique_violation`; distinct ops / same title → 2 todos / 2 receipts |
| Cascade | PASS — project delete removes receipts (`0/0`) |
| Rollback | PASS — SCHEMA FIRST → OLD APP direct `todos` insert; NEW APP → OLD SCHEMA unsupported (RPC absent after rewind); history `0 → 0` |
| CI workflow | PASS — `v0.9 DB boundary qualification` / `db-boundary` SUCCESS |
| Workspace scoping | PASS — user B JWT cannot write workspace A (`not a workspace member`) |
| History | PASS — `persist_*` bodies do not mention `history_events` |

### Compatibility

- **SCHEMA FIRST → OLD APP**: compatible. Additive unused objects. Load still ignores `capture_apply_receipts`. Residual: old app is non-atomic.
- **SCHEMA FIRST → NEW APP**: compatible after official SQL apply.
- **NEW APP → OLD SCHEMA**: unsupported. Deploy schema before the new app.

---

## Qualification harness

Against PR #110 production, test wiring only:

| Pack | PASS | EXPECTED_RED | UNEXPECTED_RED |
| --- | ---: | ---: | ---: |
| `verify:v09-adversarial` (16) | **15** | **1** (`empty-and-finished-project` seed Todo) | **0** |
| `verify:v09-adversarial-addendum` (3) | **3** | **0** | **0** |
| `test:v09-adversarial-ui` (2) | **2** | **0** | **0** |
| **Total** | **20** | **1** | **0** |

---

## Production changes

**NONE.**

Regression / e2e / Vercel reds on PR #111 are #110 production/test types and the Harbourline e2e suite. Out of scope here.

---

## Recommendation

**DB BOUNDARY QUALIFIED**

Do not merge this qualification PR.
