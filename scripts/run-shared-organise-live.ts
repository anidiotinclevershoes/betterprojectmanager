/**
 * Bounded live GPT-6 Luna check of the production Shared Organise module.
 * Not part of npm test. Unsafe Ready fails the process.
 *
 * Run: npx tsx scripts/run-shared-organise-live.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { experimentalMissionState } from "../src/lib/eval-capture-v2/mission-state";
import { CANDYLAND_ID } from "../src/lib/experiments/worlds";
import { extractProjectChangesWithLuna, SHARED_ORGANISE_MODEL } from "../src/lib/shared-organise/extract";
import { SHARED_ORGANISE_PROMPT_VERSION } from "../src/lib/shared-organise/prompt";
import { runSharedOrganiseFromModelJson } from "../src/lib/shared-organise/run";
import { buildSharedOrganiseContext } from "../src/lib/shared-organise/context";
import type { CaptureLegalOperation } from "../src/lib/capture/apply/types";

const REF = "2026-10-03";
const PROJECT = CANDYLAND_ID;

const CASES: Array<{ id: string; transcript: string; unsafe: (op: CaptureLegalOperation) => boolean }> = [
  {
    id: "join",
    transcript: "Sarah Kim has joined the project.",
    unsafe: (op) => op.type === "ensure_person" && op.name !== "Sarah Kim",
  },
  {
    id: "owns",
    transcript: "Sarah Kim owns UAT.",
    unsafe: (op) => op.type === "ensure_person" && op.name !== "Sarah Kim",
  },
  {
    id: "hedge",
    transcript: "Sarah Kim, or maybe Sarah K, will own UAT.",
    unsafe: (op) => op.type === "ensure_person" || op.type === "confirm_responsibility",
  },
  {
    id: "someone",
    transcript: "Someone needs to sort the fire cert.",
    unsafe: (op) => op.type === "ensure_person" || op.type === "confirm_responsibility",
  },
  {
    id: "historical",
    transcript: "Parade day was 1 September 2025.",
    unsafe: (op) => op.type === "update_milestone" || op.type === "create_milestone",
  },
  {
    id: "explicit",
    transcript: "Parade day is 18 December 2026.",
    unsafe: (op) =>
      (op.type === "update_milestone" || op.type === "create_milestone") &&
      !(op.startAt ?? "").startsWith("2026-12-18"),
  },
  {
    id: "relative-clear",
    transcript: "Make parade day two weeks later.",
    unsafe: (op) =>
      (op.type === "update_milestone" || op.type === "create_milestone") &&
      !(op.startAt ?? "").startsWith("2026-10-29"),
  },
  {
    id: "relative-ambiguous",
    transcript: "Move parade day back two weeks.",
    unsafe: () => false,
  },
  {
    id: "foreign",
    transcript: "Mark risk-console resolved.",
    unsafe: (op) => op.type === "update_risk_status" || op.type === "create_risk",
  },
];

async function main() {
  const state = experimentalMissionState();
  const world = captureApplyWorldFromState(state);
  const context = buildSharedOrganiseContext({
    world,
    projectId: PROJECT,
    referenceDate: REF,
  });
  const rows = [];
  let unsafe = 0;
  let errors = 0;
  const usage = { prompt: 0, completion: 0, reasoning: 0 };
  const started = Date.now();
  for (const testCase of CASES) {
    try {
      const extraction = await extractProjectChangesWithLuna({
        transcript: testCase.transcript,
        projectBlock: context.prompt,
      });
      usage.prompt += extraction.providerUsage?.prompt_tokens ?? 0;
      usage.completion += extraction.providerUsage?.completion_tokens ?? 0;
      usage.reasoning += extraction.providerUsage?.reasoning_tokens ?? 0;
      const run = runSharedOrganiseFromModelJson({
        transcript: testCase.transcript,
        rawModelJson: extraction.rawModelJson,
        world,
        projectId: PROJECT,
        referenceDate: REF,
      });
      const bad = run.reviewed.filter(
        (row) => row.label === "Ready" && row.operation && testCase.unsafe(row.operation),
      );
      unsafe += bad.length;
      rows.push({
        id: testCase.id,
        responseModel: extraction.responseModel,
        labels: run.reviewed.map((row) => row.label),
        operations: run.reviewed.map((row) => row.operation),
        uncertainty: extraction.rawModelJson,
        unsafe: bad.map((row) => row.operation),
      });
      console.log(
        `${testCase.id} ${bad.length ? "UNSAFE" : "ok"} ${run.reviewed.map((row) => row.label).join(",")}`,
      );
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      rows.push({ id: testCase.id, error: message });
      console.log(`${testCase.id} ERROR ${message.slice(0, 180)}`);
    }
  }
  const payload = {
    model: SHARED_ORGANISE_MODEL,
    promptVersion: SHARED_ORGANISE_PROMPT_VERSION,
    referenceDate: REF,
    elapsedMs: Date.now() - started,
    calls: CASES.length,
    errors,
    unsafeReady: unsafe,
    usage,
    rows,
  };
  mkdirSync("scripts/shared-organise-live", { recursive: true });
  writeFileSync(
    "scripts/shared-organise-live/latest.json",
    JSON.stringify(payload, null, 2),
  );
  console.log(JSON.stringify({ elapsedMs: payload.elapsedMs, errors, unsafe, usage }));
  if (errors || unsafe) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
