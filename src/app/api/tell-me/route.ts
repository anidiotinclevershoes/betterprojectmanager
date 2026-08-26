import { NextResponse } from "next/server";
import { requireAiCaller } from "@/lib/ai-gate";
import { answerTellMeQuestion } from "@/lib/tell-me/answer";
import {
  TellMeServerTruthError,
  clientPostedTruthFields,
  loadServerCurrentTruthForTellMe,
} from "@/lib/tell-me/server-truth";
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
  userDisplayName?: string | null;
  /**
   * Leftover client fields. Accepted so old callers do not 400 on unknown
   * shape, but NEVER used as current truth (Slice 1B).
   */
  snapshot?: ProjectIntelligenceSnapshot | null;
  state?: MissionState;
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
    const projectId = body.projectId?.trim();
    if (!projectId) {
      return NextResponse.json(
        { error: "Select a project first." },
        { status: 400 },
      );
    }

    const ignoredClientTruth = clientPostedTruthFields(body);

    const loaded = await loadServerCurrentTruthForTellMe({
      projectId,
      question,
    });

    const result = await answerTellMeQuestion({
      question,
      state: loaded.state,
      selectedProjectId: loaded.projectId,
      snapshot: null,
      conversation: body.conversation ?? [],
      userDisplayName: body.userDisplayName ?? null,
      useCanonicalTruth: true,
    });

    recordTellMeMetricsSafe({
      startedAt,
      userId: gate.userId,
      question,
      result,
    });

    serverLog.info("tell_me.answered", {
      userId: gate.userId,
      projectId: loaded.projectId,
      provider: result.provider,
      confidence: result.confidence,
      records: result.contextStats.recordsSelected,
      canonicalTruthChars: loaded.canonical.approxChars,
      usedCanonicalTruth: result.usedCanonicalTruth,
      ignoredClientTruth,
    });

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof TellMeServerTruthError) {
      serverLog.error("tell_me.failed", {
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
      error instanceof Error ? error.message : "Tell Me request failed";
    serverLog.error("tell_me.failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
