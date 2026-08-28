import { NextResponse } from "next/server";
import { requireAiCaller } from "@/lib/ai-gate";
import { isOpenAIConfigured } from "@/lib/openai";
import { isProductionRuntime } from "@/lib/runtime-config";
import { publicAiFailureMessage } from "@/lib/ai-public-error";
import { serverLog } from "@/lib/server-log";
import { getPersistenceMode } from "@/lib/persistence-mode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadMissionStateFromSupabase } from "@/lib/data/supabase/load-mission-state";
import { generateCatchMeUpBriefing } from "@/lib/catch-me-up/briefing";
import { loadAuthoritativeProjectTruth } from "@/lib/catch-me-up/load-truth";
import {
  CatchMeUpRequestError,
  readCatchMeUpRequest,
} from "@/lib/catch-me-up/request";

export const runtime = "nodejs";

/**
 * Catch Me Up — read-only project briefing.
 * Loads authoritative workspace truth on the server.
 * Client-posted MissionState is ignored.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireAiCaller("catch-me-up");
    if (!gate.ok) return gate.response;

    if (isProductionRuntime() && !isOpenAIConfigured()) {
      return NextResponse.json(
        { error: "AI is not configured for this environment.", code: "ai_unconfigured" },
        { status: 503 },
      );
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Project is required.", code: "invalid_request" },
        { status: 400 },
      );
    }

    const { projectId } = readCatchMeUpRequest(body);

    if (getPersistenceMode() !== "supabase") {
      return NextResponse.json(
        {
          error:
            "Catch Me Up reads the live workspace. Connect a workspace to brief this project.",
          code: "workspace_unavailable",
        },
        { status: 503 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const loaded = await loadAuthoritativeProjectTruth({
      projectId,
      loadWorkspace: () => loadMissionStateFromSupabase(supabase),
    });

    const briefing = await generateCatchMeUpBriefing({
      state: loaded.state,
      projectId,
    });

    serverLog.info("catch_me_up.briefed", {
      userId: gate.userId,
      projectId,
      thinProject: briefing.thinProject,
      provider: briefing.provider,
    });

    return NextResponse.json({ briefing });
  } catch (error) {
    if (error instanceof CatchMeUpRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const { publicMessage, detail } = publicAiFailureMessage(
      error,
      "Catch Me Up could not brief this project.",
    );
    serverLog.error("catch_me_up.failed", { error: detail });
    return NextResponse.json({ error: publicMessage, code: "briefing_failed" }, { status: 500 });
  }
}
