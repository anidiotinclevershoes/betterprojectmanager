/**
 * Capture V2 — observation validation + resolver into Phase 3B.
 * Fixture model output only — no regex NLP, no live OpenAI.
 *
 * Run: npx tsx scripts/verify-capture-v2.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isCaptureV2Enabled } from "../src/lib/capture-v2/flag";
import {
  accountObservations,
  contextRecordsFromWorld,
  parseObservationEnvelope,
  resolveObservations,
  runCaptureV2FromModelJson,
  validateObservations,
} from "../src/lib/capture-v2";
import { buildSuggestions } from "../src/lib/capture/suggestions";
import {
  CANDYLAND_ID,
  GAMING_ID,
  experimentalApplyWorld,
} from "../src/lib/experiments/worlds";

const world = experimentalApplyWorld();
const candyRecords = contextRecordsFromWorld(world, CANDYLAND_ID);

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function main() {
  check("flag cannot disable Capture V2", () => {
    assert.equal(isCaptureV2Enabled({}), true);
    assert.equal(isCaptureV2Enabled({ LUME_CAPTURE_V2: "0" }), true);
    assert.equal(isCaptureV2Enabled({ LUME_CAPTURE_V2: "1" }), true);
  });

  check("malformed envelope fails closed", () => {
    const bad = parseObservationEnvelope("not json");
    assert.equal(bad.observations.length, 0);
    assert.ok(bad.issues.some((i) => i.code === "malformed"));
    const missing = parseObservationEnvelope({ hello: true });
    assert.equal(missing.observations.length, 0);
  });

  check("multiple observations from one sentence + evidence survives", () => {
    const parsed = parseObservationEnvelope({
      observations: [
        {
          id: "obs-person",
          statement: "Pippa Gumdrop remains UAT lead",
          evidence: "Pippa Gumdrop remains UAT lead and Parade day moved",
          domain: "responsibility",
          disposition: "no_change",
          projectId: CANDYLAND_ID,
          candidateTargetId: "person-gumdrop",
          candidateTargetTitle: "Pippa Gumdrop",
        },
        {
          id: "obs-date",
          statement: "Parade day moved to 22 October 2026",
          evidence: "Parade day moved to 22 October 2026",
          domain: "milestone",
          disposition: "update_existing",
          projectId: CANDYLAND_ID,
          candidateTargetId: "ms-parade",
          candidateTargetTitle: "Parade day",
          proposedValues: { date: "2026-10-22" },
        },
      ],
    });
    const validated = validateObservations(parsed.observations, candyRecords, CANDYLAND_ID);
    assert.equal(validated.observations.length, 2);
    assert.ok(validated.observations.every((o) => o.evidence.length > 0));
    assert.equal(validated.observations[0]?.candidateTargetId, "person-gumdrop");
  });

  check("Project B IDs cannot be used inside Candyland", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-cross",
          statement: "Console certification slipped",
          evidence: "Console certification slipped",
          domain: "risk",
          disposition: "update_existing",
          projectId: CANDYLAND_ID,
          candidateTargetId: "risk-console",
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    assert.equal(validated.observations.length, 0);
    assert.ok(
      validated.issues.some(
        (i) => i.code === "cross_project_id" || i.code === "foreign_id",
      ),
    );
    assert.ok(validated.rejected.every((o) => o.candidateTargetId == null));
  });

  check("full workspace index still blocks cross-project IDs", () => {
    const allRecords = contextRecordsFromWorld(world);
    const validated = validateObservations(
      [
        {
          id: "obs-cross-full",
          statement: "Console certification slipped",
          evidence: "Console certification slipped",
          domain: "risk",
          disposition: "update_existing",
          projectId: CANDYLAND_ID,
          candidateTargetId: "risk-console",
        },
      ],
      allRecords,
      CANDYLAND_ID,
    );
    assert.equal(validated.observations.length, 0);
    assert.ok(validated.issues.some((i) => i.code === "cross_project_id"));
  });

  check("invented IDs fail closed", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-fake",
          statement: "Update imaginary risk",
          evidence: "Update imaginary risk",
          domain: "risk",
          disposition: "update_existing",
          candidateTargetId: "risk-does-not-exist",
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    assert.ok(validated.issues.some((i) => i.code === "foreign_id"));
    assert.equal(validated.observations.length, 0);
  });

  check("commentary is represented without becoming a write", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-chat",
          statement: "Weather will be nice",
          evidence: "I think the weather will be nice on Friday",
          domain: "commentary",
          disposition: "commentary",
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "I think the weather will be nice on Friday",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "no_change");
    assert.equal(resolved[0]?.suggestion, null);
  });

  check("duplicate statements can merge", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-a",
          statement: "Pippa remains UAT lead",
          evidence: "Pippa Gumdrop remains UAT lead. Pippa still leads UAT.",
          domain: "responsibility",
          disposition: "no_change",
          candidateTargetId: "person-gumdrop",
        },
        {
          id: "obs-b",
          statement: "Pippa still leads UAT",
          evidence: "Pippa still leads UAT.",
          domain: "responsibility",
          disposition: "merge",
          mergeWithObservationId: "obs-a",
          candidateTargetId: "person-gumdrop",
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "Pippa Gumdrop remains UAT lead. Pippa still leads UAT.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    const account = accountObservations({ resolved });
    assert.equal(account.merged, 1);
    assert.equal(account.alreadyKnown, 1);
  });

  check("existing Person mention does not create a duplicate write", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-pippa",
          statement: "Pippa Gumdrop remains UAT lead",
          evidence: "Pippa Gumdrop remains UAT lead.",
          domain: "person",
          disposition: "create_new",
          candidateTargetTitle: "Pippa Gumdrop",
          proposedValues: { name: "Pippa Gumdrop" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "Pippa Gumdrop remains UAT lead.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.ok(
      resolved[0]?.decision.kind === "no_change" ||
        resolved[0]?.decision.kind === "needs_you",
    );
  });

  check("Risk resolve uses Risk domain via 3B", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-risk",
          statement: "Gumdrop Bridge icing is resolved",
          evidence: "Gumdrop Bridge icing is resolved.",
          domain: "risk",
          disposition: "update_existing",
          candidateTargetId: "risk-bridge",
          candidateTargetTitle: "Gumdrop Bridge icing",
          proposedValues: { status: "resolved" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "Gumdrop Bridge icing is resolved.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "write");
    if (resolved[0]?.decision.kind === "write") {
      assert.equal(resolved[0].decision.domain, "risk");
      assert.notEqual(resolved[0].decision.operation.type, "create_todo");
    }
  });

  check("date move updates milestone, not a To Do", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-date",
          statement: "Parade day moved to 22 October 2026",
          evidence: "Parade day moved to 22 October 2026.",
          domain: "milestone",
          disposition: "update_existing",
          candidateTargetId: "ms-parade",
          proposedValues: { date: "2026-10-22" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "Parade day moved to 22 October 2026.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "write");
    if (resolved[0]?.decision.kind === "write") {
      assert.equal(resolved[0].decision.domain, "milestone");
    }
  });

  check("genuine To Do still automates", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-todo",
          statement: "Order extra sprinkles for the parade float",
          evidence: "Create a to-do to order extra sprinkles for the parade float.",
          domain: "todo",
          disposition: "create_new",
          proposedValues: { title: "Order extra sprinkles for the parade float" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "Create a to-do to order extra sprinkles for the parade float.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "write");
    if (resolved[0]?.decision.kind === "write") {
      assert.equal(resolved[0].decision.operation.type, "create_todo");
    }
  });

  check("ambiguous share vs replace is Needs you", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-own",
          statement: "Fizz may share or replace Pippa as UAT lead",
          evidence:
            "Fizz Caramel will share UAT lead with Pippa Gumdrop and may replace her.",
          domain: "responsibility",
          disposition: "ambiguous",
          proposedValues: { ownershipSemantics: "ambiguous", scope: "UAT lead" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript:
        "Fizz Caramel will share UAT lead with Pippa Gumdrop and may replace her.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "needs_you");
  });

  check("update without identity is Needs you", () => {
    const resolved = resolveObservations({
      observations: [
        {
          id: "obs-bare",
          statement: "Move the date",
          evidence: "Move the date",
          domain: "milestone",
          disposition: "update_existing",
          projectId: CANDYLAND_ID,
          candidateTargetId: null,
          candidateTargetTitle: null,
          mergeWithObservationId: null,
          proposedValues: { date: "2026-10-22" },
          commentary: null,
          modelConfidence: null,
        },
      ],
      world,
      transcript: "Move the date",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "needs_you");
  });

  check("single-token existing Person fragment is Needs you, not a duplicate", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-pippa-short",
          statement: "Pippa remains UAT lead",
          evidence: "Pippa remains UAT lead.",
          domain: "person",
          disposition: "create_new",
          proposedValues: { name: "Pippa" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "Pippa remains UAT lead.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "needs_you");
  });

  check("genuinely new Person can write", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-nougat",
          statement: "Nougat Bell joins as parade marshal",
          evidence: "Nougat Bell is joining as parade marshal.",
          domain: "person",
          disposition: "create_new",
          proposedValues: { name: "Nougat Bell" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "Nougat Bell is joining as parade marshal.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "write");
    if (resolved[0]?.decision.kind === "write") {
      assert.equal(resolved[0].decision.operation.type, "ensure_person");
    }
  });

  check("availability on existing Person writes availability, not a To Do", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-away",
          statement: "Pippa Gumdrop is away from 2026-10-03",
          evidence: "Pippa Gumdrop is away from 2026-10-03.",
          domain: "availability",
          disposition: "update_existing",
          candidateTargetId: "person-gumdrop",
          candidateTargetTitle: "Pippa Gumdrop",
          proposedValues: { awayFromIso: "2026-10-03" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "Pippa Gumdrop is away from 2026-10-03.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "write");
    if (resolved[0]?.decision.kind === "write") {
      assert.equal(resolved[0].decision.domain, "availability");
      assert.equal(resolved[0].decision.operation.type, "write_availability");
    }
  });

  check("unchanged date is no_change", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-same-date",
          statement: "Parade day is still 15 October 2026",
          evidence: "Parade day is still 15 October 2026.",
          domain: "milestone",
          disposition: "update_existing",
          candidateTargetId: "ms-parade",
          proposedValues: { date: "2026-10-15" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "Parade day is still 15 October 2026.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "no_change");
  });

  check("new Risk creates a Risk, not a To Do", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-new-risk",
          statement: "Float icing may melt in sun",
          evidence: "We're worried the float icing may melt in sun.",
          domain: "risk",
          disposition: "create_new",
          proposedValues: { title: "Float icing may melt in sun" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    const resolved = resolveObservations({
      observations: validated.observations,
      world,
      transcript: "We're worried the float icing may melt in sun.",
      captureEntryProjectId: CANDYLAND_ID,
    });
    assert.equal(resolved[0]?.decision.kind, "write");
    if (resolved[0]?.decision.kind === "write") {
      assert.equal(resolved[0].decision.domain, "risk");
      assert.equal(resolved[0].decision.operation.type, "create_risk");
    }
  });

  check("GamingStudio5000 records are not in Candyland index", () => {
    assert.ok(!candyRecords.some((r) => r.id === "risk-console"));
    assert.ok(!candyRecords.some((r) => r.projectId === GAMING_ID));
  });

  check("no phrase/regex engine in capture-v2", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const dir = path.join(process.cwd(), "src/lib/capture-v2");
    for (const file of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      assert.doesNotMatch(text, /token overlap|stemming|fuzzy/i);
      assert.doesNotMatch(text, /Pippa\|Fizz\|Gumdrop/);
    }
  });

  check("runCaptureV2FromModelJson attaches pipeline accounting", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Create a to-do to order extra sprinkles for the parade float.",
      rawModelJson: {
        observations: [
          {
            id: "obs-todo",
            statement: "Order extra sprinkles for the parade float",
            evidence: "Create a to-do to order extra sprinkles for the parade float.",
            domain: "todo",
            disposition: "create_new",
            proposedValues: { title: "Order extra sprinkles for the parade float" },
          },
        ],
      },
      world,
      projectId: CANDYLAND_ID,
    });
    assert.equal(run.result.capturePipeline, "v2");
    assert.equal(run.result.observationAccount?.proposedChanges, 1);
    assert.ok((run.result.proposedOperations ?? []).length >= 1);
  });

  check("Needs you Person is not serialized as a CREATE write", () => {
    const run = runCaptureV2FromModelJson({
      transcript: "Pippa remains UAT lead.",
      rawModelJson: {
        observations: [
          {
            id: "obs-short",
            statement: "Pippa remains UAT lead",
            evidence: "Pippa remains UAT lead.",
            domain: "person",
            disposition: "create_new",
            proposedValues: { name: "Pippa" },
          },
        ],
      },
      world,
      projectId: CANDYLAND_ID,
    });
    assert.equal(run.resolved[0]?.decision.kind, "needs_you");
    assert.ok(
      (run.result.proposedOperations ?? []).every((op) => op.operation === "NO_CHANGE"),
    );
    const suggestions = buildSuggestions(run.result);
    assert.equal(suggestions.length, 1);
    assert.notEqual(suggestions[0]!.op, "create");
    assert.notEqual(
      suggestions[0]!.legalDomain,
      "unsupported",
    );
  });

  check("client barrel does not re-export OpenAI extract", () => {
    const barrel = readFileSync(
      join(process.cwd(), "src/lib/capture-v2/index.ts"),
      "utf8",
    );
    assert.doesNotMatch(barrel, /extractObservationsWithOpenAI/);
  });

  check("observation projectId cannot retarget another project", () => {
    const validated = validateObservations(
      [
        {
          id: "obs-retarget",
          statement: "Order extra sprinkles",
          evidence: "Order extra sprinkles",
          domain: "todo",
          disposition: "create_new",
          projectId: GAMING_ID,
          proposedValues: { title: "Order extra sprinkles" },
        },
      ],
      candyRecords,
      CANDYLAND_ID,
    );
    assert.equal(validated.observations.length, 0);
    assert.ok(validated.issues.some((i) => i.code === "cross_project_id"));
  });

  console.log("verify-capture-v2: OK");
}

main();
