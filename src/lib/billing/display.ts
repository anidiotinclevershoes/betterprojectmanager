import type { LumeSubscriptionStatus } from "@/lib/billing/types";

export function subscriptionStatusLabel(status: LumeSubscriptionStatus | undefined): string {
  switch (status) {
    case "trialing":
      return "Trial";
    case "active":
      return "Active";
    case "past_due":
      return "Payment past due";
    case "cancelled":
      return "Cancelled — still usable until the period ends";
    case "expired":
      return "Ended";
    default:
      return "Unknown";
  }
}

/** Human trial remaining. Never invents a price. */
export function trialRemainingCopy(
  trialEndsAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return `Trial ended ${end.toLocaleDateString()}.`;
  const days = Math.ceil(ms / 86_400_000);
  if (days === 1) return `Trial ends tomorrow (${end.toLocaleDateString()}).`;
  return `Trial ends in ${days} days (${end.toLocaleDateString()}).`;
}

export function checkoutNoticeCopy(
  checkout: string | null | undefined,
): string | null {
  if (checkout === "success") {
    return "Checkout finished. Lume will show your paid plan after Stripe confirms it.";
  }
  if (checkout === "cancel") {
    return "Checkout was cancelled. Your current trial or plan is unchanged.";
  }
  return null;
}

export function earlyAccessCopy(): string {
  return "Billing isn’t required during early access.";
}
