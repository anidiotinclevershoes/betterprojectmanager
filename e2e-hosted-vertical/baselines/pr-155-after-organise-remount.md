# Hosted vertical — after Organise remount fix

Recorded 11 September 2026. Harness run id `hv-20260911T185955Z`.

Target: PR #155 Preview after `b04d140` (Keep New Project composer mounted across billing-gate paint).
Harness: `cursor/hosted-vertical-journeys-2024` at `b338f95`.

Do **not** treat this as a product pass. Do not relax journey expectations. Newly exposed Capture/Review/Apply failures were not fixed in this pass.

## Matrix

| Journey | Vercel access | Lume auth | Hosted API | Live OpenAI | UI interpretation | Review | Apply | Reload/persistence | Result | Earliest boundary |
|---|---|---|---|---|---|---|---|---|---|---|
| New Project partial people | PASS | PASS | FAIL | FAIL | FAIL | n/a | n/a | n/a | FAIL | AUTH (HTTP 401 Sign in required on first Organise; harness labelled OPENAI because provenance was missing) |
| Full New Project + Create + hard reload | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | IDENTITY |
| Capture date update → Apply → reload | PASS | PASS | PASS | PASS | PASS | PASS | PASS | n/a | FAIL | PROJECTION_RELOAD |
| New person / responsibility | PASS | PASS | PASS | PASS | PASS | PASS | n/a | n/a | PASS |  |
| Ambiguity stays local | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | empty-server draft (`stakeholders: []`, `provisionalItems: []`) plus Create blocked on duplicate code EAH |
| Mixed realistic paste | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | REVIEW_UI |

Runtime: ~150 seconds.

## What the remount fix unblocked

Organise HTTP 200 drafts now paint into the composer. Full New Project visible People: `Olga Petrov — UAT`, `Sarah Kim — Release`. Capture date, Andris, and Mixed all created a project and opened Capture.

## Journeys that reached Capture

- Capture date update → Apply → reload
- New person / responsibility (PASS through Review)
- Mixed realistic paste

## Newly exposed failures (not fixed here)

- Full New Project: people/knowledge painted; composer date labels do not include `12 September 2026` / `15 September 2026` strings the journey regex requires.
- Capture date: Apply wrote `Production release · 20 Sep`; journey regex wants `20 Sep 2026` / `Sep 20` / ISO.
- Mixed: Review extracted “She will own the remaining UAT gaps” in the transcript panel, but no `article[data-review-family]` card matched that text (Andris landed as Needs You; UAT risk was bound to a person).
- First Bob/Mike Organise: `POST /api/new-project` → 401 `Sign in required.` Distinct from the remount bug and from empty-server observation loss.
- Ambiguity Organise: live OpenAI 200 with empty `draft.stakeholders` and empty `provisionalItems` — the earlier empty-server-response mode, still reproducible.
