import { NextResponse } from "next/server";
import { buildCaptureContext } from "@/lib/capture/context";
import {
  buildCaptureResultFromAi,
  getOpenAIKeyDiagnostics,
  isOpenAIConfigured,
  localCaptureFallback,
  tidyAndCoachWithOpenAI,
} from "@/lib/openai";
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
      },
    });

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
      const result = localCaptureFallback(input, fallbackState);
      return NextResponse.json({
        result,
        openaiConfigured: false,
        captureContextDiagnostics: captureContext.diagnostics,
        notice:
          "OPENAI_API_KEY not set — used local coaching. Add your OpenAI API key to enable tidy-up.",
      });
    }

    const existingKnowledge: ProjectKnowledge | null =
      knowledge.find((k) => k.projectId === body.projectId) ?? null;

    const ai = await tidyAndCoachWithOpenAI({
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
    });

    return NextResponse.json({
      result,
      openaiConfigured: true,
      captureContextDiagnostics: captureContext.diagnostics,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Capture coaching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
