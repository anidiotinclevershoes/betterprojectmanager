# Simplification + Astra control — preflight

Recorded before live runs. Non-mergeable experiment.

```text
Working branch: experiment/simplification-astra-control
Created from: experiment/capture-three-way-bakeoff
origin/main HEAD: 920d65d9c0f6e49efca8e26fc8906dbbd11e8f25
Merge-base with main: 920d65d9c0f6e49efca8e26fc8906dbbd11e8f25
Contains current main?: YES
Working tree at preflight: experiment-only additions under experiments/simplification-astra-control/
PR base: experiment/capture-three-way-bakeoff (DO NOT MERGE to main)
Dependencies: none in production Capture
Shared/global files expected: none
Branch classification: EXPERIMENT (LUME_EXPERIMENT=1)
```

## What this experiment changes

Only the experimental model id for Simplification’s existing Prompt A extraction call.

Mechanism: existing `OPENAI_MODEL` override in `resolveOpenAIChatModel()` on the pinned Simplification SHA. That is a documented config override, not a resolver/prompt redesign.

## What this experiment does not change

- `main`
- `integration/capture-simplification-v1`
- AI-first experiment code / prompts / snapshot
- three-way bake-off results, corpus, or expected outcomes
- Prompt A text, temperature, `response_format: json_object`
- Simplification validation / resolve / leftover coverage / `planCaptureApply`

## Pins

| Role | SHA |
| --- | --- |
| Simplification architecture | `bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0` |
| Frozen corpus (read-only) | SHA-256 `925b3395268d56482b1ce8e0f6fde82a1c4a87f473432fcb73919f809a66cd14` |
| Bake-off comparison baselines | `experiments/capture-three-way-bakeoff/results/` (read-only) |

Worktree: `/tmp/lume-bakeoff/simplification-astra` @ `bd76bbf` (dedicated; bake-off worktrees untouched).

## Model

- Requested: `gpt-6-astra` (same id as accepted AI-first Gate 1 v2)
- Prompt A text: unchanged (`capture-v2-eval-baseline-v2`)
- `response_format`: `{ type: "json_object" }` unchanged
- Silent substitution: forbidden. Record requested vs response model on every case.
- `OPENAI_API_KEY`: present

### Trivial adapter (required)

A first probe with the unmodified Prompt A extract path (`temperature: 0.2`) returned HTTP 400:

`Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.`

The experiment-only runner therefore **omits `temperature`**, matching the accepted AI-first Astra request (which also omitted temperature). This is not a Prompt A rewrite. It is recorded on every run as `adapter: omit-temperature-for-gpt-6-astra`.

If `json_object` had also failed, the experiment would STOP.

## Isolation

- Do not import AI-first interpreter, Gate 1 prompt, or dumb snapshot serializer.
- Do not write into `experiments/capture-three-way-bakeoff/`.
- Do not modify committed files in the Simplification worktree.
