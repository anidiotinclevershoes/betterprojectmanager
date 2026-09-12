# Long-run freeze precommitment

Recorded before first production execution.

- Suite: `hosted-longrun-v1`
- Seed: `lume-longrun-v1-20260912-a3db`
- Integration baseline: `origin/main` `9f24a65c7ea38d1dabb2d513a87503fb9e7a4cd6`
- Working branch at freeze: `cursor/e2e-longrun-dogfood-a3db`
- Contains current main?: YES
- First-run rule: do not edit `frozen-manifest.ts` / `new-project.ts` / `SPEC.md` to match Lume after execution

Machine check: `npm run verify:hosted-longrun-precommit`
