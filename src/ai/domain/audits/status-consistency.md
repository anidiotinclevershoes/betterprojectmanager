# Status consistency audit (Phase 1.5)

Do not migrate data automatically. Review before Phase 2.

## To Do
- Current: todo, doing, done, (blocked via blockedBy text only)
- Recommended: OPEN, IN_PROGRESS, BLOCKED, COMPLETED, ARCHIVED
- Notes: UI uses todo/doing/done. No first-class BLOCKED or ARCHIVED status field yet.

## Meeting
- Current: (implicit by date — past vs upcoming); phase upcoming|in_progress|completed
- Recommended: OPEN / UPCOMING, IN_PROGRESS, COMPLETED, ARCHIVED
- Notes: Meeting already has phase; map to canonical AI statuses in adapters.

## Risk
- Current: Open, Mitigating, Closed, recommendation status active|done|dismissed
- Recommended: OPEN, IN_PROGRESS, COMPLETED, ARCHIVED
- Notes: Align casing; map dismissed → ARCHIVED.

## Milestone
- Current: (date-driven; no status field)
- Recommended: OPEN, COMPLETED, ARCHIVED
- Notes: Consider explicit status for overdue / complete.

## Knowledge
- Current: (none — always current)
- Recommended: OPEN, ARCHIVED
- Notes: Archive superseded knowledge rather than deleting.

## Stakeholder
- Current: (none — always active)
- Recommended: OPEN, ARCHIVED
- Notes: Archive when no longer involved.

## Nudge
- Current: (active list only; dismissed removed)
- Recommended: OPEN, COMPLETED, ARCHIVED
- Notes: Dismiss ≈ COMPLETED or ARCHIVE depending on product choice.

## History
- Current: (immutable event — no status)
- Recommended: COMPLETED
- Notes: History rows are past events; status not applicable for mutation.

## Release
- Current: stage enum + stage-row status complete|current|upcoming|blocked|at_risk
- Recommended: stage statuses as documented in Project Domain
- Notes: Past release date ≈ COMPLETED train.

## Project
- Current: healthy | watch | at_risk
- Recommended: HEALTHY, WATCH, AT_RISK (+ optional ARCHIVED later)
- Notes: Already close to canonical; uppercase in AIRecord adapters.
