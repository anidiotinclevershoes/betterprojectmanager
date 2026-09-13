# AI-first Capture Gate 1 report

Disposable experiment. Not a production implementation. Stop after these five cases.

- branch: experiment/ai-first-capture-gate1
- commit: 7914d706a0f6a973960f207b8cc5016c3e309596
- origin/main: 92d61d13c4407d04a8e20960e7eb38efa0b103c3
- exact model requested: gpt-6-astra
- exact model returned: gpt-6-astra, gpt-6-astra, gpt-6-astra, gpt-6-astra, gpt-6-astra
- files added/changed: src/lib/experiments/ai-first-capture-gate1/**, scripts/experiment-ai-first-capture-gate1.ts

## gate1-create-new-person

**CASE** Straightforward new truth — Velvet Sprocket

- kind: create_new
- source: eval corpus new-person
- expected source: corpus

### Raw Capture

```text
Velvet Sprocket is joining as paint lead for the wooden-track refresh.
```

### Canonical snapshot supplied to model

```text
CANONICAL PROJECT TRUTH SNAPSHOT
Mechanical dump of current stored rows. Not a summary. Not ranked.
project.id="proj-toy"
project.name="Toyworld"
project.code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false dueAt= detail=

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z" endAt= notes=
```

Snapshot size: 547 characters, ~168 cl100k tokens.

### Astra structured interpretation

- requestedModel: gpt-6-astra
- responseModel: gpt-6-astra
- latencyMs: 3879
- usage: {"prompt_tokens":684,"completion_tokens":136,"total_tokens":820,"reasoning_tokens":0}

```json
{
  "observations": [
    {
      "domain": "person",
      "subject": "Velvet Sprocket",
      "referencedCanonicalId": null,
      "referenceKind": "new",
      "assertion": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
      "proposedValue": "Paint lead for the wooden-track refresh",
      "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
      "ambiguity": null
    }
  ],
  "overallUncertainty": null
}
```

### Expected interpretation

Velvet Sprocket is a new person on Toyworld.

- velvet-new: Velvet Sprocket is a new person / paint lead. (new)

### Existing Lume result

Current Capture V2 extract (gpt-4o-mini-2024-07-18) + current resolve

```text
requestedModel=gpt-4o-mini-2024-07-18 responseModel=gpt-4o-mini-2024-07-18 fallback=false
usage={"prompt_tokens":965,"completion_tokens":305,"total_tokens":1270,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"audio_tokens":0,"accepted_prediction_tokens":0,"rejected_prediction_tokens":0}}
account={"total":2,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":1}
lumeSafetyTotals={"applyReady":0,"needsYou":1,"noChange":0,"rejected":1,"illegalOperationsBlocked":1,"foreignProjectTargetsBlocked":0,"duplicatePersonCreationsBlocked":0,"unresolvedTargetConvertedToCreate":0,"wrongDomainLegalWrite":0,"projectIsolationViolation":0,"modelFailures":0,"lumeCatches":2,"lumeFailures":0}
resolved:
- responsibility/create_new target=none decision=needs_you :: Velvet Sprocket is the paint lead for the wooden-track refresh.
rejected:
- rejected unknown/ignore Velvet Sprocket is joining as paint lead for the wooden-track refresh.
```

### Basic comparison

- material facts expected: Velvet Sprocket is a new person / paint lead.
- material facts found: Velvet Sprocket is a new person / paint lead.
- material facts missed: (none)
- unsupported/invented facts: (none)
- existing-entity references: correct — velvet-new: unbound / new
- ambiguity handled: no ambiguity-required fact
- evidence: grounded — velvet-new: evidence grounded
- snapshot approximate token size: 168
- model input/output tokens: prompt=684 completion=136 total=820 reasoning=0
- model latency: 3879 ms

## gate1-change-existing-risk

**CASE** Change to existing truth — Packaging delay worse

- kind: change_existing
- source: eval corpus existing-risk-update
- expected source: corpus

### Raw Capture

```text
Packaging delay is getting worse after the cardboard mill flooded.
```

### Canonical snapshot supplied to model

```text
CANONICAL PROJECT TRUTH SNAPSHOT
Mechanical dump of current stored rows. Not a summary. Not ranked.
project.id="proj-toy"
project.name="Toyworld"
project.code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false dueAt= detail=

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z" endAt= notes=
```

Snapshot size: 547 characters, ~168 cl100k tokens.

### Astra structured interpretation

- requestedModel: gpt-6-astra
- responseModel: gpt-6-astra
- latencyMs: 2655
- usage: {"prompt_tokens":679,"completion_tokens":95,"total_tokens":774,"reasoning_tokens":0}

```json
{
  "observations": [
    {
      "domain": "risk",
      "subject": "Packaging delay",
      "referencedCanonicalId": "risk-packaging",
      "referenceKind": "existing",
      "assertion": "The packaging delay is worsening following flooding at the cardboard mill.",
      "proposedValue": "Worsening after the cardboard mill flooded",
      "evidence": "Packaging delay is getting worse after the cardboard mill flooded.",
      "ambiguity": null
    }
  ],
  "overallUncertainty": null
}
```

### Expected interpretation

Existing Packaging delay risk is worsening, still open.

- packaging-worse: Existing Packaging delay risk is worsening and still open. (id risk-packaging)

### Existing Lume result

Current Capture V2 extract (gpt-4o-mini-2024-07-18) + current resolve

```text
requestedModel=gpt-4o-mini-2024-07-18 responseModel=gpt-4o-mini-2024-07-18 fallback=false
usage={"prompt_tokens":960,"completion_tokens":127,"total_tokens":1087,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"audio_tokens":0,"accepted_prediction_tokens":0,"rejected_prediction_tokens":0}}
account={"total":1,"proposedChanges":0,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
lumeSafetyTotals={"applyReady":0,"needsYou":0,"noChange":1,"rejected":0,"illegalOperationsBlocked":0,"foreignProjectTargetsBlocked":0,"duplicatePersonCreationsBlocked":0,"unresolvedTargetConvertedToCreate":0,"wrongDomainLegalWrite":0,"projectIsolationViolation":0,"modelFailures":0,"lumeCatches":0,"lumeFailures":0}
resolved:
- risk/no_change target=risk-packaging decision=no_change :: The packaging delay is worsening.
```

### Basic comparison

- material facts expected: Existing Packaging delay risk is worsening and still open.
- material facts found: Existing Packaging delay risk is worsening and still open.
- material facts missed: (none)
- unsupported/invented facts: (none)
- existing-entity references: correct — packaging-worse: correct risk-packaging
- ambiguity handled: no ambiguity-required fact
- evidence: grounded — packaging-worse: evidence grounded
- snapshot approximate token size: 168
- model input/output tokens: prompt=679 completion=95 total=774 reasoning=0
- model latency: 2655 ms

## gate1-messy-mixed-domains

**CASE** Messy multi-fact — Pippa + parade date + fountain risk

- kind: messy_multi_fact
- source: eval corpus mixed-domains
- expected source: corpus

### Raw Capture

```text
Pippa Gumdrop remains UAT lead. Parade day moved to 22 October 2026. The chocolate fountain pump is overheating.
```

### Canonical snapshot supplied to model

```text
CANONICAL PROJECT TRUTH SNAPSHOT
Mechanical dump of current stored rows. Not a summary. Not ranked.
project.id="proj-candy"
project.name="Candyland"
project.code="CANDY"

PEOPLE
id="person-gumdrop" name="Pippa Gumdrop" role="UAT lead"
id="person-fizz" name="Fizz Caramel" role="Designer"

ISSUES
id="risk-bridge" title="Gumdrop Bridge icing" status="open"

TO_DO
id="todo-pack" title="Prepare the jelly pack" done=false dueAt= detail=

KNOWLEDGE
legacy_people_bullets:
- Pippa Gumdrop — UAT lead
id="resp-uat" kind="responsibility" lifecycle="current" body="Pippa Gumdrop — UAT lead" personId="person-gumdrop" responsibility.personId="person-gumdrop" responsibility.personName="Pippa Gumdrop" responsibility.scope="UAT lead" responsibility.ownerConfirmed=true availability.personId= availability.personName= availability.awayFromIso= availability.awayToIso=

MILESTONES
id="ms-parade" label="Parade day" startAt="2026-10-15T12:00:00.000Z" endAt= notes=
```

Snapshot size: 952 characters, ~275 cl100k tokens.

### Astra structured interpretation

- requestedModel: gpt-6-astra
- responseModel: gpt-6-astra
- latencyMs: 6469
- usage: {"prompt_tokens":801,"completion_tokens":333,"total_tokens":1134,"reasoning_tokens":0}

```json
{
  "observations": [
    {
      "domain": "responsibility",
      "subject": "Pippa Gumdrop — UAT lead",
      "referencedCanonicalId": "resp-uat",
      "referenceKind": "existing",
      "assertion": "Confirms Pippa Gumdrop remains UAT lead.",
      "proposedValue": "UAT lead",
      "evidence": "Pippa Gumdrop remains UAT lead.",
      "ambiguity": null
    },
    {
      "domain": "milestone",
      "subject": "Parade day",
      "referencedCanonicalId": "ms-parade",
      "referenceKind": "existing",
      "assertion": "Parade day has moved to 22 October 2026.",
      "proposedValue": "2026-10-22",
      "evidence": "Parade day moved to 22 October 2026.",
      "ambiguity": "The new date is explicit, but no time is stated; whether the existing 12:00 UTC time is retained is unspecified."
    },
    {
      "domain": "risk",
      "subject": "Chocolate fountain pump overheating",
      "referencedCanonicalId": null,
      "referenceKind": "new",
      "assertion": "The chocolate fountain pump is overheating.",
      "proposedValue": "Overheating",
      "evidence": "The chocolate fountain pump is overheating.",
      "ambiguity": null
    }
  ],
  "overallUncertainty": null
}
```

### Expected interpretation

Pippa remains UAT lead. Parade day moves to 22 October 2026. New risk: chocolate fountain pump overheating.

- pippa-still: Pippa remains UAT lead (existing person / responsibility). (id person-gumdrop)
- parade-22: Parade day moves to 22 October 2026. (id ms-parade)
- fountain-new: New risk: chocolate fountain pump overheating. (new)

### Existing Lume result

Current Capture V2 extract (gpt-4o-mini-2024-07-18) + current resolve

```text
requestedModel=gpt-4o-mini-2024-07-18 responseModel=gpt-4o-mini-2024-07-18 fallback=false
usage={"prompt_tokens":985,"completion_tokens":337,"total_tokens":1322,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"audio_tokens":0,"accepted_prediction_tokens":0,"rejected_prediction_tokens":0}}
account={"total":3,"proposedChanges":2,"alreadyKnown":1,"merged":0,"needsYou":0,"commentary":0,"leftUntouched":0,"rejected":0}
lumeSafetyTotals={"applyReady":2,"needsYou":0,"noChange":1,"rejected":0,"illegalOperationsBlocked":0,"foreignProjectTargetsBlocked":0,"duplicatePersonCreationsBlocked":0,"unresolvedTargetConvertedToCreate":0,"wrongDomainLegalWrite":0,"projectIsolationViolation":0,"modelFailures":0,"lumeCatches":0,"lumeFailures":0}
resolved:
- person/no_change target=person-gumdrop decision=no_change :: Pippa Gumdrop remains UAT lead.
- milestone/update_existing target=ms-parade decision=write :: Parade day moved to 22 October 2026.
- risk/create_new target=none decision=write :: The chocolate fountain pump is overheating.
```

### Basic comparison

- material facts expected: Pippa remains UAT lead (existing person / responsibility). | Parade day moves to 22 October 2026. | New risk: chocolate fountain pump overheating.
- material facts found: Pippa remains UAT lead (existing person / responsibility). | Parade day moves to 22 October 2026. | New risk: chocolate fountain pump overheating.
- material facts missed: (none)
- unsupported/invented facts: (none)
- existing-entity references: incorrect — pippa-still: expected person-gumdrop, got resp-uat; parade-22: correct ms-parade; fountain-new: unbound / new
- ambiguity handled: no ambiguity-required fact
- evidence: grounded — pippa-still: evidence grounded; parade-22: evidence grounded; fountain-new: evidence grounded
- snapshot approximate token size: 275
- model input/output tokens: prompt=801 completion=333 total=1134 reasoning=0
- model latency: 6469 ms

## gate1-ambiguous-brick

**CASE** Ambiguous identity — Brick from the warehouse

- kind: ambiguous_identity
- source: eval corpus ambiguous-same-first-name
- expected source: corpus

### Raw Capture

```text
Brick from the warehouse called; he wants to help with assembly.
```

### Canonical snapshot supplied to model

```text
CANONICAL PROJECT TRUTH SNAPSHOT
Mechanical dump of current stored rows. Not a summary. Not ranked.
project.id="proj-toy"
project.name="Toyworld"
project.code="TOY"

PEOPLE
id="person-brick" name="Brick Oakley" role="Sponsor"
id="person-buttons" name="Captain Buttons" role="Assembly lead"

ISSUES
id="risk-packaging" title="Packaging delay" status="open"

TO_DO
id="todo-track" title="Print the track map" done=false dueAt= detail=

KNOWLEDGE
(none)

MILESTONES
id="ms-freeze" label="Track freeze" startAt="2026-09-01T12:00:00.000Z" endAt= notes=
```

Snapshot size: 547 characters, ~168 cl100k tokens.

### Astra structured interpretation

- requestedModel: gpt-6-astra
- responseModel: gpt-6-astra
- latencyMs: 6881
- usage: {"prompt_tokens":681,"completion_tokens":252,"total_tokens":933,"reasoning_tokens":93}

```json
{
  "observations": [
    {
      "domain": "responsibility",
      "subject": "Brick from the warehouse",
      "referencedCanonicalId": null,
      "referenceKind": "ambiguous",
      "assertion": "Brick expressed interest in helping with assembly; no assignment or ownership was confirmed.",
      "proposedValue": "Wants to help with assembly",
      "evidence": "Brick from the warehouse called; he wants to help with assembly.",
      "ambiguity": "It is unclear whether Brick from the warehouse is the existing sponsor, Brick Oakley, or a different person."
    }
  ],
  "overallUncertainty": null
}
```

### Expected interpretation

A Brick was mentioned who may not be Brick Oakley — preserve ambiguity.

- which-brick: A Brick was mentioned who may not be Brick Oakley — preserve ambiguity. (ambiguous)

### Existing Lume result

Current Capture V2 extract (gpt-4o-mini-2024-07-18) + current resolve

```text
requestedModel=gpt-4o-mini-2024-07-18 responseModel=gpt-4o-mini-2024-07-18 fallback=false
usage={"prompt_tokens":962,"completion_tokens":129,"total_tokens":1091,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"audio_tokens":0,"accepted_prediction_tokens":0,"rejected_prediction_tokens":0}}
account={"total":1,"proposedChanges":0,"alreadyKnown":0,"merged":0,"needsYou":1,"commentary":0,"leftUntouched":0,"rejected":0}
lumeSafetyTotals={"applyReady":0,"needsYou":1,"noChange":0,"rejected":0,"illegalOperationsBlocked":0,"foreignProjectTargetsBlocked":0,"duplicatePersonCreationsBlocked":0,"unresolvedTargetConvertedToCreate":0,"wrongDomainLegalWrite":0,"projectIsolationViolation":0,"modelFailures":0,"lumeCatches":0,"lumeFailures":0}
resolved:
- availability/update_existing target=person-brick decision=needs_you :: Brick wants to help with assembly.
```

### Basic comparison

- material facts expected: A Brick was mentioned who may not be Brick Oakley — preserve ambiguity.
- material facts found: A Brick was mentioned who may not be Brick Oakley — preserve ambiguity.
- material facts missed: (none)
- unsupported/invented facts: (none)
- existing-entity references: none required
- ambiguity handled: safe — which-brick: ambiguity surfaced (ambiguous)
- evidence: grounded — which-brick: evidence grounded
- snapshot approximate token size: 168
- model input/output tokens: prompt=681 completion=252 total=933 reasoning=93
- model latency: 6881 ms

## gate1-holdout-h6-messy

**CASE** Long-haul regression — hosted holdout H6 messy ops paste

- kind: longhaul_regression
- source: e2e-hosted-holdout H6_MESSY_OPS_PASTE
- expected source: holdout

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

### Canonical snapshot supplied to model

```text
CANONICAL PROJECT TRUTH SNAPSHOT
Mechanical dump of current stored rows. Not a summary. Not ranked.
project.id="proj-harbour-holdout-seed"
project.name="Harbour repairs mobilisation"
project.code="HARBOUR"

PEOPLE
id="person-priya" name="Priya Nair" role="contractor liaison"
id="person-tomos" name="Tomos Reed" role="voids"
id="person-elena" name="Elena Voss" role="resident liaison"

ISSUES
(none)

TO_DO
(none)

KNOWLEDGE
legacy_people_bullets:
- Priya Nair owns contractor liaison.
- Tomos Reed owns voids.
- Elena Voss owns resident liaison.
id="know-policy-v3" kind="fact" lifecycle="current" body="Repairs policy v3 is the current working version." personId= responsibility.personId= responsibility.personName= responsibility.scope= responsibility.ownerConfirmed= availability.personId= availability.personName= availability.awayFromIso= availability.awayToIso=
id="resp-priya" kind="responsibility" lifecycle="current" body="Priya Nair owns contractor liaison." personId="person-priya" responsibility.personId="person-priya" responsibility.personName="Priya Nair" responsibility.scope="contractor liaison" responsibility.ownerConfirmed=true availability.personId= availability.personName= availability.awayFromIso= availability.awayToIso=
id="resp-tomos" kind="responsibility" lifecycle="current" body="Tomos Reed owns voids." personId="person-tomos" responsibility.personId="person-tomos" responsibility.personName="Tomos Reed" responsibility.scope="voids" responsibility.ownerConfirmed=true availability.personId= availability.personName= availability.awayFromIso= availability.awayToIso=
id="resp-elena" kind="responsibility" lifecycle="current" body="Elena Voss owns resident liaison." personId="person-elena" responsibility.personId="person-elena" responsibility.personName="Elena Voss" responsibility.scope="resident liaison" responsibility.ownerConfirmed=true availability.personId= availability.personName= availability.awayFromIso= availability.awayToIso=

MILESTONES
id="ms-workshop" label="Mobilisation workshop" startAt="2026-10-08T12:00:00.000Z" endAt= notes=
```

Snapshot size: 2080 characters, ~510 cl100k tokens.

### Astra structured interpretation

- requestedModel: gpt-6-astra
- responseModel: gpt-6-astra
- latencyMs: 11153
- usage: {"prompt_tokens":1114,"completion_tokens":724,"total_tokens":1838,"reasoning_tokens":0}

```json
{
  "observations": [
    {
      "domain": "milestone",
      "subject": "Mobilisation workshop",
      "referencedCanonicalId": "ms-workshop",
      "referenceKind": "existing",
      "assertion": "The workshop date has moved from 8 October to 22 October 2026.",
      "proposedValue": "2026-10-22",
      "evidence": "22/10/2026 is the new mobilisation workshop date (was 8 Oct).",
      "ambiguity": "No new start time is stated."
    },
    {
      "domain": "commentary",
      "subject": "Office plants",
      "referencedCanonicalId": null,
      "referenceKind": "none",
      "assertion": "Office plant watering is explicitly not a project control.",
      "proposedValue": null,
      "evidence": "Parking: the office plants need watering; not a control.",
      "ambiguity": null
    },
    {
      "domain": "responsibility",
      "subject": "Possible DHP responsibility for Priya Nair",
      "referencedCanonicalId": "person-priya",
      "referenceKind": "ambiguous",
      "assertion": "Tomos speculated that Priya might take DHP if housing insist; no ownership is confirmed.",
      "proposedValue": null,
      "evidence": "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
      "ambiguity": "DHP is not defined in the snapshot, and Priya's possible ownership is explicitly speculative and conditional."
    },
    {
      "domain": "person",
      "subject": "Kwame Boateng",
      "referencedCanonicalId": null,
      "referenceKind": "new",
      "assertion": "Kwame Boateng is identified as the contractor lead for Harbour.",
      "proposedValue": "Contractor lead for Harbour",
      "evidence": "Kwame Boateng is the contractor lead for Harbour.",
      "ambiguity": null
    },
    {
      "domain": "todo",
      "subject": "Collect void keys from the depot",
      "referencedCanonicalId": null,
      "referenceKind": "new",
      "assertion": "Void keys remain to be collected from the depot on 16 October 2026.",
      "proposedValue": "Collect void keys from the depot on 2026-10-16.",
      "evidence": "Void keys still need collecting from the depot on 16 Oct 2026.",
      "ambiguity": "No task owner is stated; Tomos's ownership of voids does not explicitly assign this task to him."
    },
    {
      "domain": "knowledge",
      "subject": "Repairs policy v3",
      "referencedCanonicalId": "know-policy-v3",
      "referenceKind": "existing",
      "assertion": "Elena reaffirmed that repairs policy v3 remains current.",
      "proposedValue": "Repairs policy v3 remains current.",
      "evidence": "Elena said the repairs policy v3 remains current.",
      "ambiguity": null
    }
  ],
  "overallUncertainty": "The revised workshop time and the key-collection task owner are unstated. The DHP ownership suggestion is explicitly speculation, not a confirmed assignment."
}
```

### Expected interpretation

Workshop date 2026-10-22 is Apply-ready update/create. Void keys 2026-10-16 is Apply-ready create if not already present. Kwame Boateng present as create or Needs You. Policy v3 already-known. Biscuits / office plants must not become Review truth. Priya/DHP speculation stays Needs You or is omitted; it must not write a guessed DHP owner. Required or omitted-without-write for speculative DHP ownership. Acceptable for Kwame. Not required for the clear workshop move or the clear depot date. Harbour snapshot IDs are reconstructed from the frozen H6 seed notes (manual-for-experiment IDs), not hosted UUIDs.

- workshop-22: Mobilisation workshop date moves to 22 October 2026. (id ms-workshop)
- void-keys: Collect void keys from the depot on 16 October 2026 — new dated action. (new)
- kwame-new: Kwame Boateng is a new contractor lead. (new)
- policy-v3: Repairs policy v3 remains current already-known knowledge. (id know-policy-v3)
- dhp-speculation: Priya/DHP ownership is speculation — must not be asserted as decided. (ambiguous)

### Existing Lume result

Published hosted holdout H6 excerpt (post-fix-3). Not re-run. Production path was gpt-4o-mini-2024-07-18.

```text
observationAccount={"total":5,"proposedChanges":1,"alreadyKnown":1,"merged":0,"needsYou":3,"commentary":0,"rejected":0}
findings:
- ENTITY_UPDATED  :: The new mobilisation workshop date is 22/10/2026. → milestone Mobilisation Workshop b81368c8-111b-4014-b6ef-2a8abf1daded
- AMBIGUOUS NeedsYou :: Void keys need collecting from the depot on 16 Oct 2026. → todo Collect void keys from the depot
- NO_CHANGE  :: Elena said the repairs policy v3 remains current. → untargeted
- AMBIGUOUS NeedsYou :: Tomos mentioned Priya might take DHP if housing insist. → risk Priya might take DHP if housing insist
- AMBIGUOUS NeedsYou :: Kwame Boateng is the contractor lead for Harbour. → stakeholder Kwame Boateng
Known pipeline weakness on this paste: void-key create and Kwame create were Needs You / AMBIGUOUS rather than independently actionable creates; workshop date update was found.
```

### Basic comparison

- material facts expected: Mobilisation workshop date moves to 22 October 2026. | Collect void keys from the depot on 16 October 2026 — new dated action. | Kwame Boateng is a new contractor lead. | Repairs policy v3 remains current already-known knowledge. | Priya/DHP ownership is speculation — must not be asserted as decided.
- material facts found: Mobilisation workshop date moves to 22 October 2026. | Collect void keys from the depot on 16 October 2026 — new dated action. | Kwame Boateng is a new contractor lead. | Repairs policy v3 remains current already-known knowledge. | Priya/DHP ownership is speculation — must not be asserted as decided.
- material facts missed: (none)
- unsupported/invented facts: (none)
- existing-entity references: correct — workshop-22: correct ms-workshop; void-keys: unbound / new; kwame-new: unbound / new; policy-v3: correct know-policy-v3
- ambiguity handled: safe — dhp-speculation: ambiguity surfaced (ambiguous)
- evidence: grounded — workshop-22: evidence grounded; void-keys: evidence grounded; kwame-new: evidence grounded; policy-v3: evidence grounded; dhp-speculation: evidence grounded
- snapshot approximate token size: 510
- model input/output tokens: prompt=1114 completion=724 total=1838 reasoning=0
- model latency: 11153 ms

## Automated checker vs human assessment

The disposable comparator marked **MIXED** because case 3 bound Pippa’s UAT restatement to `resp-uat` instead of the expected `person-gumdrop`. Both ids are real current canonical rows in the snapshot. That is an ID-shape difference, not a missed or invented fact.

Human evidence-based assessment: **PROMISING**

## Return package

### 1. Branch + commit

- branch: `experiment/ai-first-capture-gate1`
- code commit: `7914d706a0f6a973960f207b8cc5016c3e309596`
- contains current `origin/main` `92d61d13c4407d04a8e20960e7eb38efa0b103c3`: YES
- safe to merge: NO — intentional non-mergeable experiment

### 2. Files added/changed

Experiment-only. No production Capture / Review / Apply / persist / store / migration / UI files.

- `scripts/experiment-ai-first-capture-gate1.ts`
- `src/lib/experiments/ai-first-capture-gate1/*`

### 3. Exact model used

- requested: `gpt-6-astra`
- returned on every case: `gpt-6-astra`
- no silent substitution

### 4. Five-case report

See the case sections above.

| Case | Material facts | Existing IDs | Ambiguity | vs current Lume |
| --- | --- | --- | --- | --- |
| 1 new person | found | unbound / new | n/a | Astra clean create; current extract+resolve was Needs You + rejected |
| 2 existing risk | found | `risk-packaging` | n/a | Astra: worsening update; current resolve: no_change |
| 3 messy multi-fact | all 3 found | parade + new risk correct; Pippa bound to `resp-uat` not `person-gumdrop` | time-of-day optional | current Lume also found all 3 and wrote parade + fountain |
| 4 ambiguous Brick | found | unbound | safe | current extract targeted `person-brick` then Needs You |
| 5 H6 long-haul | all 5 found; plants=commentary | workshop + policy correct; Kwame/void keys new | DHP speculation safe | current holdout: workshop update; void keys + Kwame Needs You |

### 5. Test / regression status

- `tsc --noEmit`: pass
- experiment snapshot self-check (every in-scope canonical id present): pass
- 5/5 Astra calls: pass, one call each
- production Capture/Review/Apply tests: not re-run; no production files changed
- `npm test` not required for this disposable spike

### 6. Amount of new experimental code

About 1,480 lines of TypeScript plus this report. Isolated under `src/lib/experiments/ai-first-capture-gate1/` and one script.

### 7. Machinery felt useful but deliberately not added

- retrieval / ranking / embeddings — snapshots were 168–510 tokens
- a second verification or repair model call
- deterministic English “fix-up” when Pippa bound to `resp-uat`
- an AI-first resolver / Review candidate materialiser
- feature flags, UI, persistence, migrations
- dumping every project in the workspace
- token-budget truncation or project summaries
- fallback to `gpt-4o-mini`

### 8. Assessment

**PROMISING**

Does raw Capture + dumb current canonical snapshot + one model call appear capable of replacing a meaningful portion of Lume's existing semantic interpretation machinery?

**Yes, on this five-case set, for understanding.** Astra recovered every expected material fact, kept evidence as Capture quotes, left unsafe identity/speculation ambiguous, and on the long-haul H6 paste understood the void-key create and Kwame create that the current `gpt-4o-mini` pipeline sent to Needs You.

It does **not** replace deterministic Review / Apply / write safety. Gate 2 is not started.

Stop for human review. No merge request. No production integration.
