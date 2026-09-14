# AI-first Capture Gate 1 v2 report

Disposable experiment from current origin/main. Not mergeable. Rescue pipeline bypassed on the AI-first path.

A. branch `experiment/ai-first-capture-gate1-v2` base/origin/main `92d61d13c4407d04a8e20960e7eb38efa0b103c3` HEAD `4ac57b10ff7a72f88309c1f7b2b48a6c008ed959`
E. one semantic AI call per case: YES (requested gpt-6-astra)
F. rematerialise / hydrateFromLocalEvidence / regex recovery / resolve.ts: NOT used on AI-first output

## I. Aggregate

| Metric | AI-first | Production |
| --- | --- | --- |
| Correct explicit facts | 10/18 (56%) | 7/18 (39%) |
| False writes / bad proposals | 0/18 (0%) | 4/18 (22%) |
| Wrong-target | 0/18 (0%) | 0/18 (0%) |
| Silent loss | 0/18 (0%) | 0/18 (0%) |
| Appropriate human fallback | 5/18 (28%) | 5/18 (28%) |
| Correct no-change | 2/18 (11%) | 2/18 (11%) |
| Invented / unsupported ops | 1/18 (6%) | 0/18 (0%) |
| Malformed cases | 0/12 (0%) | 0/12 (0%) |

## create-velvet

**CASE** Obvious create — new person

- family: create
- source: corpus new-person (corpus)
- notes: Velvet Sprocket is a new person on Toyworld.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=8890ms usage={"prompt_tokens":822,"completion_tokens":323,"total_tokens":1145,"reasoning_tokens":154}
- inspect.ok=true malformed=false issues=[]

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
      "scope": "wooden-track refresh",
      "ownershipSemantics": null,
      "text": "Joining as paint lead for the wooden-track refresh.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "understood": "Velvet Sprocket is a new project person joining as paint lead for the wooden-track refresh.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- create person target=none :: Velvet Sprocket is joining as paint lead for the wooden-track refresh.
- needs_you responsibility target=none :: Velvet Sprocket is joining as paint lead for the wooden-track refresh.
```

### Comparison

**AI-first score**

- correct_explicit_truth: Velvet Sprocket is a new paint lead. (create person unbound)

**Production score**

- correct_explicit_truth: Velvet Sprocket is a new paint lead. (create person unbound)

## update-packaging

**CASE** Obvious update — existing risk worse

- family: update
- source: corpus existing-risk-update (corpus)
- notes: Existing Packaging delay risk is worsening, still open.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=4346ms usage={"prompt_tokens":817,"completion_tokens":185,"total_tokens":1002,"reasoning_tokens":40}
- inspect.ok=true malformed=false issues=[]

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
    "understood": "The existing Packaging delay risk is worsening after the cardboard mill flooded.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you risk target=risk-packaging :: Packaging delay is getting worse.
```

### Comparison

**AI-first score**

- correct_explicit_truth: Packaging delay is worsening and still open. (update risk risk-packaging)

**Production score**

- incorrect_proposed_truth: Packaging delay is worsening and still open. (expected update, got needs_you)

## nochange-pippa

**CASE** Already-current truth / named identity

- family: already_current
- source: corpus existing-person (corpus)
- notes: Pippa Gumdrop is already on Candyland; do not create a second person.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=5154ms usage={"prompt_tokens":878,"completion_tokens":226,"total_tokens":1104,"reasoning_tokens":46}
- inspect.ok=true malformed=false issues=[]

```json
[
  {
    "operation": "update",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "Pippa Gumdrop’s UAT responsibility",
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
    "understood": "Pippa remains the UAT lead; the Capture specifies the scope as the licorice stands.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- no_change responsibility target=person-gumdrop :: Pippa Gumdrop is still the UAT lead for the licorice stands.
```

### Comparison

**AI-first score**

- correct_explicit_truth: Pippa remains UAT lead — no second person. (update responsibility resp-uat)

**Production score**

- correct_no_change: Pippa remains UAT lead — no second person. (no_change responsibility person-gumdrop)

## pronoun-she

**CASE** Pronoun with no named subject

- family: pronoun
- source: corpus pronoun-ambiguity (corpus)
- notes: The speaker did not name who 'she' is.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=3936ms usage={"prompt_tokens":804,"completion_tokens":155,"total_tokens":959,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

```json
[
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Ownership of the boss balancing pass",
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
    "understood": "The Capture assigns ownership of the existing boss balancing pass, but does not identify who “she” is.",
    "question": "Who does “she” refer to?",
    "leftUntouchedReason": null
  }
]
```

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you responsibility target=todo-balance :: Pixel Ramos will own the boss balancing pass from now on.
```

### Comparison

**AI-first score**

- appropriate_needs_you: 'She' is unnamed — must not assign Pixel Ramos. (needs_you responsibility unbound)

**Production score**

- appropriate_needs_you: 'She' is unnamed — must not assign Pixel Ramos. (needs_you responsibility todo-balance)

## date-parade

**CASE** Explicit date move

- family: date
- source: corpus milestone-move (corpus)
- notes: Parade day moves to 29 October 2026.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=4338ms usage={"prompt_tokens":873,"completion_tokens":146,"total_tokens":1019,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

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

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- create milestone target=none :: Parade day is now 29 October 2026.
```

### Comparison

**AI-first score**

- correct_explicit_truth: Parade day moves to 29 October 2026. (update milestone ms-parade)

**Production score**

- incorrect_proposed_truth: Parade day moves to 29 October 2026. (expected update, got create)

## correction-audio

**CASE** Spoken correction

- family: correction
- source: corpus correction-of-wording (corpus)
- notes: The intended new risk is the audio bus mixer, after a spoken correction.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=5970ms usage={"prompt_tokens":814,"completion_tokens":266,"total_tokens":1080,"reasoning_tokens":98}
- inspect.ok=true malformed=false issues=[]

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
    "understood": "The corrected blocker is the audio bus mixer, not shader compilation.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":1,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":1,"rejected":0}
mapped items:
- create risk target=none :: The audio bus mixer is stalling the cert build.
- left_untouched unsupported target=none :: The shader compile is stalling the cert build. Wait —
```

### Comparison

**AI-first score**

- correct_explicit_truth: Intended new risk is the audio bus mixer. (create risk unbound)

**Production score**

- correct_explicit_truth: Intended new risk is the audio bus mixer. (create risk unbound)

## contradict-parade

**CASE** Contradictory dates for the same milestone

- family: contradiction
- source: manual-for-experiment (manual-for-experiment)
- notes: Experiment-inferred: two incompatible dates for ms-parade. Must Needs You or Left untouched, not pick a date.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=4217ms usage={"prompt_tokens":886,"completion_tokens":181,"total_tokens":1067,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

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

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":1,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- update milestone target=ms-parade :: Parade day is now 29 October 2026.
- no_change milestone target=ms-parade :: Keep Parade day on 15 October 2026.
```

### Comparison

**AI-first score**

- appropriate_needs_you: Parade day dates contradict — do not write a chosen date. (needs_you milestone ms-parade)

**Production score**

- incorrect_proposed_truth: Parade day dates contradict — do not write a chosen date. (expected needs_you|left_untouched, got update)

## ambiguous-share

**CASE** Ambiguous share vs replace

- family: ambiguous
- source: corpus share-vs-replace-ambiguous (corpus)
- notes: UAT ownership between Fizz and Pippa is genuinely ambiguous.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=4607ms usage={"prompt_tokens":886,"completion_tokens":179,"total_tokens":1065,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

```json
[
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": "resp-uat",
    "subject": "UAT lead ownership",
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
    "understood": "A possible UAT ownership change is described, but replacement versus shared ownership is unresolved.",
    "question": "Should Fizz Caramel replace Pippa Gumdrop as UAT lead, or share UAT ownership with her?",
    "leftUntouchedReason": null
  }
]
```

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":2,"commentary":0,"leftUntouched":0,"rejected":0}
mapped items:
- needs_you responsibility target=person-fizz :: Fizz Caramel might take UAT from Pippa Gumdrop.
- needs_you responsibility target=person-gumdrop :: Fizz Caramel and Pippa Gumdrop might share UAT.
```

### Comparison

**AI-first score**

- appropriate_needs_you: UAT share vs replace is undecided. (needs_you responsibility resp-uat)

**Production score**

- appropriate_needs_you: UAT share vs replace is undecided. (needs_you responsibility person-fizz)

## unsupported-remove

**CASE** Unsupported milestone removal

- family: unsupported
- source: manual-for-experiment (manual-for-experiment)
- notes: Experiment-inferred from Capture status product-model gap: milestone cancel/remove is not a legal write. Left untouched or Needs You. A remove proposal is recorded but must not be treated as an Apply-ready success.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=5925ms usage={"prompt_tokens":869,"completion_tokens":169,"total_tokens":1038,"reasoning_tokens":34}
- inspect.ok=true malformed=false issues=[]

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
      "title": null,
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

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":1}
mapped items:
rejected:
- rejected milestone/ambiguous Delete Parade day from the plan.
```

### Comparison

**AI-first score**

- unsupported_invented_operation: Milestone delete is unsupported — fallback, do not silently write. (expected left_untouched|needs_you, got remove)

**Production score**

- appropriate_left_untouched: Milestone delete is unsupported — fallback, do not silently write. (omitted without a write)

## mixed-three

**CASE** Mixed independent facts

- family: mixed
- source: corpus mixed-domains (corpus)
- notes: Pippa remains UAT lead. Parade day moves to 22 October 2026. New risk: chocolate fountain pump overheating.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=6100ms usage={"prompt_tokens":888,"completion_tokens":388,"total_tokens":1276,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

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
    "understood": "Pippa Gumdrop continues as UAT lead, matching current truth.",
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
    "understood": "Parade day moves from 15 October 2026 to 22 October 2026.",
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
    "understood": "A concrete issue is reported: the chocolate fountain pump is overheating.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

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

### Comparison

**AI-first score**

- correct_no_change: Pippa remains UAT lead. (no_change responsibility resp-uat)
- correct_explicit_truth: Parade day moves to 22 October 2026. (update milestone ms-parade)
- correct_explicit_truth: New fountain-pump overheating risk. (create risk unbound)

**Production score**

- correct_no_change: Pippa remains UAT lead. (no_change person person-gumdrop)
- correct_explicit_truth: Parade day moves to 22 October 2026. (update milestone ms-parade)
- correct_explicit_truth: New fountain-pump overheating risk. (create risk unbound)

## chatter

**CASE** Vague / irrelevant chatter

- family: chatter
- source: corpus irrelevant-commentary (corpus)
- notes: Lobby chiptunes are not certification work.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=4108ms usage={"prompt_tokens":808,"completion_tokens":150,"total_tokens":958,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Lobby chiptunes",
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
    "understood": "The Capture describes lobby noise and explicitly provides no certification sprint information.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter with no explicit project change."
  }
]
```

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":2,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":0,"commentary":2,"leftUntouched":0,"rejected":0}
mapped items:
- left_untouched unsupported target=none :: The lobby cabinets were blasting chiptunes all morning.
- left_untouched unsupported target=none :: Nothing about the certification sprint was mentioned.
```

### Comparison

**AI-first score**

- appropriate_left_untouched: Irrelevant chatter must not become a write. (left_untouched unsupported unbound)

**Production score**

- appropriate_left_untouched: Irrelevant chatter must not become a write. (left_untouched unsupported unbound)

## holdout-h6

**CASE** Known challenge — holdout H6 messy paste

- family: known_challenge
- source: e2e-hosted-holdout H6_MESSY_OPS_PASTE (holdout)
- notes: Holdout expected: workshop 22 Oct update; void keys create; Kwame create or Needs You; policy already-known; plants/biscuits not truth; DHP speculation Needs You / omitted.

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

### AI-first (one call, rescue bypassed)

- requested=gpt-6-astra response=gpt-6-astra latency=16864ms usage={"prompt_tokens":1081,"completion_tokens":1269,"total_tokens":2350,"reasoning_tokens":0}
- inspect.ok=true malformed=false issues=[]

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Biscuit chatter",
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
    "evidence": "ignore the bit about whose turn it is to bring biscuits.",
    "understood": "This is irrelevant chatter and an explicit instruction to ignore it.",
    "question": null,
    "leftUntouchedReason": "Not project information."
  },
  {
    "operation": "update",
    "domain": "milestone",
    "targetCanonicalId": "ms-workshop",
    "subject": "Mobilisation workshop",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Mobilisation workshop",
      "date": "2026-10-22",
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "22/10/2026 is the new mobilisation workshop date (was 8 Oct).",
    "understood": "The existing mobilisation workshop moves from 8 October to 22 October 2026.",
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
    "understood": "The office-plant note is parked and explicitly described as not a control.",
    "question": null,
    "leftUntouchedReason": "No explicit project operation."
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
    "understood": "Priya taking DHP is explicitly speculative, not an assignment.",
    "question": null,
    "leftUntouchedReason": "Speculation does not establish current responsibility."
  },
  {
    "operation": "create",
    "domain": "person",
    "targetCanonicalId": null,
    "subject": "Kwame Boateng",
    "proposedValues": {
      "name": "Kwame Boateng",
      "personName": null,
      "title": "contractor lead",
      "date": null,
      "status": null,
      "scope": "Harbour",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Kwame Boateng is the contractor lead for Harbour.",
    "understood": "Kwame Boateng is a new project person identified as contractor lead for Harbour.",
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
      "status": "open",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Void keys still need collecting from the depot on 16 Oct 2026.",
    "understood": "Void keys need collecting from the depot on 16 October 2026. No owner is stated.",
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
    "understood": "The Capture restates that repairs policy v3 remains current.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

### Production (Prompt A + resolve with rematerialise/hydrate)

Production Prompt A extract (gpt-4o-mini-2024-07-18) + current resolve (hydrate/rematerialise ON)

```text
requested=gpt-4o-mini-2024-07-18 response=gpt-4o-mini-2024-07-18 fallback=false
account={"total":7,"proposedChanges":3,"alreadyKnown":0,"merged":0,"needsYou":2,"commentary":0,"leftUntouched":2,"rejected":0}
mapped items:
- update milestone target=ms-workshop :: The new mobilisation workshop date is 22/10/2026.
- create person target=none :: Kwame Boateng is the contractor lead for Harbour.
- create todo target=none :: Void keys need collecting from the depot on 16 Oct 2026.
- needs_you knowledge target=none :: Elena said the repairs policy v3 remains current.
- needs_you risk target=none :: Tomos mentioned Priya might take DHP if housing insist.
- left_untouched unsupported target=none :: From: housing ops Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.
- left_untouched unsupported target=none :: Parking: the office plants need watering; not a control.
```

### Comparison

**AI-first score**

- correct_explicit_truth: Workshop moves to 22 October 2026. (update milestone ms-workshop)
- correct_explicit_truth: Collect void keys 16 Oct — new dated action. (create todo unbound)
- correct_explicit_truth: Kwame Boateng is a new contractor lead. (create person unbound)
- correct_no_change: Policy v3 remains current. (no_change knowledge know-policy-v3)
- appropriate_left_untouched: DHP ownership is speculation. (left_untouched responsibility unbound)

**Production score**

- correct_explicit_truth: Workshop moves to 22 October 2026. (update milestone ms-workshop)
- correct_explicit_truth: Collect void keys 16 Oct — new dated action. (create todo unbound)
- correct_explicit_truth: Kwame Boateng is a new contractor lead. (create person unbound)
- incorrect_proposed_truth: Policy v3 remains current. (expected no_change, got needs_you)
- appropriate_needs_you: DHP ownership is speculation. (needs_you risk unbound)

## P. Implementation complexity

AI-first path files: snapshot, contract/schema, one-call interpreter, inspect (parse/enum/id-exists), cases, scorer, report.
No rematerialise, hydrate, date regex, name recovery, or resolve.ts on the AI-first path.
Production comparison reuses extractObservationsWithOpenAI + runCaptureV2FromModelJson unchanged.
Prompt/schema is a small operation enum plus proposedValues. Preprocessing: none. Postprocessing: inspect only.
Special cases live in the case list expectations, not in hidden resolver code.

## Q. Rescue logic deliberately not added

- Accept resp-uat vs person-gumdrop by rewriting ids — listed as acceptedTargetIds in fixtures only, not rewritten on model output.
- ISO-date regex fill when the model left date blank — not added.
- Binding 'Brick' or 'she' to the only plausible person — not added.
- Running Astra JSON through resolve.ts to mint Review cards — not added.
- Second call to verify or repair — not added.
- Importing Prompt A Phase 1 / Simplified Capture — not added.

## R. Assessment

AI-FIRST PROMISING WITH CONDITIONS

Write faults=1 silent loss=0. Competitive with production (AI good 17 vs production 14) but not clean enough to treat as a replacement without human review of the misses.

### Conditions

1. The only AI-first write-shaped miss is `unsupported-remove`: Astra proposed `remove` on `ms-parade`. Current write model has no safe milestone-delete. Production rejected/omitted. Gate 2 would still need a **legal-operation filter**, not semantic rescue.
2. Restating Pippa as UAT was labeled `update` of `resp-uat`, not `no_change`. No second person was created. Production correctly said no_change.
3. This does not replace Apply revalidation or Review.

### J. AI-first successes

- Velvet create unbound; packaging update `risk-packaging`; parade date 29 Oct on `ms-parade` (production created a new milestone).
- Pronoun `she` → Needs You, did not bind Pixel.
- Correction kept audio bus, not shader.
- Contradictory parade dates → Needs You (production wrote an update).
- Share vs replace → Needs You.
- Mixed three facts all correct.
- Chatter → Left untouched.
- H6: workshop update, void-key create, Kwame create, policy no_change, DHP left untouched; biscuits/plants left untouched.

### K. Failures

- AI-first: milestone delete proposed as `remove`.
- Production: packaging → Needs You; date move → Create; contradiction → Update; policy restatement → Needs You.

### L. Wrong-target / false-write

- AI-first wrong-target: 0. False write-shaped proposals: 1 (unsupported remove).
- Production false proposals: 4. Wrong-target: 0 on this mapped score (pronoun Needs You still carried `todo-balance` as a target id — fail-closed, not a write).

### M. Silent-loss

Both paths: 0 on the 18 scored facts.

### N. Fallback quality

AI-first Needs You / Left untouched reasons were specific (unnamed `she`; contradictory dates; share vs replace; speculation; chatter). Production fallbacks were often resolver Needs You after a weak envelope.

### O. Context size

Snapshots 137–324 cl100k tokens (454–1077 chars). Full AI prompts ~800–1100 input tokens. H6 was the largest (1081 in / 1269 out / 16.9s). No retrieval layer was required.

---

Stop. No merge. No production architecture. Do not proceed automatically to Gate 2.
