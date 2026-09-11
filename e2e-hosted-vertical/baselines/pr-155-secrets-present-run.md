# Hosted vertical baseline — PR #155 Preview (secrets present)

Recorded 11 September 2026. Harness run id `hv-20260911T172834Z`.

Target: PR #155 `cursor/visual-convergence-locked-mp-cedc` at `58b15c8fd5552dc07a2139632b683a9ca3c61df9`.
Harness: `cursor/hosted-vertical-journeys-2024`.

This run reached Lume `/login` through Vercel Protection Bypass, signed in through the real Sign in form, and called live OpenAI (`provider=openai`, `fallback=false`, `gpt-4o-mini-2024-07-18`). It is **not** an AUTH-blocked baseline.

Do **not** treat this as a product pass. Do not relax journey expectations. Do not fix these defects in the harness branch.

## Environment present (values never stored)

| Variable | Present |
| --- | --- |
| `LUME_E2E_BASE_URL` | yes |
| `LUME_E2E_EMAIL` | yes |
| `LUME_E2E_PASSWORD` | yes |
| `LUME_E2E_VERCEL_BYPASS_SECRET` | yes |

## Matrix

| Journey | Vercel access | Lume auth | Hosted API | Live OpenAI | UI interpretation | Review | Apply | Reload/persistence | Result | Earliest boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| New Project partial people | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | NEW_PROJECT_ADAPTER |
| Full New Project + Create + hard reload | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | NEW_PROJECT_ADAPTER |
| Capture date update → Apply → reload | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | UI_INPUT |
| New person / responsibility | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | UI_INPUT |
| Ambiguity stays local | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | UI_INPUT |
| Mixed realistic paste | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | UI_INPUT |

Runtime: ~125 seconds. Live OpenAI `/api/new-project` calls: 6. Capture/Apply were not reached.

## Bob/Mike automatic reproduction

**Reproduced.** Organise notes `bob is the ba` / `mike handles the legacy builds` ran once.

D-051 provenance:

```text
provider=openai
requestedModel=gpt-4o-mini-2024-07-18
responseModel=gpt-4o-mini-2024-07-18
fallback=false
path=new-project-v2/parseObservationEnvelope+draftFromProvisional
```

HTTP `/api/new-project` was **200**. The body included `draft.stakeholders` named Bob and Mike, and two `provisionalItems` (`observationCount` equivalent = 2).

The New Project People frame stayed empty. Needs You stayed empty. Project name stayed on the placeholder. That is the user-visible disappearance: the hosted model returned people, and the Organise UI did not show them.

This is a different slice of the same vertical failure Tom saw by hand (empty People after a 200 Organise). In this run the JSON stakeholders were populated; the paint/merge into the composer did not happen.

## Other journeys

All five remaining journeys also got live OpenAI Organise 200s. The composer still showed empty Issues / People / To Do / Knowledge, so Create Project stayed blocked (empty name). Capture → Review → Apply → reload was not exercised. That is a blocked later journey, not a pass.

## Commands

```bash
npm run e2e:hosted-vertical
npm run e2e:hosted-vertical -- --grep "New Project partial people"
```
