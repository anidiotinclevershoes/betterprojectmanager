import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensurePersonalWorkspace } from "@/lib/data/workspace-bootstrap";
import { persistProjectDelete } from "@/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase } from "@/lib/data/supabase/load-mission-state";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPersistenceMode } from "@/lib/persistence-mode";
import { serverLog } from "@/lib/server-log";

export const runtime = "nodejs";

/**
 * Delete one project in the signed-in user's workspace.
 * Exact durable UUID in the path — never name or client-only order.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured() || getPersistenceMode() !== "supabase") {
    return NextResponse.json(
      { error: "Supabase persistence is not active.", code: "not_supabase" },
      { status: 400 },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in required.", code: "unauthenticated" },
        { status: 401 },
      );
    }

    const { id: projectId } = await context.params;
    const { workspaceId } = await ensurePersonalWorkspace(supabase);
    await persistProjectDelete(supabase, workspaceId, projectId);

    const loaded = await loadMissionStateFromSupabase(supabase);

    serverLog.info("workspace.project_deleted", {
      workspaceId,
      projectId,
      userId: user.id,
    });

    return NextResponse.json({
      workspaceId,
      userId: user.id,
      projectId,
      state: loaded.state,
      projectCount: loaded.state.projects.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete project.";
    serverLog.error("workspace.project_delete_failed", { error: message });
    const notFound = /not found in this workspace|expected a UUID/i.test(message);
    return NextResponse.json(
      {
        error: notFound
          ? "That project is not in this workspace."
          : message,
        code: notFound ? "not_found" : "delete_failed",
      },
      { status: notFound ? 404 : 500 },
    );
  }
}
