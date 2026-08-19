# Lume Phase 2.5 / 3A Completion Report

**Status:** Engineering complete (manual dashboard work remaining)  
**Branch:** `cursor/phase-2-5-billing-prep-c9f3`  
**Date:** 2026-08-13  

Built on Phase 1 (data/RLS) + Phase 2 (auth/persistence).

---

## Deployment readiness

Lume is **code/config ready** for Vercel:

- Production auth cannot silently use demo login  
- Production persistence cannot silently use localStorage  
- Missing production config fails the structural audit (`npm run verify:production-config`)  
- Developer tools remain `NODE_ENV === "development"` only  
- New production users hydrate to **zero** demo projects  
- Auth callback / reset-password routes ready for hosted redirects  
- `docs/PHASE_2_5_3_MANUAL_STEPS.md` lists only Tom’s later dashboard actions  

**Not done (by design):** no Vercel deploy, no DNS changes, no Stripe resources created.

---

## Production configuration

### Public / browser-safe

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

### Server-only

- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (later)
- `STRIPE_WEBHOOK_SECRET` (later)
- `STRIPE_PRICE_ID` (later)

### Config

- `LUME_TRIAL_DAYS` (default **14** until Tom confirms)
- Optional AI rate-limit envs

See `.env.local.example` and `docs/VERCEL_PRODUCTION_SETUP.md`.

---

## Billing foundation

Migration: `supabase/migrations/20260813140000_billing_foundation.sql`

Tables:

- `billing_customers` (workspace-scoped, Stripe customer id)
- `subscriptions` (canonical status, trial windows, period end)
- `billing_events` (provider event idempotency)

RPC: `ensure_workspace_trial(workspace_id, trial_days)` — idempotent, membership-checked.

RLS:

- Members can **read** billing state for their workspace  
- Authenticated users have **no write policies** on billing tables (cannot self-grant `active`)  
- `billing_events` not readable/writable by authenticated clients  

---

## Trial model

- No card at signup  
- After successful login/workspace bootstrap, trial row is ensured  
- Default duration: **14 days** via `LUME_TRIAL_DAYS`  
- Expired trials → `canUseLume = false` → `TrialExpiredPanel` / Account screen  

---

## Entitlements

Central server logic:

- `getWorkspaceEntitlement(workspaceId)`
- Pure evaluator: `evaluateEntitlement` / Stripe status mapper  

Allowed: `trialing`, `active`, `past_due` (grace), `cancelled` until `current_period_end`  
Restricted: `expired` / ended cancelled  

Frontend does not invent paid state.

---

## Stripe (without credentials)

Implemented, configuration-gated:

- Lazy Stripe SDK init (`stripe` package) — build works with no keys  
- `POST /api/billing/checkout` → `billing_not_configured` until keys exist  
- `POST /api/billing/portal` → same  
- `POST /api/billing/webhook` → requires signature + webhook secret  
- Idempotent event recording via `billing_events`  
- Event → Lume status mapper unit-tested  

---

## Security

- Browser cannot UPDATE subscription status under RLS  
- Checkout/portal require authenticated membership; foreign workspace → 403  
- Unverified webhook rejected  
- Duplicate webhook event id → no double apply  
- Production demo auth / local persistence rejected by config audit  

---

## AI protection

Capture / Coach / Transcribe / New Project:

- `requireAiCaller` (auth required when auth mode active; open only for local `auth=none` dev)  
- Per-user hourly rate limits (in-memory foundation; env-configurable)  
- Production refuses silent local AI fallback when OpenAI is missing  

Client monthly analysis meter remains **informational only** (not entitlement).

---

## Production UX

- Header shows signed-in name (links to `/account`) + Sign out  
- `/account` shows identity + subscription status  
- Trial-ended panel with Subscribe (active only when Stripe configured)  
- App `error.tsx` / `global-error.tsx` for unhandled failures  
- Structured server logging (`serverLog`) with secret redaction  

---

## Tests

| Suite | Result |
|---|---|
| `verify:production-config` | Pass (16 checks) |
| `verify:phase2-auth` | Pass |
| `verify:new-project` | Pass |
| `verify:rls-policies` | Pass |
| `npm run build` | Pass (no Stripe credentials required) |
| Existing Capture/golden suites | Unchanged intent; run as part of delivery |
| Live Supabase/Stripe hosted tests | Require Tom’s credentials / dashboards |

---

## Manual work remaining

See **`docs/PHASE_2_5_3_MANUAL_STEPS.md`**

Summary:

1. Run billing SQL migration in Supabase  
2. Set Vercel env vars + deploy  
3. Point Supabase Auth URLs at the hosted domain  
4. Create Stripe product/price/webhook when ready  
5. Hosted smoke test  

---

## Known limitations

- In-memory rate limits are per-instance (fine as foundation; Redis later if needed)  
- Soft analysis meter is not billing enforcement  
- Live Stripe end-to-end cannot be proven without Tom’s Stripe account  
- Preview URL wildcards in Supabase may need Tom’s exact Vercel pattern  
- Trial day count should be commercially confirmed before charging users  

---

## Definition of done

- [x] Vercel-ready code/config  
- [x] Production cannot silently use demo auth / localStorage  
- [x] Dev tools remain dev-only  
- [x] Seed-free production users  
- [x] Env vars documented  
- [x] Auth redirect requirements documented  
- [x] Billing DB + RLS + entitlements + trial  
- [x] Stripe integration boundary without credentials  
- [x] Webhook idempotency architecture  
- [x] AI auth + rate-limit architecture  
- [x] Trial-expired UX  
- [x] Build + structural tests green  
- [x] No Capture intelligence changes  
- [x] No marketing site / OAuth expansion / external deploy  
- [x] One concise manual checklist for Tom  
