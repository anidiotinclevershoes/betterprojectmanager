/**
 * Phase 1 — Prompt A deliberately uses Left untouched.
 *
 * Proves the prompt/schema freeze changed, and that resolver /
 * rematerialise / hydrate / Apply spine files did not.
 *
 * Run: npx tsx scripts/verify-prompt-a-left-untouched.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
  CAPTURE_V2_OBSERVATION_SCHEMA,
  CAPTURE_V2_PROMPT_RULES,
  CAPTURE_V2_PROMPT_VERSION,
  buildObservationExtractionPrompt,
} from "../src/lib/capture-v2/prompt";
import {
  FROZEN_V2_BASELINE,
  FROZEN_V2_BASELINE_VERSION,
  baselineStillMatchesProduction,
} from "../src/lib/eval-capture-v2/baseline";
import { runCaptureV2FromModelJson } from "../src/lib/capture-v2";
import { CANDYLAND_ID, experimentalApplyWorld } from "../src/lib/experiments/worlds";
import {
  assessApplyReadiness,
  planCaptureApply,
} from "../src/lib/capture/apply";
import { buildSuggestions } from "../src/lib/capture/suggestions";
import {
  buildReviewChangeViewModels,
  pendingReadyModels,
} from "../src/lib/capture/review/viewModel";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

const ROOT = process.cwd();
const UNCHANGED_VS_MAIN = [
  "src/lib/capture-v2/resolve.ts",
  "src/lib/capture-v2/run.ts",
  "src/lib/capture-v2/source-coverage.ts",
  "src/lib/capture/apply/dispatch.ts",
  "src/lib/capture/apply/apply-approved.ts",
  "src/lib/capture/apply/expected-target.ts",
];

function gitDiffAgainstMain(rel: string): string {
  return execFileSync("git", ["diff", "origin/main", "--", rel], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function world() {
  return experimentalApplyWorld();
}

const SECURITY = "Security seem worried about it.";
const MIXED =
  "Sarah owns UAT, CAB moved Friday, and I think Security might be worried.";

function runFromObservations(transcript: string, observations: unknown[]) {
  return runCaptureV2FromModelJson({
    transcript,
    rawModelJson: { observations },
    world: world(),
    projectId: CANDYLAND_ID,
  });
}

function main() {
  check("frozen baseline version is the deliberate v2 freeze", () => {
    assert.equal(CAPTURE_V2_PROMPT_VERSION, "capture-v2-eval-baseline-v2");
    assert.equal(FROZEN_V2_BASELINE_VERSION, "capture-v2-eval-baseline-v2");
    assert.equal(FROZEN_V2_BASELINE.version, "capture-v2-eval-baseline-v2");
  });

  check("frozen baseline still matches production Prompt A", () => {
    const match = baselineStillMatchesProduction();
    assert.equal(match.ok, true, match.issues.join("\n"));
    const live = buildObservationExtractionPrompt({
      transcript: "{{TRANSCRIPT}}",
      projectBlock: "{{PROJECT_BLOCK}}",
    });
    assert.equal(live.includes(CAPTURE_V2_PROMPT_RULES), true);
    assert.equal(live.includes(CAPTURE_V2_OBSERVATION_SCHEMA), true);
    assert.equal(live.includes(FROZEN_V2_BASELINE.promptRules), true);
  });

  check("Prompt A schema and rules teach left_untouched", () => {
    assert.match(CAPTURE_V2_OBSERVATION_SCHEMA, /left_untouched/);
    assert.match(CAPTURE_V2_PROMPT_RULES, /disposition=left_untouched/);
    assert.match(CAPTURE_V2_PROMPT_RULES, /Extract explicitly stated project facts only/);
    assert.match(CAPTURE_V2_PROMPT_RULES, /Do not infer unstated project truth/);
    assert.match(
      CAPTURE_V2_PROMPT_RULES,
      /Do not advise, recommend, diagnose, predict, or invent project meaning/,
    );
    assert.match(
      CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
      /do not infer, advise/,
    );
  });

  check("left_untouched reason must describe uncertainty, not advise", () => {
    assert.match(
      CAPTURE_V2_PROMPT_RULES,
      /It isn't clear what Security is concerned about/,
    );
    assert.match(
      CAPTURE_V2_PROMPT_RULES,
      /You should create a risk for Security/,
    );
    assert.match(CAPTURE_V2_PROMPT_RULES, /not advice/);
    assert.match(
      CAPTURE_V2_PROMPT_RULES,
      /Not: "You should create a risk for Security\."/,
    );
    assert.match(
      CAPTURE_V2_PROMPT_RULES,
      /Do not invent a risk, to-do, person, or knowledge item/,
    );
  });

  check("existing Needs You / create / no_change prompt rules remain", () => {
    assert.match(CAPTURE_V2_PROMPT_RULES, /disposition=ambiguous/);
    assert.match(CAPTURE_V2_PROMPT_RULES, /Lume will Needs You/);
    assert.match(CAPTURE_V2_PROMPT_RULES, /disposition=no_change/);
    assert.match(CAPTURE_V2_PROMPT_RULES, /prefer update_existing or no_change over create_new/);
  });

  check("resolver / rematerialise / hydrate / Apply spine files are unchanged", () => {
    for (const rel of UNCHANGED_VS_MAIN) {
      assert.equal(gitDiffAgainstMain(rel), "", `${rel} must not change in Phase 1`);
    }
    const resolve = read("src/lib/capture-v2/resolve.ts");
    assert.match(resolve, /rematerializeTrustedNoChange/);
    assert.match(resolve, /hydrateFromLocalEvidence/);
    assert.match(resolve, /observation\.disposition === "left_untouched"/);
  });

  check("model-emitted left_untouched stays Review-only and never Ready", () => {
    const reason =
      "It isn't clear what Security is concerned about or what project information should change.";
    const run = runFromObservations(SECURITY, [
      {
        id: "obs-left",
        statement: SECURITY,
        evidence: SECURITY,
        domain: "unknown",
        disposition: "left_untouched",
        truthIntent: "uncertain",
        commentary: reason,
      },
    ]);
    const left = run.resolved.filter(
      (row) => row.observation.disposition === "left_untouched",
    );
    assert.equal(left.length, 1);
    assert.notEqual(left[0]!.decision.kind, "write");
    assert.equal(left[0]!.suggestion, null);
    if (left[0]!.decision.kind === "no_change") {
      assert.equal(left[0]!.decision.reason, reason);
    }
    const suggestions = buildSuggestions(run.result);
    const models = buildReviewChangeViewModels(
      suggestions,
      run.result,
      SECURITY,
      {},
      { world: world(), captureEntryProjectId: CANDYLAND_ID },
    );
    const leftovers = models.filter((m) => m.readiness === "left_untouched");
    assert.ok(leftovers.length >= 1);
    assert.ok(leftovers.every((m) => m.canApprove === false));
    assert.ok(leftovers.every((m) => m.executableApply === false));
    assert.equal(pendingReadyModels(models, {}, {}).length, 0);
    for (const model of leftovers) {
      const planned = planCaptureApply({
        item: model.suggestion,
        text: SECURITY,
        world: world(),
        captureEntryProjectId: CANDYLAND_ID,
      });
      assert.notEqual(planned.kind, "write");
    }
  });

  check("ordinary Create / Update / Needs You / No change fixtures are unchanged", () => {
    const create = runFromObservations(
      "Please add a to-do to polish the candy-cane banners before the float leaves.",
      [
        {
          id: "obs-todo",
          statement: "Polish the candy-cane banners",
          evidence:
            "Please add a to-do to polish the candy-cane banners before the float leaves.",
          domain: "todo",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { title: "Polish the candy-cane banners" },
        },
      ],
    );
    assert.ok(
      create.resolved.some(
        (row) =>
          row.observation.disposition === "create_new" &&
          (row.decision.kind === "write" || row.decision.kind === "needs_you"),
      ),
    );

    const update = runFromObservations(
      "The icing on Gumdrop Bridge has melted; that risk is closed.",
      [
        {
          id: "obs-risk",
          statement: "Gumdrop Bridge icing is resolved",
          evidence: "The icing on Gumdrop Bridge has melted; that risk is closed.",
          domain: "risk",
          disposition: "update_existing",
          truthIntent: "current",
          candidateTargetId: "risk-bridge",
          candidateTargetTitle: "Gumdrop Bridge icing",
          proposedValues: { status: "resolved" },
        },
      ],
    );
    assert.ok(
      update.resolved.some(
        (row) =>
          row.decision.kind === "write" || row.decision.kind === "needs_you",
      ),
    );

    const needsYou = runFromObservations(
      "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it.",
      [
        {
          id: "obs-amb",
          statement: "UAT ownership is unclear",
          evidence:
            "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it.",
          domain: "responsibility",
          disposition: "ambiguous",
          truthIntent: "current",
          proposedValues: {
            personName: "Fizz Caramel",
            scope: "UAT",
            ownershipSemantics: "ambiguous",
          },
        },
      ],
    );
    assert.equal(needsYou.resolved[0]?.decision.kind, "needs_you");

    const noChange = runFromObservations(
      "Pippa Gumdrop is still the UAT lead for the licorice stands.",
      [
        {
          id: "obs-nc",
          statement: "Pippa Gumdrop remains UAT lead",
          evidence: "Pippa Gumdrop is still the UAT lead for the licorice stands.",
          domain: "responsibility",
          disposition: "no_change",
          truthIntent: "current",
          candidateTargetId: "person-gumdrop",
          candidateTargetTitle: "Pippa Gumdrop",
          proposedValues: {
            personName: "Pippa Gumdrop",
            scope: "UAT",
            ownershipSemantics: "continue",
          },
        },
      ],
    );
    assert.ok(
      !noChange.resolved.some(
        (row) => row.observation.disposition === "left_untouched",
      ),
    );
  });

  check("mixed capture keeps clear clauses and surfaces leftover wording", () => {
    const run = runFromObservations(MIXED, [
      {
        id: "obs-sarah",
        statement: "Sarah owns UAT",
        evidence: "Sarah owns UAT",
        domain: "responsibility",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: {
          personName: "Sarah",
          scope: "UAT",
          ownershipSemantics: "replace",
        },
      },
      {
        id: "obs-cab",
        statement: "CAB moved Friday",
        evidence: "CAB moved Friday",
        domain: "milestone",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { label: "CAB", date: "2026-09-18" },
      },
      {
        id: "obs-left",
        statement: "I think Security might be worried.",
        evidence: "I think Security might be worried.",
        domain: "unknown",
        disposition: "left_untouched",
        truthIntent: "uncertain",
        commentary:
          "It isn't clear what Security is concerned about or what project information should change.",
      },
    ]);
    const left = run.resolved.filter(
      (row) => row.observation.disposition === "left_untouched",
    );
    assert.equal(left.length, 1);
    assert.notEqual(left[0]!.decision.kind, "write");
    const actionable = run.resolved.filter(
      (row) => row.observation.disposition !== "left_untouched",
    );
    assert.ok(actionable.length >= 2);
    assert.ok(
      actionable.some(
        (row) =>
          row.decision.kind === "write" || row.decision.kind === "needs_you",
      ),
    );
  });

  check("Ready still means planner-executable; leftover is not Ready", () => {
    const item = {
      id: "ready-todo",
      kind: "action" as const,
      op: "create" as const,
      content: "Polish the candy-cane banners",
      destination: "project" as const,
      projectId: CANDYLAND_ID,
      legalDomain: "todo" as const,
    };
    const ready = assessApplyReadiness({
      item,
      text: "Please add a to-do to polish the candy-cane banners.",
      preflight: { world: world(), captureEntryProjectId: CANDYLAND_ID },
    });
    assert.equal(ready.canApprove, true);
    const planned = planCaptureApply({
      item,
      text: "Please add a to-do to polish the candy-cane banners.",
      world: world(),
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(planned.kind, "write");
  });

  console.log(`\n${passed} Prompt A left-untouched checks passed`);
}

main();
