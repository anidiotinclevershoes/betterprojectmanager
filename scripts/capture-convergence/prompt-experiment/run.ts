/**
 * Opt-in live A/B/C/D prompt comparison on the frozen holdout.
 *
 *   LUME_CAPTURE_LIVE=1 npx tsx scripts/capture-convergence/prompt-experiment/run.ts
 *
 * Never CI. Production extract path is unchanged. Exits 2 without a key.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractObservationsWithOpenAI } from "../../../src/lib/capture-v2/extract";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
} from "../../../src/lib/capture-v2/context";
import { getOpenAIKey } from "../../../src/lib/openai";
import { PINNED_OPENAI_CHAT_MODEL, resolveOpenAIChatModel } from "../../../src/lib/openai-model";
import { heldOutTranscripts } from "../held-out";
import { runPipeline } from "../pipeline";
import { worldFor } from "../worlds";
import { FROZEN_PROMPT_HOLDOUT, PROMPT_HOLDOUT_FROZEN_AT } from "./holdout";
import { PROMPT_VARIANT_META, type PromptVariantId } from "./prompts";

function scoreEnvelope(
  holdout: (typeof FROZEN_PROMPT_HOLDOUT)[number],
  transcript: string,
  raw: unknown,
  snapshot: ReturnType<typeof runPipeline>["snapshot"],
) {
  const blob = JSON.stringify(raw ?? {}).toLowerCase();
  const text = `${transcript}\n${blob}`.toLowerCase();
  let recall = 0;
  for (const needle of holdout.mustRecall) {
    if (blob.includes(needle.toLowerCase())) recall += 1;
  }
  let inventions = 0;
  for (const needle of holdout.mustNotInvent) {
    if (needle && blob.includes(needle.toLowerCase()) && !transcript.toLowerCase().includes(needle.toLowerCase())) {
      inventions += 1;
    }
  }
  const inventedIds = snapshot.rejectedCodes.filter((code) => code === "foreign_id").length;
  const needsYou = snapshot.atoms.filter((a) => a.decisionKind === "needs_you").length;
  const writes = snapshot.atoms.filter((a) => a.decisionKind === "write").length;
  const ambiguityOk = (holdout.mustPreserveAmbiguity ?? []).length
    ? snapshot.atoms.some((a) => a.decisionKind === "needs_you")
    : true;
  return {
    recallHits: recall,
    recallPossible: holdout.mustRecall.length,
    inventions,
    inventedIds,
    needsYou,
    writes,
    observationCount: snapshot.atoms.length,
    ambiguityOk,
    parseMalformed: snapshot.parseMalformed,
  };
}

async function main() {
  if (process.env.LUME_CAPTURE_LIVE !== "1") {
    console.error("Refusing to call OpenAI. Set LUME_CAPTURE_LIVE=1.");
    process.exit(2);
  }
  if (!getOpenAIKey()) {
    console.error("OPENAI_API_KEY is not configured. Prompt comparison was not run.");
    process.exit(2);
  }

  const variants = (process.argv.includes("--variant")
    ? [process.argv[process.argv.indexOf("--variant") + 1] as PromptVariantId]
    : (["A"] as PromptVariantId[]));

  // Live comparison of B/C/D requires an extract override that is not wired
  // into production. This runner scores production Prompt A against the
  // frozen holdout so a later authorised run can add B/C/D without retuning
  // production.
  const onlyA = variants.every((v) => v === "A");
  if (!onlyA) {
    console.error("This runner scores production Prompt A only until extract override is authorised.");
    console.error("Variants B/C/D are drafted in prompts.ts and must not be applied to production yet.");
    process.exit(2);
  }

  const wanted = new Set(FROZEN_PROMPT_HOLDOUT.map((row) => row.id));
  const sample = heldOutTranscripts().filter((row) => wanted.has(row.id));
  const requestedModel = resolveOpenAIChatModel();
  console.log(`Frozen holdout ${PROMPT_HOLDOUT_FROZEN_AT}`);
  console.log(`model=${requestedModel} pinned=${PINNED_OPENAI_CHAT_MODEL} variant=A`);
  console.log(`cases=${sample.length}\n`);

  const rows = [];
  for (const item of sample) {
    const holdout = FROZEN_PROMPT_HOLDOUT.find((row) => row.id === item.id)!;
    const world = worldFor(item.world);
    const project = world.projects.find((p) => p.id === item.projectId);
    if (!project) throw new Error(`Missing project ${item.projectId}`);
    const records = contextRecordsFromWorld(world, item.projectId);
    const projectBlock = formatAuthoritativeStateForPrompt(records, {
      id: project.id,
      name: project.name,
      code: project.code,
    });
    const call = await extractObservationsWithOpenAI({
      transcript: item.transcript,
      projectBlock,
    });
    const pipeline = runPipeline({
      transcript: item.transcript,
      rawModelJson: call.rawModelJson,
      world,
      projectId: item.projectId,
    });
    const score = scoreEnvelope(holdout, item.transcript, call.rawModelJson, pipeline.snapshot);
    rows.push({ id: item.id, theme: holdout.theme, ...score });
    console.log(
      `${item.id}  recall=${score.recallHits}/${score.recallPossible}  invent=${score.inventions}  foreign_id=${score.inventedIds}  writes=${score.writes}  needs_you=${score.needsYou}`,
    );
  }

  const out = {
    generatedAt: new Date().toISOString(),
    holdoutFrozenAt: PROMPT_HOLDOUT_FROZEN_AT,
    variant: "A",
    meta: PROMPT_VARIANT_META.A,
    requestedModel,
    rows,
  };
  const dir = join(process.cwd(), "test-results");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "prompt-experiment-holdout-a.json");
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${path}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message.replace(/sk-[a-zA-Z0-9._-]+/g, "[redacted]"));
  process.exit(1);
});
