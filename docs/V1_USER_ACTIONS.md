# V1 human-action checklist

**Status:** Living operator checklist (7 September 2026)  
**Scope:** Things Tom must do in a dashboard or as a product decision. Not an architecture map.

Start with `docs/README.md` for product/architecture truth. This file only tracks human actions.

Statuses: **pending** · **completed** · **blocked** · **before external users** · **later**

---

## Pending

### PostHog project + public key

- **Status:** pending
- **When:** BEFORE THIS PR MERGES (events stay local/no-op until the key is set)
- **Blocking a slice?** Analytics live data only. Product still works without it.
- See the **TOM — ACTION NEEDED** section in the commercial-readiness PR for click-by-click steps.

### Confirm trial length for strangers

- **Status:** pending
- **When:** BEFORE EXTERNAL USERS
- **Note:** Code default is 14 days (`LUME_TRIAL_DAYS`). Live dogfood Account A was a 90-day trial. Do not guess.

### Stripe product / price / webhook (when charging)

- **Status:** pending
- **When:** BEFORE EXTERNAL USERS (only if strangers will be charged or must subscribe after trial)
- **Note:** Checkout/portal/webhook code already exists and returns `billing_not_configured` until keys are set. Do not paste Stripe secrets into chat.

---

## Before external users

| Action | Status | Why |
| --- | --- | --- |
| Terms / Privacy review (D-044) | pending | Required for public/commercial; do not invent legal claims in code |
| Confirm production Site URL + Auth redirect URLs still match | pending | Already done for dogfood; re-check if a custom domain is added |
| Decide whether leftover `/memory` `/coaching` `/releases` stay hidden | pending | Confusion risk for strangers |
| Account deletion (D-041) | pending | V1 MUST before public users |
| Export (D-042) | pending | V1 MUST before public users (legal may demote) |

---

## Later

| Action | Status | Why |
| --- | --- | --- |
| Custom domain / DNS | later | Not required for current Vercel production |
| Production integrity observer | later | External-user hardening gate, not commercial-slice work |
| New Project / delete bundle transaction (D-028) | later unless classified FIX BEFORE EXTERNAL USER |
| Broader same-workspace RLS (N-09 / D-035 remainder) | later unless classified FIX BEFORE EXTERNAL USER |

---

## Completed (already true on current main)

| Action | Evidence |
| --- | --- |
| Production Supabase Auth | Live dogfood; `NEXT_PUBLIC_SITE_URL` confirmed |
| 90-day trial on Account A | Handoff; do not treat as the stranger default |
| Integrity gate D-045–D-048 | PR #141 on `main` |

---

## Do not paste into Cursor, chat, or GitHub

- Stripe secret key / webhook signing secret
- Supabase service-role key
- OpenAI API key
- PostHog personal/private API key (the `phc_` project key is public; a personal key is not)
