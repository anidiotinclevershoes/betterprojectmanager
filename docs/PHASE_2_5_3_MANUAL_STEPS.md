# Phase 2.5 / 3A — Manual steps for Tom (phone → desktop checklist)

Do these **later at a computer**. Everything in code is already prepared.

Do **not** paste secrets into Cursor chat.

---

## 1) Supabase

### A. Run the billing migration

1. Open [https://supabase.com](https://supabase.com) → your **Lume** project  
2. Left sidebar → **SQL Editor** → **New query**  
3. Open this file on your PC:

`supabase/migrations/20260813140000_billing_foundation.sql`

4. Copy **all** of it into the SQL Editor  
5. Click **Run**  
6. Confirm success  

### B. Auth URLs for hosted deploy

1. Supabase → **Authentication** → **URL Configuration**  
2. Set **Site URL** to your eventual production URL  
   - Example shape: `https://YOUR-APP.vercel.app`  
3. Add **Redirect URLs** (add each):  
   - `http://localhost:3000/auth/callback`  
   - `http://localhost:3000/reset-password`  
   - `https://YOUR-APP.vercel.app/auth/callback`  
   - `https://YOUR-APP.vercel.app/reset-password`  
   - If using Vercel previews: `https://*-YOUR-TEAM.vercel.app/auth/callback` (or add specific preview URLs)

---

## 2) Vercel

### A. Import / open the Lume project

1. Open [https://vercel.com](https://vercel.com)  
2. Import the GitHub repo `betterprojectmanager` (or open the existing project)  
3. Framework: Next.js (should detect)

### B. Environment variables

Vercel → Project → **Settings** → **Environment Variables**

Add these for **Production** (and Preview if you want auth there):

| Variable | Public or secret? | Where the value comes from | Required now? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase → Project Settings → API → Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase → API → `anon` / publishable key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Supabase → API → `service_role` | Yes (webhooks/admin) |
| `OPENAI_API_KEY` | **Secret** | OpenAI dashboard → API keys | Yes |
| `NEXT_PUBLIC_SITE_URL` | Public | Your final Vercel URL, e.g. `https://YOUR-APP.vercel.app` | Yes |
| `LUME_TRIAL_DAYS` | Public-ish / config | Your choice (default in code is **14** if omitted) | Confirm before go-live |
| `STRIPE_SECRET_KEY` | **Secret** | Stripe → Developers → API keys | Later (billing) |
| `STRIPE_WEBHOOK_SECRET` | **Secret** | Stripe webhook endpoint signing secret | Later |
| `STRIPE_PRICE_ID` | Config | Stripe Price ID for the Lume plan | Later |

Do **not** set in production:

- `DEMO_USERS`
- `LUME_AUTH=demo`
- `LUME_PERSISTENCE=local`
- `AUTH_REQUIRED=false`

### C. Deploy

1. Deploy the branch that contains Phase 2.5/3A work (or merge then deploy `main`)  
2. Copy the deployed URL into Supabase Site URL / Redirect URLs and into `NEXT_PUBLIC_SITE_URL`  
3. Redeploy if you changed env vars after the first deploy  

---

## 3) Stripe (when you are ready for paid access)

1. Create / open a Stripe account  
2. Create a **Product** + recurring **Price** for Lume  
3. Copy the **Price ID** → Vercel `STRIPE_PRICE_ID`  
4. Copy **Secret key** → Vercel `STRIPE_SECRET_KEY`  
5. Stripe → Developers → **Webhooks** → Add endpoint:  
   - URL: `https://YOUR-APP.vercel.app/api/billing/webhook`  
   - Events (minimum):  
     - `customer.subscription.created`  
     - `customer.subscription.updated`  
     - `customer.subscription.deleted`  
     - `checkout.session.completed`  
6. Copy the webhook **Signing secret** → Vercel `STRIPE_WEBHOOK_SECRET`  
7. Redeploy Vercel  

No card is required at Lume signup. Trial starts with the workspace; checkout is later via Account → Subscribe.

---

## 4) DNS / custom domain

Only if you want a custom domain:

1. Vercel → Project → **Settings** → **Domains**  
2. Add your domain and follow Vercel DNS instructions  
3. Update Supabase Site URL + Redirect URLs + `NEXT_PUBLIC_SITE_URL` to the custom domain  
4. Redeploy  

Not required for the first Vercel `*.vercel.app` smoke test.

---

## 5) Final hosted smoke test

1. Open the production URL  
2. **Sign up** with a fresh email  
3. Confirm email  
4. Log in  
5. Confirm **zero demo projects** (Talk It Through / Start Blank)  
6. Create a project  
7. Refresh — project still there  
8. Log out / log in — project still there  
9. Confirm header shows your name and **Account** / Sign out  
10. Open **/account** — subscription status shows `trialing` (after billing migration)  
11. Confirm Golden Test / AI Cockpit / Reset Demo are **not** in the sidebar  
12. When Stripe is configured: Account → Subscribe → complete test checkout → status becomes `active`

---

## Reminder

Code already includes:

- production guards  
- billing tables/routes/entitlements  
- Stripe checkout/portal/webhook foundations  
- AI auth + rate-limit architecture  

Your job is mostly: paste env values → deploy → smoke test → finish Stripe.
