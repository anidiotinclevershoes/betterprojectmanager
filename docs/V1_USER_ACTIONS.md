# V1 human-action checklist

**Status:** Living operator checklist (10 September 2026)  
**Scope:** Things Tom must do in a dashboard or as a product decision. Not an architecture map.

Start with `docs/README.md` for product/architecture truth. This file only tracks human actions.

Statuses: **pending** · **completed** · **blocked** · **before external users** · **later**

---

## Production deploy order (current)

The two external-V1 SQL files are already on production. Production Vercel is on merged `main` (PR #150). **Stop the invite rollout.** Hosted New Project failed because production is missing later additive columns/tables the canonical model requires (`knowledge_items.kind`, then likely `project_tags`).

Do not edit already-applied V1 SQL. Do not strip `kind` from `create_project_bundle`.

1. SQL Editor → New query → paste **all** of `scripts/hosted-schema-audit.sql` → Run. Send the full result.
2. New query → paste **all** of `supabase/migrations/20260910120000_hosted_canonical_schema_catchup.sql` → Run.
3. Re-run the audit until every `required_column` is `present` and `project_tags` / `item_tags` are `present`.
4. Repeat New Project smoke from scratch only after that.

The catch-up file is additive (`IF NOT EXISTS`). It replays canonical knowledge metadata plus retrieval tag tables. If duplicate project codes exist, it still creates the tag tables and skips the unique code index (D-026) with a warning.

---

## Pending

### Hosted schema catch-up after New Project smoke failure

- **Status:** pending
- **When:** NOW — before repeating smoke / before invites
- **Blocking external use?** YES
- **Secret?:** NO
- **Do this:**
  1. SQL Editor → New query → paste all of `scripts/hosted-schema-audit.sql` → Run. Send the full result (every `MISSING` row, plus `recent_project` / `leftover_children`).
  2. New query → paste all of `supabase/migrations/20260910120000_hosted_canonical_schema_catchup.sql` → Run.
  3. Re-run the audit until `knowledge_items.kind` and `project_tags.slug` are `present`.
  4. Retry New Project on a **fresh** attempt. Match `recent_project` names against the failed smoke. If a surprise project + children exist from the failed save, stop — that is an integrity defect.

### Confirm trial length for when billing is later turned on

- **Status:** pending
- **When:** BEFORE BILLING ENABLES
- **Note:** Code default is 14 days (`LUME_TRIAL_DAYS`). Live dogfood Account A was a 90-day trial. Early-access users do **not** consume that trial while `LUME_BILLING_ENABLED` is unset/false.
- **Blocking external use?** NO

### Stripe product / price / webhook (when charging)

- **Status:** pending
- **When:** BEFORE BILLING ENABLES
- **Note:** Checkout stays refused until `LUME_BILLING_ENABLED=true` **and** Stripe keys exist. Keys alone do not turn billing on. Do not paste Stripe secrets into chat.

### Hosted vertical journey secrets (opt-in harness)

- **Status:** pending
- **When:** before a live hosted baseline can pass AUTH
- **Secret?:** YES — never paste into chat or git
- **Blocking external use?** NO
- **Do this:**
  1. Vercel → Project → Settings → Deployment Protection → enable **Protection Bypass for Automation**. Put the secret in `LUME_E2E_VERCEL_BYPASS_SECRET` (or `VERCEL_AUTOMATION_BYPASS_SECRET`).
  2. Create a disposable Lume account. Put email/password in `LUME_E2E_EMAIL` / `LUME_E2E_PASSWORD`.
  3. Set `LUME_E2E_BASE_URL` to the Vercel Preview URL for the PR under test (first target: PR #155). Do not hardcode the hostname in source.
  4. Run `npm run e2e:hosted-vertical`. See `e2e-hosted-vertical/README.md`.
  5. Do not add this suite to ordinary CI until explicitly approved.

### Own the support inbox

- **Status:** pending
- **When:** BEFORE EXTERNAL USERS
- **Value:** `support@lume.app` (already linked in Help & support and `/support`)
- **Blocking external use?** YES for a polite early-access cohort (product still functions)

### Lawyer Privacy / Terms (D-044)

- **Status:** pending
- **When:** BEFORE EXTERNAL USERS
- **Note:** App pages have honest stubs and empty “Lawyer-reviewed …” slots. Do not invent legal claims in code.

---

## Blocking external use

| Action | Status | Why |
| --- | --- | --- |
| Hosted schema catch-up (`20260910120000_hosted_canonical_schema_catchup.sql`) | pending | New Project failed: production missing `knowledge_items.kind` |
| Leave `LUME_BILLING_ENABLED` unset or `false` on Production | pending | First cohort is free early access |
| Confirm `SUPABASE_SERVICE_ROLE_KEY` is already on Vercel (needed for account delete) | pending | Delete cannot run without it |
| Own `support@lume.app` or change the address | pending | Users are told to email it |
| Lawyer Privacy / Terms if the invitees are unpaid strangers | pending | Stubs are honest, not legal |

## Blocking billing

| Action | Status | Why |
| --- | --- | --- |
| Set Stripe secret key, webhook signing secret, and price id in Vercel | pending | Configuration, not the rollout switch |
| Set `LUME_BILLING_ENABLED=true` and redeploy | pending | This is the rollout switch |
| Confirm `LUME_TRIAL_DAYS` (do not assume 90) | pending | Independent of the billing flag |

## Later

| Action | Status | Why |
| --- | --- | --- |
| Custom domain / DNS | later | Not required for current Vercel production |
| Production integrity observer | later | Scanner + SQL probes exist; no daemon for controlled V1 |
| Charging the first cohort | later | Explicitly off until evidence supports it |

---

## Completed (already true on current main / this branch)

| Action | Evidence |
| --- | --- |
| Production Supabase Auth | Live dogfood; `NEXT_PUBLIC_SITE_URL` confirmed |
| 90-day trial on Account A | Handoff; do not treat as the stranger default |
| Integrity gate D-045–D-048 | PR #141 on `main` |
| PostHog public token inlined | PR #149; Activity shows events |
| Public welcome / signup / recovery | Commercial-readiness PRs on `main` |
| Account export + delete (code) | This branch; Tom must still have service-role key |
| `LUME_BILLING_ENABLED` flag | This branch; recommended Production value is unset/false |
| New Project + delete as one DB transaction each | Merged; hosted still needs canonical metadata columns |
| External-V1 safety + create_project_bundle SQL | Applied on production 10 Sep 2026 |

---

## SQL Editor verification (paste as-is)

After both SQL files have been run, open **Supabase Dashboard → SQL Editor → New query** and paste this whole block. You should get three result tables.

This does **not** create or delete a project. `null_project_is_allowed = true` is correct: `project_id` may be null on some tables, and RLS still requires workspace membership. The dummy workspace UUID is not a grant of access.

```sql
-- 1) Do the three functions exist?
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_project_bundle',
    'delete_project_bundle',
    'project_belongs_to_workspace'
  )
order by 1;

-- 2) Are the tighter project/workspace policies installed?
select
  c.relname as table_name,
  pol.polname as policy_name,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and pol.polname in (
    'recommendations_insert_member',
    'history_events_insert_member',
    'capture_sessions_insert_member',
    'memories_update_member'
  )
order by 1, 2;

-- 3) Safe non-destructive checks (do not create or delete a project)
select
  public.project_belongs_to_workspace(
    '00000000-0000-4000-8000-000000000000'::uuid,
    null
  ) as null_project_is_allowed,
  public.project_belongs_to_workspace(
    '00000000-0000-4000-8000-000000000000'::uuid,
    '00000000-0000-4000-8000-000000000001'::uuid
  ) as missing_named_project_is_rejected;
```

**Expected:**

1. Three rows: `create_project_bundle`, `delete_project_bundle`, `project_belongs_to_workspace`.
2. Four policy rows. Each `with_check` text includes `project_belongs_to_workspace`.
3. One row: `null_project_is_allowed` = `true` and `missing_named_project_is_rejected` = `false`.

If any function is missing, run the matching SQL file again. Do not merge until all three functions appear.

---

## Do not paste into Cursor, chat, or GitHub

- Stripe secret key / webhook signing secret
- Supabase service-role key
- OpenAI API key
- PostHog personal/private API key (the `phc_` project key is public; a personal key is not)
