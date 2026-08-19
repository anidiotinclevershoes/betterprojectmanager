import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadMissionStateFromSupabase } from "@/lib/data/supabase/load-mission-state";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPersistenceMode } from "@/lib/persistence-mode";
import { serverLog } from "@/lib/server-log";

export const runtime = "nodejs";

/**
 * Load the authenticated user's workspace MissionState using server cookies.
 * Preferred hydrate path — avoids browser-client session races on hard refresh.
 */
export async function GET() {
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

    const loaded = await loadMissionStateFromSupabase(supabase);
    return NextResponse.json({
      workspaceId: loaded.workspaceId,
      userId: loaded.userId,
      state: loaded.state,
      projectCount: loaded.state.projects.length,
    });
  } catch (err) {
    serverLog.error("workspace.state_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not load workspace.",
        code: "load_failed",
      },
      { status: 500 },
    );
  }
}
