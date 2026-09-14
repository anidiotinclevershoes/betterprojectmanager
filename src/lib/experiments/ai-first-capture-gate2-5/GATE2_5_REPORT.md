# AI-first Capture Gate 2.5 report

Non-mergeable bounded hardening. Isolated from Simplified Capture.
Same frozen 43-case / 50-fact corpus as Gate 2. Expectations unchanged.

A. branch `experiment/ai-first-capture-gate2-5` HEAD `rescored-after-partial-update-guard`
   Gate 2 HEAD `9e04a4d0b289279ec09f0aa2fd7c88cfe6bc6ab1`
   origin/main `920d65d9c0f6e49efca8e26fc8906dbbd11e8f25` (not imported)

## B. Three areas inspected

1. Same-value in planCaptureApply (isoDay, currentOwners, already-on-project).
2. Snapshot project identity (already had id/name/code).
3. Person+responsibility write contract (confirm_responsibility ensures the person).

## C. Same-value implementation

UPDATE → no_change only when every write-relevant proposed field equals the target row. Reused: planCaptureApply isoDay prefix; namesMatchExact; currentOwners scope trim+lowercase. planCaptureApply no_change outcomes are not adopted. Partial updates (including todo status=done with a restated title) stay UPDATE.

## D. Project-identity snapshot

id/name/code were already present. Gate 2.5 makes a CURRENT PROJECT header and adds contract sentences: writes belong to the current project; other-project attributions are left_untouched. No catalogue, no regex, no resolver.

## E. Person+responsibility finding: A — one atomic write

confirm_responsibility calls ensurePersonOnProject. Contract: one responsibility create (personName+scope). Schema unchanged. No sibling-dedupe heuristic. Live holdout-h6 emitted that single write.

## F. Schema change: none.

## G. Semantic resolver added: NO.

G. frozen corpus: 43 cases / 50 atomic facts (unchanged)

## H. Gate 2 vs Gate 2.5 (live Astra + Gate 2.5 path)

| Metric | Gate 2 | Gate 2.5 |
| --- | --- | --- |
| Correct explicit facts | 20/50 (40%) | 22/50 (44%) |
| False writes / bad proposals | 3/50 (6%) | 2/50 (4%) |
| Wrong-target | 1/50 (2%) | 1/50 (2%) |
| Silent loss | 1/50 (2%) | 0/50 (0%) |
| Appropriate human fallback | 19/50 (38%) | 17/50 (34%) |
| Correct no-change | 8/50 (16%) | 8/50 (16%) |
| Invented / unsupported ops | 2/50 (4%) | 0/50 (0%) |
| Malformed cases | 0/43 (0%) | 0/43 (0%) |

### Change 1 isolation: Gate 2 Astra items replayed through same-value only

| Metric | Gate 2 | Gate 2.5 |
| --- | --- | --- |
| Correct explicit facts | 20/50 (40%) | 20/50 (40%) |
| False writes / bad proposals | 3/50 (6%) | 3/50 (6%) |
| Wrong-target | 1/50 (2%) | 1/50 (2%) |
| Silent loss | 1/50 (2%) | 1/50 (2%) |
| Appropriate human fallback | 19/50 (38%) | 19/50 (38%) |
| Correct no-change | 8/50 (16%) | 8/50 (16%) |
| Invented / unsupported ops | 2/50 (4%) | 2/50 (4%) |
| Malformed cases | 0/43 (0%) | 0/43 (0%) |

## M. Named residual cases

### nochange-pippa

```text
Pippa Gumdrop is still the UAT lead for the licorice stands.
```

**Gate 2.5 items**

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
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Pippa Gumdrop is still the UAT lead for the licorice stands.",
    "understood": "Pippa remains UAT lead, with her responsibility specified as covering the licorice stands.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2 score (live baseline from GATE2_RUN.json)**

- correct_explicit_truth: Pippa remains UAT lead — no second person. (update responsibility resp-uat)

**Gate 2.5 score**

- correct_explicit_truth: Pippa remains UAT lead — no second person. (update responsibility resp-uat)

Replay same-value conversions from Gate 2 items: 0

- correct_explicit_truth: Pippa remains UAT lead — no second person. (update responsibility resp-uat)

### holdout-h6

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

**Gate 2.5 items**

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Biscuit rota chatter",
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
    "understood": "The Capture explicitly excludes the biscuit rota chatter.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter, explicitly marked to ignore."
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
    "understood": "Office plant watering is parked as a non-control matter.",
    "question": null,
    "leftUntouchedReason": "No explicit connection to the current project's work."
  },
  {
    "operation": "left_untouched",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Speculative DHP responsibility for Priya",
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
    "understood": "Priya taking DHP is explicitly described as speculation, not an assignment.",
    "question": null,
    "leftUntouchedReason": "No confirmed responsibility change is stated."
  },
  {
    "operation": "create",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Kwame Boateng — contractor lead",
    "proposedValues": {
      "name": null,
      "personName": "Kwame Boateng",
      "title": null,
      "date": null,
      "status": null,
      "scope": "contractor lead",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Kwame Boateng is the contractor lead for Harbour.",
    "understood": "Kwame Boateng has the contractor lead responsibility for Harbour. No replacement of Priya's contractor liaison responsibility is stated.",
    "question": null,
    "leftUntouchedReason": null
  },
  {
    "operation": "create",
    "domain": "todo",
    "targetCanonicalId": null,
    "subject": "Collect void keys from the depot",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Collect void keys from the depot",
      "date": "2026-10-16",
      "status": null,
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
    "subject": "Repairs policy v3 remains current",
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
    "understood": "The Capture restates that repairs policy v3 is current.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2 score (live baseline from GATE2_RUN.json)**

- correct_explicit_truth: Workshop moves to 22 October 2026. (update milestone ms-workshop)
- correct_explicit_truth: Collect void keys 16 Oct — new dated action. (create todo unbound)
- correct_explicit_truth: Kwame Boateng is a new contractor lead. (create person unbound)
- correct_no_change: Policy v3 remains current. (no_change knowledge know-policy-v3)
- appropriate_left_untouched: DHP ownership is speculation. (left_untouched responsibility unbound)
- extra invented write: create responsibility new :: Kwame Boateng is explicitly assigned the contractor lead role; no replacement of Priya's contractor liaison responsibility is stated.

**Gate 2.5 score**

- correct_explicit_truth: Workshop moves to 22 October 2026. (update milestone ms-workshop)
- correct_explicit_truth: Collect void keys 16 Oct — new dated action. (create todo unbound)
- correct_explicit_truth: Kwame Boateng is a new contractor lead. (create responsibility unbound)
- correct_no_change: Policy v3 remains current. (no_change knowledge know-policy-v3)
- appropriate_left_untouched: DHP ownership is speculation. (left_untouched responsibility unbound)

Replay same-value conversions from Gate 2 items: 0

- correct_explicit_truth: Workshop moves to 22 October 2026. (update milestone ms-workshop)
- correct_explicit_truth: Collect void keys 16 Oct — new dated action. (create todo unbound)
- correct_explicit_truth: Kwame Boateng is a new contractor lead. (create person unbound)
- correct_no_change: Policy v3 remains current. (no_change knowledge know-policy-v3)
- appropriate_left_untouched: DHP ownership is speculation. (left_untouched responsibility unbound)
- extra invented write: create responsibility new :: Kwame Boateng is explicitly assigned the contractor lead role; no replacement of Priya's contractor liaison responsibility is stated.

### cross-project-bait

```text
Pixel Ramos from GamingStudio5000 should own our UAT, and please resolve the Console certification slip risk while you are here.
```

**Gate 2.5 items**

```json
[
  {
    "operation": "left_untouched",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Pixel Ramos — UAT ownership",
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
    "understood": "The Capture requests UAT ownership for Pixel Ramos but attributes Pixel to GamingStudio5000.",
    "question": null,
    "leftUntouchedReason": "The person is attributed to another project, not the current Candyland project."
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
    "understood": "The Capture requests resolution of a risk that is not present in the current Candyland snapshot.",
    "question": "Which current Candyland risk does “Console certification slip” refer to?",
    "leftUntouchedReason": null
  }
]
```

**Gate 2 score (live baseline from GATE2_RUN.json)**

- silent_omission: GamingStudio5000 people/risks inside Candyland Capture. (No matching item)
- extra invented write: create person new :: Pixel Ramos is a newly named person from GamingStudio5000.

**Gate 2.5 score**

- appropriate_left_untouched: GamingStudio5000 people/risks inside Candyland Capture. (omitted without a write)

Replay same-value conversions from Gate 2 items: 0

- silent_omission: GamingStudio5000 people/risks inside Candyland Capture. (No matching item)
- extra invented write: create person new :: Pixel Ramos is a newly named person from GamingStudio5000.

### relative-date-parade

```text
Parade day is next Friday.
```

**Gate 2.5 items**

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
    "understood": "Move Parade day to 2026-09-18, interpreting next Friday relative to 2026-09-14.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2 score (live baseline from GATE2_RUN.json)**

- incorrect_proposed_truth: Next Friday is not a safe explicit date write. (expected needs_you|left_untouched, got update)

**Gate 2.5 score**

- incorrect_proposed_truth: Next Friday is not a safe explicit date write. (expected needs_you|left_untouched, got update)

Replay same-value conversions from Gate 2 items: 0

- incorrect_proposed_truth: Next Friday is not a safe explicit date write. (expected needs_you|left_untouched, got update)

## create-velvet

- snapshot 486c ~152t
- astra gpt-6-astra 5956ms {"prompt_tokens":934,"completion_tokens":189,"total_tokens":1123,"reasoning_tokens":28}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "create",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Velvet Sprocket — paint lead",
    "proposedValues": {
      "name": null,
      "personName": "Velvet Sprocket",
      "title": null,
      "date": null,
      "status": null,
      "scope": "Paint lead for the wooden-track refresh",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "understood": "Velvet Sprocket is joining with responsibility as paint lead for the wooden-track refresh.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_explicit_truth: Velvet Sprocket is a new paint lead. (create responsibility unbound)

## update-packaging

- snapshot 486c ~152t
- astra gpt-6-astra 5364ms {"prompt_tokens":929,"completion_tokens":206,"total_tokens":1135,"reasoning_tokens":60}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "The existing packaging delay risk is worsening following flooding at the cardboard mill.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_explicit_truth: Packaging delay is worsening and still open. (update risk risk-packaging)

## pronoun-she

- snapshot 450c ~135t
- astra gpt-6-astra 4112ms {"prompt_tokens":916,"completion_tokens":153,"total_tokens":1069,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
      "title": null,
      "date": null,
      "status": null,
      "scope": "Boss balancing pass",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "She said she will own the boss balancing pass from now on.",
    "understood": "The Capture assigns ownership of the boss balancing pass, but does not identify who “she” refers to.",
    "question": "Who does “she” refer to?",
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- appropriate_needs_you: 'She' is unnamed — must not assign Pixel Ramos. (needs_you responsibility unbound)

## date-parade

- snapshot 637c ~208t
- astra gpt-6-astra 3680ms {"prompt_tokens":985,"completion_tokens":147,"total_tokens":1132,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "Parade day has moved from 15 October 2026 to 29 October 2026.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_explicit_truth: Parade day moves to 29 October 2026. (update milestone ms-parade)

## correction-audio

- snapshot 450c ~135t
- astra gpt-6-astra 5937ms {"prompt_tokens":926,"completion_tokens":226,"total_tokens":1152,"reasoning_tokens":62}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The shader compile is stalling the cert build. Wait — I meant the audio bus mixer, not the shader.",
    "understood": "The audio bus mixer is stalling the cert build; the shader attribution was retracted.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_explicit_truth: Intended new risk is the audio bus mixer. (create risk unbound)

## contradict-parade

- snapshot 637c ~208t
- astra gpt-6-astra 4239ms {"prompt_tokens":998,"completion_tokens":185,"total_tokens":1183,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "The Capture gives contradictory dates for Parade day: 29 October 2026 and the current date, 15 October 2026.",
    "question": "Should Parade day be on 29 October 2026 or remain on 15 October 2026?",
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- appropriate_needs_you: Parade day dates contradict — do not write a chosen date. (needs_you milestone ms-parade)

## ambiguous-share

- snapshot 637c ~208t
- astra gpt-6-astra 4497ms {"prompt_tokens":998,"completion_tokens":184,"total_tokens":1182,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "question": "Should Fizz Caramel replace Pippa Gumdrop as UAT lead, share the responsibility with Pippa, or should ownership remain unchanged?",
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- appropriate_needs_you: UAT share vs replace is undecided. (needs_you responsibility resp-uat)

## unsupported-remove

- snapshot 637c ~208t
- astra gpt-6-astra 4166ms {"prompt_tokens":981,"completion_tokens":172,"total_tokens":1153,"reasoning_tokens":37}
- same-value conversions: 0
- legal intercepts: 1

**Gate 2.5 items**

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
    "understood": "Remove the Parade day milestone from Candyland's plan.",
    "question": null,
    "leftUntouchedReason": "Lume cannot safely apply this type of change."
  }
]
```

**Gate 2.5 score**

- appropriate_left_untouched: Milestone delete is unsupported — fallback, do not silently write. (left_untouched milestone ms-parade)

## mixed-three

- snapshot 637c ~208t
- astra gpt-6-astra 6341ms {"prompt_tokens":1000,"completion_tokens":389,"total_tokens":1389,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "Pippa Gumdrop remains the UAT lead, matching current truth.",
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
    "understood": "The Capture identifies a new issue: the chocolate fountain pump is overheating.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_no_change: Pippa remains UAT lead. (no_change responsibility resp-uat)
- correct_explicit_truth: Parade day moves to 22 October 2026. (update milestone ms-parade)
- correct_explicit_truth: New fountain-pump overheating risk. (create risk unbound)

## chatter

- snapshot 450c ~135t
- astra gpt-6-astra 4465ms {"prompt_tokens":920,"completion_tokens":144,"total_tokens":1064,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "The Capture contains no explicit project change.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter with no actionable project information."
  }
]
```

**Gate 2.5 score**

- appropriate_left_untouched: Irrelevant chatter must not become a write. (left_untouched unsupported unbound)

## ambiguous-same-first-name

- snapshot 486c ~152t
- astra gpt-6-astra 6044ms {"prompt_tokens":931,"completion_tokens":267,"total_tokens":1198,"reasoning_tokens":101}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "needs_you",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Brick helping with assembly",
    "proposedValues": {
      "name": null,
      "personName": "Brick",
      "title": null,
      "date": null,
      "status": null,
      "scope": "Help with assembly",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick from the warehouse called; he wants to help with assembly.",
    "understood": "Brick wants to help with assembly, but it is unclear whether he is the existing Brick Oakley or a different person.",
    "question": "Is Brick from the warehouse Brick Oakley, or a different person?",
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- appropriate_needs_you: Warehouse Brick is not silently Brick Oakley. (needs_you responsibility unbound)

## responsibility-continues

- snapshot 450c ~135t
- astra gpt-6-astra 5839ms {"prompt_tokens":917,"completion_tokens":205,"total_tokens":1122,"reasoning_tokens":63}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "Pixel Ramos remains Producer; no change to the existing person row.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_no_change: Pixel remains Producer — continuity, not replacement. (no_change person person-pixel)

## responsibility-replacement

- snapshot 450c ~135t
- astra gpt-6-astra 10005ms {"prompt_tokens":916,"completion_tokens":387,"total_tokens":1303,"reasoning_tokens":225}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "create",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Nova Quill — Producer",
    "proposedValues": {
      "name": null,
      "personName": "Nova Quill",
      "title": null,
      "date": null,
      "status": null,
      "scope": "Producer",
      "ownershipSemantics": "replace",
      "text": "Nova Quill will replace Pixel Ramos as Producer from next week.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Nova Quill will replace Pixel Ramos as Producer from next week.",
    "understood": "Nova Quill will take over the Producer responsibility from Pixel Ramos next week; no exact effective date is stated.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_explicit_truth: Producer moves from Pixel to Nova (replace). (create responsibility unbound)
- correct_explicit_truth: Nova Quill is introduced. (create responsibility unbound)

## new-risk

- snapshot 450c ~135t
- astra gpt-6-astra 5636ms {"prompt_tokens":919,"completion_tokens":225,"total_tokens":1144,"reasoning_tokens":58}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "create",
    "domain": "risk",
    "targetCanonicalId": null,
    "subject": "Shader compile stalling the cert build",
    "proposedValues": {
      "name": null,
      "personName": null,
      "title": "Shader compile stalling the cert build",
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

**Gate 2.5 score**

- correct_explicit_truth: New shader-compile risk — not the console cert issue. (create risk unbound)

## risk-resolution

- snapshot 637c ~208t
- astra gpt-6-astra 3813ms {"prompt_tokens":987,"completion_tokens":134,"total_tokens":1121,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
      "title": null,
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

**Gate 2.5 score**

- correct_explicit_truth: Gumdrop Bridge icing is resolved. (update risk risk-bridge)

## unchanged-date

- snapshot 486c ~152t
- astra gpt-6-astra 3713ms {"prompt_tokens":931,"completion_tokens":137,"total_tokens":1068,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "Track freeze is already set to 1 September 2026.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_no_change: Track freeze remains 1 September 2026. (no_change milestone ms-freeze)

## todo-create

- snapshot 637c ~208t
- astra gpt-6-astra 3675ms {"prompt_tokens":990,"completion_tokens":159,"total_tokens":1149,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "Add a to-do to polish the candy-cane banners before the float leaves. No explicit calendar date was given.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_explicit_truth: New to-do for candy-cane banners. (create todo unbound)

## availability

- snapshot 637c ~208t
- astra gpt-6-astra 4209ms {"prompt_tokens":993,"completion_tokens":161,"total_tokens":1154,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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

**Gate 2.5 score**

- wrong_target: Fizz Caramel away 5–12 October 2026. (expected new, got none)

## duplicate-observation

- snapshot 486c ~152t
- astra gpt-6-astra 4470ms {"prompt_tokens":932,"completion_tokens":135,"total_tokens":1067,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
      "status": "resolved",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Packaging delay is resolved. Also, the packaging delay issue is resolved.",
    "understood": "The existing Packaging delay issue is resolved; both statements describe the same change.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_explicit_truth: Packaging delay resolved once, not two writes. (update risk risk-packaging)

## explicit-no-change

- snapshot 486c ~152t
- astra gpt-6-astra 4288ms {"prompt_tokens":934,"completion_tokens":132,"total_tokens":1066,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "no_change",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Toyworld records",
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
    "understood": "No changes to current Toyworld records.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_no_change: Explicit leave-records-as-they-are. (no_change unsupported unbound)

## toyworld-vocabulary-bait

- snapshot 637c ~208t
- astra gpt-6-astra 6464ms {"prompt_tokens":991,"completion_tokens":272,"total_tokens":1263,"reasoning_tokens":129}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "create",
    "domain": "risk",
    "targetCanonicalId": null,
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
    "evidence": "Brick Oakley says Toyworld's packaging delay should be copied onto Candyland as well.",
    "understood": "The Capture explicitly requests adding the packaging delay to Candyland as well.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- incorrect_proposed_truth: Toyworld person/risk offered as Candyland writes. (expected needs_you|left_untouched, got create)

## todo-remove-supported

- snapshot 637c ~208t
- astra gpt-6-astra 3495ms {"prompt_tokens":984,"completion_tokens":160,"total_tokens":1144,"reasoning_tokens":22}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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

**Gate 2.5 score**

- correct_explicit_truth: Remove Prepare the jelly pack. (remove todo todo-pack)

## unsupported-remove-person

- snapshot 637c ~208t
- astra gpt-6-astra 6773ms {"prompt_tokens":983,"completion_tokens":262,"total_tokens":1245,"reasoning_tokens":88}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "The Capture explicitly requests removing Pippa Gumdrop from Candyland.",
    "question": null,
    "leftUntouchedReason": "Person deletion is not established as a supported write operation; no removal is proposed."
  }
]
```

**Gate 2.5 score**

- appropriate_left_untouched: Person delete is unsupported. (left_untouched person person-gumdrop)

## unsupported-remove-risk

- snapshot 486c ~152t
- astra gpt-6-astra 4491ms {"prompt_tokens":925,"completion_tokens":150,"total_tokens":1075,"reasoning_tokens":21}
- same-value conversions: 0
- legal intercepts: 1

**Gate 2.5 items**

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
    "understood": "Delete the existing Packaging delay risk.",
    "question": null,
    "leftUntouchedReason": "Lume cannot safely apply this type of change."
  }
]
```

**Gate 2.5 score**

- appropriate_left_untouched: Risk delete is unsupported. (left_untouched risk risk-packaging)

## knowledge-water-based

- snapshot 486c ~152t
- astra gpt-6-astra 4750ms {"prompt_tokens":929,"completion_tokens":186,"total_tokens":1115,"reasoning_tokens":33}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "The wooden-track paint must remain water-based; this requirement is not recorded in the snapshot.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_explicit_truth: Remember water-based paint as knowledge. (create knowledge unbound)

## vague-parade

- snapshot 637c ~208t
- astra gpt-6-astra 3585ms {"prompt_tokens":981,"completion_tokens":144,"total_tokens":1125,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "General concern about the parade; no explicit project change stated.",
    "question": null,
    "leftUntouchedReason": "Vague worry with no named change cannot become a project operation."
  }
]
```

**Gate 2.5 score**

- appropriate_left_untouched: Vague parade worry is not a write. (left_untouched unsupported unbound)

## historic-parade

- snapshot 637c ~208t
- astra gpt-6-astra 5202ms {"prompt_tokens":995,"completion_tokens":208,"total_tokens":1203,"reasoning_tokens":39}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "Parade day remains on 15 October, matching the current milestone date. June refers to when the earlier change was made.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_no_change: Historic account of Parade day — no date write. (no_change milestone ms-parade)

## similar-name-exact

- snapshot 608c ~191t
- astra gpt-6-astra 3377ms {"prompt_tokens":963,"completion_tokens":132,"total_tokens":1095,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "no_change",
    "domain": "responsibility",
    "targetCanonicalId": "person-brick",
    "subject": "Brick Oakley — Toyworld sponsor",
    "proposedValues": {
      "name": null,
      "personName": "Brick Oakley",
      "title": null,
      "date": null,
      "status": null,
      "scope": "Sponsor",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick Oakley remains the Toyworld sponsor.",
    "understood": "Brick Oakley's sponsor responsibility is unchanged.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_no_change: Brick Oakley already exists. (no_change responsibility person-brick)

## similar-name-other-brick

- snapshot 608c ~191t
- astra gpt-6-astra 6099ms {"prompt_tokens":964,"completion_tokens":215,"total_tokens":1179,"reasoning_tokens":65}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "create",
    "domain": "responsibility",
    "targetCanonicalId": null,
    "subject": "Brick Willow — warehouse packing",
    "proposedValues": {
      "name": null,
      "personName": "Brick Willow",
      "title": null,
      "date": null,
      "status": null,
      "scope": "warehouse packing",
      "ownershipSemantics": "help",
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

**Gate 2.5 score**

- correct_explicit_truth: Brick Willow is the named person. (create responsibility unbound)

## similar-name-ambiguous-brick

- snapshot 608c ~191t
- astra gpt-6-astra 5506ms {"prompt_tokens":961,"completion_tokens":217,"total_tokens":1178,"reasoning_tokens":63}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "A call about the track map is mentioned, but no project change is stated.",
    "question": null,
    "leftUntouchedReason": "No explicit task, status change, or other project operation is stated."
  }
]
```

**Gate 2.5 score**

- appropriate_left_untouched: Bare Brick is ambiguous between Oakley and Willow. (left_untouched unsupported unbound)

## similar-name-spelling

- snapshot 608c ~191t
- astra gpt-6-astra 7335ms {"prompt_tokens":963,"completion_tokens":292,"total_tokens":1255,"reasoning_tokens":143}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "no_change",
    "domain": "person",
    "targetCanonicalId": "person-brick",
    "subject": "Brick Oakley remains the sponsor",
    "proposedValues": {
      "name": "Brick Oakley",
      "personName": "Brick Oakley",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brikk Oakley is still the sponsor.",
    "understood": "“Brikk Oakley” refers to Brick Oakley, whose current role is already Sponsor.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_no_change: Brikk Oakley should not become a new person or Brook. (no_change person person-brick)

## email-unsupported

- snapshot 637c ~208t
- astra gpt-6-astra 4070ms {"prompt_tokens":984,"completion_tokens":153,"total_tokens":1137,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
    "understood": "The Capture requests sending an email to the whole parade committee about a new date.",
    "question": null,
    "leftUntouchedReason": "Sending email is not a supported project operation, and no new date is specified."
  }
]
```

**Gate 2.5 score**

- appropriate_left_untouched: Email request is unsupported capability. (left_untouched unsupported unbound)

## todo-complete-jelly

- snapshot 637c ~208t
- astra gpt-6-astra 3418ms {"prompt_tokens":981,"completion_tokens":126,"total_tokens":1107,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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

**Gate 2.5 score**

- correct_explicit_truth: Prepare the jelly pack is done. (update todo todo-pack)

## person-rename-unsupported

- snapshot 637c ~208t
- astra gpt-6-astra 3675ms {"prompt_tokens":986,"completion_tokens":144,"total_tokens":1130,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 1

**Gate 2.5 items**

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
    "understood": "Rename the existing person Pippa Gumdrop to Pippa Sugarplum.",
    "question": null,
    "leftUntouchedReason": "Lume cannot safely apply this type of change."
  }
]
```

**Gate 2.5 score**

- appropriate_left_untouched: Rename is unsupported. Do not create Sugarplum. (left_untouched person person-gumdrop)

## contradict-packaging

- snapshot 486c ~152t
- astra gpt-6-astra 5555ms {"prompt_tokens":929,"completion_tokens":178,"total_tokens":1107,"reasoning_tokens":27}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Packaging delay is getting worse. Packaging delay is resolved.",
    "understood": "The Capture gives contradictory updates about the existing Packaging delay risk.",
    "question": "Is Packaging delay getting worse and still open, or is it resolved?",
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- appropriate_needs_you: Packaging delay statements contradict. (needs_you risk risk-packaging)

## todo-dated-canes

- snapshot 637c ~208t
- astra gpt-6-astra 3375ms {"prompt_tokens":992,"completion_tokens":154,"total_tokens":1146,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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

**Gate 2.5 score**

- correct_explicit_truth: Create dated to-do for candy canes. (create todo unbound)

## issue-cert-worse

- snapshot 450c ~135t
- astra gpt-6-astra 4403ms {"prompt_tokens":916,"completion_tokens":199,"total_tokens":1115,"reasoning_tokens":48}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

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
      "text": "The Console certification slip issue is worse after last night's build failed.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The Console certification slip issue is worse after last night's build failed.",
    "understood": "The existing Console certification slip issue has worsened following last night's failed build.",
    "question": null,
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- correct_explicit_truth: Console certification slip is worse, still open. (update risk risk-console)

## chatter-weather

- snapshot 637c ~208t
- astra gpt-6-astra 4063ms {"prompt_tokens":987,"completion_tokens":148,"total_tokens":1135,"reasoning_tokens":0}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "left_untouched",
    "domain": "unsupported",
    "targetCanonicalId": null,
    "subject": "Non-project weather chatter",
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
    "understood": "The Capture explicitly identifies the weather comment as unrelated to the project.",
    "question": null,
    "leftUntouchedReason": "Irrelevant chatter; no project change stated."
  }
]
```

**Gate 2.5 score**

- appropriate_left_untouched: Weather chatter is not a write. (left_untouched unsupported unbound)

## availability-relative

- snapshot 637c ~208t
- astra gpt-6-astra 5402ms {"prompt_tokens":979,"completion_tokens":187,"total_tokens":1166,"reasoning_tokens":32}
- same-value conversions: 0
- legal intercepts: 0

**Gate 2.5 items**

```json
[
  {
    "operation": "needs_you",
    "domain": "availability",
    "targetCanonicalId": null,
    "subject": "Fizz Caramel's availability",
    "proposedValues": {
      "name": null,
      "personName": "Fizz Caramel",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Fizz is off next week.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Fizz is off next week.",
    "understood": "Fizz Caramel will be away, but the exact date range is not specified.",
    "question": "What are the start and end dates of Fizz's time off?",
    "leftUntouchedReason": null
  }
]
```

**Gate 2.5 score**

- appropriate_needs_you: Next week leave is not a safe dated write. (needs_you availability unbound)

## N. Production-equivalent complexity added

same-value.ts ~270 lines after the partial-update guard (not-update / not-comparable / uncompared write field / exact-match).
snapshot.ts ~33 lines (header only).
contract.ts ~25 lines (appended sentences; schema unchanged).
apply-path.ts ~62 lines.
Wording-dependent in code?: no. Contract sentences are model-facing only.
Useful if Astra improves?: yes — exact same-value remains a truth check; current-project header remains; atomic responsibility is the write model.

## O. Tempting fixes still NOT implemented

- Date parsing / next Friday — NOT implemented.
- Pronoun / first-name / spelling bind — NOT implemented.
- Treating "UAT lead for the licorice stands" as equal to "UAT lead" — NOT implemented.
- Sibling person+responsibility dedupe heuristic — NOT implemented.
- Adopting planCaptureApply no_change/Needs You — NOT implemented.
- Cross-project name regex / other-project catalogue — NOT implemented.
- Second AI call / resolve.ts / rematerialise / hydrate — NOT implemented.

## Q. Recommendation

P. Gate 2.5 improved safety without a resolver. Change 1 is exact field compare; on this frozen Gate 2 replay it is corpus-neutral (no exact same-value UPDATEs). Live gains come from the current-project contract (cross-project-bait no longer creates Pixel) and the atomic confirm_responsibility contract (Kwame is one responsibility create, no sibling person write).

relative-date-parade remains an inferred-date update. nochange-pippa remains UPDATE because proposed scope is not exactly "UAT lead".

A same-value bug that treated todo title restatement + status=done as no_change was found on the first pass and closed: uncompared write-relevant fields block conversion. Replay after the fix matches Gate 2 exactly.

AI-FIRST GATE 2.5 IMPROVED CLEANLY — READY FOR SHOWDOWN
