import { NextResponse } from "next/server";
import {
  buildCaptureResultFromAi,
  isOpenAIConfigured,
  localCaptureFallback,
  tidyAndCoachWithOpenAI,
} from "@/lib/openai";
import type { CaptureInput, MissionState } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  content: string;
  projectId?: string;
  sourceType?: CaptureInput["sourceType"];
  state?: Pick<MissionState, "projects" | "memories" | "recommendations" | "meetings" | "releases">;
};

export async function GET() {
  return NextResponse.json({
    openaiConfigured: isOpenAIConfigured(),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
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
      };
      const result = localCaptureFallback(input, fallbackState);
      return NextResponse.json({
        result,
        openaiConfigured: false,
        notice:
          "OPENAI_API_KEY not set — used local coaching. Add your OpenAI API key to enable tidy-up.",
      });
    }

    const ai = await tidyAndCoachWithOpenAI({
      rawText: content,
      projectId: body.projectId,
      sourceType: body.sourceType,
      projects,
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
