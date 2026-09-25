# Lume product decisions register

**Status:** Living register of semantics engineering must **not** invent  
**Date:** 25 September 2026 (CD-008–CD-011). Earlier rows remain 12 September 2026.  
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
| CD-008 | No user-facing To Do Type taxonomy. `todos.kind` stays an internal routing value | This register; Page 09 working mocks |
| CD-009 | Waiting on is zero or more relationships to existing People. `todos.waiting_on` is not that model | This register; D-058 |
| CD-010 | Notes stay supplementary and must not replace structured project truth | This register |
| CD-011 | Page 09 To Do, Issue and Person screens are approved working mocks. They cannot override canonical product or domain contracts. They can override current UI presentation | Figma `Lume-V1-UX` page `09` section M |

---

## UI convergence semantics (25 September 2026)

These decisions govern the current UI work. Current `main` is authoritative for the implementation and domain architecture that exists today: schema, persistence, write paths, established contracts, and other implementation constraints. It is not automatically the visual or UI authority.

CD-007 is unused here so it can stay with the open pre-V1 assignee note (PR #187). This lock does not decide assignment.

### CD-008 — No user-facing To Do Type

Do not introduce or preserve a user-facing To Do “Type” taxonomy unless a later canonical product decision requires one. None does today.

`todos.kind` (`ACTION | WAITING | CHASE | REMINDER`) remains an internal routing value. It is not a Type control. The approved Page 09 To Do detail and edit mocks hide that field. Do not invent a new structured type to put back in its place.

### CD-009 — Waiting on is many existing People

Waiting on is a relationship from a To Do to zero or more existing project People. It is not one free-text person or string. It is not assignment, and it is not responsibility.

The current domain does not implement this. `todos.waiting_on` is one nullable string. That gap is D-058. Do not fake the relationship by joining names into `waiting_on`, and do not narrow the product rule to match the string.

### CD-010 — Notes stay supplementary

Notes are supplementary text only. They must never silently create, overwrite, infer, or replace structured project truth (status, dates, people, responsibilities, waiting relationships, owners, or other canonical fields).

| Surface | Notes field |
| --- | --- |
| To Do | Existing `todos.detail` |
| Knowledge | Existing `knowledge_items.body` |
| Date / Milestone | Existing `milestones.notes` |
| Issue | No notes field on the approved Page 09 Issue detail/edit screens. An optional nullable notes column may be added only if a later approved UI requires it |
| Person | No notes field on the approved Page 09 Person detail/edit screens. An optional nullable notes column may be added only if a later approved UI requires it |

### CD-011 — Page 09 mock authority

Figma file `Lume-V1-UX` (`TPzPxiSMFgPQBZPDNzQ6LL`), page `09 — REVIEW · MAGIC PATTERNS CONVERGENCE — NON-AUTHORITY`, section M To Do, Issue and Person detail/edit screens are approved working mocks for UI convergence. The rest of page 09 is unchanged and is not promoted by this decision.

Standing precedence:

1. Canonical product/truth and behavioural/specialist contracts
2. Design Authority Register
3. Signed/approved UI authority, components, and patterns
4. Approved screen compositions and working mocks
5. Current UI implementation

These screens cannot override canonical product or domain contracts. They can override an older or current UI presentation where that is the explicit purpose of the convergence work. An implementation constraint is surfaced as a gap. The approved design is not silently changed to match the old UI. D-058 is the example: Waiting on stays a relationship to multiple existing People, the single `todos.waiting_on` string does not implement it, and that support is not faked.
