/**
 * Central trial / entitlement configuration.
 * Tom confirms trial days before production go-live.
 */
export const DEFAULT_TRIAL_DAYS = 14;

export function getTrialDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.LUME_TRIAL_DAYS?.trim();
  if (!raw) return DEFAULT_TRIAL_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 365) return DEFAULT_TRIAL_DAYS;
  return Math.floor(n);
}

export type LumeSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type WorkspaceEntitlement = {
  workspaceId: string;
  status: LumeSubscriptionStatus;
  canUseLume: boolean;
  reason: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeConfigured: boolean;
};

export type SubscriptionRow = {
  workspace_id: string;
  status: LumeSubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};
