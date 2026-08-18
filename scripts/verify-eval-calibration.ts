/**
 * Evaluator calibration unit checks (Phase 2B).
 * Ensures known false-negatives from Pre-Intelligence-Changes v1 score correctly.
 * Final baseline pass: additional FN/FP cases from after #33.
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

// —— Final baseline calibration (after #33) ——

check("Meridian original date: Yes + 19 Aug → pass (26 Aug optional)", () => {
  const f = getCase("v1-meridian-q8-original-date")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("Yes, the original target go-live date was 19 August."),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Meridian CAB readiness: firm No with evidence → pass", () => {
  const f = getCase("v1-meridian-q9-ops-slack")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans(
      "No — CAB is not ready. There is no security approval, UX copy freeze is unsigned, and the Ops Slack note is informal optimism rather than a confirmed decision.",
    ),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Northline Jordan ownership: direct No → pass", () => {
  const f = getCase("v1-northline-q2-jordan-snyk")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("No, Jordan does not own security sign-off."),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Northline Riley: cannot approve ≡ not authorised → pass", () => {
  const f = getCase("v1-northline-q4-riley-scope")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("No — Riley cannot approve scope changes while Jordan is on leave."),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Cascade Finance-only: No + HR → pass", () => {
  const f = getCase("v1-cascade-q3-finance-only")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("No, it now includes HR as well."),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Cascade HR ownership: both own ≡ joint → pass", () => {
  const f = getCase("v1-cascade-q7-hr-owner")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("Helen and Omar both own the HR onboarding process design."),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Quiet budget: can't find (no number) → pass, not forbidden £", () => {
  const f = getCase("v1-quiet-q8-budget")!;
  assert.equal(
    claimPresentPositively(
      "I can't find confirmation of the approved budget.",
      "The budget is £",
    ),
    false,
  );
  const s = scoreCaseAgainstAnswer(
    f,
    ans("I can't find confirmation of the approved budget.", "not_found"),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Quiet budget: invented £ amount → fail", () => {
  const f = getCase("v1-quiet-q8-budget")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("The approved budget is £2.4m."),
  );
  assert.equal(s.band, "fail");
});

check("Northline security owner: invented Ava → trust_failure", () => {
  const f = getCase("v1-northline-q9-security-owner")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("Ava Chen owns the security sign-off."),
  );
  assert.equal(s.band, "fail");
  assert.ok(s.hardFailures.includes("trust_failure"));
  assert.equal(
    s.hardFailures.includes("critical_intelligence_failure"),
    false,
    "fabricated ownership is trust, not critical dependency miss",
  );
});

check("Northline security owner: not recorded → pass", () => {
  const f = getCase("v1-northline-q9-security-owner")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("Not recorded — no security sign-off owner is stated in the project information."),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Meridian Snyk: two remain open (stale) → fail + trust", () => {
  const f = getCase("v1-meridian-q7-snyk-status")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("No — two Snyk critical findings remain open."),
  );
  assert.equal(s.band, "fail");
  assert.ok(s.hardFailures.includes("trust_failure"));
});

check("Meridian Snyk: one remains open → pass", () => {
  const f = getCase("v1-meridian-q7-snyk-status")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("No — one Snyk critical remains open (one was cleared)."),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

check("Harbor rate limit: unofficial-as-official framing → fail", () => {
  const f = getCase("v1-harbor-q4-rate-limit")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans("The official API rate limit is unofficially stated as 100 rps."),
  );
  assert.equal(s.band, "fail");
});

check("Harbor rate limit: informal + no official → pass", () => {
  const f = getCase("v1-harbor-q4-rate-limit")!;
  const s = scoreCaseAgainstAnswer(
    f,
    ans(
      "No official rate limit is confirmed. 100 rps was mentioned informally.",
    ),
  );
  assert.equal(s.band, "pass");
  assert.equal(s.hardFailures.length, 0);
});

console.log(`\n${passed} calibration checks passed`);
