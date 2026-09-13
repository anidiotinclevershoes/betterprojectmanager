# V1 human-action checklist

**Status:** Living operator checklist (12 September 2026)  
**Scope:** Things Tom must do in a dashboard or as a product decision. Not an architecture map.

Start with `docs/README.md` for product/architecture truth. This file only tracks human actions.

Statuses: **pending** · **completed** · **blocked** · **before external users** · **later**

---

## Production deploy order (current)

Production Vercel is on current `main`. Production JS talks to Supabase **Lume** `exfftrxxinhduogcluce`. D-050 is **closed as operator hygiene**: the 50-Capture long-run (`lr-20260912T2212Z`) wrote through the live app; SQL matched hosted snapshots. This is **not** an active hosted-schema mystery.

Do not edit already-applied V1 SQL. Do not strip `kind` from `create_project_bundle`. **Do not blindly replay historical migrations.**

### Existing hosted (current production)

1. Optional read-only audit: `scripts/hosted-schema-audit.sql`. Useful bookkeeping. A clean long-run already proved required runtime objects exist.
2. If — and only if — a **fresh** audit shows a required object `MISSING`, apply the matching **additive** file only (`20260910120000_hosted_canonical_schema_catchup.sql` and/or `20260829120000_capture_apply_receipts.sql`).
3. Re-run the audit. Stop when present.
4. Never run the whole `supabase/migrations/` folder on this project “to be sure”.

### Greenfield (new empty project)

Apply every migration in timestamp order. Prefer `npx supabase db push`. See [`docs/SUPABASE_SETUP_FOR_TOM.md`](./SUPABASE_SETUP_FOR_TOM.md).

The catch-up file is additive (`IF NOT EXISTS`). It does **not** create `capture_apply_receipts`. Never bypass receipts in application code.

---

## Pending

### Hosted schema catch-up after New Project smoke failure

- **Status:** completed (runtime proven 12 Sep 2026; optional audit remains hygiene)
- **When:** only if a fresh `hosted-schema-audit.sql` shows a required object missing
- **Blocking external use?** NO as a standing D-050 mystery. Trust defects in D-053 still block V1.
- **Secret?:** NO
- **Do this:** See Production deploy order above. Do not replay historical migrations.

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
  4. Run `npm run e2e:hosted-vertical`. Click-by-click: `e2e-hosted-vertical/README.md` → “One-time configuration”.
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
| Hosted schema catch-up (`20260910120000_hosted_canonical_schema_catchup.sql` + `20260829120000_capture_apply_receipts.sql`) | completed | Runtime proven by production long-run; do not replay historical migrations |
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
