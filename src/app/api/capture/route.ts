import { NextResponse } from "next/server";
import {
  buildCaptureContext,
  buildCaptureContextManifest,
  logCaptureContextDiagnostic,
} from "@/lib/capture/context";
import {
  buildCapturePromptAssembly,
  getOpenAIKeyDiagnostics,
  isOpenAIConfigured,
  localCaptureFallback,
} from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import { recordCaptureMetricsSafe } from "@/lib/dev/cockpit";
import {
  assessCaptureReliability,
  reliabilityForCockpit,
} from "@/lib/capture/reliability/assess";
import type {
  CaptureInput,
  HistoryEvent,
  MissionState,
  ProjectKnowledge,
  Recommendation,
  TodoItem,
} from "@/lib/types";
import { requireAiCaller } from "@/lib/ai-gate";
import { isProductionRuntime } from "@/lib/runtime-config";
import { serverLog } from "@/lib/server-log";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
  runCaptureV2FromModelJson,
} from "@/lib/capture-v2";
import {
  CaptureServerTruthError,
  clientPostedTruthFields,
  loadServerCaptureWorld,
} from "@/lib/capture-v2/server-truth";
import { extractObservationsWithOpenAI } from "@/lib/capture-v2/extract";
import {
  extractProvenanceBase,
  logIntelligenceProvenance,
} from "@/lib/capture-v2/provenance";
import {
  CAPTURE_V2_EXTRACT_PATH,
  CAPTURE_V2_PROMPT_ID,
  CAPTURE_V2_PROMPT_VERSION,
} from "@/lib/capture-v2/prompt";
import { DurableWorkspaceError } from "@/lib/data/durable-workspace";

export const runtime = "nodejs";

type Body = {
  content: string;
  projectId?: string;
  sourceType?: CaptureInput["sourceType"];
  /**
   * Leftover client field. Accepted so old callers do not 400.
   * V2 never uses this as current truth (Slice 1C).
   */
  state?: Pick<
    MissionState,
    | "projects"
    | "memories"
    | "recommendations"
    | "meetings"
    | "releases"
    | "knowledge"
    | "timeline"
    | "todos"
    | "history"
    | "risks"
  >;
};

function requestId() {
  return `capreq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const diagnostics = getOpenAIKeyDiagnostics();
  const productionRuntime = isProductionRuntime();
  return NextResponse.json({
    openaiConfigured: diagnostics.openaiConfigured,
    model: resolveOpenAIChatModel(),
    keyPrefix: diagnostics.prefix,
    keyLength: diagnostics.length,
    reason: diagnostics.reason,
    captureV2Enabled: true,
    promptId: CAPTURE_V2_PROMPT_ID,
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    extractPath: CAPTURE_V2_EXTRACT_PATH,
    productionRuntime,
    localFallbackReachable: !productionRuntime,
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const gate = await requireAiCaller("capture");
    if (!gate.ok) return gate.response;

    const body = (await request.json()) as Body;
    const content = body.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Capture content is required." },
        { status: 400 },
      );
    }

    if (isProductionRuntime() && !isOpenAIConfigured()) {
      serverLog.error("capture.openai_missing_in_production", {
        ...extractProvenanceBase(),
        userId: gate.userId,
        provider: "none",
        requestedModel: resolveOpenAIChatModel(),
        responseModel: null,
        fallback: false,
        fallbackReason: "production_refuses_unconfigured_ai",
        elapsedMs: Date.now() - startedAt,
        observationCount: 0,
      });
      return NextResponse.json(
        { error: "AI is not configured for this environment." },
        { status: 503 },
      );
    }

    const analysisRequestId = requestId();

    return await postCaptureV2({
      gateUserId: gate.userId,
      body,
      content,
      startedAt,
      analysisRequestId,
    });
  } catch (error) {
    if (
      error instanceof CaptureServerTruthError ||
      error instanceof DurableWorkspaceError
    ) {
      serverLog.error("capture.failed", {
        error: error.message,
        code: error.code,
        status: error.status,
      });
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Capture coaching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function postCaptureV2(args: {
  gateUserId: string;
  body: Body;
  content: string;
  startedAt: number;
  analysisRequestId: string;
}) {
  const { body, content, startedAt, analysisRequestId } = args;
  const projectId = body.projectId?.trim();
  if (!projectId) {
    return NextResponse.json(
      { error: "Select a project first.", code: "project_required" },
      { status: 400 },
    );
  }

  const ignoredClientTruth = clientPostedTruthFields(body);

  const loaded = await loadServerCaptureWorld({ projectId });
  const projects = loaded.state.projects;
  const knowledge = loaded.state.knowledge ?? [];
  const timeline = loaded.state.timeline ?? [];
  const todos = (loaded.state.todos ?? []) as TodoItem[];
  const recommendations = (loaded.state.recommendations ??
    []) as Recommendation[];
  const history = (loaded.state.history ?? []) as HistoryEvent[];
  const meetings = loaded.state.meetings ?? [];
  const releases = loaded.state.releases ?? [];
  const risks = loaded.state.risks ?? [];

  const input: CaptureInput = {
    content,
    projectId: loaded.projectId,
    sourceType: body.sourceType,
  };

  const captureContext = buildCaptureContext({
    projectId: loaded.projectId,
    captureText: content,
    state: {
      projects,
      todos,
      meetings,
      releases,
      knowledge,
      timeline,
      recommendations,
      history,
      risks,
    },
  });
  const contextManifest = buildCaptureContextManifest(
    captureContext,
    analysisRequestId,
  );
  logCaptureContextDiagnostic(contextManifest);

  if (!isOpenAIConfigured()) {
    const result = localCaptureFallback(
      input,
      {
        projects,
        memories: loaded.state.memories ?? [],
        recommendations,
        meetings,
        releases,
        todos,
        knowledge,
        timeline,
      },
      captureContext,
    );
    const reliability = assessCaptureReliability({
      captureText: content,
      result,
      contextManifest,
    });
    logIntelligenceProvenance("capture.v2_local_fallback", {
      ...extractProvenanceBase(),
      userId: args.gateUserId,
      projectId: loaded.projectId,
      ignoredClientTruth,
      provider: "local",
      requestedModel: null,
      responseModel: null,
      fallback: true,
      fallbackReason: "openai_unconfigured_non_production",
      elapsedMs: Date.now() - startedAt,
      observationCount: 0,
      usagePrompt: null,
      usageCompletion: null,
      usageTotal: null,
    });
    return NextResponse.json({
      result,
      openaiConfigured: false,
      requestId: analysisRequestId,
      contextManifest,
      captureContextDiagnostics: captureContext.diagnostics,
      reliability,
      capturePipeline: "v2",
      provenance: {
        provider: "local" as const,
        requestedModel: null,
        responseModel: null,
        promptId: CAPTURE_V2_PROMPT_ID,
        promptVersion: CAPTURE_V2_PROMPT_VERSION,
        path: CAPTURE_V2_EXTRACT_PATH,
        fallback: true,
        fallbackReason: "openai_unconfigured_non_production",
      },
      notice:
        "OPENAI_API_KEY not set — used local coaching. Add your OpenAI key to enable tidy-up.",
    });
  }

  const project = projects[0];
  const records = contextRecordsFromWorld(loaded.world, loaded.projectId);
  const projectBlock = project
    ? formatAuthoritativeStateForPrompt(records, {
        id: project.id,
        name: project.name,
        code: project.code,
      })
    : "Current project: (unscoped)\nAuthoritative current records:\n(none)";
  const extraction = await extractObservationsWithOpenAI({
    transcript: content,
    projectBlock,
  });
  const v2 = runCaptureV2FromModelJson({
    transcript: content,
    rawModelJson: extraction.rawModelJson,
    world: loaded.world,
    projectId: loaded.projectId,
  });
  const existingKnowledge: ProjectKnowledge | null =
    knowledge.find((k) => k.projectId === loaded.projectId) ?? null;
  const promptAssembly = buildCapturePromptAssembly({
    rawText: content,
    projectId: loaded.projectId,
    sourceType: body.sourceType,
    projects,
    existingKnowledge,
    existingTimeline: timeline.filter((t) => t.projectId === loaded.projectId),
    openTodos: todos
      .filter((t) => !t.done)
      .slice(0, 40)
      .map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        dueAt: t.dueAt,
      })),
    captureContext,
  });
  const enrichedManifest = {
    ...contextManifest,
    promptAssembly: {
      sections: promptAssembly.sections.map((s) => ({
        id: s.id,
        label: s.label,
        present: true,
      })),
      approximateCharacters: promptAssembly.diagnostics.approximateCharacters,
      estimatedTokens: promptAssembly.diagnostics.estimatedTokens,
      contextRecordCount: promptAssembly.diagnostics.contextRecordCount,
      dictionaryEntryCount: promptAssembly.diagnostics.dictionaryEntryCount,
    },
  };
  const reliability = assessCaptureReliability({
    captureText: content,
    result: v2.result,
    contextManifest: enrichedManifest,
  });
  recordCaptureMetricsSafe({
    startedAt,
    requestId: analysisRequestId,
    source: "capture",
    promptAssembly,
    captureContext,
    result: v2.result,
    providerUsage: extraction.providerUsage,
    responseText: extraction.responseText,
    model: extraction.responseModel,
    systemPrompt: extraction.promptId,
    reliability: reliabilityForCockpit(reliability),
  });
  logIntelligenceProvenance("capture.v2_analysed", {
    ...extractProvenanceBase(),
    userId: args.gateUserId,
    projectId: loaded.projectId,
    ignoredClientTruth,
    provider: extraction.provider,
    requestedModel: extraction.requestedModel,
    responseModel: extraction.responseModel,
    fallback: false,
    fallbackReason: null,
    elapsedMs: Date.now() - startedAt,
    observationCount: extraction.observationCount,
    usagePrompt: extraction.providerUsage?.prompt_tokens ?? null,
    usageCompletion: extraction.providerUsage?.completion_tokens ?? null,
    usageTotal: extraction.providerUsage?.total_tokens ?? null,
  });
  return NextResponse.json({
    result: v2.result,
    openaiConfigured: true,
    requestId: analysisRequestId,
    contextManifest: enrichedManifest,
    captureContextDiagnostics: captureContext.diagnostics,
    reliability,
    capturePipeline: "v2",
    provenance: {
      provider: extraction.provider,
      requestedModel: extraction.requestedModel,
      responseModel: extraction.responseModel,
      promptId: extraction.promptId,
      promptVersion: extraction.promptVersion,
      path: extraction.path,
      fallback: false,
    },
  });
}
