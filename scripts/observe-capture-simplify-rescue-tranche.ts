/**
 * Rescue-tranche live observe vs the same extracted envelopes.
 *
 * Extracts once (Prompt A unchanged), then this checkout resolves.
 * Pair with a baseline worktree replay of the saved envelopes.
 *
 * Usage: npx tsx scripts/observe-capture-simplify-rescue-tranche.ts
 *        npx tsx scripts/observe-capture-simplify-rescue-tranche.ts --replay <envelopes.json>
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

const JOURNEYS = [
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
    id: "supported-complete",
    family: "remove",
    projectId: CANDYLAND_ID,
    transcript: "Prepare the jelly pack is done.",
  },
  {
    id: "true-no-change",
    family: "no_change",
    projectId: CANDYLAND_ID,
    transcript: "Parade day is still 15 October 2026. No change to that date.",
  },
  {
    id: "suspicious-no-change",
    family: "suspicious",
    projectId: CANDYLAND_ID,
    transcript: "Add a to-do to reprint the visitor badges.",
  },
  {
    id: "ambiguous-person",
    family: "needs_you",
    projectId: TOYWORLD_ID,
    transcript: "Brick from the warehouse called; he wants to help with assembly.",
  },
  {
    id: "vague-concern",
    family: "vague",
    projectId: CANDYLAND_ID,
    transcript: "Security seem worried about it.",
  },
  {
    id: "mixed-clear-and-unclear",
    family: "mixed",
    projectId: CANDYLAND_ID,
    transcript:
      "Please add a to-do to order extra sprinkles, and I think Security might be worried.",
  },
  {
    id: "missing-date-english",
    family: "hydrate",
    projectId: CANDYLAND_ID,
    transcript: "Parade day is still the fifteenth of October 2026.",
  },
];

const SYNTHETIC = [
  {
    id: "synthetic-foreign-id",
    family: "foreign",
    projectId: CANDYLAND_ID,
    transcript: "Collect the void keys from the depot on 16 October 2026.",
    raw: {
      observations: [
        {
          id: "obs-keys",
          statement: "Collect the void keys from the depot on 16 October 2026",
          evidence: "Collect the void keys from the depot on 16 October 2026.",
          domain: "todo",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: CANDYLAND_ID,
          candidateTargetId: "todo-from-another-universe",
          candidateTargetTitle: "Collect void keys from the depot",
          proposedValues: {
            title: "Collect void keys from the depot",
            date: "2026-10-16",
          },
        },
      ],
    },
  },
  {
    id: "synthetic-missing-date-no-change",
    family: "hydrate",
    projectId: CANDYLAND_ID,
    transcript: "Parade day is still 15 October 2026.",
    raw: {
      observations: [
        {
          id: "obs-parade",
          statement: "Parade day is still 15 October 2026",
          evidence: "Parade day is still 15 October 2026.",
          domain: "milestone",
          disposition: "no_change",
          truthIntent: "current",
          candidateTargetId: "ms-parade",
          candidateTargetTitle: "Parade day",
          proposedValues: { title: "Parade day" },
        },
      ],
    },
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

function summarise(transcript: string, raw: unknown, projectId: string) {
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: raw ?? { observations: [] },
    world: experimentalApplyWorld(),
    projectId,
  });
  const observations = run.resolved.map((row) => ({
    id: row.observation.id,
    disposition: row.observation.disposition,
    domain: row.observation.domain,
    truthIntent: row.observation.truthIntent,
    statement: row.observation.statement,
    decision: row.decision.kind,
    reason: "reason" in row.decision ? row.decision.reason : "",
  }));
  const rejected = run.validation.rejected.map((row) => ({
    id: row.id,
    disposition: row.disposition,
    statement: row.statement,
  }));
  return {
    observations,
    rejected,
    writes: observations.filter((row) => row.decision === "write").length,
    needsYou:
      observations.filter((row) => row.decision === "needs_you").length +
      rejected.length,
    noChange: observations.filter((row) => row.decision === "no_change").length,
    leftUntouched: observations.filter(
      (row) => row.disposition === "left_untouched",
    ).length,
    invalidTargets: run.result.findingsValidation?.invalidTargetCount ?? 0,
    silentEmpty:
      transcript.trim().split(/\s+/).length >= 3 &&
      run.resolved.length === 0 &&
      rejected.length === 0 &&
      (run.result.observationAccount?.needsYou ?? 0) === 0 &&
      (run.result.observationAccount?.leftUntouched ?? 0) === 0,
  };
}

async function main() {
  loadDotEnvLocal();
  const replayIdx = process.argv.indexOf("--replay");
  const replayPath = replayIdx >= 0 ? process.argv[replayIdx + 1] : null;

  type Saved = {
    id: string;
    family: string;
    projectId: string;
    transcript: string;
    raw: unknown;
    live?: boolean;
  };
  let saved: Saved[] = [];

  if (replayPath) {
    saved = JSON.parse(readFileSync(replayPath, "utf8")).envelopes as Saved[];
  } else {
    if (!isOpenAIConfigured()) {
      console.error(
        "Live rescue-tranche observe skipped: OPENAI_API_KEY is not configured.",
      );
      process.exit(2);
    }
    const world = experimentalApplyWorld();
    for (const journey of JOURNEYS) {
      const project = world.projects.find((row) => row.id === journey.projectId)!;
      const extracted = await complete({
        system: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
        user: buildObservationExtractionPrompt({
          transcript: journey.transcript,
          projectBlock: formatAuthoritativeStateForPrompt(
            contextRecordsFromWorld(world, journey.projectId),
            { id: project.id, name: project.name, code: project.code },
          ),
        }),
      });
      if (extracted.error) {
        console.error(`${journey.id}: ${extracted.error}`);
        process.exit(1);
      }
      saved.push({
        id: journey.id,
        family: journey.family,
        projectId: journey.projectId,
        transcript: journey.transcript,
        raw: extracted.raw,
        live: true,
      });
    }
    for (const row of SYNTHETIC) {
      saved.push({
        id: row.id,
        family: row.family,
        projectId: row.projectId,
        transcript: row.transcript,
        raw: row.raw,
        live: false,
      });
    }
  }

  const rows = saved.map((journey) => {
    const summary = summarise(journey.transcript, journey.raw, journey.projectId);
    console.log(`\n${journey.id} (${journey.family}${journey.live ? ", live" : ", fixture"})`);
    console.log(`  ${JSON.stringify(summary)}`);
    return { ...journey, result: summary };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.writes += row.result.writes;
      acc.needsYou += row.result.needsYou;
      acc.noChange += row.result.noChange;
      acc.leftUntouched += row.result.leftUntouched;
      acc.silent += row.result.silentEmpty ? 1 : 0;
      return acc;
    },
    { writes: 0, needsYou: 0, noChange: 0, leftUntouched: 0, silent: 0 },
  );
  const ordinary = rows.filter(
    (row) => row.id === "ordinary-create" || row.id === "ordinary-update",
  );
  const ordinaryWrites = ordinary.reduce((n, row) => n + row.result.writes, 0);

  const report = {
    label: replayPath ? "replay" : "head",
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    model: resolveOpenAIChatModel(),
    totals,
    ordinaryWrites,
    journeys: rows.map((row) => ({
      id: row.id,
      family: row.family,
      live: row.live ?? false,
      result: row.result,
    })),
  };

  const envelopes = {
    envelopes: saved.map(({ id, family, projectId, transcript, raw, live }) => ({
      id,
      family,
      projectId,
      transcript,
      raw,
      live,
    })),
  };

  for (const dir of [join(process.cwd(), "test-results"), "/opt/cursor/artifacts"]) {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "capture-simplify-rescue-tranche-observe.json"),
        JSON.stringify(report, null, 2),
      );
      if (!replayPath) {
        writeFileSync(
          join(dir, "capture-simplify-rescue-tranche-envelopes.json"),
          JSON.stringify(envelopes, null, 2),
        );
      }
    } catch {
      // Artifact dir may be unavailable.
    }
  }

  console.log("\n=== Rescue-tranche observe summary ===");
  console.log(JSON.stringify({ ...totals, ordinaryWrites }, null, 2));

  if (ordinaryWrites === 0) {
    console.error("\nSTOP: ordinary Capture writes disappeared.");
    process.exit(1);
  }
  if (totals.silent > 0) {
    console.error("\nSTOP: meaningful source text disappeared silently.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
