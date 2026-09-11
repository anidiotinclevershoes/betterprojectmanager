# Hosted holdout precommitment record

This file exists to prove the holdout was frozen **before** the first hosted execution.

| Field | Value |
| --- | --- |
| Suite id | `hosted-holdout-v1` |
| Frozen at (UTC) | `2026-09-11T23:20:00Z` |
| Integration baseline | `90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b` (`origin/main`) |
| Specification | `e2e-hosted-holdout/SPEC.md` |
| Machine spec | `e2e-hosted-holdout/frozen-spec.ts` |
| First hosted execution completed? | **NO** |
| First-run baseline | not written yet — will be `baselines/first-run-untouched.md` |

The first-run file must be added in a later commit. Do not edit `SPEC.md` or `frozen-spec.ts` after that commit except via an explicit, documented product-semantics exception.
