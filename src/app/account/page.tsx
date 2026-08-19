"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { TrialExpiredPanel } from "@/components/billing/TrialExpiredPanel";
import { clearAuthenticatedBrowserState } from "@/lib/session-cleanup";
import type { WorkspaceEntitlement } from "@/lib/billing/types";

type StatusResponse = {
  workspaceId?: string;
  entitlement?: WorkspaceEntitlement;
  billingConfigured?: boolean;
  error?: string;
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name: string } | null>(
    null,
  );
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/billing/status").then((r) => r.json()),
    ])
      .then(([me, billing]) => {
        if (cancelled) return;
        setUser(me.user ?? null);
        setStatus(billing);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load account.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearAuthenticatedBrowserState();
    router.replace("/login");
    router.refresh();
  }

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(
          data.error === "billing_not_configured"
            ? "Billing is not configured in this environment."
            : data.error || "Checkout failed",
        );
      }
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(
          data.error === "billing_not_configured"
            ? "Billing is not configured in this environment."
            : data.error || "Portal failed",
        );
      }
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed");
    } finally {
      setBusy(false);
    }
  }

  const entitlement = status?.entitlement;
  const showExpired =
    entitlement && !entitlement.canUseLume && entitlement.status !== "trialing";

  if (showExpired) {
    return (
      <div className="login-page">
        <div className="login-card auth-card">
          <TrialExpiredPanel
            billingConfigured={Boolean(status?.billingConfigured)}
            status={entitlement.status}
          />
        </div>
      </div>
    );
  }

  return (
    <AuthShell
      title="Account"
      lede="Your Lume identity and billing status."
      footer={
        <p className="auth-links">
          <Link href="/" className="auth-text-link">
            Back to workspace
          </Link>
        </p>
      }
    >
      <div className="account-block">
        <p className="meta">Signed in as</p>
        <p className="account-identity">
          {user?.name || "Lume user"}
          {user?.email ? (
            <>
              <br />
              <span className="meta">{user.email}</span>
            </>
          ) : null}
        </p>
        <button type="button" className="ghost-btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <div className="account-block">
        <p className="meta">Subscription</p>
        {!status ? (
          <p className="lede">Loading…</p>
        ) : (
          <>
            <p>
              Status:{" "}
              <strong>{entitlement?.status ?? "unknown"}</strong>
            </p>
            {entitlement?.trialEndsAt ? (
              <p className="meta">
                Trial ends{" "}
                {new Date(entitlement.trialEndsAt).toLocaleDateString()}
              </p>
            ) : null}
            {status.billingConfigured ? (
              <div className="account-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={busy}
                  onClick={() => void startCheckout()}
                >
                  Subscribe
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={busy}
                  onClick={() => void openPortal()}
                >
                  Manage billing
                </button>
              </div>
            ) : (
              <p className="auth-notice" role="status">
                Billing is not configured in this environment.
              </p>
            )}
          </>
        )}
        {error ? <p className="login-error">{error}</p> : null}
      </div>
    </AuthShell>
  );
}
