# Hosted holdout journey matrix

Suite: hosted-holdout-v1
Runtime: 92s

| Journey | Vercel access | Lume auth | Hosted API | Live OpenAI | UI interpretation | Review | Apply | Reload/persistence | Result | Classification | Earliest boundary |
|---|---|---|---|---|---|---|---|---|---|---|---|
| New Project issues and dated todos | PASS | PASS | PASS | PASS | PASS | n/a | PASS | PASS | PASS |  |  |
| Capture create dated action | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |  |  |
| Capture ISO date update | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |  |  |
| Multi-person identity isolation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |  |  |
| Ambiguous they plus safe date | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | PRODUCT_DEFECT | REVIEW_UI |
| Messy ops paste | PASS | PASS | PASS | PASS | FAIL | n/a | n/a | n/a | FAIL | PRODUCT_DEFECT | REVIEW_UI |
