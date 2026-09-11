CAPTURE CONVERGENCE GATE — BASELINE MAP
Observe-only. Do not treat this as a green/red product gate.
Source SHA:     90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b
Experiment SHA: 009b4fab7d71b264cc8b4faec6e87a49112f071f
Generated at:   2026-09-11T23:21:55.416Z
Runtime:        118 ms

TOTAL CASES  538
PASS         535
FAIL         3

By family:
  historical_regression              17/17 pass   0 fail
  information_preservation           21/21 pass   0 fail
  cross_observation_contamination    18/18 pass   0 fail
  order_invariance                   48/48 pass   0 fail
  irrelevant_context                 210/210 pass   0 fail
  ambiguity_isolation                56/56 pass   0 fail
  malformed_isolation                70/70 pass   0 fail
  identity_matrix                    13/13 pass   0 fail
  composition                        20/20 pass   0 fail
  duplication                        19/19 pass   0 fail
  contradiction                      4/4 pass   0 fail
  product_model_gap                  0/3 pass   3 fail
  held_out                           39/39 pass   0 fail

Historical catalogue behaviours: 35 (capture 27, new-project 8)
Perturbation/metamorphic cases:  463
Held-out scenarios:              39
UNIQUE failure families:         3
Architecture judgement:          A
A small number of clusters account for most failures. Bounded defects are plausible; confirm before treating as a rewrite.

Failure clusters (same observed transition; not proven one root cause):
  [cluster-01] Product-model gap: cab-cancelled  n=1  class=PRODUCT MODEL GAP  stage=PLANNER
      gap-cab-cancel-remove
  [cluster-02] Product-model gap: runbook-v3  n=1  class=PRODUCT MODEL GAP  stage=PLANNER
      gap-runbook-v3-retire-v2
  [cluster-03] Product-model gap: cab-as-knowledge  n=1  class=PRODUCT MODEL GAP  stage=PLANNER
      gap-cab-as-knowledge

Combined-only breaks:
  (none recorded)
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
  npx tsx scripts/verify-capture-convergence.ts --id gap-cab-cancel-remove
  npx tsx scripts/verify-capture-convergence.ts --id gap-runbook-v3-retire-v2
  npx tsx scripts/verify-capture-convergence.ts --id gap-cab-as-knowledge

HELD-OUT SET is process-isolated. Do not tune against it until evaluation.