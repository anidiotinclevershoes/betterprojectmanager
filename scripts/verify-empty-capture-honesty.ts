/**
 * Family B — meaningful Capture must not become a silent empty Review.
 *
 * Do not manufacture write candidates. Fail loud: Needs You / unsupported /
 * extraction failure. Restated already-known observations stay no_change.
 *
 * Run: npx tsx scripts/verify-empty-capture-honesty.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCaptureObservations,
} from "../src/lib/capture/review/observations";
import {
  EMPTY_REVIEW_FACT,
  emptyV2Result,
  runCaptureV2FromModelJson,
  shouldSurfaceEmptyReviewNeedsYou,
  unsupportedProductGapReason,
} from "../src/lib/capture-v2";
import type { CaptureApplyWorld } from "../src/lib/capture/apply";

const PROJECT = "proj-riverside";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function world(): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT]),
    projects: [
      {
        id: PROJECT,
        name: "Riverside Civic Hall",
        code: "RCH",
        stakeholders: [{ id: "person-helen", name: "Helen Ward", role: "PM" }],
      },
    ],
    risks: [
      {
        id: "risk-dda",
        projectId: PROJECT,
        title: "Outstanding DDA access ramp detail",
        status: "open",
      },
    ],
    todos: [],
    timeline: [
      {
        id: "ms-sat",
        projectId: PROJECT,
        label: "Saturday catch-up",
        startAt: "2026-10-17",
      },
    ],
    knowledge: [],
  };
}

check("empty model envelope on a meaningful Capture is Needs You, not silent", () => {
  const transcript =
    "Hall lighting scene plate is now the agreed fixture for the stage wash.";
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: { observations: [] },
    world: world(),
    projectId: PROJECT,
  });
  assert.ok(run.result.observationAccount);
  assert.equal(run.result.observationAccount?.proposedChanges, 0);
  assert.ok(
    (run.result.observationAccount?.needsYou ?? 0) >= 1,
    "empty extraction must surface Needs You",
  );
  const findings = run.result.findings ?? [];
  assert.ok(
    findings.some((f) => f.requiresClarification && f.fact === EMPTY_REVIEW_FACT),
    "synthetic extraction-failure finding must be present",
  );
  const ops = run.result.proposedOperations ?? [];
  assert.ok(
    ops.every((op) => op.operation === "NO_CHANGE"),
    "must not manufacture a write",
  );
  const observations = buildCaptureObservations(run.result, transcript);
  assert.ok(
    observations.some((o) => o.actionStatus === "needs_review"),
    "Review summary must show Needs you",
  );
});

check("emptyV2Result on a meaningful Capture is also Needs You", () => {
  const transcript =
    "Jamie covers site this week because James is on leave from Tuesday.";
  const result = emptyV2Result(transcript, PROJECT);
  assert.ok((result.observationAccount?.needsYou ?? 0) >= 1);
  assert.equal(result.observationAccount?.proposedChanges, 0);
});

check("cancel-milestone language is explicit unsupported, still no write", () => {
  const transcript =
    "Cancel the Saturday catch-up — we are not meeting this weekend.";
  const reason = unsupportedProductGapReason(transcript);
  assert.ok(reason && /cannot cancel/i.test(reason));
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: { observations: [] },
    world: world(),
    projectId: PROJECT,
  });
  const finding = (run.result.findings ?? []).find((f) => f.requiresClarification);
  assert.ok(finding);
  assert.match(finding!.clarificationQuestion ?? "", /cannot cancel/i);
  assert.ok((run.result.proposedOperations ?? []).every((op) => op.operation === "NO_CHANGE"));
});

check("retire-knowledge language is explicit unsupported, still no write", () => {
  const transcript =
    "Retire the asbestos knowledge note — that survey addendum is done and no longer current.";
  const reason = unsupportedProductGapReason(transcript);
  assert.ok(reason && /cannot retire/i.test(reason));
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: { observations: [] },
    world: world(),
    projectId: PROJECT,
  });
  const finding = (run.result.findings ?? []).find((f) => f.requiresClarification);
  assert.ok(finding);
  assert.match(finding!.clarificationQuestion ?? "", /cannot retire/i);
});

check("commentary-only Capture is not rewritten as extraction failure", () => {
  const transcript =
    "The lobby coffee machine is still broken. That is not this project.";
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: {
      observations: [
        {
          id: "obs-chat",
          statement: "The lobby coffee machine is still broken",
          evidence: "The lobby coffee machine is still broken. That is not this project.",
          domain: "commentary",
          disposition: "commentary",
          truthIntent: "current",
        },
      ],
    },
    world: world(),
    projectId: PROJECT,
  });
  assert.ok((run.result.observationAccount?.commentary ?? 0) >= 1);
  assert.equal(run.result.observationAccount?.proposedChanges, 0);
  assert.equal(
    (run.result.findings ?? []).some((f) => f.fact === EMPTY_REVIEW_FACT),
    false,
    "accounted commentary must not grow a synthetic empty-Review card",
  );
  assert.ok(
    (run.result.proposedOperations ?? []).every((op) => op.operation === "NO_CHANGE"),
  );
});

check("already-known no_change is not rewritten as extraction failure", () => {
  const transcript = "Practical completion is still targeted for 12 December 2026.";
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: {
      observations: [
        {
          id: "obs-pc",
          statement: "Practical completion is still targeted for 12 December 2026.",
          evidence: "Practical completion is still targeted for 12 December 2026.",
          domain: "milestone",
          disposition: "no_change",
          truthIntent: "current",
          proposedValues: { label: "Practical completion", date: "2026-12-12" },
        },
      ],
    },
    world: world(),
    projectId: PROJECT,
  });
  assert.ok((run.result.observationAccount?.alreadyKnown ?? 0) >= 1);
  assert.equal(
    (run.result.findings ?? []).some((f) => f.fact === EMPTY_REVIEW_FACT),
    false,
    "accounted no_change must not grow a synthetic empty-Review card",
  );
});

check("short chatter is not forced into Needs You", () => {
  assert.equal(
    shouldSurfaceEmptyReviewNeedsYou(
      {
        total: 0,
        proposedChanges: 0,
        alreadyKnown: 0,
        merged: 0,
        needsYou: 0,
        commentary: 0,
        rejected: 0,
      },
      "ok thanks",
    ),
    false,
  );
});

check("Capture summary empty copy is honest, not 'nothing clear'", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/capture/review/CaptureSummary.tsx"),
    "utf8",
  );
  assert.match(src, /could not turn this Capture into a safe change/);
  assert.doesNotMatch(src, /Nothing clear enough to act on yet/);
});

console.log(`\n${passed} checks passed`);
