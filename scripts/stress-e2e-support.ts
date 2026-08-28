/**
 * stdin-free helper so Playwright can load Harbourline stress fixtures
 * without importing src path aliases.
 *
 * argv[2]: seed-early | seed-mature | new-project-payload | marathon-slice | handover-slice
 */
import {
  draftFromProvisional,
  parseNewProjectV2Envelope,
} from "../src/lib/new-project-v2";
import {
  HARBOURLINE_ID,
  seedEarlyHarbourline,
  seedMatureHarbourline,
} from "../src/lib/eval-capture-v2/stress/harbourline";
import {
  DEEP_CREATION_ENVELOPE,
  DEEP_CREATION_NARRATIVE,
} from "../src/lib/eval-capture-v2/stress/deep-creation";
import { MARATHON_STEPS } from "../src/lib/eval-capture-v2/stress/marathon";
import { HANDOVER_STEPS } from "../src/lib/eval-capture-v2/stress/handover";

const cmd = process.argv[2] ?? "";

if (cmd === "seed-early") {
  process.stdout.write(JSON.stringify(seedEarlyHarbourline()));
} else if (cmd === "seed-mature") {
  process.stdout.write(JSON.stringify(seedMatureHarbourline()));
} else if (cmd === "new-project-payload") {
  const parsed = parseNewProjectV2Envelope(DEEP_CREATION_ENVELOPE);
  const draft = draftFromProvisional({
    sourceNarrative: DEEP_CREATION_NARRATIVE,
    sourceMode: "talk",
    project: parsed.project,
    items: parsed.items,
  });
  process.stdout.write(
    JSON.stringify({
      pipeline: "v2",
      openaiConfigured: true,
      provider: "frozen-stress",
      provisionalItems: parsed.items,
      projectSeed: parsed.project,
      draft,
      narrative: DEEP_CREATION_NARRATIVE,
    }),
  );
} else if (cmd === "marathon-slice") {
  const ids = ["m01", "m20", "m21"];
  process.stdout.write(
    JSON.stringify({
      projectId: HARBOURLINE_ID,
      steps: MARATHON_STEPS.filter((s) => ids.includes(s.id)),
    }),
  );
} else if (cmd === "handover-slice") {
  const ids = ["h1", "h6", "h10"];
  process.stdout.write(
    JSON.stringify({
      projectId: HARBOURLINE_ID,
      steps: HANDOVER_STEPS.filter((s) => ids.includes(s.id)),
    }),
  );
} else {
  process.stderr.write(`Unknown stress-e2e-support command: ${cmd}\n`);
  process.exit(1);
}
