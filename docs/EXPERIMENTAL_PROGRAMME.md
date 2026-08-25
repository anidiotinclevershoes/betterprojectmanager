# Lume Experimental Programme — decision record

**Status:** Experimental (25 August 2026)  
**Branch:** `cursor/capture-v2-desert-new-project-56c9`  
**Does not replace:** `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md` as the current-implementation map.

This file records the three independent workstreams from the Experimental Programme. Treat items marked **experimental** as flagged or newly added; do not describe them as the only production path until a workstream is **accepted**.

## Capture V2 — experimental

**Hypothesis:** the frontier model extracts atomic observations; Lume validates identities against supplied project state; Phase 3B `planCaptureApply` remains the only mutation safety gate.

| Item | Reality |
| --- | --- |
| Flag | `LUME_CAPTURE_V2=1` (unset/`0` = **current** legacy OpenAI findings path) |
| Library | `src/lib/capture-v2/` |
| Safety | Existing `src/lib/capture/apply` (Phase 3B). No new NLP / fuzzy / token-overlap engine |
| Local / no OpenAI | Legacy `localCaptureFallback` — V2 does **not** add regex extraction |
| Review | Existing Capture Review; compact observation account when `capturePipeline === "v2"` |
| Apply | Existing `applyOne` → `planCaptureApply` / `executeCaptureApply` |

**Not current production truth** unless the flag is on and OpenAI is configured.

## New Project V2 — experimental

**Hypothesis:** messy notes become a provisional categorised map; the user approves/corrects categories; then the existing setup review and `persistNewProject` create maintained truth.

| Item | Reality |
| --- | --- |
| Flag | `LUME_NEW_PROJECT_V2=1` (unset/`0` = **current** Talk assemble) |
| Library | `src/lib/new-project-v2/` |
| UI | `NewProjectCategorisation` then existing `ProjectSetupReview` |
| Persist | Unchanged `createProject` / `persistNewProject` |
| Approval | Categorisation approval cannot be skipped when the V2 pipeline ran |

Blank New Project is unchanged (minimal fields, no V2 map).

## Desert theme — accepted as a supported appearance in this change

Ocean is **not** deprecated. Desert is an additional token theme.

| Item | Reality |
| --- | --- |
| Ocean | `[data-theme="dark"]` (unchanged token family) |
| Desert | `[data-theme="desert"]` in `src/app/globals.css` |
| Switch | Account → Appearance (`LumeThemePicker`) |
| Persist | `localStorage` key `mc-appearance-v1` (`ocean` \| `desert`; legacy `dark` reads as Ocean) |
| Components | No Desert-specific screen forks |

## Verdicts (filled at programme close)

See the pull request body for the running checkpoint and the final three independent verdicts (Adopt / Reject / further iteration).
