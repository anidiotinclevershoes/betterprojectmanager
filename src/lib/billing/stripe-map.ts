/**
 * Map Stripe webhook payloads → Lume subscription patch (pure / testable).
 */
import { mapStripeSubscriptionStatus } from "@/lib/billing/entitlements";
import type { LumeSubscriptionStatus } from "@/lib/billing/types";

export type StripeLikeSubscription = {
  id: string;
  status: string;
  customer?: string | { id?: string } | null;
  items?: { data?: Array<{ price?: { id?: string } | null }> };
  trial_start?: number | null;
  trial_end?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  metadata?: Record<string, string> | null;
};

export type LumeSubscriptionPatch = {
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  status: LumeSubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  workspaceIdFromMetadata: string | null;
};

function unixToIso(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

function customerId(
  customer: StripeLikeSubscription["customer"],
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id ?? null;
}

export function mapStripeSubscriptionToLume(
  sub: StripeLikeSubscription,
  now = new Date(),
): LumeSubscriptionPatch {
  const periodEnd = unixToIso(sub.current_period_end);
  const status = mapStripeSubscriptionStatus(sub.status, {
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    currentPeriodEnd: periodEnd,
    now,
  });

  return {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId(sub.customer),
    stripePriceId: sub.items?.data?.[0]?.price?.id ?? null,
    status,
    trialStartedAt: unixToIso(sub.trial_start),
    trialEndsAt: unixToIso(sub.trial_end),
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    workspaceIdFromMetadata: sub.metadata?.workspace_id ?? null,
  };
}

export type StripeLikeEvent = {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

export function extractSubscriptionFromEvent(
  event: StripeLikeEvent,
): StripeLikeSubscription | null {
  const obj = event.data?.object;
  if (!obj || typeof obj !== "object") return null;
  if (event.type.startsWith("customer.subscription.")) {
    return obj as unknown as StripeLikeSubscription;
  }
  if (
    event.type === "checkout.session.completed" &&
    typeof obj.subscription === "object" &&
    obj.subscription
  ) {
    return obj.subscription as unknown as StripeLikeSubscription;
  }
  return null;
}
