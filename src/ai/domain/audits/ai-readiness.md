# AI readiness audit (Phase 1.5)

Legend: ✓ ok · ~ partial · ✗ missing

| Entity | title | summary | status | owner | updatedAt | adapter | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Project | ✓ | ~ | ✓ | ✗ | ✗ | ✓ | No project owner/updatedAt on Project type |
| To Do | ✓ | ~ | ✓ | ✓ | ~ | ✓ | updatedAt uses createdAt; summary from detail |
| Meeting | ✓ | ✓ | ✓ | ~ | ✗ | ✓ | owner = first attendee; no updatedAt |
| Risk | ✓ | ✓ | ✓ | ✗ | ~ | ✓ | No dedicated owner; updatedAt when available |
| Milestone | ✓ | ~ | ~ | ✗ | ✗ | ✓ | No owner/updatedAt; status = timeline type |
| Knowledge | ✓ | ✓ | ~ | ✗ | ✓ | ✓ | No owner; status always OPEN |
| Stakeholder | ✓ | ~ | ~ | ✗ | ✗ | ✓ | No updatedAt; status OPEN |
| Nudge | ✓ | ✓ | ~ | ✓ | ✗ | ✓ | status always OPEN while listed |
| History | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | No owner |
| Release | ✓ | ~ | ✓ | ✗ | ✗ | ✓ | No owner/updatedAt |

Adapters exist for every current entity via `src/ai/domain/adapters`.
Incomplete fields do not fail the build — they guide Phase 2 data-model work.
