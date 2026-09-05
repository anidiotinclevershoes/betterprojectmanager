# Lume Experimental Programme — decision record

> **HISTORICAL — 25 August 2026. Not current engine or integration guidance.**  
> Capture V2 is the sole live Analyse → Review → Apply engine on `main`.  
> `cursor/capture-v2-desert-new-project-56c9` is an **obsolete** branch. Do not use it as a development base. Start at `docs/README.md`.

**Status:** HISTORICAL decision record (25 August 2026)  
**Branch (then):** `cursor/capture-v2-desert-new-project-56c9`

This file records the three independent workstreams from the Experimental Programme. Treat items marked **experimental** as flagged or newly added; do not describe them as the only production path until a workstream is **accepted**.

**V1 convergence binding (docs only, 26 Aug 2026):** Capture V2 is the target V1 Capture *understanding* engine; Phase 3B remains the mutation gate; delete the legacy OpenAI findings path after the required V2 gates (D-032). Do not merge this experimental PR (#66) from the architecture review.

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

## Verdicts (independent review + builder)

Independent review used a different model from the builder. First pass **BLOCK**ed Capture V2 (needs_you serialized as CREATE; observation `projectId` could retarget) and New Project V2 (stale categorisation approval). Those were fixed and re-reviewed.

| Workstream | Verdict | Notes |
| --- | --- | --- |
| Capture V2 | **Adopt behind `LUME_CAPTURE_V2`** | Gate A/C: PASS WITH LOW-RISK FOLLOW-UPS after fixes. Do not delete legacy in this PR (D-032). |
| New Project V2 | **Adopt behind `LUME_NEW_PROJECT_V2`** | Gate B: PASS WITH LOW-RISK FOLLOW-UPS after `createUnlocked` reset. |
| Desert | **Adopt** | Ocean remains; Desert is selectable in Account; preference persists. No component forks. |
