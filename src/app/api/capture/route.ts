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
import { logPromptAssemblyDiagnostic } from "@/ai/domain";
import { recordCaptureMetricsSafe } from "@/lib/dev/cockpit";
import { COACHING_SYSTEM_PROMPT } from "@/lib/mission";
import type {
  CaptureInput,
  HistoryEvent,
  MissionState,
  ProjectKnowledge,
  Recommendation,
  TodoItem,
} from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  content: string;
  projectId?: string;
  sourceType?: CaptureInput["sourceType"];
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
  >;
};

function requestId() {
  return `capreq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const diagnostics = getOpenAIKeyDiagnostics();
  return NextResponse.json({
    openaiConfigured: diagnostics.openaiConfigured,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    keyPrefix: diagnostics.prefix,
    keyLength: diagnostics.length,
    reason: diagnostics.reason,
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = (await request.json()) as Body;
    const content = body.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Capture content is required." },
        { status: 400 },
      );
    }

    const projects = body.state?.projects ?? [];
    const knowledge = body.state?.knowledge ?? [];
    const timeline = body.state?.timeline ?? [];
    const todos = (body.state?.todos ?? []) as TodoItem[];
    const recommendations = (body.state?.recommendations ??
      []) as Recommendation[];
    const history = (body.state?.history ?? []) as HistoryEvent[];
    const meetings = body.state?.meetings ?? [];
    const releases = body.state?.releases ?? [];
    const analysisRequestId = requestId();

    const input: CaptureInput = {
      content,
      projectId: body.projectId,
      sourceType: body.sourceType,
    };

    // Context must be built before the AI request.
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
        });
      }
      return NextResponse.json({
        result,
        openaiConfigured: false,
        requestId: analysisRequestId,
        contextManifest: enrichedManifest,
        captureContextDiagnostics: captureContext.diagnostics,
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

    return NextResponse.json({
      result,
      openaiConfigured: true,
      requestId: analysisRequestId,
      contextManifest: enrichedManifest,
      captureContextDiagnostics: captureContext.diagnostics,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Capture coaching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
