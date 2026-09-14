# Gate 1 v2 preflight

Fresh non-mergeable experiment. Not a continuation of `experiment/ai-first-capture-gate1`.
Does not import Simplified Capture / Prompt A Phase 1 (`cursor/prompt-a-left-untouched-e61d`, PR #175).

```text
Working branch: experiment/ai-first-capture-gate1-v2
Branch HEAD: 92d61d13c4407d04a8e20960e7eb38efa0b103c3
origin/main HEAD: 92d61d13c4407d04a8e20960e7eb38efa0b103c3
Merge-base: 92d61d13c4407d04a8e20960e7eb38efa0b103c3
Contains current main?: YES
Contains PR #174 / 431ea47980e00f2a13a6935b99e437cf637dd146?: YES
Contains unmerged Simplified Capture Phase 1 / PR #175?: NO
Working tree clean?: YES (at branch creation)
Branch classification: EXPERIMENT
```

## Isolation

- Common baseline: current `origin/main` only.
- Not imported: `src/lib/experiments/ai-first-capture-gate1/**` (v1 spike — comparison evidence only).
- Not imported: `cursor/prompt-a-left-untouched-e61d` Prompt A edits.
- Production Capture / Review / Apply / persist files are not modified.

## OpenAI

- `src/lib/openai.ts`, `src/lib/openai-model.ts`, `src/lib/capture-v2/extract.ts`
- Experiment default model: `gpt-6-astra` (override `GATE1_V2_MODEL`)
- Production comparison uses current Prompt A + `extractObservationsWithOpenAI` + `runCaptureV2FromModelJson` (includes rematerialise / hydrate)

## Rescue to bypass on the AI-first path

- `rematerialize*` in `src/lib/capture-v2/resolve.ts`
- `hydrateFromLocalEvidence`
- date/name/status regex recovery
- `runCaptureV2FromModelJson` / `validateObservations` / coverage synthesis

AI-first allows only JSON parse, enum check, and “does this id exist in the snapshot?”
