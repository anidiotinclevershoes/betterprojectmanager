# Tell Me V1 + Knowledge Refinement — Completion Report

## Architecture

Tell Me is a **read-only** project-recall path, kept distinct from Capture (write/interpret) and Coach (advise).

```text
Capture → Lume learns (Knowledge) → Tell Me → (optional) Coach
```

Implementation reuses existing Capture context selection (`buildCaptureContext`, project mention detection) rather than a new agent platform or vector DB.

| Layer | Location |
|---|---|
| Suggestions (deterministic) | `src/lib/tell-me/suggestions.ts` |
| Scope (selected / explicit / cross-project) | `src/lib/tell-me/scope.ts` |
| Context assembly | `src/lib/tell-me/context.ts` |
| Answer engine | `src/lib/tell-me/answer.ts` |
| Snapshot (deterministic + explicit AI refresh) | `src/lib/tell-me/snapshot-deterministic.ts`, `snapshot.ts` |
| Freshness / revision | `src/lib/tell-me/revision.ts`, `freshness.ts` |
| Knowledge search (non-AI) | `src/lib/tell-me/knowledge-search.ts` |
| APIs | `POST /api/tell-me`, `POST /api/tell-me/refresh` |
| UI | Intelligence strip, Tell Me panel, Knowledge frames |
| Persistence | `supabase/migrations/20260815160000_project_intelligence_snapshots.sql` + localStorage fallback |

## AI calls

AI runs **only** when:

1. The user explicitly asks a Tell Me question (`POST /api/tell-me`)
2. The user explicitly clicks **Refresh Lume** (`POST /api/tell-me/refresh`)

Opening Tell Me, browsing suggestions, Knowledge search, and page loads do **not** call the model.

## Snapshot

Implemented as a lightweight **Project Intelligence Snapshot**:

- Default build is **deterministic** from live structured state (no AI)
- Optional **AI refresh** compresses narrative fields when the user requests it
- Stored server-side in `project_intelligence_snapshots` (RLS by workspace membership)
- Also cached in browser `localStorage` for demo/local continuity

Snapshot does **not** mutate project records.

## Freshness

- `source_revision` = hash of meaningful project intelligence (knowledge, todos, timeline, risks, history, meetings, releases)
- Compared to live `computeProjectRevision`
- `latest` / `current` / `now` / `still` style questions can surface a stale warning + **Refresh Lume** when the snapshot lags live changes
- Live structured queries (e.g. open risks / waiting items) still answer from current DB/state without forcing refresh

## Suggested Questions

Generated deterministically from project signals:

- Waiting / chase todos
- CAB / release / meeting proximity
- Open risks
- Named stakeholders
- Governance / open loops
- Cross-project waiting / CAB when no project selected

No AI call on panel open. User name used sparingly in hints/suggestions.

## Knowledge

- Existing section taxonomy preserved (`now`, `decisions`, `risks`, `people`, `openLoops`) with clearer labels
- Each section rendered as its **own frame** with counts
- Non-AI search with subtle highlight
- Empty / poor search offers **Ask Tell Me** (prefills question; does not auto-run AI)
- Per-item **Ask Tell Me** affordance

## Security

- `requireAiCaller("tell-me")` on both routes (auth + rate limit)
- Configurable `LUME_RATE_LIMIT_TELL_ME_PER_HOUR` (default 60)
- Production requires OpenAI configuration (same contract as Capture/Coach)
- Snapshot table FORCE RLS via `is_workspace_member`
- Cross-project answers only consider projects present in the caller’s MissionState (already RLS-scoped when loaded from Supabase)

## Costs / Cockpit

Development AI Cockpit records Tell Me asks/refreshes via `recordTellMeMetricsSafe`:

- provider tokens when available
- approx chars / structured vs knowledge contribution
- projects considered / records selected
- latency

No always-on background analysis.

## Testing

```bash
npm run verify:tell-me
npm run verify:production-config
npm run verify:capture-context
npm run verify:phase2-auth
npm run verify:findings
npm run verify:new-project
npm run build
```

`verify-tell-me` covers suggestions, knowledge search highlight, scope, freshness, grounded local answers (Nina ownership, Finance not found / outstanding, empty project).

## Manual ops note

Run the new migration in Supabase SQL Editor when deploying this branch:

`supabase/migrations/20260815160000_project_intelligence_snapshots.sql`

Local/demo still works with deterministic snapshots in localStorage if the table is not applied yet.

## Known limitations

- Without OpenAI, answers use a constrained local grounded path (good for risks/waiting/finance patterns; weaker for free-form synthesis)
- Follow-up reference resolution relies on short in-panel conversation + model (when configured), not a permanent chat store
- Source click-through to highlight specific Knowledge rows is soft (sources listed; deep-link highlight can be improved later)
- Cross-project depth is capped (context selection limits) — very large portfolios may need stronger ranking later
- No embeddings / pgvector in V1 by design

## Product outcome

Users can see **Capture → Lume learns → Tell Me**, ask grounded questions, get evidence cues, and keep Knowledge scannable — without continuous AI spend.

## Screenshots

See `docs/tell-me-v1/`:

1. `01-capture-learn-tell-me-strip.png`
2. `02-tell-me-default.png`
3. `03-tell-me-suggestions.png`
4. `04-direct-answer-with-sources.png`
5. `05-cannot-find-answer.png`
6. `06-freshness-refresh.png`
7. `07-knowledge-section-frames.png`
8. `08-knowledge-search-highlight.png`
9. `09-narrow-laptop.png`
