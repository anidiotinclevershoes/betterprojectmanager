# Hosted vertical — reclassification of hv-20260911T185955Z

Recorded 11 September 2026. This is a **harness calibration** of the remount-fix rerun. It does **not** change product UI or Apply.

A failure is not automatically a product defect.

| Journey | Result on that run | Classification | Earliest real product boundary | Why |
|---|---|---|---|---|
| New Project partial people | FAIL | AUTH_FLAKE | AUTH | `POST /api/new-project` → 401 `Sign in required.` Harness had only waited to leave `/login`, then labelled the miss OPENAI because provenance was absent. This is AUTH, not remount, not OpenAI. |
| Full New Project + Create + hard reload | FAIL | HARNESS_ASSERTION | none on that run | Organise 200, live OpenAI, people painted (`Olga Petrov — UAT`, `Sarah Kim — Release`), knowledge titles painted. Draft JSON already had `importantDates` `2026-09-12` / `2026-09-15`. Compact composer did not spell `12 September 2026`. Pre-create regex was format-specific. |
| Capture date update → Apply → reload | FAIL | HARNESS_ASSERTION | none on that run | Capture → Review → Apply already showed `Production release · 20 Sep`. Regex required `20 Sep 2026` / `Sep 20` / ISO, so it never reached hard reload. |
| New person / responsibility | PASS | — | — | Vertical path through Review. |
| Ambiguity stays local | FAIL | HARNESS_SETUP | (code collision) plus a **separate** empty-server Organise | Derived code `EAH` collided with Andris (`suggestCode` first-three initials). Also Organise returned empty `draft.stakeholders` / `provisionalItems` — that empty-server class is D-052 / PR #157, **not** the remount bug, and is kept as a separate investigation. This journey must not depend on live Organise. |
| Mixed realistic paste | FAIL | HARNESS_ASSERTION | none proven on that run | Date UPDATE Production release 20 Sep was ready; Andris Needs You; pronoun extracted but harness required the exact sentence on a Review card. Semantic survival is not an exact-text miss. |

## Empty-server (D-052) — keep separate

PR #157 / branch `cursor/np-organise-observation-loss-cedc`: earliest loss is VALIDATE, not `draftFromProvisional`. `parseNewProjectV2Envelope` maps only accepted observations. Hosted Ambiguity Organise on this run (HTTP 200, `provider=openai`, `fallback=false`, empty people) matches that class.

Do **not** implement the adapter fix in the calibration pass. Do **not** conflate it with the fixed EntitlementGate remount.
