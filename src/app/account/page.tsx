"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LumeThemePicker } from "@/components/app-shell/LumeThemePicker";
import { ANALYTICS_EVENTS, resetAnalyticsIdentity, trackAnalyticsEvent } from "@/lib/analytics";
import { navigateAuthBoundary } from "@/lib/auth-mission-ownership";
import {
  checkoutNoticeCopy,
  earlyAccessCopy,
  subscriptionStatusLabel,
  trialRemainingCopy,
} from "@/lib/billing/display";
import { DELETE_CONFIRMATION } from "@/lib/account/delete";
import { clearAuthenticatedBrowserState } from "@/lib/session-cleanup";
import type { WorkspaceEntitlement } from "@/lib/billing/types";

type StatusResponse = {
  workspaceId?: string;
  entitlement?: WorkspaceEntitlement;
  billingConfigured?: boolean;
  billingEnabled?: boolean;
  error?: string;
};

function AccountPageInner() {
  const search = useSearchParams();
  const checkoutNotice = checkoutNoticeCopy(search.get("checkout"));
  const [user, setUser] = useState<{ email: string; name: string } | null>(
    null,
  );
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletePhrase, setDeletePhrase] = useState("");

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
    trackAnalyticsEvent(ANALYTICS_EVENTS.logout_completed, { surface: "account" });
    resetAnalyticsIdentity();
    clearAuthenticatedBrowserState();
    navigateAuthBoundary("/login");
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
          data.error === "billing_disabled"
            ? earlyAccessCopy()
            : data.error === "billing_not_configured"
              ? "Billing is not configured in this environment."
              : data.error || "Checkout failed",
        );
      }
      if (data.url) {
        trackAnalyticsEvent(ANALYTICS_EVENTS.billing_checkout_started, {
          surface: "account",
          billing_configured: true,
        });
        window.location.href = data.url;
      }
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
          data.error === "billing_disabled"
            ? earlyAccessCopy()
            : data.error === "billing_not_configured"
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

  async function exportAccount() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not export your Lume data.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lume-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export your Lume data.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (deletePhrase.trim() !== DELETE_CONFIRMATION) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deletePhrase }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not delete your account.");
      }
      resetAnalyticsIdentity();
      clearAuthenticatedBrowserState();
      navigateAuthBoundary("/welcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete your account.");
    } finally {
      setBusy(false);
    }
  }

  const entitlement = status?.entitlement;
  const billingEnabled = Boolean(status?.billingEnabled);

  return (
    <AuthShell
        title="Account"
        lede="Your Lume identity, appearance, and account."
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
        <LumeThemePicker />
      </div>

      <div className="account-block">
        <p className="meta">Subscription</p>
        {!status ? (
          <p className="lede">Loading…</p>
        ) : (
          <>
            <p>
              Status:{" "}
              <strong>
                {billingEnabled
                  ? subscriptionStatusLabel(entitlement?.status)
                  : "Early access"}
              </strong>
            </p>
            {billingEnabled && entitlement?.status === "trialing" ? (
              <p className="meta">
                {trialRemainingCopy(entitlement.trialEndsAt)}
              </p>
            ) : billingEnabled && entitlement?.trialEndsAt ? (
              <p className="meta">
                Trial ended{" "}
                {new Date(entitlement.trialEndsAt).toLocaleDateString()}
              </p>
            ) : null}
            {checkoutNotice && billingEnabled ? (
              <p className="auth-notice" role="status">
                {checkoutNotice}
              </p>
            ) : null}
            {!billingEnabled ? (
              <p className="auth-notice" role="status">
                {earlyAccessCopy()}
              </p>
            ) : status.billingConfigured ? (
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

      <div className="account-block">
        <p className="meta">Your data</p>
        <p className="lede">
          Download a JSON copy of the projects you can already see in Lume.
          Secrets and service credentials are not included.
        </p>
        <div className="account-actions">
          <button
            type="button"
            className="ghost-btn"
            disabled={busy}
            onClick={() => void exportAccount()}
          >
            {busy ? "Working…" : "Export my data"}
          </button>
        </div>
      </div>

      <div className="account-block">
        <p className="meta">Delete account</p>
        <p className="lede">
          This permanently removes your hosted workspace and sign-in. Type{" "}
          <strong>{DELETE_CONFIRMATION}</strong> to confirm. This cannot be
          undone from the product.
        </p>
        <label className="field">
          <span>Confirmation</span>
          <input
            type="text"
            autoComplete="off"
            value={deletePhrase}
            onChange={(e) => setDeletePhrase(e.target.value)}
            placeholder={DELETE_CONFIRMATION}
          />
        </label>
        <div className="account-actions">
          <button
            type="button"
            className="danger-btn"
            disabled={busy || deletePhrase.trim() !== DELETE_CONFIRMATION}
            onClick={() => void deleteAccount()}
          >
            {busy ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Account" lede="Loading…">
          <p className="lede">Loading account…</p>
        </AuthShell>
      }
    >
      <AccountPageInner />
    </Suspense>
  );
}
