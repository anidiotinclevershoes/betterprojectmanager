import { NextResponse } from "next/server";
import { requireAiCaller } from "@/lib/ai-gate";
import { refreshSnapshotWithAi } from "@/lib/tell-me/snapshot";
import { saveSnapshotToSupabase } from "@/lib/tell-me/snapshot-store";
import {
  TellMeServerTruthError,
  loadServerCurrentTruthForTellMe,
} from "@/lib/tell-me/server-truth";
import { isOpenAIConfigured } from "@/lib/openai";
import { isProductionRuntime } from "@/lib/runtime-config";
import { serverLog } from "@/lib/server-log";
import { recordTellMeMetricsSafe } from "@/lib/dev/cockpit/tell-me-record";
import type { MissionState } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  projectId?: string;
  userDisplayName?: string | null;
  /** Leftover — ignored. Refresh uses server-loaded durable state. */
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
    const projectId = body.projectId?.trim();
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required." },
        { status: 400 },
      );
    }

    const loaded = await loadServerCurrentTruthForTellMe({
      projectId,
      question: "Refresh project intelligence snapshot",
    });
    const project = loaded.state.projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or you do not have access to it." },
        { status: 404 },
      );
    }

    const refreshed = await refreshSnapshotWithAi({
      state: loaded.state,
      projectId,
      userDisplayName: body.userDisplayName ?? null,
      workspaceId: loaded.workspaceId,
    });

    let snapshot = refreshed.snapshot;
    if (loaded.workspaceId) {
      snapshot =
        (await saveSnapshotToSupabase(snapshot, loaded.workspaceId)) ??
        snapshot;
    }

    recordTellMeMetricsSafe({
      startedAt,
      userId: gate.userId,
      question: "[snapshot-refresh]",
      result: {
        provider: refreshed.provider,
        model: refreshed.model,
        usage: refreshed.usage,
        contextStats: {
          projectsConsidered: 1,
          recordsSelected: 0,
          snapshotUsed: true,
          knowledgeItems: snapshot.importantKnowledge.length,
          structuredItems:
            snapshot.keyState.length +
            snapshot.majorRisks.length +
            snapshot.keyDependencies.length,
          approxChars: snapshot.summary.length,
        },
        confidence: "direct_confirmation",
        answer: "refreshed",
        sources: [],
        scope: {
          mode: "project",
          projectId,
          projectCode: project.code,
          projectName: project.name,
        },
      },
      kind: "snapshot_refresh",
    });

    serverLog.info("tell_me.snapshot_refreshed", {
      userId: gate.userId,
      projectId,
      provider: refreshed.provider,
      canonicalTruthChars: loaded.canonical.approxChars,
    });

    return NextResponse.json({
      snapshot,
      message: "Lume is up to date.",
      provider: refreshed.provider,
    });
  } catch (error) {
    if (error instanceof TellMeServerTruthError) {
      serverLog.error("tell_me.refresh_failed", {
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
      error instanceof Error ? error.message : "Snapshot refresh failed";
    serverLog.error("tell_me.refresh_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
