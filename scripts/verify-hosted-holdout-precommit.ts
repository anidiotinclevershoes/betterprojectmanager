/**
 * Deterministic proofs that the hosted holdout is a frozen independent suite.
 * No network. No OpenAI. No hosted execution.
 *
 * Run: npx tsx scripts/verify-hosted-holdout-precommit.ts
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  HOLDOUT_FORBIDDEN_ORIGINAL_MARKERS,
  HOLDOUT_JOURNEYS,
  HOLDOUT_SUITE_ID,
  holdoutJourney,
} from "../e2e-hosted-holdout/frozen-spec";

const ROOT = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

const specMd = read("e2e-hosted-holdout/SPEC.md");
const precommit = read("e2e-hosted-holdout/baselines/PRECOMMIT.md");
const holdoutJourneys = read("e2e-hosted-holdout/journeys.spec.ts");
const originalJourneys = read("e2e-hosted-vertical/journeys.spec.ts");
const regression = read("scripts/run-regression-suite.ts");
const pkg = read("package.json");

const ORIGINAL_TITLES = [
  "New Project partial people",
  "Full New Project + Create + hard reload",
  "Capture date update → Apply → reload",
  "New person / responsibility",
  "Ambiguity stays local",
  "Mixed realistic paste",
];

check("suite id is hosted-holdout-v1", () => {
  assert.equal(HOLDOUT_SUITE_ID, "hosted-holdout-v1");
});

check("exactly six frozen holdout journeys", () => {
  assert.equal(HOLDOUT_JOURNEYS.length, 6);
  assert.deepEqual(
    HOLDOUT_JOURNEYS.map((journey) => journey.title),
    [
      "New Project issues and dated todos",
      "Capture create dated action",
      "Capture ISO date update",
      "Multi-person identity isolation",
      "Ambiguous they plus safe date",
      "Messy ops paste",
    ],
  );
});

check("SPEC.md contains every frozen input and expected block", () => {
  for (const journey of HOLDOUT_JOURNEYS) {
    assert.match(specMd, new RegExp(journey.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(specMd.includes(journey.input), true, `SPEC.md missing input for ${journey.id}`);
    assert.match(specMd, /Expected Review/);
    assert.match(specMd, /Expected canonical truth/);
    assert.match(specMd, /Expected post-reload UI/);
    assert.match(specMd, /Expected Needs You/);
  }
});

check("holdout Playwright uses the frozen inputs", () => {
  for (const journey of HOLDOUT_JOURNEYS) {
    assert.match(holdoutJourneys, new RegExp(`holdoutJourney\\("${journey.id}"\\)`));
    assert.match(holdoutJourneys, new RegExp(`test\\("${journey.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.equal((holdoutJourneys.match(/^test\("/gm) || []).length, 6);
});

check("holdout inputs are not the original six", () => {
  const blob = HOLDOUT_JOURNEYS.map((journey) => `${journey.input}\n${journey.seed?.notes || ""}`).join("\n");
  for (const marker of HOLDOUT_FORBIDDEN_ORIGINAL_MARKERS) {
    assert.equal(blob.includes(marker), false, `holdout reused original marker: ${marker}`);
  }
  for (const title of ORIGINAL_TITLES) {
    assert.equal(holdoutJourneys.includes(`test("${title}"`), false);
  }
});

check("original hosted six titles remain unchanged", () => {
  for (const title of ORIGINAL_TITLES) {
    assert.match(originalJourneys, new RegExp(`test\\("${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(originalJourneys, /bob is the ba\\nmike handles the legacy builds/);
  assert.match(originalJourneys, /Andris is responsible for Legacy/);
  assert.match(originalJourneys, /She will own the remaining UAT gaps/);
});

check("precommit record exists and forbids silent first-run rewriting", () => {
  assert.match(precommit, /hosted-holdout-v1/);
  assert.match(precommit, /90dfb6cb1f67939358ba3fa3c878f2749d3e4b5b/);
  assert.match(precommit, /First hosted execution completed\?.*\*\*NO\*\*/);
  assert.match(specMd, /FROZEN before first hosted execution/);
  assert.match(specMd, /Do not run Lume and then edit this file/);
});

check("coverage slots are materially different combinations", () => {
  assert.match(holdoutJourney("H1_NEW_PROJECT_ISSUES_TODOS").coverage, /issues \+ dated/);
  assert.match(holdoutJourney("H2_CAPTURE_CREATE_DATED_ACTION").coverage, /Capture Create/);
  assert.match(holdoutJourney("H3_CAPTURE_ISO_DATE_UPDATE").coverage, /ISO date/);
  assert.match(holdoutJourney("H4_MULTI_PERSON_IDENTITY").coverage, /identity leakage/);
  assert.match(holdoutJourney("H5_AMBIGUOUS_THEY_PLUS_SAFE").coverage, /ambiguous/);
  assert.match(holdoutJourney("H6_MESSY_OPS_PASTE").coverage, /messy paste/);
  const dates = HOLDOUT_JOURNEYS.map((journey) => journey.input).join("\n");
  assert.match(dates, /14\/10\/2026|22\/10\/2026/);
  assert.match(dates, /2026-10-22/);
  assert.match(dates, /Friday 16 October 2026|16 October 2026|16 Oct 2026/);
});

check("holdout is opt-in and not inside npm test OpenAI path", () => {
  assert.match(pkg, /"e2e:hosted-holdout"/);
  assert.match(pkg, /"verify:hosted-holdout-precommit"/);
  assert.match(regression, /verify-hosted-holdout-precommit\.ts/);
  assert.doesNotMatch(regression, /e2e-hosted-holdout\/journeys\.spec\.ts/);
});

console.log("\n8 hosted-holdout precommit proofs passed.");
