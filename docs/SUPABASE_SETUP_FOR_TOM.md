# Supabase Setup for Tom (plain English)

This guide assumes you already have a Supabase account and maybe other projects.
We will create a **new** project just for Lume.

**Do not paste your service-role key into Cursor chat.**
Put secrets only in your local `.env.local` file (never commit that file).

---

## What Cursor already did

- Added database migration files in `supabase/migrations/`
- Added safe Supabase client helpers (browser / server / service-role)
- Added a repository/data-access layer
- Added security (RLS) policies in SQL
- Added isolation tests
- Left the current Lume app working on localStorage

## What Tom must do

### Step 1 — Open Supabase

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in
3. Click **New project** (or **Start a new project**)
4. Choose your existing organisation
5. Set:
   - **Name:** `lume` (or `lume-production`)
   - **Database password:** create a strong password and store it in your password manager
   - **Region:** pick one close to you (or leave default)
6. Click **Create new project**
7. Wait until the project finishes provisioning (green / ready)

> Important: do **not** put Lume tables into an old unrelated Supabase project.

### Step 2 — Copy the API values

1. In the left sidebar, click **Project Settings** (gear icon)
2. Click **API**
3. Copy these three values:

| What you see in Supabase | Put it in `.env.local` as |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL=...` |
| `anon` `public` key (sometimes called publishable) | `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY=...` |

4. On your computer, open the Lume project folder
5. Copy `.env.local.example` to `.env.local` if you do not already have `.env.local`
6. Paste the three values into `.env.local`
7. Save the file

Rules:

- No quotes around values
- No spaces around `=`
- Never commit `.env.local`
- Never put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_…` variable

### Step 3 — Apply the database migrations

You have two easy options.

#### Option A (recommended): Supabase SQL Editor

1. In Supabase, open **SQL Editor**
2. Click **New query**
3. Open this file on your computer:

   `supabase/migrations/20260812002748_workspace_schema.sql`

4. Copy **all** of its contents into the SQL Editor
5. Click **Run**
6. Confirm it succeeds
7. Open a second new query
8. Open this file:

   `supabase/migrations/20260812002749_tenant_rls.sql`

9. Copy **all** of its contents into the SQL Editor
10. Click **Run**
11. Confirm it succeeds
12. Open a third new query
13. Open this file:

   `supabase/migrations/20260812195500_fix_grants_and_membership_helper.sql`

14. Copy **all** of its contents into the SQL Editor
15. Click **Run**
16. Confirm it succeeds

> If you already ran the first two migrations earlier and hit
> `permission denied for table workspace_members`, you only need to run this
> third file, then re-run `npm run verify:tenant-isolation`.

#### Option B: Supabase CLI (if you are comfortable)

From the project folder:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`YOUR_PROJECT_REF` is the short id in your project URL, for example:

`https://abcdxyz.supabase.co` → `abcdxyz`

### Step 4 — Confirm Auth email confirmations for tests (optional)

For the isolation test users created by the script:

1. Go to **Authentication → Providers → Email**
2. You can leave defaults for now
3. The test script creates users with `email_confirm: true` via the service role, so no inbox is required for tests

### Step 5 — Run the isolation test

From the project folder:

```bash
npm run verify:tenant-isolation
```

Expected when credentials + migrations are correct:

- many lines starting with `✓`
- ends with `live tenant isolation checks passed`

If you have not added credentials yet, it will say `SKIPPED` and that is OK for local app development.

### Step 6 — Keep using Lume locally as before

```bash
npm run dev
```

The app still uses localStorage for the live UI.
Supabase is the production foundation being prepared.

Do **not** set `LUME_PERSISTENCE=supabase` yet unless a later phase tells you to.

---

## Vercel — do I need to do anything now?

**No, not for Phase 1.**

Later (Phase 2 / deploy), you will add the same Supabase values to Vercel:

1. Open your Vercel project
2. **Settings → Environment Variables**
3. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only / sensitive)
4. Apply to Preview/Production as needed

Do not deploy random branches to production without deciding that deliberately.

---

## Safety checklist

- [ ] New Supabase project created for Lume only
- [ ] Values are in `.env.local`, not committed
- [ ] Both SQL migrations ran successfully
- [ ] `npm run verify:tenant-isolation` passes (or intentionally skipped)
- [ ] Existing Lume demo still runs with `npm run dev`
- [ ] You did **not** paste the service-role key into chat

---

## If something fails

### “permission denied for table workspace_members”
Run the third migration in SQL Editor:

`supabase/migrations/20260812195500_fix_grants_and_membership_helper.sql`

Then re-run `npm run verify:tenant-isolation`.

### “relation does not exist”
You probably skipped a migration. Re-run both SQL files in order.

### “Invalid API key”
You pasted the wrong key, or added quotes/spaces.

### Isolation test SKIPPED
`.env.local` is missing one of the three required values.

### Isolation test fails after migrations
Tell Cursor the **error message text only** (not secrets). Do not paste keys.
