# Person + responsibility canonical-contract finding

Inspected before any Gate 2.5 behaviour change.

## Question

When the user explicitly introduces a new Person and explicitly states
their responsibility in the same Capture, is the intended canonical write:

- A. one atomic Person+responsibility operation, or
- B. two independent legal operations?

## Answer: A

Existing production write contract:

1. `planPerson` refuses `create` when a responsibility scope or ownership
   semantics is present — “This looks like an ownership change, not a new
   person.”
2. New named person + explicit ownership is planned as
   `confirm_responsibility` (`scripts/verify-responsibility-canonical-path.ts`:
   “new named Person + explicit ownership uses confirm_responsibility”).
3. `confirmResponsibilityOwner` calls `ensurePersonOnProject` inside the
   same write. Apply ensures the person; there is no required sibling
   `ensure_person`.
4. Capture V2 resolve rematerialises a Person observation that states
   explicit ownership onto the responsibility domain for that same
   `confirm_responsibility` path.

So the AI-first contract should emit **one** `create` on `responsibility`
with `personName` + `scope`. A duplicate sibling `create person` is not
required by the write model.

## Gate 2.5 action

Contract sentence only. Schema unchanged. **No sibling-dedupe heuristic.**
If Astra still emits both (Gate 2 Kwame residual), that remains a model
failure, not a post-processor target.
