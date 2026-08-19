import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensurePersonalWorkspace } from "@/lib/data/workspace-bootstrap";
import { persistNewProject } from "@/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase } from "@/lib/data/supabase/load-mission-state";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPersistenceMode } from "@/lib/persistence-mode";
import { serverLog } from "@/lib/server-log";
import type { CreateProjectInput } from "@/lib/create-project";

export const runtime = "nodejs";

/**
 * Create a project using server cookies (RLS as the signed-in user).
 * Avoids browser-client session races that previously produced local-only
 * projects which vanished on refresh.
 */
export async function POST(request: Request) {
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

    const body = (await request.json()) as { input?: CreateProjectInput };
    if (!body?.input || typeof body.input !== "object") {
      return NextResponse.json(
        { error: "Missing project input.", code: "bad_request" },
        { status: 400 },
      );
    }

    const { workspaceId } = await ensurePersonalWorkspace(supabase);
    const persisted = await persistNewProject(
      supabase,
      workspaceId,
      user.id,
      body.input,
    );

    // Return fresh workspace so the client stays aligned with the DB.
    const loaded = await loadMissionStateFromSupabase(supabase);

    serverLog.info("workspace.project_created", {
      workspaceId,
      projectId: persisted.project.id,
      userId: user.id,
    });

    return NextResponse.json({
      workspaceId,
      userId: user.id,
      projectId: persisted.project.id,
      persisted,
      state: loaded.state,
      projectCount: loaded.state.projects.length,
    });
  } catch (err) {
    serverLog.error("workspace.project_create_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not create project.",
        code: "create_failed",
      },
      { status: 500 },
    );
  }
}
