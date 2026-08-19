import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensurePersonalWorkspace } from "@/lib/data/workspace-bootstrap";
import {
  ensureWorkspaceTrial,
  getWorkspaceEntitlement,
} from "@/lib/billing/service";
import { isStripeConfigured } from "@/lib/runtime-config";
import { serverLog } from "@/lib/server-log";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const { workspaceId } = await ensurePersonalWorkspace(supabase);
    // Idempotent trial bootstrap once the user has a real workspace.
    await ensureWorkspaceTrial(supabase, workspaceId);
    const entitlement = await getWorkspaceEntitlement(supabase, workspaceId);

    return NextResponse.json({
      workspaceId,
      entitlement,
      billingConfigured: isStripeConfigured(),
    });
  } catch (err) {
    serverLog.error("billing.status_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not load billing status." },
      { status: 500 },
    );
  }
}
