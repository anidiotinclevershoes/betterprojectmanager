# Magic Patterns retrieval log

**Date:** 26 August 2026 (updated when the product owner supplied the editor URL)  
**Rule followed:** do not fabricate live MP state; do not silently alter the live design during retrieval. No `send_prompt` / `write_artifact_files`.

## Result

**Latest live Magic Patterns V1 work was retrieved.**

| Field | Value |
| --- | --- |
| Editor URL | https://www.magicpatterns.com/c/gekwmrddrt3hkx7f1c9gm8/screens |
| Editor ID | `gekwmrddrt3hkx7f1c9gm8` |
| Active artifact | `30fc8231-32b7-475b-bf5f-d8f6d44c8841` |
| Version treated as latest | **v8 — Knowledge Centre Frame Reordering Cleanup** |
| Generating at retrieval | false |
| In-git dump | `docs/v1-convergence-mp/mp-source/` (unaltered artifact files + `PROVENANCE.md`) |

Playwright could **not** screenshot the hosted Screens page (Magic Patterns login / empty chrome). The versioned source + canvas manifest are the reviewable artefacts. Do not invent screenshots.

## Version history (do not treat earlier versions as approved)

Retrieved via `list_version_history`. Newest last.

| Version | Artifact | Title | How this pack treats it |
| --- | --- | --- | --- |
| v1 | `6c43faa9-…` | Ocean Knowledge Centre baseline | Faithful recreation of current Ocean KC. Historical. |
| v2 | `0a2fbd26-…` | Evolve Ocean's Knowledge Centre Interface | **Rejected as architecture change** (briefing/prose). Not the parent. |
| v3 | `eb5611b7-…` | Ocean Knowledge Centre with Contextual Inspector | Revert to Ocean; inspector is the new thing. |
| v4 | `20007459-…` | Canvas Setup with Complete Screens | First canvas screens. |
| v5 | `7693233d-…` | Duplicate Screen Designs Detected | Screens-looked-the-same fix. |
| v6 | `94d595d9-…` | Compact Object Inspector for Knowledge Centre | **Governing prompt:** Ocean locked; inspector overlay ~26rem; compact default. |
| v7 | `d610b939-…` | Auto-layout Knowledge Centre Screen | Layout plumbing. |
| **v8** | `30fc8231-…` | **Knowledge Centre Frame Reordering Cleanup** | **Current active.** User surgical pass: To Do + Risks top row; Current Position below; full-width mode bar; directional relationship language; SOURCE hidden on ordinary Known. |

## What this MP file covers

**Knowledge Centre + compact object inspector only.** Nine canvas screens, one route `/`:

| # | Screen | Canvas state |
| --- | --- | --- |
| 1 | Resting Knowledge Centre | `trail: []` |
| 2 | Risk inspector (compact) | `trail: ["r-build"]` |
| 3 | Risk · More details | `trail: ["r-build"]`, `expanded: true` |
| 4 | Person · Elena Rostova | `trail: ["r-build", "p-elena"]` |
| 5 | Connected · Payments pipeline | `…`, `"a-payments"` |
| 6 | Connected · Decision | `…`, `"dec-gates"` |
| 7 | To Do inspector | `trail: ["t-cabpack"]` |
| 8 | Milestone · CAB approval | `trail: ["d-cab"]` |
| 9 | Needs you · Marcus Webb | `trail: ["p-marcus"]` |

Demo project in the prototype: **Atlas Platform Modernisation** (Release 9 CAB). Not a licence to seed production with Elena / Marcus / Priya / Sarah.

## What this MP file does **not** cover

Do not invent MP screens for these. Product + constitution still govern:

- Capture compose / Review / observation accounting / Apply Ready / save-error
- New Project Talk / categorisation / setup review / Blank
- Desert (this file is Ocean-only)
- Account / Appearance
- Advise (Coming soon in the mode bar only)
- First-run onboarding as a separate product

## Earlier retrieval (superseded)

The first pass of this pack could not list designs (no list-designs API; no editor URL in git). That limitation is **closed** by the URL above. In-repo 19 Aug Ocean PNG remains the **visual constitution parent**; v8 is the **live KC + inspector iteration** on top of that Ocean.

## Tooling that worked

| Attempt | Outcome |
| --- | --- |
| `get_editor_id_from_url` on the supplied `/c/gekwmrddrt3hkx7f1c9gm8/screens` | Editor ID resolved |
| `get_design_status` | Active artifact `30fc8231-…`, not generating |
| `list_version_history` | v1–v8 as above |
| `get_artifact` + `read_artifact_files` | 21 files exported unaltered |
| `read_recent_message_history` | v6 governing prompt + v8 surgical cleanup confirmed as user instructions |
| Playwright → hosted screens | Login / empty chrome — **no screenshots committed** |

## Do not treat as latest MP

- v2 evolve/briefing redesign
- Training-data memory of older Lume mockups
- `docs/current-state/` Overview / pre-Ocean Capture
- Any invented Capture / New Project / Desert canvas
