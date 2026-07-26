import { NextResponse } from "next/server";
import { isOpenAIConfigured } from "@/lib/openai";
import { requestPmCoaching, type CoachScope } from "@/lib/pm-coach";
import type { MissionState } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  scope: CoachScope;
  state: MissionState;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body?.state || !body?.scope) {
      return NextResponse.json(
        { error: "Missing scope or state." },
        { status: 400 },
      );
    }

    const result = await requestPmCoaching(body.state, body.scope);
    return NextResponse.json({
      ...result,
      openaiConfigured: isOpenAIConfigured(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Coach request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
