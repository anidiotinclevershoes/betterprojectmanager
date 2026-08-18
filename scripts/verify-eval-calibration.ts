/**
 * Evaluator calibration unit checks (Phase 2B).
 * Ensures known false-negatives from Pre-Intelligence-Changes v1 score correctly.
 */
import assert from "node:assert/strict";
import {
  claimPresentPositively,
  factMatched,
  scoreCaseAgainstAnswer,
} from "../src/lib/evals/scoring";
import { getCase } from "../src/lib/evals/fixtures";
import type { SystemAnswerRecord } from "../src/lib/evals/types";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

function ans(text: string, confidence = "direct_confirmation"): SystemAnswerRecord {
  return {
    system: "lume",
    answer: text,
    confidence,
    sources: [],
    model: "test",
    provider: "test",
    usage: null,
    durationMs: 1,
    error: null,
  };
}

check("negation: forbidden claim not matched inside 'has not …'", () => {
  assert.equal(
    claimPresentPositively(
      "The integration start has not officially moved to 15 September.",
      "Officially moved to 15 September",
    ),
    false,
  );
  assert.equal(
    claimPresentPositively(
      "No, Security has not approved the Meridian release.",
      "Security has approved",
    ),
    false,
  );
  assert.equal(
    claimPresentPositively(
      "Vendor Nimbus has not been selected for build.",
      "Nimbus has been selected",
    ),
    false,
  );
});

check("negation: positive forbidden claims still match", () => {
  assert.equal(
    claimPresentPositively(
      "Yes, Security has approved the Meridian release.",
      "Security has approved",
    ),
    true,
  );
  assert.equal(
    claimPresentPositively(
      "It has officially moved to 15 September.",
      "Officially moved to 15 September",
    ),
    true,
  );
});

check("semantic: not selected ↔ not been selected", () => {
  assert.equal(
    factMatched("Vendor Nimbus has not been selected for build.", "not selected"),
    true,
  );
  assert.equal(
    factMatched(
      "No, Security has not approved the Meridian release.",
      "no security approval",
    ),
    true,
  );
});

check("Meridian security firm No → pass (not uncertainty fail)", () => {
  const f = getCase("v1-meridian-q3-security-approved")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("No, Security has not approved the Meridian release."),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Meridian security invented Yes → trust fail", () => {
  const f = getCase("v1-meridian-q3-security-approved")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("Yes — Security has approved the Meridian release."),
  );
  assert.equal(s.band, "fail");
  assert.ok(s.hardFailures.includes("trust_failure"));
});

check("Harbor 15 Sep negated → pass", () => {
  const f = getCase("v1-harbor-q8-slip-confirmed")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans(
      "The integration start has not officially moved to 15 September. Formal target remains 8 September.",
    ),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Quiet Nimbus firm No → pass (not critical)", () => {
  const f = getCase("v1-quiet-q6-nimbus")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("Vendor Nimbus has not been selected for build."),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.includes("critical_intelligence_failure"), false);
});

check("Quiet Nimbus selected Yes → critical/trust", () => {
  const f = getCase("v1-quiet-q6-nimbus")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("Nimbus has been selected for the build."),
  );
  assert.equal(s.band, "fail");
  assert.ok(
    s.hardFailures.includes("trust_failure") ||
      s.hardFailures.includes("critical_intelligence_failure"),
  );
});

check("sample monday Yes → still critical", () => {
  const f = getCase("sample-atlas-q3-dev-monday")!;
  const s = scoreCaseAgainstAnswer(f, ans("Yes."));
  assert.ok(s.hardFailures.includes("critical_intelligence_failure"));
});

console.log(`\n${passed} calibration checks passed`);
