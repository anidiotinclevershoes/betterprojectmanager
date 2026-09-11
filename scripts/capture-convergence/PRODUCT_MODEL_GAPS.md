# Phase 4 — Product-model gaps (do not code around)

These three frozen cases still fail. They are **not** extractor or planner bugs. Lume has no legitimate canonical operation for the truth the user is trying to express.

## 1. Cancel / remove a dated item (`gap-cab-cancel-remove`)

**Example input:** “The CAB preparation session is cancelled and is no longer required.”

**Truth:** The CAB prep date should no longer stand as a current milestone.

**Why the model cannot represent it:** Timeline items have no completed/cancelled status. `planMilestone` for `op === "complete"` is Needs You: “Completing a date is not supported yet.” There is no `cancel_milestone` / remove write. Treating cancel as `complete` would lie. Treating it as a date move would invent a new date.

**Options:**
- Add a canonical milestone lifecycle (cancelled / removed) and a receipted Apply operation.
- Represent cancellation as superseding the dated record with an explicit end, without a second milestone.
- Keep Needs You until a product decision exists (current honest behaviour).

**Block convergence?** No. Honest Needs You is correct until the product names a cancel write. Do not silently complete or delete.

## 2. Supersede knowledge (`gap-runbook-v3-retire-v2`)

**Example input:** “Cutover runbook v3 is now the working runbook.”

**Truth:** v3 is current; v2 should no longer be the working runbook.

**Why the model cannot represent it:** Knowledge create is `write_knowledge`. There is no structured runbook-version field and no automatic retire/replace of the prior fact. `replace_knowledge` exists for pin/replace flows, not “this version supersedes that version” from prose.

**Options:**
- Knowledge replace/supersede when the user names the prior artefact.
- Versioned knowledge items with an explicit current pointer.
- Leave as a new fact + Needs You if retirement is unclear (do not guess v2’s id).

**Block convergence?** No. Creating another fact without retiring v2 is the safe current write. Silent retire would be unsafe guessing.

## 3. Cancel extracted as knowledge (`gap-cab-as-knowledge`)

**Example input:** same cancel sentence, extracted as `domain: knowledge`.

**Truth:** Same as (1) — the date should not remain standing.

**Why the model cannot represent it:** If the extractor (or a frozen envelope) classifies cancel as knowledge, the planner legally writes a note. That note does not remove the milestone. This is both a possible extractor class error (A, live only) and a product-model gap (C): even a perfect extract has no cancel write.

**Options:**
- Same as (1). Optionally, Review can Needs You knowledge-that-negates-a-date rather than write a note that leaves the date standing — that is a product rule, not a silent transform.

**Block convergence?** No. Do not invent cancel-from-knowledge.

## Recommendation

Keep these as labelled `product_model_gap` cases. They should not block the quality/convergence experiment. They should not be “fixed” by prompt text that pretends cancel/retire exist.
