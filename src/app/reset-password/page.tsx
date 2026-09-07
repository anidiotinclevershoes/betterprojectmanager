"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import {
  AuthLinkRow,
  AuthNavLink,
  AuthShell,
} from "@/components/auth/AuthShell";
import { ANALYTICS_EVENTS, trackAnalyticsEvent } from "@/lib/analytics";
import {
  friendlyAuthError,
  passwordRequirementsCopy,
  validatePassword,
} from "@/lib/auth-password";

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<
    "checking" | "ready" | "expired"
  >("checking");

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await fetch("/api/auth/me", { cache: "no-store" });
          const data = (await res.json()) as { user?: { id?: string } | null };
          if (cancelled) return;
          if (data.user?.id) {
            setSessionState("ready");
            return;
          }
        } catch {
          /* retry */
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      if (!cancelled) setSessionState("expired");
    }
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          setSessionState("expired");
          return;
        }
        throw new Error(friendlyAuthError(data.error));
      }
      trackAnalyticsEvent(ANALYTICS_EVENTS.password_updated, {
        surface: "reset_password",
      });
      router.replace("/login?notice=password-updated");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  if (sessionState === "checking") {
    return (
      <AuthShell title="Choose a new password" lede="Checking your reset link…">
        <p className="lede">Hang on a moment.</p>
      </AuthShell>
    );
  }

  if (sessionState === "expired") {
    return (
      <AuthShell
        title="This reset link has expired"
        lede="For safety, password reset links only work once and for a short time."
        footer={
          <>
            <AuthLinkRow>
              <AuthNavLink href="/forgot-password">
                Request a new reset link
              </AuthNavLink>
            </AuthLinkRow>
            <AuthLinkRow>
              <AuthNavLink href="/login">Back to sign in</AuthNavLink>
            </AuthLinkRow>
          </>
        }
      >
        <p className="auth-notice" role="status">
          If you still need to change your password, request a new email. Do not
          reuse an old link.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      lede="Enter a new password for your Lume account."
      footer={
        <AuthLinkRow>
          <AuthNavLink href="/login">Back to sign in</AuthNavLink>
        </AuthLinkRow>
      }
    >
      <form onSubmit={onSubmit} className="login-form">
        <label className="field">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <span className="field-hint">{passwordRequirementsCopy()}</span>
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" className="primary-btn login-submit" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Choose a new password" lede="Loading…">
          <p className="lede">Loading…</p>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
