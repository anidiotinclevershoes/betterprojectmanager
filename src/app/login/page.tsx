"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  AuthLinkRow,
  AuthNavLink,
  AuthShell,
} from "@/components/auth/AuthShell";
import {
  navigateAuthBoundary,
  safeAuthNextPath,
} from "@/lib/auth-mission-ownership";
import { friendlyAuthError } from "@/lib/auth-password";
import { clearAuthenticatedBrowserState } from "@/lib/session-cleanup";

function LoginForm() {
  const search = useSearchParams();
  const next = safeAuthNextPath(search.get("next"));
  const notice = search.get("notice");
  const urlError = search.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError === "auth_callback"
      ? "That sign-in link is invalid or expired. Try again."
      : null,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as {
        error?: string;
        mode?: string;
      };
      if (!response.ok) {
        throw new Error(friendlyAuthError(data.error));
      }
      clearAuthenticatedBrowserState();
      navigateAuthBoundary(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      lede="Open your Lume workspace."
      footer={
        <>
          <AuthLinkRow>
            <AuthNavLink href="/forgot-password">Forgot password?</AuthNavLink>
          </AuthLinkRow>
          <AuthLinkRow>
            New here? <AuthNavLink href="/signup">Create an account</AuthNavLink>
          </AuthLinkRow>
        </>
      }
    >
      {notice === "check-email" ? (
        <p className="auth-notice" role="status">
          Check your email for a confirmation link, then sign in. You&apos;ll
          land on New Project if this is your first workspace.
        </p>
      ) : null}
      {notice === "password-updated" ? (
        <p className="auth-notice" role="status">
          Your password was updated. You can sign in now.
        </p>
      ) : null}
      {notice === "reset-sent" ? (
        <p className="auth-notice" role="status">
          If that email is registered, we sent a reset link.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="login-form">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {error ? <p className="login-error">{error}</p> : null}

        <button type="submit" className="primary-btn login-submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Sign in" lede="Loading…">
          <p className="lede">Loading sign-in…</p>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
