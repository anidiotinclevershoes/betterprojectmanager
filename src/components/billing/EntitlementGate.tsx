"use client";

/**
 * Soft production gate: when Supabase-backed and trial/subscription expired,
 * block the main workspace with the entitlement panel.
 * Development local mode is never blocked.
 * past_due is soft-allowed (grace) with a lightweight warning banner.
 *
 * Children must stay in a stable fragment slot. An early `<>{children}</>`
 * return that later becomes `<>{banner}{children}</>` remounts New Project
 * (and Capture) and drops in-flight Organise state.
 */
import { useEffect, useState, type ReactNode } from "react";
import { TrialExpiredPanel } from "@/components/billing/TrialExpiredPanel";
import { useMission } from "@/lib/store";
import type { WorkspaceEntitlement } from "@/lib/billing/types";
import Link from "next/link";

export function EntitlementGate({ children }: { children: ReactNode }) {
  const { persistenceMode, hydrated } = useMission();
  const [entitlement, setEntitlement] = useState<WorkspaceEntitlement | null>(
    null,
  );
  const [billingConfigured, setBillingConfigured] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  const needsBillingCheck = hydrated && persistenceMode === "supabase";

  useEffect(() => {
    if (!needsBillingCheck) return;
    let cancelled = false;
    setChecked(false);
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then(
        (data: {
          entitlement?: WorkspaceEntitlement;
          billingConfigured?: boolean;
          billingEnabled?: boolean;
        }) => {
          if (cancelled) return;
          setEntitlement(data.entitlement ?? null);
          setBillingConfigured(Boolean(data.billingConfigured));
          setBillingEnabled(data.billingEnabled === true);
          setChecked(true);
        },
      )
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsBillingCheck]);

  const billingReady = needsBillingCheck && checked;
  const blocked = Boolean(
    billingReady && billingEnabled && entitlement && !entitlement.canUseLume,
  );
  const showGrace = Boolean(
    billingReady &&
      billingEnabled &&
      entitlement?.status === "past_due" &&
      entitlement.canUseLume,
  );

  return (
    <>
      {showGrace ? (
        <div className="billing-grace-banner" role="status">
          <p>
            Payment issue on your subscription — Lume still works during a short
            grace period.{" "}
            <Link href="/account">Update billing</Link>
            {billingConfigured ? " to avoid interruption." : "."}
          </p>
        </div>
      ) : null}
      {blocked ? (
        <div className="login-page">
          <div className="login-card auth-card">
            <TrialExpiredPanel
              billingConfigured={billingConfigured}
              status={entitlement?.status}
            />
          </div>
        </div>
      ) : (
        children
      )}
    </>
  );
}
