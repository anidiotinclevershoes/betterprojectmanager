import { NextResponse } from "next/server";
import {
  buildCaptureContext,
  buildCaptureContextManifest,
  logCaptureContextDiagnostic,
} from "@/lib/capture/context";
import {
  buildCapturePromptAssembly,
  buildCaptureResultFromAi,
  getOpenAIKeyDiagnostics,
  isOpenAIConfigured,
  localCaptureFallback,
  tidyAndCoachWithOpenAI,
} from "@/lib/openai";
import { resolveOpenAIChatModel } from "@/lib/openai-model";
import { logPromptAssemblyDiagnostic } from "@/ai/domain";
import { recordCaptureMetricsSafe } from "@/lib/dev/cockpit";
import {
  assessCaptureReliability,
  reliabilityForCockpit,
} from "@/lib/capture/reliability/assess";
import { COACHING_SYSTEM_PROMPT } from "@/lib/mission";
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
  isCaptureV2Enabled,
  runCaptureV2FromModelJson,
} from "@/lib/capture-v2";
import {
  CaptureServerTruthError,
  clientPostedTruthFields,
  loadServerCaptureWorld,
} from "@/lib/capture-v2/server-truth";
import { extractObservationsWithOpenAI } from "@/lib/capture-v2/extract";
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
  return NextResponse.json({
    openaiConfigured: diagnostics.openaiConfigured,
    model: resolveOpenAIChatModel(),
    keyPrefix: diagnostics.prefix,
    keyLength: diagnostics.length,
    reason: diagnostics.reason,
    captureV2Enabled: isCaptureV2Enabled(),
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
        userId: gate.userId,
      });
      return NextResponse.json(
        { error: "AI is not configured for this environment." },
        { status: 503 },
      );
    }

    const analysisRequestId = requestId();

    if (isCaptureV2Enabled()) {
      return await postCaptureV2({
        gateUserId: gate.userId,
        body,
        content,
        startedAt,
        analysisRequestId,
      });
    }

    return await postCaptureLegacy({
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
    serverLog.info("capture.v2_local_fallback", {
      userId: args.gateUserId,
      projectId: loaded.projectId,
      ignoredClientTruth,
    });
    return NextResponse.json({
      result,
      openaiConfigured: false,
      requestId: analysisRequestId,
      contextManifest,
      captureContextDiagnostics: captureContext.diagnostics,
      reliability,
      capturePipeline: "v2",
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
    model: extraction.model,
    systemPrompt: "capture-v2-observations",
    reliability: reliabilityForCockpit(reliability),
  });
  serverLog.info("capture.v2_analysed", {
    userId: args.gateUserId,
    projectId: loaded.projectId,
    ignoredClientTruth,
  });
  return NextResponse.json({
    result: v2.result,
    openaiConfigured: true,
    requestId: analysisRequestId,
    contextManifest: enrichedManifest,
    captureContextDiagnostics: captureContext.diagnostics,
    reliability,
    capturePipeline: "v2",
  });
}

async function postCaptureLegacy(args: {
  gateUserId: string;
  body: Body;
  content: string;
  startedAt: number;
  analysisRequestId: string;
}) {
  const { body, content, startedAt, analysisRequestId } = args;
  const projects = body.state?.projects ?? [];
  const knowledge = body.state?.knowledge ?? [];
  const timeline = body.state?.timeline ?? [];
  const todos = (body.state?.todos ?? []) as TodoItem[];
  const recommendations = (body.state?.recommendations ??
    []) as Recommendation[];
  const history = (body.state?.history ?? []) as HistoryEvent[];
  const meetings = body.state?.meetings ?? [];
  const releases = body.state?.releases ?? [];
  const risks = body.state?.risks ?? [];

  const input: CaptureInput = {
    content,
    projectId: body.projectId,
    sourceType: body.sourceType,
  };

  const captureContext = buildCaptureContext({
    projectId: body.projectId,
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
    const fallbackState = {
      projects,
      memories: body.state?.memories ?? [],
      recommendations,
      meetings,
      releases,
      todos,
      knowledge,
      timeline,
    };
    const result = localCaptureFallback(input, fallbackState, captureContext);
    let enrichedManifest = contextManifest;
    let promptAssemblyForMetrics = null as ReturnType<
      typeof buildCapturePromptAssembly
    > | null;
    try {
      const promptAssembly = buildCapturePromptAssembly({
        rawText: content,
        projectId: body.projectId,
        sourceType: body.sourceType,
        projects,
        existingKnowledge:
          knowledge.find((k) => k.projectId === body.projectId) ?? null,
        existingTimeline: timeline.filter(
          (t) => t.projectId === body.projectId,
        ),
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
      promptAssemblyForMetrics = promptAssembly;
      logPromptAssemblyDiagnostic(promptAssembly);
      enrichedManifest = {
        ...contextManifest,
        promptAssembly: {
          sections: promptAssembly.sections.map((s) => ({
            id: s.id,
            label: s.label,
            present: true,
          })),
          approximateCharacters:
            promptAssembly.diagnostics.approximateCharacters,
          estimatedTokens: promptAssembly.diagnostics.estimatedTokens,
          contextRecordCount: promptAssembly.diagnostics.contextRecordCount,
          dictionaryEntryCount:
            promptAssembly.diagnostics.dictionaryEntryCount,
        },
      };
    } catch {
      /* prompt assembly must not break local fallback */
    }
    const reliability = assessCaptureReliability({
      captureText: content,
      result,
      contextManifest: enrichedManifest,
    });
    if (promptAssemblyForMetrics) {
      recordCaptureMetricsSafe({
        startedAt,
        requestId: analysisRequestId,
        source: "capture",
        promptAssembly: promptAssemblyForMetrics,
        captureContext,
        result,
        providerUsage: null,
        responseText: JSON.stringify({
          findings: result.findings ?? [],
          operations: result.proposedOperations ?? [],
        }),
        model: null,
        systemPrompt: COACHING_SYSTEM_PROMPT,
        reliability: reliabilityForCockpit(reliability),
      });
    }
    return NextResponse.json({
      result,
      openaiConfigured: false,
      requestId: analysisRequestId,
      contextManifest: enrichedManifest,
      captureContextDiagnostics: captureContext.diagnostics,
      reliability,
      notice:
        "OPENAI_API_KEY not set — used local coaching. Add your OpenAI key to enable tidy-up.",
    });
  }

  const existingKnowledge: ProjectKnowledge | null =
    knowledge.find((k) => k.projectId === body.projectId) ?? null;

  const { ai, promptAssembly, providerUsage, responseText, model } =
    await tidyAndCoachWithOpenAI({
      rawText: content,
      projectId: body.projectId,
      sourceType: body.sourceType,
      projects,
      existingKnowledge,
      existingTimeline: timeline.filter((t) => t.projectId === body.projectId),
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

  const result = buildCaptureResultFromAi({
    rawText: content,
    projectId: body.projectId,
    sourceType: body.sourceType,
    ai,
    captureContext,
    allOpenTodos: todos
      .filter((t) => !t.done)
      .map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
      })),
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
    result,
    contextManifest: enrichedManifest,
  });

  recordCaptureMetricsSafe({
    startedAt,
    requestId: analysisRequestId,
    source: "capture",
    promptAssembly,
    captureContext,
    result,
    providerUsage,
    responseText,
    model,
    systemPrompt: COACHING_SYSTEM_PROMPT,
    reliability: reliabilityForCockpit(reliability),
  });

  return NextResponse.json({
    result,
    openaiConfigured: true,
    requestId: analysisRequestId,
    contextManifest: enrichedManifest,
    captureContextDiagnostics: captureContext.diagnostics,
    reliability,
  });
}
