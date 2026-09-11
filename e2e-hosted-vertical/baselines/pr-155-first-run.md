# First hosted baseline — PR #155 Preview

Recorded 11 September 2026. Harness SHA `4a968d04245e5fee7799866e6efad9f6113692ea`. Target source SHA `58b15c8fd5552dc07a2139632b683a9ca3c61df9` (PR #155 `cursor/visual-convergence-locked-mp-cedc`).

This is an **AUTH-blocked** baseline. It does **not** prove or disprove Bob/Mike, Capture, Apply, or persistence. Do not treat it as a product pass. Do not relax journey expectations.

## Environment present (values never stored)

| Variable | Present |
| --- | --- |
| `LUME_E2E_BASE_URL` | yes (PR #155 Vercel Preview from the bot comment) |
| `LUME_E2E_EMAIL` | no |
| `LUME_E2E_PASSWORD` | no |
| `LUME_E2E_VERCEL_BYPASS_SECRET` | no |

`GET /login` on that Preview returned **HTTP 302** to Vercel Deployment Protection SSO (`vercel.com/sso-api` → `Login – Vercel`). Playwright opened that page and classified every journey as **AUTH**.

Screenshots of the SSO page were captured locally under `test-results/hosted-vertical/` (gitignored). The painted frame was blank white; the diagnostic JSON recorded `title: Login – Vercel` and `vercelSso: true`.

## Matrix

| Journey | Hosted API | Live OpenAI | UI interpretation | Review | Apply | Reload/persistence | PASS/FAIL | Earliest boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| New Project partial people | BLOCKED | BLOCKED | BLOCKED | n/a | n/a | n/a | FAIL | AUTH |
| Full New Project + Create + hard reload | BLOCKED | BLOCKED | BLOCKED | n/a | n/a | n/a | FAIL | AUTH |
| Capture date update → Apply → reload | BLOCKED | BLOCKED | BLOCKED | n/a | n/a | n/a | FAIL | AUTH |
| New person / responsibility | BLOCKED | BLOCKED | BLOCKED | n/a | n/a | n/a | FAIL | AUTH |
| Ambiguity stays local | BLOCKED | BLOCKED | BLOCKED | n/a | n/a | n/a | FAIL | AUTH |
| Mixed realistic paste | BLOCKED | BLOCKED | BLOCKED | n/a | n/a | n/a | FAIL | AUTH |

Runtime: ~70 seconds. OpenAI calls: 0.

Bob/Mike was **not** reproduced automatically. The harness stopped at AUTH before Organise. Prior D-052 diagnostic (not this run) already showed hosted Organise of “bob is the ba” / “mike handles the legacy builds” returning empty `draft.stakeholders` and `provisionalItems`.

## Still required from Tom

1. Enable Vercel **Protection Bypass for Automation** and set `LUME_E2E_VERCEL_BYPASS_SECRET`.
2. Create a disposable Lume account and set `LUME_E2E_EMAIL` / `LUME_E2E_PASSWORD`.
3. Re-run `npm run e2e:hosted-vertical` against the same Preview URL.

Until those exist, Cursor cannot complete the live-OpenAI vertical gate.
