CAPTURE CONVERGENCE GATE — BASELINE MAP
Observe-only. Do not treat this as a green/red product gate.
Source SHA:     17a3e413282b6c7014c3bada09527c22426654c0
Experiment SHA: 3e98d9c7916832cb2f3550f406fa18720ea96e54
Generated at:   2026-09-12T03:55:56.791Z
Runtime:        107 ms

TOTAL CASES  538
PASS         534
FAIL         4

By family:
  historical_regression              17/17 pass   0 fail
  information_preservation           21/21 pass   0 fail
  cross_observation_contamination    18/18 pass   0 fail
  order_invariance                   48/48 pass   0 fail
  irrelevant_context                 210/210 pass   0 fail
  ambiguity_isolation                56/56 pass   0 fail
  malformed_isolation                70/70 pass   0 fail
  identity_matrix                    12/13 pass   1 fail
  composition                        20/20 pass   0 fail
  duplication                        19/19 pass   0 fail
  contradiction                      4/4 pass   0 fail
  product_model_gap                  0/3 pass   3 fail
  held_out                           39/39 pass   0 fail

Historical catalogue behaviours: 35 (capture 27, new-project 8)
Perturbation/metamorphic cases:  463
Held-out scenarios:              39
UNIQUE failure families:         4
Architecture judgement:          A
A small number of clusters account for most failures. Bounded defects are plausible; confirm before treating as a rewrite.

Failure clusters (same observed transition; not proven one root cause):
  [cluster-01] Planner / write-eligibility divergence at PLANNER  n=1  class=PLANNER  stage=PLANNER
      id-pippa-first-on-candy
  [cluster-02] Product-model gap: cab-cancelled  n=1  class=PRODUCT MODEL GAP  stage=PLANNER
      gap-cab-cancel-remove
  [cluster-03] Product-model gap: runbook-v3  n=1  class=PRODUCT MODEL GAP  stage=PLANNER
      gap-runbook-v3-retire-v2
  [cluster-04] Product-model gap: cab-as-knowledge  n=1  class=PRODUCT MODEL GAP  stage=PLANNER
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
--- id-pippa-first-on-candy  seed=504018082  family=identity_matrix
    base: pippa-first-name
    perturbation: unique first name Pippa on Candyland
    expected: Disposition no_change with a first-name-only statement must not write; Lume currently short-circuits no_change before the identity gate
    actual: obs-pippa-first: decision needs_you (expected no_change)
    earliest stage: PLANNER
    class: PLANNER
    reproduce: npx tsx scripts/verify-capture-convergence.ts --id id-pippa-first-on-candy
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
  npx tsx scripts/verify-capture-convergence.ts --id id-pippa-first-on-candy
  npx tsx scripts/verify-capture-convergence.ts --id gap-cab-cancel-remove
  npx tsx scripts/verify-capture-convergence.ts --id gap-runbook-v3-retire-v2
  npx tsx scripts/verify-capture-convergence.ts --id gap-cab-as-knowledge

HELD-OUT SET is process-isolated. Do not tune against it until evaluation.