import { NextResponse } from "next/server";
import { requireAiCaller } from "@/lib/ai-gate";
import { answerTellMeQuestion } from "@/lib/tell-me/answer";
import { loadSnapshotFromSupabase } from "@/lib/tell-me/snapshot-store";
import { isOpenAIConfigured } from "@/lib/openai";
import { isProductionRuntime } from "@/lib/runtime-config";
import { serverLog } from "@/lib/server-log";
import { recordTellMeMetricsSafe } from "@/lib/dev/cockpit/tell-me-record";
import type { MissionState } from "@/lib/types";
import type {
  ProjectIntelligenceSnapshot,
  TellMeConversationTurn,
} from "@/lib/tell-me/types";

export const runtime = "nodejs";

type Body = {
  question?: string;
  projectId?: string | null;
  conversation?: TellMeConversationTurn[];
  snapshot?: ProjectIntelligenceSnapshot | null;
  state?: MissionState;
  userDisplayName?: string | null;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const gate = await requireAiCaller("tell-me");
    if (!gate.ok) return gate.response;

    if (isProductionRuntime() && !isOpenAIConfigured()) {
      return NextResponse.json(
        { error: "AI is not configured for this environment." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as Body;
    const question = body.question?.trim();
    if (!question) {
      return NextResponse.json(
        { error: "Ask a question about your project." },
        { status: 400 },
      );
    }
    if (!body.state) {
      return NextResponse.json(
        { error: "Project state is required." },
        { status: 400 },
      );
    }

    let snapshot = body.snapshot ?? null;
    if (!snapshot && body.projectId) {
      snapshot = await loadSnapshotFromSupabase(body.projectId);
    }

    const result = await answerTellMeQuestion({
      question,
      state: body.state,
      selectedProjectId: body.projectId ?? null,
      snapshot,
      conversation: body.conversation ?? [],
      userDisplayName: body.userDisplayName ?? null,
    });

    recordTellMeMetricsSafe({
      startedAt,
      userId: gate.userId,
      question,
      result,
    });

    serverLog.info("tell_me.answered", {
      userId: gate.userId,
      provider: result.provider,
      confidence: result.confidence,
      records: result.contextStats.recordsSelected,
    });

    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tell Me request failed";
    serverLog.error("tell_me.failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
