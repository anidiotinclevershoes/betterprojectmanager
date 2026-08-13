"use client";

import Link from "next/link";

/**
 * Shown when workspace entitlement is expired / not allowed.
 * Subscribe action activates only when billing is configured.
 */
export function TrialExpiredPanel({
  billingConfigured,
  status = "expired",
}: {
  billingConfigured: boolean;
  status?: string;
}) {
  return (
    <div className="entitlement-panel" role="alert">
      <p className="eyebrow">Account</p>
      <h1>Your Lume trial has ended</h1>
      <p className="lede">
        Keep your project memory, Capture and Coach available by subscribing.
      </p>
      {status === "past_due" ? (
        <p className="meta">
          There is a payment issue on your subscription. Update billing to
          continue without interruption.
        </p>
      ) : null}
      {billingConfigured ? (
        <form action="/api/billing/checkout" method="post">
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              void fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              })
                .then((r) => r.json())
                .then((data: { url?: string; error?: string }) => {
                  if (data.url) window.location.href = data.url;
                });
            }}
          >
            Subscribe
          </button>
        </form>
      ) : (
        <p className="auth-notice" role="status">
          Billing is not configured in this environment.
        </p>
      )}
      <p className="meta">
        <Link href="/account">Account details</Link>
      </p>
    </div>
  );
}
