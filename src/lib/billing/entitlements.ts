/**
 * Pure entitlement / Stripe→Lume status mapping (no I/O).
 * Tested without Stripe credentials.
 */
import type {
  LumeSubscriptionStatus,
  SubscriptionRow,
  WorkspaceEntitlement,
} from "@/lib/billing/types";

export function mapStripeSubscriptionStatus(
  stripeStatus: string | null | undefined,
  opts?: {
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
    now?: Date;
  },
): LumeSubscriptionStatus {
  const now = opts?.now ?? new Date();
  const status = (stripeStatus || "").toLowerCase();

  if (status === "trialing") return "trialing";
  if (status === "active") {
    if (opts?.cancelAtPeriodEnd && opts.currentPeriodEnd) {
      const end = new Date(opts.currentPeriodEnd);
      if (end.getTime() <= now.getTime()) return "expired";
      return "cancelled"; // cancelled but still in paid period → handled in canUse
    }
    return "active";
  }
  if (status === "past_due") return "past_due";
  if (status === "canceled" || status === "cancelled" || status === "unpaid") {
    if (opts?.currentPeriodEnd) {
      const end = new Date(opts.currentPeriodEnd);
      if (end.getTime() > now.getTime()) return "cancelled";
    }
    return "expired";
  }
  if (status === "incomplete_expired") return "expired";
  return "expired";
}

export function evaluateEntitlement(
  workspaceId: string,
  row: SubscriptionRow | null,
  opts?: { now?: Date; stripeConfigured?: boolean },
): WorkspaceEntitlement {
  const now = opts?.now ?? new Date();
  const stripeConfigured = Boolean(opts?.stripeConfigured);

  if (!row) {
    return {
      workspaceId,
      status: "expired",
      canUseLume: false,
      reason: "no_subscription",
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeConfigured,
    };
  }

  let status = row.status;
  // Expire trials by clock even if row not yet updated.
  if (
    status === "trialing" &&
    row.trial_ends_at &&
    new Date(row.trial_ends_at).getTime() <= now.getTime()
  ) {
    status = "expired";
  }

  // Cancelled but still inside paid period → allow until period end.
  if (
    status === "cancelled" &&
    row.current_period_end &&
    new Date(row.current_period_end).getTime() > now.getTime()
  ) {
    return {
      workspaceId,
      status: "cancelled",
      canUseLume: true,
      reason: "cancelled_until_period_end",
      trialStartedAt: row.trial_started_at,
      trialEndsAt: row.trial_ends_at,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      stripeConfigured,
    };
  }

  const canUse =
    status === "trialing" ||
    status === "active" ||
    status === "past_due"; /* grace: soft-allow; UX may warn */

  return {
    workspaceId,
    status,
    canUseLume: canUse,
    reason:
      status === "trialing"
        ? "trialing"
        : status === "active"
          ? "active"
          : status === "past_due"
            ? "past_due_grace"
            : status === "cancelled"
              ? "cancelled"
              : "expired",
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    stripeConfigured,
  };
}
