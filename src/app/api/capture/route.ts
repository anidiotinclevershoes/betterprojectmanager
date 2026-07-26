import { NextResponse } from "next/server";
import {
  buildCaptureResultFromAi,
  getOpenAIKeyDiagnostics,
  isOpenAIConfigured,
  localCaptureFallback,
  tidyAndCoachWithOpenAI,
} from "@/lib/openai";
import type { CaptureInput, MissionState, ProjectKnowledge } from "@/lib/types";

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
    const input: CaptureInput = {
      content,
      projectId: body.projectId,
      sourceType: body.sourceType,
    };

    if (!isOpenAIConfigured()) {
      const fallbackState = {
        projects,
        memories: body.state?.memories ?? [],
        recommendations: body.state?.recommendations ?? [],
        meetings: body.state?.meetings ?? [],
        releases: body.state?.releases ?? [],
        todos: [],
        knowledge,
        timeline,
      };
      const result = localCaptureFallback(input, fallbackState);
      return NextResponse.json({
        result,
        openaiConfigured: false,
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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Capture coaching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
