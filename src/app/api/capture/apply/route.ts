import { NextResponse } from "next/server";
import { requireAiCaller } from "@/lib/ai-gate";
import { applyApprovedCaptureSuggestion } from "@/lib/capture/apply/apply-approved";
import { parseExpectedTarget } from "@/lib/capture/apply/expected-target";
import { supabaseCaptureApplyHooks } from "@/lib/capture/apply/persist-execute";
import type { PendingSuggestion } from "@/lib/capture/suggestions";
import {
  CaptureServerTruthError,
  loadServerCaptureWorld,
} from "@/lib/capture-v2/server-truth";
import {
  DurableWorkspaceError,
  loadAuthenticatedWorkspace,
} from "@/lib/data/durable-workspace";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { serverLog } from "@/lib/server-log";

export const runtime = "nodejs";

type Body = {
  projectId?: string;
  item?: PendingSuggestion;
  text?: string;
  expectedTarget?: unknown;
};

export async function POST(request: Request) {
  try {
    const gate = await requireAiCaller("capture");
    if (!gate.ok) return gate.response;

    const body = (await request.json()) as Body;
    const projectId = body.projectId?.trim();
    if (!projectId) {
      return NextResponse.json(
        { error: "Select a project first.", code: "project_required" },
        { status: 400 },
      );
    }
    if (!body.item || typeof body.item !== "object") {
      return NextResponse.json(
        { error: "Nothing to apply.", code: "item_required" },
        { status: 400 },
      );
    }

    const expectedTarget =
      parseExpectedTarget(body.expectedTarget) ??
      body.item.expectedTarget ??
      null;

    const loaded = await loadServerCaptureWorld({ projectId });
    const supabase = await createServerSupabaseClient();
    const result = await applyApprovedCaptureSuggestion({
      item: body.item,
      text: (body.text ?? body.item.content ?? "").trim(),
      projectId,
      expectedTarget,
      loadWorkspace: async () => ({
        workspaceId: loaded.workspaceId,
        userId: loaded.userId,
        state: loaded.workspaceState,
      }),
      hooks: supabaseCaptureApplyHooks({
        client: supabase,
        workspaceId: loaded.workspaceId,
        userId: gate.userId,
        state: loaded.workspaceState,
      }),
      reloadWorkspace: async () => (await loadAuthenticatedWorkspace()).state,
    });

    serverLog.info("capture.v2_apply", {
      userId: gate.userId,
      projectId: loaded.projectId,
      executed: result.executed.kind,
    });

    return NextResponse.json({
      decision: result.decision,
      executed: result.executed,
      state: result.state,
    });
  } catch (error) {
    if (
      error instanceof CaptureServerTruthError ||
      error instanceof DurableWorkspaceError
    ) {
      serverLog.error("capture.apply_failed", {
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
      error instanceof Error ? error.message : "Capture apply failed";
    serverLog.error("capture.apply_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
