/**
 * stdin JSON → Apply result for Playwright Capture V2 journeys.
 * Durable `state` is the authority. Client MissionState is not accepted.
 *
 * Input: { projectId, item, text, expectedTarget?, state }
 */
import { readFileSync } from "node:fs";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import type { CaptureExpectedTarget } from "../src/lib/capture/apply/expected-target";
import type { MissionState } from "../src/lib/types";

type Input = {
  projectId: string;
  item: PendingSuggestion;
  text?: string;
  expectedTarget?: CaptureExpectedTarget | null;
  state: MissionState;
};

async function main() {
  const raw = readFileSync(0, "utf8");
  const input = JSON.parse(raw) as Input;

  const result = await applyApprovedCaptureSuggestion({
    item: input.item,
    text: (input.text ?? input.item.content ?? "").trim(),
    projectId: input.projectId,
    expectedTarget: input.expectedTarget ?? input.item.expectedTarget ?? null,
    loadWorkspace: async () => ({
      workspaceId: "e2e-local",
      userId: "e2e-local",
      state: input.state,
    }),
  });

  process.stdout.write(
    JSON.stringify({
      decision: result.decision,
      executed: result.executed,
      state: result.state,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
