# V0.9 DATABASE BOUNDARY QUALIFICATION

**TEST / RELEASE QUALIFICATION ONLY. Production was not modified. Do not merge.**

Candidate production: PR #110 (`cursor/v09-shared-truth-hardening-9524`, SHA `17ee289ceb609ae3daca6a72b515f9531c377234`)

This branch: `cursor/v1-v09-db-boundary-qual-610b`

```bash
npm run verify:v09-db-boundary
```

GitHub Actions (disposable local Supabase, no customer/prod credentials):

`.github/workflows/v09-db-boundary.yml`

The Cursor VM remains BLOCKED (no Docker). CI is the live path.

---

## Real DB qualification

**BLOCKED**

This repository already supports local Supabase (`supabase/config.toml`, `supabase start`) and optional live tenant tests (`.env.local` URL + service role). This environment has **none** of:

| Missing | Why it matters |
| --- | --- |
| Docker | Required for repo-supported `supabase start` |
| `supabase` CLI on PATH | Local stack driver |
| `psql` | Direct SQL against a disposable Postgres |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` | Existing live-test pack (`verify:tenant-isolation`) |

Did **not** invent a production instrumentation seam. Did **not** install an ad-hoc Postgres and pretend it is the Lume boundary. Did **not** touch customer/prod data.

Application-level fake RPCs (`FakeWorkspaceClient.runAtomic`) already PASS H2/H3 on PR #110. That is **not** the database boundary.

### Migration evidence (schema text only)

`20260829120000_capture_apply_receipts.sql` and `20260829200000_authoritative_apply_tx.sql`:

- `CREATE TABLE capture_apply_receipts` + RLS + grants
- `CREATE OR REPLACE FUNCTION` for `persist_person_responsibility`, `persist_risk_with_knowledge`, `persist_todo_create_with_receipt`, `persist_milestone_create_with_receipt`
- No `ALTER` / `DROP` / `UPDATE` of existing `todos`, `risks`, `stakeholders`, `knowledge_items`, `milestones`, `projects`, `workspaces`

Live “migrations apply from current main schema” and “representative rows survive unchanged” are **unexecuted**.

### Transaction evidence (SQL contract, not live)

Each RPC is a single `plpgsql` function. Postgres runs the body in one transaction: a later `INSERT` failure aborts the function and rolls back earlier inserts in that call. History is not inside these functions.

| Check | Live | Schema/app |
| --- | --- | --- |
| 3/5 success commits both | BLOCKED | function body inserts both |
| 4/6 second-step failure rolls back both | BLOCKED | implicit function transaction |
| 7/8 create + receipt atomic | BLOCKED | truth then receipt in one function |
| 9 duplicate `operation_id` | BLOCKED live | `UNIQUE (workspace_id, project_id, operation_id)` |
| 10 project delete cascades receipts | BLOCKED live | `REFERENCES projects(id) ON DELETE CASCADE` |
| 11 workspace/project scoping | BLOCKED live | RLS `is_workspace_member`; receipt insert checks `projects.workspace_id` |

---

## Rollback / deployment compatibility

**Safe** for: **schema deployed, then application rolled back to pre-#110.**

- New objects are unused by the old application.
- `loadMissionStateFromSupabase` does not select `capture_apply_receipts` (receipts are not project truth).
- Old create paths still insert `todos` / `risks` / `stakeholders` / `knowledge_items` directly.
- Residual: rolled-back app is again non-atomic (the #110 defect). That is not a crash.

**Concern** for the opposite order: **new application + old schema** (RPCs missing) — create Apply would fail. Deploy schema before the new app.

---

## Qualification harness

Against PR #110 production, test wiring only:

| Pack | PASS | EXPECTED_RED | UNEXPECTED_RED |
| --- | ---: | ---: | ---: |
| `verify:v09-adversarial` (16) | **15** | **1** (`empty-and-finished-project` seed Todo) | **0** |
| `verify:v09-adversarial-addendum` (3) | **3** | **0** | **0** |
| `test:v09-adversarial-ui` (2) | **2** | **0** | **0** |
| **Total** | **20** | **1** | **0** |

Wiring fixes (assertions unchanged):

1. `semantic-contract-atomic-titles` — assert created Todo `UAT script`, Risk `API timeout`, Milestone `CAB`. Ignore New Project seed Todo.
2. `review-edit-integrity` — user edit via production Review `item.content` (`reviewEdit` + Apply `text` = transcript). Durable title remains `UAT evidence pack`.

---

## Production changes

**NONE.**

---

## Recommendation

**DATABASE BOUNDARY BLOCKED**

Harness is clean on #110. Do not treat fake `runAtomic` as Postgres proof. Re-run `npm run verify:v09-db-boundary` on a disposable `supabase start` (or a dedicated TEST project) before LIVE 100. Do not merge.
