/**
 * Opt-in live OpenAI evaluation of a small held-out sample.
 *
 * NEVER part of npm test / ordinary CI.
 * NEVER runs automatically.
 *
 *   LUME_CAPTURE_LIVE=1 npm run eval:capture-live
 *
 * Uses the current production extract prompt/model unchanged.
 * Records prompt id/version, requested/response model, timing.
 * Does not log secrets or raw Capture content.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractObservationsWithOpenAI } from "../src/lib/capture-v2/extract";
import {
  CAPTURE_V2_EXTRACT_PATH,
  CAPTURE_V2_PROMPT_ID,
  CAPTURE_V2_PROMPT_VERSION,
} from "../src/lib/capture-v2/prompt";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
} from "../src/lib/capture-v2/context";
import { getOpenAIKey } from "../src/lib/openai";
import { PINNED_OPENAI_CHAT_MODEL, resolveOpenAIChatModel } from "../src/lib/openai-model";
import {
  HELD_OUT_LIVE_SAMPLE_IDS,
  heldOutTranscripts,
} from "./capture-convergence/held-out";
import { runPipeline } from "./capture-convergence/pipeline";
import { worldFor } from "./capture-convergence/worlds";

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1];
  return undefined;
}

async function main() {
  if (process.env.LUME_CAPTURE_LIVE !== "1") {
    console.error(
      "Refusing to call OpenAI. Set LUME_CAPTURE_LIVE=1 to run this opt-in evaluator.",
    );
    console.error("The deterministic suite is: npm run verify:capture-convergence");
    process.exit(2);
  }
  const key = getOpenAIKey();
  if (!key) {
    console.error("OPENAI_API_KEY is not configured. No live call was made.");
    process.exit(2);
  }

  const limit = Math.max(1, Math.min(8, Number(arg("limit") ?? "8") || 8));
  const wanted = new Set(HELD_OUT_LIVE_SAMPLE_IDS);
  const sample = heldOutTranscripts()
    .filter((row) => wanted.has(row.id as (typeof HELD_OUT_LIVE_SAMPLE_IDS)[number]))
    .slice(0, limit);

  const requestedModel = resolveOpenAIChatModel();
  console.log("Capture live held-out sample (opt-in)");
  console.log(`promptId=${CAPTURE_V2_PROMPT_ID} promptVersion=${CAPTURE_V2_PROMPT_VERSION}`);
  console.log(`path=${CAPTURE_V2_EXTRACT_PATH}`);
  console.log(`requestedModel=${requestedModel} pinnedDefault=${PINNED_OPENAI_CHAT_MODEL}`);
  console.log(`sample=${sample.length}  (no raw content will be written)`);
  console.log("Do not tune production against the held-out set until evaluation.\n");

  const rows: unknown[] = [];
  for (const item of sample) {
    const world = worldFor(item.world);
    const project = world.projects.find((p) => p.id === item.projectId);
    if (!project) throw new Error(`Missing project ${item.projectId}`);
    const records = contextRecordsFromWorld(world, item.projectId);
    const projectBlock = formatAuthoritativeStateForPrompt(records, {
      id: project.id,
      name: project.name,
      code: project.code,
    });
    const started = Date.now();
    try {
      const call = await extractObservationsWithOpenAI({
        transcript: item.transcript,
        projectBlock,
      });
      const elapsedMs = Date.now() - started;
      const pipeline = runPipeline({
        transcript: item.transcript,
        rawModelJson: call.rawModelJson,
        world,
        projectId: item.projectId,
      });
      const summary = {
        id: item.id,
        transcriptSha256_16: hashText(item.transcript),
        promptId: call.promptId,
        promptVersion: call.promptVersion,
        path: call.path,
        requestedModel: call.requestedModel,
        responseModel: call.responseModel,
        elapsedMs,
        observationCount: call.observationCount,
        usage: call.providerUsage,
        fallback: call.fallback,
        parseMalformed: pipeline.snapshot.parseMalformed,
        rejectedCodes: pipeline.snapshot.rejectedCodes,
        decisions: pipeline.snapshot.atoms.map((atom) => ({
          domain: atom.domain,
          disposition: atom.disposition,
          decisionKind: atom.decisionKind,
          writeType: atom.writeType,
          reasonClass: atom.reasonClass,
        })),
      };
      rows.push(summary);
      console.log(
        `✓ ${item.id}  model=${call.responseModel}  obs=${call.observationCount}  ${elapsedMs}ms  tokens=${call.providerUsage?.total_tokens ?? "?"}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const redacted = message.replace(/sk-[a-zA-Z0-9._-]+/g, "[redacted]");
      rows.push({
        id: item.id,
        transcriptSha256_16: hashText(item.transcript),
        error: redacted.slice(0, 200),
        elapsedMs: Date.now() - started,
      });
      console.log(`✗ ${item.id}  ${redacted.slice(0, 120)}`);
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    promptId: CAPTURE_V2_PROMPT_ID,
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    requestedModel,
    sampleCount: sample.length,
    note: "Held-out live sample. No raw transcripts. Not CI. Do not tune until evaluation.",
    rows,
  };
  const dir = join(process.cwd(), "test-results");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "capture-live-held-out.json");
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${path}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message.replace(/sk-[a-zA-Z0-9._-]+/g, "[redacted]"));
  process.exit(1);
});
