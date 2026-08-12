# Vercel Production Setup (Phase 2 prep)

**Do not deploy automatically from this document.**  
Configure these values when you are ready to put an authenticated Lume build on Vercel.

Never paste secrets into Cursor chat. Enter them only in the Vercel dashboard (or your password manager → Vercel).

---

## 1. Environment variables

In Vercel → your project → **Settings → Environment Variables**, add:

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production (+ Preview if used) | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production (+ Preview) | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production (+ Preview) | **Server only**. Do not expose to the browser. |
| `OPENAI_API_KEY` | Production (+ Preview) | Server only; Capture / Coach |
| `NEXT_PUBLIC_SITE_URL` | Production | Exact public URL, e.g. `https://lume.example.com` |
| `LUME_AUTH` | Optional | Prefer unset (auto). Or `supabase`. Never `demo` in production. |
| `LUME_PERSISTENCE` | Optional | Prefer unset (auto → supabase when configured). Do **not** set `local` in production. |

Optional:

| Name | Notes |
|---|---|
| `OPENAI_MODEL` | Override default model |
| `AUTH_REQUIRED` | Usually leave unset |

Do **not** set production:

- `DEMO_USERS`
- `AUTH_SECRET` (demo cookie gate)
- `LUME_PERSISTENCE=local`
- `LUME_AUTH=demo`

---

## 2. Supabase Auth URLs for the deployed host

In Supabase → **Authentication → URL Configuration**:

1. **Site URL** = your production URL (`NEXT_PUBLIC_SITE_URL`)
2. **Redirect URLs** include:
   - `https://YOUR-DOMAIN/auth/callback`
   - `https://YOUR-DOMAIN/reset-password`
   - Preview URLs if you use Vercel previews for auth testing

---

## 3. Recommended first deploy checklist

1. Phase 1 + Phase 2 SQL migrations applied on the Lume Supabase project
2. Env vars set in Vercel (above)
3. Auth redirect URLs updated
4. Deploy a non-production branch first if possible
5. Sign up a fresh test user
6. Confirm zero-project onboarding (no ATLAS/HORIZON/RELOPS)
7. Create a project → refresh → still present
8. Logout → login → same project
9. Confirm `/dev/*` tools are not linked in production navigation

---

## 4. Persistence behaviour (summary)

| Environment | Typical mode |
|---|---|
| Local with Supabase keys | Supabase Auth + Supabase persistence |
| Local regression / golden demos | `LUME_AUTH=demo` + `LUME_PERSISTENCE=local` |
| Vercel production | Supabase Auth + Supabase persistence |

MissionState remains an in-memory / UI cache. Supabase is the source of truth for authenticated production users.
