# Lume Current-State Evidence Pack

> **HISTORICAL — not current product or architecture authority.**  
> This is an **11 August 2026** UI/application snapshot. It predates the current Supabase / Ocean implementation. It is retained as visual and development history. Do not use it as current product, architecture, or “what the app looks like now” authority. See `docs/README.md` and `docs/LUME_CURRENT_ARCHITECTURE_MEMORY_HANDOFF.md`.

Read-only audit artifacts. **No application code was changed** to produce this pack.

Full report: [LUME_CURRENT_STATE.md](./LUME_CURRENT_STATE.md)

## Screenshots

| File | Description |
|---|---|
| [01-main-project-workspace.png](./01-main-project-workspace.png) | Populated HORIZON project workspace at 1440×900 — sidebar, Capture, Coach entry, project title, To Do / Risks / Meeting Prep. |
| [02-capture-analysis.png](./02-capture-analysis.png) | Capture review after analysis (full-page). Taken from `/dev/review-preview` static fixture of the current review UI (no OpenAI key in audit env). |
| [02a-capture-analysis-top.png](./02a-capture-analysis-top.png) | Top of Capture review — transcript, What Lume Understood, Ready / Needs Review. |
| [02b-capture-analysis-bottom.png](./02b-capture-analysis-bottom.png) | Lower Capture review — Review Changes cards and Apply Ready. |
| [03-new-project-start.png](./03-new-project-start.png) | New Project first screen — Talk / Paste / Start Blank pathways. |
| [03a-new-project-talk.png](./03a-new-project-talk.png) | Talk It Through UI with guidance and Knowledge callout. |
| [03b-new-project-review.png](./03b-new-project-review.png) | Project Setup Review after Talk/local assemble. |
| [04-zero-project-first-run.png](./04-zero-project-first-run.png) | Zero-project first-run Project Intelligence (localStorage projects cleared in browser for this shot). |
| [05-overview.png](./05-overview.png) | Lume Overview with Capture and seeded workspace frames. |
| [06-sidebar-navigation.png](./06-sidebar-navigation.png) | Full current sidebar — projects, workspace links, developer tools, New Project. |
| [07-main-project-narrow.png](./07-main-project-narrow.png) | Main project workspace at 1280×720 for layout/responsive assessment. |

## How Capture analysis evidence was obtained

- Live OpenAI Analyse was **not** available in the audit environment (no `OPENAI_API_KEY`).
- Screenshot `02*` shows the **current Capture review UI** via the development review preview fixture.
- Automated Capture quality was still verified: `npm run verify:golden-test` passed Standard, Hard, and Mixed 3/3/3 on the local pipeline.
