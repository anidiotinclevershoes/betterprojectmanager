# Gate 1 preflight

Recorded before experiment code was written. Branch later created from current `origin/main`.

```text
Working branch: experiment/ai-first-capture-gate1
Branch HEAD: 92d61d13c4407d04a8e20960e7eb38efa0b103c3
origin/main HEAD: 92d61d13c4407d04a8e20960e7eb38efa0b103c3
Merge-base: 92d61d13c4407d04a8e20960e7eb38efa0b103c3
Ahead: 0
Behind: 0
Contains current main?: YES
Working tree clean?: YES (at branch creation)
PR base: none — non-mergeable experiment
Dependencies: none on other product branches
Shared/global files expected: none
Branch classification: EXPERIMENT
```

Local `main` was materially stale (`7f94ec4`, 2 commits behind, Capture/Review files changed). Work was recreated from current `origin/main` rather than continuing on stale `main`.

## Isolation

Safe to proceed as an `experiment/` spike. Production Capture / Review / Apply / persist / store / migrations are not owned by this branch.

## Existing OpenAI invocation

- Key helper / chat privacy: `src/lib/openai.ts` (`getOpenAIKey`, `isOpenAIConfigured`, `withOpenAiChatPrivacy`)
- Model pin / override: `src/lib/openai-model.ts` (`PINNED_OPENAI_CHAT_MODEL = gpt-4o-mini-2024-07-18`)
- Production Capture V2 extract: `src/lib/capture-v2/extract.ts` → `https://api.openai.com/v1/chat/completions` with `response_format: json_object`
- Eval transport: `src/lib/eval-capture-v2/adapters/openai.ts`

Configured environment: `OPENAI_API_KEY` present. `OPENAI_MODEL` unset.

Astra probe (this environment): `GET /v1/models/gpt-6-astra` returned `id=gpt-6-astra`. A structured chat-completions ping returned `response.model=gpt-6-astra`. Gate 1 therefore uses Astra. It does not substitute `gpt-4o-mini`.

## Fixtures / harnesses reused

- Capture V2 eval corpus: `src/lib/eval-capture-v2/corpus.ts`
- Experimental worlds: `src/lib/experiments/worlds.ts` (Candyland / Toyworld / GamingStudio5000)
- Current extract + resolve comparison: `extractObservationsWithOpenAI` + `evaluateAgainstCase`
- Long-haul case: hosted holdout `H6_MESSY_OPS_PASTE` (`e2e-hosted-holdout/frozen-spec.ts`) plus published post-fix-3 excerpt

## Where canonical People / Issues / To Do / Knowledge are read

Durable authority is Supabase. Surfaces re-project it.

In this spike, current truth is read from the in-memory `CaptureApplyWorld` already used by Capture V2 resolve / evals:

- People: `world.projects[].stakeholders`
- Issues: `world.risks`
- To Do: `world.todos`
- Knowledge: `world.knowledge` (legacy section bullets + structured items)
- Dated milestones: `world.timeline` (needed for the selected date-move cases)

Production load path for real projects is `src/lib/data/supabase/load-mission-state.ts`. This experiment does not open Supabase and does not persist.
