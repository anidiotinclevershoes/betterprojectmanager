import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensurePersonalWorkspace } from "@/lib/data/workspace-bootstrap";
import {
  getStripeClient,
  getStripePriceId,
} from "@/lib/billing/stripe";
import { isStripeConfigured } from "@/lib/runtime-config";
import { getSiteUrl } from "@/lib/site-url";
import { serverLog } from "@/lib/server-log";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

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

    // Never trust arbitrary client workspace without membership.
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

    const stripe = await getStripeClient();
    const priceId = getStripePriceId();
    if (!stripe || !priceId) {
      return NextResponse.json(
        { error: "billing_not_configured" },
        { status: 503 },
      );
    }

    const admin = createServiceSupabaseClient();
    let { data: customer } = await admin
      .from("billing_customers")
      .select("id, stripe_customer_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!customer) {
      await admin.from("billing_customers").insert({ workspace_id: workspaceId });
      const again = await admin
        .from("billing_customers")
        .select("id, stripe_customer_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      customer = again.data;
    }

    let stripeCustomerId = customer?.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      const created = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          workspace_id: workspaceId,
          lume_user_id: user.id,
        },
      });
      stripeCustomerId = created.id;
      await admin
        .from("billing_customers")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("workspace_id", workspaceId);
    }

    const site = getSiteUrl(request);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${site}/account?checkout=success`,
      cancel_url: `${site}/account?checkout=cancel`,
      metadata: {
        workspace_id: workspaceId,
        lume_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          workspace_id: workspaceId,
          lume_user_id: user.id,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    serverLog.error("billing.checkout_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 },
    );
  }
}
