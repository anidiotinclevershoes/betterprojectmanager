# Lume V1 Legal Eagle Audit

**Status:** Practical V1 legal / privacy / security / data-risk audit of the current repository  
**Date:** 27 August 2026  
**Auditor role:** Legal Eagle (technical/privacy review, not a solicitor’s opinion)  
**Code observed:** branch `cursor/capture-v2-desert-new-project-56c9` plus this audit’s follow-on fixes  
**Governing product authority:** `docs/v1-reference-pack/`  
**Current implementation map:** `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md`  
**This document is not legal advice.** Items that need an Irish solicitor are marked as such.

---

## 1. Executive verdict

**Is the current architecture fundamentally appropriate for an individual-first V1?**  
Yes. Lume is already a conventional authenticated SaaS: Next.js on Vercel, Supabase Auth + Postgres with workspace RLS, server-side OpenAI, Stripe billing foundation, and production guards that reject demo auth and localStorage-as-authority. That is the right shape for an individual PM product that must remember real project context.

**Is there any legal/privacy/security issue serious enough to block launch?**  
There is no evidence of a broken multi-tenant database (User A reading User B’s rows via RLS). There **are** launch blockers of two other kinds:

1. **Legal documents do not exist** (no Terms, no Privacy Policy, no subprocessor list, no deletion/export contact). Public launch without them is not defensible.
2. **A small set of product/security gaps** that would make some intended claims untrue, or that leak project data on a shared browser: incomplete logout wipe, paint-cache used as navigable project truth before the signed-in user is confirmed, Capture GET key diagnostics, unbounded transcription uploads.

None of these require a security platform. They require documents, a few small code/config changes, and founder-side provider settings.

**Is conventional SaaS encryption sufficient for V1?**  
Yes. Browser → Vercel → Supabase / OpenAI / Stripe over TLS, plus provider encryption at rest (Supabase AES-256; Vercel/OpenAI/Stripe as hosted processors). That matches the intended public position.

**Is custom application-level encryption necessary?**  
No. There is no concrete V1 threat that infrastructure encryption, RLS, auth, and logging hygiene cannot cover. Field-level encryption would break Ask/Capture search, complicate key management, and is an enterprise requirement masquerading as V1 work.

**The 3–5 most important changes**

1. **Publish solicitor-reviewed Terms + Privacy Policy** that put employer-permission on the user, name subprocessors, and describe AI, retention, and deletion honestly.
2. **Stop leftover project data surviving logout / account-switch** (complete browser wipe; do not navigate from another user’s paint cache).
3. **Tighten AI edge cases:** authenticate Capture GET and stop returning key diagnostics; cap transcription uploads; keep AI routes authenticated (already true for POST).
4. **Founder configuration:** execute provider DPAs; confirm OpenAI API no-training + retention/ZDR; set OpenAI spend limits; confirm Supabase region and Auth URLs; never enable `LUME_ALLOW_LOCAL_IN_PRODUCTION`.
5. **Document a support deletion/export process** (email). Self-service account deletion can wait if the process is real and the Privacy Policy says so.

**Third-party managed services to adopt because they materially improve V1?**

- **Keep** Supabase, Vercel, OpenAI, Stripe. Do not replace them.
- **Configure, don’t rebuild:** OpenAI org DPA + spend caps; optional OpenAI Zero Data Retention (approval-gated); Stripe DPA when billing goes live; Supabase DPA.
- **Optional, worth it soon:** Sentry (or equivalent) with PII scrubbing for crash visibility; Upstash/Vercel KV only if abuse/cost becomes real. Neither is a launch blocker if OpenAI spend caps are set.

**Launch recommendation:** **PASS WITH SPECIFIC PRE-LAUNCH ACTIONS**  
(not PASS, not BLOCKED)

---

## 2. Data-flow summary

**Authoritative production path**

```
User browser
  → HTTPS → Vercel (Next.js App Router, src/proxy.ts session gate)
      → Supabase Auth cookies (anon key + user JWT; RLS applies)
      → Supabase Postgres (workspace-scoped project truth)
      → OpenAI API (server-side OPENAI_API_KEY) for Capture / Tell Me / Coach / New Project / Whisper
      → Stripe (server-side) for checkout / portal / webhooks
```

**Project truth** lives in Supabase tables (`projects`, `stakeholders`, `todos`, `risks`, `knowledge_items`, `milestones`, `memories`, `recommendations`, `meetings`, `releases`, `capture_sessions`, `history_events`, `coach_sessions`, `project_intelligence_snapshots`, billing tables). The in-memory `MissionState` is a hydrate/mutate cache, not a second production database.

**AI path:** the browser sends Capture text (and a client copy of MissionState) to `/api/capture` (and similarly Tell Me / Coach / New Project). The server, after `requireAiCaller`, forwards **selected project context plus the user’s input** to OpenAI. Audio is posted to `/api/transcribe` and then to Whisper; Lume does not persist raw audio files.

**Where confidential project data leaves Lume-controlled storage**

| Destination | What | Why |
| --- | --- | --- |
| **OpenAI** | Capture transcripts, Ask questions, coaching context, new-project narrative, Whisper audio | Core product |
| **Stripe** | Email, workspace id, Lume user id (metadata); **not** project content; **not** card PAN | Billing |
| **Supabase** | All durable project + account + billing status | Persistence + auth email |
| **Vercel logs** | Structured `serverLog` fields (user ids, error messages). Prompt body logging is development-only | Hosting |
| **Browser localStorage** | Paint cache of MissionState; Capture/Coach session history; Tell Me snapshots; optional dictionary | UX / leftover local mode |

**No unexpected analytics, Sentry, or object-storage provider is wired.** Email is Supabase Auth (signup / reset), not a separate ESP in code.

---

## 3. Findings

### F-01 — Logout does not clear all project-domain browser storage

**Risk level:** High  

**Why it matters:** On a shared or work laptop, Capture transcripts, Tell Me snapshots, and a custom project dictionary can remain after Sign out. That is Lume-held confidential data sitting in another person’s browser profile. It also undermines “delete / leave the account” honesty.

**Evidence:** `src/lib/session-cleanup.ts` clears `mission-control-state-v5`, `lume-mission-supabase-cache-v1`, `lume-capture-sessions-v1`, `lume-coaching-sessions-v1`, `lume-capture-session-v1`. It does **not** clear `lume-tell-me-snapshots-v1` (`TellMeSessionContext.tsx`, `prune-deleted-project-residue.ts`) or `lume-project-dictionary-v1` (`src/ai/domain/dictionary.ts`). Layout keys (`mc-workspace-layout-v3:*`) also remain (low sensitivity).

**Recommended action:** Expand logout wipe to every project-domain key (and layout prefixes). Call the same wipe on successful login/signup so account-switch cannot inherit the previous user’s cache.

**V1 necessity:** Must fix before launch  

**Estimated change size:** Tiny  

**Build / Buy / Configure:** Small Lume implementation  

**Over-engineering check:** One helper, a few keys. No privacy platform. Proportionate because this is a realistic shared-machine leak of the product’s actual memory.

---

### F-02 — Paint cache can become navigable project truth before the signed-in user is confirmed

**Risk level:** High  

**Why it matters:** `useLayoutEffect` in `MissionProvider` paints `lume-mission-supabase-cache-v1` (full MissionState: names, risks, decisions, knowledge) before `/api/auth/me` confirms who is signed in. `src/app/page.tsx` then **redirects into the first cached project** if `state.projects.length > 0`, even when `hydrated` is still false. On a shared browser, User B signing in after User A (if A did not log out, or if wipe was incomplete) can briefly **see A’s Knowledge Centre from local cache**. RLS still prevents B writing to A’s workspace; this is a confidentiality issue, not a durable cross-tenant write.

**Evidence:** `src/lib/store.tsx` paint cache (`readMissionSupabaseCache`); `src/app/page.tsx` `hasCachedProjects` redirect; login (`src/app/login/page.tsx`) does not clear browser state before `router.replace("/")`. Auth pages hide AppShell chrome (`isAuthChromePath`), so the leak is after navigation into the app, not on the login form itself.

**Recommended action:** Wipe project-domain storage on successful login/signup. If `/api/auth/me` returns a different user id than the cache, discard the cache and show empty until hydrate. Do not treat unconfirmed cache as a navigation target. Keep same-user hard-refresh paint (that is the legitimate UX reason for the cache).

**V1 necessity:** Must fix before launch  

**Estimated change size:** Small  

**Build / Buy / Configure:** Small Lume implementation  

**Over-engineering check:** This is not “redesign persistence”. It is “don’t show User A’s brain to User B for a few seconds”. Proportionate.

---

### F-03 — `GET /api/capture` returns OpenAI key diagnostics and is not gated by `requireAiCaller`

**Risk level:** Medium  

**Why it matters:** Any caller who can hit the route learns `keyPrefix`, `keyLength`, configured model, and whether the production key is present. In production `src/proxy.ts` requires a session for `/api/*` except auth and the Stripe webhook, so this is not an anonymous internet leak. It is still unnecessary secret metadata and a defence-in-depth gap (handler should not trust proxy alone).

**Evidence:** `src/app/api/capture/route.ts` `GET()` returns `getOpenAIKeyDiagnostics()` including `keyPrefix` / `keyLength` with **no** `requireAiCaller`. `MissionProvider` fetches `GET /api/capture` on hydrate. POST is correctly gated.

**Recommended action:** Require a signed-in user on GET. Return only `openaiConfigured` + model (+ captureV2 flag). Keep prefix/length for `NODE_ENV === "development"` only.

**V1 necessity:** Should fix before launch  

**Estimated change size:** Tiny  

**Build / Buy / Configure:** Small Lume implementation  

**Over-engineering check:** Do not build a secrets manager. Just stop advertising key shape.

---

### F-04 — Transcription accepts unbounded audio with no MIME/size check

**Risk level:** Medium  

**Why it matters:** `/api/transcribe` forwards whatever `FormData` field `audio` is to Whisper. OpenAI’s practical limit is 25 MB; a larger body can still burn a Vercel invocation and OpenAI quota. Authenticated + rate-limited (40/hour in-memory), so this is cost/DoS, not a tenant-isolation hole. No raw audio is stored (good).

**Evidence:** `src/app/api/transcribe/route.ts` — no `size` / type checks. No storage buckets exist in the repo.

**Recommended action:** Reject over 25 MB and non-audio/webm types. Rely on existing `requireAiCaller("transcribe")`. Optional later: Upstash rate limit if spend spikes.

**V1 necessity:** Should fix before launch  

**Estimated change size:** Tiny  

**Build / Buy / Configure:** Small Lume implementation (OpenAI spend cap is Configure and more important)

**Over-engineering check:** A 10-line guard, not a media platform.

---

### F-05 — No Terms of Service or Privacy Policy in the product or repo

**Risk level:** High (legal/launch, not a code exploit)  

**Why it matters:** Users may enter employer-confidential project data. Without Terms (authority to upload, AI limits, liability) and a Privacy Policy (categories, subprocessors, AI, retention, rights, contact), Lume cannot truthfully say it handles data responsibly in a GDPR-transparent way. Marketing claims would be unanchored.

**Evidence:** No `/privacy`, `/terms`, or legal routes. `docs/current-state/LUME_CURRENT_STATE.md` already noted the gap (historical, still true). Signup (`src/app/signup/page.tsx`) does not capture acceptance.

**Recommended action:** Solicitor-drafted pages + signup checkbox. Do **not** have engineering invent legal boilerplate. Section 7–8 list the inputs.

**V1 necessity:** Must fix before public launch (documents, not architecture)  

**Estimated change size:** Small (product wiring) / Medium (legal drafting — external)  

**Build / Buy / Configure:** External legal + tiny Lume links/checkbox  

**Over-engineering check:** Two pages and an accept-on-signup control. Not a consent-management platform.

---

### F-06 — No user-facing account deletion; deleting auth.users would orphan workspaces

**Risk level:** Medium  

**Why it matters:** GDPR erasure. Project delete exists and is persist-first (`persistProjectDelete`). Account delete does not. `profiles.id` and `workspace_members.user_id` cascade from `auth.users`, but **`workspaces` do not**: a deleted user leaves an ownerless workspace and all project rows (inaccessible via RLS, still in backups).

**Evidence:** Account page (`src/app/account/page.tsx`) is identity + appearance + billing only. Schema FKs in `supabase/migrations/20260812002748_workspace_schema.sql`.

**Recommended action:** V1: Privacy Policy + support email process: delete personal workspace then Auth user (Supabase dashboard or a one-off SQL/admin script). Self-service UI is nicer, not required if the process is actually performed. Post-V1: a single RPC that deletes the personal workspace then the user.

**V1 necessity:** Should fix before launch as a **documented process**; UI can defer  

**Estimated change size:** Tiny (docs/process) / Small (later RPC)  

**Build / Buy / Configure:** Existing infrastructure sufficient + written process  

**Over-engineering check:** Do not build an enterprise DSAR portal.

---

### F-07 — AI rate limit is in-memory per Vercel isolate

**Risk level:** Medium  

**Why it matters:** `src/lib/rate-limit.ts` is honest (“Per-process only”). On serverless, each instance has its own map. A determined authenticated user can exceed 60 Capture/hour in aggregate and run up OpenAI spend. RLS is unaffected.

**Evidence:** `src/lib/rate-limit.ts`; `requireAiCaller` in `src/lib/ai-gate.ts`.

**Recommended action:** **Configure OpenAI project spending limits** (must). Optionally buy Upstash Redis / Vercel KV later if abuse appears. Do not build a custom limiter.

**V1 necessity:** OpenAI spend cap: Must (founder config). Distributed limiter: Can defer  

**Estimated change size:** Tiny (OpenAI dashboard) / Small (Upstash later)  

**Build / Buy / Configure:** Configuration change now; managed third-party if needed later  

**Over-engineering check:** Paying for Redis on day one without evidence of abuse is premature. A spend cap is not.

---

### F-08 — OpenAI calls do not set `store: false`; default ~30-day abuse-monitoring retention applies unless ZDR is approved

**Risk level:** Medium (disclosure / residual processor retention, not Lume training)  

**Why it matters:** Lume **can likely** say “we do not use your project data to train Lume’s models” and, **subject to OpenAI’s current API terms + executed DPA**, that **OpenAI does not train on API data by default**. That is **not** the same as “OpenAI never retains prompts.” Default API retention is typically ~30 days for abuse monitoring. `store: false` reduces dashboard/storage; org-level Zero Data Retention is approval-gated.

**Evidence:** Chat Completions fetches in `src/lib/openai.ts`, `src/lib/tell-me/answer.ts`, `src/lib/pm-coach.ts`, `src/lib/capture-v2/extract.ts`, `src/app/api/new-project/route.ts`, etc. — no `store` flag. No ZDR config in repo (correct; it is an org setting).

**Recommended action:** Execute OpenAI DPA; confirm no-training in the dashboard; optionally request ZDR; Privacy Policy must mention OpenAI as a processor and international transfers. Adding `store: false` in code is a tiny extra.

**V1 necessity:** DPA + truthful Privacy wording: Must. ZDR: Should if easily approved; otherwise disclose 30-day processor retention. `store: false`: Should  

**Estimated change size:** Tiny (code) / Configure (OpenAI org)  

**Build / Buy / Configure:** Existing OpenAI sufficient + configuration  

**Over-engineering check:** Do not switch model providers for a theoretical retention delta. Do not build app-level encryption to “avoid OpenAI”.

---

### F-09 — Capture/Coach session history still duplicated in localStorage in production

**Risk level:** Low  

**Why it matters:** Durable Capture rows exist in `capture_sessions`, but the UI history list is still `lume-capture-sessions-v1` (up to 80 full transcripts + results). That is extra copies of confidential notes on disk, and it can diverge from server delete. Known Discovery D-013 class.

**Evidence:** `src/lib/sessions/history.ts`; `persistCaptureSession` in `persist-mutations.ts` is used on apply, not as the UI list.

**Recommended action:** Keep for V1 if logout wipe is complete. Do not rebuild session history now. Post-V1: hydrate history from Supabase and drop local lists.

**V1 necessity:** Can defer (if F-01 is fixed)  

**Estimated change size:** Medium (if done properly)  

**Build / Buy / Configure:** Small Lume implementation later  

**Over-engineering check:** Removing local history before a server-backed UI exists would make Capture history worse. Wipe-on-logout is the V1 control.

---

### F-10 — Client-supplied MissionState is trusted as AI context (no server reload of the project)

**Risk level:** Informational (by design) / Low for isolation  

**Why it matters:** Capture / Tell Me / Coach / snapshot-refresh accept `body.state` from the browser. A user cannot **steal** another user’s rows this way (they can only send data they already have, or fiction). Snapshot load uses the user-scoped client + RLS (`loadSnapshotFromSupabase`). Cost abuse is the residual (see F-07).

**Evidence:** `src/app/api/capture/route.ts`, `src/app/api/tell-me/route.ts`, `src/app/api/coach/route.ts`. Refresh 404s if `projectId` is not in the **client** state, then `resolveWorkspaceIdForProject` is RLS-scoped.

**Recommended action:** Do not redesign AI to re-hydrate the entire workspace on every Capture for V1. Optional later: confirm `projectId` exists in the caller’s workspace before snapshot save.

**V1 necessity:** Can defer  

**Estimated change size:** Small (ownership check) / Large (server-assembled context)  

**Build / Buy / Configure:** Existing infrastructure sufficient  

**Over-engineering check:** Server-side context assembly is a product/intelligence project, not a V1 legal requirement.

---

### F-11 — Hard-coded personal email on `/evals` denial screen

**Risk level:** Medium (privacy of the operator; low user-data risk)  

**Why it matters:** Any signed-in user who opens `/evals` when the allowlist is empty sees `LUME_EVAL_ALLOWED_EMAILS=spud.hughes@gmail.com`. That is personal data of the founder in a production UI.

**Evidence:** `src/app/evals/layout.tsx` (allowlist_empty branch). Access itself is correctly gated (`requireEvalAccess`, empty allowlist ⇒ 403).

**Recommended action:** Show a generic “evaluation access is not configured” message. Keep the example in internal docs only.

**V1 necessity:** Should fix before launch  

**Estimated change size:** Tiny  

**Build / Buy / Configure:** Small Lume implementation  

**Over-engineering check:** One string. Do not hide `/evals` behind a VPN for V1; allowlist is enough.

---

### F-12 — Production Vercel region is `iad1` (US); GDPR international transfers

**Risk level:** Medium (legal), not a code bug  

**Why it matters:** `vercel.json` sets `"regions": ["iad1"]`. App runtime in the US plus OpenAI (typically US) plus whatever Supabase project region was chosen means EU personal data is transferred. Lawful transfer needs SCCs/DPA via providers — **external legal verification**, not a rewrite.

**Evidence:** `vercel.json`. Supabase region is **not** in the repo (founder dashboard).

**Recommended action:** Execute Vercel / Supabase / OpenAI / Stripe DPAs. Disclose transfers in the Privacy Policy. Optionally move Supabase to `eu-west-1` if most users are Irish/EU — product decision, not required to launch if transfers are documented and SCCs apply. Do not move Vercel solely for optics if OpenAI remains US.

**V1 necessity:** DPA + disclosure: Must. Region move: product/policy decision  

**Estimated change size:** Configure  

**Build / Buy / Configure:** Existing providers + legal  

**Over-engineering check:** An EU-only architecture with EU OpenAI residency is a later commercial choice.

---

### F-13 — No error-monitoring product; `console.error` on persist failures

**Risk level:** Low  

**Why it matters:** Persist errors go to the browser console and `serverLog` (Vercel). That is acceptable for V1 if payloads stay metadata-sized. `serverLog` redacts secret-like keys and truncates long strings (`src/lib/server-log.ts`). Prompt assembly logs are **development-only** (`logPromptAssemblyDiagnostic`, `logCaptureContextDiagnostic`).

**Evidence:** No Sentry/PostHog/Segment in `package.json`. Cockpit metrics are `NODE_ENV === "development"` (`.lume-dev/`).

**Recommended action:** Optional Sentry **with default PII scrubbing**, after launch if incidents are hard to see. Do not log prompt bodies in production (already avoided).

**V1 necessity:** Can defer  

**Estimated change size:** Small  

**Build / Buy / Configure:** Managed third-party (Sentry) when needed; existing logs sufficient for V1  

**Over-engineering check:** A full observability suite is enterprise theatre at this stage.

---

### F-14 — `LUME_ALLOW_LOCAL_IN_PRODUCTION` and demo auth still exist in code

**Risk level:** Low (if never set)  

**Why it matters:** Production persistence is forced to Supabase unless the escape hatch is true (`src/lib/persistence-mode.ts`). Demo auth is rejected when `NODE_ENV=production` and Supabase is configured (`src/lib/auth-mode.ts`, `auditProductionConfig`). A mis-set env var would put real users on localStorage.

**Evidence:** `.env.local.example` documents the hatch as dangerous. `scripts/verify-production-config.ts` asserts production rejects demo/local.

**Recommended action:** Never set the hatch on the public project. No code deletion required for V1 (useful for emergency forensics).

**V1 necessity:** Configure (do not enable)  

**Estimated change size:** None  

**Build / Buy / Configure:** Configuration change (leave unset)  

**Over-engineering check:** Deleting the hatch is not a security control; deployment discipline is.

---

### F-15 — Password policy is length-only; no special-category / children gates

**Risk level:** Low / Informational  

**Why it matters:** `validatePassword` requires 8 characters (`src/lib/auth-password.ts`). Fine for V1 individual SaaS; Supabase also enforces its dashboard policy. Lume is not a children’s service; Terms should say 16+/18+ as solicitor advises. Lume cannot detect special-category data in meeting notes; Terms should forbid uploading it.

**Recommended action:** Policy wording, not a classifier.

**V1 necessity:** Legal wording; code can defer  

**Estimated change size:** Tiny  

**Build / Buy / Configure:** Existing infrastructure sufficient  

**Over-engineering check:** Automated DLP / special-category detection is explicitly out of scope.

---

### F-16 — No data export centre

**Risk level:** Low (rights)  

**Why it matters:** Access/portability. The user can already see their project in the product. A JSON dump is nice; a support export from Supabase is enough for V1 volume.

**Recommended action:** Privacy Policy: “email us, we will provide a copy of your workspace.” Do not build an export centre now.

**V1 necessity:** Can defer (process in policy)  

**Estimated change size:** Tiny (process)  

**Build / Buy / Configure:** Existing infrastructure sufficient  

**Over-engineering check:** An export dashboard is enterprise.

---

### F-17 — Production with missing Supabase keys opens the app (`mode === "none"` bypass)

**Risk level:** High (misconfiguration)  

**Why it matters:** If production is missing `NEXT_PUBLIC_SUPABASE_URL` / anon key, `getAuthMode()` returns `"none"`. `authIsRequired()` is still true, but `src/proxy.ts` previously treated `mode === "none"` as an open gate (`NextResponse.next()`). Pages and unguarded endpoints would be public. Individual AI POSTs still 401 via `requireAiCaller`, but that is not a substitute for a closed front door. `assertProductionConfigOrThrow` exists and is not called at boot.

**Evidence:** Independent review of `src/proxy.ts` (`if (!authIsRequired() || mode === "none")`) and `src/lib/auth-mode.ts` production branch. Confirmed by `scripts/verify-tenant-isolation` / auth-mode unit paths.

**Recommended action:** When auth is required and no identity backend is configured, fail closed (503 APIs, redirect pages to login). Keep login/signup/webhook public. Do not add a boot-time crash unless Vercel deploy-time env checks are preferred later.

**V1 necessity:** Must fix before launch  

**Estimated change size:** Tiny  

**Build / Buy / Configure:** Small Lume implementation  

**Over-engineering check:** Fail-closed proxy is cheaper and safer than a new config service.

---

### F-18 — AI routes return raw `error.message` to the client

**Risk level:** Medium  

**Why it matters:** OpenAI SDK failures can include request/org identifiers or other provider text. Returning that string in a 500 body is unnecessary disclosure. Auth routes already map errors through `friendlyAuthError` on the client.

**Evidence:** Catch blocks in `/api/capture`, `/api/coach`, `/api/transcribe`, `/api/tell-me`, `/api/tell-me/refresh`, `/api/new-project`.

**Recommended action:** Log the detail server-side; return a stable generic message to the client.

**V1 necessity:** Obvious small fix  

**Estimated change size:** Tiny  

**Build / Buy / Configure:** Small Lume implementation  

**Over-engineering check:** Do not build an error-taxonomy platform.

---

### Compact V1 data inventory

| Data class | Origin | Stored | Transmitted | Persists | Personal? | Employer-confidential? | Necessary? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Account email / name | Signup | `auth.users`, `profiles` | Supabase Auth email | Until account deleted | Yes | Unlikely | Yes |
| Password | Signup | Supabase hashed (not Lume) | TLS to Auth | Hashed | Yes | No | Yes |
| Workspace membership | Trigger on signup | `workspaces`, `workspace_members` | — | Until deleted | Yes (user id) | No | Yes |
| Project truth (name, people, roles, risks, todos, decisions, knowledge, dates) | User + Capture apply | Supabase domain tables | OpenAI when AI used | Until project/account deleted | Often (names) | **Yes, by design** | **Yes — product** |
| Capture transcript + AI result | Capture | `capture_sessions` + local history | OpenAI | Until delete / local wipe | Yes | Yes | Yes |
| Audio | Mic | Not durable (memory → Whisper) | OpenAI Whisper | Transient | Voice = personal | Yes | Yes (voice Capture) |
| Memories / history events | Capture / mutations | `memories`, `history_events` | Sometimes in AI context | Until delete | Yes | Yes | Yes (memory product) |
| Tell Me snapshot | Refresh | `project_intelligence_snapshots` + localStorage | OpenAI on refresh | Until project delete | Yes | Yes | Useful, not strictly required |
| Coach markdown | Coach | `coach_sessions` + local history | OpenAI | Until delete | Yes | Yes | Yes |
| Billing customer / subscription ids | Stripe webhook | `billing_customers`, `subscriptions`, `billing_events` | Stripe | Billing retention | Yes (email to Stripe) | No | Yes when billed |
| Eval runs | Internal allowlist | `eval_runs` (service role) or `.data/` | OpenAI during eval | Indefinite | Operator email | Fixture only | Internal only |
| Paint cache / local sessions | Browser | localStorage | None | Until wipe | Yes | Yes | UX only |
| Appearance / sidebar | Browser | localStorage | None | Until clear | No | No | UX |

**Deleted-data behaviour today:** Project delete removes the project row and SET NULL children first (`deleteProjectScopedBundle`); cascade covers stakeholders/risks/knowledge/milestones/meetings/releases/snapshots. Local residue is pruned for that project id (`pruneBrowserResidueForDeletedProject`) but **other users’ leftover keys on the machine** need F-01. No silent restore from localStorage in production (`persist()` skipped when `persistMetaRef.mode === "supabase"`; `readStoredState` returns empty in production).

---

## 4. Required V1 changes

**Code (this workstream, High / obvious):**

1. Complete project-domain browser wipe on logout **and** successful login/signup; discard paint cache on user mismatch / failed unauthenticated hydrate.
2. Stop Capture GET from returning key prefix/length; require a signed-in user.
3. Cap transcription size/type.
4. Remove founder email from the public evals denial UI.
5. Fail closed in `src/proxy.ts` when auth is required and the identity backend is missing (`mode === "none"`).
6. Do not return raw OpenAI `error.message` from product AI routes.

**Founder / legal (not code):**

5. Terms of Service + Privacy Policy (Irish solicitor) + signup acceptance.
6. Support contact + written deletion/export process.
7. Execute DPAs (Supabase, Vercel, OpenAI, Stripe when live).
8. OpenAI: confirm API no-training, set spend limits, consider ZDR; never opt in to training.
9. Confirm Supabase project is not publicly readable (RLS already in migrations — verify live with `npm run verify:tenant-isolation`).
10. Confirm Auth redirect URLs and `NEXT_PUBLIC_SITE_URL`.
11. Do not set `LUME_ALLOW_LOCAL_IN_PRODUCTION`, `DEMO_USERS`, or `LUME_AUTH=demo` on production.

**Tests:** extend existing verify scripts (logout keys, login wipe, Capture GET, transcribe guard, evals copy). Live RLS tests remain skippable without credentials.

---

## 5. Third-party opportunities

| Problem | Provider / category | Benefit | Certification / assurance | Approx V1 cost/complexity | Worth it for V1? |
| --- | --- | --- | --- | --- | --- |
| Database, auth, RLS, backups | **Keep Supabase** | Already the security core | SOC 2 Type 2, ISO 27001, DPA, AES-256 at rest (provider) | Already integrated | **Yes — keep** |
| Hosting, TLS, secrets | **Keep Vercel** | Matches Next.js | SOC 2 / ISO (verify current Trust Center); DPA | Already integrated | **Yes — keep** |
| AI + Whisper | **Keep OpenAI API** | Product; no-training default on API | DPA; SOC 2 (provider). Not Lume’s cert | Already integrated | **Yes — keep** |
| Cards / subscriptions | **Keep Stripe** | PCI outsourced; no PAN in Lume | PCI DSS, SOC, DPA | Foundation already in repo | **Yes — keep** (go live when ready) |
| OpenAI bill runaway | OpenAI **usage limits** | Caps residual F-07 | — | Dashboard, minutes | **Yes — must** |
| Stronger prompt non-retention | OpenAI **ZDR** (approval) | 0-day processor retention | Provider control | Email/compliance form | **Should if approved easily** |
| Crash visibility | **Sentry** (PII scrubbing on) | See 500s without logging bodies | Sentry SOC 2; new subprocessor | ~hour + policy update | Optional after launch |
| Distributed AI rate limit | **Upstash Redis** / Vercel KV | Real per-user limits on serverless | Provider SOC 2 | Small | Defer until abuse |
| EU DB residency | Supabase **EU region** | Smaller transfer story | Same Supabase certs | Project recreate / migrate | Policy decision |
| Bot/abuse | Vercel WAF / Bot protection | Login/signup stuffing | Provider | Configure | Optional |
| Email branding | Supabase SMTP (Resend etc.) | Professional auth mail | New subprocessor | Small | When leaving default Auth email |

**Do not buy:** customer-managed KMS, DLP, Vanta/Drata to “get SOC 2 for Lume”, consent CMPs, enterprise SIEM.

Using certified providers **does not** make Lume SOC 2 or ISO certified. It **does** reduce the amount of security infrastructure Lume must operate.

---

## 6. Changes explicitly NOT recommended

- Bespoke application-level encryption / CMK / zero-knowledge (breaks Ask/Capture; no V1 threat that needs it)
- Lume obtaining SOC 2 or ISO 27001 before product-market fit
- DLP, automated employer-policy detection, special-category classifiers
- Configurable per-customer retention / legal hold
- Complicated consent workflows beyond signup + Privacy Policy
- Replacing Supabase, Vercel, OpenAI, or Stripe for marginal theoretical gain
- Making Lume “forget” project memory as a privacy strategy (that is the product)
- Enterprise audit-log suite
- Redesigning authentication (Supabase Auth is sound)
- Self-service DSAR portal
- Public security-claims microsite beyond truthful one-liners in Privacy/marketing

---

## 7. Terms / Privacy inputs

### Terms of Service — clauses to cover (solicitor to draft)

- **User authority:** users represent they have all rights and permissions to provide information to Lume, including employer/project information, and will comply with their organisation’s confidentiality, information-security, and acceptable-use policies. *(Flag for solicitor — this is the intended V1 allocation of responsibility.)*
- Ownership of user content; licence to Lume **only** to host, process, display, and run AI on that content to provide the service
- AI output is assistive, may be wrong; user remains responsible for decisions and for what they paste into employer systems
- Prohibited uses (illegal, malware, others’ accounts, scraping, uploading special-category data or children’s data, attempting to access others’ workspaces)
- Account security (user keeps credentials confidential)
- Availability / no uptime SLA for V1
- Liability cap and disclaimer of indirect loss (Irish law — solicitor)
- Indemnity for content the user was not allowed to upload (solicitor: whether appropriate)
- Termination, project deletion, and account deletion process
- Billing, trials (`LUME_TRIAL_DAYS` default 14), Stripe customer portal
- IP in the Lume software vs user content vs AI output
- Third-party processors (Supabase, Vercel, OpenAI, Stripe)
- Governing law / venue (likely Ireland — solicitor)
- Age (not for children)

### Privacy Policy — implementation checklist

| Topic | What the code actually does |
| --- | --- |
| **Controller** | Lume / the operating company (legal entity — solicitor) |
| **Categories** | Account (email, name); project content (including names of colleagues); Capture transcripts; AI outputs; billing identifiers; technical logs; browser storage |
| **Purposes** | Provide the project-memory product; auth; billing; security; improve reliability (not model training by Lume) |
| **Lawful basis** | Contract + legitimate interests — **legal wording required** |
| **Processors** | Supabase (DB/Auth/email), Vercel (hosting/logs), OpenAI (AI/Whisper), Stripe (payments). Eval store is internal. |
| **AI** | Project context is sent to OpenAI to analyse Capture, answer Ask, coach, transcribe, draft new projects. Lume does not train its own models on customer data. OpenAI API default: no training; residual retention unless ZDR — **verify in dashboard** |
| **International transfers** | Vercel `iad1` US; OpenAI typically US; Supabase region TBD — SCCs via DPAs — **legal verification** |
| **Cookies** | Essential: Supabase Auth session cookies; demo `mc_session` not used in production. Appearance `mc-appearance-v1`. No advertising cookies found |
| **Retention** | Account + projects until user deletes project or requests account deletion; billing records as required by tax law; OpenAI ~30 days unless ZDR; Vercel logs per Vercel policy |
| **Deletion** | Project delete in-product; account deletion via support (until self-service) |
| **Access** | In-product view + support export |
| **Children** | Not directed at children |
| **Special category** | Not sought; users told not to upload it |
| **Contact** | Privacy email (must exist) |
| **Source material** | [Supabase DPA](https://supabase.com/downloads/docs/Supabase+DPA+260317.pdf), [Supabase security](https://supabase.com/security), OpenAI API data/DPA, Vercel DPA, Stripe DPA |

**Controller vs processor:** Lume is **controller** of customer account data and of the project content users put in Lume. OpenAI/Supabase/Vercel/Stripe are **processors**. If a user’s employer later contracts with Lume, roles may change — **legal verification**.

---

## 8. Launch security claims

| Claim | Classification | Notes |
| --- | --- | --- |
| Encrypted in transit | **SAFE TO CLAIM NOW** | HTTPS to Vercel; TLS to Supabase, OpenAI, Stripe. Confirm production custom domain has HTTPS (Vercel default). |
| Encrypted at rest | **SAFE AFTER SMALL CHANGE** / **REQUIRES PROVIDER VERIFICATION** | True for Supabase Postgres (AES-256, provider). Confirm project settings + backups. Do not imply Lume encrypts fields itself. Safe phrasing: “Project data is encrypted at rest by our database provider.” |
| Your project data is isolated to your account | **SAFE AFTER F-01/F-02** | RLS is workspace-membership isolation (personal workspace per user today). After browser wipe + cache mismatch, this is truthful for the product. Do not say “military-grade isolation”. |
| Project data is not used to train AI models | **REQUIRES PROVIDER/LEGAL VERIFICATION** | Safe **if** (a) Lume does not train models (true in code) and (b) OpenAI org has not opted into API training (default is no) and DPA is executed. Safer: “We do not use your project data to train Lume. Our AI provider states that API data is not used for training by default.” |
| We do not sell your project data | **SAFE TO CLAIM NOW** | No ads, no data brokers in code. Solicitor should define “sell”. |
| Private by default | **DO NOT CLAIM** as a slogan | Easy to over-read. Workspaces are private to members, but data goes to OpenAI. Prefer “Your workspace is visible only to your account.” |
| Built on independently audited infrastructure | **SAFE TO CLAIM NOW** with care | “Lume runs on infrastructure providers that maintain recognised security certifications (for example SOC 2 / ISO 27001).” **DO NOT CLAIM** “Lume is ISO 27001 certified” or “Lume is SOC 2 certified”. |
| Zero-knowledge / we cannot read your data | **DO NOT CLAIM** | Operators with service role **can** read DB. Billing and evals use service role. |
| GDPR compliant | **DO NOT CLAIM** as a badge | Describe practices; let counsel decide. |
| End-to-end encrypted | **DO NOT CLAIM** | False for this architecture. |

---

## 9. Provider assurance matrix

| Provider | Purpose | Relevant assurance (provider, 2026 public materials — verify at contract time) | What it means for Lume | What it does **not** mean |
| --- | --- | --- | --- | --- |
| **Supabase** | Postgres, Auth, RLS, backups, auth email | SOC 2 Type 2; ISO 27001; DPA; AES-256 at rest; TLS in transit; GDPR-oriented docs | Lume does not run its own DB/IAM. Tenant isolation is Lume’s RLS policies on that platform. | Lume is not ISO/SOC certified. RLS bugs would still be Lume’s. |
| **Vercel** | App hosting, TLS, env secrets, logs, `iad1` | SOC 2 / ISO (confirm Trust Center); DPA | Lume does not run servers. Secrets stay in Vercel env if not `NEXT_PUBLIC_`. | Vercel logs are still Lume’s responsibility to keep free of prompts. US region ⇒ transfers. |
| **OpenAI** | Chat + Whisper | API no-training by default; DPA; SOC 2 (provider); ~30-day default retention; optional ZDR | Enables the product without Lume hosting GPUs. | Not “OpenAI never sees the data”. Not Lume’s model. Consumer ChatGPT settings are irrelevant — this is the API. |
| **Stripe** | Checkout, portal, webhooks | PCI DSS (Stripe); SOC; DPA | Lume never stores card numbers (`billing_*` holds customer/subscription ids only). | Stripe does not protect project knowledge. |
| **Email** | Supabase Auth mail | Covered under Supabase until custom SMTP | Needed for confirm/reset | Adding Resend later = new subprocessor |
| **Analytics** | None | — | Nothing to disclose | Don’t add without updating Privacy |
| **Monitoring** | None (Vercel logs only) | — | Fine for V1 | Sentry later = new subprocessor |
| **Storage buckets** | None | — | No public bucket risk | Don’t add public buckets |

**Service-role usage (inspected):** `createServiceSupabaseClient` is used for Stripe webhook/checkout/portal (no authenticated INSERT on billing tables by design) and internal evals (`eval_runs` has no authenticated policies). User CRUD uses `createServerSupabaseClient` (anon + user JWT). That is legitimate privileged use, not a backdoor for `/api/capture`.

---

## 10. Legal-review handoff

Questions for an Irish solicitor / privacy specialist (bounded, inexpensive if this audit is attached):

1. Confirm the **controller** legal entity and contact details for the Privacy Policy.
2. Confirm **lawful bases** for account data vs project content vs logs vs billing.
3. Draft **Terms** including the user-authority / employer-policy representation, AI disclaimers, liability cap, governing law, and trial/billing.
4. Draft **Privacy Policy** from Section 8 inventory; include OpenAI as processor and US transfers (Vercel iad1 + OpenAI).
5. Confirm whether **legitimate interests** vs contract is the right basis for AI processing of project notes that include colleague names (personal data of third parties).
6. Confirm whether a **DPIA** is recommended for an individual SaaS that sends project notes to OpenAI.
7. Confirm **international transfer** wording (SCCs via vendor DPAs vs needing extra language).
8. Confirm **retention** wording: until deletion vs OpenAI 30-day vs billing/tax.
9. Confirm **erasure process**: support-led account deletion sufficient for V1 volume? Any Irish/ePrivacy cookie notice beyond essential Auth cookies?
10. Confirm **age** (16 vs 18) and that Lume should refuse children’s use in Terms only.
11. Confirm marketing claim “not used to train AI models” against the executed OpenAI DPA (do not rely on this audit’s third-party blog summaries).
12. Confirm whether signup needs explicit **acceptance** of Terms + Privacy (recommended).
13. Confirm **subprocessor list** publication duty and change-notification.
14. Advise on **special-category** prohibition wording (health, union, etc. accidentally in meeting notes).
15. Confirm Stripe trial/auto-renew disclosure for Irish/EU consumer vs B2B individual.
16. Confirm we must **not** describe Lume as SOC 2/ISO certified.

**Technically resolved:** RLS model, production auth/persistence guards, no committed secrets, no public storage, AI POST auth, Stripe webhook signatures, billing tables not client-writable, evals allowlist, prompt logging off in production.

**Product/policy decisions:** EU vs US Supabase region; ZDR request; Sentry; self-service account deletion vs support; when Stripe goes live.

**Legal wording required:** all customer-facing legal/marketing sentences about privacy, AI training, encryption, and isolation.

**External legal verification required:** OpenAI/Vercel/Supabase/Stripe DPA execution, transfer mechanism, training clause, “GDPR compliant” (avoid), children’s age, liability.

---

## Lightweight V1 threat model

| Threat | Realistic? | Mitigation |
| --- | --- | --- |
| User A reads User B’s DB rows | Yes, class of risk | RLS + live `verify:tenant-isolation`; keep using user-scoped clients |
| Shared browser leftover / account switch | Yes | F-01, F-02 |
| Exposed OpenAI/service-role keys | Yes if env mis-set | Keys server-only; `verify-production-config`; never `NEXT_PUBLIC_SERVICE` |
| Public DB / table grants | Possible if migrations not applied | Founder: confirm RLS enabled on hosted project |
| Sensitive logging | Prompt logs are dev-only | Keep it that way; Sentry scrub if added |
| Unauthenticated AI | POST gated; GET Capture was weak | F-03 |
| Orphaned delete | Project delete is real; account delete is not | F-06 process |
| Compromised account | Password + email reset | User responsibility in Terms; optional later 2FA (Supabase) |
| Excessive third-party send | OpenAI sees project context | Necessary; minimise via existing context caps; disclose |
| Service-role abuse via user routes | Billing/evals only, gated | Keep it that way |
| In-memory rate-limit bypass | Yes on serverless | OpenAI spend cap |
| `LUME_ALLOW_LOCAL_IN_PRODUCTION` | Only if set | Don’t set |

---

## Authentication / tenant isolation (audit conclusion)

Production auth is Supabase (`getAuthMode` never returns `demo` in production when configured). `src/proxy.ts` requires a user for non-public pages and `/api/*` except `/api/auth/*` and `/api/billing/webhook`. If production has no Supabase keys, the proxy **fails closed** (503 APIs / login redirect) instead of treating `mode === "none"` as open. AI POSTs call `requireAiCaller` (auth + entitlement + rate limit). Workspace load/create/delete use `createServerSupabaseClient` + `auth.getUser()`. RLS is membership-based (`is_workspace_member` security definer). Billing writes are service-role or security-definer trial RPC. Dev pages call `notFound()` outside development. `/evals` is allowlisted.

**No redesign of authentication is recommended.** Cross-tenant DB access was not found in code review; **live RLS verification on the production project remains a founder must**.

---

## Encryption position (conventional SaaS)

| Leg | Position |
| --- | --- |
| Browser ↔ Lume | HTTPS on Vercel | 
| Lume ↔ Supabase | TLS (Supabase URL `https://`) |
| Lume ↔ OpenAI | HTTPS `api.openai.com` |
| Lume ↔ Stripe | HTTPS Stripe SDK |
| At rest Postgres | Supabase AES-256 (provider) — **verify project** |
| Backups | Supabase encrypted backups (provider) |
| Vercel runtime | Provider disk encryption — not a substitute for not logging bodies |
| Bypass risks | localStorage (F-01/F-02), Vercel logs if someone logs bodies (currently avoided), test fixtures (synthetic) |

Custom crypto: **not recommended**.

---

*Implementation note (same workstream): F-01, F-02, F-03, F-04, F-08 (`store: false`), and F-11 were fixed in code. F-05/F-06/F-07/F-12 remain founder + solicitor actions. See the PR completion notes.*

*End of audit report.*
