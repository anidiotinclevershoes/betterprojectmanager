"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TrialExpiredPanel } from "@/components/billing/TrialExpiredPanel";
import { useMission } from "@/lib/store";
import type { WorkspaceEntitlement } from "@/lib/billing/types";

/**
 * Soft production gate: when Supabase-backed and trial/subscription expired,
 * block the main workspace with the entitlement panel.
 * Development local mode is never blocked.
 */
export function EntitlementGate({ children }: { children: ReactNode }) {
  const { persistenceMode, hydrated } = useMission();
  const [entitlement, setEntitlement] = useState<WorkspaceEntitlement | null>(
    null,
  );
  const [billingConfigured, setBillingConfigured] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!hydrated || persistenceMode !== "supabase") {
      setChecked(true);
      return;
    }
    let cancelled = false;
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
  }, [hydrated, persistenceMode]);

  if (!hydrated || !checked) return <>{children}</>;
  if (persistenceMode !== "supabase") return <>{children}</>;
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
  return <>{children}</>;
}
