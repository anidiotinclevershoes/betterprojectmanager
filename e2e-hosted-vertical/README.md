# Hosted vertical journey harness

Opt-in Playwright suite that proves or disproves Lume’s six critical **hosted** user journeys:

browser → authenticated UI → real hosted API → **live OpenAI** → deterministic transform → Review → Apply → hosted Supabase → hard reload.

This is **not** the frozen local `e2e/` suite. It does **not** stub OpenAI. It is **not** part of `npm test`.

D-051 provenance on each relevant `/api/new-project` and `/api/capture` response must show:

```text
provider=openai
fallback=false
```

plus `requestedModel` / `responseModel` when the hosted body includes them.

A later deterministic E2E mode may exist. It does **not** satisfy this gate.

## One-time configuration (Tom)

Do **not** put these values in git, chat, screenshots, or a Cursor message. Put them only in your local shell, or in Cloud Agent environment secrets.

Do the Vercel bypass **first**. Preview is behind Deployment Protection; without the bypass you cannot open `/signup` on the Preview.

### 1. Protection Bypass for Automation

Official docs: [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation). You need Vercel **Member** or **Project Administrator**.

1. Open [vercel.com/dashboard](https://vercel.com/dashboard) and select the **betterprojectmanager** project.
2. **Settings** → **Deployment Protection**.
3. Find **Protection Bypass for Automation**.
4. Click **Create** / **Generate**. Label it `hosted-vertical-playwright` (or similar).
5. Copy the secret **once**. Store it in a password manager. Do not paste it into Slack, GitHub, or chat.
6. Leave Deployment Protection **on**. Do not make the Preview public.

On the machine that will run the suite:

```bash
export LUME_E2E_VERCEL_BYPASS_SECRET="the-secret-from-vercel"
```

`VERCEL_AUTOMATION_BYPASS_SECRET` is accepted as an alias. The harness sends `x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie: true`. It never logs the secret.

Check the bypass without logging it (expect HTTP 200, not a 302 to `vercel.com/sso-api`):

```bash
curl -sI \
  -H "x-vercel-protection-bypass: $LUME_E2E_VERCEL_BYPASS_SECRET" \
  -H "x-vercel-set-bypass-cookie: true" \
  "$LUME_E2E_BASE_URL/login"
```

### 2. Preview URL

1. Open the PR under test (first baseline: GitHub PR #155).
2. Find the **Vercel** bot comment. In the table, click **Preview**.
3. Copy the `https://….vercel.app` origin only (no path, no query).

```bash
export LUME_E2E_BASE_URL="https://….vercel.app"
```

Never commit that hostname. It changes per PR.

### 3. Disposable Lume account

Do **not** use a personal dogfood login. Create a throwaway mailbox you control (or a plus-address you will not reuse for real work).

Password: at least 8 characters. After signup, **confirm the email** if Lume says “Check your email”.

**Easiest path if Production is reachable:** sign up on Production (`/signup` on the live Lume host). Preview uses the same Supabase Auth, so that account can sign in on Preview once the bypass is set.

**If you must sign up on the Preview** (Production also gated, or you want Preview-only):

1. Set `LUME_E2E_BASE_URL` and `LUME_E2E_VERCEL_BYPASS_SECRET` as above.
2. Open this URL once in your browser (it sets the bypass cookie, then you can use the app normally):

   ```text
   $LUME_E2E_BASE_URL/signup?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true
   ```

3. Create the account. Confirm the email if asked. Sign in once by hand to prove it works.

Then:

```bash
export LUME_E2E_EMAIL="the-disposable-address"
export LUME_E2E_PASSWORD="the-password"
```

### 4. Hand the values to the runner (never to chat)

**Tom runs it locally** (preferred):

```bash
npx playwright install chromium   # once
npm run e2e:hosted-vertical
```

**Cursor / Cloud Agent runs it:** add the four values as **environment secrets** on the Cloud Agent environment (not in `.env.local` committed to git, not in the PR). Then tell the agent “hosted vertical secrets are set — re-run” **without** pasting the values.

Until those are set, every journey fails at **AUTH**. That is an honest baseline, not a product pass.

First recorded AUTH-blocked run: [`baselines/pr-155-first-run.md`](./baselines/pr-155-first-run.md).
First secrets-present run: [`baselines/pr-155-secrets-present-run.md`](./baselines/pr-155-secrets-present-run.md) — Vercel and Lume auth pass; Bob/Mike Organise returns people in HTTP and paints an empty People frame.

Optional:

```bash
export LUME_E2E_RUN_ID="hv-manual-1"
```

Every journey fills **both** a unique project name and a unique `np-code` (max 12 characters). Derived three-letter codes collide (`E2E Andris…` and `E2E Ambiguity…` both become `EAH`). Cleanup via delete is optional and is **not** a pass condition.

After Sign in, the harness probes `/api/auth/me` (must include `user.id`), plus `/api/workspace/state` or `/api/billing/status`, until an authenticated Lume endpoint is actually usable. Leaving `/login` is not enough. Organise/Capture **401 is not retried**.

## Commands

All six journeys:

```bash
npm run e2e:hosted-vertical
```

One journey:

```bash
npm run e2e:hosted-vertical -- --grep "New Project partial people"
npm run e2e:hosted-vertical -- --grep "Full New Project + Create + hard reload"
npm run e2e:hosted-vertical -- --grep "Capture date update"
npm run e2e:hosted-vertical -- --grep "New person / responsibility"
npm run e2e:hosted-vertical -- --grep "Ambiguity stays local"
npm run e2e:hosted-vertical -- --grep "Mixed realistic paste"
```

Opt-in Apply/reload + Ambiguity traces (not part of the calibrated six):

```bash
npx playwright test -c e2e-hosted-vertical/playwright.trace.config.ts
```

Install Chromium once on the machine that will run the suite:

```bash
npx playwright install chromium
```

## What a pass means

A journey passes only if the **user-observable vertical path** holds. Inner helpers, injected model JSON, direct Supabase seeds, API-status-only checks, Review-only checks, or DB-only asserts are not enough.

On failure the harness records (sanitized):

- request URL and HTTP status
- response body with secrets stripped
- screenshot
- visible People / Needs You / Review text
- test run id and project id
- D-051 `provider` / `requestedModel` / `responseModel` / `fallback`

Never stored: passwords, cookies, auth tokens, OpenAI keys, Vercel bypass secrets.

Artifacts: `test-results/hosted-vertical/` (`matrix.md`, `matrix.json`, HTML report, per-test diagnostics). Playwright traces are off so bypass/auth headers are not written to disk.

## Journeys

| Journey | What must remain true |
| --- | --- |
| New Project partial people | Organise `bob is the ba` / `mike handles the legacy builds`. Name-only Person is valid. Bob/Mike must not vanish. Session must be proven usable before Organise. **401 after that proof is AUTH, not OpenAI.** Empty `draft.stakeholders` + empty `provisionalItems` is the separate D-052 empty-server class. |
| Full New Project + Create + hard reload | Organise must store `2026-09-12` and `2026-09-15` on the draft. Compact composer may show titles only (`Olga Petrov — UAT`, `Production release`) without spelling the long date. Create, then hard reload, must project the canonical dates (including compact `12 Sep` / `15 Sep`). |
| Capture date update → Apply → reload | Live OpenAI; ordinary Update included by default; Apply via real UI; no error banner; `20 Sep` is a valid compact rendering of 20 September 2026; that date must persist after hard reload. Also exercises hosted `capture_apply_receipts`. |
| New person / responsibility | “Andris is responsible for Legacy.” Unrelated people must not steal identity. Andris must not vanish. First-name-only **Needs You is acceptable**. Do not force an unsafe Create. |
| Ambiguity stays local | Seed Olga Petrov / Sarah Kim / Production release through New Project **Add person / Add knowledge** (not live Organise, not Supabase). Unique code per run. Capture pronoun UAT ownership plus Production release 21 Sep 2026. Pronoun stays Needs You. Date sibling may be create or update, is Applied, and survives reload. Fail only if Capture ambiguity behaviour itself fails. |
| Mixed realistic paste | Compare semantics, not exact source sentences. Clear date update, Andris, genuine ambiguity, unrelated catering. Ambiguity stays local; Apply-ready can apply; reload shows only applied truth. |

Do **not** change expectations to make the current build green. Do **not** fix product defects from this harness.

## CI recommendation (do not enable yet)

Later, a **manual** GitHub Action (`workflow_dispatch` only) with repository secrets for the disposable account, bypass secret, and Preview URL. Do **not** run on every commit or on ordinary `npm test`. Live OpenAI cost is real.

## Isolation

- Default Playwright config (`e2e/`, `npm run test:e2e`) is unchanged and still freezes/mocks OpenAI.
- `scripts/run-regression-suite.ts` does not include this suite.
- No Capture / New Project production behaviour is changed by this folder.
