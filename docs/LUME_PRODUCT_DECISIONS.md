# Lume product decisions register

**Status:** Living register of semantics engineering must **not** invent  
**Date:** 21 September 2026 (CD-007 To Do assignees recorded)  
**Owned by:** Product Owner  
**Docs entry:** [`docs/README.md`](./README.md)

Engineering may record a gap here and keep current safe behaviour. Do not block unrelated trust fixes waiting on these.

---

## Open — need a Product Owner rule

| ID | Topic | Current safe behaviour | Do not invent | Why it is a product decision |
| --- | --- | --- | --- | --- |
| PD-001 | Milestone cancellation / removal | No legal Remove. Date stays. Empty Review or no-op is **not** good enough (Family B must surface unsupported). | A completed/cancelled milestone lifecycle, deleting the date, or routing cancel to a To Do | Canonical `milestones` have no cancelled/complete status (D-029) |
| PD-002 | General Knowledge supersede / retire | Schema can store supersede metadata; Capture has no settled retire write | Silently retiring or rewriting historical Knowledge because a later Capture contradicts it | D-030 presentation precedence is allowed; general supersede semantics are not |
| PD-003 | Cancellation represented as Knowledge | Narrative “cancelled Saturday” must not mutate the dated canonical entity | Treating a Knowledge sentence as a milestone delete | Same as PD-001 |
| PD-004 | Suggestions accept / dismiss lifecycle | D-003: memory-only; reload resurrects | Remounting deferred suggestion widgets or inventing persist semantics in passing | Persistence rule is undecided |
| PD-005 | Review re-include after exclude | C22: no re-include control; excluded candidate stays out | A second write path that resurrects excluded cards without a product rule | Review UX + Apply attestation |
| PD-006 | Project-code uniqueness (D-026) | Codes may collide; retry uses client UUID | Adding a unique index in an integrity slice | Product rule first |
| PD-007 | Archive / undo after project delete (D-027) | Confirmed delete is permanent | Soft-delete / recycle bin | Product rule first |

---

## Accepted V1 limitations (not defects)

| ID | Limitation | Notes |
| --- | --- | --- |
| AL-001 | Live extractor is imperfect | Deterministic layer must contain it. False Needs You is allowed when identity is genuinely unsafe. |
| AL-002 | Prompt A wording variation | Do not retune A against the 538-case corpus. |
| AL-003 | Coach unmounted | Not a V1 mode. Hidden `/api/coach` client-truth is D-033 remainder only. |

---

## Closed decisions (do not reopen)

| ID | Decision | Source |
| --- | --- | --- |
| CD-001 | Capture V2 + Prompt A is production | `LUME_CAPTURE_STATUS.md` |
| CD-002 | Prompt E is rejected | PR #168 observe-only |
| CD-003 | Name-only Person is complete | Constitution §7 |
| CD-004 | Responsibilities are optional; multiple supported | Constitution §7 |
| CD-005 | Tags are retrieval metadata only | Constitution §6 |
| CD-006 | Ready means the same production Apply path can execute; Apply still revalidates | Canonical contract |
| CD-007 | To Do **Assigned to** is a pre-V1 requirement (0 / 1 / many project People). It is not `waiting_on` and not Knowledge responsibility. Not implemented in v0.9. | This file § Required before V1; D-057 |

---

## Required before V1 (accepted, not implemented in v0.9)

These are Product Owner decisions. They are **not** current product behaviour. Do not treat Figma, Ocean Person bubbles, or this register as proof that the capability already exists.

### CD-007 — To Do assignees (0 / 1 / many project People)

**Must-do before V1.** Not a v0.9 implementation task. Current work remains v0.9 UI completion.

Before V1 is complete, a To Do must be assignable to:

- zero project People;
- one project Person; or
- multiple project People simultaneously.

Those People are existing canonical project **stakeholders**. This is not authenticated multi-user collaboration, workspace sharing, invitations, or teams.

Keep these three concepts separate. Do not conflate them in schema, Capture, UI, or copy:

| Concept | Meaning | Current v0.9 authority |
| --- | --- | --- |
| **Assigned to** | Who is responsible for *doing* the To Do | **None.** No assignee / owner model on To Dos. |
| **Waiting on** | Who/person/team the PM is waiting on or blocked by | `todos.waiting_on` — single nullable free text. Existing stored values must survive unchanged and must **not** be reinterpreted as assignment. |
| **Responsibility** | Durable project-scope ownership | Knowledge / `kind=responsibility` truth. Must **not** be reused as To Do assignment. |

**v0.9 boundary — do not:**

- add schema or migrations;
- change persistence, Capture Apply, or `waiting_on`;
- implement multi-assignee controls;
- add speculative local / client-only assignee logic.

Figma / Ocean may keep the established Person-bubble visual grammar. The actual multiple-assignee interaction is deferred until this pre-V1 capability is implemented.

**Intended pre-V1 architecture (directional, not a frozen schema):**

- Additive. Preserve existing canonical truth.
- Structured many-to-many: To Do ↔ canonical project People (for example a dedicated `todo_assignees` relation, or an equivalently explicit model).
- Durable Person IDs (`stakeholders.id`). Do not assign by free-text name as identity.
- No deterministic migration may turn `waiting_on` / block relationships into assignees.

**Pre-V1 completion must cover:** additive schema/domain support; durable Person IDs; load/persistence; Manual Add/Edit; display of one or several assigned People; Capture/Review when assignment is explicitly stated; deterministic tests; old-project compatibility; clear separation from `waiting_on` and Knowledge responsibility.

Living backlog entry: [`docs/LUME_V1_KNOWN_DISCOVERIES.md`](./LUME_V1_KNOWN_DISCOVERIES.md) **D-057**. V1 roadmap placement: [`docs/LUME_V09_TO_V1_HANDOFF.md`](./LUME_V09_TO_V1_HANDOFF.md) §8.
