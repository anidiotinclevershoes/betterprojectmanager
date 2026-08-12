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

## Phase 2 — Auth dashboard settings (Tom)

After Phase 1 migrations are applied, configure Auth so signup / reset emails work.

### Step A — Run the Phase 2 migration

1. Open **SQL Editor**
2. New query
3. Paste all of:

   `supabase/migrations/20260812203000_phase2_ensure_personal_workspace.sql`

4. Click **Run**

### Step B — Site URL + redirect URLs

1. Left sidebar → **Authentication**
2. Click **URL Configuration** (or **Settings** under Auth)
3. Set **Site URL**:
   - Local: `http://localhost:3000`
   - Later production: your Vercel URL (for example `https://your-app.vercel.app`)
4. Under **Redirect URLs**, add each of these (one per line / entry):
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`
   - When you have Vercel: `https://YOUR-DOMAIN/auth/callback`
   - When you have Vercel: `https://YOUR-DOMAIN/reset-password`

### Step C — Email / password provider

1. **Authentication → Providers → Email**
2. Ensure **Email** is enabled
3. Decide **Confirm email**:
   - On = users must click a confirmation link before login (recommended for real users)
   - Off = easier local testing
4. Leave password requirements at Supabase defaults (Lume also enforces 8+ characters in the UI)

### Step D — Local env for Phase 2

In `.env.local` (in addition to Phase 1 keys):

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Optional explicit modes:
# LUME_AUTH=supabase
# LUME_PERSISTENCE=supabase
```

With Supabase keys present, Lume auto-uses Supabase Auth + Supabase persistence.

For local regression against seeded demo data instead:

```bash
LUME_AUTH=demo
LUME_PERSISTENCE=local
DEMO_USERS=you@example.com:password:You
AUTH_SECRET=at-least-16-chars-secret
```

### Step E — Smoke test

```bash
npm run verify:phase2-auth
npm run verify:tenant-isolation
npm run verify:phase2-persistence
npm run dev
```

Then open `http://localhost:3000/signup` and create a test account.

### Email branding (later)

Confirmation and password-reset emails currently use Supabase’s default templates.
You can brand them later under **Authentication → Email Templates**. Functional text is enough for Phase 2.

### Account deletion (documented, not built)

When a user is deleted from Auth, Phase 1 schema cascades:

- `profiles` row deletes with `auth.users`
- `workspace_members` rows for that user delete
- Owned workspace data is **not** auto-wiped unless you delete the workspace
  (workspaces can outlive a single member in future team scenarios)

Full user-facing “delete my account” belongs in a later production-safety phase.

---

## Safety checklist

- [ ] New Supabase project created for Lume only
- [ ] Values are in `.env.local`, not committed
- [ ] Phase 1 SQL migrations ran successfully
- [ ] Phase 2 `ensure_personal_workspace` migration ran
- [ ] Auth Site URL + Redirect URLs set
- [ ] `npm run verify:tenant-isolation` passes (or intentionally skipped)
- [ ] `npm run verify:phase2-auth` passes
- [ ] Existing Lume demo still runs with `npm run dev` (or demo mode)
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
