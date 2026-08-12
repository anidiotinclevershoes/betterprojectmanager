# Lume Phase 2 Completion Report

**Date:** 2026-08-12  
**Branch:** `cursor/phase-2-auth-persistence-c9f3`  
**Foundation:** Phase 1 Supabase schema + RLS (unchanged security model)

---

## Authentication

Implemented **Supabase Auth** as the production account system:

| Capability | Status |
|---|---|
| Sign up (name, email, password) | `/signup` + `POST /api/auth/signup` |
| Login | `/login` + `POST /api/auth/login` |
| Logout | clears Supabase session + sensitive browser caches |
| Email confirmation UX | “Check your email” when Supabase requires confirmation |
| Forgot password | `/forgot-password` → Supabase reset email |
| Reset password | `/reset-password` after auth callback |
| SSR session refresh | `src/proxy.ts` + `updateSupabaseSession` |
| Protected routes | unauthenticated users redirected to `/login` |

Demo cookie auth (`DEMO_USERS` / `mc_session`) remains available only when `LUME_AUTH=demo`. Production does **not** silently fall back to demo auth when Supabase is configured.

Password rule: minimum 8 characters (UI + server). Passwords are never stored in Lume tables.

---

## Workspace bootstrap

On signup, Phase 1 trigger `handle_new_user` (updated in Phase 2 migration) creates:

- `profiles` row
- **Personal Lume Workspace**
- owner membership
- usage row

Idempotent helper: RPC `ensure_personal_workspace()` (+ `ensurePersonalWorkspace()` in app code) used on login so races do not create duplicate default workspaces.

No ATLAS / HORIZON / RELOPS are created for real users.

---

## Persistence

For authenticated Supabase sessions, **Supabase is the source of truth**. MissionState remains the UI/application cache.

| Entity | Persisted to Supabase |
|---|---|
| Workspace | Yes (bootstrap) |
| Projects (+ stakeholders on create) | Yes |
| To Dos | Yes (create/update/delete/toggle) |
| Risks | Yes (via knowledge risk bullets + risks table on create/capture) |
| Knowledge | Yes |
| Milestones / timeline | Yes |
| Memories | Yes (setup narrative + Capture apply) |
| Recommendations (on project create) | Yes |
| History events | Yes (key user/AI actions) |
| Capture sessions (on apply) | Yes |

Hydration: `loadMissionStateFromSupabase` on MissionProvider mount when `/api/auth/me` reports `persistence=supabase` and a user session exists → empty state when zero projects.

Writes go through `src/lib/data/supabase/persist-mutations.ts` (not scattered ad-hoc UI `from()` calls).

### Persistence mode rules

| Config | Behaviour |
|---|---|
| Supabase keys present (auto) | Supabase Auth + Supabase persistence |
| `LUME_PERSISTENCE=local` + `LUME_AUTH=demo` | Local regression / seeded demos |
| Production + Supabase | Forces Supabase (blocks accidental localStorage user data) |

---

## Still local (intentional)

- Appearance / sidebar collapse (device chrome)
- Active Capture draft (`sessionStorage`) until applied
- AI Cockpit metrics file
- AI vocabulary dictionary
- Seeded demo MissionState when explicitly in local/demo mode
- Meetings / releases full edit sync beyond load (loaded if present; deep meeting tooling not the Phase 2 focus)

---

## Security

- Phase 1 RLS retained and not weakened
- App-level live checks in `verify:phase2-persistence` (User A project invisible to User B; direct UUID fetch returns null)
- Logout clears `mission-control-state-v5`, capture/coach session caches
- Supabase service role never shipped to the browser

---

## New Project

Production UI shows only:

1. **Talk It Through** (recommended)
2. **Start Blank**

**Paste Project Information** removed from production-facing choose screen. Local `assembleFromNarrative(..., "paste")` remains in the library for later/experimental use. Review-before-create behaviour unchanged.

---

## Capture

Capture intelligence (context → findings → operations → review → apply) was **not** changed.

Apply path still updates MissionState for immediate UI, and in Supabase mode also persists memory, knowledge, timeline, capture session, and history through the repository/mutation helpers. Cross-project apply still authorises via workspace membership, not “currently viewed project”.

---

## Tests

| Suite | Result (agent environment) |
|---|---|
| `verify` | Pass |
| `verify:capture-context` | Pass |
| `verify:capture-prompt` | Pass |
| `verify:ai-domain` | Pass |
| `verify:golden-test` | Pass |
| `verify:findings` | Pass |
| `verify:seed-reset` | Pass |
| `verify:capture-reliability` | Pass |
| `verify:capture-review` | Pass |
| `verify:capture-workspace` | Pass |
| `verify:new-project` | Pass |
| `verify:rls-policies` | Pass |
| `verify:phase2-auth` | Pass |
| `verify:tenant-isolation` | SKIPPED here (no agent credentials); run on Tom’s machine |
| `verify:phase2-persistence` | SKIPPED here (no agent credentials); run on Tom’s machine |
| `npm run build` | Pass |

New scripts:

- `npm run verify:phase2-auth`
- `npm run verify:phase2-persistence`

---

## Manual setup Tom still needs

1. Run Phase 2 SQL:

   `supabase/migrations/20260812203000_phase2_ensure_personal_workspace.sql`

2. Configure Auth Site URL + Redirect URLs (see `docs/SUPABASE_SETUP_FOR_TOM.md` Phase 2 section)

3. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local`

4. Re-run:

```bash
npm run verify:tenant-isolation
npm run verify:phase2-persistence
```

5. Smoke: signup → confirm email if required → login → zero projects → create project → refresh → logout/login

6. Vercel values documented in `docs/VERCEL_PRODUCTION_SETUP.md` (do not deploy until ready)

---

## Screenshots

Captured under `/opt/cursor/artifacts/screenshots/phase2/`:

1. Sign Up — `01-signup.png`
2. Login — `02-login.png`
3. Forgot Password — `03-forgot-password.png`
4. Reset Password — `04-reset-password.png`
5. New Project Talk + Blank only — `05-new-project-talk-blank.png`

Zero-project first-run and logout/login persistence screenshots require Tom’s live Supabase session (agent environment has no project credentials).

---

## Known limitations (before Phase 3)

- OAuth not added (email/password only)
- No billing / Stripe
- No marketing site
- No team invites / multi-workspace switcher UI
- No full account-deletion product flow (cascade behaviour documented)
- Some secondary entities (deep meeting/release editing) are loaded but not every UI mutation is dual-written yet; core project/todo/knowledge/timeline/capture-apply/history paths are
- Email templates still Supabase defaults
- Live isolation/persistence verifies must be confirmed on Tom’s machine with credentials

---

## Definition of done checklist

- [x] Real Supabase email/password signup wired
- [x] Login / logout / session refresh
- [x] Forgot/reset password flow wired (email delivery depends on Supabase config)
- [x] Protected routes
- [x] Personal workspace bootstrap (exactly one default)
- [x] Zero demo projects for real users
- [x] Zero-project onboarding path preserved
- [x] New Project = Talk + Blank only
- [x] Project + core entities persist to Supabase
- [x] Capture apply persistence destination migrated (intelligence unchanged)
- [x] History / capture session server-backed on apply
- [x] Cross-user isolation tests added (live script)
- [x] Logout clears sensitive local caches
- [x] Dev fixtures retained via explicit local/demo mode
- [x] Existing verify suites green
- [x] Production build succeeds
- [x] No billing / no marketing site
- [x] Manual Supabase/Vercel docs updated
