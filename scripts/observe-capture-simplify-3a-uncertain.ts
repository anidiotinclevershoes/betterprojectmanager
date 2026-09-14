/**
 * Phase 3A live observe — uncertain rematerialisation removed.
 * Does not retune Prompt A. Exits 1 if ordinary Create/Update disappear.
 *
 * Usage: npx tsx scripts/observe-capture-simplify-3a-uncertain.ts
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getOpenAIKey, isOpenAIConfigured } from "../src/lib/openai";
import { resolveOpenAIChatModel } from "../src/lib/openai-model";
import {
  CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
  CAPTURE_V2_PROMPT_VERSION,
  buildObservationExtractionPrompt,
} from "../src/lib/capture-v2/prompt";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
  runCaptureV2FromModelJson,
} from "../src/lib/capture-v2";
import { CANDYLAND_ID, experimentalApplyWorld } from "../src/lib/experiments/worlds";

function loadDotEnvLocal() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const JOURNEYS = [
  {
    id: "ordinary-create",
    family: "ordinary" as const,
    transcript:
      "Please add a to-do to polish the candy-cane banners before the float leaves.",
  },
  {
    id: "ordinary-update",
    family: "ordinary" as const,
    transcript: "The icing on Gumdrop Bridge has melted; that risk is closed.",
  },
  {
    id: "dated-create",
    family: "dated" as const,
    transcript: "Collect the void keys from the depot on 16 October 2026.",
  },
  {
    id: "might-move",
    family: "uncertain" as const,
    transcript: "Parade day might move to 22 October 2026.",
  },
  {
    id: "vague-security",
    family: "vague" as const,
    transcript: "Security seem worried about it.",
  },
];

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function complete(args: { system: string; user: string }) {
  const key = getOpenAIKey();
  const model = resolveOpenAIChatModel();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
  const detail = await response.text();
  if (!response.ok) {
    return { raw: null, text: "", error: `OpenAI ${response.status}: ${detail.slice(0, 400)}` };
  }
  const data = JSON.parse(detail) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { raw: parseJsonObject(text), text, error: text ? undefined : "empty response" };
}

function summarise(transcript: string, raw: unknown) {
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: raw ?? { observations: [] },
    world: experimentalApplyWorld(),
    projectId: CANDYLAND_ID,
  });
  const observations = run.resolved.map((row) => ({
    disposition: row.observation.disposition,
    domain: row.observation.domain,
    truthIntent: row.observation.truthIntent,
    statement: row.observation.statement,
    decision: row.decision.kind,
  }));
  const uncertainWrites = observations.filter(
    (row) => row.truthIntent === "uncertain" && row.decision === "write",
  );
  return {
    observations,
    writes: observations.filter((row) => row.decision === "write").length,
    needsYou: observations.filter((row) => row.decision === "needs_you").length,
    leftUntouched: observations.filter((row) => row.disposition === "left_untouched").length,
    uncertainWrites: uncertainWrites.length,
    silentEmpty:
      transcript.trim().split(/\s+/).length >= 3 &&
      run.resolved.length === 0 &&
      (run.result.observationAccount?.needsYou ?? 0) === 0 &&
      (run.result.observationAccount?.leftUntouched ?? 0) === 0,
  };
}

async function main() {
  loadDotEnvLocal();
  if (!isOpenAIConfigured()) {
    console.error(
      "Live Phase 3A observe skipped: OPENAI_API_KEY is not configured. No results were invented.",
    );
    process.exit(2);
  }

  const world = experimentalApplyWorld();
  const project = world.projects.find((row) => row.id === CANDYLAND_ID)!;
  const projectBlock = formatAuthoritativeStateForPrompt(
    contextRecordsFromWorld(world, CANDYLAND_ID),
    { id: project.id, name: project.name, code: project.code },
  );

  const rows: unknown[] = [];
  let ordinaryWrites = 0;
  let uncertainWrites = 0;
  let silent = 0;

  for (const journey of JOURNEYS) {
    const extracted = await complete({
      system: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
      user: buildObservationExtractionPrompt({
        transcript: journey.transcript,
        projectBlock,
      }),
    });
    const summary = extracted.error
      ? { error: extracted.error }
      : summarise(journey.transcript, extracted.raw);
    if (!("error" in summary)) {
      if (journey.family === "ordinary") ordinaryWrites += summary.writes;
      uncertainWrites += summary.uncertainWrites;
      if (summary.silentEmpty) silent += 1;
    }
    rows.push({ id: journey.id, family: journey.family, result: summary });
    console.log(`\n${journey.id} (${journey.family})`);
    console.log(`  ${JSON.stringify(summary)}`);
  }

  const report = {
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    model: resolveOpenAIChatModel(),
    ordinaryWrites,
    uncertainWrites,
    silentOmissions: silent,
    journeys: rows,
  };

  for (const dir of [join(process.cwd(), "test-results"), "/opt/cursor/artifacts"]) {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "capture-simplify-3a-uncertain-observe.json"),
        JSON.stringify(report, null, 2),
      );
    } catch {
      // Artifact dir may be unavailable.
    }
  }

  console.log("\n=== Phase 3A live observe summary ===");
  console.log(`ordinary writes     ${ordinaryWrites}`);
  console.log(`uncertain writes    ${uncertainWrites}`);
  console.log(`silent omissions    ${silent}`);

  if (ordinaryWrites === 0) {
    console.error("\nSTOP: ordinary Capture writes disappeared.");
    process.exit(1);
  }
  if (uncertainWrites > 0) {
    console.error("\nSTOP: uncertain observations became writes.");
    process.exit(1);
  }
  if (silent > 0) {
    console.error("\nSTOP: meaningful source text disappeared silently.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
