"use client";

/**
 * Soft production gate: when Supabase-backed and trial/subscription expired,
 * block the main workspace with the entitlement panel.
 * Development local mode is never blocked.
 * past_due is soft-allowed (grace) with a lightweight warning banner.
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
        }) => {
          if (cancelled) return;
          setEntitlement(data.entitlement ?? null);
          setBillingConfigured(Boolean(data.billingConfigured));
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

  if (!hydrated) return <>{children}</>;
  if (persistenceMode !== "supabase") return <>{children}</>;
  if (!checked) return <>{children}</>;
  if (entitlement && !entitlement.canUseLume) {
    return (
      <div className="login-page">
        <div className="login-card auth-card">
          <TrialExpiredPanel
            billingConfigured={billingConfigured}
            status={entitlement.status}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {entitlement?.status === "past_due" && entitlement.canUseLume ? (
        <div className="billing-grace-banner" role="status">
          <p>
            Payment issue on your subscription — Lume still works during a short
            grace period.{" "}
            <Link href="/account">Update billing</Link>
            {billingConfigured ? " to avoid interruption." : "."}
          </p>
        </div>
      ) : null}
      {children}
    </>
  );
}
