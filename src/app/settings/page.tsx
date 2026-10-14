"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LumeThemePicker } from "@/components/app-shell/LumeThemePicker";
import { ANALYTICS_EVENTS, resetAnalyticsIdentity, trackAnalyticsEvent } from "@/lib/analytics";
import { navigateAuthBoundary } from "@/lib/auth-mission-ownership";
import { clearAuthenticatedBrowserState } from "@/lib/session-cleanup";
import { useMission } from "@/lib/store";
import { analysesRemaining } from "@/lib/workspace/history";

/**
 * Smallest V1 settings surface: identity, appearance, sign out, and the
 * existing analysis count. Subscription and deletion stay on Account.
 * Pricing and paid allowances are not decided here.
 */
export default function SettingsPage() {
  const { state } = useMission();
  const usage = analysesRemaining(state);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((me: { user?: { email: string; name: string } | null }) => {
        if (!cancelled) setUser(me.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    trackAnalyticsEvent(ANALYTICS_EVENTS.logout_completed, { surface: "settings" });
    resetAnalyticsIdentity();
    clearAuthenticatedBrowserState();
    navigateAuthBoundary("/login");
  }

  return (
    <AuthShell
      title="Settings"
      lede="Appearance, sign-in, and the analysis count for this workspace."
      footer={
        <p className="auth-links">
          <Link href="/" className="auth-text-link">
            Back to workspace
          </Link>
        </p>
      }
    >
      <div className="account-block" data-testid="settings-page">
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
        {error ? (
          <p className="issue-edit-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="button" className="ghost-btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <div className="account-block">
        <LumeThemePicker />
      </div>

      <div className="account-block" data-testid="settings-usage">
        <p className="meta">Analyses this month</p>
        <p>
          <strong>{usage.used}</strong> recorded
        </p>
        <p className="meta">
          This count is informational. The project strip still shows a local
          label of {usage.limit} analyses. That label is not a price, a plan,
          or a paid allowance. Those decisions are not made.
        </p>
      </div>

      <div className="account-block">
        <p className="meta">Account</p>
        <p className="meta">
          Subscription and account deletion stay on the Account page.
        </p>
        <Link href="/account" className="auth-text-link" data-testid="settings-account-link">
          Open Account
        </Link>
      </div>
    </AuthShell>
  );
}
