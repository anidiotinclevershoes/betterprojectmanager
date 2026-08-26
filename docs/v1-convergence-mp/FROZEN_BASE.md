# Frozen V2 programme base

**Workstream:** C — Magic Patterns / V1 UX convergence  
**Isolated branch:** `cursor/v1-convergence-mp-08a0`  
**Suggested name (from brief):** `cursor/v1-convergence-mp`  
**This branch was created from the exact SHA below. It does not merge `#64`, `#66`, or sibling work.**

## HEAD recorded

| Field | Value |
| --- | --- |
| Frozen programme branch | `cursor/capture-v2-desert-new-project-56c9` |
| Exact HEAD SHA | `3926b649e267e7fd5cc4aa09d18d4a0a4f3d9ef4` |
| HEAD subject | `fix: keep OpenAI extract off the client barrels` |
| Remote match | `origin/cursor/capture-v2-desert-new-project-56c9` at the same SHA after `git fetch` |
| Date of HEAD | 25 August 2026 |

## Phase 3B / PR #64 ancestry

PR **#64** (`cursor/phase-3b-capture-boundary-bfd3`, “Phase 3B: Conservative Capture mutation boundary”) is **open and not merged to `main`**.

It **is** in the ancestry of the frozen HEAD:

- `git merge-base --is-ancestor origin/cursor/phase-3b-capture-boundary-bfd3 HEAD` → yes
- First 3B commit on this line: `1c85182d09fc9efad1b918d48b8495165be66b34` (`feat(capture): add conservative typed apply mutation boundary`)
- Last 3B commit on this line: `b52995c3b7eb80971d052e875c1d372ebb424ebe` (`fix(capture): stop sticker refinements from reopening unsupported writes`)

`main` HEAD at inspection: `f5e3683` (Phase 3A.1 project deletion, PR #63). The frozen branch is **ahead of `main`** by 3B + Experimental Programme.

This workstream did **not** merge #64 or #66.

## V2 completion-report match

The frozen HEAD broadly matches the Experimental Programme / PR #66 completion record:

| Programme claim | Present on frozen HEAD? |
| --- | --- |
| Capture V2 behind `LUME_CAPTURE_V2` | Yes — `src/lib/capture-v2/`, compact observation account when `capturePipeline === "v2"` |
| Phase 3B `planCaptureApply` remains the mutation gate | Yes — V2 resolve → existing apply |
| New Project V2 behind `LUME_NEW_PROJECT_V2` | Yes — `src/lib/new-project-v2/` + `NewProjectCategorisation` then `ProjectSetupReview` |
| Desert additive; Ocean remains | Yes — `[data-theme="desert"]` + Account `LumeThemePicker`; no Desert screen forks |
| Dual engines until D-032 | Yes — flags default off; legacy OpenAI/local paths remain |
| Client barrels must not import OpenAI extract | Yes — HEAD commit `3926b64` |

Record: `docs/EXPERIMENTAL_PROGRAMME.md`, PR #66 body.

**Stop condition:** the frozen branch does **not** differ materially from the stated V2 programme. Work proceeded.

## What this workstream did not do

- Did not merge sibling PRs.
- Did not rebase onto Architecture or Test workstreams.
- Did not implement the Magic Patterns overhaul.
- Did not change production React screens, API routes, Capture engine, resolver, schema, or the mutation boundary.
