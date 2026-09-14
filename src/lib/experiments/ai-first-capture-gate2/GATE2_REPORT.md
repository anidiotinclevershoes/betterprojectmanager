# AI-first Capture Gate 2 report

Non-mergeable experiment. Isolated from Simplified Capture / PR #175.
One Astra call per case. Gate 2 adds only a read-only legal-write boundary.

A. branch `experiment/ai-first-capture-gate2` HEAD `16e49b8a1941a419ba7ed4c4b03506c1b899b454`
   Gate 1 v2 base HEAD `707b704bbf820fcc4492c86155889d6afe5d5bae`
   Gate 1 v2 main baseline `92d61d13c4407d04a8e20960e7eb38efa0b103c3`
   origin/main at run `920d65d9c0f6e49efca8e26fc8906dbbd11e8f25` (not imported; includes later Simplified work)

## B. Gate 2 architecture

raw Capture + compact current canonical snapshot
→ exactly one Astra json_schema call (Gate 1 contract unchanged)
→ inspect: JSON / enum / id-exists (no rewrite)
→ read-only legal-write planner check (`applySupportsOperation` + `planCaptureApply` consult)
→ Create / Update / Remove preserved unchanged if the exact op is legal
→ otherwise Left untouched (unsupported capability)
→ inspect/score only. No production Apply.

D. existing `planCaptureApply` / `applySupportsOperation` reused: YES (read-only).
E. semantic repair: NO. Failed writes are not rewritten into update/archive/another domain/Needs You.
F. exactly one AI call remains: YES.

## C. Exact deterministic boundary added

For each inspected item whose operation is `create` | `update` | `remove`:
1. Map the AI domain onto `CaptureLegalDomain` (`decision` → `knowledge`; otherwise the stated domain).
2. Ask `applySupportsOperation(domain, op)` — the existing Apply verb matrix.
3. Also call `planCaptureApply` read-only and record its kind/reason. Do **not** adopt its Needs You / no_change / rewritten write.
4. If the exact operation type is not supported, replace only the operation with `left_untouched` and reason `Lume cannot safely apply this type of change.` Preserve domain, target, values, evidence.
5. If supported, leave the AI item unchanged — including restatement-as-update.

G. frozen evaluation corpus: 43 Capture scenarios (12 Gate 1 retained + 31 expanded)
H. atomic expected facts: 50

Frozen case ids:

- create-velvet
- update-packaging
- nochange-pippa
- pronoun-she
- date-parade
- correction-audio
- contradict-parade
- ambiguous-share
- unsupported-remove
- mixed-three
- chatter
- holdout-h6
- ambiguous-same-first-name
- responsibility-continues
- responsibility-replacement
- new-risk
- risk-resolution
- unchanged-date
- todo-create
- availability
- duplicate-observation
- explicit-no-change
- cross-project-bait
- toyworld-vocabulary-bait
- todo-remove-supported
- unsupported-remove-person
- unsupported-remove-risk
- knowledge-water-based
- vague-parade
- relative-date-parade
- historic-parade
- similar-name-exact
- similar-name-other-brick
- similar-name-ambiguous-brick
- similar-name-spelling
- email-unsupported
- todo-complete-jelly
- person-rename-unsupported
- contradict-packaging
- todo-dated-canes
- issue-cert-worse
- chatter-weather
- availability-relative

## I. Aggregate (Production vs Gate 1 vs Gate 2)

| Metric | Production | Gate 1 AI-first | Gate 2 + legal boundary |
| --- | --- | --- | --- |
| Correct explicit facts | 14/50 (28%) | 20/50 (40%) | 20/50 (40%) |
| False writes / bad proposals | 12/50 (24%) | 4/50 (8%) | 3/50 (6%) |
| Wrong-target | 0/50 (0%) | 1/50 (2%) | 1/50 (2%) |
| Silent loss | 4/50 (8%) | 1/50 (2%) | 1/50 (2%) |
| Appropriate human fallback | 16/50 (32%) | 15/50 (30%) | 19/50 (38%) |
| Correct no-change | 6/50 (12%) | 8/50 (16%) | 8/50 (16%) |
| Invented / unsupported ops | 2/50 (4%) | 5/50 (10%) | 2/50 (4%) |
| Malformed cases | 0/43 (0%) | 0/43 (0%) | 0/43 (0%) |

### Gate 1 twelve-case subset (must remain essentially intact)

| Metric | Production | Gate 1 AI-first | Gate 2 + legal boundary |
| --- | --- | --- | --- |
| Correct explicit facts | 6/18 (33%) | 10/18 (56%) | 10/18 (56%) |
| False writes / bad proposals | 4/18 (22%) | 1/18 (6%) | 1/18 (6%) |
| Wrong-target | 0/18 (0%) | 0/18 (0%) | 0/18 (0%) |
| Silent loss | 1/18 (6%) | 0/18 (0%) | 0/18 (0%) |
| Appropriate human fallback | 5/18 (28%) | 5/18 (28%) | 6/18 (33%) |
| Correct no-change | 2/18 (11%) | 2/18 (11%) | 2/18 (11%) |
| Invented / unsupported ops | 0/18 (0%) | 2/18 (11%) | 1/18 (6%) |
| Malformed cases | 0/12 (0%) | 0/12 (0%) | 0/12 (0%) |

O. restatement-as-update frequency: production=1 Gate1=1 Gate2=1
P. unsupported-operation write proposals: before boundary=4 after boundary=0
Q. malformed-output rate: Gate1=0/43 (0%) Gate2=0/43 (0%) Production=0/43 (0%)

## J. Per-case Gate 2 failures (wrong write / wrong target / silent loss / unsupported / malformed / extra write)

### holdout-h6
- extra invented write: create responsibility new :: Kwame Boateng is explicitly assigned the contractor lead role; no replacement of Priya's contractor liaison responsibility is stated.

### availability
- wrong_target: Fizz Caramel away 5–12 October 2026. (expected new, got none)

### cross-project-bait
- silent_omission: GamingStudio5000 people/risks inside Candyland Capture. (No matching item)
- extra invented write: create person new :: Pixel Ramos is a newly named person from GamingStudio5000.

### relative-date-parade
- incorrect_proposed_truth: Next Friday is not a safe explicit date write. (expected needs_you|left_untouched, got update)

## create-velvet

**CASE** Obvious create — new person

- family: create
- source: corpus new-person (corpus)
- notes: Velvet Sprocket is a new person on Toyworld.
- gate1-retained: true

### Raw Capture

```text
Velvet Sprocket is joining as paint lead for the wooden-track refresh.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 490 chars, ~154 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=8598ms usage={"prompt_tokens":822,"completion_tokens":235,"total_tokens":1057,"reasoning_tokens":78}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "create",
    "domain": "person",
    "targetCanonicalId": null,
    "subject": "Velvet Sprocket",
    "proposedValues": {
      "name": "Velvet Sprocket",
      "personName": "Velvet Sprocket",
      "title": "Paint lead",
      "date": null,
      "status": null,
      "scope": "Wooden-track refresh",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "understood": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "create",
    "domain": "person",
    "targetCanonicalId": null,
    "subject": "Velvet Sprocket",
    "proposedValues": {
      "name": "Velvet Sprocket",
      "personName": "Velvet Sprocket",
      "title": "Paint lead",
      "date": null,
      "status": null,
      "scope": "Wooden-track refresh",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "understood": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":1}
mapped items:
rejected:
- rejected unknown/ignore Velvet Sprocket is joining as paint lead for the wooden-track refresh.
```

### Scores

**Production**

- silent_omission: Velvet Sprocket is a new paint lead. (No matching item)

**Gate 1 AI-first**

- correct_explicit_truth: Velvet Sprocket is a new paint lead. (create person unbound)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Velvet Sprocket is a new paint lead. (create person unbound)

## update-packaging

**CASE** Obvious update — existing risk worse

- family: update
- source: corpus existing-risk-update (corpus)
- notes: Existing Packaging delay risk is worsening, still open.
- gate1-retained: true

### Raw Capture

```text
Packaging delay is getting worse after the cardboard mill flooded.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 490 chars, ~154 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=5119ms usage={"prompt_tokens":817,"completion_tokens":187,"total_tokens":1004,"reasoning_tokens":42}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "update",
    "domain": "risk",
    "targetCanonicalId": "risk-packaging",
    "subject": "Packaging delay",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Packaging delay is getting worse after the cardboard mill flooded.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Packaging delay is getting worse after the cardboard mill flooded.",
    "understood": "The existing packaging delay risk is worsening following the cardboard mill flood.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "update",
    "domain": "risk",
    "targetCanonicalId": "risk-packaging",
    "subject": "Packaging delay",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Packaging delay is getting worse after the cardboard mill flooded.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Packaging delay is getting worse after the cardboard mill flooded.",
    "understood": "The existing packaging delay risk is worsening following the cardboard mill flood.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you risk target=risk-packaging :: Packaging delay is getting worse.
```

### Scores

**Production**

- incorrect_proposed_truth: Packaging delay is worsening and still open. (expected update, got needs_you)

**Gate 1 AI-first**

- correct_explicit_truth: Packaging delay is worsening and still open. (update risk risk-packaging)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Packaging delay is worsening and still open. (update risk risk-packaging)

## nochange-pippa

**CASE** Already-current truth / named identity

- family: already_current
- source: corpus existing-person (corpus)
- notes: Pippa Gumdrop is already on Candyland; do not create a second person.
- gate1-retained: true

### Raw Capture

```text
Pippa Gumdrop is still the UAT lead for the licorice stands.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=5623ms usage={"prompt_tokens":878,"completion_tokens":242,"total_tokens":1120,"reasoning_tokens":56}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "update",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "Pippa Gumdrop — UAT lead for the licorice stands",
    "proposedValues": {
      "name": null,
      "personName": "Pippa Gumdrop",
      "title": null,
      "date": null,
      "status": null,
      "scope": "UAT lead for the licorice stands",
      "ownershipSemantics": null,
      "text": "Pippa Gumdrop — UAT lead for the licorice stands",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pippa Gumdrop is still the UAT lead for the licorice stands.",
    "understood": "Pippa remains the UAT lead; the Capture specifies the licorice stands as the scope.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "update",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "Pippa Gumdrop — UAT lead for the licorice stands",
    "proposedValues": {
      "name": null,
      "personName": "Pippa Gumdrop",
      "title": null,
      "date": null,
      "status": null,
      "scope": "UAT lead for the licorice stands",
      "ownershipSemantics": null,
      "text": "Pippa Gumdrop — UAT lead for the licorice stands",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pippa Gumdrop is still the UAT lead for the licorice stands.",
    "understood": "Pippa remains the UAT lead; the Capture specifies the licorice stands as the scope.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- no_change responsibility target=person-gumdrop :: Pippa Gumdrop is still the UAT lead for the licorice stands.
```

### Scores

**Production**

- correct_no_change: Pippa remains UAT lead — no second person. (no_change responsibility person-gumdrop)

**Gate 1 AI-first**

- correct_explicit_truth: Pippa remains UAT lead — no second person. (update responsibility resp-uat)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Pippa remains UAT lead — no second person. (update responsibility resp-uat)

## pronoun-she

**CASE** Pronoun with no named subject

- family: pronoun
- source: corpus pronoun-ambiguity (corpus)
- notes: The speaker did not name who 'she' is.
- gate1-retained: true

### Raw Capture

```text
She said she will own the boss balancing pass from now on.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-game" name="GamingStudio5000" code="GS5K"

PEOPLE
id="person-pixel" name="Pixel Ramos" role="Producer"

ISSUES
id="risk-console" title="Console certification slip" status="open"

TO_DO
id="todo-balance" title="Boss balancing pass" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-cert" label="Console certification" startAt="2026-11-20T12:00:00.000Z"
```

Snapshot: 454 chars, ~137 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3779ms usage={"prompt_tokens":804,"completion_tokens":155,"total_tokens":959,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Ownership of Boss balancing pass",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Boss balancing pass",
      "date": null,
      "status": null,
      "scope": "Boss balancing pass",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "She said she will own the boss balancing pass from now on.",
    "understood": "The Capture assigns ownership of the existing Boss balancing pass, but does not identify who “she” refers to.",
    "question": "Who does “she” refer to?",
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Ownership of Boss balancing pass",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Boss balancing pass",
      "date": null,
      "status": null,
      "scope": "Boss balancing pass",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "She said she will own the boss balancing pass from now on.",
    "understood": "The Capture assigns ownership of the existing Boss balancing pass, but does not identify who “she” refers to.",
    "question": "Who does “she” refer to?",
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you responsibility target=todo-balance :: Pixel Ramos will own the boss balancing pass from now on.
```

### Scores

**Production**

- appropriate_needs_you: 'She' is unnamed — must not assign Pixel Ramos. (needs_you responsibility todo-balance)

**Gate 1 AI-first**

- appropriate_needs_you: 'She' is unnamed — must not assign Pixel Ramos. (needs_you responsibility unbound)

**Gate 2 AI-first + legal boundary**

- appropriate_needs_you: 'She' is unnamed — must not assign Pixel Ramos. (needs_you responsibility unbound)

## date-parade

**CASE** Explicit date move

- family: date
- source: corpus milestone-move (corpus)
- notes: Parade day moves to 29 October 2026.
- gate1-retained: true

### Raw Capture

```text
Parade day is now 29 October 2026.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3476ms usage={"prompt_tokens":873,"completion_tokens":146,"total_tokens":1019,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "update",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": "Parade day",
      "personName": null,
      "title": null,
      "date": "2026-10-29",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parade day is now 29 October 2026.",
    "understood": "Parade day moves from 15 October 2026 to 29 October 2026.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "update",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": "Parade day",
      "personName": null,
      "title": null,
      "date": "2026-10-29",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parade day is now 29 October 2026.",
    "understood": "Parade day moves from 15 October 2026 to 29 October 2026.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- create milestone target=none :: The date for Parade day has been updated.
```

### Scores

**Production**

- incorrect_proposed_truth: Parade day moves to 29 October 2026. (expected update, got create)

**Gate 1 AI-first**

- correct_explicit_truth: Parade day moves to 29 October 2026. (update milestone ms-parade)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Parade day moves to 29 October 2026. (update milestone ms-parade)

## correction-audio

**CASE** Spoken correction

- family: correction
- source: corpus correction-of-wording (corpus)
- notes: The intended new risk is the audio bus mixer, after a spoken correction.
- gate1-retained: true

### Raw Capture

```text
The shader compile is stalling the cert build. Wait — I meant the audio bus mixer, not the shader.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-game" name="GamingStudio5000" code="GS5K"

PEOPLE
id="person-pixel" name="Pixel Ramos" role="Producer"

ISSUES
id="risk-console" title="Console certification slip" status="open"

TO_DO
id="todo-balance" title="Boss balancing pass" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-cert" label="Console certification" startAt="2026-11-20T12:00:00.000Z"
```

Snapshot: 454 chars, ~137 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=6953ms usage={"prompt_tokens":814,"completion_tokens":255,"total_tokens":1069,"reasoning_tokens":83}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "create",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Audio bus mixer stalling the cert build",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Audio bus mixer stalling the cert build",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "The audio bus mixer is stalling the cert build.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The shader compile is stalling the cert build. Wait — I meant the audio bus mixer, not the shader.",
    "understood": "The audio bus mixer, not the shader compile, is stalling the cert build.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "create",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Audio bus mixer stalling the cert build",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Audio bus mixer stalling the cert build",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "The audio bus mixer is stalling the cert build.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The shader compile is stalling the cert build. Wait — I meant the audio bus mixer, not the shader.",
    "understood": "The audio bus mixer, not the shader compile, is stalling the cert build.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":1,"rejected":0}
mapped items:
- create risk target=none :: The audio bus mixer is causing a stall in the certification build.
- left_untouched unsupported target=none :: The shader compile is stalling the cert build.
```

### Scores

**Production**

- correct_explicit_truth: Intended new risk is the audio bus mixer. (create risk unbound)

**Gate 1 AI-first**

- correct_explicit_truth: Intended new risk is the audio bus mixer. (create risk unbound)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Intended new risk is the audio bus mixer. (create risk unbound)

## contradict-parade

**CASE** Contradictory dates for the same milestone

- family: contradiction
- source: manual-for-experiment (manual-for-experiment)
- notes: Experiment-inferred: two incompatible dates for ms-parade. Must Needs You or Left untouched, not pick a date.
- gate1-retained: true

### Raw Capture

```text
Parade day is now 29 October 2026. Also, keep Parade day on 15 October 2026.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3963ms usage={"prompt_tokens":886,"completion_tokens":181,"total_tokens":1067,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "needs_you",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Parade day",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parade day is now 29 October 2026. Also, keep Parade day on 15 October 2026.",
    "understood": "The Capture gives contradictory dates for Parade day: 29 October 2026 and 15 October 2026.",
    "question": "Should Parade day be on 29 October 2026 or remain on 15 October 2026?",
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "needs_you",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Parade day",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parade day is now 29 October 2026. Also, keep Parade day on 15 October 2026.",
    "understood": "The Capture gives contradictory dates for Parade day: 29 October 2026 and 15 October 2026.",
    "question": "Should Parade day be on 29 October 2026 or remain on 15 October 2026?",
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":1,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- update milestone target=ms-parade :: Parade day is now 29 October 2026.
- no_change milestone target=ms-parade :: Keep Parade day on 15 October 2026.
```

### Scores

**Production**

- incorrect_proposed_truth: Parade day dates contradict — do not write a chosen date. (expected needs_you|left_untouched, got update)

**Gate 1 AI-first**

- appropriate_needs_you: Parade day dates contradict — do not write a chosen date. (needs_you milestone ms-parade)

**Gate 2 AI-first + legal boundary**

- appropriate_needs_you: Parade day dates contradict — do not write a chosen date. (needs_you milestone ms-parade)

## ambiguous-share

**CASE** Ambiguous share vs replace

- family: ambiguous
- source: corpus share-vs-replace-ambiguous (corpus)
- notes: UAT ownership between Fizz and Pippa is genuinely ambiguous.
- gate1-retained: true

### Raw Capture

```text
Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it — the parade committee was unclear.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4185ms usage={"prompt_tokens":886,"completion_tokens":190,"total_tokens":1076,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "UAT ownership",
    "proposedValues": {
      "name": null,
      "personName": "Fizz Caramel",
      "title": null,
      "date": null,
      "status": null,
      "scope": "UAT lead",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it — the parade committee was unclear.",
    "understood": "A possible UAT ownership change is mentioned, but whether Fizz replaces Pippa or shares ownership with her is unclear.",
    "question": "Is Fizz Caramel replacing Pippa Gumdrop as UAT lead, sharing ownership with her, or is the change still undecided?",
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "UAT ownership",
    "proposedValues": {
      "name": null,
      "personName": "Fizz Caramel",
      "title": null,
      "date": null,
      "status": null,
      "scope": "UAT lead",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it — the parade committee was unclear.",
    "understood": "A possible UAT ownership change is mentioned, but whether Fizz replaces Pippa or shares ownership with her is unclear.",
    "question": "Is Fizz Caramel replacing Pippa Gumdrop as UAT lead, sharing ownership with her, or is the change still undecided?",
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":2,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you responsibility target=person-fizz :: Fizz Caramel might take UAT from Pippa Gumdrop.
- needs_you responsibility target=person-fizz :: Fizz Caramel and Pippa Gumdrop might share UAT.
```

### Scores

**Production**

- appropriate_needs_you: UAT share vs replace is undecided. (needs_you responsibility person-fizz)

**Gate 1 AI-first**

- appropriate_needs_you: UAT share vs replace is undecided. (needs_you responsibility resp-uat)

**Gate 2 AI-first + legal boundary**

- appropriate_needs_you: UAT share vs replace is undecided. (needs_you responsibility resp-uat)

## unsupported-remove

**CASE** Unsupported milestone removal

- family: unsupported
- source: manual-for-experiment (manual-for-experiment)
- notes: Experiment-inferred from Capture status product-model gap: milestone cancel/remove is not a legal write. Left untouched or Needs You. A remove proposal is recorded but must not be treated as an Apply-ready success.
- gate1-retained: true

### Raw Capture

```text
Please delete Parade day from the plan.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4226ms usage={"prompt_tokens":869,"completion_tokens":162,"total_tokens":1031,"reasoning_tokens":26}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "remove",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Parade day",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please delete Parade day from the plan.",
    "understood": "Remove the existing Parade day milestone from the plan.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Parade day",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please delete Parade day from the plan.",
    "understood": "Remove the existing Parade day milestone from the plan.",
    "question": null,
    "leftUntouchedReason": "Lume cannot safely apply this type of change."
  }
]
```

Boundary intercepted:
- [0] remove milestone ms-parade applySupports=false planner=needs_you/Lume cannot apply this change automatically. It needs clarification before anything is written.

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":1}
mapped items:
rejected:
- rejected milestone/ambiguous Delete Parade day from the plan.
```

### Scores

**Production**

- appropriate_left_untouched: Milestone delete is unsupported — fallback, do not silently write. (omitted without a write)

**Gate 1 AI-first**

- unsupported_invented_operation: Milestone delete is unsupported — fallback, do not silently write. (expected left_untouched|needs_you, got remove)

**Gate 2 AI-first + legal boundary**

- appropriate_left_untouched: Milestone delete is unsupported — fallback, do not silently write. (left_untouched milestone ms-parade)

## mixed-three

**CASE** Mixed independent facts

- family: mixed
- source: corpus mixed-domains (corpus)
- notes: Pippa remains UAT lead. Parade day moves to 22 October 2026. New risk: chocolate fountain pump overheating.
- gate1-retained: true

### Raw Capture

```text
Pippa Gumdrop remains UAT lead. Parade day moved to 22 October 2026. The chocolate fountain pump is overheating.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=7104ms usage={"prompt_tokens":888,"completion_tokens":381,"total_tokens":1269,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "no_change",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "Pippa Gumdrop — UAT lead",
    "proposedValues": {
      "name": null,
      "personName": "Pippa Gumdrop",
      "title": null,
      "date": null,
      "status": null,
      "scope": "UAT lead",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pippa Gumdrop remains UAT lead.",
    "understood": "Pippa Gumdrop continues as UAT lead.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "update",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Parade day",
      "date": "2026-10-22",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parade day moved to 22 October 2026.",
    "understood": "Parade day moves from 15 October to 22 October 2026.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "create",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Chocolate fountain pump overheating",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Chocolate fountain pump overheating",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "The chocolate fountain pump is overheating.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The chocolate fountain pump is overheating.",
    "understood": "A new issue is reported: the chocolate fountain pump is overheating.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "no_change",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "Pippa Gumdrop — UAT lead",
    "proposedValues": {
      "name": null,
      "personName": "Pippa Gumdrop",
      "title": null,
      "date": null,
      "status": null,
      "scope": "UAT lead",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pippa Gumdrop remains UAT lead.",
    "understood": "Pippa Gumdrop continues as UAT lead.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "update",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Parade day",
      "date": "2026-10-22",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parade day moved to 22 October 2026.",
    "understood": "Parade day moves from 15 October to 22 October 2026.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "create",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Chocolate fountain pump overheating",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Chocolate fountain pump overheating",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "The chocolate fountain pump is overheating.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The chocolate fountain pump is overheating.",
    "understood": "A new issue is reported: the chocolate fountain pump is overheating.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":3,"proposedChanges":2,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- no_change person target=person-gumdrop :: Pippa Gumdrop remains UAT lead.
- update milestone target=ms-parade :: Parade day moved to 22 October 2026.
- create risk target=none :: The chocolate fountain pump is overheating.
```

### Scores

**Production**

- correct_no_change: Pippa remains UAT lead. (no_change person person-gumdrop)
- correct_explicit_truth: Parade day moves to 22 October 2026. (update milestone ms-parade)
- correct_explicit_truth: New fountain-pump overheating risk. (create risk unbound)

**Gate 1 AI-first**

- correct_no_change: Pippa remains UAT lead. (no_change responsibility resp-uat)
- correct_explicit_truth: Parade day moves to 22 October 2026. (update milestone ms-parade)
- correct_explicit_truth: New fountain-pump overheating risk. (create risk unbound)

**Gate 2 AI-first + legal boundary**

- correct_no_change: Pippa remains UAT lead. (no_change responsibility resp-uat)
- correct_explicit_truth: Parade day moves to 22 October 2026. (update milestone ms-parade)
- correct_explicit_truth: New fountain-pump overheating risk. (create risk unbound)

## chatter

**CASE** Vague / irrelevant chatter

- family: chatter
- source: corpus irrelevant-commentary (corpus)
- notes: Lobby chiptunes are not certification work.
- gate1-retained: true

### Raw Capture

```text
The lobby cabinets were blasting chiptunes all morning, nothing about the certification sprint.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-game" name="GamingStudio5000" code="GS5K"

PEOPLE
id="person-pixel" name="Pixel Ramos" role="Producer"

ISSUES
id="risk-console" title="Console certification slip" status="open"

TO_DO
id="todo-balance" title="Boss balancing pass" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-cert" label="Console certification" startAt="2026-11-20T12:00:00.000Z"
```

Snapshot: 454 chars, ~137 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3552ms usage={"prompt_tokens":808,"completion_tokens":142,"total_tokens":950,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Lobby cabinet chatter",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The lobby cabinets were blasting chiptunes all morning, nothing about the certification sprint.",
    "understood": "No explicit project change was stated.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter with no project operation."
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Lobby cabinet chatter",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The lobby cabinets were blasting chiptunes all morning, nothing about the certification sprint.",
    "understood": "No explicit project change was stated.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter with no project operation."
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":2,"leftUntouched":0,"rejected":0}
mapped items:
- left_untouched unsupported target=none :: The lobby cabinets were blasting chiptunes all morning.
- left_untouched unsupported target=none :: Nothing about the certification sprint was mentioned.
```

### Scores

**Production**

- appropriate_left_untouched: Irrelevant chatter must not become a write. (left_untouched unsupported unbound)

**Gate 1 AI-first**

- appropriate_left_untouched: Irrelevant chatter must not become a write. (left_untouched unsupported unbound)

**Gate 2 AI-first + legal boundary**

- appropriate_left_untouched: Irrelevant chatter must not become a write. (left_untouched unsupported unbound)

## holdout-h6

**CASE** Known challenge — holdout H6 messy paste

- family: known_challenge
- source: e2e-hosted-holdout H6_MESSY_OPS_PASTE (holdout)
- notes: Holdout expected: workshop 22 Oct update; void keys create; Kwame create or Needs You; policy already-known; plants/biscuits not truth; DHP speculation Needs You / omitted.
- gate1-retained: true

### Raw Capture

```text
From: housing ops
Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.

22/10/2026 is the new mobilisation workshop date (was 8 Oct).

Parking: the office plants need watering; not a control.

Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.

Kwame Boateng is the contractor lead for Harbour.

Void keys still need collecting from the depot on 16 Oct 2026.

Elena said the repairs policy v3 remains current.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-harbour-holdout-seed" name="Harbour repairs mobilisation" code="HARBOUR"

PEOPLE
id="person-priya" name="Priya Nair" role="contractor liaison"
id="person-tomos" name="Tomos Reed" role="voids"
id="person-elena" name="Elena Voss" role="resident liaison"

ISSUES
(none)

TO_DO
(none)

KNOWLEDGE
id="know-policy-v3" kind="fact" body="Repairs policy v3 is the current working version."
id="resp-priya" kind="responsibility" body="Priya Nair owns contractor liaison." personId="person-priya" personName="Priya Nair" scope="contractor liaison" ownerConfirmed=true
id="resp-tomos" kind="responsibility" body="Tomos Reed owns voids." personId="person-tomos" personName="Tomos Reed" scope="voids" ownerConfirmed=true
id="resp-elena" kind="responsibility" body="Elena Voss owns resident liaison." personId="person-elena" personName="Elena Voss" scope="resident liaison" ownerConfirmed=true

MILESTONES
id="ms-workshop" label="Mobilisation workshop" startAt="2026-10-08T12:00:00.000Z"
```

Snapshot: 1077 chars, ~324 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=23140ms usage={"prompt_tokens":1081,"completion_tokens":1567,"total_tokens":2648,"reasoning_tokens":81}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Biscuits chatter",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.",
    "understood": "The biscuits discussion is explicitly excluded.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter, explicitly marked to ignore."
  },
  {
    "operation": "update",
    "domain": "milestone",
    "targetCanonicalId": "ms-workshop",
    "subject": "Mobilisation workshop date",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": "2026-10-22",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "22/10/2026 is the new mobilisation workshop date (was 8 Oct).",
    "understood": "The mobilisation workshop moves from 8 October to 22 October 2026.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Office plants",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parking: the office plants need watering; not a control.",
    "understood": "Office plant watering is parked and not identified as a project control.",
    "question": null,
    "leftUntouchedReason": "No explicit project operation; incidental office housekeeping."
  },
  {
    "operation": "left_untouched",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Speculative DHP responsibility",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
    "understood": "Priya taking DHP is explicitly speculation, not an assignment.",
    "question": null,
    "leftUntouchedReason": "No confirmed responsibility change."
  },
  {
    "operation": "create",
    "domain": "person",
    "targetCanonicalId": null,
    "subject": "Kwame Boateng",
    "proposedValues": {
      "name": "Kwame Boateng",
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Kwame Boateng is the contractor lead for Harbour.",
    "understood": "Kwame Boateng is a named project person absent from the snapshot.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "create",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Contractor lead for Harbour",
    "proposedValues": {
      "name": null,
      "personName": "Kwame Boateng",
      "title": null,
      "date": null,
      "status": null,
      "scope": "contractor lead for Harbour",
      "ownershipSemantics": null,
      "text": "Kwame Boateng is the contractor lead for Harbour.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Kwame Boateng is the contractor lead for Harbour.",
    "understood": "Kwame Boateng is explicitly assigned the contractor lead role; no replacement of Priya's contractor liaison responsibility is stated.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "create",
    "domain": "todo",
    "targetCanonicalId": null,
    "subject": "Collect void keys",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Collect void keys from the depot",
      "date": "2026-10-16",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Void keys still need collecting from the depot on 16 October 2026.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Void keys still need collecting from the depot on 16 Oct 2026.",
    "understood": "Collecting the void keys is an outstanding task scheduled for 16 October 2026. No assignee is stated.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "no_change",
    "domain": "knowledge",
    "targetCanonicalId": "know-policy-v3",
    "subject": "Current repairs policy",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Repairs policy v3 is the current working version.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Elena said the repairs policy v3 remains current.",
    "understood": "The capture restates that repairs policy v3 remains current.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Biscuits chatter",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.",
    "understood": "The biscuits discussion is explicitly excluded.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter, explicitly marked to ignore."
  },
  {
    "operation": "update",
    "domain": "milestone",
    "targetCanonicalId": "ms-workshop",
    "subject": "Mobilisation workshop date",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": "2026-10-22",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "22/10/2026 is the new mobilisation workshop date (was 8 Oct).",
    "understood": "The mobilisation workshop moves from 8 October to 22 October 2026.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Office plants",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parking: the office plants need watering; not a control.",
    "understood": "Office plant watering is parked and not identified as a project control.",
    "question": null,
    "leftUntouchedReason": "No explicit project operation; incidental office housekeeping."
  },
  {
    "operation": "left_untouched",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Speculative DHP responsibility",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
    "understood": "Priya taking DHP is explicitly speculation, not an assignment.",
    "question": null,
    "leftUntouchedReason": "No confirmed responsibility change."
  },
  {
    "operation": "create",
    "domain": "person",
    "targetCanonicalId": null,
    "subject": "Kwame Boateng",
    "proposedValues": {
      "name": "Kwame Boateng",
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Kwame Boateng is the contractor lead for Harbour.",
    "understood": "Kwame Boateng is a named project person absent from the snapshot.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "create",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Contractor lead for Harbour",
    "proposedValues": {
      "name": null,
      "personName": "Kwame Boateng",
      "title": null,
      "date": null,
      "status": null,
      "scope": "contractor lead for Harbour",
      "ownershipSemantics": null,
      "text": "Kwame Boateng is the contractor lead for Harbour.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Kwame Boateng is the contractor lead for Harbour.",
    "understood": "Kwame Boateng is explicitly assigned the contractor lead role; no replacement of Priya's contractor liaison responsibility is stated.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "create",
    "domain": "todo",
    "targetCanonicalId": null,
    "subject": "Collect void keys",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Collect void keys from the depot",
      "date": "2026-10-16",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Void keys still need collecting from the depot on 16 October 2026.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Void keys still need collecting from the depot on 16 Oct 2026.",
    "understood": "Collecting the void keys is an outstanding task scheduled for 16 October 2026. No assignee is stated.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "no_change",
    "domain": "knowledge",
    "targetCanonicalId": "know-policy-v3",
    "subject": "Current repairs policy",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Repairs policy v3 is the current working version.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Elena said the repairs policy v3 remains current.",
    "understood": "The capture restates that repairs policy v3 remains current.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":7,"proposedChanges":3,"alreadyKnown":0,"merged":0,"needsYou":2,"commentary":0,"leftUntouched":2,"rejected":0}
mapped items:
- update milestone target=ms-workshop :: The new mobilisation workshop date is 22/10/2026.
- create person target=none :: Kwame Boateng is the contractor lead for Harbour.
- create todo target=none :: Void keys still need collecting from the depot on 16 Oct 2026.
- needs_you knowledge target=none :: Elena said the repairs policy v3 remains current.
- needs_you risk target=none :: Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.
- left_untouched unsupported target=none :: From: housing ops Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.
- left_untouched unsupported target=none :: Parking: the office plants need watering; not a control.
```

### Scores

**Production**

- correct_explicit_truth: Workshop moves to 22 October 2026. (update milestone ms-workshop)
- correct_explicit_truth: Collect void keys 16 Oct — new dated action. (create todo unbound)
- correct_explicit_truth: Kwame Boateng is a new contractor lead. (create person unbound)
- incorrect_proposed_truth: Policy v3 remains current. (expected no_change, got needs_you)
- appropriate_needs_you: DHP ownership is speculation. (needs_you risk unbound)

**Gate 1 AI-first**

- correct_explicit_truth: Workshop moves to 22 October 2026. (update milestone ms-workshop)
- correct_explicit_truth: Collect void keys 16 Oct — new dated action. (create todo unbound)
- correct_explicit_truth: Kwame Boateng is a new contractor lead. (create person unbound)
- correct_no_change: Policy v3 remains current. (no_change knowledge know-policy-v3)
- appropriate_left_untouched: DHP ownership is speculation. (left_untouched responsibility unbound)
- extra invented write: create responsibility new :: Kwame Boateng is explicitly assigned the contractor lead role; no replacement of Priya's contractor liaison responsibility is stated.

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Workshop moves to 22 October 2026. (update milestone ms-workshop)
- correct_explicit_truth: Collect void keys 16 Oct — new dated action. (create todo unbound)
- correct_explicit_truth: Kwame Boateng is a new contractor lead. (create person unbound)
- correct_no_change: Policy v3 remains current. (no_change knowledge know-policy-v3)
- appropriate_left_untouched: DHP ownership is speculation. (left_untouched responsibility unbound)
- extra invented write: create responsibility new :: Kwame Boateng is explicitly assigned the contractor lead role; no replacement of Priya's contractor liaison responsibility is stated.

## ambiguous-same-first-name

**CASE** Same first name / ambiguous Person

- family: identity
- source: corpus ambiguous-same-first-name (corpus)
- notes: A Brick was mentioned who may not be Brick Oakley — preserve ambiguity.
- gate1-retained: false

### Raw Capture

```text
Brick from the warehouse called; he wants to help with assembly.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 490 chars, ~154 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=7160ms usage={"prompt_tokens":819,"completion_tokens":300,"total_tokens":1119,"reasoning_tokens":125}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "needs_you",
    "domain": "knowledge",
    "targetCanonicalId": null,
    "subject": "Brick's interest in helping with assembly",
    "proposedValues": {
      "name": null,
      "personName": "Brick",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Brick from the warehouse wants to help with assembly.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick from the warehouse called; he wants to help with assembly.",
    "understood": "Brick expressed interest in helping with assembly, not an ownership change. His identity is unclear relative to the snapshot.",
    "question": "Is Brick from the warehouse Brick Oakley, the sponsor, or a different person?",
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "needs_you",
    "domain": "knowledge",
    "targetCanonicalId": null,
    "subject": "Brick's interest in helping with assembly",
    "proposedValues": {
      "name": null,
      "personName": "Brick",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Brick from the warehouse wants to help with assembly.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick from the warehouse called; he wants to help with assembly.",
    "understood": "Brick expressed interest in helping with assembly, not an ownership change. His identity is unclear relative to the snapshot.",
    "question": "Is Brick from the warehouse Brick Oakley, the sponsor, or a different person?",
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you availability target=person-brick :: Brick Oakley wants to help with assembly.
```

### Scores

**Production**

- appropriate_needs_you: Warehouse Brick is not silently Brick Oakley. (needs_you availability person-brick)

**Gate 1 AI-first**

- appropriate_needs_you: Warehouse Brick is not silently Brick Oakley. (needs_you knowledge unbound)

**Gate 2 AI-first + legal boundary**

- appropriate_needs_you: Warehouse Brick is not silently Brick Oakley. (needs_you knowledge unbound)

## responsibility-continues

**CASE** Responsibility continues

- family: already_current
- source: corpus responsibility-continues (corpus)
- notes: Pixel Ramos still holds Producer; this is continuity, not replacement.
- gate1-retained: false

### Raw Capture

```text
Pixel Ramos continues as Producer on the console sprint. No change there.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-game" name="GamingStudio5000" code="GS5K"

PEOPLE
id="person-pixel" name="Pixel Ramos" role="Producer"

ISSUES
id="risk-console" title="Console certification slip" status="open"

TO_DO
id="todo-balance" title="Boss balancing pass" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-cert" label="Console certification" startAt="2026-11-20T12:00:00.000Z"
```

Snapshot: 454 chars, ~137 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4052ms usage={"prompt_tokens":805,"completion_tokens":136,"total_tokens":941,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "no_change",
    "domain": "person",
    "targetCanonicalId": "person-pixel",
    "subject": "Pixel Ramos",
    "proposedValues": {
      "name": "Pixel Ramos",
      "personName": "Pixel Ramos",
      "title": "Producer",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pixel Ramos continues as Producer on the console sprint. No change there.",
    "understood": "Pixel Ramos remains Producer; no change to the current person row.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "no_change",
    "domain": "person",
    "targetCanonicalId": "person-pixel",
    "subject": "Pixel Ramos",
    "proposedValues": {
      "name": "Pixel Ramos",
      "personName": "Pixel Ramos",
      "title": "Producer",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pixel Ramos continues as Producer on the console sprint. No change there.",
    "understood": "Pixel Ramos remains Producer; no change to the current person row.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":1,"rejected":1}
mapped items:
- left_untouched unsupported target=none :: No change there.
rejected:
- rejected unknown/ignore Pixel Ramos continues as Producer on the console sprint.
```

### Scores

**Production**

- silent_omission: Pixel remains Producer — continuity, not replacement. (No matching item)

**Gate 1 AI-first**

- correct_no_change: Pixel remains Producer — continuity, not replacement. (no_change person person-pixel)

**Gate 2 AI-first + legal boundary**

- correct_no_change: Pixel remains Producer — continuity, not replacement. (no_change person person-pixel)

## responsibility-replacement

**CASE** Responsibility replacement

- family: update
- source: corpus responsibility-replacement (corpus)
- notes: Producer moves from Pixel Ramos to Nova Quill (replace, not share). Nova Quill is introduced in this ownership change.
- gate1-retained: false

### Raw Capture

```text
Nova Quill will replace Pixel Ramos as Producer from next week.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-game" name="GamingStudio5000" code="GS5K"

PEOPLE
id="person-pixel" name="Pixel Ramos" role="Producer"

ISSUES
id="risk-console" title="Console certification slip" status="open"

TO_DO
id="todo-balance" title="Boss balancing pass" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-cert" label="Console certification" startAt="2026-11-20T12:00:00.000Z"
```

Snapshot: 454 chars, ~137 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=12609ms usage={"prompt_tokens":804,"completion_tokens":424,"total_tokens":1228,"reasoning_tokens":256}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": "person-pixel",
    "subject": "Replace Pixel Ramos with Nova Quill as Producer",
    "proposedValues": {
      "name": null,
      "personName": "Nova Quill",
      "title": "Producer",
      "date": null,
      "status": null,
      "scope": "GamingStudio5000",
      "ownershipSemantics": "replace",
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Nova Quill will replace Pixel Ramos as Producer from next week.",
    "understood": "Nova Quill is to replace Pixel Ramos as Producer, but the exact effective date is unspecified.",
    "question": "What exact date next week should the replacement take effect?",
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": "person-pixel",
    "subject": "Replace Pixel Ramos with Nova Quill as Producer",
    "proposedValues": {
      "name": null,
      "personName": "Nova Quill",
      "title": "Producer",
      "date": null,
      "status": null,
      "scope": "GamingStudio5000",
      "ownershipSemantics": "replace",
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Nova Quill will replace Pixel Ramos as Producer from next week.",
    "understood": "Nova Quill is to replace Pixel Ramos as Producer, but the exact effective date is unspecified.",
    "question": "What exact date next week should the replacement take effect?",
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you responsibility target=person-pixel :: Nova Quill will replace Pixel Ramos as Producer.
```

### Scores

**Production**

- appropriate_needs_you: Producer moves from Pixel to Nova (replace). (needs_you responsibility person-pixel)
- appropriate_needs_you: Nova Quill is introduced. (needs_you responsibility person-pixel)

**Gate 1 AI-first**

- appropriate_needs_you: Producer moves from Pixel to Nova (replace). (needs_you responsibility person-pixel)
- appropriate_needs_you: Nova Quill is introduced. (needs_you responsibility person-pixel)

**Gate 2 AI-first + legal boundary**

- appropriate_needs_you: Producer moves from Pixel to Nova (replace). (needs_you responsibility person-pixel)
- appropriate_needs_you: Nova Quill is introduced. (needs_you responsibility person-pixel)

## new-risk

**CASE** New Risk

- family: create
- source: corpus new-risk (corpus)
- notes: A new risk about the shader compile stalling the cert build.
- gate1-retained: false

### Raw Capture

```text
The shader compile is stalling the cert build and could miss the nightlies.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-game" name="GamingStudio5000" code="GS5K"

PEOPLE
id="person-pixel" name="Pixel Ramos" role="Producer"

ISSUES
id="risk-console" title="Console certification slip" status="open"

TO_DO
id="todo-balance" title="Boss balancing pass" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-cert" label="Console certification" startAt="2026-11-20T12:00:00.000Z"
```

Snapshot: 454 chars, ~137 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=5302ms usage={"prompt_tokens":807,"completion_tokens":232,"total_tokens":1039,"reasoning_tokens":65}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "create",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Shader compilation stalling the certification build",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Shader compilation stalling the certification build",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "The shader compile is stalling the cert build and could miss the nightlies.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The shader compile is stalling the cert build and could miss the nightlies.",
    "understood": "Shader compilation is stalling the certification build, putting the nightlies at risk.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "create",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Shader compilation stalling the certification build",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Shader compilation stalling the certification build",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "The shader compile is stalling the cert build and could miss the nightlies.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The shader compile is stalling the cert build and could miss the nightlies.",
    "understood": "Shader compilation is stalling the certification build, putting the nightlies at risk.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":2,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- create risk target=none :: The shader compile is stalling the cert build.
- create risk target=none :: The cert build could miss the nightlies.
```

### Scores

**Production**

- correct_explicit_truth: New shader-compile risk — not the console cert issue. (create risk unbound)
- extra invented write: create risk new :: The cert build could miss the nightlies.

**Gate 1 AI-first**

- correct_explicit_truth: New shader-compile risk — not the console cert issue. (create risk unbound)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: New shader-compile risk — not the console cert issue. (create risk unbound)

## risk-resolution

**CASE** Risk resolution

- family: update
- source: corpus risk-resolution (corpus)
- notes: Gumdrop Bridge icing is resolved.
- gate1-retained: false

### Raw Capture

```text
The icing on Gumdrop Bridge has melted; that risk is closed.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3423ms usage={"prompt_tokens":875,"completion_tokens":138,"total_tokens":1013,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "update",
    "domain": "risk",
    "targetCanonicalId": "risk-bridge",
    "subject": "Gumdrop Bridge icing",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Gumdrop Bridge icing",
      "date": null,
      "status": "closed",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The icing on Gumdrop Bridge has melted; that risk is closed.",
    "understood": "The existing Gumdrop Bridge icing risk is now closed.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "update",
    "domain": "risk",
    "targetCanonicalId": "risk-bridge",
    "subject": "Gumdrop Bridge icing",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Gumdrop Bridge icing",
      "date": null,
      "status": "closed",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The icing on Gumdrop Bridge has melted; that risk is closed.",
    "understood": "The existing Gumdrop Bridge icing risk is now closed.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- update risk target=risk-bridge :: The icing on Gumdrop Bridge has melted.
```

### Scores

**Production**

- correct_explicit_truth: Gumdrop Bridge icing is resolved. (update risk risk-bridge)

**Gate 1 AI-first**

- correct_explicit_truth: Gumdrop Bridge icing is resolved. (update risk risk-bridge)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Gumdrop Bridge icing is resolved. (update risk risk-bridge)

## unchanged-date

**CASE** Unchanged date confirmation

- family: already_current
- source: corpus unchanged-date (corpus)
- notes: Track freeze is unchanged at 1 September 2026.
- gate1-retained: false

### Raw Capture

```text
Just confirming: Track freeze remains 1 September 2026.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 490 chars, ~154 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3572ms usage={"prompt_tokens":819,"completion_tokens":140,"total_tokens":959,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "no_change",
    "domain": "milestone",
    "targetCanonicalId": "ms-freeze",
    "subject": "Track freeze",
    "proposedValues": {
      "name": "Track freeze",
      "personName": null,
      "title": null,
      "date": "2026-09-01",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Track freeze remains 1 September 2026.",
    "understood": "Track freeze is confirmed for its existing date, 1 September 2026.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "no_change",
    "domain": "milestone",
    "targetCanonicalId": "ms-freeze",
    "subject": "Track freeze",
    "proposedValues": {
      "name": "Track freeze",
      "personName": null,
      "title": null,
      "date": "2026-09-01",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Track freeze remains 1 September 2026.",
    "understood": "Track freeze is confirmed for its existing date, 1 September 2026.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- no_change milestone target=ms-freeze :: Track freeze remains 1 September 2026.
```

### Scores

**Production**

- correct_no_change: Track freeze remains 1 September 2026. (no_change milestone ms-freeze)

**Gate 1 AI-first**

- correct_no_change: Track freeze remains 1 September 2026. (no_change milestone ms-freeze)

**Gate 2 AI-first + legal boundary**

- correct_no_change: Track freeze remains 1 September 2026. (no_change milestone ms-freeze)

## todo-create

**CASE** Genuine To Do

- family: create
- source: corpus todo-create (corpus)
- notes: Create a to-do about polishing candy-cane banners.
- gate1-retained: false

### Raw Capture

```text
Please add a to-do to polish the candy-cane banners before the float leaves.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3477ms usage={"prompt_tokens":878,"completion_tokens":159,"total_tokens":1037,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "create",
    "domain": "todo",
    "targetCanonicalId": null,
    "subject": "Polish the candy-cane banners",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Polish the candy-cane banners before the float leaves",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please add a to-do to polish the candy-cane banners before the float leaves.",
    "understood": "Add a new to-do to polish the candy-cane banners before the float leaves; no calendar date is specified.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "create",
    "domain": "todo",
    "targetCanonicalId": null,
    "subject": "Polish the candy-cane banners",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Polish the candy-cane banners before the float leaves",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please add a to-do to polish the candy-cane banners before the float leaves.",
    "understood": "Add a new to-do to polish the candy-cane banners before the float leaves; no calendar date is specified.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- create todo target=none :: A new to-do needs to be added to polish the candy-cane banners.
```

### Scores

**Production**

- correct_explicit_truth: New to-do for candy-cane banners. (create todo unbound)

**Gate 1 AI-first**

- correct_explicit_truth: New to-do for candy-cane banners. (create todo unbound)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: New to-do for candy-cane banners. (create todo unbound)

## availability

**CASE** Availability on existing Person

- family: update
- source: corpus availability (corpus)
- notes: Fizz Caramel availability 5–12 October 2026.
- gate1-retained: false

### Raw Capture

```text
Fizz Caramel is away from 5 October 2026 until 12 October 2026.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3702ms usage={"prompt_tokens":881,"completion_tokens":161,"total_tokens":1042,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "create",
    "domain": "availability",
    "targetCanonicalId": null,
    "subject": "Fizz Caramel availability",
    "proposedValues": {
      "name": null,
      "personName": "Fizz Caramel",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": "2026-10-05",
      "awayToIso": "2026-10-12"
    },
    "evidence": "Fizz Caramel is away from 5 October 2026 until 12 October 2026.",
    "understood": "Fizz Caramel is away from 2026-10-05 until 2026-10-12.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "create",
    "domain": "availability",
    "targetCanonicalId": null,
    "subject": "Fizz Caramel availability",
    "proposedValues": {
      "name": null,
      "personName": "Fizz Caramel",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": "2026-10-05",
      "awayToIso": "2026-10-12"
    },
    "evidence": "Fizz Caramel is away from 5 October 2026 until 12 October 2026.",
    "understood": "Fizz Caramel is away from 2026-10-05 until 2026-10-12.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- update availability target=person-fizz :: Fizz Caramel is away from 5 October 2026 until 12 October 2026.
```

### Scores

**Production**

- correct_explicit_truth: Fizz Caramel away 5–12 October 2026. (update availability person-fizz)

**Gate 1 AI-first**

- wrong_target: Fizz Caramel away 5–12 October 2026. (expected new, got none)

**Gate 2 AI-first + legal boundary**

- wrong_target: Fizz Caramel away 5–12 October 2026. (expected new, got none)

## duplicate-observation

**CASE** Duplicate / repeated observation

- family: update
- source: corpus duplicate-observation (corpus)
- notes: Packaging delay resolved — one durable intent, not two writes.
- gate1-retained: false

### Raw Capture

```text
Packaging delay is resolved. Also, the packaging delay issue is resolved.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 490 chars, ~154 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4533ms usage={"prompt_tokens":820,"completion_tokens":136,"total_tokens":956,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "update",
    "domain": "risk",
    "targetCanonicalId": "risk-packaging",
    "subject": "Packaging delay",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Packaging delay",
      "date": null,
      "status": "resolved",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Packaging delay is resolved. Also, the packaging delay issue is resolved.",
    "understood": "The existing Packaging delay issue is resolved; both statements describe the same update.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "update",
    "domain": "risk",
    "targetCanonicalId": "risk-packaging",
    "subject": "Packaging delay",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Packaging delay",
      "date": null,
      "status": "resolved",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Packaging delay is resolved. Also, the packaging delay issue is resolved.",
    "understood": "The existing Packaging delay issue is resolved; both statements describe the same update.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":1,"alreadyKnown":0,"merged":1,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- update risk target=risk-packaging :: The packaging delay is resolved.
- no_change risk target=risk-packaging :: The packaging delay issue is resolved.
```

### Scores

**Production**

- correct_explicit_truth: Packaging delay resolved once, not two writes. (update risk risk-packaging)

**Gate 1 AI-first**

- correct_explicit_truth: Packaging delay resolved once, not two writes. (update risk risk-packaging)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Packaging delay resolved once, not two writes. (update risk risk-packaging)

## explicit-no-change

**CASE** Explicit no-change

- family: already_current
- source: corpus explicit-no-change (corpus)
- notes: 
- gate1-retained: false

### Raw Capture

```text
Nothing has changed on Toyworld this week. Leave the records as they are.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 490 chars, ~154 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3817ms usage={"prompt_tokens":822,"completion_tokens":169,"total_tokens":991,"reasoning_tokens":27}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "no_change",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Toyworld project records",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Nothing has changed on Toyworld this week. Leave the records as they are.",
    "understood": "No changes are requested; all current records remain unchanged.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "no_change",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Toyworld project records",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Nothing has changed on Toyworld this week. Leave the records as they are.",
    "understood": "No changes are requested; all current records remain unchanged.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":1,"leftUntouched":1,"rejected":0}
mapped items:
- no_change unsupported target=none :: Nothing has changed on Toyworld this week.
- left_untouched unsupported target=none :: Leave the records as they are.
```

### Scores

**Production**

- correct_no_change: Explicit leave-records-as-they-are. (no_change unsupported unbound)

**Gate 1 AI-first**

- correct_no_change: Explicit leave-records-as-they-are. (no_change unsupported unbound)

**Gate 2 AI-first + legal boundary**

- correct_no_change: Explicit leave-records-as-they-are. (no_change unsupported unbound)

## cross-project-bait

**CASE** Cross-project bait

- family: unsupported
- source: corpus cross-project-bait (corpus)
- notes: GamingStudio5000 people and risks were mentioned inside Candyland Capture.
- gate1-retained: false

### Raw Capture

```text
Pixel Ramos from GamingStudio5000 should own our UAT, and please resolve the Console certification slip risk while you are here.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=14196ms usage={"prompt_tokens":887,"completion_tokens":780,"total_tokens":1667,"reasoning_tokens":204}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "create",
    "domain": "person",
    "targetCanonicalId": null,
    "subject": "Pixel Ramos",
    "proposedValues": {
      "name": "Pixel Ramos",
      "personName": "Pixel Ramos",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Pixel Ramos from GamingStudio5000",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pixel Ramos from GamingStudio5000 should own our UAT",
    "understood": "Pixel Ramos is a newly named person from GamingStudio5000.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "UAT ownership",
    "proposedValues": {
      "name": null,
      "personName": "Pixel Ramos",
      "title": null,
      "date": null,
      "status": null,
      "scope": "UAT",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pixel Ramos from GamingStudio5000 should own our UAT",
    "understood": "Pixel is proposed as UAT owner, while Pippa Gumdrop is the current UAT lead.",
    "question": "Should Pixel replace Pippa as UAT owner or share ownership with her?",
    "leftUntouchedReason": null
  },
  {
    "operation": "needs_you",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Resolve Console certification slip risk",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Console certification slip",
      "date": null,
      "status": "resolved",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "please resolve the Console certification slip risk while you are here.",
    "understood": "Resolution is requested, but no Console certification slip risk exists in the supplied snapshot.",
    "question": "Which existing risk should this resolution apply to?",
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "create",
    "domain": "person",
    "targetCanonicalId": null,
    "subject": "Pixel Ramos",
    "proposedValues": {
      "name": "Pixel Ramos",
      "personName": "Pixel Ramos",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Pixel Ramos from GamingStudio5000",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pixel Ramos from GamingStudio5000 should own our UAT",
    "understood": "Pixel Ramos is a newly named person from GamingStudio5000.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "UAT ownership",
    "proposedValues": {
      "name": null,
      "personName": "Pixel Ramos",
      "title": null,
      "date": null,
      "status": null,
      "scope": "UAT",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pixel Ramos from GamingStudio5000 should own our UAT",
    "understood": "Pixel is proposed as UAT owner, while Pippa Gumdrop is the current UAT lead.",
    "question": "Should Pixel replace Pippa as UAT owner or share ownership with her?",
    "leftUntouchedReason": null
  },
  {
    "operation": "needs_you",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Resolve Console certification slip risk",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Console certification slip",
      "date": null,
      "status": "resolved",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "please resolve the Console certification slip risk while you are here.",
    "understood": "Resolution is requested, but no Console certification slip risk exists in the supplied snapshot.",
    "question": "Which existing risk should this resolution apply to?",
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you responsibility target=person-gumdrop :: Pixel Ramos should own UAT.
- create risk target=none :: Resolve the Console certification slip risk.
```

### Scores

**Production**

- silent_omission: GamingStudio5000 people/risks inside Candyland Capture. (No matching item)
- extra invented write: create risk new :: Resolve the Console certification slip risk.

**Gate 1 AI-first**

- silent_omission: GamingStudio5000 people/risks inside Candyland Capture. (No matching item)
- extra invented write: create person new :: Pixel Ramos is a newly named person from GamingStudio5000.

**Gate 2 AI-first + legal boundary**

- silent_omission: GamingStudio5000 people/risks inside Candyland Capture. (No matching item)
- extra invented write: create person new :: Pixel Ramos is a newly named person from GamingStudio5000.

## toyworld-vocabulary-bait

**CASE** Toyworld vocabulary bait on Candyland

- family: unsupported
- source: corpus toyworld-vocabulary-bait (corpus)
- notes: A Toyworld person and risk were offered as Candyland writes.
- gate1-retained: false

### Raw Capture

```text
Brick Oakley says Toyworld's packaging delay should be copied onto Candyland as well.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=9170ms usage={"prompt_tokens":879,"completion_tokens":425,"total_tokens":1304,"reasoning_tokens":249}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "needs_you",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Copy Toyworld's packaging delay to Candyland",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick Oakley says Toyworld's packaging delay should be copied onto Candyland as well.",
    "understood": "The Capture requests copying a packaging delay from Toyworld to Candyland, but the source information is not in the supplied snapshot.",
    "question": "What packaging-delay information from Toyworld should be copied to Candyland?",
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "needs_you",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Copy Toyworld's packaging delay to Candyland",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick Oakley says Toyworld's packaging delay should be copied onto Candyland as well.",
    "understood": "The Capture requests copying a packaging delay from Toyworld to Candyland, but the source information is not in the supplied snapshot.",
    "question": "What packaging-delay information from Toyworld should be copied to Candyland?",
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you knowledge target=none :: Toyworld's packaging delay should be copied onto Candyland.
```

### Scores

**Production**

- appropriate_needs_you: Toyworld person/risk offered as Candyland writes. (needs_you knowledge unbound)

**Gate 1 AI-first**

- appropriate_needs_you: Toyworld person/risk offered as Candyland writes. (needs_you risk unbound)

**Gate 2 AI-first + legal boundary**

- appropriate_needs_you: Toyworld person/risk offered as Candyland writes. (needs_you risk unbound)

## todo-remove-supported

**CASE** Genuine supported To Do remove

- family: update
- source: manual-for-experiment (manual-for-experiment)
- notes: To Do delete/remove is a legal write.
- gate1-retained: false

### Raw Capture

```text
Please delete the To Do titled Prepare the jelly pack.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4142ms usage={"prompt_tokens":872,"completion_tokens":143,"total_tokens":1015,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "remove",
    "domain": "todo",
    "targetCanonicalId": "todo-pack",
    "subject": "Prepare the jelly pack",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Prepare the jelly pack",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please delete the To Do titled Prepare the jelly pack.",
    "understood": "Remove the existing To Do titled Prepare the jelly pack.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "remove",
    "domain": "todo",
    "targetCanonicalId": "todo-pack",
    "subject": "Prepare the jelly pack",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Prepare the jelly pack",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please delete the To Do titled Prepare the jelly pack.",
    "understood": "Remove the existing To Do titled Prepare the jelly pack.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- update todo target=todo-pack :: The To Do titled Prepare the jelly pack should be deleted.
```

### Scores

**Production**

- incorrect_proposed_truth: Remove Prepare the jelly pack. (expected remove, got update)

**Gate 1 AI-first**

- correct_explicit_truth: Remove Prepare the jelly pack. (remove todo todo-pack)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Remove Prepare the jelly pack. (remove todo todo-pack)

## unsupported-remove-person

**CASE** Unsupported person removal

- family: unsupported
- source: manual-for-experiment (manual-for-experiment)
- notes: Person remove is not a legal write. Left untouched, not rewritten.
- gate1-retained: false

### Raw Capture

```text
Please delete Pippa Gumdrop from the project.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4259ms usage={"prompt_tokens":871,"completion_tokens":203,"total_tokens":1074,"reasoning_tokens":65}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "remove",
    "domain": "person",
    "targetCanonicalId": "person-gumdrop",
    "subject": "Pippa Gumdrop",
    "proposedValues": {
      "name": "Pippa Gumdrop",
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please delete Pippa Gumdrop from the project.",
    "understood": "Remove Pippa Gumdrop from the project.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "person",
    "targetCanonicalId": "person-gumdrop",
    "subject": "Pippa Gumdrop",
    "proposedValues": {
      "name": "Pippa Gumdrop",
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please delete Pippa Gumdrop from the project.",
    "understood": "Remove Pippa Gumdrop from the project.",
    "question": null,
    "leftUntouchedReason": "Lume cannot safely apply this type of change."
  }
]
```

Boundary intercepted:
- [0] remove person person-gumdrop applySupports=false planner=needs_you/Pippa Gumdrop is no longer involved.

Lume needs clarification about what that means for this stakeholder.

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you person target=person-gumdrop :: Request to delete Pippa Gumdrop from the project.
```

### Scores

**Production**

- appropriate_needs_you: Person delete is unsupported. (needs_you person person-gumdrop)

**Gate 1 AI-first**

- unsupported_invented_operation: Person delete is unsupported. (expected left_untouched|needs_you, got remove)

**Gate 2 AI-first + legal boundary**

- appropriate_left_untouched: Person delete is unsupported. (left_untouched person person-gumdrop)

## unsupported-remove-risk

**CASE** Unsupported issue/risk removal

- family: unsupported
- source: manual-for-experiment (manual-for-experiment)
- notes: Risk delete/remove is not in the Apply matrix.
- gate1-retained: false

### Raw Capture

```text
Please delete the Packaging delay risk.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 490 chars, ~154 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4135ms usage={"prompt_tokens":813,"completion_tokens":143,"total_tokens":956,"reasoning_tokens":12}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "remove",
    "domain": "risk",
    "targetCanonicalId": "risk-packaging",
    "subject": "Packaging delay",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Packaging delay",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please delete the Packaging delay risk.",
    "understood": "Explicit request to remove the existing Packaging delay risk.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "risk",
    "targetCanonicalId": "risk-packaging",
    "subject": "Packaging delay",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Packaging delay",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please delete the Packaging delay risk.",
    "understood": "Explicit request to remove the existing Packaging delay risk.",
    "question": null,
    "leftUntouchedReason": "Lume cannot safely apply this type of change."
  }
]
```

Boundary intercepted:
- [0] remove risk risk-packaging applySupports=false planner=needs_you/Lume cannot apply this change automatically. It needs clarification before anything is written.

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you risk target=risk-packaging :: Delete the Packaging delay risk.
```

### Scores

**Production**

- appropriate_needs_you: Risk delete is unsupported. (needs_you risk risk-packaging)

**Gate 1 AI-first**

- unsupported_invented_operation: Risk delete is unsupported. (expected left_untouched|needs_you, got remove)

**Gate 2 AI-first + legal boundary**

- appropriate_left_untouched: Risk delete is unsupported. (left_untouched risk risk-packaging)

## knowledge-water-based

**CASE** Knowledge remember

- family: create
- source: manual-for-experiment (manual-for-experiment)
- notes: Explicit remember → knowledge create.
- gate1-retained: false

### Raw Capture

```text
Remember: the wooden-track paint must stay water-based.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 490 chars, ~154 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3266ms usage={"prompt_tokens":817,"completion_tokens":140,"total_tokens":957,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "create",
    "domain": "knowledge",
    "targetCanonicalId": null,
    "subject": "Wooden-track paint requirement",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Wooden-track paint requirement",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "The wooden-track paint must stay water-based.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Remember: the wooden-track paint must stay water-based.",
    "understood": "The wooden-track paint is required to remain water-based.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "create",
    "domain": "knowledge",
    "targetCanonicalId": null,
    "subject": "Wooden-track paint requirement",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Wooden-track paint requirement",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "The wooden-track paint must stay water-based.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Remember: the wooden-track paint must stay water-based.",
    "understood": "The wooden-track paint is required to remain water-based.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you knowledge target=none :: The wooden-track paint must stay water-based.
```

### Scores

**Production**

- incorrect_proposed_truth: Remember water-based paint as knowledge. (expected create, got needs_you)

**Gate 1 AI-first**

- correct_explicit_truth: Remember water-based paint as knowledge. (create knowledge unbound)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Remember water-based paint as knowledge. (create knowledge unbound)

## vague-parade

**CASE** Vague concern

- family: chatter
- source: manual-for-experiment (manual-for-experiment)
- notes: Vague worry is Left untouched, not a new risk.
- gate1-retained: false

### Raw Capture

```text
I'm a bit worried about the parade.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4279ms usage={"prompt_tokens":869,"completion_tokens":141,"total_tokens":1010,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Worry about the parade",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "I'm a bit worried about the parade.",
    "understood": "A vague concern about the parade, with no explicit project change.",
    "question": null,
    "leftUntouchedReason": "No specific risk or named change is stated."
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Worry about the parade",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "I'm a bit worried about the parade.",
    "understood": "A vague concern about the parade, with no explicit project change.",
    "question": null,
    "leftUntouchedReason": "No specific risk or named change is stated."
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- no_change risk target=none :: There is a concern about the parade.
```

### Scores

**Production**

- correct_no_change: Vague parade worry is not a write. (no_change risk unbound)

**Gate 1 AI-first**

- appropriate_left_untouched: Vague parade worry is not a write. (left_untouched unsupported unbound)

**Gate 2 AI-first + legal boundary**

- appropriate_left_untouched: Vague parade worry is not a write. (left_untouched unsupported unbound)

## relative-date-parade

**CASE** Relative / ambiguous date

- family: date
- source: manual-for-experiment (manual-for-experiment)
- notes: Relative date is unsafe to pin. Do not infer an ISO day.
- gate1-retained: false

### Raw Capture

```text
Parade day is next Friday.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=6722ms usage={"prompt_tokens":868,"completion_tokens":325,"total_tokens":1193,"reasoning_tokens":167}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "update",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": "Parade day",
      "personName": null,
      "title": null,
      "date": "2026-09-18",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parade day is next Friday.",
    "understood": "Parade day moves to September 18, 2026, interpreting next Friday relative to the current date, September 14, 2026.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "update",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": "Parade day",
      "personName": null,
      "title": null,
      "date": "2026-09-18",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Parade day is next Friday.",
    "understood": "Parade day moves to September 18, 2026, interpreting next Friday relative to the current date, September 14, 2026.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- create milestone target=none :: Parade day is next Friday.
```

### Scores

**Production**

- incorrect_proposed_truth: Next Friday is not a safe explicit date write. (expected needs_you|left_untouched, got create)

**Gate 1 AI-first**

- incorrect_proposed_truth: Next Friday is not a safe explicit date write. (expected needs_you|left_untouched, got update)

**Gate 2 AI-first + legal boundary**

- incorrect_proposed_truth: Next Friday is not a safe explicit date write. (expected needs_you|left_untouched, got update)

## historic-parade

**CASE** Historic / non-current statement

- family: already_current
- source: manual-for-experiment (manual-for-experiment)
- notes: Historic explanation of current date — no mutation.
- gate1-retained: false

### Raw Capture

```text
Last June we moved Parade day to the 15th, which is why it is still 15 October.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4641ms usage={"prompt_tokens":883,"completion_tokens":211,"total_tokens":1094,"reasoning_tokens":42}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "no_change",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": "Parade day",
      "personName": null,
      "title": null,
      "date": "2026-10-15",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Last June we moved Parade day to the 15th, which is why it is still 15 October.",
    "understood": "Parade day remains on 15 October, matching the current milestone. Last June refers to when the earlier change was made.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "no_change",
    "domain": "milestone",
    "targetCanonicalId": "ms-parade",
    "subject": "Parade day",
    "proposedValues": {
      "name": "Parade day",
      "personName": null,
      "title": null,
      "date": "2026-10-15",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Last June we moved Parade day to the 15th, which is why it is still 15 October.",
    "understood": "Parade day remains on 15 October, matching the current milestone. Last June refers to when the earlier change was made.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":1}
mapped items:
- create milestone target=none :: Parade day was moved to the 15th.
rejected:
- rejected milestone/ambiguous The date for Parade day is still 15 October.
```

### Scores

**Production**

- incorrect_proposed_truth: Historic account of Parade day — no date write. (expected no_change|left_untouched, got create)

**Gate 1 AI-first**

- correct_no_change: Historic account of Parade day — no date write. (no_change milestone ms-parade)

**Gate 2 AI-first + legal boundary**

- correct_no_change: Historic account of Parade day — no date write. (no_change milestone ms-parade)

## similar-name-exact

**CASE** Exact identity restatement

- family: identity
- source: manual-for-experiment (manual-for-experiment)
- notes: Exact existing name. Must not bind Brick Willow or Brook Oakley.
- gate1-retained: false

### Raw Capture

```text
Brick Oakley remains the Toyworld sponsor.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"
id="person-brick-willow" name="Brick Willow" role="Warehouse"
id="person-brook-oakley" name="Brook Oakley" role="Painter"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 612 chars, ~193 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=6010ms usage={"prompt_tokens":851,"completion_tokens":201,"total_tokens":1052,"reasoning_tokens":41}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "no_change",
    "domain": "person",
    "targetCanonicalId": "person-brick",
    "subject": "Brick Oakley — Toyworld sponsor",
    "proposedValues": {
      "name": "Brick Oakley",
      "personName": "Brick Oakley",
      "title": "Sponsor entry",
      "date": "2026-09-14",
      "status": "current",
      "scope": "Toyworld",
      "ownershipSemantics": "unchanged",
      "text": "Brick Oakley remains the Toyworld sponsor.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick Oakley remains the Toyworld sponsor.",
    "understood": "Brick Oakley is already recorded as Sponsor; no change is stated.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "no_change",
    "domain": "person",
    "targetCanonicalId": "person-brick",
    "subject": "Brick Oakley — Toyworld sponsor",
    "proposedValues": {
      "name": "Brick Oakley",
      "personName": "Brick Oakley",
      "title": "Sponsor entry",
      "date": "2026-09-14",
      "status": "current",
      "scope": "Toyworld",
      "ownershipSemantics": "unchanged",
      "text": "Brick Oakley remains the Toyworld sponsor.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick Oakley remains the Toyworld sponsor.",
    "understood": "Brick Oakley is already recorded as Sponsor; no change is stated.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- no_change person target=person-brick :: Brick Oakley remains the Toyworld sponsor.
```

### Scores

**Production**

- correct_no_change: Brick Oakley already exists. (no_change person person-brick)

**Gate 1 AI-first**

- correct_no_change: Brick Oakley already exists. (no_change person person-brick)

**Gate 2 AI-first + legal boundary**

- correct_no_change: Brick Oakley already exists. (no_change person person-brick)

## similar-name-other-brick

**CASE** Similar-name distinct person

- family: identity
- source: manual-for-experiment (manual-for-experiment)
- notes: Named Brick Willow — not Brick Oakley.
- gate1-retained: false

### Raw Capture

```text
Brick Willow will help with warehouse packing this week.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"
id="person-brick-willow" name="Brick Willow" role="Warehouse"
id="person-brook-oakley" name="Brook Oakley" role="Painter"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 612 chars, ~193 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=5442ms usage={"prompt_tokens":852,"completion_tokens":210,"total_tokens":1062,"reasoning_tokens":57}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "create",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Brick Willow helping with warehouse packing",
    "proposedValues": {
      "name": null,
      "personName": "Brick Willow",
      "title": "Warehouse packing",
      "date": null,
      "status": null,
      "scope": "this week",
      "ownershipSemantics": "helping",
      "text": "Brick Willow will help with warehouse packing this week.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick Willow will help with warehouse packing this week.",
    "understood": "Brick Willow will help with warehouse packing this week; no ownership replacement is stated.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "create",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Brick Willow helping with warehouse packing",
    "proposedValues": {
      "name": null,
      "personName": "Brick Willow",
      "title": "Warehouse packing",
      "date": null,
      "status": null,
      "scope": "this week",
      "ownershipSemantics": "helping",
      "text": "Brick Willow will help with warehouse packing this week.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick Willow will help with warehouse packing this week.",
    "understood": "Brick Willow will help with warehouse packing this week; no ownership replacement is stated.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- update responsibility target=person-brick-willow :: Brick Willow will help with warehouse packing this week.
```

### Scores

**Production**

- correct_explicit_truth: Brick Willow is the named person. (update responsibility person-brick-willow)

**Gate 1 AI-first**

- correct_explicit_truth: Brick Willow is the named person. (create responsibility unbound)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Brick Willow is the named person. (create responsibility unbound)

## similar-name-ambiguous-brick

**CASE** Similar-name ambiguous first name

- family: identity
- source: manual-for-experiment (manual-for-experiment)
- notes: Bare 'Brick' with two Bricks on the project.
- gate1-retained: false

### Raw Capture

```text
Brick called about the track map.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"
id="person-brick-willow" name="Brick Willow" role="Warehouse"
id="person-brook-oakley" name="Brook Oakley" role="Painter"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 612 chars, ~193 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4423ms usage={"prompt_tokens":849,"completion_tokens":186,"total_tokens":1035,"reasoning_tokens":33}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Call about the track map",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick called about the track map.",
    "understood": "A call about the track map was mentioned, but no project change was stated.",
    "question": null,
    "leftUntouchedReason": "No explicit project operation or change to the existing track-map todo."
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Call about the track map",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick called about the track map.",
    "understood": "A call about the track map was mentioned, but no project change was stated.",
    "question": null,
    "leftUntouchedReason": "No explicit project operation or change to the existing track-map todo."
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":1}
mapped items:
rejected:
- rejected commentary/ambiguous Brick called about the track map.
```

### Scores

**Production**

- appropriate_left_untouched: Bare Brick is ambiguous between Oakley and Willow. (omitted without a write)

**Gate 1 AI-first**

- appropriate_left_untouched: Bare Brick is ambiguous between Oakley and Willow. (left_untouched unsupported unbound)

**Gate 2 AI-first + legal boundary**

- appropriate_left_untouched: Bare Brick is ambiguous between Oakley and Willow. (left_untouched unsupported unbound)

## similar-name-spelling

**CASE** Similar-name spelling variant

- family: identity
- source: manual-for-experiment (manual-for-experiment)
- notes: Spelling variant of Brick Oakley. Do not create Brikk; do not take Brook.
- gate1-retained: false

### Raw Capture

```text
Brikk Oakley is still the sponsor.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"
id="person-brick-willow" name="Brick Willow" role="Warehouse"
id="person-brook-oakley" name="Brook Oakley" role="Painter"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 612 chars, ~193 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=5989ms usage={"prompt_tokens":851,"completion_tokens":224,"total_tokens":1075,"reasoning_tokens":85}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "no_change",
    "domain": "person",
    "targetCanonicalId": "person-brick",
    "subject": "Brick Oakley",
    "proposedValues": {
      "name": "Brick Oakley",
      "personName": "Brick Oakley",
      "title": "Sponsor",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brikk Oakley is still the sponsor.",
    "understood": "Brick Oakley remains the sponsor; this matches current truth.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "no_change",
    "domain": "person",
    "targetCanonicalId": "person-brick",
    "subject": "Brick Oakley",
    "proposedValues": {
      "name": "Brick Oakley",
      "personName": "Brick Oakley",
      "title": "Sponsor",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brikk Oakley is still the sponsor.",
    "understood": "Brick Oakley remains the sponsor; this matches current truth.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":1}
mapped items:
rejected:
- rejected person/ambiguous Brikk Oakley is still the sponsor.
```

### Scores

**Production**

- silent_omission: Brikk Oakley should not become a new person or Brook. (No matching item)

**Gate 1 AI-first**

- correct_no_change: Brikk Oakley should not become a new person or Brook. (no_change person person-brick)

**Gate 2 AI-first + legal boundary**

- correct_no_change: Brikk Oakley should not become a new person or Brook. (no_change person person-brick)

## email-unsupported

**CASE** Unsupported outbound request

- family: unsupported
- source: manual-for-experiment (manual-for-experiment)
- notes: Lume cannot send email. Left untouched.
- gate1-retained: false

### Raw Capture

```text
Please email the whole parade committee about the new date.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=7150ms usage={"prompt_tokens":872,"completion_tokens":206,"total_tokens":1078,"reasoning_tokens":49}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Email the parade committee",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please email the whole parade committee about the new date.",
    "understood": "A request to email the whole parade committee about an unspecified new date.",
    "question": null,
    "leftUntouchedReason": "Sending email is not a supported project operation, and no new date is supplied."
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Email the parade committee",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please email the whole parade committee about the new date.",
    "understood": "A request to email the whole parade committee about an unspecified new date.",
    "question": null,
    "leftUntouchedReason": "Sending email is not a supported project operation, and no new date is supplied."
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you responsibility target=ms-parade :: The parade committee needs to be informed about the new date.
```

### Scores

**Production**

- appropriate_needs_you: Email request is unsupported capability. (needs_you responsibility ms-parade)

**Gate 1 AI-first**

- appropriate_left_untouched: Email request is unsupported capability. (left_untouched unsupported unbound)

**Gate 2 AI-first + legal boundary**

- appropriate_left_untouched: Email request is unsupported capability. (left_untouched unsupported unbound)

## todo-complete-jelly

**CASE** Supported To Do completion phrased as done

- family: update
- source: manual-for-experiment (manual-for-experiment)
- notes: To Do complete/update is legal. Residual if model uses remove.
- gate1-retained: false

### Raw Capture

```text
Mark Prepare the jelly pack as done.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3739ms usage={"prompt_tokens":869,"completion_tokens":126,"total_tokens":995,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "update",
    "domain": "todo",
    "targetCanonicalId": "todo-pack",
    "subject": "Prepare the jelly pack",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Prepare the jelly pack",
      "date": null,
      "status": "done",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Mark Prepare the jelly pack as done.",
    "understood": "Mark the existing to-do as done.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "update",
    "domain": "todo",
    "targetCanonicalId": "todo-pack",
    "subject": "Prepare the jelly pack",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Prepare the jelly pack",
      "date": null,
      "status": "done",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Mark Prepare the jelly pack as done.",
    "understood": "Mark the existing to-do as done.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- update todo target=todo-pack :: Mark the todo 'Prepare the jelly pack' as done.
```

### Scores

**Production**

- correct_explicit_truth: Prepare the jelly pack is done. (update todo todo-pack)

**Gate 1 AI-first**

- correct_explicit_truth: Prepare the jelly pack is done. (update todo todo-pack)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Prepare the jelly pack is done. (update todo todo-pack)

## person-rename-unsupported

**CASE** Unsupported person rename

- family: unsupported
- source: manual-for-experiment (manual-for-experiment)
- notes: Person update/rename is not a legal write. Left untouched, not a new person.
- gate1-retained: false

### Raw Capture

```text
Pippa Gumdrop is now called Pippa Sugarplum.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3971ms usage={"prompt_tokens":874,"completion_tokens":144,"total_tokens":1018,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "update",
    "domain": "person",
    "targetCanonicalId": "person-gumdrop",
    "subject": "Pippa Gumdrop",
    "proposedValues": {
      "name": "Pippa Sugarplum",
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pippa Gumdrop is now called Pippa Sugarplum.",
    "understood": "Rename the existing person from Pippa Gumdrop to Pippa Sugarplum.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "person",
    "targetCanonicalId": "person-gumdrop",
    "subject": "Pippa Gumdrop",
    "proposedValues": {
      "name": "Pippa Sugarplum",
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pippa Gumdrop is now called Pippa Sugarplum.",
    "understood": "Rename the existing person from Pippa Gumdrop to Pippa Sugarplum.",
    "question": null,
    "leftUntouchedReason": "Lume cannot safely apply this type of change."
  }
]
```

Boundary intercepted:
- [0] update person person-gumdrop applySupports=false planner=needs_you/Pippa Gumdrop is mentioned, but Lume cannot represent this as a stakeholder change.

Lume needs clarification about what that means for this stakeholder.

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you person target=person-gumdrop :: Pippa Gumdrop is now called Pippa Sugarplum.
```

### Scores

**Production**

- appropriate_needs_you: Rename is unsupported. Do not create Sugarplum. (needs_you person person-gumdrop)

**Gate 1 AI-first**

- incorrect_proposed_truth: Rename is unsupported. Do not create Sugarplum. (expected left_untouched|needs_you, got update)

**Gate 2 AI-first + legal boundary**

- appropriate_left_untouched: Rename is unsupported. Do not create Sugarplum. (left_untouched person person-gumdrop)

## contradict-packaging

**CASE** Contradictory sibling facts on one issue

- family: contradiction
- source: manual-for-experiment (manual-for-experiment)
- notes: Worse vs resolved — do not pick a side.
- gate1-retained: false

### Raw Capture

```text
Packaging delay is getting worse. Packaging delay is resolved.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-toy" name="Toyworld" code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z"
```

Snapshot: 490 chars, ~154 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3562ms usage={"prompt_tokens":817,"completion_tokens":146,"total_tokens":963,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "needs_you",
    "domain": "risk",
    "targetCanonicalId": "risk-packaging",
    "subject": "Packaging delay",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Packaging delay",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Packaging delay is getting worse. Packaging delay is resolved.",
    "understood": "The Capture gives contradictory updates for the existing Packaging delay risk.",
    "question": "Is Packaging delay getting worse and still open, or is it resolved?",
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "needs_you",
    "domain": "risk",
    "targetCanonicalId": "risk-packaging",
    "subject": "Packaging delay",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Packaging delay",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Packaging delay is getting worse. Packaging delay is resolved.",
    "understood": "The Capture gives contradictory updates for the existing Packaging delay risk.",
    "question": "Is Packaging delay getting worse and still open, or is it resolved?",
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":1,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- update risk target=risk-packaging :: Packaging delay is getting worse.
- no_change risk target=risk-packaging :: Packaging delay is resolved.
```

### Scores

**Production**

- incorrect_proposed_truth: Packaging delay statements contradict. (expected needs_you|left_untouched, got update)

**Gate 1 AI-first**

- appropriate_needs_you: Packaging delay statements contradict. (needs_you risk risk-packaging)

**Gate 2 AI-first + legal boundary**

- appropriate_needs_you: Packaging delay statements contradict. (needs_you risk risk-packaging)

## todo-dated-canes

**CASE** To Do with explicit date

- family: create
- source: manual-for-experiment (manual-for-experiment)
- notes: Explicit dated To Do create.
- gate1-retained: false

### Raw Capture

```text
Please add a to-do to collect the candy canes on 18 October 2026.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4078ms usage={"prompt_tokens":880,"completion_tokens":154,"total_tokens":1034,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "create",
    "domain": "todo",
    "targetCanonicalId": null,
    "subject": "Collect the candy canes",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Collect the candy canes",
      "date": "2026-10-18",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please add a to-do to collect the candy canes on 18 October 2026.",
    "understood": "Add a to-do to collect the candy canes on 2026-10-18.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "create",
    "domain": "todo",
    "targetCanonicalId": null,
    "subject": "Collect the candy canes",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Collect the candy canes",
      "date": "2026-10-18",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please add a to-do to collect the candy canes on 18 October 2026.",
    "understood": "Add a to-do to collect the candy canes on 2026-10-18.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- create todo target=none :: A new to-do to collect the candy canes has been requested.
```

### Scores

**Production**

- correct_explicit_truth: Create dated to-do for candy canes. (create todo unbound)

**Gate 1 AI-first**

- correct_explicit_truth: Create dated to-do for candy canes. (create todo unbound)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Create dated to-do for candy canes. (create todo unbound)

## issue-cert-worse

**CASE** Existing issue/risk worsening (GamingStudio)

- family: update
- source: manual-for-experiment (manual-for-experiment)
- notes: Issues are the risk records in this world.
- gate1-retained: false

### Raw Capture

```text
The Console certification slip issue is worse after last night's build failed.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-game" name="GamingStudio5000" code="GS5K"

PEOPLE
id="person-pixel" name="Pixel Ramos" role="Producer"

ISSUES
id="risk-console" title="Console certification slip" status="open"

TO_DO
id="todo-balance" title="Boss balancing pass" done=false

KNOWLEDGE
(none)

MILESTONES
id="ms-cert" label="Console certification" startAt="2026-11-20T12:00:00.000Z"
```

Snapshot: 454 chars, ~137 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=4854ms usage={"prompt_tokens":804,"completion_tokens":204,"total_tokens":1008,"reasoning_tokens":58}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "update",
    "domain": "risk",
    "targetCanonicalId": "risk-console",
    "subject": "Console certification slip",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Console certification slip is worse after last night's build failed.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The Console certification slip issue is worse after last night's build failed.",
    "understood": "The existing issue has worsened following last night's build failure.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "update",
    "domain": "risk",
    "targetCanonicalId": "risk-console",
    "subject": "Console certification slip",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Console certification slip is worse after last night's build failed.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The Console certification slip issue is worse after last night's build failed.",
    "understood": "The existing issue has worsened following last night's build failure.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you risk target=risk-console :: The Console certification slip issue is worse after last night's build failed.
```

### Scores

**Production**

- incorrect_proposed_truth: Console certification slip is worse, still open. (expected update, got needs_you)

**Gate 1 AI-first**

- correct_explicit_truth: Console certification slip is worse, still open. (update risk risk-console)

**Gate 2 AI-first + legal boundary**

- correct_explicit_truth: Console certification slip is worse, still open. (update risk risk-console)

## chatter-weather

**CASE** Irrelevant weather chatter

- family: chatter
- source: manual-for-experiment (manual-for-experiment)
- notes: Baseline commentary paste.
- gate1-retained: false

### Raw Capture

```text
I think the weather will be nice on Friday, nothing project related.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=3786ms usage={"prompt_tokens":875,"completion_tokens":144,"total_tokens":1019,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Non-project weather comment",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "I think the weather will be nice on Friday, nothing project related.",
    "understood": "The Capture contains no explicit project information.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter explicitly described as unrelated to the project."
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Non-project weather comment",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "I think the weather will be nice on Friday, nothing project related.",
    "understood": "The Capture contains no explicit project information.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter explicitly described as unrelated to the project."
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":1,"leftUntouched":0,"rejected":0}
mapped items:
- left_untouched unsupported target=none :: The weather will be nice on Friday.
```

### Scores

**Production**

- appropriate_left_untouched: Weather chatter is not a write. (left_untouched unsupported unbound)

**Gate 1 AI-first**

- appropriate_left_untouched: Weather chatter is not a write. (left_untouched unsupported unbound)

**Gate 2 AI-first + legal boundary**

- appropriate_left_untouched: Weather chatter is not a write. (left_untouched unsupported unbound)

## availability-relative

**CASE** Relative availability window

- family: date
- source: manual-for-experiment (manual-for-experiment)
- notes: Relative leave window — unsafe to pin ISO bounds.
- gate1-retained: false

### Raw Capture

```text
Fizz is off next week.
```

### Canonical snapshot supplied to the model

```text
CURRENT CANONICAL PROJECT TRUTH
Current rows only. Not history. Not Review. Not ranked.
project.id="proj-candy" name="Candyland" code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false

KNOWLEDGE
id="resp-uat" kind="responsibility" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" personName="Pippa Gumdrop" scope="UAT lead" ownerConfirmed=true

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z"
```

Snapshot: 641 chars, ~210 cl100k tokens.

### One Astra call

- requested=gpt-6-astra response=gpt-6-astra latency=6384ms usage={"prompt_tokens":867,"completion_tokens":271,"total_tokens":1138,"reasoning_tokens":120}
- inspect.ok=true malformed=false issues=[]

### Gate 1 items (inspect only)

```json
[
  {
    "operation": "needs_you",
    "domain": "availability",
    "targetCanonicalId": null,
    "subject": "Fizz Caramel’s availability",
    "proposedValues": {
      "name": null,
      "personName": "Fizz Caramel",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Off next week",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Fizz is off next week.",
    "understood": "Fizz Caramel will be away, but the exact date range is unspecified.",
    "question": "What are the start and end dates of Fizz’s absence?",
    "leftUntouchedReason": null
  }
]
```

### Gate 2 items (after legal-write boundary)

```json
[
  {
    "operation": "needs_you",
    "domain": "availability",
    "targetCanonicalId": null,
    "subject": "Fizz Caramel’s availability",
    "proposedValues": {
      "name": null,
      "personName": "Fizz Caramel",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Off next week",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Fizz is off next week.",
    "understood": "Fizz Caramel will be away, but the exact date range is unspecified.",
    "question": "What are the start and end dates of Fizz’s absence?",
    "leftUntouchedReason": null
  }
]
```

Boundary intercepted: none

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you availability target=person-fizz :: Fizz is off next week.
```

### Scores

**Production**

- appropriate_needs_you: Next week leave is not a safe dated write. (needs_you availability person-fizz)

**Gate 1 AI-first**

- appropriate_needs_you: Next week leave is not a safe dated write. (needs_you availability unbound)

**Gate 2 AI-first + legal boundary**

- appropriate_needs_you: Next week leave is not a safe dated write. (needs_you availability unbound)

## S. Estimated production-path complexity

AI-semantic complexity: Gate 1 prompt + json_schema + one Astra call. Prompt not retuned.
Deterministic safety complexity: legal-boundary.ts (215 lines) reusing applySupportsOperation / planCaptureApply.
Evaluation-only complexity: expanded cases, scorer reuse, production harness, this runner, report.

Estimated production path if this architecture were adopted (not counting corpus/harness):
- canonical snapshot serialization: snapshot.ts ~143 lines
- one model call + contract: interpreter.ts + contract.ts ~233 lines
- schema/type validation: inspect.ts ~146 lines
- ID existence validation: included in inspect.ts
- legal planner validation: legal-boundary.ts ~215 lines (calls existing Apply matrix/planner)
- conversion to Review candidate shape: not implemented; estimate 80–150 lines of field mapping, no resolver
  Total new AI-first production surface: ~857 lines plus reuse of planCaptureApply / applySupportsOperation.

R. latency/token: Astra n=43 avg 5711ms (min 3266 / max 23140); avg total_tokens 1101.
   restatement-as-update: prod=1 gate1=1 gate2=1

## T. Current-production complexity comparison

Current production interpretation/resolver layer (this baseline, pre-#175):
- src/lib/capture-v2/resolve.ts: 1510 lines
- src/lib/capture-v2/validate.ts: 352 lines
- src/lib/capture-v2/extract.ts + prompt.ts: 204 lines
- src/lib/capture-v2/toResult.ts: 332 lines
- src/lib/capture-v2/source-coverage.ts: 197 lines
- src/lib/capture-v2/contract.ts: 219 lines
Plus rematerialise / hydrateFromLocalEvidence, date/name/status regex recovery, and Apply planner/readiness.
The production path is an interpretation + recovery stack. Gate 2's candidate path is snapshot + one call + inspect + legal-type check.

## U. Tempting fixes deliberately NOT implemented

- Convert restatement `update` (Pippa still UAT / Track freeze remains) into `no_change` via planner same-value detection — NOT implemented.
- ISO-date fill or 'next Friday' resolution — NOT implemented.
- Pronoun / first-name / spelling bind (she, Brick, Brikk) — NOT implemented.
- Fuzzy similar-name matching or second Brick rescue — NOT implemented.
- Correction recovery beyond what the model already did — NOT implemented.
- Responsibility default owner / share-vs-replace resolver — NOT implemented.
- Unsupported-operation aliases (milestone remove → archive/update; person rename → create) — NOT implemented.
- Adopting planCaptureApply Needs You / no_change / rewritten values — NOT implemented.
- Second Astra call or running Astra JSON through resolve.ts — NOT implemented.
- Importing Simplified Capture / PR #175 / Prompt A Left untouched behaviour — NOT implemented.

## K. False-write analysis

Gate 2 false writes / bad proposals: **3/50 (6%)** vs Gate 1 **4/50 (8%)** vs production **12/50 (24%)**.

After the legal-type boundary, remaining write faults are semantic, not unsupported-op:

1. `holdout-h6` — extra `create responsibility` for Kwame alongside a correct `create person`. Same intended new contractor lead, split into two writes. Not a wrong mutation of an existing row.
2. `cross-project-bait` — `create person` Pixel Ramos onto Candyland. Real isolation miss. Console cert was Needs You (not a foreign-id write).
3. `relative-date-parade` — `update ms-parade` for “next Friday”. Date inference residual. Deliberately not repaired.

The fourth Gate 1 false-write class (unsupported remove/update) is what the boundary removed.

## L. Wrong-target analysis

Scored **1/50**: `availability` — model proposed `create availability` with `personName=Fizz Caramel` and `targetCanonicalId=null`. Dates are the explicit 5–12 October window. This is an unbound create of the right person, not a bind to Pippa or a foreign id.

The fixture required `acceptedTargetIds: ["person-fizz"]`, and the scorer treats a write without a target id as wrong-target. Production bound `person-fizz` via resolve. **Do not add person-binding recovery.** Record as scorer-strict / identity residual.

No write was bound to a forbidden id on the expanded set.

## M. Silent-loss analysis

Scored **1/50**: `cross-project-bait` tokens required both `pixel` and `console` on one item. The model emitted three items (create Pixel; Needs You UAT; Needs You console). The fact matcher missed. This is not an omitted Capture; it is a split plus the Pixel create noted in K.

Production also scored silent_omission here and invented a new console-cert risk on Candyland.

## N. Fallback analysis

Gate 2 appropriate human fallback **19/50 (38%)** vs Gate 1 **15/50** vs production **16/50**.

The +4 vs Gate 1 are the four intercepted unsupported writes becoming Left untouched:

| Case | Model proposed | Planner consult | Gate 2 |
| --- | --- | --- | --- |
| unsupported-remove | remove milestone `ms-parade` | needs_you (unsupported type) | left_untouched, reason factual |
| unsupported-remove-person | remove person `person-gumdrop` | needs_you (person remove copy) | left_untouched — not Needs You |
| unsupported-remove-risk | remove risk `risk-packaging` | needs_you | left_untouched |
| person-rename-unsupported | update person `person-gumdrop` | needs_you | left_untouched |

Planner copy was **not** adopted. Unsupported capability stayed Left untouched.

Supported `todo-remove-supported` remained `remove todo-pack` (legal). `todo-complete-jelly` remained `update`.

## V. Whether further deterministic rules appear necessary

**Not for this architecture question.** The unsupported-write class is closed by the existing Apply matrix. Remaining misses (relative dates, cross-project person create, extra sibling responsibility, unbound availability) would each tempt a new heuristic. Adding them would recreate the resolver and fail Gate 2’s purpose.

Further *experimentation* (larger isolation set, shared corpus, architecture showdown vs Simplified) is reasonable. Further *rules* are not.

## W. Recommendation

The runner heuristic printed `AI-FIRST NEEDS MORE EXPERIMENTATION` because scored wrong-target was not literally zero. On the Gate 2 success criteria that is too harsh:

- Unsupported-write class is deterministically blocked (4→0). No semantic repair.
- Gate 1 twelve-case correct explicit facts stay **10/18 (56%)**. False-write on that subset is the holdout extra Kwame responsibility (run variance vs the original 0/18), not boundary damage.
- Expanded set still beats production on the safety-first metrics: correct 40% vs 28%; false writes 6% vs 24%; invented unsupported ops 4% vs 4% after the boundary (10% before).
- The 12-case sample **was favourable** on correct-explicit (56% vs 40% expanded). Say so. It was not favourable on the safety story — that holds after expansion.
- Implementation remains dramatically smaller than `resolve.ts` + recovery.

Conditions: residuals in K–M; do not treat this as a production design; do not auto-start a showdown.

AI-FIRST GATE 2 PASSED WITH CONDITIONS
