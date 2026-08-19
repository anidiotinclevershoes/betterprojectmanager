/**
 * Apply a mapped Stripe subscription patch via service-role client.
 * Idempotent when paired with billing_events unique provider_event_id.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LumeSubscriptionPatch } from "@/lib/billing/stripe-map";
import { serverLog } from "@/lib/server-log";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function recordBillingEventIfNew(
  admin: Client,
  providerEventId: string,
  eventType: string,
  workspaceId: string | null,
): Promise<{ inserted: boolean }> {
  const { error } = await admin.from("billing_events").insert({
    provider: "stripe",
    provider_event_id: providerEventId,
    event_type: eventType,
    workspace_id: workspaceId,
  });
  if (error) {
    if (error.code === "23505") {
      return { inserted: false };
    }
    throw new Error(`[billing] event insert failed: ${error.message}`);
  }
  return { inserted: true };
}

export async function applySubscriptionPatch(
  admin: Client,
  workspaceId: string,
  patch: LumeSubscriptionPatch,
): Promise<void> {
  // Upsert billing customer
  if (patch.stripeCustomerId) {
    const { error: custErr } = await admin.from("billing_customers").upsert(
      {
        workspace_id: workspaceId,
        stripe_customer_id: patch.stripeCustomerId,
      },
      { onConflict: "workspace_id" },
    );
    if (custErr) {
      serverLog.error("billing.customer_upsert_failed", {
        workspaceId,
        error: custErr.message,
      });
      throw new Error(custErr.message);
    }
  }

  const { data: customer } = await admin
    .from("billing_customers")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const { error } = await admin.from("subscriptions").upsert(
    {
      workspace_id: workspaceId,
      billing_customer_id: customer?.id ?? null,
      stripe_subscription_id: patch.stripeSubscriptionId,
      stripe_price_id: patch.stripePriceId,
      status: patch.status,
      trial_started_at: patch.trialStartedAt,
      trial_ends_at: patch.trialEndsAt,
      current_period_end: patch.currentPeriodEnd,
      cancel_at_period_end: patch.cancelAtPeriodEnd,
    },
    { onConflict: "workspace_id" },
  );

  if (error) {
    serverLog.error("billing.subscription_upsert_failed", {
      workspaceId,
      error: error.message,
    });
    throw new Error(error.message);
  }
}
