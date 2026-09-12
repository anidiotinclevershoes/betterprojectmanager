/**
 * Hosted Capture / New Project intelligence diagnostic.
 *
 * Traces Tom's 10 Sep 2026 Preview inputs through the real extract-adjacent
 * Lume stages. Does not call OpenAI. Does not retune prompts.
 *
 * Run: npx tsx scripts/verify-capture-intelligence-diagnostic.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseNewProjectV2Envelope,
  draftFromProvisional,
} from "../src/lib/new-project-v2";
import { asUsableString } from "../src/lib/capture-v2/contract";
import { runCaptureV2FromModelJson } from "../src/lib/capture-v2";
import type { CaptureApplyWorld } from "../src/lib/capture/apply";
import { mergeOrganisedDraft } from "../src/lib/new-project/merge-organised";
import { needsYouFromDraft } from "../src/lib/new-project/needs-you";
import { composePersonLine } from "../src/lib/new-project/people-line";
import type { CreateProjectInput } from "../src/lib/create-project";
import type { ProvisionalItem } from "../src/lib/new-project-v2/types";
import {
  CAPTURE_V2_EXTRACT_PATH,
  CAPTURE_V2_PROMPT_ID,
  CAPTURE_V2_PROMPT_VERSION,
  NEW_PROJECT_ADAPTER_PATH,
} from "../src/lib/capture-v2/prompt";
import { PINNED_OPENAI_CHAT_MODEL } from "../src/lib/openai-model";
import { resolveOpenAIChatModel } from "../src/lib/openai-model";

const ROOT = process.cwd();
let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

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
const OLGA = "person-olga";
const SARAH = "person-sarah";
const MS_RELEASE = "ms-production-release";
const MS_CAB = "ms-cab-prep";

function tomHostedWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([PROJECT]),
    projects: [
      {
        id: PROJECT,
        name: "Aurora Migration",
        code: "AM",
        stakeholders: [
          { id: OLGA, name: "Olga Petrov", role: "" },
          { id: SARAH, name: "Sarah Kim", role: "" },
        ],
      },
    ],
    risks: [],
    todos: [],
    timeline: [
      {
        id: MS_RELEASE,
        projectId: PROJECT,
        label: "Production release",
        startAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: MS_CAB,
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

/** Mapper Tom hit at 22:07 — scope went to role, never responsibilities[]. */
function draftFromProvisionalMainEra(args: {
  sourceNarrative: string;
  items: ProvisionalItem[];
}): CreateProjectInput {
  const stakeholders = args.items
    .filter((item) => item.category === "person")
    .map((item) => {
      const name =
        asUsableString(item.proposedValues?.name) ||
        asUsableString(item.proposedValues?.personName);
      return {
        clientKey: item.id,
        name: name ?? "",
        role:
          asUsableString(item.proposedValues?.role) ||
          asUsableString(item.proposedValues?.scope),
        needsReview: Boolean(item.needsReview) || !name,
      };
    });
  return {
    name: "Aurora Migration",
    code: "AM",
    summary: "",
    kind: "delivery",
    currentFocus: "",
    stakeholders,
    sourceNarrative: args.sourceNarrative,
    sourceMode: "paste",
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

function summariseResolved(transcript: string, raw: unknown) {
  const run = runCaptureV2FromModelJson({
    transcript,
    rawModelJson: raw,
    world: tomHostedWorld(),
    projectId: PROJECT,
  });
  return run.resolved.map((row) => ({
    statement: row.observation.statement,
    domain: row.observation.domain,
    disposition: row.observation.disposition,
    truthIntent: row.observation.truthIntent,
    proposed: row.observation.proposedValues ?? {},
    candidateTargetId: row.observation.candidateTargetId ?? null,
    validationRejected: false,
    decision: row.decision.kind,
    legalDomain: row.decision.domain,
    reason: "reason" in row.decision ? row.decision.reason : null,
    writeType:
      row.decision.kind === "write" ? row.decision.operation.type : null,
  }));
}

function main() {
  check("hosted Preview Capture path is live OpenAI extract, not local fallback", () => {
    const route = readSrc("src/app/api/capture/route.ts");
    const extract = readSrc("src/lib/capture-v2/extract.ts");
    assert.match(route, /capture\.v2_analysed/);
    assert.match(route, /ignoredClientTruth/);
    assert.match(route, /extractObservationsWithOpenAI/);
    assert.match(route, /runCaptureV2FromModelJson/);
    assert.match(route, /isProductionRuntime\(\) && !isOpenAIConfigured/);
    assert.match(route, /localFallbackReachable: !productionRuntime/);
    assert.match(extract, /https:\/\/api\.openai\.com\/v1\/chat\/completions/);
    assert.doesNotMatch(extract, /localCaptureFallback/);
    assert.match(extract, /throw new Error\("OPENAI_API_KEY is not configured"\)/);
  });

  check("requested model is pinned gpt-4o-mini snapshot unless OPENAI_MODEL is set", () => {
    assert.equal(PINNED_OPENAI_CHAT_MODEL, "gpt-4o-mini-2024-07-18");
    const prev = process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_EVAL_MODEL;
    assert.equal(resolveOpenAIChatModel(), "gpt-4o-mini-2024-07-18");
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    assert.equal(resolveOpenAIChatModel(), "gpt-4o-mini-2024-07-18");
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    assert.equal(resolveOpenAIChatModel(), "gpt-4.1-mini");
    if (prev === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = prev;
  });

  check("local/legacy fallback is unreachable on Vercel Preview (NODE_ENV=production)", () => {
    const route = readSrc("src/app/api/capture/route.ts");
    const v2 = route.slice(route.indexOf("async function postCaptureV2"));
    assert.match(v2, /localCaptureFallback/);
    const prodGuard = route.indexOf("isProductionRuntime() && !isOpenAIConfigured()");
    const fallback = v2.indexOf("localCaptureFallback");
    assert.ok(prodGuard >= 0 && fallback >= 0);
    const np = readSrc("src/app/api/new-project/route.ts");
    assert.doesNotMatch(np, /localCaptureFallback/);
    assert.match(np, /AI is not configured for this environment/);
  });

  check("New Project Organise uses the shared extractor, then a separate adapter — not Capture resolve/plan", () => {
    const np = readSrc("src/app/api/new-project/route.ts");
    assert.match(np, /extractObservationsWithOpenAI/);
    assert.match(np, /parseNewProjectV2Envelope/);
    assert.match(np, /draftFromProvisional/);
    assert.doesNotMatch(np, /runCaptureV2FromModelJson/);
    assert.doesNotMatch(np, /planCaptureApply/);
    assert.match(np, /new-project\.v2_organised/);
    assert.match(np, /NEW_PROJECT_ADAPTER_PATH/);
    assert.equal(NEW_PROJECT_ADAPTER_PATH.includes("draftFromProvisional"), true);
    assert.equal(CAPTURE_V2_EXTRACT_PATH.includes("extractObservationsWithOpenAI"), true);
    assert.equal(CAPTURE_V2_PROMPT_ID, "capture-v2-observations");
    assert.equal(CAPTURE_V2_PROMPT_VERSION, "capture-v2-eval-baseline-v1");
  });

  check("future hosted captures record provider/model/prompt/fallback without secrets or raw content", () => {
    const provenance = readSrc("src/lib/capture-v2/provenance.ts");
    const capture = readSrc("src/app/api/capture/route.ts");
    const np = readSrc("src/app/api/new-project/route.ts");
    assert.match(provenance, /Never logs secrets/);
    assert.match(capture, /requestedModel/);
    assert.match(capture, /responseModel/);
    assert.match(capture, /observationCount/);
    assert.match(np, /new-project\.v2_organised/);
    assert.doesNotMatch(provenance, /OPENAI_API_KEY/);
    assert.doesNotMatch(provenance, /transcript/);
    const analysed = capture.slice(capture.indexOf('logIntelligenceProvenance("capture.v2_analysed"'));
    const analysedBlock = analysed.slice(0, analysed.indexOf("return NextResponse.json"));
    assert.doesNotMatch(analysedBlock, /transcript/);
    assert.doesNotMatch(analysedBlock, /content,/);
  });

  const scopeOmittedEnvelope = {
    observations: [
      {
        id: "obs-olga",
        statement: "Olga Petrov is responsible for UAT.",
        evidence: "Olga Petrov is responsible for UAT.",
        domain: "responsibility",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { personName: "Olga Petrov" },
      },
      {
        id: "obs-sarah",
        statement: "Sarah Kim is responsible for Release.",
        evidence: "Sarah Kim is responsible for Release.",
        domain: "responsibility",
        disposition: "create_new",
        truthIntent: "current",
        proposedValues: { personName: "Sarah Kim" },
      },
    ],
  };

  check("22:07 Needs You: model omitted scope, then main-era mapper discarded the statement and re-asked", () => {
    const parsed = parseNewProjectV2Envelope(scopeOmittedEnvelope);
    assert.equal(parsed.envelopeMalformed, false);
    for (const item of parsed.items) {
      assert.equal(item.category, "person");
      assert.equal(item.needsReview, true, item.statement);
      assert.match(String(item.reviewReason), /person and a responsibility/i);
    }

    const mainEra = draftFromProvisionalMainEra({
      sourceNarrative: NP_NARRATIVE,
      items: parsed.items,
    });
    const mainMerged = mergeOrganisedDraft(emptyCompose(), mainEra);
    const mainQuestions = needsYouFromDraft(mainMerged);
    assert.equal(mainQuestions.length, 2);
    assert.ok(mainQuestions.some((q) => /Olga Petrov/i.test(q.question)));
    assert.ok(mainQuestions.some((q) => /Sarah Kim/i.test(q.question)));
    for (const person of mainMerged.stakeholders ?? []) {
      assert.equal((person.responsibilities ?? []).length, 0);
      assert.equal(person.role, undefined);
    }

    const current = draftFromProvisional({
      sourceNarrative: NP_NARRATIVE,
      sourceMode: "paste",
      project: parsed.project,
      items: parsed.items,
    });
    const currentMerged = mergeOrganisedDraft(emptyCompose(), current);
    const currentQuestions = needsYouFromDraft(currentMerged);
    assert.equal(currentQuestions.length, 0);
    const olga = currentMerged.stakeholders?.find((s) => s.name === "Olga Petrov");
    const sarah = currentMerged.stakeholders?.find((s) => s.name === "Sarah Kim");
    assert.deepEqual(olga?.responsibilities, ["UAT"]);
    assert.deepEqual(sarah?.responsibilities, ["Release"]);
    assert.equal(composePersonLine(olga!), "Olga Petrov — UAT");
    assert.equal(composePersonLine(sarah!), "Sarah Kim — Release");
  });

  check("well-formed NP responsibilities still keep UAT/Release on the current mapper", () => {
    const parsed = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-olga",
          statement: "Olga Petrov is responsible for UAT.",
          evidence: "Olga Petrov is responsible for UAT.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: {
            personName: "Olga Petrov",
            scope: "UAT",
            ownershipSemantics: "share",
          },
        },
        {
          id: "obs-sarah",
          statement: "Sarah Kim is responsible for Release.",
          evidence: "Sarah Kim is responsible for Release.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: {
            personName: "Sarah Kim",
            scope: "Release",
            ownershipSemantics: "share",
          },
        },
      ],
    });
    const draft = draftFromProvisional({
      sourceNarrative: NP_NARRATIVE,
      sourceMode: "paste",
      project: parsed.project,
      items: parsed.items,
    });
    const merged = mergeOrganisedDraft(emptyCompose(), draft);
    assert.equal(needsYouFromDraft(merged).length, 0);
    assert.equal(
      composePersonLine(merged.stakeholders!.find((s) => s.name === "Olga Petrov")!),
      "Olga Petrov — UAT",
    );
  });

  const dateMoveUpdate = {
    observations: [
      {
        id: "obs-date",
        statement: "Production release has moved from 12 September to 19 September.",
        evidence: "Production release has moved from 12 September to 19 September.",
        domain: "milestone",
        disposition: "update_existing",
        truthIntent: "current",
        projectId: PROJECT,
        candidateTargetId: MS_RELEASE,
        candidateTargetTitle: "Production release",
        proposedValues: { label: "Production release", date: "2026-09-19" },
      },
    ],
  };

  check("date move: well-formed update becomes Apply write — EXPECTED PRODUCT BEHAVIOUR", () => {
    const [row] = summariseResolved(CAPTURE_TRANSCRIPT, dateMoveUpdate);
    assert.equal(row!.decision, "write");
    assert.equal(row!.writeType, "update_milestone");
    console.log("    CLASS: EXPECTED PRODUCT BEHAVIOUR");
  });

  check("date move: create_new instead of update creates a second date — MODEL FAILURE + LUME TRANSFORMATION/RESOLUTION FAILURE", () => {
    const [row] = summariseResolved(CAPTURE_TRANSCRIPT, {
      observations: [
        {
          id: "obs-date-create",
          statement: "Production release has moved from 12 September to 19 September.",
          evidence: "Production release has moved from 12 September to 19 September.",
          domain: "milestone",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { label: "Production release", date: "2026-09-19" },
        },
      ],
    });
    assert.equal(row!.decision, "write");
    assert.equal(row!.writeType, "create_milestone");
    console.log("    CLASS: MODEL FAILURE (should have been update_existing)");
    console.log("    CLASS: LUME TRANSFORMATION/RESOLUTION FAILURE (no label match; second date)");
  });

  check("CAB cancelled: milestone complete is Needs You — EXPECTED PRODUCT BEHAVIOUR / LUME CATCH", () => {
    const [row] = summariseResolved(CAPTURE_TRANSCRIPT, {
      observations: [
        {
          id: "obs-cab",
          statement: "The CAB preparation session is cancelled and is no longer required.",
          evidence: "The CAB preparation session is cancelled and is no longer required.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: PROJECT,
          candidateTargetId: MS_CAB,
          candidateTargetTitle: "CAB preparation session",
          proposedValues: { status: "complete" },
        },
      ],
    });
    assert.equal(row!.decision, "needs_you");
    assert.match(
      String(row!.reason),
      /not specific enough|Completing a date is not supported|not supported/i,
    );
    console.log("    CLASS: EXPECTED PRODUCT BEHAVIOUR (no milestone cancel/remove write)");
    console.log("    CLASS: LUME CATCH (cancel is not executed as a date delete)");
  });

  check("CAB cancelled as knowledge leaves the date standing — MODEL FAILURE if that was the only observation", () => {
    const [row] = summariseResolved(CAPTURE_TRANSCRIPT, {
      observations: [
        {
          id: "obs-cab-know",
          statement: "The CAB preparation session is cancelled and is no longer required.",
          evidence: "The CAB preparation session is cancelled and is no longer required.",
          domain: "knowledge",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: {
            text: "The CAB preparation session is cancelled and is no longer required.",
          },
        },
      ],
    });
    assert.equal(row!.decision, "write");
    assert.equal(row!.writeType, "write_knowledge");
    console.log("    CLASS: MODEL FAILURE (cancelled date became a note)");
    console.log("    CLASS: LUME TRANSFORMATION/RESOLUTION FAILURE (date row is not removed)");
  });

  check("Andris / Legacy isolated: first name + missing person is Needs You — LUME CATCH", () => {
    const [row] = summariseResolved("Andris will take ownership of Legacy.", {
      observations: [
        {
          id: "obs-andris",
          statement: "Andris will take ownership of Legacy.",
          evidence: "Andris will take ownership of Legacy.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: {
            personName: "Andris",
            scope: "Legacy",
            ownershipSemantics: "replace",
          },
        },
      ],
    });
    assert.equal(row!.decision, "needs_you");
    assert.match(String(row!.reason), /Person identity is not established|cannot tell which person|needs a name/i);
    console.log("    CLASS: LUME CATCH (Andris is not a recorded full name on the project)");
  });

  check("Andris in the full paste stays incomplete-name Needs You — sibling Olga+Sarah names must not poison", () => {
    const [row] = summariseResolved(CAPTURE_TRANSCRIPT, {
      observations: [
        {
          id: "obs-andris",
          statement: "Andris will take ownership of Legacy.",
          evidence: "Andris will take ownership of Legacy.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: {
            personName: "Andris",
            scope: "Legacy",
            ownershipSemantics: "replace",
          },
        },
      ],
    });
    assert.equal(row!.decision, "needs_you");
    assert.match(
      String(row!.reason),
      /Person identity is not established|cannot tell which person|needs a name|not a recorded/i,
    );
    assert.doesNotMatch(String(row!.reason), /More than one existing person matches/i);
    console.log("    CLASS: LUME CATCH (Andris remains an incomplete recorded name; sibling names stay local)");
  });

  check("UAT pronoun: two named people without a bind stays Needs You — LUME CATCH / EXPECTED PRODUCT BEHAVIOUR", () => {
    const [row] = summariseResolved(CAPTURE_TRANSCRIPT, {
      observations: [
        {
          id: "obs-she",
          statement: "She will own UAT going forward.",
          evidence: "Olga Petrov and Sarah Kim discussed the UAT handover. She will own UAT going forward.",
          domain: "responsibility",
          disposition: "ambiguous",
          truthIntent: "current",
          proposedValues: {
            personName: "She",
            scope: "UAT",
            ownershipSemantics: "replace",
          },
        },
      ],
    });
    assert.equal(row!.decision, "needs_you");
    console.log("    CLASS: LUME CATCH / EXPECTED PRODUCT BEHAVIOUR (pronoun + two named people)");
  });

  check("UAT pronoun: model-supplied Olga UUID is caught at plan time — LUME CATCH", () => {
    const [row] = summariseResolved(CAPTURE_TRANSCRIPT, {
      observations: [
        {
          id: "obs-she-olga",
          statement: "She will own UAT going forward.",
          evidence: "Olga Petrov and Sarah Kim discussed the UAT handover. She will own UAT going forward.",
          domain: "responsibility",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: PROJECT,
          candidateTargetId: OLGA,
          candidateTargetTitle: "Olga Petrov",
          proposedValues: {
            personName: "Olga Petrov",
            scope: "UAT",
            ownershipSemantics: "share",
          },
        },
      ],
    });
    assert.equal(row!.decision, "needs_you");
    assert.match(String(row!.reason), /not on this project/i);
    console.log("    CLASS: MODEL FAILURE (guessed Olga for 'she')");
    console.log("    CLASS: LUME CATCH (planner requires the reviewed statement to contain Olga Petrov, so the UUID does not write)");
  });

  check("runbook v3: knowledge create is Apply Ready and does not retire v2 — EXPECTED PRODUCT BEHAVIOUR", () => {
    const [row] = summariseResolved(CAPTURE_TRANSCRIPT, {
      observations: [
        {
          id: "obs-runbook",
          statement: "Cutover runbook v3 is now the working runbook.",
          evidence: "Cutover runbook v3 is now the working runbook.",
          domain: "knowledge",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { text: "Cutover runbook v3 is now the working runbook." },
        },
      ],
    });
    assert.equal(row!.decision, "write");
    assert.equal(row!.writeType, "write_knowledge");
    console.log("    CLASS: EXPECTED PRODUCT BEHAVIOUR (new fact; no structured runbook version field)");
  });

  check("combined well-formed envelope: date moves, pronoun stays Needs You, Andris stays Needs You, CAB complete is caught, runbook writes", () => {
    const rows = summariseResolved(CAPTURE_TRANSCRIPT, {
      observations: [
        dateMoveUpdate.observations[0],
        {
          id: "obs-cab",
          statement: "The CAB preparation session is cancelled and is no longer required.",
          evidence: "The CAB preparation session is cancelled and is no longer required.",
          domain: "milestone",
          disposition: "update_existing",
          truthIntent: "current",
          projectId: PROJECT,
          candidateTargetId: MS_CAB,
          candidateTargetTitle: "CAB preparation session",
          proposedValues: { status: "complete" },
        },
        {
          id: "obs-andris",
          statement: "Andris will take ownership of Legacy.",
          evidence: "Andris will take ownership of Legacy.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { personName: "Andris", scope: "Legacy" },
        },
        {
          id: "obs-she",
          statement: "She will own UAT going forward.",
          evidence: "Olga Petrov and Sarah Kim discussed the UAT handover. She will own UAT going forward.",
          domain: "responsibility",
          disposition: "ambiguous",
          truthIntent: "current",
          proposedValues: { scope: "UAT", ownershipSemantics: "ambiguous" },
        },
        {
          id: "obs-runbook",
          statement: "Cutover runbook v3 is now the working runbook.",
          evidence: "Cutover runbook v3 is now the working runbook.",
          domain: "knowledge",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { text: "Cutover runbook v3 is now the working runbook." },
        },
      ],
    });
    assert.equal(rows.find((r) => r.writeType === "update_milestone")?.decision, "write");
    assert.equal(rows.find((r) => /CAB preparation/i.test(r.statement))?.decision, "needs_you");
    assert.equal(rows.find((r) => /Andris/i.test(r.statement))?.decision, "needs_you");
    assert.equal(rows.find((r) => /UAT going forward/i.test(r.statement))?.decision, "needs_you");
    assert.equal(rows.find((r) => /runbook v3/i.test(r.statement))?.writeType, "write_knowledge");
  });

  console.log(`verify-capture-intelligence-diagnostic: ${passed} checks OK`);
}

main();
