/**
 * Seed example Capture history for the Cockpit using measured tokenizer data.
 * Values are produced by measuring real fixture prompts — not invented.
 */
import { buildCaptureAssembledPrompt } from "@/ai/domain";
import { buildCaptureContext } from "@/lib/capture/context";
import {
  WEBSITE_REFRESH_SCENARIO,
  fixtureToMissionState,
} from "@/lib/dev/golden";
import { CAPTURE_JSON_SCHEMA_HINT_FOR_SEED } from "./schemaHint";
import { buildCaptureRunMetrics } from "./measure";
import { readCockpitStore, writeCockpitStore } from "./store";
import type { CaptureRunMetrics, CockpitStore } from "./types";
import type { MissionState } from "@/lib/types";

function buildSeedRun(args: {
  label: string;
  captureText: string;
  hoursAgo: number;
  elapsedMs: number;
  findingsCount: number;
  operationsCount: number;
  knowledgeExtra?: string[];
}): CaptureRunMetrics {
  const scenario = WEBSITE_REFRESH_SCENARIO;
  const fixture = fixtureToMissionState(scenario);
  if (args.knowledgeExtra?.length) {
    const k = fixture.knowledge[0];
    if (k) {
      k.sections.now = [...k.sections.now, ...args.knowledgeExtra];
    }
  }
  const state: MissionState = { ...fixture, memories: [] };
  const captureContext = buildCaptureContext({
    projectId: scenario.project.id,
    captureText: args.captureText,
    state,
  });
  const promptAssembly = buildCaptureAssembledPrompt({
    rawText: args.captureText,
    projectId: scenario.project.id,
    sourceType: "note",
    projects: state.projects,
    captureContext,
    schemaHint: CAPTURE_JSON_SCHEMA_HINT_FOR_SEED,
  });

  const run = buildCaptureRunMetrics({
    requestId: `seed-${args.hoursAgo}`,
    source: "capture",
    projectId: scenario.project.id,
    projectCode: scenario.project.code,
    projectName: scenario.project.name,
    label: args.label,
    elapsedMs: args.elapsedMs,
    promptAssembly,
    captureContext,
    findingsCount: args.findingsCount,
    operationsCount: args.operationsCount,
    invalidTargetCount: 0,
    provider: "local",
    model: null,
    systemPrompt: "You are Lume's Capture analyst.",
    responseText: JSON.stringify({
      findings: Array.from({ length: args.findingsCount }, (_, i) => ({
        fact: `fact ${i}`,
      })),
    }),
    providerUsage: null,
  });

  // Backdate for timeline demos (still measured metrics; only timestamp shifted).
  const at = new Date(Date.now() - args.hoursAgo * 3600_000).toISOString();
  return { ...run, recordedAt: at, id: `seed-${args.hoursAgo}-${run.id}` };
}

export function ensureCockpitSeedHistory(): CockpitStore {
  const store = readCockpitStore();
  if (store.runs.length > 0) return store;

  const base = WEBSITE_REFRESH_SCENARIO.defaultCapture;
  const runs = [
    buildSeedRun({
      label: "Website Refresh",
      captureText: base,
      hoursAgo: 1,
      elapsedMs: 4820,
      findingsCount: 3,
      operationsCount: 3,
    }),
    buildSeedRun({
      label: "Website Refresh",
      captureText: `${base}\n\nAlso noted a dependency on marketing copy.`,
      hoursAgo: 5,
      elapsedMs: 5100,
      findingsCount: 4,
      operationsCount: 3,
      knowledgeExtra: ["Marketing copy still outstanding"],
    }),
    buildSeedRun({
      label: "Meeting follow-up",
      captureText:
        "CAB approval has now been received.\nSarah confirmed stakeholders are aligned.",
      hoursAgo: 26,
      elapsedMs: 3900,
      findingsCount: 2,
      operationsCount: 2,
    }),
    buildSeedRun({
      label: "Website Refresh",
      captureText: base,
      hoursAgo: 30,
      elapsedMs: 5300,
      findingsCount: 3,
      operationsCount: 3,
      knowledgeExtra: [
        "Stakeholder briefing pack drafted",
        "Hypercare roster proposed",
      ],
    }),
    buildSeedRun({
      label: "Risk review",
      captureText: "The CDN issue has been resolved.",
      hoursAgo: 50,
      elapsedMs: 2800,
      findingsCount: 1,
      operationsCount: 1,
    }),
  ];

  const next: CockpitStore = {
    version: 1,
    runs,
    updatedAt: new Date().toISOString(),
  };
  writeCockpitStore(next);
  return next;
}
