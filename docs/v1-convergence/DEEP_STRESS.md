# Deep stress coverage — Harbourline Civic Archive Refresh

Frozen, deterministic evidence that Lume still behaves when a project is large, old, messy, and stateful.

This is **test / evidence** only. The three scenarios are frozen. Do not rewrite them to make production pass. Do not execute a paid gpt-4o-mini live run from this pack; the same scenario intent is reusable for that later.

## Product philosophy

Difficulty-sensitive 75% — not a quota.

- **Easy / clear** should flow.
- **Moderate** usually resolves; asking is healthy where uncertainty changes stored truth.
- **Extremely difficult** may reasonably become **Needs you**.

Failure is silent wrong durable truth, lost approved truth, wrong object/project/domain, duplicate identity, or reload disagreement. “Lume asked a question” is not a failure.

## Scenarios

| Id | File | Path exercised |
| --- | --- | --- |
| `harbourline-deep-creation-v1` | `src/lib/eval-capture-v2/stress/deep-creation.ts` | **New Project V2**, not Capture V2 |
| `harbourline-capture-marathon-v1` | `src/lib/eval-capture-v2/stress/marathon.ts` | Capture V2 stacked runtime (50 events) |
| `harbourline-handover-v1` | `src/lib/eval-capture-v2/stress/handover.ts` | Capture V2 stacked runtime against a mature seed |

Project: **Harbourline Civic Archive Refresh** (`proj-harbourline`). Distinct from Candyland / Toyworld / GamingStudio5000.

## Architectural honesty — Deep Project Creation

New Project is **not** Capture V2 Review-before-write.

Real path:

`frozen narrative → frozen envelope → parseNewProjectV2Envelope → (optional recategorise) → draftFromProvisional → buildNewProject → MissionState`

Documented V1 limits (observe, do not pretend otherwise):

- Buckets: person, risk, milestone, todo, knowledge, commentary, ignored.
- `responsibility` / `availability` map to **person**; `decision` maps to **knowledge**.
- Risks become `knowledge.sections.risks` bullets, **not** `state.risks` records.
- `buildNewProject` always creates todos with `done: false`. Completed work in the dump must stay knowledge, not a new open To Do.
- `uniqueBullets` in `buildNewProject` caps each knowledge section at **12**.
- Display reconcile cap in `src/lib/knowledge.ts` is **8** (`MAX_BULLETS_PER_SECTION`).
- New Project mapper does **not** identity-merge repeated full names (Capture V2 person identity is a different path).
- Created IDs use `Math.random()` / UUID — assert by name/title, not `proj-harbourline`.

Playwright mocks `/api/new-project` with `pipeline: "v2"` so the Talk → categorise → setup review → create flow can run without `LUME_NEW_PROJECT_V2` or a provider.

## Capture Marathon / handover

Reuse `runStackedStep` / `applyApprovedCaptureSuggestion` with `applyReadyWrites: true` so Apply Ready siblings are actually persisted (including mixed Captures). Existing candyland / toyworld / gamingstudio5000 stacked packs are unchanged and are **not** extended with these 50 steps.

Checkpoints every 10 marathon events: snapshot → JSON reload clone → continue. Isolation vs the three experimental worlds is asserted after the journey.

The stacked-runtime dummy `classifyLumeSafety` allowlist is **not** the stress classifier (knowledge/decision extras would false-positive). Stress classification is in `stress/classify.ts`.

## Commands

```bash
npm run verify:eval-stress          # all three journeys, writes test-results/eval-stress.json
npm run verify:stacked-capture      # existing three-world stacked regression
npx tsc --noEmit
npm test                            # includes verify:eval-stress
npx playwright test e2e/stress-journeys.spec.ts
```

No provider calls. `OPENAI_API_KEY` is cleared by the regression suite.

## Future live gpt-4o-mini stress run

Reuse the frozen narratives and scenario intent. Do not retune envelopes after seeing live output. Do not add a second eval framework.
