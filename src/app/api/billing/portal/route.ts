import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensurePersonalWorkspace } from "@/lib/data/workspace-bootstrap";
import { getStripeClient } from "@/lib/billing/stripe";
import { isStripeConfigured } from "@/lib/runtime-config";
import { getSiteUrl } from "@/lib/site-url";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { serverLog } from "@/lib/server-log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          error: "billing_not_configured",
          message: "Billing is not configured in this environment.",
        },
        { status: 503 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      workspaceId?: string;
    };
    const { workspaceId: ownWorkspaceId } =
      await ensurePersonalWorkspace(supabase);
    const workspaceId = body.workspaceId?.trim() || ownWorkspaceId;

    if (workspaceId !== ownWorkspaceId) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
    }

    const admin = createServiceSupabaseClient();
    const { data: customer } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!customer?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing customer for this workspace yet." },
        { status: 400 },
      );
    }

    const stripe = await getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: "billing_not_configured" },
        { status: 503 },
      );
    }

    const site = getSiteUrl(request);
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${site}/account`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    serverLog.error("billing.portal_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not open billing portal." },
      { status: 500 },
    );
  }
}
