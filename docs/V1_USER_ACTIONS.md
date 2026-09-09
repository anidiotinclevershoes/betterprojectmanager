# V1 human-action checklist

**Status:** Living operator checklist (9 September 2026)  
**Scope:** Things Tom must do in a dashboard or as a product decision. Not an architecture map.

Start with `docs/README.md` for product/architecture truth. This file only tracks human actions.

Statuses: **pending** · **completed** · **blocked** · **before external users** · **later**

---

## Production deploy order (do this in this order)

Apply both SQL files first. Verify with the SQL below. THEN merge the branch so Vercel can deploy the new code.

Do **not** merge first. The new app expects `create_project_bundle` and `delete_project_bundle` to already exist.

Paste the verification SQL below into **Supabase Dashboard → SQL Editor**. Do not use psql meta-commands.

---

## Pending

### 1. Apply both external-V1 SQL files on production

- **Status:** pending
- **When:** BEFORE MERGE
- **Blocking external use?** YES
- **Secret?:** NO
- **Files (in this order):**
  1. `supabase/migrations/20260909160000_external_v1_safety.sql`
  2. `supabase/migrations/20260909210000_create_project_bundle.sql`

### Confirm trial length for when billing is later turned on

- **Status:** pending
- **When:** BEFORE BILLING ENABLES
- **Note:** Code default is 14 days (`LUME_TRIAL_DAYS`). Live dogfood Account A was a 90-day trial. Early-access users do **not** consume that trial while `LUME_BILLING_ENABLED` is unset/false.
- **Blocking external use?** NO

### Stripe product / price / webhook (when charging)

- **Status:** pending
- **When:** BEFORE BILLING ENABLES
- **Note:** Checkout stays refused until `LUME_BILLING_ENABLED=true` **and** Stripe keys exist. Keys alone do not turn billing on. Do not paste Stripe secrets into chat.

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
| Apply both SQL files, then verify, then merge | pending | New code needs the two bundle functions |
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
| New Project + delete as one DB transaction each | This branch; apply the two SQL files before merge |

---

## SQL Editor verification (paste as-is)

After both SQL files have been run, open **Supabase Dashboard → SQL Editor → New query** and paste this whole block. You should get three result tables.

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

-- 3) Safe non-destructive check (does not create or delete a project)
select
  public.project_belongs_to_workspace(
    '00000000-0000-4000-8000-000000000000'::uuid,
    null
  ) as null_project_is_allowed;
```

**Expected:**

1. Three rows: `create_project_bundle`, `delete_project_bundle`, `project_belongs_to_workspace`.
2. Four policy rows. Each `with_check` text includes `project_belongs_to_workspace`.
3. One row: `null_project_is_allowed` = `true`.

If any function is missing, run the matching SQL file again. Do not merge until all three functions appear.

---

## Do not paste into Cursor, chat, or GitHub

- Stripe secret key / webhook signing secret
- Supabase service-role key
- OpenAI API key
- PostHog personal/private API key (the `phc_` project key is public; a personal key is not)
