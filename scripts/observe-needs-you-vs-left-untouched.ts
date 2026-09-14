/**
 * Phase 2 live observe — representative Capture outcomes after
 * Needs You vs Left untouched routing. Does not retune Prompt A.
 *
 * Usage:
 *   npx tsx scripts/observe-needs-you-vs-left-untouched.ts
 *   npm run observe:needs-you-vs-left-untouched
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
import {
  CANDYLAND_ID,
  TOYWORLD_ID,
  experimentalApplyWorld,
} from "../src/lib/experiments/worlds";

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

const JOURNEYS: Array<{
  id: string;
  family: "create" | "update" | "needs_you" | "unsupported" | "vague" | "mixed";
  projectId: string;
  transcript: string;
}> = [
  {
    id: "ordinary-create",
    family: "create",
    projectId: CANDYLAND_ID,
    transcript:
      "Please add a to-do to polish the candy-cane banners before the float leaves.",
  },
  {
    id: "ordinary-update",
    family: "update",
    projectId: CANDYLAND_ID,
    transcript: "The icing on Gumdrop Bridge has melted; that risk is closed.",
  },
  {
    id: "bounded-identity",
    family: "needs_you",
    projectId: TOYWORLD_ID,
    transcript: "Brick from the warehouse called; he wants to help with assembly.",
  },
  {
    id: "unsupported-cancel",
    family: "unsupported",
    projectId: CANDYLAND_ID,
    transcript:
      "Cancel the Parade day milestone — we are not holding the parade this year.",
  },
  {
    id: "vague-security",
    family: "vague",
    projectId: CANDYLAND_ID,
    transcript: "Security seem worried about it.",
  },
  {
    id: "mixed-clear-and-unclear",
    family: "mixed",
    projectId: CANDYLAND_ID,
    transcript:
      "Sarah owns UAT, CAB moved Friday, and I think Security might be worried.",
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

async function complete(args: {
  system: string;
  user: string;
}): Promise<{ raw: unknown; text: string; error?: string }> {
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

function summarise(transcript: string, projectId: string, raw: unknown) {
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: raw ?? { observations: [] },
    world: experimentalApplyWorld(),
    projectId,
  });
  const observations = run.resolved.map((row) => ({
    disposition: row.observation.disposition,
    domain: row.observation.domain,
    statement: row.observation.statement,
    commentary: row.observation.commentary,
    decision: row.decision.kind,
  }));
  const leftovers = run.resolved.filter(
    (row) => row.observation.disposition === "left_untouched",
  );
  const account = run.result.observationAccount;
  return {
    observations,
    writes: observations.filter((row) => row.decision === "write").length,
    needsYou: observations.filter((row) => row.decision === "needs_you").length,
    leftUntouched:
      leftovers.length || (account?.leftUntouched ?? 0),
    accountNeedsYou: account?.needsYou ?? 0,
    accountLeftUntouched: account?.leftUntouched ?? 0,
    silentEmpty:
      transcript.trim().split(/\s+/).length >= 3 &&
      run.resolved.length === 0 &&
      (account?.needsYou ?? 0) === 0 &&
      (account?.leftUntouched ?? 0) === 0,
  };
}

async function main() {
  loadDotEnvLocal();
  if (!isOpenAIConfigured()) {
    console.error(
      "Live Phase 2 observe skipped: OPENAI_API_KEY is not configured. No results were invented.",
    );
    process.exit(2);
  }

  const world = experimentalApplyWorld();
  const rows: unknown[] = [];
  let ordinaryWrites = 0;
  let silent = 0;

  for (const journey of JOURNEYS) {
    const project = world.projects.find((row) => row.id === journey.projectId);
    if (!project) throw new Error(`missing project ${journey.projectId}`);
    const projectBlock = formatAuthoritativeStateForPrompt(
      contextRecordsFromWorld(world, journey.projectId),
      { id: project.id, name: project.name, code: project.code },
    );
    const extracted = await complete({
      system: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
      user: buildObservationExtractionPrompt({
        transcript: journey.transcript,
        projectBlock,
      }),
    });
    const summary = extracted.error
      ? { error: extracted.error }
      : summarise(journey.transcript, journey.projectId, extracted.raw);
    if (!("error" in summary)) {
      if (journey.family === "create" || journey.family === "update") {
        ordinaryWrites += summary.writes;
      }
      if (summary.silentEmpty) silent += 1;
    }
    rows.push({
      id: journey.id,
      family: journey.family,
      transcript: journey.transcript,
      result: summary,
    });
    console.log(`\n${journey.id} (${journey.family})`);
    console.log(`  ${JSON.stringify(summary)}`);
  }

  const report = {
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    model: resolveOpenAIChatModel(),
    ordinaryWrites,
    silentOmissions: silent,
    journeys: rows,
  };

  for (const dir of [join(process.cwd(), "test-results"), "/opt/cursor/artifacts"]) {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "needs-you-vs-left-untouched-observe.json"),
        JSON.stringify(report, null, 2),
      );
    } catch {
      // Artifact dir may be unavailable in some environments.
    }
  }

  console.log("\n=== Phase 2 live observe summary ===");
  console.log(`ordinary writes  ${ordinaryWrites}`);
  console.log(`silent omissions ${silent}`);

  if (ordinaryWrites === 0) {
    console.error("\nSTOP: ordinary Capture writes disappeared.");
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
