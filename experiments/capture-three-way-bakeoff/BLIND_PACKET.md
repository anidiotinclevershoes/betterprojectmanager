# Blind human comparison packet

Do not infer which system is which from this packet.
Judge each case on understanding, trust, unnecessary help, guessing, and missed information.

## Case 1: Genuinely new Person

Internal id (for facilitators only after review): `new-person`

### RAW CAPTURE

```text
Velvet Sprocket is joining as paint lead for the wooden-track refresh.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-toy",
  "people": [
    {
      "id": "person-brick",
      "name": "Brick Oakley",
      "role": "Sponsor"
    },
    {
      "id": "person-buttons",
      "name": "Captain Buttons",
      "role": "Assembly lead"
    }
  ],
  "risks": [
    {
      "id": "risk-packaging",
      "projectId": "proj-toy",
      "title": "Packaging delay",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-track",
      "projectId": "proj-toy",
      "title": "Print the track map",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-freeze",
      "projectId": "proj-toy",
      "label": "Track freeze",
      "startAt": "2026-09-01T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Velvet Sprocket is a new person on Toyworld. (create; target=new/unbound; ambiguity=no)

### SYSTEM X

```json
[
  {
    "domain": "person",
    "subject": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Velvet Sprocket"
    },
    "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "responsibility",
    "subject": "Velvet Sprocket is the paint lead for the wooden-track refresh.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "personName": "Velvet Sprocket",
      "scope": "paint lead for the wooden-track refresh",
      "ownershipSemantics": "replace"
    },
    "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "ambiguity": "Replacement needs a confirmed current owner. Confirm before Lume changes ownership.",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "person",
    "subject": "Velvet Sprocket",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Velvet Sprocket",
      "personName": "Velvet Sprocket",
      "title": "paint lead",
      "date": null,
      "status": null,
      "scope": "wooden-track refresh",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "person",
    "subject": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Velvet Sprocket"
    },
    "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "responsibility",
    "subject": "Velvet Sprocket is the paint lead for the wooden-track refresh.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "personName": "Velvet Sprocket",
      "scope": "paint lead for the wooden-track refresh",
      "ownershipSemantics": "replace"
    },
    "evidence": "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
    "ambiguity": "Replacement needs a confirmed current owner. Confirm before Lume changes ownership.",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

## Case 2: Existing Risk update

Internal id (for facilitators only after review): `existing-risk-update`

### RAW CAPTURE

```text
Packaging delay is getting worse after the cardboard mill flooded.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-toy",
  "people": [
    {
      "id": "person-brick",
      "name": "Brick Oakley",
      "role": "Sponsor"
    },
    {
      "id": "person-buttons",
      "name": "Captain Buttons",
      "role": "Assembly lead"
    }
  ],
  "risks": [
    {
      "id": "risk-packaging",
      "projectId": "proj-toy",
      "title": "Packaging delay",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-track",
      "projectId": "proj-toy",
      "title": "Print the track map",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-freeze",
      "projectId": "proj-toy",
      "label": "Track freeze",
      "startAt": "2026-09-01T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Existing Packaging delay risk is worsening, still open. (update; target=risk-packaging; ambiguity=no)

### SYSTEM X

```json
[
  {
    "domain": "risk",
    "subject": "Packaging delay",
    "referencedCanonicalId": "risk-packaging",
    "assertedValue": {
      "title": "Packaging delay"
    },
    "evidence": "Packaging delay is getting worse after the cardboard mill flooded.",
    "ambiguity": "This Risk update is not specific enough to apply automatically.",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "risk",
    "subject": "Packaging delay",
    "referencedCanonicalId": "risk-packaging",
    "assertedValue": {
      "title": "Packaging delay"
    },
    "evidence": "Packaging delay is getting worse after the cardboard mill flooded.",
    "ambiguity": "This Risk update is not specific enough to apply automatically.",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "risk",
    "subject": "Packaging delay",
    "referencedCanonicalId": "risk-packaging",
    "assertedValue": {
      "name": null,
      "personName": null,
      "title": "Packaging delay",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Packaging delay is getting worse after the cardboard mill flooded.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Packaging delay is getting worse after the cardboard mill flooded.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  }
]
```

## Case 3: Existing Person mentioned again

Internal id (for facilitators only after review): `existing-person`

### RAW CAPTURE

```text
Pippa Gumdrop is still the UAT lead for the licorice stands.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-candy",
  "people": [
    {
      "id": "person-gumdrop",
      "name": "Pippa Gumdrop",
      "role": "UAT lead"
    },
    {
      "id": "person-fizz",
      "name": "Fizz Caramel",
      "role": "Designer"
    }
  ],
  "risks": [
    {
      "id": "risk-bridge",
      "projectId": "proj-candy",
      "title": "Gumdrop Bridge icing",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-pack",
      "projectId": "proj-candy",
      "title": "Prepare the jelly pack",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-parade",
      "projectId": "proj-candy",
      "label": "Parade day",
      "startAt": "2026-10-15T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Pippa Gumdrop is already on Candyland; do not create a second person. (no_change|update; target=person-gumdrop; ambiguity=no)

### SYSTEM X

```json
[
  {
    "domain": "responsibility",
    "subject": "Pippa Gumdrop’s UAT responsibility",
    "referencedCanonicalId": "resp-uat",
    "assertedValue": {
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
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "responsibility",
    "subject": "Pippa Gumdrop",
    "referencedCanonicalId": "person-gumdrop",
    "assertedValue": {
      "personName": "Pippa Gumdrop",
      "scope": "UAT lead for the licorice stands",
      "ownershipSemantics": "continue"
    },
    "evidence": "Pippa Gumdrop is still the UAT lead for the licorice stands.",
    "ambiguity": "omitted",
    "disposition": "no_change",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "responsibility",
    "subject": "Pippa Gumdrop",
    "referencedCanonicalId": "person-gumdrop",
    "assertedValue": {
      "personName": "Pippa Gumdrop",
      "scope": "UAT lead for the licorice stands",
      "ownershipSemantics": "continue"
    },
    "evidence": "Pippa Gumdrop is still the UAT lead for the licorice stands.",
    "ambiguity": "omitted",
    "disposition": "no_change",
    "writeProposed": false
  }
]
```

## Case 4: Same first name / ambiguous Person

Internal id (for facilitators only after review): `ambiguous-same-first-name`

### RAW CAPTURE

```text
Brick from the warehouse called; he wants to help with assembly.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-toy",
  "people": [
    {
      "id": "person-brick",
      "name": "Brick Oakley",
      "role": "Sponsor"
    },
    {
      "id": "person-buttons",
      "name": "Captain Buttons",
      "role": "Assembly lead"
    }
  ],
  "risks": [
    {
      "id": "risk-packaging",
      "projectId": "proj-toy",
      "title": "Packaging delay",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-track",
      "projectId": "proj-toy",
      "title": "Print the track map",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-freeze",
      "projectId": "proj-toy",
      "label": "Track freeze",
      "startAt": "2026-09-01T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- A Brick was mentioned who may not be Brick Oakley — preserve ambiguity. (needs_you|left_untouched; target=new/unbound; ambiguity=yes)

### SYSTEM X

```json
[
  {
    "domain": "person",
    "subject": "Brick from the warehouse",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Brick",
      "personName": "Brick",
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "Wants to help with assembly.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Brick from the warehouse called; he wants to help with assembly.",
    "ambiguity": "Is Brick from the warehouse Brick Oakley, or a different person?",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "availability",
    "subject": "Brick Oakley",
    "referencedCanonicalId": "person-brick",
    "assertedValue": {
      "personName": "Brick Oakley"
    },
    "evidence": "he wants to help with assembly.",
    "ambiguity": "This availability cannot be saved — the dates are not clear.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Brick from the warehouse called",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Brick from the warehouse called",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "availability",
    "subject": "Brick Oakley",
    "referencedCanonicalId": "person-brick",
    "assertedValue": {
      "personName": "Brick Oakley"
    },
    "evidence": "he wants to help with assembly.",
    "ambiguity": "This availability cannot be saved — the dates are not clear.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Brick from the warehouse called",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Brick from the warehouse called",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

## Case 5: Pronoun / reference ambiguity

Internal id (for facilitators only after review): `pronoun-ambiguity`

### RAW CAPTURE

```text
She said she will own the boss balancing pass from now on.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-game",
  "people": [
    {
      "id": "person-pixel",
      "name": "Pixel Ramos",
      "role": "Producer"
    }
  ],
  "risks": [
    {
      "id": "risk-console",
      "projectId": "proj-game",
      "title": "Console certification slip",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-balance",
      "projectId": "proj-game",
      "title": "Boss balancing pass",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-cert",
      "projectId": "proj-game",
      "label": "Console certification",
      "startAt": "2026-11-20T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- The speaker did not name who 'she' is. (needs_you|left_untouched; target=new/unbound; ambiguity=yes)

### SYSTEM X

```json
[
  {
    "domain": "responsibility",
    "subject": "Boss balancing pass",
    "referencedCanonicalId": "todo-balance",
    "assertedValue": {
      "personName": "Pixel Ramos",
      "scope": "boss balancing pass",
      "ownershipSemantics": "replace"
    },
    "evidence": "She said she will own the boss balancing pass from now on.",
    "ambiguity": "This Person identity is not established in the Capture. A supplied record id is not enough.",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "responsibility",
    "subject": "Boss balancing pass",
    "referencedCanonicalId": "todo-balance",
    "assertedValue": {
      "personName": "Pixel Ramos",
      "scope": "boss balancing pass",
      "ownershipSemantics": "replace"
    },
    "evidence": "She said she will own the boss balancing pass from now on.",
    "ambiguity": "This Person identity is not established in the Capture. A supplied record id is not enough.",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "responsibility",
    "subject": "Ownership of Boss balancing pass",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
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
    "ambiguity": "Who does “she” refer to?",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

## Case 6: Share vs replace ambiguity

Internal id (for facilitators only after review): `share-vs-replace-ambiguous`

### RAW CAPTURE

```text
Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it — the parade committee was unclear.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-candy",
  "people": [
    {
      "id": "person-gumdrop",
      "name": "Pippa Gumdrop",
      "role": "UAT lead"
    },
    {
      "id": "person-fizz",
      "name": "Fizz Caramel",
      "role": "Designer"
    }
  ],
  "risks": [
    {
      "id": "risk-bridge",
      "projectId": "proj-candy",
      "title": "Gumdrop Bridge icing",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-pack",
      "projectId": "proj-candy",
      "title": "Prepare the jelly pack",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-parade",
      "projectId": "proj-candy",
      "label": "Parade day",
      "startAt": "2026-10-15T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- UAT ownership between Fizz and Pippa is genuinely ambiguous. (needs_you|left_untouched; target=new/unbound; ambiguity=yes)

### SYSTEM X

```json
[
  {
    "domain": "responsibility",
    "subject": "Fizz Caramel",
    "referencedCanonicalId": "person-fizz",
    "assertedValue": {
      "personName": "Pippa Gumdrop",
      "scope": "UAT",
      "ownershipSemantics": "ambiguous"
    },
    "evidence": "Fizz Caramel might take UAT from Pippa Gumdrop.",
    "ambiguity": "It's unclear whether Fizz Caramel will take UAT or share it with Pippa Gumdrop.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "commentary",
    "subject": "The parade committee was unclear about UAT responsibilities.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "the parade committee was unclear.",
    "ambiguity": "This statement reflects uncertainty from the parade committee regarding UAT responsibilities.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it —",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it —",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "responsibility",
    "subject": "UAT lead ownership",
    "referencedCanonicalId": "resp-uat",
    "assertedValue": {
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
    "ambiguity": "Is Fizz Caramel replacing Pippa Gumdrop as UAT lead, sharing the responsibility with her, or is the change still undecided?",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "responsibility",
    "subject": "Fizz Caramel",
    "referencedCanonicalId": "person-fizz",
    "assertedValue": {
      "personName": "Pippa Gumdrop",
      "scope": "UAT",
      "ownershipSemantics": "ambiguous"
    },
    "evidence": "Fizz Caramel might take UAT from Pippa Gumdrop.",
    "ambiguity": "It's unclear whether Fizz Caramel will take UAT or share it with Pippa Gumdrop.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "commentary",
    "subject": "The parade committee was unclear about UAT responsibilities.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "the parade committee was unclear.",
    "ambiguity": "This statement reflects uncertainty from the parade committee.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it —",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it —",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

## Case 7: Mixed domains in one transcript

Internal id (for facilitators only after review): `mixed-domains`

### RAW CAPTURE

```text
Pippa Gumdrop remains UAT lead. Parade day moved to 22 October 2026. The chocolate fountain pump is overheating.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-candy",
  "people": [
    {
      "id": "person-gumdrop",
      "name": "Pippa Gumdrop",
      "role": "UAT lead"
    },
    {
      "id": "person-fizz",
      "name": "Fizz Caramel",
      "role": "Designer"
    }
  ],
  "risks": [
    {
      "id": "risk-bridge",
      "projectId": "proj-candy",
      "title": "Gumdrop Bridge icing",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-pack",
      "projectId": "proj-candy",
      "title": "Prepare the jelly pack",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-parade",
      "projectId": "proj-candy",
      "label": "Parade day",
      "startAt": "2026-10-15T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Pippa remains UAT lead. (no_change; target=person-gumdrop; ambiguity=no)
- Parade day moves to 22 October 2026. (needs_you|left_untouched; target=ms-parade; ambiguity=no)
- New risk: chocolate fountain pump overheating. (needs_you|left_untouched; target=new/unbound; ambiguity=no)

### SYSTEM X

```json
[
  {
    "domain": "person",
    "subject": "Pippa Gumdrop",
    "referencedCanonicalId": "person-gumdrop",
    "assertedValue": "omitted",
    "evidence": "Pippa Gumdrop remains UAT lead.",
    "ambiguity": "Lume understood a person here, but needs you to confirm who it refers to.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": "2026-10-22"
    },
    "evidence": "Parade day moved to 22 October 2026.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "risk",
    "subject": "The chocolate fountain pump is overheating.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "title": "Chocolate fountain pump overheating"
    },
    "evidence": "The chocolate fountain pump is overheating.",
    "ambiguity": "It's unclear if this is a new risk or an existing one.",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "responsibility",
    "subject": "Pippa Gumdrop — UAT lead",
    "referencedCanonicalId": "resp-uat",
    "assertedValue": {
      "name": "Pippa Gumdrop",
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
    "ambiguity": "omitted",
    "disposition": "no_change",
    "writeProposed": false
  },
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
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
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "risk",
    "subject": "Chocolate fountain pump overheating",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
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
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "person",
    "subject": "Pippa Gumdrop",
    "referencedCanonicalId": "person-gumdrop",
    "assertedValue": {
      "title": "Pippa Gumdrop",
      "label": "Pippa Gumdrop",
      "name": "Pippa Gumdrop",
      "personName": "Pippa Gumdrop"
    },
    "evidence": "Pippa Gumdrop remains UAT lead.",
    "ambiguity": "omitted",
    "disposition": "no_change",
    "writeProposed": false
  },
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": "2026-10-22"
    },
    "evidence": "Parade day moved to 22 October 2026.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "risk",
    "subject": "Chocolate fountain pump overheating",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "title": "Chocolate fountain pump overheating"
    },
    "evidence": "The chocolate fountain pump is overheating.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  }
]
```

## Case 8: Hosted holdout H6 messy paste

Internal id (for facilitators only after review): `holdout-h6`

### RAW CAPTURE

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

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-harbour-holdout-seed",
  "people": [
    {
      "id": "person-priya",
      "name": "Priya Nair",
      "role": "contractor liaison"
    },
    {
      "id": "person-tomos",
      "name": "Tomos Reed",
      "role": "voids"
    },
    {
      "id": "person-elena",
      "name": "Elena Voss",
      "role": "resident liaison"
    }
  ],
  "risks": [],
  "todos": [],
  "dates": [
    {
      "id": "ms-workshop",
      "projectId": "proj-harbour-holdout-seed",
      "label": "Mobilisation workshop",
      "startAt": "2026-10-08T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Workshop moves to 22 October 2026. (update; target=ms-workshop; ambiguity=no)
- Collect void keys 16 Oct — new dated action. (create; target=new/unbound; ambiguity=no)
- Kwame Boateng is a new contractor lead. (create|needs_you; target=new/unbound; ambiguity=no)
- Policy v3 remains current. (no_change; target=know-policy-v3; ambiguity=no)
- DHP ownership is speculation. (needs_you|left_untouched; target=new/unbound; ambiguity=yes)

### SYSTEM X

```json
[
  {
    "domain": "milestone",
    "subject": "Mobilisation workshop",
    "referencedCanonicalId": "ms-workshop",
    "assertedValue": {
      "label": "Mobilisation workshop",
      "date": "2026-10-22"
    },
    "evidence": "22/10/2026 is the new mobilisation workshop date (was 8 Oct).",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "person",
    "subject": "Kwame Boateng is the contractor lead for Harbour.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Kwame Boateng"
    },
    "evidence": "Kwame Boateng is the contractor lead for Harbour.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "todo",
    "subject": "Void keys still need collecting from the depot on 16 Oct 2026.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "title": "Collect void keys from the depot"
    },
    "evidence": "Void keys still need collecting from the depot on 16 Oct 2026.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "knowledge",
    "subject": "The repairs policy v3 remains current.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "Elena said the repairs policy v3 remains current.",
    "ambiguity": "Lume understood this, but cannot safely decide what to change without a small confirmation.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
    "ambiguity": "It's unclear if Priya will take DHP or if this is a confirmed change.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "From: housing ops Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "From: housing ops Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Parking: the office plants need watering; not a control.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Parking: the office plants need watering; not a control.",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "milestone",
    "subject": "Mobilisation workshop",
    "referencedCanonicalId": "ms-workshop",
    "assertedValue": {
      "label": "Mobilisation workshop",
      "date": "2026-10-22"
    },
    "evidence": "22/10/2026 is the new mobilisation workshop date (was 8 Oct).",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "person",
    "subject": "Kwame Boateng is the contractor lead for Harbour.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Kwame Boateng"
    },
    "evidence": "Kwame Boateng is the contractor lead for Harbour.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "todo",
    "subject": "Void keys still need collecting from the depot on 16 Oct 2026.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "title": "Collect void keys from the depot"
    },
    "evidence": "Void keys still need collecting from the depot on 16 Oct 2026.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "knowledge",
    "subject": "Elena said the repairs policy v3 remains current.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "Elena said the repairs policy v3 remains current.",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
    "ambiguity": "It isn't clear if Priya will take DHP or what the implications are.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "From: housing ops Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "From: housing ops Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Parking: the office plants need watering; not a control.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Parking: the office plants need watering; not a control.",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "unsupported",
    "subject": "Biscuits chatter",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "Copied from the WhatsApp thread — ignore the bit about whose turn it is to bring biscuits.",
    "ambiguity": "Irrelevant chatter explicitly marked to ignore.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "milestone",
    "subject": "Mobilisation workshop",
    "referencedCanonicalId": "ms-workshop",
    "assertedValue": {
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
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "unsupported",
    "subject": "Office plants",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "Parking: the office plants need watering; not a control.",
    "ambiguity": "No explicit project operation; incidental office housekeeping.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "responsibility",
    "subject": "Speculative DHP responsibility for Priya",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "Tomos mentioned Priya might take DHP if housing insist, but that was just speculation.",
    "ambiguity": "Speculation does not establish a responsibility change.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "person",
    "subject": "Kwame Boateng",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
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
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "responsibility",
    "subject": "Kwame Boateng — contractor lead",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
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
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "todo",
    "subject": "Collect void keys from the depot",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
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
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "knowledge",
    "subject": "Repairs policy v3",
    "referencedCanonicalId": "know-policy-v3",
    "assertedValue": {
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
    "ambiguity": "omitted",
    "disposition": "no_change",
    "writeProposed": false
  }
]
```

## Case 9: Long-haul C5 timber-floor services risk

Internal id (for facilitators only after review): `c5-timber-floor`

### RAW CAPTURE

```text
The asbestos survey addendum came back clean. Close that chase. Raise a risk that the hall timber floor may still hide services.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-riverside-c5",
  "people": [
    {
      "id": "person-helen",
      "name": "Helen Ward",
      "role": "client project manager"
    },
    {
      "id": "person-james",
      "name": "James Okonkwo",
      "role": "principal contractor"
    },
    {
      "id": "person-nadia",
      "name": "Nadia Rahman",
      "role": "interior designer"
    },
    {
      "id": "person-tomos-ellis",
      "name": "Tomos Ellis",
      "role": "building control"
    },
    {
      "id": "person-mei",
      "name": "Mei Chen",
      "role": ""
    }
  ],
  "risks": [
    {
      "id": "risk-dda",
      "projectId": "proj-riverside-c5",
      "title": "DDA access ramp detail outstanding",
      "status": "open"
    },
    {
      "id": "risk-me",
      "projectId": "proj-riverside-c5",
      "title": "M&E first-fix coordination with the hall ceiling void",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-riba",
      "projectId": "proj-riverside-c5",
      "title": "Issue the RIBA Stage 4 drawing pack to James",
      "done": false
    },
    {
      "id": "todo-ffe",
      "projectId": "proj-riverside-c5",
      "title": "Book the FF&E sample review with Nadia",
      "done": false
    },
    {
      "id": "todo-asbestos",
      "projectId": "proj-riverside-c5",
      "title": "Chase the asbestos survey addendum",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-mobilisation",
      "projectId": "proj-riverside-c5",
      "label": "Site mobilisation",
      "startAt": "2026-10-06T12:00:00.000Z"
    },
    {
      "id": "ms-walkthrough",
      "projectId": "proj-riverside-c5",
      "label": "Client walk-through",
      "startAt": "2026-10-20T12:00:00.000Z"
    },
    {
      "id": "ms-pc",
      "projectId": "proj-riverside-c5",
      "label": "Practical completion",
      "startAt": "2026-12-12T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Close the asbestos survey chase to-do. (update; target=todo-asbestos; ambiguity=no)
- New risk that the hall timber floor may still hide services. (create; target=new/unbound; ambiguity=no)

### SYSTEM X

```json
[
  {
    "domain": "knowledge",
    "subject": "Asbestos survey addendum result",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": "The asbestos survey addendum came back clean.",
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The asbestos survey addendum came back clean.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "todo",
    "subject": "Chase the asbestos survey addendum",
    "referencedCanonicalId": "todo-asbestos",
    "assertedValue": {
      "name": null,
      "personName": null,
      "title": null,
      "date": null,
      "status": "done",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "The asbestos survey addendum came back clean. Close that chase.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "risk",
    "subject": "Hall timber floor may hide services",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": null,
      "personName": null,
      "title": "Hall timber floor may still hide services",
      "date": null,
      "status": "open",
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Raise a risk that the hall timber floor may still hide services.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "todo",
    "subject": "Chase the asbestos survey addendum",
    "referencedCanonicalId": "todo-asbestos",
    "assertedValue": {
      "status": "resolved"
    },
    "evidence": "The asbestos survey addendum came back clean.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "risk",
    "subject": "Hall timber floor may still hide services",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "title": "Hall timber floor may still hide services"
    },
    "evidence": "Raise a risk that the hall timber floor may still hide services.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "unknown",
    "subject": "Close that chase.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Close that chase.",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "todo",
    "subject": "Chase the asbestos survey addendum",
    "referencedCanonicalId": "todo-asbestos",
    "assertedValue": {
      "status": "resolved"
    },
    "evidence": "The asbestos survey addendum came back clean.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "risk",
    "subject": "Raise a risk that the hall timber floor may still hide services.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "title": "Hall timber floor may still hide services"
    },
    "evidence": "Raise a risk that the hall timber floor may still hide services.",
    "ambiguity": "It is unclear whether this should change current project truth.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Close that chase.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Close that chase.",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

## Case 10: Title-only existing entity date update

Internal id (for facilitators only after review): `title-only-existing-target`

### RAW CAPTURE

```text
Parade day moved to 22 October 2026.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-candy",
  "people": [
    {
      "id": "person-gumdrop",
      "name": "Pippa Gumdrop",
      "role": "UAT lead"
    },
    {
      "id": "person-fizz",
      "name": "Fizz Caramel",
      "role": "Designer"
    }
  ],
  "risks": [
    {
      "id": "risk-bridge",
      "projectId": "proj-candy",
      "title": "Gumdrop Bridge icing",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-pack",
      "projectId": "proj-candy",
      "title": "Prepare the jelly pack",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-parade",
      "projectId": "proj-candy",
      "label": "Parade day",
      "startAt": "2026-10-15T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Parade day moves to 22 October 2026. (update; target=ms-parade; ambiguity=no)

### SYSTEM X

```json
[
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "name": "Parade day",
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
    "evidence": "Parade day moved to 22 October 2026.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": "2026-10-22"
    },
    "evidence": "Parade day moved to 22 October 2026.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": "2026-10-22"
    },
    "evidence": "Parade day moved to 22 October 2026.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  }
]
```

## Case 11: Two-token new Person

Internal id (for facilitators only after review): `two-token-person-create`

### RAW CAPTURE

```text
Please add Jordan Hale as the new lighting lead.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-candy",
  "people": [
    {
      "id": "person-gumdrop",
      "name": "Pippa Gumdrop",
      "role": "UAT lead"
    },
    {
      "id": "person-fizz",
      "name": "Fizz Caramel",
      "role": "Designer"
    }
  ],
  "risks": [
    {
      "id": "risk-bridge",
      "projectId": "proj-candy",
      "title": "Gumdrop Bridge icing",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-pack",
      "projectId": "proj-candy",
      "title": "Prepare the jelly pack",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-parade",
      "projectId": "proj-candy",
      "label": "Parade day",
      "startAt": "2026-10-15T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Jordan Hale is a new lighting lead. (create; target=new/unbound; ambiguity=no)

### SYSTEM X

```json
[
  {
    "domain": "person",
    "subject": "Jordan Hale is to be added as the new lighting lead.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Jordan Hale"
    },
    "evidence": "Please add Jordan Hale as the new lighting lead.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "person",
    "subject": "Jordan Hale is to be added as the new lighting lead.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Jordan Hale"
    },
    "evidence": "Please add Jordan Hale as the new lighting lead.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "person",
    "subject": "Jordan Hale",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Jordan Hale",
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
    "evidence": "Please add Jordan Hale as the new lighting lead.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "responsibility",
    "subject": "Jordan Hale — lighting lead",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": null,
      "personName": "Jordan Hale",
      "title": null,
      "date": null,
      "status": null,
      "scope": "lighting lead",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "Please add Jordan Hale as the new lighting lead.",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  }
]
```

## Case 12: Vague concern

Internal id (for facilitators only after review): `vague-parade`

### RAW CAPTURE

```text
I'm a bit worried about the parade.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-candy",
  "people": [
    {
      "id": "person-gumdrop",
      "name": "Pippa Gumdrop",
      "role": "UAT lead"
    },
    {
      "id": "person-fizz",
      "name": "Fizz Caramel",
      "role": "Designer"
    }
  ],
  "risks": [
    {
      "id": "risk-bridge",
      "projectId": "proj-candy",
      "title": "Gumdrop Bridge icing",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-pack",
      "projectId": "proj-candy",
      "title": "Prepare the jelly pack",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-parade",
      "projectId": "proj-candy",
      "label": "Parade day",
      "startAt": "2026-10-15T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Vague parade worry is not a write. (left_untouched|no_change|needs_you; target=new/unbound; ambiguity=yes)

### SYSTEM X

```json
[
  {
    "domain": "commentary",
    "subject": "The speaker is worried about the parade.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "I'm a bit worried about the parade.",
    "ambiguity": "The concern is vague and does not specify what should change regarding the parade.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "unsupported",
    "subject": "Worry about the parade",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "I'm a bit worried about the parade.",
    "ambiguity": "Vague worry with no named change cannot safely become a project operation.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "commentary",
    "subject": "The speaker is worried about the parade.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "I'm a bit worried about the parade.",
    "ambiguity": "It isn't clear what specific concerns the speaker has about the parade.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

## Case 13: Contradictory dates for the same milestone

Internal id (for facilitators only after review): `contradict-parade`

### RAW CAPTURE

```text
Parade day is now 29 October 2026. Also, keep Parade day on 15 October 2026.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-candy",
  "people": [
    {
      "id": "person-gumdrop",
      "name": "Pippa Gumdrop",
      "role": "UAT lead"
    },
    {
      "id": "person-fizz",
      "name": "Fizz Caramel",
      "role": "Designer"
    }
  ],
  "risks": [
    {
      "id": "risk-bridge",
      "projectId": "proj-candy",
      "title": "Gumdrop Bridge icing",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-pack",
      "projectId": "proj-candy",
      "title": "Prepare the jelly pack",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-parade",
      "projectId": "proj-candy",
      "label": "Parade day",
      "startAt": "2026-10-15T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Parade day dates contradict — do not write a chosen date. (needs_you|left_untouched; target=ms-parade; ambiguity=yes)

### SYSTEM X

```json
[
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": "2026-10-29"
    },
    "evidence": "Parade day is now 29 October 2026.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": "2026-10-15"
    },
    "evidence": "Also, keep Parade day on 15 October 2026.",
    "ambiguity": "omitted",
    "disposition": "no_change",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "milestone",
    "subject": "Parade day date",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
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
    "ambiguity": "Should Parade day be on 29 October 2026 or 15 October 2026?",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": "2026-10-29"
    },
    "evidence": "Parade day is now 29 October 2026.",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": "2026-10-15"
    },
    "evidence": "Also, keep Parade day on 15 October 2026.",
    "ambiguity": "omitted",
    "disposition": "no_change",
    "writeProposed": false
  }
]
```

## Case 14: Unsupported milestone removal

Internal id (for facilitators only after review): `unsupported-remove`

### RAW CAPTURE

```text
Please delete Parade day from the plan.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-candy",
  "people": [
    {
      "id": "person-gumdrop",
      "name": "Pippa Gumdrop",
      "role": "UAT lead"
    },
    {
      "id": "person-fizz",
      "name": "Fizz Caramel",
      "role": "Designer"
    }
  ],
  "risks": [
    {
      "id": "risk-bridge",
      "projectId": "proj-candy",
      "title": "Gumdrop Bridge icing",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-pack",
      "projectId": "proj-candy",
      "title": "Prepare the jelly pack",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-parade",
      "projectId": "proj-candy",
      "label": "Parade day",
      "startAt": "2026-10-15T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Milestone delete is unsupported — no canonical write. (left_untouched|needs_you; target=ms-parade; ambiguity=no)

### SYSTEM X

```json
[
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": null
    },
    "evidence": "Please delete Parade day from the plan.",
    "ambiguity": "The request to delete the milestone indicates it should be removed from the project plan.",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": {
      "label": "Parade day",
      "date": null
    },
    "evidence": "Please delete Parade day from the plan.",
    "ambiguity": "The request to delete the milestone indicates a change to the current project state.",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "milestone",
    "subject": "Parade day",
    "referencedCanonicalId": "ms-parade",
    "assertedValue": "omitted",
    "evidence": "Please delete Parade day from the plan.",
    "ambiguity": "omitted",
    "disposition": "remove",
    "writeProposed": true
  }
]
```

## Case 15: Noisy conversational mixed Capture

Internal id (for facilitators only after review): `noisy-conversational`

### RAW CAPTURE

```text
ok so like, quick dump from the standup — ignore me coughing
anyway Pippa's still doing UAT, that's fine
oh and can someone actually order extra sprinkles? that's a real to-do
uhhh the bridge icing thing is resolved now, they salted it
biscuits for the cabin, not a control, skip that
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-candy",
  "people": [
    {
      "id": "person-gumdrop",
      "name": "Pippa Gumdrop",
      "role": "UAT lead"
    },
    {
      "id": "person-fizz",
      "name": "Fizz Caramel",
      "role": "Designer"
    }
  ],
  "risks": [
    {
      "id": "risk-bridge",
      "projectId": "proj-candy",
      "title": "Gumdrop Bridge icing",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-pack",
      "projectId": "proj-candy",
      "title": "Prepare the jelly pack",
      "done": false
    }
  ],
  "dates": [
    {
      "id": "ms-parade",
      "projectId": "proj-candy",
      "label": "Parade day",
      "startAt": "2026-10-15T12:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- Pippa remains UAT lead. (no_change|update; target=person-gumdrop; ambiguity=no)
- New to-do to order extra sprinkles. (create; target=new/unbound; ambiguity=no)
- Gumdrop Bridge icing is resolved. (update; target=risk-bridge; ambiguity=no)

### SYSTEM X

```json
[
  {
    "domain": "unsupported",
    "subject": "Standup preamble",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "ok so like, quick dump from the standup — ignore me coughing",
    "ambiguity": "Irrelevant chatter.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "responsibility",
    "subject": "Pippa Gumdrop remains UAT lead",
    "referencedCanonicalId": "resp-uat",
    "assertedValue": {
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
    "evidence": "anyway Pippa's still doing UAT, that's fine",
    "ambiguity": "omitted",
    "disposition": "no_change",
    "writeProposed": false
  },
  {
    "domain": "todo",
    "subject": "Order extra sprinkles",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": null,
      "personName": null,
      "title": "Order extra sprinkles",
      "date": null,
      "status": null,
      "scope": null,
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "oh and can someone actually order extra sprinkles? that's a real to-do",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "risk",
    "subject": "Gumdrop Bridge icing resolved",
    "referencedCanonicalId": "risk-bridge",
    "assertedValue": {
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
    "evidence": "uhhh the bridge icing thing is resolved now, they salted it",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "unsupported",
    "subject": "Biscuits for the cabin",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "biscuits for the cabin, not a control, skip that",
    "ambiguity": "Explicitly excluded from project changes.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "person",
    "subject": "Pippa Gumdrop",
    "referencedCanonicalId": "person-gumdrop",
    "assertedValue": {
      "title": "Pippa Gumdrop",
      "label": "Pippa Gumdrop",
      "name": "Pippa Gumdrop",
      "personName": "Pippa Gumdrop"
    },
    "evidence": "Pippa's still doing UAT, that's fine",
    "ambiguity": "This Person identity is not established in the Capture. A supplied record id is not enough.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "todo",
    "subject": "There is a to-do to order extra sprinkles.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "title": "Order extra sprinkles"
    },
    "evidence": "can someone actually order extra sprinkles? that's a real to-do",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "risk",
    "subject": "Gumdrop Bridge icing",
    "referencedCanonicalId": "risk-bridge",
    "assertedValue": {
      "status": "resolved"
    },
    "evidence": "the bridge icing thing is resolved now, they salted it",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "commentary",
    "subject": "Biscuits for the cabin are not a control.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "biscuits for the cabin, not a control, skip that",
    "ambiguity": "This statement does not indicate a change or decision.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "ok so like, quick dump from the standup — ignore me coughing anyway",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "ok so like, quick dump from the standup — ignore me coughing anyway",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "person",
    "subject": "Pippa Gumdrop",
    "referencedCanonicalId": "person-gumdrop",
    "assertedValue": "omitted",
    "evidence": "Pippa's still doing UAT, that's fine",
    "ambiguity": "This Person identity is not established in the Capture. A supplied record id is not enough.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "todo",
    "subject": "There is a to-do to order extra sprinkles.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "title": "Order extra sprinkles"
    },
    "evidence": "can someone actually order extra sprinkles? that's a real to-do",
    "ambiguity": "omitted",
    "disposition": "create",
    "writeProposed": true
  },
  {
    "domain": "risk",
    "subject": "Gumdrop Bridge icing",
    "referencedCanonicalId": "risk-bridge",
    "assertedValue": {
      "status": "resolved"
    },
    "evidence": "the bridge icing thing is resolved now, they salted it",
    "ambiguity": "omitted",
    "disposition": "update",
    "writeProposed": true
  },
  {
    "domain": "commentary",
    "subject": "Biscuits for the cabin are not a control.",
    "referencedCanonicalId": "omitted",
    "assertedValue": "omitted",
    "evidence": "biscuits for the cabin, not a control, skip that",
    "ambiguity": "The statement about biscuits does not indicate a project action or change.",
    "disposition": "left_untouched",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "ok so like, quick dump from the standup — ignore me coughing anyway",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "ok so like, quick dump from the standup — ignore me coughing anyway",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

## Case 16: Harbourline first-name-only Sarah

Internal id (for facilitators only after review): `harbourline-sarah-first-name`

### RAW CAPTURE

```text
I think Sarah owns communications now? Not sure which Sarah.
```

### CANONICAL PROJECT CONTEXT

```json
{
  "projectId": "proj-harbourline",
  "people": [
    {
      "id": "person-hca-miriam",
      "name": "Miriam Cole",
      "role": "Programme sponsor / City Clerk"
    },
    {
      "id": "person-hca-owen",
      "name": "Owen Hart",
      "role": "Archives delivery lead"
    },
    {
      "id": "person-hca-priya",
      "name": "Priya Nair",
      "role": "Civic ICT lead"
    },
    {
      "id": "person-hca-lila",
      "name": "Lila Berg",
      "role": "Conservation lead"
    }
  ],
  "risks": [
    {
      "id": "risk-hca-mould",
      "projectId": "proj-harbourline",
      "title": "Mould in the wet-store",
      "status": "open"
    },
    {
      "id": "risk-hca-helix",
      "projectId": "proj-harbourline",
      "title": "Helix scanning queue overruns autumn",
      "status": "open"
    }
  ],
  "todos": [
    {
      "id": "todo-hca-spec",
      "projectId": "proj-harbourline",
      "title": "Issue scan specification to Helix",
      "done": false
    },
    {
      "id": "todo-hca-dehumid",
      "projectId": "proj-harbourline",
      "title": "Book wet-store dehumidifier",
      "done": false
    },
    {
      "id": "todo-hca-inventory",
      "projectId": "proj-harbourline",
      "title": "Series inventory of Minutes 1985–1995",
      "done": true
    }
  ],
  "dates": [
    {
      "id": "ms-hca-cabinet",
      "projectId": "proj-harbourline",
      "label": "Cabinet paper",
      "startAt": "2026-09-12T09:00:00.000Z"
    },
    {
      "id": "ms-hca-spec",
      "projectId": "proj-harbourline",
      "label": "Scan specification freeze",
      "startAt": "2026-10-02T09:00:00.000Z"
    },
    {
      "id": "ms-hca-launch",
      "projectId": "proj-harbourline",
      "label": "Public launch",
      "startAt": "2027-04-09T09:00:00.000Z"
    }
  ]
}
```

### EXPECTED MATERIAL FACTS

- First-name-only Sarah is not Hannah Wells and is not a write. (needs_you|left_untouched; target=new/unbound; ambiguity=yes)

### SYSTEM X

```json
[
  {
    "domain": "responsibility",
    "subject": "Communications ownership",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "name": "Sarah",
      "personName": "Sarah",
      "title": null,
      "date": null,
      "status": null,
      "scope": "communications",
      "ownershipSemantics": null,
      "text": null,
      "awayFromIso": null,
      "awayToIso": null
    },
    "evidence": "I think Sarah owns communications now? Not sure which Sarah.",
    "ambiguity": "Which Sarah owns communications?",
    "disposition": "needs_you",
    "writeProposed": false
  }
]
```

### SYSTEM Y

```json
[
  {
    "domain": "unknown",
    "subject": "Not sure which Sarah.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Not sure which Sarah.",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

### SYSTEM Z

```json
[
  {
    "domain": "responsibility",
    "subject": "Owen Hart",
    "referencedCanonicalId": "person-hca-owen",
    "assertedValue": "omitted",
    "evidence": "I think Sarah owns communications now?",
    "ambiguity": "It's unclear which Sarah is being referred to.",
    "disposition": "needs_you",
    "writeProposed": false
  },
  {
    "domain": "unknown",
    "subject": "Not sure which Sarah.",
    "referencedCanonicalId": "omitted",
    "assertedValue": {
      "leftUntouched": true,
      "leftUntouchedSource": "coverage"
    },
    "evidence": "Not sure which Sarah.",
    "ambiguity": "Lume couldn't safely interpret this part of your capture.",
    "disposition": "left_untouched",
    "writeProposed": false
  }
]
```

