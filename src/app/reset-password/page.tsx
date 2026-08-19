"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  AuthLinkRow,
  AuthNavLink,
  AuthShell,
} from "@/components/auth/AuthShell";
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
        throw new Error(friendlyAuthError(data.error));
      }
      router.replace("/login?notice=password-updated");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
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
