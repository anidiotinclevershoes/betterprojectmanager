# Lume Development & Evaluation Roadmap v1

**Status:** Operating roadmap / anti-whack-a-mole governance  
**Date:** 19 August 2026

This document describes **how Lume should be developed and evaluated from here**, not a fixed PR sequence.

There is no arbitrary limit on the number of legitimate fixes. There is a hard requirement that fixes remain evidence-driven, correctly layered and scoped.

---

# 1. Why the process changed

Lume entered a frustrating cycle:

> fix stale state → lose useful context  
> restore context → increase tokens  
> structure context → lose recall  
> improve recall → expose another edge case  
> fix edge case → benchmark exposes something else

Many individual changes were reasonable, but benchmark failures were beginning to become implementation instructions.

That is no longer acceptable.

The process now distinguishes:

- product defect;
- data-model defect;
- persistence defect;
- Capture defect;
- retrieval defect;
- model behaviour defect;
- UI/trust-workflow defect;
- evaluator/scorer artefact.

Only the correct layer should be changed.

---

# 2. Required format for every meaningful fix

Every implementation task should explicitly state:

## Problem

What concrete behaviour is wrong?

## Evidence

What production/dogfood/test evidence demonstrates it?

## Failure class / layer

Is it primarily:

- domain-state/data model;
- persistence;
- Capture interpretation/review;
- retrieval/context selection;
- model prompt/behaviour;
- UI/trust interaction;
- evaluator;
- other?

## Proposed correction

Why is this the smallest correct layer to change?

## Success condition

What observable result proves the failure class is fixed?

## Non-goals

What is explicitly not changing?

## Regression guard

Which trusted behaviours must remain intact?

## Rollback

How can the change be disabled/reverted safely?

Cursor should not receive “fix benchmark q7.”

It should receive a failure class such as:

> A durable person-role relationship is not persisted into maintained state, causing later Ask requests to lose a still-current vendor contact. Correct durable relationship persistence without changing unrelated retrieval or prompt behaviour.

---

# 3. Diminishing-returns rule

There is **no fixed three-PR cap**.

Intermediate fixes are legitimate if they are clearly scoped and evidence-driven.

However:

> **Repeated local fixes that merely move the failure elsewhere are evidence that the wrong layer is being changed.**

As a default discipline, after roughly two sensible attempts at the same failure class without clean resolution, stop tweaking and reassess the underlying architecture/workflow rather than continuing indefinitely.

The goal is not 45/45.

The goal is a trustworthy, useful product.

---

# 4. Prompt tuning rule

Prompt tuning is allowed but is not the default response to failure.

Only tune a prompt when:

1. the correct project information exists;
2. it has been supplied in sufficient context;
3. deterministic state/relationships are correct;
4. the issue is not better solved through UI clarification;
5. the model still behaves incorrectly.

Examples:

- If Elena's vendor-contact relationship was never in current state, changing the prompt is the wrong fix.
- If the input contains a false “owner not recorded” gap, changing the prompt is the wrong fix.
- If the scorer marks a correct negated answer wrong, changing Lume is the wrong fix.

---

# 5. Context/token policy

The product should be **streamlined, not starved**.

Current controlled request sizes are small enough that raw token cost is not a primary V1 concern compared with trust/usefulness.

The desired optimisation order is:

1. eliminate obvious duplicate semantic channels;
2. retrieve/select relevant project state;
3. preserve complete semantic meaning;
4. prefer deterministic UI/actions where AI is unnecessary;
5. reduce minor overhead only after quality is protected.

Do not routinely truncate useful selected facts.

History should not be dumped wholesale by default, but useful current context must not be omitted merely to achieve a target token ratio.

---

# 6. Current controlled benchmark history

## Pre-intelligence baseline

- Lume 34/45
- GPT 30/45
- trust reported 4
- critical 0
- Lume tokens 44,352
- GPT 21,452

## Phase 2C.1

- Lume 29/45
- GPT 31/45
- trust 2
- critical 0
- Lume 41,718
- GPT 21,491
- fixed Snyk supersession and informal/official behaviour;
- ownership remained problematic;
- mocks qualification regressed.

## Phase 2C.2

- Lume 31/45
- GPT 33/45
- trust 0
- critical 0
- Lume 49,186
- GPT 21,479
- fixed ownership/mocks while preserving trust;
- context/token cost increased.

## Model Tidy PR37

- same pinned model: `gpt-4o-mini-2024-07-18`
- Lume 30/45
- GPT 32/45
- trust 0
- critical 0
- Lume 49,157
- GPT 21,470
- ~2.29× total-token ratio.

This proved the model mismatch was not the main explanation.

## Canonical PR38

- Lume 23/45
- GPT 30/45
- trust 0
- critical 0
- Lume 37,404
- GPT 21,452
- ~1.74× total-token ratio.

This produced a real ~24% Lume token reduction but meaningful recall/completeness loss.

---

# 7. PR38 diagnostic — what it actually taught us

Genuine regressions included:

- Harbor vendor contact Elena lost;
- Cascade joint HR ownership lost/poisoned;
- Cascade Technology risk chain over-compressed;
- Quiet budget context lost;
- Quiet discovery candidate dates lost;
- Quiet pilot reasoning thinned;
- partial CAB chase completeness loss;
- Tom ownership contradiction from polarity-blind legacy extraction.

Known evaluator artefacts include several negation/substring failures and Quiet WCAG `undecided`; these should not drive architecture work.

Key diagnosis:

> **The canonical experiment mostly became too ignorant rather than more hallucinatory.**

That is useful evidence, but it does not justify another case-by-case repair ladder.

---

# 8. Static benchmark's future role

Keep `lume-intelligence-benchmark-v1` as a regression suite.

It remains useful for:

- ownership restraint;
- current-vs-historical behaviour;
- informal-vs-official handling;
- contradiction;
- qualification preservation;
- recall;
- basic connected reasoning;
- trust/critical regressions;
- gross context/token changes.

It is **not** the product's commercial north star.

Do not optimise known scorer artefacts.

Do not make external marketing claims from brittle keyword scoring.

---

# 9. Why the competitive benchmark must change

The current generic GPT baseline receives a clean curated project dossier.

That tests model comprehension fairly, but it effectively gives GPT much of Lume's core product work for free: somebody has already assembled, maintained and qualified the context.

Lume's real advantage should be tested where it actually claims value:

> **maintaining a project across a changing stream of messy updates.**

The new product benchmark therefore needs to be longitudinal.

---

# 10. Longitudinal Lume-vs-GPT benchmark philosophy

The goal is **not to rig a test GPT cannot win**.

The goal is to stop testing a category where GPT is given an artificial perfect dossier and instead test the actual product claim.

A fair baseline should receive the **same chronological raw project updates** that Lume receives.

### Lume path

Updates arrive through normal Capture/review/state maintenance.

Lume must preserve durable knowledge, supersede changes, surface ambiguity and use maintained state on later questions.

### Generic GPT baseline

A normal chat receives the same chronological raw updates in the same order and may retain its normal conversation history.

Do not secretly build a cleaned final context document for it.

### Optional ceiling baseline

A second GPT run may receive a perfect curated final dossier as a useful ceiling:

> What can a general model do if the human has already done all the information-maintenance work?

This separates **model capability** from **product/system capability**.

---

# 11. Example longitudinal world

A representative world might develop over five chronological updates.

## Day 1

> Release planned for 19 Aug. Priya owns CAB pack.

## Day 2

> Pen-test slot delayed. Release now moves to 26 Aug.

## Day 3

> Ava will be away. She is the only confirmed UX approver. No cover has been confirmed.

## Day 4

> Security says one Snyk critical is still open and requires rollback evidence before sign-off.

Also include an informal suggestion that appears plausible but is not confirmed.

## Day 5

Ask questions such as:

- What should I chase before CAB?
- What changed this week?
- Who are the current single points of failure?
- What is still unconfirmed?
- Why is the release at risk?

Then introduce a correction:

> Actually Sarah owns rollback evidence.

Then ask again and verify that the correction persists without stale ownership surviving.

---

# 12. Longitudinal benchmark dimensions

Measure at least:

- final factual correctness;
- stale-fact avoidance;
- ownership correctness;
- contradiction detection;
- qualification preservation;
- durable memory;
- update/supersession correctness;
- ambiguity detection;
- correction persistence;
- connected reasoning;
- appropriate `Lume noticed` behaviour;
- restraint;
- genuine trust failures;
- critical intelligence failures;
- number of times the user must restate known information;
- manual context-reconstruction burden.

Where marketing claims may depend on results, semantic/manual adjudication should be authoritative over brittle substring scoring.

False positives/false negatives that cannot be trusted make the benchmark unsuitable for claims.

---

# 13. Development workstreams

These are workstreams, not a fixed number of PRs.

## Workstream A — Stabilise intelligence foundation

Purpose: establish the smallest clean maintained-state architecture needed for trustworthy Capture/Knowledge/Ask.

Focus on:

- persistence correctness;
- authoritative domain state;
- durable facts;
- scoped person relationships;
- provenance;
- lifecycle/supersession;
- ambiguity/contradiction representation;
- dependency connections;
- History/evidence boundary;
- removing dangerous legacy interpretation paths;
- clean Ask context assembly;
- fixing canonical/legacy production divergence deliberately rather than accidentally.

Avoid:

- benchmark-case-specific extraction rules;
- universal duplicate truth store unless genuinely necessary;
- new prompt cycles without evidence;
- premature agents/vectors/multi-pass reasoning.

### Completion signal

There should be a coherent answer to:

> Where does each important kind of project information live, how does it change, how is provenance retained, and how does Ask receive it without reconstructing the project from competing stores?

---

## Workstream B — Knowledge Centre implementation

Use the approved Ocean screen as the visual baseline.

Implement the functional product around it:

- Browse;
- deterministic Search;
- ✦ Ask;
- selectable Knowledge items;
- rich detail/provenance;
- Needs you;
- Lume noticed;
- corrections;
- scrollable secondary frames;
- deterministic suggested questions;
- future autocomplete foundation where trivial.

Do not redesign the approved UI.

### Completion signal

A user can understand what Lume knows, find it, inspect why Lume believes it, identify ambiguity and correct it without needing to interact with raw internal storage concepts.

---

## Workstream C — Capture → Knowledge Centre loop

Make the core end-to-end workflow trustworthy and immediate.

Prove:

> Capture information  
> → review all interpretations  
> → resolve ambiguity/contradiction  
> → submit  
> → Knowledge Centre changes  
> → Search finds it  
> → Ask reasons over it  
> → later correction persists

### Completion signal

The user can perform this flow repeatedly without stale or silent AI interpretations polluting project truth.

---

## Workstream D — Longitudinal evaluation

Build the new product-intelligence test and continue the static suite as regression protection.

### Completion signal

We can answer with evidence:

> Does Lume genuinely reduce context reconstruction and maintain a changing project better than a normal generic chat receiving the same raw updates?

---

## Workstream E — Dogfooding / real-product proof

Use Lume in genuine PM work.

Explicitly log two categories:

> **Lume should already know this.**

and

> **I trusted Lume and it let me down.**

Also record genuinely useful moments where Lume surfaced something the PM would otherwise have missed.

Real-world failures should outrank invented synthetic edge cases when prioritising work.

---

# 14. Advise / Meeting Prep / Timeline priorities

## Advise

Park further development. Keep reusable foundations only when trivial. It may not be needed for V1.

## Meeting Prep

Retain if stable/useful as a secondary project frame; no major current rebuild. Disable before launch if the quality cannot justify its presence.

## Timeline

Same rule as Meeting Prep if the existing Timeline capability remains in the product.

---

# 15. UI implementation governance

The approved `LUME_V1_UI_BASELINE_OCEAN.png` and accompanying UI document are visual source of truth.

For every UI task:

1. identify the approved baseline state;
2. list the exact requested functional deltas;
3. list the locked visual elements that must not change;
4. implement only those deltas;
5. compare the result back to the baseline before merging.

Do not resurrect removed items such as Overview, Coaching, Evals, project-health dots, Progress, `More project knowledge`, frame icons or earlier dashboard metric rows.

---

# 16. Commercial/product proof

Lume should not depend on a claim such as:

> Our model scores slightly higher than ChatGPT.

A stronger product proof would be evidence that Lume:

- answers without the PM restating known context;
- avoids stale facts after updates;
- catches contradictions;
- remembers ownership/availability/dependencies;
- reduces time spent searching notes;
- surfaces useful project implications;
- asks for clarification rather than inventing certainty;
- makes corrections stick.

Marketing claims should only use metrics that have a fair reproducible measurement method.

---

# 17. Stop/reassess conditions

Stop an intelligence tactic and reassess when:

- two or more sensible iterations merely move the same failure elsewhere;
- the proposed fix requires increasing amounts of special-case language parsing;
- it improves a benchmark scorer but worsens human semantic quality;
- it adds major architecture complexity for a marginal user benefit;
- UI clarification would provide reliable truth more cheaply and transparently;
- the cost-saving measure removes useful context or qualifications;
- the product begins optimising static benchmark numbers rather than the longitudinal user problem.

The question is always:

> **Does this make Lume more trustworthy, useful and easier to maintain as a product?**

not:

> **Did one more automated case turn green?**
