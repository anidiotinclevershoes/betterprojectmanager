/**
 * Opt-in live A/B/C/D prompt comparison on the frozen holdout.
 *
 *   LUME_CAPTURE_LIVE=1 npx tsx scripts/capture-convergence/prompt-experiment/run.ts
 *   LUME_CAPTURE_LIVE=1 npx tsx scripts/capture-convergence/prompt-experiment/run.ts --variant C
 *
 * Never CI. Production extract path is unchanged. Exits 2 without a key.
 * Variants B/C/D are called from this runner only — not /api/capture.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
} from "../../../src/lib/capture-v2/context";
import { getOpenAIKey } from "../../../src/lib/openai";
import { PINNED_OPENAI_CHAT_MODEL } from "../../../src/lib/openai-model";
import { heldOutTranscripts } from "../held-out";
import { runPipeline } from "../pipeline";
import { worldFor } from "../worlds";
import {
  extractWithPromptVariant,
  PROMPT_EXPERIMENT_TEMPERATURE,
} from "./extract-variant";
import { FROZEN_PROMPT_HOLDOUT, PROMPT_HOLDOUT_FROZEN_AT } from "./holdout";
import { PROMPT_VARIANT_META, type PromptVariantId } from "./prompts";
import { addToTotals, emptyTotals, scoreHoldoutCase } from "./score";

const ALL_VARIANTS: PromptVariantId[] = ["A", "B", "C", "D"];

function requestedVariants(): PromptVariantId[] {
  const idx = process.argv.indexOf("--variant");
  if (idx < 0) return ALL_VARIANTS;
  const raw = (process.argv[idx + 1] ?? "").toUpperCase();
  if (raw === "ALL") return ALL_VARIANTS;
  if (!ALL_VARIANTS.includes(raw as PromptVariantId)) {
    throw new Error(`Unknown --variant ${raw}. Use A, B, C, D, or ALL.`);
  }
  return [raw as PromptVariantId];
}

function redact(message: string): string {
  return message.replace(/sk-[a-zA-Z0-9._-]+/g, "[redacted]");
}

function errorClass(message: string): string {
  const status = message.match(/\((\d{3})\)/);
  if (status) return status[1];
  if (/network|fetch|ECONN|ETIMEDOUT|ENOTFOUND/i.test(message)) return "network";
  return "error";
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
  if (process.env.OPENAI_MODEL?.trim()) {
    console.error("OPENAI_MODEL is set. Unset it — this experiment pins gpt-4o-mini-2024-07-18.");
    process.exit(2);
  }

  const variants = requestedVariants();
  const wanted = new Set(FROZEN_PROMPT_HOLDOUT.map((row) => row.id));
  const sample = heldOutTranscripts().filter((row) => wanted.has(row.id));

  console.log(`Frozen holdout ${PROMPT_HOLDOUT_FROZEN_AT}`);
  console.log(
    `model=${PINNED_OPENAI_CHAT_MODEL} temperature=${PROMPT_EXPERIMENT_TEMPERATURE} variants=${variants.join(",")}`,
  );
  console.log(`cases=${sample.length} (production prompt.ts unchanged)\n`);

  const variantResults: Record<string, unknown> = {};
  for (const variant of variants) {
    const meta = PROMPT_VARIANT_META[variant];
    const totals = emptyTotals();
    const rows: unknown[] = [];
    console.log(`--- variant ${variant} (${meta.label}) ---`);

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
      try {
        const call = await extractWithPromptVariant({
          variant,
          transcript: item.transcript,
          projectBlock,
        });
        const pipeline = runPipeline({
          transcript: item.transcript,
          rawModelJson: call.rawModelJson,
          world,
          projectId: item.projectId,
        });
        const score = scoreHoldoutCase({
          holdout,
          transcript: item.transcript,
          raw: call.rawModelJson,
          snapshot: pipeline.snapshot,
          records,
          projectId: item.projectId,
        });
        addToTotals(totals, score);
        rows.push({
          id: item.id,
          theme: holdout.theme,
          promptVersion: call.promptVersion,
          requestedModel: call.requestedModel,
          responseModel: call.responseModel,
          elapsedMs: call.elapsedMs,
          usage: call.providerUsage,
          observationCountModel: call.observationCount,
          ...score,
        });
        console.log(
          `${item.id}  recall=${score.recallHits}/${score.recallPossible}  invent=${score.inventions}  foreign_id=${score.foreignId}  contam=${score.identityContamination}  pronoun=${score.unsafePronounResolution}  writes=${score.writes}  needs_you=${score.needsYou}  ambig=${score.ambiguityPreserved ?? "-"}`,
        );
      } catch (err) {
        const message = redact(err instanceof Error ? err.message : String(err));
        const klass = errorClass(message);
        totals.errors += 1;
        rows.push({
          id: item.id,
          theme: holdout.theme,
          errorClass: klass,
          error: message.slice(0, 200),
        });
        console.log(`✗ ${item.id}  class=${klass}  ${message.slice(0, 120)}`);
        if (klass === "401" || klass === "403") {
          throw new Error(`Auth failed (${klass}). Stopping remaining calls.`);
        }
      }
    }

    variantResults[variant] = {
      meta,
      totals,
      rows,
    };
    console.log(
      `totals ${variant}: recall=${totals.recallHits}/${totals.recallPossible} invent=${totals.inventions} foreign_id=${totals.foreignId} contam=${totals.identityContamination} pronoun=${totals.unsafePronounResolution} writes=${totals.writes} needs_you=${totals.needsYou} obs=${totals.observationCount} errors=${totals.errors}\n`,
    );
  }

  const out = {
    generatedAt: new Date().toISOString(),
    holdoutFrozenAt: PROMPT_HOLDOUT_FROZEN_AT,
    requestedModel: PINNED_OPENAI_CHAT_MODEL,
    temperature: PROMPT_EXPERIMENT_TEMPERATURE,
    note: "Frozen holdout live comparison. No raw transcripts. Production prompt.ts unchanged.",
    variants: variantResults,
  };
  const dir = join(process.cwd(), "test-results");
  mkdirSync(dir, { recursive: true });
  const livePath = join(dir, "prompt-experiment-holdout.json");
  writeFileSync(livePath, JSON.stringify(out, null, 2));
  const committedPath = join(
    process.cwd(),
    "scripts/capture-convergence/prompt-experiment/holdout-results.json",
  );
  writeFileSync(committedPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${livePath}`);
  console.log(`Wrote ${committedPath}`);
}

main().catch((err) => {
  console.error(redact(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
