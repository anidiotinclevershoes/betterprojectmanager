/**
 * Optional live OpenAI diagnostic for Tom's hosted Capture / New Project inputs.
 * Never fakes a model result. Skip when OPENAI_API_KEY is missing.
 *
 * Run: npx tsx scripts/diagnose-capture-intelligence.ts
 */
import { writeFileSync } from "node:fs";
import { isOpenAIConfigured } from "../src/lib/openai";
import { extractObservationsWithOpenAI } from "../src/lib/capture-v2/extract";
import { runCaptureV2FromModelJson } from "../src/lib/capture-v2";
import {
  parseNewProjectV2Envelope,
  draftFromProvisional,
} from "../src/lib/new-project-v2";
import { mergeOrganisedDraft } from "../src/lib/new-project/merge-organised";
import { needsYouFromDraft } from "../src/lib/new-project/needs-you";
import { composePersonLine } from "../src/lib/new-project/people-line";
import { resolveOpenAIChatModel } from "../src/lib/openai-model";
import type { CaptureApplyWorld } from "../src/lib/capture/apply";
import type { CreateProjectInput } from "../src/lib/create-project";

const NP_NARRATIVE = [
  "Olga Petrov is responsible for UAT.",
  "Sarah Kim is responsible for Release.",
].join("\n");

const CAPTURE_TRANSCRIPT = [
  "Production release has moved from 12 September to 19 September.",
  "The CAB preparation session is cancelled and is no longer required.",
  "Andris will take ownership of Legacy.",
  "Olga Petrov and Sarah Kim discussed the UAT handover. She will own UAT going forward.",
  "Cutover runbook v3 is now the working runbook.",
].join("\n\n");

const PROJECT = "proj-aurora";

function world(): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT]),
    projects: [
      {
        id: PROJECT,
        name: "Aurora Migration",
        code: "AM",
        stakeholders: [
          { id: "person-olga", name: "Olga Petrov", role: "" },
          { id: "person-sarah", name: "Sarah Kim", role: "" },
        ],
      },
    ],
    risks: [],
    todos: [],
    timeline: [
      {
        id: "ms-production-release",
        projectId: PROJECT,
        label: "Production release",
        startAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: "ms-cab-prep",
        projectId: PROJECT,
        label: "CAB preparation session",
        startAt: "2026-09-10T00:00:00.000Z",
      },
    ],
    knowledge: [
      {
        projectId: PROJECT,
        sections: { people: [], risks: [] },
        structured: [
          {
            id: "know-runbook-v2",
            kind: "fact",
            lifecycle: "current",
            body: "Cutover runbook v2 is the working runbook",
            meta: null,
          },
        ],
      },
    ],
  };
}

function emptyCompose(): CreateProjectInput {
  return {
    name: "Aurora Migration",
    code: "AM",
    summary: "",
    kind: "delivery",
    currentFocus: "",
    sourceMode: "paste",
    stakeholders: [],
  };
}

async function main() {
  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    console.log(line);
  };

  log("Capture intelligence live diagnostic");
  log(`requestedModel=${resolveOpenAIChatModel()}`);
  if (!isOpenAIConfigured()) {
    log("LIVE EXTRACT SKIPPED: OPENAI_API_KEY is not configured in this environment. No model output was invented.");
    log("Deterministic Lume traces: npx tsx scripts/verify-capture-intelligence-diagnostic.ts");
    return;
  }

  log("--- New Project Organise live extract ---");
  const npStarted = Date.now();
  const npExtract = await extractObservationsWithOpenAI({
    transcript: NP_NARRATIVE,
    projectBlock:
      "Current project: (unscoped)\nAuthoritative current records:\n(none)",
  });
  log(
    JSON.stringify(
      {
        provider: npExtract.provider,
        requestedModel: npExtract.requestedModel,
        responseModel: npExtract.responseModel,
        promptId: npExtract.promptId,
        promptVersion: npExtract.promptVersion,
        path: npExtract.path,
        fallback: npExtract.fallback,
        elapsedMs: Date.now() - npStarted,
        observationCount: npExtract.observationCount,
        usage: npExtract.providerUsage,
      },
      null,
      2,
    ),
  );
  const parsed = parseNewProjectV2Envelope(npExtract.rawModelJson);
  log(
    `envelopeMalformed=${parsed.envelopeMalformed} items=${parsed.items.length}`,
  );
  for (const item of parsed.items) {
    log(
      `- ${item.modelDomain}/${item.disposition}/${item.truthIntent} needsReview=${item.needsReview} name=${String(item.proposedValues?.name ?? item.proposedValues?.personName ?? "")} scope=${String(item.proposedValues?.scope ?? "")} statement=${item.statement}`,
    );
  }
  const draft = draftFromProvisional({
    sourceNarrative: NP_NARRATIVE,
    sourceMode: "paste",
    project: parsed.project,
    items: parsed.items,
  });
  const merged = mergeOrganisedDraft(emptyCompose(), draft);
  log(
    `people=${(merged.stakeholders ?? []).map((s) => composePersonLine(s)).join(" | ") || "(none)"}`,
  );
  log(
    `needsYou=${needsYouFromDraft(merged).map((q) => q.question).join(" | ") || "(none)"}`,
  );

  log("--- Capture live extract ---");
  const capStarted = Date.now();
  const records = [
    `id=${PROJECT} domain=project title="Aurora Migration"`,
    `id=person-olga domain=person title="Olga Petrov"`,
    `id=person-sarah domain=person title="Sarah Kim"`,
    `id=ms-production-release domain=milestone title="Production release"`,
    `id=ms-cab-prep domain=milestone title="CAB preparation session"`,
  ].join("\n");
  const capExtract = await extractObservationsWithOpenAI({
    transcript: CAPTURE_TRANSCRIPT,
    projectBlock: `Current project: Aurora Migration (AM) id=${PROJECT}\nAuthoritative current records:\n${records}`,
  });
  log(
    JSON.stringify(
      {
        provider: capExtract.provider,
        requestedModel: capExtract.requestedModel,
        responseModel: capExtract.responseModel,
        promptId: capExtract.promptId,
        promptVersion: capExtract.promptVersion,
        path: capExtract.path,
        fallback: capExtract.fallback,
        elapsedMs: Date.now() - capStarted,
        observationCount: capExtract.observationCount,
        usage: capExtract.providerUsage,
      },
      null,
      2,
    ),
  );
  const run = runCaptureV2FromModelJson({
    transcript: CAPTURE_TRANSCRIPT,
    rawModelJson: capExtract.rawModelJson,
    world: world(),
    projectId: PROJECT,
  });
  for (const row of run.resolved) {
    const reason = "reason" in row.decision ? row.decision.reason : "";
    const write =
      row.decision.kind === "write" ? row.decision.operation.type : "";
    log(
      `- ${row.observation.domain}/${row.observation.disposition} → ${row.decision.kind}${write ? `:${write}` : ""} ${reason} | ${row.observation.statement}`,
    );
  }

  try {
    writeFileSync(
      "/opt/cursor/artifacts/capture_intelligence_live_diagnostic.log",
      lines.join("\n"),
      "utf8",
    );
  } catch {
    // Artifact dir may be absent in local runs.
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
