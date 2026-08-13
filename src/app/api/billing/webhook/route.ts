import { NextResponse } from "next/server";
import {
  getStripeClient,
  getStripeWebhookSecret,
} from "@/lib/billing/stripe";
import {
  extractSubscriptionFromEvent,
  mapStripeSubscriptionToLume,
} from "@/lib/billing/stripe-map";
import {
  applySubscriptionPatch,
  recordBillingEventIfNew,
} from "@/lib/billing/webhook-apply";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { isStripeWebhookConfigured } from "@/lib/runtime-config";
import { serverLog } from "@/lib/server-log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
    return NextResponse.json(
      { error: "billing_not_configured" },
      { status: 503 },
    );
  }

  const secret = getStripeWebhookSecret();
  const stripe = await getStripeClient();
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "billing_not_configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: {
    id: string;
    type: string;
    data?: { object?: Record<string, unknown> };
  };

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
    ) as unknown as typeof event;
  } catch (err) {
    serverLog.warn("billing.webhook_signature_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    const admin = createServiceSupabaseClient();
    const sub = extractSubscriptionFromEvent(event);
    const patch = sub ? mapStripeSubscriptionToLume(sub) : null;
    const workspaceId =
      patch?.workspaceIdFromMetadata ||
      (typeof event.data?.object?.metadata === "object" &&
      event.data?.object?.metadata &&
      "workspace_id" in event.data.object.metadata
        ? String(
            (event.data.object.metadata as Record<string, string>).workspace_id,
          )
        : null);

    const { inserted } = await recordBillingEventIfNew(
      admin,
      event.id,
      event.type,
      workspaceId,
    );

    if (!inserted) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (patch && workspaceId) {
      await applySubscriptionPatch(admin, workspaceId, patch);
    } else if (patch?.stripeCustomerId) {
      const { data: customer } = await admin
        .from("billing_customers")
        .select("workspace_id")
        .eq("stripe_customer_id", patch.stripeCustomerId)
        .maybeSingle();
      if (customer?.workspace_id) {
        await applySubscriptionPatch(admin, customer.workspace_id, patch);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    serverLog.error("billing.webhook_process_failed", {
      eventId: event.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
