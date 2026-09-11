CAPTURE CONVERGENCE GATE — BASELINE MAP
Observe-only. Do not treat this as a green/red product gate.
Source SHA:     58b15c8fd5552dc07a2139632b683a9ca3c61df9
Experiment SHA: 3f665cb2388b023c03e3253f2489a6cccdc81552
Generated at:   2026-09-11T10:24:02.405Z
Runtime:        97 ms

TOTAL CASES  534
PASS         525
FAIL         9

By family:
  historical_regression              16/16 pass   0 fail
  information_preservation           18/18 pass   0 fail
  cross_observation_contamination    13/18 pass   5 fail
  order_invariance                   48/48 pass   0 fail
  irrelevant_context                 210/210 pass   0 fail
  ambiguity_isolation                56/56 pass   0 fail
  malformed_isolation                70/70 pass   0 fail
  identity_matrix                    13/13 pass   0 fail
  composition                        20/20 pass   0 fail
  duplication                        19/19 pass   0 fail
  contradiction                      3/4 pass   1 fail
  product_model_gap                  0/3 pass   3 fail
  held_out                           39/39 pass   0 fail

Historical catalogue behaviours: 33 (capture 27, new-project 6)
Perturbation/metamorphic cases:  460
Held-out scenarios:              39
UNIQUE failure families:         5
Architecture judgement:          B
Independent observations change identity reasonClass / bind when sibling names appear in the same Capture. Strong evidence of transcript-wide identity coupling. Product-model gaps are separate and should not be treated as the same defect.

Failure clusters (same observed transition; not proven one root cause):
  [cluster-01] Transcript-wide identity gate (identityEvidenceText uses the whole Capture)  n=5  class=IDENTITY RESOLUTION  stage=IDENTITY
      cross-andris-olga-uat, cross-andris-sarah-rel, cross-olga-sarah, cross-olga-sarah-rev, cross-andris-transcript-olga-sarah
  [cluster-02] Contradictory sibling observations both stay Apply-eligible writes  n=1  class=PLANNER  stage=PLANNER
      contra-risk-open-and-closed
  [cluster-03] Product-model gap: cab-cancelled  n=1  class=PRODUCT MODEL GAP  stage=PLANNER
      gap-cab-cancel-remove
  [cluster-04] Product-model gap: runbook-v3  n=1  class=PRODUCT MODEL GAP  stage=PLANNER
      gap-runbook-v3-retire-v2
  [cluster-05] Product-model gap: cab-as-knowledge  n=1  class=PRODUCT MODEL GAP  stage=PLANNER
      gap-cab-as-knowledge

Combined-only breaks:
  cross-andris-olga-uat
  cross-andris-sarah-rel
  cross-olga-sarah
  cross-olga-sarah-rev
  cross-andris-transcript-olga-sarah
Order changes semantics:
  (none)
Unrelated context changes semantics:
  (none)
Information-loss cases:
  (none)
Product-model gaps (not coding bugs):
  gap-cab-cancel-remove
  gap-runbook-v3-retire-v2
  gap-cab-as-knowledge

Failures:
--- cross-andris-olga-uat  seed=3247213658  family=cross_observation_contamination
    base: andris
    perturbation: Andris + Olga UAT observations together
    expected: Andris decision/reasonClass stays the solo incomplete-name Needs You; Olga must not retarget Andris
    actual: obs-andris: responsibility|create_new|current|needs_you||responsibility||andris|legacy||kept||needs_you_identity_incomplete → responsibility|create_new|current|needs_you||responsibility|person-olga|olga petrov|legacy||kept||needs_you_identity_mismatch
    earliest stage: IDENTITY
    class: IDENTITY RESOLUTION
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id cross-andris-olga-uat
--- cross-andris-sarah-rel  seed=1844617163  family=cross_observation_contamination
    base: andris
    perturbation: Andris + Sarah Release together
    expected: Andris stays independent of Sarah
    actual: obs-andris: responsibility|create_new|current|needs_you||responsibility||andris|legacy||kept||needs_you_identity_incomplete → responsibility|create_new|current|needs_you||responsibility|person-sarah|sarah kim|legacy||kept||needs_you_identity_mismatch
    earliest stage: IDENTITY
    class: IDENTITY RESOLUTION
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id cross-andris-sarah-rel
--- cross-olga-sarah  seed=1877637763  family=cross_observation_contamination
    base: olga-uat
    perturbation: Olga UAT + Sarah Release
    expected: Each person's scope stays on that person
    actual: obs-olga-uat: responsibility|create_new|current|write|confirm_responsibility|responsibility|person-olga|olga petrov|uat||kept||write → responsibility|create_new|current|needs_you||responsibility||olga petrov|uat||kept||needs_you_identity_multiple
    earliest stage: IDENTITY
    class: IDENTITY RESOLUTION
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id cross-olga-sarah
--- cross-olga-sarah-rev  seed=981617523  family=cross_observation_contamination
    base: sarah-release
    perturbation: Olga UAT + Sarah Release (reversed order)
    expected: Each person's scope stays on that person
    actual: obs-sarah-rel: responsibility|create_new|current|write|confirm_responsibility|responsibility|person-sarah|sarah kim|release||kept||write → responsibility|create_new|current|needs_you||responsibility||sarah kim|release||kept||needs_you_identity_multiple
    earliest stage: IDENTITY
    class: IDENTITY RESOLUTION
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id cross-olga-sarah-rev
--- cross-andris-transcript-olga-sarah  seed=2154363882  family=cross_observation_contamination
    base: andris
    perturbation: Andris envelope only; transcript also names Olga Petrov and Sarah Kim
    expected: Sibling names in the Capture text must not change Andris from incomplete-name to multiple-match
    actual: obs-andris: responsibility|create_new|current|needs_you||responsibility||andris|legacy||kept||needs_you_identity_incomplete → responsibility|create_new|current|needs_you||responsibility||andris|legacy||kept||needs_you_identity_multiple
    earliest stage: IDENTITY
    class: IDENTITY RESOLUTION
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id cross-andris-transcript-olga-sarah
--- contra-risk-open-and-closed  seed=1678779826  family=contradiction
    base: bridge-open-closed
    perturbation: same risk open and resolved
    expected: Opposite risk statuses stay local / Needs You; no silent last-write-wins Apply Ready pair
    actual: contradiction locality: 2 focus writes and 0 Needs You (expected conflict to stay local)
    earliest stage: PLANNER
    class: PLANNER
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id contra-risk-open-and-closed
--- gap-cab-cancel-remove  seed=2359560588  family=product_model_gap
    base: cab-cancelled
    perturbation: none
    expected: PRODUCT MODEL: a cancelled dated item should be a cancel/remove write, not Needs You-as-complete
    actual: obs-cab: decision needs_you (expected write) | obs-cab: writeType null (expected cancel_milestone)
    earliest stage: PLANNER
    class: PRODUCT MODEL GAP
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id gap-cab-cancel-remove
--- gap-runbook-v3-retire-v2  seed=1225982585  family=product_model_gap
    base: runbook-v3
    perturbation: none
    expected: PRODUCT MODEL: superseding runbook v3 should retire v2, not only create another knowledge fact
    actual: obs-runbook: writeType write_knowledge (expected replace_knowledge)
    earliest stage: PLANNER
    class: PRODUCT MODEL GAP
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id gap-runbook-v3-retire-v2
--- gap-cab-as-knowledge  seed=1462307686  family=product_model_gap
    base: cab-as-knowledge
    perturbation: cancelled date extracted as knowledge
    expected: PRODUCT MODEL: cancelling a date must not become a note that leaves the date standing
    actual: obs-cab-know: writeType write_knowledge (expected cancel_milestone)
    earliest stage: PLANNER
    class: PRODUCT MODEL GAP
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id gap-cab-as-knowledge

Reproduce all failures:
  npx tsx scripts/verify-capture-convergence.ts --id cross-andris-olga-uat
  npx tsx scripts/verify-capture-convergence.ts --id cross-andris-sarah-rel
  npx tsx scripts/verify-capture-convergence.ts --id cross-olga-sarah
  npx tsx scripts/verify-capture-convergence.ts --id cross-olga-sarah-rev
  npx tsx scripts/verify-capture-convergence.ts --id cross-andris-transcript-olga-sarah
  npx tsx scripts/verify-capture-convergence.ts --id contra-risk-open-and-closed
  npx tsx scripts/verify-capture-convergence.ts --id gap-cab-cancel-remove
  npx tsx scripts/verify-capture-convergence.ts --id gap-runbook-v3-retire-v2
  npx tsx scripts/verify-capture-convergence.ts --id gap-cab-as-knowledge

HELD-OUT SET is process-isolated. Do not tune against it until evaluation.