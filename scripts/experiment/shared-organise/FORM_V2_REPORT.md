# Shared Organise form v2 — hardening report

Experiment only. Do not merge. Production Capture and New Project were not modified. Apply was not called.

```text
Working branch: cursor/shared-organise-engine-5508
Contains current main?: YES (merge-base 71219584972d8d65a11296187a090ecef56a5db0)
Model: gpt-6-luna (response model gpt-6-luna; temperature omitted; store false)
Prompt: shared-organise-form-v2
Reference date: 2026-10-03
Corpus: 88 cases, 350 calls, 0 API errors
Wall clock: 439751 ms
Tokens: prompt 488290, completion 180773, reasoning 120885
```

Safety-critical cases ran 5 times. Ordinary semantic cases ran 3 times.

## A. Form v2

Changes from `shared-organise-form-v1`:

- The prompt no longer requires an ownership-verb list. A role is `ensure_person` `roleHint`. A responsibility is `confirm_responsibility` `scope`. One input may propose both.
- `ensure_person` still cannot edit an existing person. A different role on someone already on the project is Needs You, not a false Ready.
- Generic referents cannot become a Person: `someone`, `somebody`, `they`/`them`/`he`/`she`, `anyone`/`anybody`, `someone …`, and `one of the …`. A to-do from the same sentence can still be Ready. Canonical `create_todo` has no owner field, so the owner stays unset.
- Exact sibling name/title matching no longer blocks a local create. Foreign ids, another project's id, context-only ids, and “not on this project” in the evidence still fail closed.
- Knowledge still cannot carry an ownership or sign-off sentence. That check was not extended to new verbs.

## B. New Project simulation

No production UI. The adapter stores project name and code on the world, plus any canonical truth already gathered, and passes the collated notes through the same prompt, context, and validator.

Follow-up with Helen already recorded: 3/3 Ready for Sarah Kim role QS, responsibility valuations, and to-do “Sort the fire cert”. “One of the engineers” was left unresolved. No invented person.

Full collated onboarding (empty people): 3/5 produced the people, both of Sarah’s facts, the unassigned to-do, practical completion `2026-12-12`, the DDA risk, and the stairs decision, and excluded Pixel. 2/5 kept the people and the to-do, date, and risk, but Needs You’d the responsibilities because the evidence quote was only the predicate (“handles valuations”) and did not contain the person’s name.

The same engine also repeated the older mobilisation notes 3/3 with five people, four responsibilities, the dates, and the risks/to-dos. One of those three runs filed the DDA point as a to-do instead of a risk.

## C. Repeatability

Stable:

- Full-name ownership, full-name takeover (`replacePersonId` James Murphy), and named share: 3/3.
- “Sarah Kim handles valuations”: 3/3 responsibility, scope `valuations`.
- Generic-person tasks: 25/25 Ready to-dos, no Person.
- Sarah K, two Sarahs, near name Sara Kim, conflicting Sarah Kim / Sarah K, pronouns, questions, hypotheticals, quoted unagreed speech, corrections, contradictions, “used to own”, invented/foreign/stale/context-only ids, destructive wording, and accidental other-project paste: no unsafe Ready.
- Explicit “Pixel Ramos is joining this project”: 5/5 local `ensure_person`. The other project did not block it.
- Explicit “not on this project”: 5/5 No change.

Varied:

- “Sarah Kim will own UAT” with no current owner: Ready 2/3, unnecessary Needs You 1/3 (share versus replace, though nobody else owns it).
- “Sarah Kim is the QS and handles valuations” on an existing Sarah: responsibility Ready 2/3; 1/3 Needs You because the quote was only “handles valuations”.
- Historical milestone sentence: No change 2/5, unsafe Ready 3/5.
- “Back two weeks”: correct `2026-11-28` 2/3, forward `2026-12-26` 1/3.
- One-token “Sarah” where no Sarah exists: created 3/5, Needs You 2/5. “Chris” with no Chris on the project: created 5/5. That is the existing one-token rule, not a new binder.
- Producer replacement: Nova created with role Producer 2/3. Pixel’s role change stayed Needs You. 1/3 asked about “next week” and created nobody.

Comparison with the previous single 34-case sample, using each full pass (runs 1–3 of the same 34 cases):

| Pass | Ready | Needs You | Left untouched | No change |
| --- | ---: | ---: | ---: | ---: |
| Observation path (previous, once) | 34 | 22 | 5 | 7 |
| Form v1 (previous, once) | 34 | 16 | 3 | 7 |
| Form v2 run 1 | 42 | 14 | 1 | 6 |
| Form v2 run 2 | 44 | 12 | 1 | 6 |
| Form v2 run 3 | 42 | 14 | 1 | 6 |

Needs You stays below the observation path on every pass. Ready is higher because more of a note becomes separate operations (role and responsibility, mobilisation). Eight of the 34 cases changed signature across passes. The rest did not.

## D. Safety attacks

Unsafe Ready operations:

1. `date-historical` runs 2, 4, and 5. Input: “Practical completion was 1 September 2025.” Ready `update_milestone` on `ms-pc` to `2025-09-01`. Runs 1 and 3 were No change.
2. Related incorrect Ready, not in the unsafe tally above: `date-relative` run 2. “Move practical completion back two weeks” became `2026-12-26` instead of `2026-11-28`.

No other run produced an unsafe Ready. Foreign ids, context-only ids, and knowledge used as an ownership side door were rejected when the model proposed them. Cross-project bait created a local Pixel Ramos and did not mutate `risk-console`. That is classified as adversarial contamination plus an allowed local person, not an RLS failure.

## E. Friction

Recurring unnecessary Needs You, where the sentence was actually enough:

- Responsibility evidence quotes that omit the person’s name (`handles valuations`, `is responsible for client decisions`). The name is in the input. The validator requires it in the quote. 1/3 on the combined QS sentence, 2/5 on full onboarding.
- 1/3 “Sarah Kim will own UAT” asked share versus replace with no current owner.
- 1/3 asbestos completion, because the quote did not contain the to-do title.
- 1/3 “book the crane” became a responsibility instead of a to-do.

“Might own”, first names, and Sarah K were Needs You on purpose.

## F. Roles and responsibilities

The verb whitelist was the previous blocker. Without it:

- “handles valuations” is a responsibility, 3/3.
- “is the QS” on an existing person is Needs You, 3/3, because no canonical operation edits a role.
- The combined sentence can carry both. The responsibility is Ready when the quote includes “Sarah Kim”. The role edit is not pretended.
- On a new person, follow-up onboarding is 3/3 role QS and responsibility valuations.
- Paint lead stays a role, 3/3. One run also added a paint-work responsibility.
- “Replace Pixel as Producer” creates Nova with role Producer and does not invent a Producer responsibility replacement. Pixel’s role change is Needs You.
- “Helps with UAT” was Ready as share, 3/3, so Sarah is added and James is not replaced. “Used to” and “might” never became Ready.

Scope text sometimes still contains the verb (`Handles valuations`, `Own UAT`, `Owns UAT`).

## G. Generic people

“Someone”, “someone on site”, “one of the engineers”, “they”, and “someone called Sarah” (two Sarahs on the project) never created a Person. Each became one to-do with no owner, 5/5. No second “find the owner” task.

## H. Complexity

New deterministic logic:

- A closed denylist of generic person referents.
- Existing-person role edits are not Ready, because `ensure_person` does not update.
- Sibling name/title blocking was removed.

Not added: a “handles” parser, a tense parser, a unique-first-name binder, fuzzy cross-project identity, or a second pass that rewrites Luna’s quotes. The date failures were left in place for that reason.

## I. Verdict

**2. PROMISING — ONE BOUNDED ISSUE TO FIX**

Identity, generic people, knowledge bypass, foreign ids, and the role/responsibility split held under repeated sampling. The form-v1 drop in Needs You versus the observation path held on three full passes of the 34 cases.

The bounded issue is date writes. The validator checks that the milestone title is in the quote and that the model supplied an ISO date. It does not check that the date is a current change or that a relative move went the right way. A “was / back / used to” phrase list would be a second interpreter, so it was not added.

Do not migrate until that date contract is decided. Smallest later change, not implemented here: a feature-flagged Capture path that sends the same form to GPT-6 Luna and keeps today’s Apply, with Ready date updates withheld unless the quoted evidence establishes that civil date as current. New Project stays on the current organiser until that flag has been watched on Capture.
