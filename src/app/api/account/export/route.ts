import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadMissionStateFromSupabase } from "@/lib/data/supabase/load-mission-state";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPersistenceMode } from "@/lib/persistence-mode";
import { buildAccountExport } from "@/lib/account/export";
import { serverLog } from "@/lib/server-log";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured() || getPersistenceMode() !== "supabase") {
    return NextResponse.json(
      { error: "Export is only available on the hosted Lume account." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const loaded = await loadMissionStateFromSupabase(supabase);
    if (loaded.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const payload = buildAccountExport({
      userId: user.id,
      email: user.email ?? null,
      workspaceId: loaded.workspaceId,
      state: loaded.state,
    });

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="lume-export.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    serverLog.error("account.export_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not export your Lume data." },
      { status: 500 },
    );
  }
}
