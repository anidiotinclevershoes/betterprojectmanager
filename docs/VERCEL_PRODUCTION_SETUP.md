# Vercel Production Setup

Lume is prepared for hosted deployment.  
**Do not deploy until env vars and Supabase Auth URLs are set.**

Current human-action checklist: [`docs/V1_USER_ACTIONS.md`](./V1_USER_ACTIONS.md).  
Historical Phase 2.5/3A steps: [`docs/PHASE_2_5_3_MANUAL_STEPS.md`](./PHASE_2_5_3_MANUAL_STEPS.md).

---

## Production contract

| Concern | Production behaviour |
|---|---|
| Auth | Supabase only |
| Persistence | Supabase only |
| AI | OpenAI required (no silent local fallback) |
| Demo seed | Disabled |
| Developer tools | Hidden (`NODE_ENV !== development`) |

Validate structurally:

```bash
npm run verify:production-config
```

---

## Environment variables

### Public / browser-safe

| Name | Required |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `NEXT_PUBLIC_SITE_URL` | Yes (exact public origin) |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | Optional (public `phc_` project key only) |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional (defaults to `https://us.i.posthog.com`) |

### Server-only

| Name | Required |
|---|---|
| `OPENAI_API_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `STRIPE_SECRET_KEY` | Later (billing) |
| `STRIPE_WEBHOOK_SECRET` | Later |
| `STRIPE_PRICE_ID` | Later |

### Optional config

| Name | Notes |
|---|---|
| `OPENAI_MODEL` | Defaults to gpt-4o-mini |
| `LUME_TRIAL_DAYS` | Defaults to 14. Used only when billing is enabled. |
| `LUME_BILLING_ENABLED` | Must be the string `true` to allow checkout. Unset/false = early access. Independent of Stripe keys. |
| `NEXT_PUBLIC_POSTHOG_*` | Optional product analytics. Never a PostHog personal/private key. |
| `LUME_RATE_LIMIT_*_PER_HOUR` | AI abuse limits |

### Never set in production

- `DEMO_USERS`
- `LUME_AUTH=demo`
- `LUME_PERSISTENCE=local`
- `AUTH_REQUIRED=false`
- any `NEXT_PUBLIC_*` wrapping Stripe secrets or service role

---

## Supabase Auth URLs

After you know the Vercel URL:

1. Authentication → URL Configuration  
2. Site URL = `NEXT_PUBLIC_SITE_URL`  
3. Redirect URLs include `/auth/callback` and `/reset-password` for that host  

---

## First deploy smoke checklist

1. Fresh signup + email confirm + login  
2. Zero demo projects  
3. Create project → refresh → still present  
4. Logout/login → still present  
5. `/account` shows trial/subscription status (after billing migration)  
6. No Golden Test / AI Cockpit / Reset Demo in nav  

---

## Billing note

Checkout / portal / webhooks are implemented. They return `billing_disabled` unless `LUME_BILLING_ENABLED=true`, then `billing_not_configured` until Stripe env vars exist.  
Early-access use does not start the commercial trial clock.
