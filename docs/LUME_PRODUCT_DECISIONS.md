# Lume product decisions register

**Status:** Living register of semantics engineering must **not** invent  
**Date:** 12 September 2026  
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
