import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateEntitlement } from "@/lib/billing/entitlements";
import { getTrialDays } from "@/lib/billing/types";
import type {
  SubscriptionRow,
  WorkspaceEntitlement,
} from "@/lib/billing/types";
import { isStripeConfigured } from "@/lib/runtime-config";
import { serverLog } from "@/lib/server-log";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function getWorkspaceEntitlement(
  client: Client,
  workspaceId: string,
): Promise<WorkspaceEntitlement> {
  const { data, error } = await client
    .from("subscriptions")
    .select(
      "workspace_id, status, trial_started_at, trial_ends_at, current_period_end, cancel_at_period_end",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    serverLog.error("billing.entitlement_read_failed", {
      workspaceId,
      error: error.message,
    });
    throw new Error("Could not read subscription state");
  }

  return evaluateEntitlement(workspaceId, (data as SubscriptionRow | null) ?? null, {
    stripeConfigured: isStripeConfigured(),
  });
}

/**
 * Ensure a trial row exists for the workspace (idempotent).
 * Call after successful signup/login workspace bootstrap — not during incomplete signup.
 */
export async function ensureWorkspaceTrial(
  client: Client,
  workspaceId: string,
): Promise<WorkspaceEntitlement> {
  const days = getTrialDays();
  const { data, error } = await client.rpc("ensure_workspace_trial", {
    p_workspace_id: workspaceId,
    p_trial_days: days,
  });

  if (error) {
    serverLog.error("billing.ensure_trial_failed", {
      workspaceId,
      error: error.message,
    });
    // Fall back to read — may already exist from prior call
    return getWorkspaceEntitlement(client, workspaceId);
  }

  const row = data as SubscriptionRow | null;
  return evaluateEntitlement(workspaceId, row, {
    stripeConfigured: isStripeConfigured(),
  });
}
