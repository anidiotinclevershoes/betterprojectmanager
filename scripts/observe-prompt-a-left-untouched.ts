/**
 * Phase 1 live observe-only comparison.
 *
 * Runs representative transcripts through production Prompt A (v2) and the
 * Phase 0 Prompt A snapshot (v1). Does not Apply. Never fakes success.
 *
 * Usage:
 *   npx tsx scripts/observe-prompt-a-left-untouched.ts
 *   npm run observe:prompt-a-left-untouched
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

/** Exact Phase 0 Prompt A from origin/main before this freeze. */
function buildPhase0Prompt(args: { transcript: string; projectBlock: string }): string {
  const schema = `{
  "observations": [
    {
      "id": "obs-1",
      "statement": "short atomic fact",
      "evidence": "verbatim quote from the transcript",
      "domain": "person | responsibility | risk | milestone | todo | availability | knowledge | decision | commentary | unknown",
      "disposition": "update_existing | create_new | no_change | ambiguous | merge | commentary | ignore",
      "truthIntent": "current | non_current | uncertain",
      "projectId": "only an id supplied in current project state",
      "candidateTargetId": "only an id supplied in current project state, or omit",
      "candidateTargetTitle": "current title if targeting an existing record",
      "mergeWithObservationId": "optional id of a duplicate observation",
      "proposedValues": {
        "name": "person create/update: explicit usable person name",
        "personName": "availability/responsibility: explicit usable person name",
        "title": "todo/risk create: concise title",
        "label": "milestone create: semantic date label, not the whole transcript",
        "date": "ISO YYYY-MM-DD when the domain is a dated fact",
        "startAt": "ISO YYYY-MM-DD milestone date if not using date",
        "awayFromIso": "availability: ISO YYYY-MM-DD start",
        "awayToIso": "availability: ISO YYYY-MM-DD end, or omit to use awayFromIso",
        "scope": "responsibility: the owned thing",
        "ownershipSemantics": "share | replace | continue | ambiguous",
        "status": "risk/todo update: open | watch | resolved | accepted | complete",
        "text": "knowledge/decision body when statement is not enough"
      },
      "commentary": "optional note when disposition is commentary or ambiguous",
      "modelConfidence": 0
    }
  ]
}`;
  return `You extract atomic project observations. You do not mutate a database.

Rules:
- Split the transcript into the smallest project-relevant facts (multiple observations per sentence are expected).
- Every observation needs a verbatim evidence quote from the transcript.
- candidateTargetId MUST be copied from the supplied current records. Never invent IDs.
- If a person/risk/date/todo already exists, prefer update_existing or no_change over create_new.
- If share vs replace (or two plausible targets) cannot be decided from the transcript, disposition=ambiguous.
- truthIntent=current only when the user is asserting this as current authoritative project truth (including explicit corrections, agreed dates/ownership, and agreed future milestones). truthIntent=non_current for historical, quoted, superseded, considered-but-not-agreed, or rejected alternatives. truthIntent=uncertain when it is unclear whether current truth should change.
- Restating existing current truth without a change is disposition=no_change. Do not mark historical or quoted material as truthIntent=current.
- Put domain-required values in proposedValues. Do not invent missing values. If a required value is unknown, omit it (Lume will Needs You) rather than guessing.
- Person create: proposedValues.name must be the explicit usable person name.
- Milestone create: proposedValues.label and proposedValues.date (ISO YYYY-MM-DD).
- Availability: proposedValues.personName (or name) and proposedValues.awayFromIso (ISO). Optional awayToIso.
- Responsibility: proposedValues.personName, proposedValues.scope, and proposedValues.ownershipSemantics (share|replace|continue|ambiguous).
- Todo create: proposedValues.title. Risk create: proposedValues.title. Knowledge/decision: proposedValues.text or a clear statement.
- Project-irrelevant chatter is domain=commentary and disposition=commentary.
- Duplicate restatements: keep one observation and mark others disposition=merge.
- Do not output operations, SQL, or Apply Ready. Confidence is informational only.

Current authoritative project state:
${args.projectBlock}

Transcript:
"""
${args.transcript}
"""

Return JSON only, matching:
${schema}`;
}

const PHASE0_SYSTEM =
  "You extract atomic project observations as JSON. You do not mutate a database. You never invent record IDs.";

type JourneyFamily =
  | "ordinary"
  | "no_change"
  | "needs_you"
  | "left_untouched"
  | "mixed"
  | "chatter";

const JOURNEYS: Array<{
  id: string;
  family: JourneyFamily;
  projectId: string;
  transcript: string;
}> = [
  {
    id: "ordinary-todo",
    family: "ordinary",
    projectId: CANDYLAND_ID,
    transcript:
      "Please add a to-do to polish the candy-cane banners before the float leaves.",
  },
  {
    id: "ordinary-new-person",
    family: "ordinary",
    projectId: TOYWORLD_ID,
    transcript:
      "Velvet Sprocket is joining as paint lead for the wooden-track refresh.",
  },
  {
    id: "ordinary-risk-resolve",
    family: "ordinary",
    projectId: CANDYLAND_ID,
    transcript: "The icing on Gumdrop Bridge has melted; that risk is closed.",
  },
  {
    id: "ordinary-milestone",
    family: "ordinary",
    projectId: CANDYLAND_ID,
    transcript: "Parade day is now 29 October 2026.",
  },
  {
    id: "no-change-person",
    family: "no_change",
    projectId: CANDYLAND_ID,
    transcript: "Pippa Gumdrop is still the UAT lead for the licorice stands.",
  },
  {
    id: "needs-you-ambiguous-person",
    family: "needs_you",
    projectId: TOYWORLD_ID,
    transcript: "Brick from the warehouse called; he wants to help with assembly.",
  },
  {
    id: "needs-you-share-replace",
    family: "needs_you",
    projectId: CANDYLAND_ID,
    transcript:
      "Fizz Caramel might take UAT from Pippa Gumdrop, or they might share it — the parade committee was unclear.",
  },
  {
    id: "left-untouched-security",
    family: "left_untouched",
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
  {
    id: "chatter",
    family: "chatter",
    projectId: CANDYLAND_ID,
    transcript: "That meeting was a vibe. Lunch was fine.",
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

function summariseRun(transcript: string, projectId: string, raw: unknown) {
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: raw ?? { observations: [] },
    world: experimentalApplyWorld(),
    projectId,
  });
  const dispositions = run.resolved.map((row) => row.observation.disposition);
  const decisions = run.resolved.map((row) => row.decision.kind);
  const leftovers = run.resolved.filter(
    (row) => row.observation.disposition === "left_untouched",
  );
  const leftoverReasons = leftovers.map((row) => row.observation.commentary ?? "");
  const advises = leftoverReasons.some((reason) =>
    /you should|create a risk|recommend|I suggest/i.test(reason),
  );
  return {
    dispositions,
    decisions,
    writes: decisions.filter((kind) => kind === "write").length,
    needsYou: decisions.filter((kind) => kind === "needs_you").length,
    noChange: decisions.filter((kind) => kind === "no_change").length,
    leftUntouched: leftovers.length,
    leftoverReasons,
    leftoverAdvises: advises,
    silentEmpty:
      isMeaningful(transcript) &&
      run.resolved.length === 0 &&
      (run.result.observationAccount?.needsYou ?? 0) === 0 &&
      (run.result.observationAccount?.leftUntouched ?? 0) === 0,
  };
}

function isMeaningful(text: string): boolean {
  return text.trim().split(/\s+/).length >= 3;
}

async function main() {
  loadDotEnvLocal();
  if (!isOpenAIConfigured()) {
    console.error(
      "Live Prompt A observe skipped: OPENAI_API_KEY is not configured. No results were invented.",
    );
    process.exit(2);
  }

  const world = experimentalApplyWorld();
  const rows: unknown[] = [];
  let ordinaryWritesV2 = 0;
  let ordinaryWritesV1 = 0;
  let leftoverV2 = 0;
  let leftoverV1 = 0;
  let adviceReasons = 0;
  let silent = 0;

  for (const journey of JOURNEYS) {
    const project = world.projects.find((row) => row.id === journey.projectId);
    if (!project) throw new Error(`missing project ${journey.projectId}`);
    const projectBlock = formatAuthoritativeStateForPrompt(
      contextRecordsFromWorld(world, journey.projectId),
      { id: project.id, name: project.name, code: project.code },
    );

    const v2 = await complete({
      system: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
      user: buildObservationExtractionPrompt({
        transcript: journey.transcript,
        projectBlock,
      }),
    });
    const v1 = await complete({
      system: PHASE0_SYSTEM,
      user: buildPhase0Prompt({
        transcript: journey.transcript,
        projectBlock,
      }),
    });

    const v2Summary = v2.error
      ? { error: v2.error }
      : summariseRun(journey.transcript, journey.projectId, v2.raw);
    const v1Summary = v1.error
      ? { error: v1.error }
      : summariseRun(journey.transcript, journey.projectId, v1.raw);

    if (!("error" in v2Summary) && journey.family === "ordinary") {
      ordinaryWritesV2 += v2Summary.writes;
    }
    if (!("error" in v1Summary) && journey.family === "ordinary") {
      ordinaryWritesV1 += v1Summary.writes;
    }
    if (!("error" in v2Summary)) {
      leftoverV2 += v2Summary.leftUntouched;
      if (v2Summary.leftoverAdvises) adviceReasons += 1;
      if (v2Summary.silentEmpty) silent += 1;
    }
    if (!("error" in v1Summary)) leftoverV1 += v1Summary.leftUntouched;

    const row = {
      id: journey.id,
      family: journey.family,
      transcript: journey.transcript,
      v2: v2Summary,
      v1: v1Summary,
    };
    rows.push(row);
    console.log(`\n${journey.id} (${journey.family})`);
    console.log(`  v2 ${JSON.stringify(v2Summary)}`);
    console.log(`  v1 ${JSON.stringify(v1Summary)}`);
  }

  const report = {
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    comparedAgainst: "capture-v2-eval-baseline-v1",
    model: resolveOpenAIChatModel(),
    ordinaryWritesV2,
    ordinaryWritesV1,
    leftoverV2,
    leftoverV1,
    leftoverAdviceReasonsV2: adviceReasons,
    silentOmissionsV2: silent,
    journeys: rows,
  };

  const outDirs = [
    join(process.cwd(), "test-results"),
    "/opt/cursor/artifacts",
  ];
  for (const dir of outDirs) {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "prompt-a-left-untouched-observe.json"),
        JSON.stringify(report, null, 2),
      );
    } catch {
      // Artifact dir may be unavailable in some environments.
    }
  }

  console.log("\n=== Phase 1 live observe summary ===");
  console.log(`ordinary writes  v2=${ordinaryWritesV2}  v1=${ordinaryWritesV1}`);
  console.log(`left_untouched   v2=${leftoverV2}  v1=${leftoverV1}`);
  console.log(`advice reasons   v2=${adviceReasons}`);
  console.log(`silent omissions v2=${silent}`);

  if (ordinaryWritesV2 === 0 && ordinaryWritesV1 > 0) {
    console.error(
      "\nSTOP: ordinary Capture writes disappeared under Prompt A v2.",
    );
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
