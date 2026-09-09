# V1 human-action checklist

**Status:** Living operator checklist (9 September 2026)  
**Scope:** Things Tom must do in a dashboard or as a product decision. Not an architecture map.

Start with `docs/README.md` for product/architecture truth. This file only tracks human actions.

Statuses: **pending** · **completed** · **blocked** · **before external users** · **later**

---

## Pending

### Apply the external-V1 safety migration

- **Status:** pending
- **When:** BEFORE THIS PR MERGES TO PRODUCTION
- **Blocking external use?** YES (project delete RPC + N-09 RLS)
- **Secret?:** NO
- See **TOM — ACTION NEEDED** in the external-V1 PR.

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
| Apply migration `20260909160000_external_v1_safety.sql` | pending | Delete RPC + project↔workspace RLS |
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
| New Project create as one DB transaction | later | Delete is atomic; create still has compensating cleanup |
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

---

## Do not paste into Cursor, chat, or GitHub

- Stripe secret key / webhook signing secret
- Supabase service-role key
- OpenAI API key
- PostHog personal/private API key (the `phc_` project key is public; a personal key is not)
