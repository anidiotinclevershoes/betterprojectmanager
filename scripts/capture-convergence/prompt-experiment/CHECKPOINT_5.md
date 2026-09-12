# Checkpoint 5 — Prompt E vs A (pending live)

Prompt E is production A plus two short constraints:

- C: reference discipline (do not guess pronouns; keep contradictions; no sibling-name import)
- D: create-ID discipline (no invented `candidateTargetId` on create; no project UUID as entity id)

Production `src/lib/capture-v2/prompt.ts` is unchanged. E lives only in this runner.

Live A vs E: `LUME_CAPTURE_LIVE=1 npx tsx scripts/capture-convergence/prompt-experiment/run.ts --variant A,E --repeat 3`

Do not promote E unless it beats A on reference handling without inventing create ids, inflating Needs You, or dropping safe Creates.
