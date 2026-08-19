import { NextResponse } from "next/server";
import { requireAiCaller } from "@/lib/ai-gate";
import { refreshSnapshotWithAi } from "@/lib/tell-me/snapshot";
import {
  resolveWorkspaceIdForProject,
  saveSnapshotToSupabase,
} from "@/lib/tell-me/snapshot-store";
import { isOpenAIConfigured } from "@/lib/openai";
import { isProductionRuntime } from "@/lib/runtime-config";
import { serverLog } from "@/lib/server-log";
import { recordTellMeMetricsSafe } from "@/lib/dev/cockpit/tell-me-record";
import type { MissionState } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  projectId?: string;
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
    if (!body.projectId || !body.state) {
      return NextResponse.json(
        { error: "projectId and state are required." },
        { status: 400 },
      );
    }

    const project = body.state.projects.find((p) => p.id === body.projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found in your workspace." },
        { status: 404 },
      );
    }

    const workspaceId = await resolveWorkspaceIdForProject(body.projectId);
    const refreshed = await refreshSnapshotWithAi({
      state: body.state,
      projectId: body.projectId,
      userDisplayName: body.userDisplayName ?? null,
      workspaceId,
    });

    let snapshot = refreshed.snapshot;
    if (workspaceId) {
      snapshot =
        (await saveSnapshotToSupabase(snapshot, workspaceId)) ?? snapshot;
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
          projectId: body.projectId,
          projectCode: project.code,
          projectName: project.name,
        },
      },
      kind: "snapshot_refresh",
    });

    serverLog.info("tell_me.snapshot_refreshed", {
      userId: gate.userId,
      projectId: body.projectId,
      provider: refreshed.provider,
    });

    return NextResponse.json({
      snapshot,
      message: "Lume is up to date.",
      provider: refreshed.provider,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Snapshot refresh failed";
    serverLog.error("tell_me.refresh_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
