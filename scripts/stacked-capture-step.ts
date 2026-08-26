/**
 * stdin JSON → CaptureResult for Playwright stacked journeys.
 * Used only when the Playwright worker cannot import `@/` modules.
 *
 * Input: { transcript, projectId, rawModelJson, state, bindTarget? }
 */
import { readFileSync } from "node:fs";
import { worldFromCaptureState, runCaptureV2FromModelJson } from "../src/lib/capture-v2";
import { bindEnvelopeToWorld } from "../src/lib/eval-capture-v2/stacked-runtime";
import type { MissionState } from "../src/lib/types";
import type { StackedBindTarget } from "../src/lib/eval-capture-v2/stacked-stories";

type Input = {
  transcript: string;
  projectId: string;
  rawModelJson: unknown;
  bindTarget?: StackedBindTarget;
  state: Pick<
    MissionState,
    "projects" | "risks" | "todos" | "timeline" | "knowledge"
  >;
};

const raw = readFileSync(0, "utf8");
const input = JSON.parse(raw) as Input;
const state = input.state as MissionState;
const rawModelJson = bindEnvelopeToWorld(input.rawModelJson, state, input.bindTarget);
const run = runCaptureV2FromModelJson({
  transcript: input.transcript,
  rawModelJson,
  world: worldFromCaptureState(state),
  projectId: input.projectId,
});
process.stdout.write(JSON.stringify({ result: run.result }));
